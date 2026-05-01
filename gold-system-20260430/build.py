"""Build snow.ai/gold-system-20260430 from Rose chains.

Every number on the page is sourced from Rose. The page bakes the data
into a JSON file but prints the rosecode beside each chart so the
operator can paste-verify in Rose at any time.
"""
import os, sys, json, requests
from datetime import datetime
import numpy as np

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

s = requests.Session()
s.post("https://rose.ai/users/auth", json={"username": os.environ.get("ROSE_BOT_USER","chatgpt"),
                                            "password": os.environ.get("ROSE_BOT_PASS","botsbots")})

OUTDIR = r"c:\Users\campbell\snow.ai\gold-system-20260430"
os.makedirs(OUTDIR, exist_ok=True)

# --- The system: 6-signal composite, optimizer weights from gold.system.weights.20260403,
# system.weight column (nominal RY zeroed; renormalized ILB/dollar/specs/skew). ----------
COMPONENTS = [
    ("dollar_ma_rollz20",      "dollar:ma(3,252,ari):rollz(20):signal",                                   0.0937311996),
    ("ilb_chg_ma40_rz1250",    "usa.real.yield.2y.ilb:change:ma(40):flip:rollzback(1250):signal",         0.3076645410),
    ("ilb_chg_rz60_clip",      "usa.real.yield.2y.ilb:change:rollzback(60):max(3):min(-3):flip:signal",   0.0684634821),
    ("ilb_z",                  "usa.real.yield.2y.ilb:z:signal",                                          0.2917819757),
    ("specs_flip",             "gold.specs:b:ma(1,500,ari):flip:signal",                                  0.1118998917),
    ("vol_skew_rz250",         "gold.vol.skew:rollzback(250):signal",                                     0.1264589099),
]

# Composite chain: weight * component, summed with :add()
COMPOSITE = COMPONENTS[0][1] + ":mult(" + str(COMPONENTS[0][2]) + ")"
for name, code, w in COMPONENTS[1:]:
    COMPOSITE = COMPOSITE + ":add(" + code + ":mult(" + str(w) + "))"

PERIOD_START = "2008-06-06"   # bounded by gold.vol.skew start
GOLD_RETURNS = "gold:returns"  # transform, NOT named code

print("Composite chain (truncated):", COMPOSITE[:160] + "...")

def pull(code):
    r = s.get(f"https://rose.ai/objects?rosecode={code}&exact_match=1").json()
    return r.get("values"), r.get("metas") or {}

def series_dict(code):
    v, _ = pull(code)
    if not isinstance(v, dict) or "columns" in v:
        return None
    return {k[:10]: v[k] for k in v if v[k] is not None}

def risk_table(code):
    v, _ = pull(code + ":risk")
    if not v or "data" not in v:
        return None
    return dict(v["data"])

print("\n[1/4] Pulling composite system metrics...")
chain_traded = COMPOSITE + ":trade(" + GOLD_RETURNS + "):since(" + PERIOD_START + ")"
sys_risk = risk_table(chain_traded + ":returns")
print("  composite trade->risk: Sharpe", sys_risk.get("Sharpe ratio") if sys_risk else "FAILED")
sys_pnl  = series_dict(chain_traded)
print(f"  composite cumulative-pnl series: n={len(sys_pnl) if sys_pnl else 0}")

print("\n[2/4] Pulling gold buy-and-hold benchmark...")
gold_bh = risk_table(GOLD_RETURNS + ":since(" + PERIOD_START + ")")
print("  gold B&H: Sharpe", gold_bh.get("Sharpe ratio") if gold_bh else "FAILED")
gold_pnl = series_dict(GOLD_RETURNS + ":since(" + PERIOD_START + "):cum")
print(f"  gold cumulative-returns series: n={len(gold_pnl) if gold_pnl else 0}")

# Also pull rolling Sharpe + drawdown
print("\n[3/4] Pulling rolling Sharpe and drawdown...")
sys_rsharpe = series_dict(chain_traded + ":returns:rollsharpe(250)")
sys_dd      = series_dict(chain_traded + ":drawdown")
gold_dd     = series_dict(GOLD_RETURNS + ":since(" + PERIOD_START + "):drawdown")
print(f"  sys rolling Sharpe: n={len(sys_rsharpe) if sys_rsharpe else 0}")
print(f"  sys drawdown:       n={len(sys_dd) if sys_dd else 0}")
print(f"  gold drawdown:      n={len(gold_dd) if gold_dd else 0}")

