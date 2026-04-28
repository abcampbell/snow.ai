"""Pull AI infrastructure basket constituents from Rose, fetch prices via yfinance,
compute % change since 2025-12-14, render a one-off web dashboard.
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import pandas as pd
import requests
import yfinance as yf

ROSE = "https://rose.ai"
BASKET_MAP = "ai.infrastructure.basket.20251214.snow.001.map"
BASE_DATE = "2025-12-14"


def rose_session() -> requests.Session:
    s = requests.Session()
    s.post(f"{ROSE}/users/auth", json={"username": "chatgpt", "password": "botsbots"})
    return s


def pull_basket(s: requests.Session) -> pd.DataFrame:
    r = s.get(f"{ROSE}/objects", params={"rosecode": BASKET_MAP, "exact_match": 1}, timeout=30)
    j = r.json()
    v = j["values"]
    df = pd.DataFrame(v["data"], columns=v["columns"])
    return df


# Map IB-style tickers to yfinance tickers (handle non-US listings)
YF_OVERRIDE = {
    "000660.KS": "000660.KS",
    "2308.TW (Delta)": "2308.TW",
    "SCHN.PA": "SU.PA",      # Schneider Electric Paris listing — IB symbol is SU.PA on PA
    "ALAB": "ALAB",
    "TSM": "TSM",            # ADR
}


def normalize_ticker(t: str) -> str:
    t = t.strip()
    if t in YF_OVERRIDE:
        return YF_OVERRIDE[t]
    return t


def main() -> None:
    s = rose_session()
    df = pull_basket(s)
    print(f"Pulled basket: {len(df)} rows, columns: {list(df.columns)}")

    # Walk rows in order. Each "primary" row has descriptions; secondary rows inherit
    # from the most recent primary (data is ordered: primary, secondary, primary, ...).
    rows = []
    seen = set()
    current_desc = {"hardware_node": "", "what_it_does": "", "rationale": ""}
    for _, r in df.iterrows():
        what = str(r.get("What It Does", "")).strip()
        hw = str(r.get("Hardware Node", "")).strip()
        rationale = str(r.get("Rationale", "")).strip()
        if what and what != "None":
            current_desc = {
                "hardware_node": hw if hw and hw != "None" else "",
                "what_it_does": what,
                "rationale": rationale if rationale and rationale != "None" else "",
            }
        # Pick the unique ticker for this row
        e1 = str(r.get("Equity 1", "")).strip()
        e2 = str(r.get("Equity 2", "")).strip()
        if e2 in ("None", "") or e2 == e1:
            ticker = e1
        else:
            ticker = e2 if e1 in ("None", "") else e1
        if not ticker or ticker.lower() == "none" or ticker in seen:
            continue
        seen.add(ticker)
        component = str(r.get("component", "")).strip()
        weight = r.get("stock.weight", "")
        rows.append({
            "ticker_raw": ticker,
            "ticker_yf": normalize_ticker(ticker),
            "theme": str(r.get("Layer", "")).strip() if r.get("Layer") and r.get("Layer") != "None" else component.replace(".", " ").title(),
            "hardware_node": current_desc["hardware_node"],
            "what_it_does": current_desc["what_it_does"],
            "rationale": current_desc["rationale"],
            "stock_weight": weight,
        })
    constituents = pd.DataFrame(rows)
    print(f"Unique tickers: {len(constituents)}")

    # Pull yfinance prices for each
    yf_tickers = constituents["ticker_yf"].unique().tolist()
    print(f"Pulling {len(yf_tickers)} tickers from yfinance...")
    data = yf.download(yf_tickers, start="2025-11-01", auto_adjust=True, progress=False)
    if isinstance(data.columns, pd.MultiIndex):
        prices = data["Close"]
    else:
        prices = data
    prices = prices.ffill()
    print(f"Price frame: {prices.shape}, range {prices.index.min().date()} to {prices.index.max().date()}")

    # Compute base & current prices
    base_dt = pd.Timestamp(BASE_DATE)
    # find first trading day on/after BASE_DATE
    base_idx = prices.index[prices.index >= base_dt][0] if any(prices.index >= base_dt) else prices.index[-1]
    cur_idx = prices.index[-1]

    # Pull company names from yfinance (skip if it fails)
    name_lookup = {}
    for t in yf_tickers:
        try:
            info = yf.Ticker(t).info
            n = info.get("longName") or info.get("shortName") or t
            name_lookup[t] = n
        except Exception:
            name_lookup[t] = t

    out_rows = []
    for _, r in constituents.iterrows():
        t = r["ticker_yf"]
        if t in prices.columns:
            base_px = prices.loc[base_idx, t]
            cur_px = prices.loc[cur_idx, t]
            if pd.notna(base_px) and pd.notna(cur_px) and base_px > 0:
                pct = (cur_px / base_px - 1.0) * 100
            else:
                base_px = cur_px = pct = float("nan")
        else:
            base_px = cur_px = pct = float("nan")
        # Weight string to float
        try:
            w = float(r["stock_weight"]) if r["stock_weight"] not in (None, "None", "nan", "") else None
        except (ValueError, TypeError):
            w = None
        out_rows.append({
            **r.to_dict(),
            "company_name": name_lookup.get(t, t),
            "base_px": float(base_px) if pd.notna(base_px) else None,
            "cur_px": float(cur_px) if pd.notna(cur_px) else None,
            "pct_change": float(pct) if pd.notna(pct) else None,
            "weight": w,
        })

    out = pd.DataFrame(out_rows)
    # weighted basket return
    if "weight" in out.columns:
        contrib = out.dropna(subset=["weight", "pct_change"])
        weighted_return = float((contrib["weight"] * contrib["pct_change"]).sum() / max(contrib["weight"].sum(), 1e-9))
        print(f"\nWeighted basket return since {BASE_DATE}: {weighted_return:+.2f}%")

    # save raw
    out_path = Path(__file__).parent / "ai_basket_returns.json"
    out_path.write_text(json.dumps({
        "base_date": BASE_DATE,
        "base_trading_date": str(base_idx.date()),
        "current_date": str(cur_idx.date()),
        "constituents": out.to_dict(orient="records"),
        "weighted_return_pct": weighted_return if "weighted_return" in dir() else None,
    }, default=str, indent=2))
    print(f"\nWrote {out_path}")
    print(out[["ticker_raw", "theme", "what_it_does", "cur_px", "pct_change", "weight"]].round(2).to_string(index=False))


if __name__ == "__main__":
    main()
