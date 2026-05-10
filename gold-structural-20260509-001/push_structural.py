"""Pull gold reserve holdings from Haver IFS, push to Rose under structural-sleeve names.

IFS has monthly gold reserves (in fine troy ounces) by country going back decades.
Code pattern: c{country}lmg where country is IFS code (e.g. 924 = China, 111 = USA).
"""
import os, sys, datetime
import pandas as pd
import Haver as hv
from rose_wrapper.rose import Rose

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

rose = Rose("https://rose.ai")
rose.login(os.environ.get("ROSE_ADMIN_USER", "acampbell"),
           os.environ.get("ROSE_ADMIN_PASS", "bananaman"))
rose_haver = Rose(); rose_haver.base_url = "https://rose.ai"
rose_haver.login("haver-upload@snow.ventures", "zmsd75YDbD")
print("logged in")

# IFS country codes -> our naming
# Priority: world + biggest CB gold buyers / holders
TARGETS = [
    ("001", "world",    "World"),
    ("010", "all",      "All Countries"),
    ("110", "dm",       "Advanced Economies"),
    ("200", "em",       "Emerging Economies"),
    ("111", "usa",      "USA"),
    ("924", "chn",      "China"),
    ("922", "rus",      "Russia"),
    ("534", "ind",      "India"),
    ("134", "deu",      "Germany"),
    ("158", "jpn",      "Japan"),
    ("132", "fra",      "France"),
    ("136", "ita",      "Italy"),
    ("112", "gbr",      "UK"),
    ("146", "che",      "Switzerland"),
    ("186", "tur",      "Turkey"),
    ("466", "sau",      "Saudi Arabia"),
    ("273", "mex",      "Mexico"),
    ("542", "kor",      "South Korea"),
    ("536", "idn",      "Indonesia"),
    ("578", "tha",      "Thailand"),
    ("433", "kaz",      "Kazakhstan"),
]

results = []
for ifs_code, iso, label in TARGETS:
    haver_code = f"c{ifs_code}lmg"
    rose_code = f"gold.cb.holdings.{iso}"  # World gold reserves: gold.cb.holdings.world etc.
    print(f"\n=== {iso.upper():>5} ({label}) — haver:{haver_code} -> rose:{rose_code} ===")
    try:
        meta = hv.metadata(haver_code, "ifs")
        if meta is None or meta.empty:
            print(f"  metadata not found")
            results.append((iso, label, rose_code, "no metadata"))
            continue
        row = meta.iloc[0]
        magnitude = int(row.get("magnitude", 0))
        units_map = {0:"",1:"Ten",2:"Hundred",3:"Thousand",4:"Ten Thousand",5:"Hundred Thousand",
                     6:"Million",9:"Billion",12:"Trillion"}
        units = row.get("datatype","").replace("LocCur","LC") + (" " + units_map.get(magnitude,"") if magnitude > 0 else "")
        row["units"] = units
        # Pull data
        data = hv.data([f"ifs:{haver_code}"])
        if isinstance(data.index, pd.PeriodIndex):
            data = data.to_timestamp("D", how="e")
        if data.empty:
            print(f"  empty data")
            results.append((iso, label, rose_code, "empty data"))
            continue
        # Override descriptor with friendly name
        row["descriptor"] = f"{label}: Official Gold Reserves (Million Fine Troy Ounces, monthly, IFS)"
        # Push under our friendly rosecode
        rose_haver.push(code=rose_code, metas=row.to_frame(), values=data)
        print(f"  pushed: {len(data)} obs, {data.index[0].date()} -> {data.index[-1].date()}, last={float(data.iloc[-1].iloc[0]):.2f}")
        results.append((iso, label, rose_code, f"{len(data)} obs through {data.index[-1].date()}, last={float(data.iloc[-1].iloc[0]):.2f}"))
    except Exception as e:
        print(f"  FAILED: {e}")
        results.append((iso, label, rose_code, f"FAILED: {e}"))

print("\n\n=== Summary ===")
for iso, label, rose_code, status in results:
    print(f"  {rose_code:<35} {status}")

# Save list of successful rosecodes for the dashboard build
ok = [r for r in results if "obs through" in r[3]]
print(f"\n{len(ok)} of {len(TARGETS)} pushed successfully")
import json
with open("structural_pushed.json", "w") as f:
    json.dump([{"iso": r[0], "label": r[1], "rosecode": r[2], "status": r[3]} for r in results], f, indent=2)
print("Wrote structural_pushed.json")
