"""Four-portfolio comparison: Bridgewater-synthetic vs Campbell All Beta
(unlevered, futures-levered, RSSB-style leverage-constrained) plus Campbell's
actual 14-ticker macro book.

All data is pulled from Rose (`gpt.beta.benchmark.{ticker}.{ticker}.total.return.yahoo:returns`).
Quarterly rebalance on first trading day of Jan/Apr/Jul/Oct.
Walk-forward vol estimates: uses only data available as of each rebalance date.
"""
from __future__ import annotations

import math
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import numpy as np
import pandas as pd
import requests

ROSE_URL = "https://rose.ai"
BOT_USER = os.environ.get("ROSE_BOT_USER", "chatgpt")
BOT_PASS = os.environ.get("ROSE_BOT_PASS", "botsbots")

PROJECT_DIR = Path(__file__).parent
TABLES_DIR = PROJECT_DIR / "tables"
CHARTS_DIR = PROJECT_DIR / "charts"


# All sleeves we may need, keyed by ETF ticker.
# All are stored in Rose under gpt.beta.benchmark.{t}.{t}.total.return.yahoo
SLEEVE_TICKERS = [
    "SPY", "EFA", "EEM", "TLT", "IEF", "TIP", "LQD", "HYG", "EMB",
    "DBC", "GLD", "VNQ", "CEW", "XLK", "XLE",
    "BIL",
    "ALLW", "RPAR", "NTSX", "RSSB", "AQMIX",
]

# Campbell's current macro book (from the big-prompt spec).
# These are the 14 tickers and their target dollar weights.
CAMPBELL_WEIGHTS: dict[str, float] = {
    "SPY": 0.15,
    "XLK": 0.02,
    "XLE": 0.02,
    "EFA": 0.02,
    "EEM": 0.05,
    "TLT": 0.25,
    "TIP": 0.15,
    "LQD": 0.00,
    "HYG": 0.05,
    "EMB": 0.02,
    "DBC": 0.10,
    "GLD": 0.10,
    "VNQ": 0.05,
    "CEW": 0.02,
}


def rose_session() -> requests.Session:
    s = requests.Session()
    s.post(f"{ROSE_URL}/users/auth", json={"username": BOT_USER, "password": BOT_PASS}, timeout=20).raise_for_status()
    return s


def pull_returns(session: requests.Session, ticker: str) -> pd.Series:
    code = f"gpt.beta.benchmark.{ticker.lower()}.{ticker.lower()}.total.return.yahoo:returns"
    resp = session.get(f"{ROSE_URL}/objects", params={"rosecode": code, "exact_match": 1}, timeout=60)
    resp.raise_for_status()
    j = resp.json()
    v = j.get("values") or {}
    if isinstance(v, dict) and "columns" not in v:
        s = pd.Series(v, name=ticker, dtype="float64")
        s.index = pd.to_datetime(s.index).tz_localize(None)
        return s.sort_index()
    if isinstance(v, dict) and "columns" in v:
        cols = v["columns"]
        rows = v.get("data", [])
        df = pd.DataFrame(rows, columns=cols)
        df["date"] = pd.to_datetime(df["date"]).dt.tz_localize(None) if pd.api.types.is_datetime64_any_dtype(pd.to_datetime(df["date"])) else pd.to_datetime(df["date"])
        col = [c for c in cols if c != "date"][0]
        s = pd.Series(df[col].astype(float).values, index=df["date"], name=ticker)
        return s.sort_index()
    raise RuntimeError(f"bad shape for {ticker}: {type(v)}")


