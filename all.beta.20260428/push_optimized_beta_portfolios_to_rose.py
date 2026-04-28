from __future__ import annotations

import argparse
import json
from pathlib import Path

from beta_portfolio_section import OPTIMIZED_MANIFEST_FILENAME, push_optimized_beta_portfolios


PROJECT_DIR = Path(__file__).resolve().parent
ANALYSIS_JSON_PATH = PROJECT_DIR / "analysis.json"
OUTPUT_MANIFEST_PATH = PROJECT_DIR / OPTIMIZED_MANIFEST_FILENAME


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Push the optimized benchmark beta portfolios into Rose as a map, logic objects, and a notebook."
    )
    parser.add_argument("--username", required=True, help="Rose username.")
    parser.add_argument("--password", required=True, help="Rose password.")
    parser.add_argument("--rose-url", default="https://rose.ai", help="Rose base URL.")
    parser.add_argument("--analysis", default=str(ANALYSIS_JSON_PATH), help="Path to analysis.json.")
    parser.add_argument("--output", default=str(OUTPUT_MANIFEST_PATH), help="Local manifest output path.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    analysis_payload = json.loads(Path(args.analysis).read_text(encoding="utf-8"))
    beta_analysis = analysis_payload.get("beta")
    if not beta_analysis or beta_analysis.get("mode") == "unavailable":
        raise RuntimeError("Beta analysis is missing or unavailable in analysis.json")

    manifest = push_optimized_beta_portfolios(
        analysis=beta_analysis,
        rose_url=args.rose_url,
        username=args.username,
        password=args.password,
        output_path=Path(args.output),
    )
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
