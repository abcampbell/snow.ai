"""Clean-shutdown push: project state + continuation + session to Rose."""
import json
import os
import requests
from pathlib import Path

ROSE = "https://rose.ai"
ADMIN_USER = os.environ.get("ROSE_ADMIN_USER", "acampbell")
ADMIN_PASS = os.environ.get("ROSE_ADMIN_PASS", "bananaman")

MEM = Path(r"C:\Users\campbell\.claude\projects\c--Users-campbell-snow-ai\memory")
PROJECT = Path(__file__).parent

s = requests.Session()
s.post(f"{ROSE}/users/auth", json={"username": ADMIN_USER, "password": ADMIN_PASS}).raise_for_status()


def push_doc(rosecode: str, title: str, body: str):
    """Push as a single-row 'entry' table to match bot.continuation.quant.azure shape."""
    # Split body into logical entries (one per markdown bullet/section heading)
    lines = [ln.rstrip() for ln in body.splitlines() if ln.strip()]
    rows = [[ln] for ln in lines]
    payload = {
        "code": rosecode,
        "type": "map",
        "metas": {"title": title, "source": "claude.quant.azure", "push_tag": "all_beta_20260419_shutdown"},
        "values": {"columns": ["entry"], "data": rows},
    }
    r = s.post(f"{ROSE}/data", json=payload, headers={"Snow-Overwrite": "1"}, timeout=60)
    if r.status_code >= 400:
        print(f"push_doc {rosecode}: {r.status_code} {r.text[:200]}")
    else:
        print(f"pushed {rosecode}")


def push_kv(rosecode: str, title: str, kv: dict):
    """Push a key/value table (matches bot.role.quant shape)."""
    rows = [[k, json.dumps(v) if not isinstance(v, str) else v] for k, v in kv.items()]
    payload = {
        "code": rosecode,
        "type": "map",
        "metas": {"title": title, "source": "claude.quant.azure", "push_tag": "all_beta_20260419_shutdown"},
        "values": {"columns": ["key", "value"], "data": rows},
    }
    r = s.post(f"{ROSE}/data", json=payload, headers={"Snow-Overwrite": "1"}, timeout=60)
    if r.status_code >= 400:
        print(f"push_kv {rosecode}: {r.status_code} {r.text[:200]}")
    else:
        print(f"pushed {rosecode}")


# 1. Project state
project_summary = {
    "project": "all.beta.20260419",
    "date_snapshot": "2026-04-26",
    "owner": "quant.azure",
    "repo_path": r"C:\Users\campbell\snow.ai\all.beta.20260419",
    "status": "spine complete; no real risk system yet",
    "deliverables_built": [
        "four_portfolios.py", "run_four_portfolios.py", "seed_missing_etfs.py",
        "charts/four_return_vs_risk.png", "charts/four_cumulative.png", "charts/four_drawdowns.png",
        "charts/four_rolling_sharpe.png", "charts/four_regime_heatmap.png", "charts/four_current_weights.png",
        "tables/summary_stats.csv", "tables/regime_performance.csv", "tables/current_weights.csv",
        "tables/campbell_delta_vs_reference.csv", "tables/portfolio_correlations.csv",
        "four_portfolios_analysis.json", "four_portfolios_analysis.js",
        "index.html (Four Ways To Buy Beta panel)",
    ],
    "headline_results": {
        "aw_synth_sharpe": 0.70,
        "all_beta_unlev_sharpe": 0.70,
        "all_beta_lev15_sharpe": 0.47,
        "rssb_style_sharpe": 0.59,
        "campbell_book_sharpe": 0.82,
        "aw_vs_all_beta_correlation": 0.68,
        "campbell_vs_all_beta_correlation": 0.94,
        "year_2022_drawdowns_pct": {
            "aw_synth": -28.7, "all_beta_unlev": -19.9, "all_beta_lev15": -34.4,
            "rssb_style": -20.7, "campbell": -18.6,
        },
        "leverage_capacity_status": {
            "all_beta_lev15": "ALREADY OVER CAP (realized 16.3% vs cap 14.4%)",
            "campbell": "2.5x unused leverage room (cap 18.6% vs realized 7.3%)",
        },
    },
    "deferred": [
        "real risk-system / factor attribution on the 5 portfolios",
        "blpapi-driven risk decomp (BBG PORT failed, blpapi underlying confirmed up 2026-04-26)",
        "findings.md write-up",
        "Jupyter .ipynb deliverable",
        "alpha-allocator panel (Sharpe x correlation x confidence prior)",
    ],
    "key_constraints": [
        "Rose data only (gpt.beta.benchmark.{t}.{t}.total.return.yahoo:returns); do not re-pull from yahoo at backtest time.",
        "synthetic RSSB pre-2023-08 = 100% SPY + 100% IEF - (BIL + 10bps/yr); synthetic NTSX pre-2018 = 90 SPY + 60 IEF - 0.5x financing.",
        "Walk-forward vol estimates; no peek.",
        "Quarterly rebalance first trading day of Jan/Apr/Jul/Oct.",
        "BBG: blpapi up; PORT GUI was the failure mode for the operator on 2026-04-26.",
    ],
}
push_kv("bot.project.all_beta_20260419",
        "All Beta 20260419 - four-portfolio comparison",
        project_summary)

# 2. Continuation
push_doc("bot.continuation.quant.azure",
         "quant.azure continuation (2026-04-26)",
         (MEM / "continuation.quant.azure.md").read_text(encoding="utf-8"))

# 3. Session log (dated)
push_doc("bot.session.quant.azure.20260426",
         "quant.azure session 2026-04-20 to 2026-04-26",
         (MEM / "session.quant.azure.md").read_text(encoding="utf-8"))

print("shutdown push complete")
