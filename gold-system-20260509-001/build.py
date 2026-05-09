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
    # name, signal_chain, weight, raw_underlier (pre :signal)
    ("dollar_ma_rollz20",      "dollar:ma(3,252,ari):rollz(20):signal",                                   0.0937311996, "dollar:ma(3,252,ari):rollz(20)"),
    ("ilb_chg_ma40_rz1250",    "usa.real.yield.2y.ilb:change:ma(40):flip:rollzback(1250):signal",         0.3076645410, "usa.real.yield.2y.ilb:change:ma(40):flip:rollzback(1250)"),
    ("ilb_chg_rz60_clip",      "usa.real.yield.2y.ilb:change:rollzback(60):max(3):min(-3):flip:signal",   0.0684634821, "usa.real.yield.2y.ilb:change:rollzback(60):max(3):min(-3):flip"),
    ("ilb_z",                  "usa.real.yield.2y.ilb:z:signal",                                          0.2917819757, "usa.real.yield.2y.ilb:z"),
    ("specs_flip",             "gold.specs:b:ma(1,500,ari):flip:signal",                                  0.1118998917, "gold.specs:b:ma(1,500,ari):flip"),
    ("vol_skew_rz250",         "gold.vol.skew:rollzback(250):signal",                                     0.1264589099, "gold.vol.skew:rollzback(250)"),
]

# Composite chain: weight * component, summed with :add()
COMPOSITE = COMPONENTS[0][1] + ":mult(" + str(COMPONENTS[0][2]) + ")"
for c in COMPONENTS[1:]:
    name, code, w = c[0], c[1], c[2]
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
# Gold DD: must be drawdown of the cumulative equity curve, not of the raw return series.
gold_dd     = series_dict(GOLD_RETURNS + ":since(" + PERIOD_START + "):cum:drawdown")
print(f"  sys rolling Sharpe: n={len(sys_rsharpe) if sys_rsharpe else 0}")
print(f"  sys drawdown:       n={len(sys_dd) if sys_dd else 0}")
print(f"  gold drawdown:      n={len(gold_dd) if gold_dd else 0}")

