"""Build structural-sleeve dashboard data.json.

Pulls:
- gold.cb.holdings.* (21 series, monthly, since 1950) -- official gold reserves by country
- gld.shares (daily, since 2004) -- Western ETF flow
- gold.specs (weekly, since 1995) -- CFTC speculative positioning
- gold (daily, since 1679) -- price context

Computes:
- 12mo change in CB holdings (= rolling annual net purchases, in Moz)
- DM vs EM holdings share
- Country-level levels
- 60d / 250d z-scores for gld.shares
"""
import os, sys, json, requests
import numpy as np
from datetime import datetime
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

s = requests.Session()
# Admin auth so we can read freshly-pushed series under haver-upload account
s.post("https://rose.ai/users/auth", json={"username": os.environ.get("ROSE_ADMIN_USER","acampbell"),
                                            "password": os.environ.get("ROSE_ADMIN_PASS","bananaman")})

OUTDIR = r"c:\Users\campbell\snow.ai\gold-structural-20260509-001"

COUNTRIES = [
    ("world", "World"),
    ("all",   "All Countries"),
    ("dm",    "Advanced Economies"),
    ("em",    "Emerging Economies"),
    ("usa",   "USA"),
    ("chn",   "China"),
    ("rus",   "Russia"),
    ("ind",   "India"),
    ("deu",   "Germany"),
    ("jpn",   "Japan"),
    ("fra",   "France"),
    ("ita",   "Italy"),
    ("gbr",   "UK"),
    ("che",   "Switzerland"),
    ("tur",   "Turkey"),
    ("sau",   "Saudi Arabia"),
    ("mex",   "Mexico"),
    ("kor",   "South Korea"),
    ("idn",   "Indonesia"),
    ("tha",   "Thailand"),
    ("kaz",   "Kazakhstan"),
]

def pull(code):
    r = s.get(f"https://rose.ai/objects?rosecode={code}&exact_match=1").json()
    return r.get("values")

def series(code):
    v = pull(code)
    if not isinstance(v, dict) or "columns" in v: return None
    return {k[:10]: float(v[k]) for k in v if v[k] is not None}

def diff_12m(d):
    """For monthly series, annual change (last value - 12 obs ago)."""
    keys = sorted(d.keys())
    out = {}
    for i, k in enumerate(keys):
        if i < 12: continue
        prev = d[keys[i - 12]]
        if prev is not None and d[k] is not None:
            out[k] = d[k] - prev
    return out

def rollz(d, n):
    """Rolling z-score over last n observations."""
    keys = sorted(d.keys())
    vals = [d[k] for k in keys]
    out = {}
    for i in range(n, len(keys)):
        window = vals[i - n:i]
        m = np.mean(window); sd = np.std(window)
        if sd > 0:
            out[keys[i]] = (vals[i] - m) / sd
    return out

print("Pulling CB holdings...")
cb = {}
for iso, label in COUNTRIES:
    code = f"gold.cb.holdings.{iso}"
    sr = series(code)
    if sr:
        cb[iso] = sr
        keys = sorted(sr.keys())
        last = keys[-1]; prev_yr = keys[-13] if len(keys) > 12 else keys[0]
        annual_change = sr[last] - sr[prev_yr] if sr[prev_yr] is not None else None
        print(f"  {iso:>5} {label:<22} n={len(sr)} last={last}: {sr[last]:.2f} Moz, 12m chg={annual_change:+.2f} Moz")

print("\nPulling other structural...")
gld_shares = series("gld.shares")
print(f"  gld.shares: n={len(gld_shares) if gld_shares else 0}")

specs = series("gold.specs")
print(f"  gold.specs: n={len(specs) if specs else 0}")

gold_price = series("gold")
print(f"  gold:       n={len(gold_price) if gold_price else 0}")

# Restrict gold price to since 1990 to keep file size reasonable
gold_recent = {k: v for k, v in gold_price.items() if k >= "1990-01-01"} if gold_price else {}

# Compute 12mo CB net purchases for each country
cb_12m = {iso: diff_12m(sr) for iso, sr in cb.items()}

# Top buyers (last value of 12m change), excluding aggregates
country_codes_only = [iso for iso, _ in COUNTRIES if iso not in ("world", "all", "dm", "em")]
ranking = []
for iso in country_codes_only:
    if iso in cb_12m and cb_12m[iso]:
        keys = sorted(cb_12m[iso].keys())
        last_chg = cb_12m[iso][keys[-1]]
        last_level = cb[iso][keys[-1]] if iso in cb else None
        ranking.append({"iso": iso, "label": dict(COUNTRIES)[iso],
                        "last_date": keys[-1], "level_moz": last_level,
                        "annual_change_moz": last_chg})
ranking.sort(key=lambda r: -(r["annual_change_moz"] or 0))

# gld.shares 60d / 250d z-scores
gld_z60 = rollz(gld_shares, 60) if gld_shares else {}
gld_z250 = rollz(gld_shares, 250) if gld_shares else {}

data = {
    "build_date": datetime.now().strftime("%Y-%m-%d"),
    "countries": [{"iso": iso, "label": label} for iso, label in COUNTRIES],
    "cb_holdings": cb,           # iso -> {date: Moz}
    "cb_12m_change": cb_12m,     # iso -> {date: 12m change in Moz}
    "ranking": ranking,
    "gld_shares": gld_shares or {},
    "gld_z60":    gld_z60,
    "gld_z250":   gld_z250,
    "gold_specs": specs or {},
    "gold_price": gold_recent,
}

with open(os.path.join(OUTDIR, "data.json"), "w") as f:
    json.dump(data, f, separators=(",", ":"))
print(f"\nWrote data.json: {os.path.getsize(os.path.join(OUTDIR, 'data.json'))} bytes")

print("\n=== Top buyers (last 12m, Moz) ===")
for r in ranking[:10]:
    print(f"  {r['iso'].upper():>5}  level={r['level_moz']:>7.2f}  +12m={r['annual_change_moz']:+7.3f}  ({r['last_date']})")