def load_all_returns(session: requests.Session, tickers: list[str]) -> pd.DataFrame:
    parts = []
    for t in tickers:
        try:
            s = pull_returns(session, t)
            # Returns can contain the seed 0 on first trading day; drop any rows where pct_change was nan
            parts.append(s.rename(t))
        except Exception as e:
            print(f"[warn] {t}: {e}")
    frame = pd.concat(parts, axis=1).sort_index()
    # Synthetic RSSB pre-inception: 100% SPY + 100% IEF - (BIL + 10bps/yr) financing.
    # This extends RSSB back to the SPY/IEF overlap (2002+).
    if "RSSB" in frame.columns and "SPY" in frame.columns and "IEF" in frame.columns:
        spy = frame["SPY"]
        ief = frame["IEF"]
        bil = frame["BIL"] if "BIL" in frame.columns else pd.Series(0.0, index=frame.index)
        financing_daily = bil + (10e-4 / 252.0)
        synthetic_rssb = spy + ief - financing_daily
        # Splice: keep real RSSB where available, fill back with synthetic
        real_start = frame["RSSB"].first_valid_index()
        if real_start is not None:
            spliced = synthetic_rssb.copy()
            spliced.loc[real_start:] = frame["RSSB"].loc[real_start:]
            frame["RSSB"] = spliced
        else:
            frame["RSSB"] = synthetic_rssb
    # Synthetic NTSX pre-inception: 90% SPY + 60% IEF - 0.5x financing.
    if "NTSX" in frame.columns and "SPY" in frame.columns and "IEF" in frame.columns:
        spy = frame["SPY"]
        ief = frame["IEF"]
        bil = frame["BIL"] if "BIL" in frame.columns else pd.Series(0.0, index=frame.index)
        financing_daily = bil + (10e-4 / 252.0)
        synthetic_ntsx = 0.9 * spy + 0.6 * ief - 0.5 * financing_daily
        real_start = frame["NTSX"].first_valid_index()
        if real_start is not None:
            spliced = synthetic_ntsx.copy()
            spliced.loc[real_start:] = frame["NTSX"].loc[real_start:]
            frame["NTSX"] = spliced
        else:
            frame["NTSX"] = synthetic_ntsx
    return frame


def quarter_starts(index: pd.DatetimeIndex, start: pd.Timestamp) -> pd.DatetimeIndex:
    """First trading day in each quarter at or after start."""
    bounds = pd.date_range(start=start, end=index.max() + pd.Timedelta(days=1), freq="QS")
    rebal = []
    for q in bounds:
        candidates = index[index >= q]
        if len(candidates):
            rebal.append(candidates[0])
    return pd.DatetimeIndex(rebal)


# --------------------------------------------------------------------------- #
# Portfolio constructions — each returns a monthly-rebalanced daily weight DF
# --------------------------------------------------------------------------- #

@dataclass
class Portfolio:
    name: str
    tickers: list[str]
    # weight_fn(history_returns_df_up_to_rebal) -> dict[ticker, weight]
    weight_fn: Callable[[pd.DataFrame, pd.Timestamp], dict[str, float]]
    # scalar leverage applied to weights post-construction (1.0 = unlevered)
    target_vol: float | None = None
    financing_ticker: str = "BIL"
    expense_ratio_annual: float = 0.0  # in decimal, applied daily

    def describe(self) -> str:
        return f"{self.name} ({len(self.tickers)} sleeves, target_vol={self.target_vol})"


# ----- Helper: rolling annualized vol estimate as of date ------------------- #

def ann_vol(series: pd.Series, window_days: int = 252) -> float:
    tail = series.dropna().iloc[-window_days:]
    if len(tail) < 30:
        return float("nan")
    # log returns for vol
    log_r = np.log1p(tail)
    return float(log_r.std(ddof=0) * math.sqrt(252))


def ann_cov(returns: pd.DataFrame, window_days: int = 756) -> pd.DataFrame:
    tail = returns.dropna(how="all").iloc[-window_days:]
    tail = tail.dropna(axis=1, how="any")
    log_r = np.log1p(tail)
    cov = log_r.cov() * 252.0
    return cov


# ----- Portfolio 1: Bridgewater-synthetic All Weather ---------------------- #