print("\n[4/4] Pulling per-component metrics + values...")
components_out = []
for name, code, weight in COMPONENTS:
    chain = code + ":trade(" + GOLD_RETURNS + "):since(" + PERIOD_START + ")"
    risk = risk_table(chain + ":returns")
    if risk is None:
        print(f"  {name}: FAILED")
        components_out.append({
            "name": name, "rosecode": code, "weight": weight,
            "sharpe": None, "ann_return": None, "ann_vol": None, "max_dd": None,
        })
        continue
    components_out.append({
        "name": name, "rosecode": code, "weight": weight,
        "sharpe": risk.get("Sharpe ratio"),
        "ann_return": risk.get("Annual return"),
        "ann_vol": risk.get("Annual volatility"),
        "max_dd": risk.get("Max drawdown"),
        "calmar": risk.get("Calmar ratio"),
    })
    print(f"  {name}: Sharpe {risk.get('Sharpe ratio')}, MaxDD {risk.get('Max drawdown')}")

# Gold per-year and signal per-year for the alpha table
print("\n[bonus] Per-year returns (system vs gold)...")
sys_yoy_chain = chain_traded + ":returns:groupby(annual,sum)"
sys_yoy = series_dict(sys_yoy_chain)
gold_yoy_chain = GOLD_RETURNS + ":since(" + PERIOD_START + "):groupby(annual,sum)"
gold_yoy = series_dict(gold_yoy_chain)
print(f"  sys yoy keys: {list(sys_yoy.keys())[-5:] if sys_yoy else '-'}")

# Pull the signal value series too (so we can show position-over-time)
sig_series = series_dict(COMPOSITE + ":since(" + PERIOD_START + ")")
print(f"  composite signal series: n={len(sig_series) if sig_series else 0}")

# --- Build the data file ---
data = {
    "build_date": datetime.now().strftime("%Y-%m-%d"),
    "period": {"start": PERIOD_START, "end": max(sys_pnl.keys()) if sys_pnl else None},
    "composite_chain": COMPOSITE,
    "trade_chain": chain_traded,
    "gold_returns_code": GOLD_RETURNS,

    "system": {
        "ann_return": sys_risk.get("Annual return") if sys_risk else None,
        "ann_vol":    sys_risk.get("Annual volatility") if sys_risk else None,
        "sharpe":     sys_risk.get("Sharpe ratio") if sys_risk else None,
        "max_dd":     sys_risk.get("Max drawdown") if sys_risk else None,
        "calmar":     sys_risk.get("Calmar ratio") if sys_risk else None,
        "sortino":    sys_risk.get("Sortino ratio") if sys_risk else None,
        "cum_return": sys_risk.get("Cumulative returns") if sys_risk else None,
    },
    "gold_bh": {
        "ann_return": gold_bh.get("Annual return") if gold_bh else None,
        "ann_vol":    gold_bh.get("Annual volatility") if gold_bh else None,
        "sharpe":     gold_bh.get("Sharpe ratio") if gold_bh else None,
        "max_dd":     gold_bh.get("Max drawdown") if gold_bh else None,
        "calmar":     gold_bh.get("Calmar ratio") if gold_bh else None,
        "cum_return": gold_bh.get("Cumulative returns") if gold_bh else None,
    },
    "components": components_out,
    "series": {
        "sys_pnl":   sys_pnl or {},
        "gold_pnl":  gold_pnl or {},
        "sys_rsharpe": sys_rsharpe or {},
        "sys_drawdown": sys_dd or {},
        "gold_drawdown": gold_dd or {},
        "signal":    sig_series or {},
        "sys_yoy":   sys_yoy or {},
        "gold_yoy":  gold_yoy or {},
    },
}

with open(os.path.join(OUTDIR, "data.json"), "w") as f:
    json.dump(data, f, separators=(",", ":"))
print(f"\nWrote data.json: {os.path.getsize(os.path.join(OUTDIR, 'data.json'))} bytes")
print(f"System headline: Sharpe {data['system']['sharpe']}, MaxDD {data['system']['max_dd']}, Cum {data['system']['cum_return']}")
