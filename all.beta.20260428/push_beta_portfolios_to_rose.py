from __future__ import annotations

import argparse
import json
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parent
OUTPUT_MANIFEST_PATH = PROJECT_DIR / "rose_beta_portfolios_manifest.json"
BLACK_ROSE_SRC = Path(r"C:\Users\campbell\black_rose_os\src")

if str(BLACK_ROSE_SRC) not in sys.path:
    sys.path.insert(0, str(BLACK_ROSE_SRC))

from black_rose.rose.client import RoseClient


DEFAULT_MAP_CODE = "gpt.beta.portfolio.funds.total.return.yahoo.map"
DEFAULT_NOTEBOOK_CODE = "gpt.beta.portfolio.funds.total.return.yahoo.notebook"

PORTFOLIOS = [
    {"ticker": "QDSIX", "fund": "AQR Diversifying Strategies", "type": "MF", "age": "~6y", "aum_bn": 7.1, "fee": "1.27% adj / ~3.0% net"},
    {"ticker": "AQMIX", "fund": "AQR Managed Futures", "type": "MF", "age": "~16y", "aum_bn": 3.0, "fee": "1.26% adj / ~2.7% net"},
    {"ticker": "AQRIX", "fund": "AQR Multi-Asset", "type": "MF", "age": "~15y", "aum_bn": 2.4, "fee": "0.81% adj / 1.06% net"},
    {"ticker": "QSPIX", "fund": "AQR Style Premia Alt", "type": "MF", "age": "~12y", "aum_bn": 2.3, "fee": "1.52% adj / ~5.9% net"},
    {"ticker": "ARCIX", "fund": "AQR Risk Balanced Commodities", "type": "MF", "age": "~14y", "aum_bn": 1.6, "fee": "~1.02%"},
    {"ticker": "NTSX", "fund": "WisdomTree Efficient Core (US)", "type": "ETF", "age": "~8y", "aum_bn": 1.3, "fee": "0.20%"},
    {"ticker": "ALLW", "fund": "Bridgewater All Weather ETF", "type": "ETF", "age": "~1y", "aum_bn": 1.2, "fee": "0.85%"},
    {"ticker": "REMIX", "fund": "Standpoint Multi-Asset", "type": "MF", "age": "~4y", "aum_bn": 0.7, "fee": "1.38%"},
    {"ticker": "GDE", "fund": "WisdomTree Gold + Equity", "type": "ETF", "age": "~4y", "aum_bn": 0.6, "fee": "0.20%"},
    {"ticker": "RPAR", "fund": "Risk Parity ETF", "type": "ETF", "age": "~6y", "aum_bn": 0.6, "fee": "0.50%"},
    {"ticker": "QRPIX", "fund": "AQR Alt Risk Premia", "type": "MF", "age": "~9y", "aum_bn": 0.5, "fee": "1.43% adj / ~5.0% net"},
    {"ticker": "NTSI", "fund": "WisdomTree Efficient Core Intl", "type": "ETF", "age": "~5y", "aum_bn": 0.5, "fee": "0.26%"},
    {"ticker": "RSSB", "fund": "Return Stacked Global Stocks/Bonds", "type": "ETF", "age": "~2y", "aum_bn": 0.47, "fee": "0.40%"},
    {"ticker": "RSST", "fund": "Return Stacked Stocks + Futures", "type": "ETF", "age": "~2.5y", "aum_bn": 0.40, "fee": "0.99%"},
    {"ticker": "GDMN", "fund": "WisdomTree Gold Miners + Gold", "type": "ETF", "age": "~4y", "aum_bn": 0.25, "fee": "0.45%"},
    {"ticker": "WTMF", "fund": "WisdomTree Managed Futures", "type": "ETF", "age": "~15y", "aum_bn": 0.22, "fee": "~0.66%"},
    {"ticker": "RSBT", "fund": "Return Stacked Bonds + Futures", "type": "ETF", "age": "~3y", "aum_bn": 0.13, "fee": "1.02%"},
    {"ticker": "RSSY", "fund": "Return Stacked Stocks + Yield", "type": "ETF", "age": "~2y", "aum_bn": 0.10, "fee": "0.98%"},
    {"ticker": "UPAR", "fund": "Ultra Risk Parity ETF", "type": "ETF", "age": "~4y", "aum_bn": 0.07, "fee": "0.65%"},
    {"ticker": "RSSX", "fund": "Return Stacked Stocks + Gold/BTC", "type": "ETF", "age": "~1y", "aum_bn": 0.06, "fee": "0.68%"},
]