AW_ENVIRONMENTS = {
    "rising_growth":     ["SPY", "EEM"],
    "falling_growth":    ["TLT", "IEF"],
    "rising_inflation":  ["DBC", "GLD", "TIP"],
    "falling_inflation": ["TLT", "LQD"],
}


def _inverse_vol_weights(vol_map: dict[str, float]) -> dict[str, float]:
    inv = {k: (1.0 / v) for k, v in vol_map.items() if v > 0 and not math.isnan(v)}
    total = sum(inv.values())
    if total <= 0:
        return {k: 1.0 / max(len(vol_map), 1) for k in vol_map}
    return {k: v / total for k, v in inv.items()}


def _aw_weights(history: pd.DataFrame, _asof: pd.Timestamp) -> dict[str, float]:
    """Equal risk across the 4 environments, inverse-vol within each.
    Then scale so unlevered portfolio vol targets 7%."""
    env_weights: dict[str, float] = {}
    env_vols = []
    for env, tickers in AW_ENVIRONMENTS.items():
        avail = [t for t in tickers if t in history.columns and history[t].dropna().shape[0] > 252]
        if not avail:
            continue
        sleeve_vols = {t: ann_vol(history[t], window_days=756) for t in avail}
        inv = _inverse_vol_weights(sleeve_vols)
        # env receives 25% of total risk = 0.25 risk budget, which we allocate as capital
        # using a target 7% vol contribution per env
        env_cov = ann_cov(history[avail], window_days=756)
        if env_cov.empty:
            continue
        cov_tickers = list(env_cov.columns)
        inv_vec = {t: inv[t] for t in cov_tickers if t in inv}
        if not inv_vec:
            continue
        # renormalize inv within cov_tickers
        total = sum(inv_vec.values())
        inv_vec = {t: v / total for t, v in inv_vec.items()}
        avail = cov_tickers
        w = np.array([inv_vec[t] for t in avail])
        env_var = float(w @ env_cov.loc[avail, avail].values @ w)
        env_vol = math.sqrt(max(env_var, 1e-12))
        env_vols.append(env_vol)
        env_weights[env] = (avail, w, env_vol)

    if not env_weights:
        return {}

    # Per env target: 7%/4 per environment contribution? Approximate by scaling each env to same vol
    # then summing. Equivalent to equal-risk across environments.
    target_env_vol = 0.07 / math.sqrt(4)
    final_weights: dict[str, float] = {}
    for env, (avail, w, env_vol) in env_weights.items():
        scale = target_env_vol / max(env_vol, 1e-6)
        scaled = w * scale
        # cap env scale so one env can't dominate
        scaled = np.clip(scaled, 0.0, 1.0)
        for t, wt in zip(avail, scaled):
            final_weights[t] = final_weights.get(t, 0.0) + float(wt)
    return final_weights


# ----- Portfolio 2: All Beta unlevered (1/vol) ----------------------------- #

ALL_BETA_TICKERS = ["SPY", "EFA", "EEM", "TLT", "TIP", "HYG", "EMB", "DBC", "GLD", "VNQ"]


def _all_beta_unlev_weights(history: pd.DataFrame, _asof: pd.Timestamp) -> dict[str, float]:
    avail = [t for t in ALL_BETA_TICKERS if t in history.columns and history[t].dropna().shape[0] > 252]
    if not avail:
        return {}
    vols = {t: ann_vol(history[t], 252) for t in avail}
    vols = {k: v for k, v in vols.items() if not math.isnan(v) and v > 0}
    if not vols:
        return {}
    # inverse-vol normalized to sum=1.0 (unlevered, 100% gross)
    return _inverse_vol_weights(vols)


# ----- Portfolio 3: All Beta levered to 15% vol --------------------------- #
# We return *nominal* weights > 100%. Apply financing cost separately in the
# backtest engine based on excess-over-100% notional.

