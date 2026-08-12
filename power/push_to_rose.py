"""Push Power 2026 structured data to Rose.ai.

Source: power2026.ai (Neel Somani — former Citadel quant, power & gas)
Pushes data center demand, capacity auction, interconnection queue,
and power market reference data under the power.* namespace.
"""
import os, sys, json, datetime
import requests

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROSE_URL = "https://rose.ai"
USERNAME = os.environ.get("ROSE_ADMIN_USER", "acampbell")
PASSWORD = os.environ.get("ROSE_ADMIN_PASS", "bananaman")

s = requests.Session()
r = s.post(f"{ROSE_URL}/users/auth", json={"username": USERNAME, "password": PASSWORD})
if r.status_code != 200:
    print(f"Auth failed: {r.status_code} {r.text[:200]}")
    sys.exit(1)
print(f"Authenticated as {USERNAME}")

with open(os.path.join(os.path.dirname(__file__), "data.json")) as f:
    data = json.load(f)

with open(os.path.join(os.path.dirname(__file__), "rosecodes.json")) as f:
    rosecodes = json.load(f)

results = []

SERIES_DATA = {
    "power.dc.demand.us.gw": {
        "descriptor": "US Data Center Electricity Demand (GW, annual)",
        "values": data["market_data"]["data_center_demand"]["series"],
        "units": "GW",
        "source": "Goldman Sachs, IEA, industry estimates",
        "frequency": "annual",
    },
    "power.dc.consumption.global.twh": {
        "descriptor": "Global Data Center Electricity Consumption (TWh, annual)",
        "values": {
            "2025": data["market_data"]["global_dc_consumption_twh"]["2025"],
            "2026": data["market_data"]["global_dc_consumption_twh"]["2026"],
        },
        "units": "TWh",
        "source": "IEA",
        "frequency": "annual",
    },
    "power.pjm.capacity.clearing.price": {
        "descriptor": "PJM Capacity Auction RTO Clearing Price ($/MW-day UCAP)",
        "values": {
            "2025": data["market_data"]["pjm_capacity_auction"]["prior_year_rto_mw_day"],
            "2026": data["market_data"]["pjm_capacity_auction"]["rto_clearing_price_mw_day"],
        },
        "units": "$/MW-day",
        "source": "PJM Interconnection",
        "frequency": "annual",
    },
    "power.interconnection.queue.pending.gw": {
        "descriptor": "US Interconnection Queue Total Pending Capacity (GW)",
        "values": {
            "2026": data["market_data"]["interconnection_queue"]["total_pending_gw"],
        },
        "units": "GW",
        "source": "PJM, LBNL",
        "frequency": "snapshot",
    },
    "power.dc.btm.gas.planned.gw": {
        "descriptor": "Behind-the-Meter Gas Generation Planned for Data Centers (GW)",
        "values": {
            "2026": data["market_data"]["interconnection_queue"]["btm_gas_planned_gw"],
        },
        "units": "GW",
        "source": "Cleanview analysis (46 projects identified)",
        "frequency": "snapshot",
    },
    "power.ai.energy.market.value.usd.bn": {
        "descriptor": "AI in Energy & Power Market Value (USD Billion)",
        "values": {
            "2026": data["market_data"]["ai_energy_market"]["2026_value_usd_bn"],
            "2030": data["market_data"]["ai_energy_market"]["2030_projected_usd_bn"],
        },
        "units": "USD Billion",
        "source": "Research and Markets",
        "frequency": "annual",
    },
}

for code, spec in SERIES_DATA.items():
    print(f"\n=== {code} ===")
    try:
        payload = {
            "code": code,
            "descriptor": spec["descriptor"],
            "values": spec["values"],
            "units": spec["units"],
            "source": spec["source"],
            "frequency": spec.get("frequency", "annual"),
            "tags": ["power", "ai", "data_center", "power2026"],
        }
        r = s.post(f"{ROSE_URL}/objects", json=payload)
        if r.status_code in (200, 201):
            print(f"  PUSHED: {code} ({len(spec['values'])} obs)")
            results.append((code, f"OK — {len(spec['values'])} obs"))
        else:
            print(f"  HTTP {r.status_code}: {r.text[:200]}")
            results.append((code, f"HTTP {r.status_code}"))
    except Exception as e:
        print(f"  FAILED: {e}")
        results.append((code, f"FAILED: {e}"))

print("\n\n=== Summary ===")
for code, status in results:
    print(f"  {code:<45} {status}")

pushed_path = os.path.join(os.path.dirname(__file__), "push_results.json")
with open(pushed_path, "w") as f:
    json.dump({
        "push_date": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
        "user": USERNAME,
        "results": [{"code": c, "status": s} for c, s in results],
    }, f, indent=2)
print(f"\nWrote {pushed_path}")
