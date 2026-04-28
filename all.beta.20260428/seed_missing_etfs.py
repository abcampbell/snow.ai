"""Seed ETFs that are needed for the four-portfolio backtest but not yet in Rose."""
from __future__ import annotations

import os
import time
from pathlib import Path

import pandas as pd
import requests
import yfinance as yf

ROSE_URL = "https://rose.ai"
ADMIN_USER = os.environ.get("ROSE_ADMIN_USER", "acampbell")
ADMIN_PASS = os.environ.get("ROSE_ADMIN_PASS", "bananaman")

MISSING = [
    ("IEF", "iShares 7-10Y Treasury"),
    ("BIL", "SPDR 1-3M T-Bill"),
    ("RPAR", "Advanced Research Risk Parity"),
    ("NTSX", "WisdomTree US Efficient Core 90/60"),
    ("AQMIX", "AQR Managed Futures Strategy"),
    ("ALLW", "Bridgewater All Weather ETF"),
    ("RSSB", "Return Stacked Global Stocks & Bonds"),
]


def yahoo_history(ticker: str) -> pd.Series:
    ticker_obj = yf.Ticker(ticker)
    df = ticker_obj.history(period="max", auto_adjust=True, actions=False)
    if df.empty:
        raise RuntimeError(f"empty history for {ticker}")
    closes = df["Close"].dropna()
    closes.index = pd.to_datetime(closes.index).tz_localize(None)
    return closes.sort_index()


def daily_returns(prices: pd.Series) -> pd.Series:
    rets = prices.pct_change().dropna()
    return rets


def push_to_rose(session: requests.Session, rosecode: str, series: pd.Series, title: str, unit: str) -> None:
    values = {ts.strftime("%Y-%m-%d"): float(v) for ts, v in series.items()}
    payload = {
        "code": rosecode,
        "type": "timeseries",
        "metas": {
            "title": title,
            "source": "yahoo",
            "unit": unit,
            "push_tag": "all_beta_four_portfolios",
        },
        "values": values,
    }
    resp = session.post(f"{ROSE_URL}/data", json=payload, headers={"Snow-Overwrite": "1"}, timeout=120)
    resp.raise_for_status()


def main() -> None:
    s = requests.Session()
    s.post(f"{ROSE_URL}/users/auth", json={"username": ADMIN_USER, "password": ADMIN_PASS}).raise_for_status()

    for ticker, name in MISSING:
        print(f"[{ticker}] pulling yahoo...")
        prices = yahoo_history(ticker)
        rets = daily_returns(prices)
        print(f"[{ticker}] {prices.index.min().date()} -> {prices.index.max().date()}  ({len(prices)} prices, {len(rets)} returns)")

        price_code = f"gpt.beta.benchmark.{ticker.lower()}.{ticker.lower()}.total.return.yahoo"

        push_to_rose(s, price_code, prices, f"{ticker} {name} total return (adj close)", "price")
        print(f"[{ticker}] pushed {price_code} ({len(prices)} obs); :returns auto-computes")
        time.sleep(0.3)


if __name__ == "__main__":
    main()