def _all_beta_lev_15_weights(history: pd.DataFrame, asof: pd.Timestamp) -> dict[str, float]:
    base = _all_beta_unlev_weights(history, asof)
    if not base:
        return {}
    # estimate base portfolio vol using 3yr cov
    tickers = list(base.keys())
    cov = ann_cov(history[tickers], window_days=756)
    tickers_cov = [t for t in tickers if t in cov.columns]
    w = np.array([base[t] for t in tickers_cov])
    cov_m = cov.loc[tickers_cov, tickers_cov].values
    base_var = float(w @ cov_m @ w)
    base_vol = math.sqrt(max(base_var, 1e-12))
    target_vol = 0.15
    lev = target_vol / max(base_vol, 1e-6)
    lev = float(np.clip(lev, 1.0, 3.0))
    return {t: base[t] * lev for t in tickers_cov}


# ----- Portfolio 4: Leverage-constrained All Weather (RSSB-style) --------- #
# Use RSSB to replace SPY+TLT combined allocation in the Campbell All Beta book.
# Pre-inception (before 2023-08 for RSSB), build synthetic 100% SPY + 100% IEF
# funded by BIL + 10bps financing.

RSSB_SYNTH_START_AFTER = pd.Timestamp("2023-08-14")  # RSSB actual inception


def _lev_constrained_weights(history: pd.DataFrame, asof: pd.Timestamp) -> dict[str, float]:
    # start with All Beta unlev
    base = _all_beta_unlev_weights(history, asof)
    if not base:
        return {}
    # Collapse SPY + TLT into RSSB. RSSB holds 100% stocks + 100% bonds in one wrapper.
    spy_w = base.pop("SPY", 0.0)
    # Prefer TLT if present, else IEF (RSSB uses intermediate; we already represent long via TLT)
    tlt_w = base.pop("TLT", 0.0)
    rssb_share = max(spy_w, tlt_w)  # since RSSB gives 1x stocks + 1x bonds per dollar,
                                    # allocate to the larger leg and keep the remainder as the
                                    # smaller leg in the raw asset for hedging
    base["RSSB"] = rssb_share
    # Re-add the unrepresented portion of the smaller leg
    remainder = abs(spy_w - tlt_w)
    if spy_w > tlt_w:
        base["SPY"] = remainder
    elif tlt_w > spy_w:
        base["TLT"] = remainder
    # Normalize to gross ~= 1.5x (RSSB double-counting brings effective gross above 1x naturally)
    total = sum(base.values())
    if total > 0:
        scale = 1.0 / total  # then RSSB's internal 2x lifts effective gross
        base = {k: v * scale for k, v in base.items()}
    return base


# ----- Campbell's book -- fixed weights, no rebalancing of the weights ---- #

def _campbell_weights(history: pd.DataFrame, _asof: pd.Timestamp) -> dict[str, float]:
    avail = {t: w for t, w in CAMPBELL_WEIGHTS.items() if t in history.columns and history[t].dropna().shape[0] > 30}
    return avail


# --------------------------------------------------------------------------- #
# Backtest engine
# --------------------------------------------------------------------------- #