print("\n[4/4] Pulling per-component metrics + values + recent attribution...")
components_out = []
for name, code, weight, rawcode in COMPONENTS:
    chain = code + ":trade(" + GOLD_RETURNS + "):since(" + PERIOD_START + ")"
    risk = risk_table(chain + ":returns")
    sig_series = series_dict(code)
    raw_series = series_dict(rawcode)
    last_sig = None; last_raw = None; last_date = None
    if sig_series:
        ds = sorted(sig_series.keys())
        last_date = ds[-1]
        last_sig = sig_series[last_date]
    if raw_series and last_date:
        last_raw = raw_series.get(last_date)
    last30_sig = []
    history_long = []
    if sig_series:
        all_dates = sorted(sig_series.keys())
        for d in all_dates[-60:]:
            last30_sig.append({"date": d, "signal": sig_series[d],
                               "raw": (raw_series or {}).get(d),
                               "contribution": sig_series[d] * weight})
        # 5y monthly downsampled for the long-term chart (keep size reasonable)
        long_dates = [d for d in all_dates if d >= "2008-06-06"]
        # downsample to weekly
        prev_week = None
        for d in long_dates:
            wk = d[:7] + "-" + str((int(d[8:10]) - 1) // 7)
            if wk != prev_week:
                history_long.append({"date": d, "signal": sig_series[d]})
                prev_week = wk
    if risk is None:
        print(f"  {name}: FAILED risk; have signal={last_sig}")
        components_out.append({
            "name": name, "rosecode": code, "raw_rosecode": rawcode, "weight": weight,
            "sharpe": None, "ann_return": None, "ann_vol": None, "max_dd": None,
            "last_signal": last_sig, "last_raw": last_raw, "last_date": last_date,
            "history60": last30_sig, "history_long": history_long,
        })
        continue
    components_out.append({
        "name": name, "rosecode": code, "raw_rosecode": rawcode, "weight": weight,
        "sharpe": risk.get("Sharpe ratio"),
        "ann_return": risk.get("Annual return"),
        "ann_vol": risk.get("Annual volatility"),
        "max_dd": risk.get("Max drawdown"),
        "calmar": risk.get("Calmar ratio"),
        "last_signal": last_sig, "last_raw": last_raw, "last_date": last_date,
        "history60": last30_sig, "history_long": history_long,
    })
    print(f"  {name}: Sharpe {risk.get('Sharpe ratio')}, MaxDD {risk.get('Max drawdown')}, last sig={last_sig:+.3f} (raw {last_raw:+.3f})" if last_raw is not None else f"  {name}: Sharpe {risk.get('Sharpe ratio')}, last sig={last_sig}")

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
# --- Market context: latest values + recent moves of the macro forces driving the system ---
def latest_and_changes(code, lookbacks_bd=(1, 5, 20)):
    """Return {'value':, 'date':, 'd1':, 'd5':, 'd20':} where dN is value change over N bdays."""
    series = series_dict(code)
    if not series: return None
    keys = sorted(series.keys())
    last_d = keys[-1]; last_v = series[last_d]
    out = {"value": last_v, "date": last_d}
    for n in lookbacks_bd:
        if len(keys) > n:
            prev_v = series[keys[-1 - n]]
            if prev_v is not None and last_v is not None:
                out[f"d{n}"] = last_v - prev_v
                if abs(prev_v) > 1e-9:
                    out[f"pct{n}"] = (last_v / prev_v - 1.0)
    return out

print("\n[market context] pulling macro inputs...")
market = {
    "gold": latest_and_changes("gold"),
    "ilb_2y": latest_and_changes("usa.real.yield.2y.ilb"),
    "nominal_ry_2y": latest_and_changes("usa.real.yield.2y"),
    "dollar": latest_and_changes("dollar"),
    "vol_skew": latest_and_changes("gold.vol.skew"),
}
for k, v in market.items():
    if v: print(f"  {k:>14}: {v['date']} = {v['value']:.4f}  d5={v.get('d5','?')} pct5={v.get('pct5','?')}")

# Stored pushed composite (extends slightly later than the chain when components stale)
stored_composite = series_dict("gold.system.004.20260403")

# Build latest-date attribution table — find latest date that has all components
def find_latest_common(comps):
    if not comps: return None
    dsets = [set((c["history60"] or []) and {h["date"] for h in c["history60"]}) for c in comps]
    if not all(dsets): return None
    common = set.intersection(*dsets)
    return max(common) if common else None

# --- Freshness analysis ---
component_dates = sorted({c.get("last_date") for c in components_out if c.get("last_date")})
freshest_date = component_dates[-1] if component_dates else None

# Fresh-only composite: drop components whose last_date is below the freshest.
fresh_only = []
fresh_only_total = 0.0
total_fresh_weight = sum(c["weight"] for c in components_out if c.get("last_date") == freshest_date)
all_active_active = sum(c["weight"] for c in components_out if c.get("last_date") and component_dates and (c["last_date"] >= component_dates[-2] if len(component_dates) >= 2 else True))

# Stale = >1 business day behind the freshest component.
def biz_days_between(a, b):
    if not a or not b: return None
    from datetime import date
    da = date.fromisoformat(a); db = date.fromisoformat(b)
    if db < da: da, db = db, da
    bd = 0
    cur = da
    from datetime import timedelta
    while cur < db:
        cur = cur + timedelta(days=1)
        if cur.weekday() < 5: bd += 1
    return bd

stale_components = []
fresh_components = []
for c in components_out:
    lag = biz_days_between(c.get("last_date"), freshest_date) if c.get("last_date") else None
    c_stale_info = {
        "name": c["name"], "last_date": c.get("last_date"), "weight": c["weight"],
        "last_signal": c.get("last_signal"), "biz_days_late": lag,
    }
    if lag is not None and lag <= 1:
        fresh_components.append(c)
    else:
        stale_components.append(c_stale_info)

# Recompute composite using only fresh components, renormalized
fresh_weight_sum = sum(c["weight"] for c in fresh_components)
fresh_only_attribution = []
if fresh_weight_sum > 0:
    for c in fresh_components:
        nw = c["weight"] / fresh_weight_sum
        sig = c.get("last_signal")
        contrib = (sig * nw) if sig is not None else None
        fresh_only_attribution.append({
            "name": c["name"], "weight_orig": c["weight"], "weight_renorm": nw,
            "signal": sig, "contribution": contrib, "last_date": c.get("last_date"),
        })
        if contrib is not None:
            fresh_only_total += contrib

print(f"\nFreshness:")
print(f"  freshest date: {freshest_date}")
print(f"  fresh: {[c['name'] for c in fresh_components]}")
print(f"  stale: {[(s['name'], s['last_date']) for s in stale_components]}")
print(f"  fresh-only composite (renormalized): {fresh_only_total:+.4f}")

latest_common = find_latest_common(components_out)
# Attribution = each component's MOST RECENT value times its weight (forward-fill semantics).
# This is THE composite "as of today"; sum is the single live composite number.
attribution = []
attribution_total = 0.0
for c in components_out:
    sig = c.get("last_signal")
    if sig is None: continue
    contrib = sig * c["weight"]
    attribution.append({
        "name": c["name"], "weight": c["weight"], "rosecode": c["rosecode"],
        "raw_rosecode": c["raw_rosecode"],
        "raw": c.get("last_raw"), "signal": sig,
        "contribution": contrib,
        "signal_last_date": c.get("last_date"),
        "raw_last_date": c.get("last_date"),
    })
    attribution_total += contrib

attribution_as_of = max((c.get("last_date") for c in components_out if c.get("last_date")), default=None)
print(f"\nLive composite (each component at its latest, sum) as of {attribution_as_of}: {attribution_total:+.4f}")
for a in sorted(attribution, key=lambda x: -abs(x["contribution"])):
    print(f"  {a['name']:>22}: signal={a['signal']:+.3f} weight={a['weight']:.4f} contrib={a['contribution']:+.4f}")

data = {
    "build_date": datetime.now().strftime("%Y-%m-%d"),
    "period": {"start": PERIOD_START, "end": max(sys_pnl.keys()) if sys_pnl else None},
    "composite_chain": COMPOSITE,
    "trade_chain": chain_traded,
    "gold_returns_code": GOLD_RETURNS,
    "stored_composite_code": "gold.system.004.20260403",
    "stored_composite_last": (max(stored_composite.keys()), stored_composite[max(stored_composite.keys())]) if stored_composite else None,
    "stored_composite_recent": [{"date": d, "value": stored_composite[d]} for d in sorted(stored_composite.keys())[-30:]] if stored_composite else [],
    "attribution_as_of": attribution_as_of,
    "attribution_total": attribution_total,
    "attribution": sorted(attribution, key=lambda x: -abs(x["contribution"])),

    # Freshness
    "freshest_date": freshest_date,
    "stale_components": stale_components,
    "fresh_components_count": len(fresh_components),
    "fresh_only_composite": fresh_only_total,
    "fresh_only_attribution": sorted(fresh_only_attribution, key=lambda x: -abs(x["contribution"] or 0)),
    "fresh_weight_sum": fresh_weight_sum,

    # Market context for the synthesis paragraph at the top of the dashboard
    "market": market,

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