CHART_COLORS = [
    "#2e6f95",
    "#c97c1a",
    "#a23e48",
    "#4d908e",
    "#6c7a89",
    "#274c77",
    "#af5d63",
    "#8a6f40",
    "#3d5a80",
    "#588157",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Seed beta portfolio funds from Yahoo into Rose, push a manifest map, and create a notebook."
    )
    parser.add_argument("--username", required=True, help="Rose username.")
    parser.add_argument("--password", required=True, help="Rose password.")
    parser.add_argument("--map-code", default=DEFAULT_MAP_CODE, help="Rosecode for the metadata map.")
    parser.add_argument("--notebook-code", default=DEFAULT_NOTEBOOK_CODE, help="Rosecode for the notebook.")
    parser.add_argument("--output", default=str(OUTPUT_MANIFEST_PATH), help="Local JSON output path.")
    return parser.parse_args()


def rosecode_token(text: str) -> str:
    normalized = text.lower()
    normalized = normalized.replace("&", " and ")
    normalized = normalized.replace("+", " plus ")
    normalized = normalized.replace("/", " ")
    normalized = re.sub(r"[\(\)\[\],']", " ", normalized)
    normalized = re.sub(r"[^a-z0-9]+", ".", normalized)
    normalized = re.sub(r"\.+", ".", normalized).strip(".")
    return normalized


def portfolio_rosecode(fund_name: str, ticker: str) -> str:
    return f"gpt.beta.portfolio.{rosecode_token(fund_name)}.{rosecode_token(ticker)}.total.return.yahoo"


def normalize_timeseries(values: object) -> dict[str, float]:
    if not isinstance(values, dict):
        return {}
    if "columns" in values:
        columns = list(values.get("columns", []))
        rows = list(values.get("data", []))
        if "date" not in columns:
            return {}
        date_index = columns.index("date")
        value_indices = [index for index, column in enumerate(columns) if column != "date"]
        if not value_indices:
            return {}
        value_index = value_indices[0]
        return {
            str(row[date_index]): float(row[value_index])
            for row in rows
            if row[date_index] is not None and row[value_index] is not None
        }
    return {
        str(point_date): float(value)
        for point_date, value in values.items()
        if value is not None
    }


def timeseries_stats(values: dict[str, float]) -> dict[str, object]:
    if not values:
        return {
            "observations": 0,
            "start_date": None,
            "end_date": None,
        }
    dates = sorted(values)
    return {
        "observations": len(dates),
        "start_date": dates[0][:10],
        "end_date": dates[-1][:10],
    }


def markdown_cell(text: str) -> list[object]:
    return ["markdown", str(uuid.uuid4()), "[]", "{}", text, "false"]


def code_cell(rosecode: str) -> list[object]:
    return [
        "code",
        str(uuid.uuid4()),
        json.dumps([{rosecode: [{}]}]),
        "{}",
        rosecode,
        "true",
    ]


def chart_cell(returns_codes: list[str], names: list[str], title: str) -> list[object]:
    datasets = {
        rosecode: {
            "name": name,
            "color": CHART_COLORS[index % len(CHART_COLORS)],
        }
        for index, (rosecode, name) in enumerate(zip(returns_codes, names))
    }
    settings = json.dumps([{rosecode: [{}]} for rosecode in returns_codes])
    module_settings = json.dumps(
        {
            "width": "100%",
            "charts": {
                "beta-portfolio-daily-returns": {
                    "title": {"text": title, "align": "center", "vertical_align": "top"},
                    "x_axis": {"min": None, "max": None},
                    "y_axis": [],
                    "source": "Yahoo via Rose (:returns)",
                    "datasets": datasets,
                    "watermark": True,
                    "poweredBy": True,
                }
            },
        }
    )
    return [
        "code",
        str(uuid.uuid4()),
        settings,
        module_settings,
        ", ".join(returns_codes),
        "true",
    ]