def backtest(
    returns: pd.DataFrame,
    portfolio: Portfolio,
    start_date: str | pd.Timestamp = "2006-01-01",
    transaction_cost_bps: float = 5.0,
) -> dict:
    """Quarterly-rebalanced walk-forward backtest.

    For levered portfolios (gross > 1.0), apply financing cost on the excess
    gross notional using the BIL daily return + 10bps/yr spread.
    """
    r = returns.copy()
    r.index = pd.to_datetime(r.index)
    r = r.sort_index()
    start = pd.Timestamp(start_date)
    r = r.loc[r.index >= start]
    dates = r.index

    bil = r["BIL"] if "BIL" in r.columns else pd.Series(0.0, index=dates)

    rebal_dates = quarter_starts(dates, start)

    # Build weight schedule (forward-filled daily)
    weight_rows = []
    current: dict[str, float] = {}
    prev_weights: dict[str, float] = {}
    turnover_series: list[tuple[pd.Timestamp, float]] = []
    for rd in rebal_dates:
        hist = r.loc[:rd].iloc[:-1]  # strictly before rd to avoid peek
        if hist.empty:
            continue
        new_w = portfolio.weight_fn(hist, rd)
        if not new_w:
            continue
        # record turnover
        keys = set(new_w) | set(prev_weights)
        turn = sum(abs(new_w.get(k, 0.0) - prev_weights.get(k, 0.0)) for k in keys)
        turnover_series.append((rd, turn))
        current = new_w
        prev_weights = new_w
        weight_rows.append((rd, new_w))

    if not weight_rows:
        return {"name": portfolio.name, "error": "no rebalance events"}

    # Forward-fill weights to daily grid
    weights_df = pd.DataFrame(index=dates, columns=sorted({t for _, w in weight_rows for t in w}), dtype=float)
    for rd, w in weight_rows:
        for t, v in w.items():
            weights_df.loc[rd, t] = v
    weights_df = weights_df.ffill().fillna(0.0)

    # Gross exposure per day (sum of |weights|)
    gross = weights_df.abs().sum(axis=1)

    # Sleeve returns × weights → portfolio gross return
    available_tickers = [t for t in weights_df.columns if t in r.columns]
    weights_df = weights_df[available_tickers]
    sleeve_rets = r[available_tickers].fillna(0.0)
    port_gross = (weights_df.shift(1).fillna(0.0) * sleeve_rets).sum(axis=1)

    # Financing cost: on gross > 1.0, pay BIL + 10bps/yr
    excess_gross = (gross - 1.0).clip(lower=0.0)
    financing_daily = (bil + 10e-4 / 252.0).reindex(dates).fillna(0.0)
    financing_cost = excess_gross.shift(1).fillna(0.0) * financing_daily

    # Transaction cost on rebalance days: tc_bps * turnover (one-sided; bps is round-trip already → halve)
    tc_series = pd.Series(0.0, index=dates)
    for rd, turn in turnover_series:
        if rd in tc_series.index:
            tc_series.loc[rd] = turn * (transaction_cost_bps / 10000.0)

    # Expense ratio drag daily
    er_daily = portfolio.expense_ratio_annual / 252.0

    port_net = port_gross - financing_cost - tc_series - er_daily

    result = {
        "name": portfolio.name,
        "dates": dates,
        "gross_returns": port_gross,
        "net_returns": port_net,
        "weights_daily": weights_df,
        "gross_exposure": gross,
        "turnover_series": pd.Series({d: t for d, t in turnover_series}),
        "financing_cost_daily": financing_cost,
        "transaction_cost_daily": tc_series,
        "expense_ratio_annual": portfolio.expense_ratio_annual,
        "start_date": dates.min(),
        "end_date": dates.max(),
    }
    return result


# --------------------------------------------------------------------------- #
# Analytics
# --------------------------------------------------------------------------- #

TRADING_DAYS = 252


def summary_stats(returns: pd.Series, riskfree_daily: pd.Series | None = None) -> dict:
    r = returns.dropna()
    if r.empty:
        return {}
    nav = (1.0 + r).cumprod()
    years = (r.index[-1] - r.index[0]).days / 365.25
    cagr = nav.iloc[-1] ** (1 / max(years, 1e-6)) - 1 if nav.iloc[-1] > 0 else float("nan")
    vol = float(r.std(ddof=0) * math.sqrt(TRADING_DAYS))
    rf_ann = 0.0
    if riskfree_daily is not None:
        rf_ann = float(riskfree_daily.reindex(r.index).fillna(0.0).mean() * TRADING_DAYS)
    sharpe = (cagr - rf_ann) / vol if vol > 0 else float("nan")
    downside = r[r < 0]
    dn_vol = float(downside.std(ddof=0) * math.sqrt(TRADING_DAYS)) if not downside.empty else float("nan")
    sortino = (cagr - rf_ann) / dn_vol if dn_vol > 0 else float("nan")
    drawdowns = nav / nav.cummax() - 1.0
    max_dd = float(drawdowns.min())
    calmar = cagr / abs(max_dd) if max_dd < 0 else float("nan")
    worst_month = float(r.resample("ME").apply(lambda x: (1 + x).prod() - 1).min())
    worst_quarter = float(r.resample("QE").apply(lambda x: (1 + x).prod() - 1).min())
    return {
        "cagr": float(cagr),
        "vol": vol,
        "sharpe": float(sharpe),
        "sortino": float(sortino),
        "max_drawdown": max_dd,
        "calmar": float(calmar) if not math.isnan(calmar) else None,
        "worst_month": worst_month,
        "worst_quarter": worst_quarter,
        "start": r.index.min().strftime("%Y-%m-%d"),
        "end": r.index.max().strftime("%Y-%m-%d"),
        "years": years,
    }


