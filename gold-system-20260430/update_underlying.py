"""Minimal updater for the gold-system underliers.
- BBG is failing on this machine (service handle null / refdata timeouts) -> skip.
- Targets ONLY the relevant Haver leaf(s).
"""
import os, sys, datetime, traceback
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

# All Haver leaves discovered across the gold-system trees
HAVER_LEAVES = [
    "s111pc.g10",
    "x111atb.intdaily", "x111beb.intdaily", "x111caj.intdaily", "x111deb.intdaily",
    "x111esb.intdaily", "x111euj.intdaily", "x111fib.intdaily", "x111frb.intdaily",
    "x111grb.intdaily", "x111iej.intdaily", "x111itb.intdaily", "x111jpj.intdaily",
    "x111nlb.intdaily", "x111ptb.intdaily", "x111ukj.intdaily",
]

def units_convert(mag):
    m = {0:"",1:"Ten",2:"Hundred",3:"Thousand",4:"Ten Thousand",5:"Hundred Thousand",
         6:"Million",9:"Billion",12:"Trillion"}
    return m.get(mag, "")

for leaf in HAVER_LEAVES:
    print(f"\n=== {leaf} ===")
    try:
        # Pull the existing rosecode to make sure it's haver
        ds = rose.pull(leaf, as_pandas=False, output="all")
        actor = (ds.get("actor") or "?").lower()
        print(f"  actor: {actor}, type: {ds.get('type')}")
        if actor != "haver":
            print(f"  not haver, skipping")
            continue

        # Replicate notebook exactly
        cleaned = ds["code"].lower().replace("@", ".")
        code = cleaned.split(".")[0]
        db = cleaned.split(".")[1]
        print(f"  code='{code}' db='{db}'")
        meta = hv.metadata(code, db).iloc[0]
        magnitude = int(meta["magnitude"])
        units = meta["datatype"].replace("LocCur", "LC") + (" " + units_convert(magnitude) if magnitude > 0 else "")
        meta["units"] = units
        data = hv.data([db + ":" + code])
        # PeriodIndex -> DatetimeIndex via to_timestamp; if already datetime, leave as-is.
        if isinstance(data.index, pd.PeriodIndex):
            data = data.to_timestamp("D", how="e")
        print(f"  fetched {len(data)} obs, last date: {data.index[-1]}, last value: {data.iloc[-1].values}")
        full_code = code + "." + db
        rose_haver.push(code=full_code, metas=meta.to_frame(), values=data)
        print(f"  PUSHED ok as {full_code}")
    except Exception as e:
        print(f"  FAILED: {e}")
        traceback.print_exc()