def build_notebook_cells(map_code: str, returns_codes: list[str], names: list[str]) -> list[list[object]]:
    return [
        markdown_cell("# Beta Portfolio Return Series\n\nThis notebook stages the Yahoo-seeded Rose objects for the beta portfolio fund set."),
        code_cell(map_code),
        markdown_cell("## Daily return chart\n\nThe chart below uses `:returns` on the Yahoo-seeded base series so the plotted lines are the daily returns series, not price or NAV levels."),
        chart_cell(returns_codes, names, "Beta Portfolio Daily Returns"),
    ]


def main() -> None:
    args = parse_args()
    client = RoseClient(username=args.username, password=args.password)

    rows: list[dict[str, object]] = []
    successful_rows: list[dict[str, object]] = []
    failures: list[dict[str, object]] = []

    for index, spec in enumerate(PORTFOLIOS, start=1):
        rosecode = portfolio_rosecode(spec["fund"], spec["ticker"])
        returns_code = f"{rosecode}:returns"
        row: dict[str, object] = {
            "order": index,
            "ticker": spec["ticker"],
            "ticker_slug": rosecode_token(spec["ticker"]),
            "fund_name": spec["fund"],
            "fund_slug": rosecode_token(spec["fund"]),
            "series_code": rosecode,
            "returns_code": returns_code,
            "type": spec["type"],
            "age": spec["age"],
            "aum_bn": spec["aum_bn"],
            "fee": spec["fee"],
        }
        try:
            push_result = client.push_yahoo(rosecode, spec["ticker"])
            base_payload = client.pull_object(rosecode, timeout=120)
            returns_payload = client.pull_object(returns_code, timeout=120)
            base_series = normalize_timeseries(base_payload.get("values", {}))
            returns_series = normalize_timeseries(returns_payload.get("values", {}))
            base_stats = timeseries_stats(base_series)
            returns_stats = timeseries_stats(returns_series)
            row.update(
                {
                    "status": "ok",
                    "push_result_type": push_result.get("type"),
                    "updated_at": push_result.get("updated_at"),
                    "base_observations": base_stats["observations"],
                    "base_start_date": base_stats["start_date"],
                    "base_end_date": base_stats["end_date"],
                    "returns_observations": returns_stats["observations"],
                    "returns_start_date": returns_stats["start_date"],
                    "returns_end_date": returns_stats["end_date"],
                }
            )
            successful_rows.append(row)
        except Exception as exc:
            row.update({"status": "error", "error": str(exc)})
            failures.append({"ticker": spec["ticker"], "fund_name": spec["fund"], "error": str(exc)})
        rows.append(row)

    client.push_rows_map(
        args.map_code,
        rows,
        metas={
            "title": "Beta portfolio fund universe from Yahoo via Rose",
            "owner": args.username,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "row_count": len(rows),
            "success_count": len(successful_rows),
            "failure_count": len(failures),
        },
    )

    notebook_result = None
    if successful_rows:
        notebook_result = client.push_notebook(
            args.notebook_code,
            build_notebook_cells(
                map_code=args.map_code,
                returns_codes=[row["returns_code"] for row in successful_rows],
                names=[str(row["ticker"]) for row in successful_rows],
            ),
            metas={
                "title": "Beta Portfolio Daily Returns",
                "description": "Map plus daily return chart for Yahoo-seeded beta portfolio funds.",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
        )

    manifest = {
        "map_code": args.map_code,
        "notebook_code": args.notebook_code,
        "notebook_url": f"https://rose.ai/dashboard/{args.notebook_code}",
        "success_count": len(successful_rows),
        "failure_count": len(failures),
        "rows": rows,
        "failures": failures,
        "map_result": {"rosecode": args.map_code, "status": "pushed"},
        "notebook_result": notebook_result,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

    output_path = Path(args.output)
    output_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