def leverage_capacity(sharpe: float, target_dd: float = 0.20, z: float = 2.0, rf: float = 0.02) -> float:
    """σ_max = (r_f + L) / (z - S) where L is per-year drawdown budget at target DD, z=2 for 95% fat-tail adj.

    Using r_f as risk-free, target_dd is the acceptable annual drawdown (20%).
    """
    if (z - sharpe) <= 0:
        return float("inf")
    return (rf + target_dd) / (z - sharpe)


# --------------------------------------------------------------------------- #
# Orchestration
# --------------------------------------------------------------------------- #

def build_portfolios() -> list[Portfolio]:
    return [
        Portfolio(
            name="AW-synthetic",
            tickers=list({t for env in AW_ENVIRONMENTS.values() for t in env}),
            weight_fn=_aw_weights,
            target_vol=0.07,
            expense_ratio_annual=0.0,
        ),
        Portfolio(
            name="All Beta (unlev)",
            tickers=ALL_BETA_TICKERS,
            weight_fn=_all_beta_unlev_weights,
            target_vol=None,
            expense_ratio_annual=0.0,
        ),
        Portfolio(
            name="All Beta (lev 15%)",
            tickers=ALL_BETA_TICKERS,
            weight_fn=_all_beta_lev_15_weights,
            target_vol=0.15,
            expense_ratio_annual=0.0,
        ),
        Portfolio(
            name="Lev-constrained (RSSB-style)",
            tickers=ALL_BETA_TICKERS + ["RSSB"],
            weight_fn=_lev_constrained_weights,
            target_vol=None,
            expense_ratio_annual=0.0040,  # RSSB 40bps
        ),
        Portfolio(
            name="Campbell's Book",
            tickers=list(CAMPBELL_WEIGHTS.keys()),
            weight_fn=_campbell_weights,
            target_vol=None,
            expense_ratio_annual=0.0,
        ),
    ]


def run() -> dict:
    s = rose_session()
    print("pulling returns from Rose...")
    returns = load_all_returns(s, SLEEVE_TICKERS)
    print(f"returns matrix: {returns.shape}, {returns.index.min().date()} to {returns.index.max().date()}")

    portfolios = build_portfolios()
    results: dict[str, dict] = {}
    for p in portfolios:
        print(f"  backtesting {p.name} ...")
        res = backtest(returns, p, start_date="2006-01-01")
        if "error" in res:
            print(f"    skip: {res['error']}")
            continue
        stats = summary_stats(res["net_returns"], riskfree_daily=returns.get("BIL"))
        res["stats"] = stats
        res["leverage_capacity_vol"] = leverage_capacity(stats.get("sharpe", 0.0))
        results[p.name] = res
        print(f"    sharpe={stats.get('sharpe'):.3f} cagr={stats.get('cagr'):.3%} vol={stats.get('vol'):.3%} dd={stats.get('max_drawdown'):.3%}")

    return {"returns": returns, "results": results, "portfolios": portfolios}


if __name__ == "__main__":
    run()
