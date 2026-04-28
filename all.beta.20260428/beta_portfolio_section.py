from __future__ import annotations

import json
import math
import sys
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import requests
from scipy.optimize import minimize


BLACK_ROSE_SRC = Path(r"C:\Users\campbell\black_rose_os\src")
if str(BLACK_ROSE_SRC) not in sys.path:
    sys.path.insert(0, str(BLACK_ROSE_SRC))

from black_rose.rose.client import RoseClient


BETA_BENCHMARK_SPECS = [
    {"label": "SPY", "ticker": "SPY", "series_code": "gpt.beta.benchmark.spy.spy.total.return.yahoo", "returns_code": "gpt.beta.benchmark.spy.spy.total.return.yahoo:returns"},
    {"label": "EFA", "ticker": "EFA", "series_code": "gpt.beta.benchmark.efa.efa.total.return.yahoo", "returns_code": "gpt.beta.benchmark.efa.efa.total.return.yahoo:returns"},
    {"label": "TLT", "ticker": "TLT", "series_code": "gpt.beta.benchmark.tlt.tlt.total.return.yahoo", "returns_code": "gpt.beta.benchmark.tlt.tlt.total.return.yahoo:returns"},
    {"label": "TIP", "ticker": "TIP", "series_code": "gpt.beta.benchmark.tip.tip.total.return.yahoo", "returns_code": "gpt.beta.benchmark.tip.tip.total.return.yahoo:returns"},
    {"label": "LQD", "ticker": "LQD", "series_code": "gpt.beta.benchmark.lqd.lqd.total.return.yahoo", "returns_code": "gpt.beta.benchmark.lqd.lqd.total.return.yahoo:returns"},
    {"label": "HYG", "ticker": "HYG", "series_code": "gpt.beta.benchmark.hyg.hyg.total.return.yahoo", "returns_code": "gpt.beta.benchmark.hyg.hyg.total.return.yahoo:returns"},
    {"label": "EEM", "ticker": "EEM", "series_code": "gpt.beta.benchmark.eem.eem.total.return.yahoo", "returns_code": "gpt.beta.benchmark.eem.eem.total.return.yahoo:returns"},
    {"label": "EMB", "ticker": "EMB", "series_code": "gpt.beta.benchmark.emb.emb.total.return.yahoo", "returns_code": "gpt.beta.benchmark.emb.emb.total.return.yahoo:returns"},
    {"label": "DBC", "ticker": "DBC", "series_code": "gpt.beta.benchmark.dbc.dbc.total.return.yahoo", "returns_code": "gpt.beta.benchmark.dbc.dbc.total.return.yahoo:returns"},
    {"label": "GLD", "ticker": "GLD", "series_code": "gpt.beta.benchmark.gld.gld.total.return.yahoo", "returns_code": "gpt.beta.benchmark.gld.gld.total.return.yahoo:returns"},
    {"label": "VNQ", "ticker": "VNQ", "series_code": "gpt.beta.benchmark.vnq.vnq.total.return.yahoo", "returns_code": "gpt.beta.benchmark.vnq.vnq.total.return.yahoo:returns"},
    {"label": "CEW", "ticker": "CEW", "series_code": "gpt.beta.benchmark.cew.cew.total.return.yahoo", "returns_code": "gpt.beta.benchmark.cew.cew.total.return.yahoo:returns"},
    {"label": "XLK", "ticker": "XLK", "series_code": "gpt.beta.benchmark.xlk.xlk.total.return.yahoo", "returns_code": "gpt.beta.benchmark.xlk.xlk.total.return.yahoo:returns"},
    {"label": "XLE", "ticker": "XLE", "series_code": "gpt.beta.benchmark.xle.xle.total.return.yahoo", "returns_code": "gpt.beta.benchmark.xle.xle.total.return.yahoo:returns"},
]

FLAGSHIP_COMPARISON_TICKERS = ["ALLW", "RPAR", "UPAR", "NTSX", "RSSB", "REMIX"]

PORTFOLIO_SPECS = [
    {
        "label": "SPY baseline",
        "key": "spy_baseline",
        "weight_column": "weight_spy_baseline",
        "color": "#143642",
        "kind": "baseline",
    },
    {
        "label": "Constructed benchmark 1x",
        "key": "constructed_1x",
        "weight_column": "weight_constructed_1x",
        "color": "#2e6f95",
        "kind": "constructed",
    },
    {
        "label": "Constructed benchmark 2x",
        "key": "constructed_2x",
        "weight_column": "weight_constructed_2x",
        "color": "#5b8fb9",
        "kind": "constructed",
    },
    {
        "label": "Constructed benchmark 3x",
        "key": "constructed_3x",
        "weight_column": "weight_constructed_3x",
        "color": "#c97c1a",
        "kind": "constructed",
    },
    {
        "label": "Retirement-cap optimizer",
        "key": "retirement_cap",
        "weight_column": "weight_retirement_cap",
        "color": "#7b6d8d",
        "kind": "accessible",
    },
    {
        "label": "SPY + funds optimizer",
        "key": "spy_plus_funds",
        "weight_column": "weight_spy_plus_funds",
        "color": "#4d908e",
        "kind": "accessible",
    },
    {
        "label": "Funds-only optimizer",
        "key": "funds_only",
        "weight_column": "weight_funds_only",
        "color": "#a23e48",
        "kind": "accessible",
    },
]

OPTIMIZED_MAP_CODE = "gpt.beta.optimized.portfolios.20260419.map"
OPTIMIZED_NOTEBOOK_CODE = "gpt.beta.optimized.portfolios.20260419.notebook"
OPTIMIZED_MANIFEST_FILENAME = "rose_beta_optimized_portfolios_manifest.json"

CHART_COLORS = {
    "SPY baseline": "#143642",
    "Constructed benchmark 1x": "#2e6f95",
    "Constructed benchmark 2x": "#5b8fb9",
    "Constructed benchmark 3x": "#c97c1a",
    "Retirement-cap optimizer": "#7b6d8d",
    "SPY + funds optimizer": "#4d908e",
    "Funds-only optimizer": "#a23e48",
    "ALLW": "#6c7a89",
    "RPAR": "#588157",
    "UPAR": "#8a6f40",
    "NTSX": "#264653",
    "RSSB": "#7f5539",
    "REMIX": "#7b6d8d",
}


@dataclass(frozen=True)
class OptimizationResult:
    label: str
    weights: dict[str, float]
    gross_exposure: float
    diversification_ratio: float
    effective_bets: float
    annualized_return: float
    annualized_vol: float
    sharpe: float
    max_drawdown: float
    correlation_to_spy: float
    returns: pd.Series
    cumulative: pd.Series
    notes: str
    window_start: str
    window_end: str
    daily_observations: int


def rose_session(url: str, username: str, password: str) -> requests.Session:
    session = requests.Session()
    response = session.post(
        f"{url}/users/auth",
        json={"username": username, "password": password},
        timeout=20,
    )
    response.raise_for_status()
    return session


def normalize_timeseries(values: object) -> pd.Series:
    if not isinstance(values, dict):
        return pd.Series(dtype="float64")

    if "columns" in values:
        columns = list(values.get("columns", []))
        rows = list(values.get("data", []))
        if "date" not in columns:
            return pd.Series(dtype="float64")
        frame = pd.DataFrame(rows, columns=columns)
        value_columns = [column for column in frame.columns if column != "date"]
        if not value_columns:
            return pd.Series(dtype="float64")
        series = pd.Series(frame[value_columns[0]].astype("float64").values, index=pd.to_datetime(frame["date"]))
        return series.sort_index()

    series = pd.Series(values, dtype="float64")
    if series.empty:
        return series
    series.index = pd.to_datetime(series.index)
    return series.sort_index()


def pull_rose_timeseries(session: requests.Session, url: str, rosecode: str) -> pd.Series:
    response = session.get(
        f"{url}/objects",
        params={"rosecode": rosecode, "exact_match": 1},
        timeout=120,
    )
    response.raise_for_status()
    payload = response.json()
    series = normalize_timeseries(payload.get("values", {}))
    if series.empty:
        raise ValueError(f"No timeseries values returned for {rosecode}")
    return series


def pull_returns_with_fallback(session: requests.Session, url: str, *, returns_code: str, base_code: str) -> pd.Series:
    try:
        return pull_rose_timeseries(session, url, returns_code)
    except Exception:
        base = pull_rose_timeseries(session, url, base_code)
        return base.pct_change(fill_method=None).dropna()


def push_yahoo_series(session: requests.Session, url: str, rosecode: str, ticker: str) -> None:
    response = session.get(
        f"{url}/objects",
        params={"rosecode": f"yahoo:push({rosecode}, {ticker})", "exact_match": 1},
        timeout=120,
    )
    response.raise_for_status()


def load_beta_manifest_rows(manifest_path: Path) -> list[dict]:
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    return [row for row in payload.get("rows", []) if row.get("status") == "ok"]


def pairwise_corr(left: pd.Series, right: pd.Series) -> tuple[float, int]:
    frame = pd.concat([left, right], axis=1, join="inner").dropna()
    if len(frame) < 2:
        return float("nan"), int(len(frame))
    return float(frame.iloc[:, 0].corr(frame.iloc[:, 1])), int(len(frame))


def pairwise_covariance(left: pd.Series, right: pd.Series) -> tuple[float, int]:
    frame = pd.concat([left, right], axis=1, join="inner").dropna()
    if len(frame) < 2:
        return 0.0, int(len(frame))
    return float(frame.iloc[:, 0].cov(frame.iloc[:, 1], ddof=0)), int(len(frame))


def stabilize_covariance(covariance: pd.DataFrame, floor: float = 1e-10) -> pd.DataFrame:
    values = np.nan_to_num(covariance.values.astype(float), nan=0.0)
    values = 0.5 * (values + values.T)
    eigenvalues, eigenvectors = np.linalg.eigh(values)
    clipped = np.clip(eigenvalues, floor, None)
    stabilized = eigenvectors @ np.diag(clipped) @ eigenvectors.T
    stabilized = 0.5 * (stabilized + stabilized.T)
    stabilized += np.eye(stabilized.shape[0]) * floor
    return pd.DataFrame(stabilized, index=covariance.index, columns=covariance.columns)


def pairwise_covariance_matrix(series_map: dict[str, pd.Series], labels: list[str]) -> tuple[pd.DataFrame, pd.DataFrame]:
    covariance = pd.DataFrame(np.nan, index=labels, columns=labels, dtype=float)
    observations = pd.DataFrame(0, index=labels, columns=labels, dtype=int)

    for row_index, left_label in enumerate(labels):
        left_series = series_map[left_label]
        for col_index, right_label in enumerate(labels[row_index:], start=row_index):
            right_series = series_map[right_label]
            value, count = pairwise_covariance(left_series, right_series)
            covariance.loc[left_label, right_label] = value
            covariance.loc[right_label, left_label] = value
            observations.loc[left_label, right_label] = count
            observations.loc[right_label, left_label] = count

    for label in labels:
        if not math.isfinite(float(covariance.loc[label, label])) or float(covariance.loc[label, label]) <= 0:
            variance = float(series_map[label].dropna().var(ddof=0))
            covariance.loc[label, label] = max(variance, 1e-8)

    return stabilize_covariance(covariance), observations


def covariance_effective_bets(covariance: np.ndarray, weights: np.ndarray) -> float:
    total_var = float(weights @ covariance @ weights)
    if total_var <= 0:
        return 0.0
    component = weights * (covariance @ weights) / total_var
    squared_sum = float(np.sum(np.square(component)))
    if squared_sum <= 0:
        return 0.0
    return 1.0 / squared_sum


def diversification_ratio(weights: np.ndarray, covariance: np.ndarray) -> float:
    weights = np.asarray(weights, dtype=float)
    covariance = np.asarray(covariance, dtype=float)
    total_var = float(weights @ covariance @ weights)
    if total_var <= 0:
        return 0.0
    marginal_vols = np.sqrt(np.clip(np.diag(covariance), 0.0, None))
    numerator = float(weights @ marginal_vols)
    return numerator / math.sqrt(total_var)


def annualized_return(returns: pd.Series, trading_days: int = 252) -> float:
    if returns.empty:
        return 0.0
    cumulative = float((1.0 + returns).prod())
    years = len(returns) / trading_days
    if years <= 0 or cumulative <= 0:
        return 0.0
    return cumulative ** (1.0 / years) - 1.0


def max_drawdown(returns: pd.Series) -> float:
    if returns.empty:
        return 0.0
    wealth = (1.0 + returns).cumprod()
    peak = wealth.cummax()
    drawdown = wealth / peak - 1.0
    return float(drawdown.min())


def cumulative_index(returns: pd.Series, start_level: float = 100.0) -> pd.Series:
    return (1.0 + returns).cumprod() * start_level


def solve_budgeted_diversified(covariance: np.ndarray, labels: list[str], *, budget: float, upper_bound: float | None = None) -> np.ndarray:
    n_assets = len(labels)
    max_bound = budget if upper_bound is None else upper_bound

    def objective(weights: np.ndarray) -> float:
        return -diversification_ratio(weights, covariance)

    bounds = [(0.0, max_bound) for _ in range(n_assets)]
    constraints = [{"type": "eq", "fun": lambda weights: float(np.sum(weights) - budget)}]

    inverse_vol = 1.0 / np.sqrt(np.clip(np.diag(covariance), 1e-12, None))
    inverse_vol = inverse_vol / inverse_vol.sum() * budget
    equal_weight = np.repeat(budget / n_assets, n_assets)
    min_var = np.zeros(n_assets, dtype=float)
    min_var[int(np.argmin(np.diag(covariance)))] = budget
    spy_heavy = np.zeros(n_assets, dtype=float)
    if "SPY" in labels:
        spy_heavy[labels.index("SPY")] = budget
    else:
        spy_heavy[:] = equal_weight

    starting_points = [equal_weight, inverse_vol, min_var, spy_heavy]
    best_result = None

    for start in starting_points:
        result = minimize(objective, x0=start, method="SLSQP", bounds=bounds, constraints=constraints)
        if not result.success:
            continue
        if best_result is None or result.fun < best_result.fun:
            best_result = result

    if best_result is None:
        raise RuntimeError("Diversification optimizer failed.")
    return np.asarray(best_result.x, dtype=float)


def build_portfolio_returns(weights: np.ndarray, labels: list[str], returns_map: dict[str, pd.Series]) -> pd.Series:
    active_labels = [label for label, weight in zip(labels, weights) if abs(float(weight)) > 1e-10]
    if not active_labels:
        return pd.Series(dtype="float64")

    frame = pd.concat([returns_map[label].rename(label) for label in active_labels], axis=1, join="inner").dropna()
    if frame.empty:
        raise RuntimeError(f"No overlapping return history for active assets: {', '.join(active_labels)}")

    active_weights = pd.Series(
        [float(weights[labels.index(label)]) for label in active_labels],
        index=active_labels,
        dtype="float64",
    )
    return frame @ active_weights


def summarize_portfolio(
    label: str,
    weights: np.ndarray,
    labels: list[str],
    returns_map: dict[str, pd.Series],
    covariance: np.ndarray,
    spy_series: pd.Series,
    notes: str,
) -> OptimizationResult:
    weights_dict = {asset: float(weight) for asset, weight in zip(labels, weights)}
    portfolio_returns = build_portfolio_returns(weights, labels, returns_map)
    portfolio_cumulative = cumulative_index(portfolio_returns)
    ann_vol = float(portfolio_returns.std(ddof=0) * math.sqrt(252))
    ann_return = annualized_return(portfolio_returns)
    sharpe = ann_return / ann_vol if ann_vol > 1e-12 else 0.0
    aligned_spy = spy_series.reindex(portfolio_returns.index).dropna()
    aligned_portfolio = portfolio_returns.reindex(aligned_spy.index).dropna()
    spy_corr = float(aligned_portfolio.corr(aligned_spy)) if len(aligned_portfolio) >= 2 else float("nan")

    return OptimizationResult(
        label=label,
        weights=weights_dict,
        gross_exposure=float(np.sum(np.abs(weights))),
        diversification_ratio=float(diversification_ratio(weights, covariance)),
        effective_bets=float(covariance_effective_bets(covariance, weights)),
        annualized_return=ann_return,
        annualized_vol=ann_vol,
        sharpe=sharpe,
        max_drawdown=max_drawdown(portfolio_returns),
        correlation_to_spy=spy_corr,
        returns=portfolio_returns,
        cumulative=portfolio_cumulative,
        notes=notes,
        window_start=portfolio_returns.index.min().strftime("%Y-%m-%d"),
        window_end=portfolio_returns.index.max().strftime("%Y-%m-%d"),
        daily_observations=int(len(portfolio_returns)),
    )


def build_growth_chart(returns_map: dict[str, pd.Series], *, reference_label: str | None = None) -> dict:
    frame = pd.concat({label: series for label, series in returns_map.items()}, axis=1, join="inner").dropna()
    if frame.empty:
        raise RuntimeError("Unable to build growth chart because the aligned return frame is empty.")

    cumulative = (1.0 + frame).cumprod() * 100.0
    reference = frame[reference_label] if reference_label and reference_label in frame.columns else None
    stats: dict[str, dict[str, float | None]] = {}
    for label in frame.columns:
        series = frame[label]
        ann_vol = float(series.std(ddof=0) * math.sqrt(252))
        ann_return = annualized_return(series)
        stats[label] = {
            "annualized_return": ann_return,
            "annualized_vol": ann_vol,
            "sharpe": ann_return / ann_vol if ann_vol > 1e-12 else 0.0,
            "max_drawdown": max_drawdown(series),
            "correlation_to_reference": None if reference is None else float(series.corr(reference)),
        }

    return {
        "start_date": frame.index.min().strftime("%Y-%m-%d"),
        "end_date": frame.index.max().strftime("%Y-%m-%d"),
        "daily_observations": int(len(frame)),
        "dates": [point.strftime("%Y-%m-%d") for point in frame.index],
        "series": {label: cumulative[label].tolist() for label in frame.columns},
        "stats": stats,
    }


def markdown_cell(text: str) -> list[object]:
    return ["markdown", str(uuid.uuid4()), "[]", "{}", text, "false"]


def code_cell(rosecode: str) -> list[object]:
    return ["code", str(uuid.uuid4()), json.dumps([{rosecode: [{}]}]), "{}", rosecode, "true"]


def date_to_timestamp(date_str: str) -> int:
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    return int(dt.timestamp() * 1000)


def chart_cell(series_codes: list[str], names: list[str], title: str, *, start_date: str, end_date: str) -> list[object]:
    datasets = {
        code: {
            "name": name,
            "color": CHART_COLORS.get(name, "#6c7a89"),
        }
        for code, name in zip(series_codes, names)
    }
    settings = json.dumps([{code: [{}]} for code in series_codes])
    module_settings = json.dumps(
        {
            "width": "100%",
            "charts": {
                "optimized-beta-portfolios": {
                    "title": {"text": title, "align": "center", "vertical_align": "top"},
                    "x_axis": {"min": date_to_timestamp(start_date), "max": date_to_timestamp(end_date)},
                    "y_axis": [],
                    "source": "Rose logic plus optimized portfolio weight columns",
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
        ", ".join(series_codes),
        "true",
    ]


def compute_beta_portfolio_analysis(
    *,
    manifest_path: Path,
    rose_url: str,
    username: str,
    password: str,
) -> dict:
    manifest_rows = load_beta_manifest_rows(manifest_path)
    session = rose_session(rose_url, username, password)

    for spec in BETA_BENCHMARK_SPECS:
        push_yahoo_series(session, rose_url, spec["series_code"], spec["ticker"])

    benchmark_returns = {
        spec["label"]: pull_returns_with_fallback(
            session,
            rose_url,
            returns_code=spec["returns_code"],
            base_code=spec["series_code"],
        )
        for spec in BETA_BENCHMARK_SPECS
    }

    fund_returns = {
        str(row["ticker"]): pull_returns_with_fallback(
            session,
            rose_url,
            returns_code=str(row["returns_code"]),
            base_code=str(row["series_code"]),
        )
        for row in manifest_rows
    }

    benchmark_labels = [spec["label"] for spec in BETA_BENCHMARK_SPECS]
    fund_labels = [str(row["ticker"]) for row in manifest_rows]

    benchmark_frame = pd.concat(
        [benchmark_returns[label].rename(label) for label in benchmark_labels],
        axis=1,
        join="inner",
    ).dropna()
    benchmark_covariance = benchmark_frame.cov(ddof=0)

    baseline_weights = np.array([1.0 if label == "SPY" else 0.0 for label in benchmark_labels], dtype=float)
    constructed_1x_weights = solve_budgeted_diversified(benchmark_covariance.values, benchmark_labels, budget=1.0)
    constructed_2x_weights = solve_budgeted_diversified(benchmark_covariance.values, benchmark_labels, budget=2.0, upper_bound=2.0)
    constructed_3x_weights = solve_budgeted_diversified(benchmark_covariance.values, benchmark_labels, budget=3.0, upper_bound=3.0)
    retirement_cap_labels = [*benchmark_labels, *fund_labels]
    retirement_cap_returns = {**benchmark_returns, **fund_returns}
    retirement_cap_covariance, retirement_cap_observations = pairwise_covariance_matrix(retirement_cap_returns, retirement_cap_labels)
    retirement_cap_weights = solve_budgeted_diversified(retirement_cap_covariance.values, retirement_cap_labels, budget=1.0)

    spy_plus_funds_labels = ["SPY", *fund_labels]
    spy_plus_funds_returns = {"SPY": benchmark_returns["SPY"], **fund_returns}
    spy_plus_funds_covariance, spy_plus_funds_observations = pairwise_covariance_matrix(spy_plus_funds_returns, spy_plus_funds_labels)
    spy_plus_funds_weights = solve_budgeted_diversified(spy_plus_funds_covariance.values, spy_plus_funds_labels, budget=1.0)

    funds_only_covariance, funds_only_observations = pairwise_covariance_matrix(fund_returns, fund_labels)
    funds_only_weights = solve_budgeted_diversified(funds_only_covariance.values, fund_labels, budget=1.0)

    baseline = summarize_portfolio(
        "SPY baseline",
        baseline_weights,
        benchmark_labels,
        benchmark_returns,
        benchmark_covariance.values,
        benchmark_returns["SPY"],
        notes="100% SPY baseline over the common benchmark-sleeve window.",
    )
    constructed_1x = summarize_portfolio(
        "Constructed benchmark 1x",
        constructed_1x_weights,
        benchmark_labels,
        benchmark_returns,
        benchmark_covariance.values,
        benchmark_returns["SPY"],
        notes="Diversification-first sleeve mix across the broad beta sleeve set with weights constrained to sum to 1.0.",
    )
    constructed_2x = summarize_portfolio(
        "Constructed benchmark 2x",
        constructed_2x_weights,
        benchmark_labels,
        benchmark_returns,
        benchmark_covariance.values,
        benchmark_returns["SPY"],
        notes="Same diversification-ratio objective as 1x, but with a 2.0x gross budget. Because the objective is scale-invariant, the normalized mix only changes if extra constraints or expected-return views are added.",
    )
    constructed_3x = summarize_portfolio(
        "Constructed benchmark 3x",
        constructed_3x_weights,
        benchmark_labels,
        benchmark_returns,
        benchmark_covariance.values,
        benchmark_returns["SPY"],
        notes="Same diversification-first sleeve universe, but leverage is allowed and the optimizer is free to distribute the full 3.0x gross budget without pinning SPY at 100%. Under pure diversification-ratio optimization, this is the 1x mix scaled up unless extra views or constraints are introduced.",
    )
    retirement_cap = summarize_portfolio(
        "Retirement-cap optimizer",
        retirement_cap_weights,
        retirement_cap_labels,
        retirement_cap_returns,
        retirement_cap_covariance.values,
        benchmark_returns["SPY"],
        notes="Same diversification-ratio framework, but now the budget is capped at 100% across the combined sleeve-plus-fund universe. This is the practical retirement-account version when you cannot borrow externally but can own funds with embedded leverage.",
    )
    spy_plus_funds = summarize_portfolio(
        "SPY + funds optimizer",
        spy_plus_funds_weights,
        spy_plus_funds_labels,
        spy_plus_funds_returns,
        spy_plus_funds_covariance.values,
        benchmark_returns["SPY"],
        notes="Accessible alternative if the raw sleeves are unavailable and the investable universe is just SPY plus the listed beta funds.",
    )
    funds_only = summarize_portfolio(
        "Funds-only optimizer",
        funds_only_weights,
        fund_labels,
        fund_returns,
        funds_only_covariance.values,
        benchmark_returns["SPY"],
        notes="Accessible alternative if the investable universe is restricted to the beta funds only.",
    )

    portfolio_results = {
        result.label: result
        for result in [baseline, constructed_1x, constructed_2x, constructed_3x, retirement_cap, spy_plus_funds, funds_only]
    }

    correlation_matrix: dict[str, dict[str, float]] = {}
    observation_matrix: dict[str, dict[str, int]] = {}
    fund_cards: list[dict[str, object]] = []
    for row in manifest_rows:
        ticker = str(row["ticker"])
        corr_row: dict[str, float] = {}
        obs_row: dict[str, int] = {}
        for benchmark_label, benchmark_series in benchmark_returns.items():
            corr_value, obs_count = pairwise_corr(fund_returns[ticker], benchmark_series)
            corr_row[benchmark_label] = corr_value
            obs_row[benchmark_label] = obs_count
        stack_corr, stack_obs = pairwise_corr(fund_returns[ticker], constructed_3x.returns)
        correlation_matrix[ticker] = corr_row
        observation_matrix[ticker] = obs_row
        avg_abs = float(np.nanmean([abs(value) for value in corr_row.values()]))
        fund_cards.append(
            {
                "ticker": ticker,
                "fund_name": row["fund_name"],
                "returns_code": row["returns_code"],
                "series_code": row["series_code"],
                "average_absolute_benchmark_correlation": avg_abs,
                "spy_correlation": corr_row["SPY"],
                "tlt_correlation": corr_row["TLT"],
                "constructed_3x_correlation": stack_corr,
                "constructed_3x_observations": stack_obs,
                "is_flagship_comparison": ticker in FLAGSHIP_COMPARISON_TICKERS,
            }
        )

    most_spy_like = max(fund_cards, key=lambda row: row["spy_correlation"])
    least_spy_like = min(fund_cards, key=lambda row: row["spy_correlation"])
    most_distinct = min(fund_cards, key=lambda row: row["average_absolute_benchmark_correlation"])
    closest_to_constructed_3x = max(
        [row for row in fund_cards if math.isfinite(float(row["constructed_3x_correlation"]))],
        key=lambda row: row["constructed_3x_correlation"],
    )

    flagship_rows = [row for row in manifest_rows if str(row["ticker"]) in FLAGSHIP_COMPARISON_TICKERS]
    flagship_returns_map = {"Constructed benchmark 3x": constructed_3x.returns}
    for row in flagship_rows:
        flagship_returns_map[str(row["ticker"])] = fund_returns[str(row["ticker"])]
    flagship_growth = build_growth_chart(flagship_returns_map, reference_label="Constructed benchmark 3x")

    accessible_growth = build_growth_chart(
        {
            "SPY baseline": baseline.returns,
            "Constructed benchmark 1x": constructed_1x.returns,
            "Constructed benchmark 2x": constructed_2x.returns,
            "Constructed benchmark 3x": constructed_3x.returns,
            "Retirement-cap optimizer": retirement_cap.returns,
            "SPY + funds optimizer": spy_plus_funds.returns,
            "Funds-only optimizer": funds_only.returns,
        },
        reference_label="SPY baseline",
    )

    benchmark_asset_meta = {
        spec["label"]: {
            "asset_key": spec["label"],
            "asset_label": spec["label"],
            "display_name": spec["label"],
            "asset_type": "benchmark_sleeve",
            "ticker": spec["ticker"],
            "fund_name": None,
            "rose_returns_code": spec["returns_code"],
            "rose_level_code": spec["series_code"],
        }
        for spec in BETA_BENCHMARK_SPECS
    }
    fund_asset_meta = {
        str(row["ticker"]): {
            "asset_key": str(row["ticker"]),
            "asset_label": str(row["ticker"]),
            "display_name": str(row["fund_name"]),
            "asset_type": "fund",
            "ticker": str(row["ticker"]),
            "fund_name": str(row["fund_name"]),
            "rose_returns_code": str(row["returns_code"]),
            "rose_level_code": str(row["series_code"]),
        }
        for row in manifest_rows
    }

    all_asset_order = [*benchmark_labels, *fund_labels]
    portfolio_weight_lookup: dict[str, dict[str, float]] = {spec["label"]: {asset: 0.0 for asset in all_asset_order} for spec in PORTFOLIO_SPECS}
    for asset, weight in baseline.weights.items():
        portfolio_weight_lookup["SPY baseline"][asset] = weight
    for asset, weight in constructed_1x.weights.items():
        portfolio_weight_lookup["Constructed benchmark 1x"][asset] = weight
    for asset, weight in constructed_2x.weights.items():
        portfolio_weight_lookup["Constructed benchmark 2x"][asset] = weight
    for asset, weight in constructed_3x.weights.items():
        portfolio_weight_lookup["Constructed benchmark 3x"][asset] = weight
    for asset, weight in retirement_cap.weights.items():
        portfolio_weight_lookup["Retirement-cap optimizer"][asset] = weight
    for asset, weight in spy_plus_funds.weights.items():
        portfolio_weight_lookup["SPY + funds optimizer"][asset] = weight
    for asset, weight in funds_only.weights.items():
        portfolio_weight_lookup["Funds-only optimizer"][asset] = weight

    asset_rows: list[dict[str, object]] = []
    for asset in all_asset_order:
        base_row = dict((benchmark_asset_meta.get(asset) or fund_asset_meta.get(asset)))
        for spec in PORTFOLIO_SPECS:
            base_row[spec["weight_column"]] = float(portfolio_weight_lookup[spec["label"]][asset])
        asset_rows.append(base_row)

    display_asset_rows = [
        row
        for row in asset_rows
        if row["asset_type"] == "benchmark_sleeve"
        or max(abs(float(row[spec["weight_column"]])) for spec in PORTFOLIO_SPECS) >= 0.01
    ]

    scale_check = float(
        np.max(
            np.abs(
                (constructed_3x_weights / max(np.sum(constructed_3x_weights), 1e-12))
                - (constructed_1x_weights / max(np.sum(constructed_1x_weights), 1e-12))
            )
        )
    )
    scale_check_2x = float(
        np.max(
            np.abs(
                (constructed_2x_weights / max(np.sum(constructed_2x_weights), 1e-12))
                - (constructed_1x_weights / max(np.sum(constructed_1x_weights), 1e-12))
            )
        )
    )

    comparison_fund_stats = []
    for ticker in ["Constructed benchmark 3x", *FLAGSHIP_COMPARISON_TICKERS]:
        stats = flagship_growth["stats"].get(ticker)
        if stats is None:
            continue
        comparison_fund_stats.append(
            {
                "label": ticker,
                "annualized_return": stats["annualized_return"],
                "annualized_vol": stats["annualized_vol"],
                "sharpe": stats["sharpe"],
                "max_drawdown": stats["max_drawdown"],
                "correlation_to_constructed_3x": stats["correlation_to_reference"],
            }
        )

    optimization = {
        "objective": "maximize_diversification_ratio",
        "gross_cap": 3.0,
        "framework": {
            "risk_model": "Pairwise-overlap daily covariance, then symmetric PSD stabilization.",
            "objective_formula": "maximize DR(w) = (w' sigma) / sqrt(w' Sigma w)",
            "constraint_set": ["w_i >= 0", "sum_i w_i = G", "G in {1, 2, 3} for the constructed sleeve portfolios"],
            "interpretation": "The optimizer pays for sleeves that bring standalone volatility without moving too much with the rest of the basket. Because diversification ratio is scale-invariant, leverage changes the gross size of the same normalized mix unless you add expected-return, financing, or concentration views.",
        },
        "portfolio_order": [spec["label"] for spec in PORTFOLIO_SPECS],
        "portfolio_columns": PORTFOLIO_SPECS,
        "benchmark_order": benchmark_labels,
        "fund_order": fund_labels,
        "asset_rows": asset_rows,
        "display_asset_rows": display_asset_rows,
        "benchmark_returns_codes": {spec["label"]: spec["returns_code"] for spec in BETA_BENCHMARK_SPECS},
        "benchmark_level_codes": {spec["label"]: spec["series_code"] for spec in BETA_BENCHMARK_SPECS},
        "portfolios": {
            label: {
                "weights": dict(result.weights),
                "gross_exposure": result.gross_exposure,
                "diversification_ratio": result.diversification_ratio,
                "effective_bets": result.effective_bets,
                "annualized_return": result.annualized_return,
                "annualized_vol": result.annualized_vol,
                "sharpe": result.sharpe,
                "max_drawdown": result.max_drawdown,
                "correlation_to_spy": result.correlation_to_spy,
                "daily_observations": result.daily_observations,
                "window_start": result.window_start,
                "window_end": result.window_end,
                "notes": result.notes,
            }
            for label, result in portfolio_results.items()
        },
        "universe_windows": {
            "benchmark_sleeves": {
                "start_date": benchmark_frame.index.min().strftime("%Y-%m-%d"),
                "end_date": benchmark_frame.index.max().strftime("%Y-%m-%d"),
                "daily_observations": int(len(benchmark_frame)),
            },
            "spy_plus_funds_covariance": {
                "min_pairwise_observations": int(spy_plus_funds_observations.replace(0, np.nan).min().min()),
                "max_pairwise_observations": int(spy_plus_funds_observations.max().max()),
            },
            "retirement_cap_covariance": {
                "min_pairwise_observations": int(retirement_cap_observations.replace(0, np.nan).min().min()),
                "max_pairwise_observations": int(retirement_cap_observations.max().max()),
            },
            "funds_only_covariance": {
                "min_pairwise_observations": int(funds_only_observations.replace(0, np.nan).min().min()),
                "max_pairwise_observations": int(funds_only_observations.max().max()),
            },
        },
        "accessible_growth_chart": accessible_growth,
        "flagship_comparison": {
            "tickers": FLAGSHIP_COMPARISON_TICKERS,
            "window_start": flagship_growth["start_date"],
            "window_end": flagship_growth["end_date"],
            "daily_observations": flagship_growth["daily_observations"],
            "dates": flagship_growth["dates"],
            "series": flagship_growth["series"],
            "stats": comparison_fund_stats,
        },
        "constructed_scale_check": scale_check,
        "constructed_scale_check_2x": scale_check_2x,
        "rose": {
            "map_code": OPTIMIZED_MAP_CODE,
            "notebook_code": OPTIMIZED_NOTEBOOK_CODE,
            "notebook_url": f"https://rose.ai/dashboard/{OPTIMIZED_NOTEBOOK_CODE}",
        },
    }

    return {
        "mode": "rose_beta_funds_and_benchmarks",
        "fund_count": len(manifest_rows),
        "benchmark_count": len(BETA_BENCHMARK_SPECS),
        "fund_order": fund_labels,
        "benchmark_order": benchmark_labels,
        "correlation_window_note": "Fund-to-benchmark correlations use pairwise daily-return overlap, so short-history products like ALLW do not truncate the rest of the matrix even after the sleeve universe expands.",
        "correlation_matrix": correlation_matrix,
        "observation_matrix": observation_matrix,
        "funds": fund_cards,
        "most_spy_like": most_spy_like,
        "least_spy_like": least_spy_like,
        "most_distinct": most_distinct,
        "closest_to_constructed_3x": closest_to_constructed_3x,
        "optimization": optimization,
        "manifest_map_code": "gpt.beta.portfolio.funds.total.return.yahoo.map",
        "fund_notebook_code": "gpt.beta.portfolio.funds.total.return.yahoo.notebook",
        "fund_notebook_url": "https://rose.ai/dashboard/gpt.beta.portfolio.funds.total.return.yahoo.notebook",
    }


def push_optimized_beta_portfolios(
    *,
    analysis: dict,
    rose_url: str,
    username: str,
    password: str,
    output_path: Path,
) -> dict:
    client = RoseClient(url=rose_url, username=username, password=password)
    optimization = analysis["optimization"]

    client.push_rows_map(
        OPTIMIZED_MAP_CODE,
        optimization["asset_rows"],
        metas={
            "title": "Optimized beta portfolio constructions",
            "owner": username,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "objective": optimization["objective"],
            "portfolio_columns": [spec["weight_column"] for spec in optimization["portfolio_columns"]],
        },
    )

    returns_logic_codes: dict[str, str] = {}
    level_logic_codes: dict[str, str] = {}
    for spec in optimization["portfolio_columns"]:
        portfolio_key = spec["key"]
        weight_column = spec["weight_column"]
        returns_logic_codes[portfolio_key] = f"gpt.beta.optimized.{portfolio_key}.portfolio.returns.logic.20260419"
        level_logic_codes[portfolio_key] = f"gpt.beta.optimized.{portfolio_key}.portfolio.return.logic.20260419"
        returns_logic = f"{OPTIMIZED_MAP_CODE}:portfolioreturns(rose_returns_code, {weight_column})"
        client.push_logic(returns_logic_codes[portfolio_key], returns_logic)
        client.push_logic(level_logic_codes[portfolio_key], f"{returns_logic_codes[portfolio_key]}:return")

    portfolio_level_code_by_label = {
        spec["label"]: level_logic_codes[spec["key"]]
        for spec in optimization["portfolio_columns"]
    }

    fund_level_code_by_ticker = {
        row["ticker"]: row["series_code"]
        for row in analysis["funds"]
        if row["ticker"] in FLAGSHIP_COMPARISON_TICKERS
    }

    notebook_cells = [
        markdown_cell(
            "# Optimized Beta Portfolios\n\n"
            "This notebook now uses a single asset map with one weight column per portfolio construction. "
            "That makes the Rose objects readable as a portfolio matrix rather than one separate row set per construction."
        ),
        code_cell(OPTIMIZED_MAP_CODE),
        markdown_cell(
            "## Constructed vs accessible alternatives\n\n"
            "These are the five core constructions: SPY baseline, the 1x and 3x constructed sleeve portfolios, "
            "the optimizer over SPY plus funds, and the optimizer over funds only."
        ),
        chart_cell(
            [portfolio_level_code_by_label[spec["label"]] for spec in optimization["portfolio_columns"]],
            [spec["label"] for spec in optimization["portfolio_columns"]],
            "Constructed Portfolios And Accessible Alternatives",
            start_date=optimization["accessible_growth_chart"]["start_date"],
            end_date=optimization["accessible_growth_chart"]["end_date"],
        ),
        markdown_cell(
            "## Constructed benchmark 3x vs flagship diversified products\n\n"
            "This comparison window is short because the youngest fund in the comparison set, especially ALLW, is recent."
        ),
        chart_cell(
            [
                portfolio_level_code_by_label["Constructed benchmark 3x"],
                *[fund_level_code_by_ticker[ticker] for ticker in FLAGSHIP_COMPARISON_TICKERS if ticker in fund_level_code_by_ticker],
            ],
            [
                "Constructed benchmark 3x",
                *[ticker for ticker in FLAGSHIP_COMPARISON_TICKERS if ticker in fund_level_code_by_ticker],
            ],
            "Constructed Benchmark 3x vs All Weather / Risk Parity Style Funds",
            start_date=optimization["flagship_comparison"]["window_start"],
            end_date=optimization["flagship_comparison"]["window_end"],
        ),
    ]

    notebook_result = client.push_notebook(
        OPTIMIZED_NOTEBOOK_CODE,
        notebook_cells,
        metas={
            "title": "Optimized beta portfolios",
            "owner": username,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
    )

    manifest = {
        "map_code": OPTIMIZED_MAP_CODE,
        "notebook_code": OPTIMIZED_NOTEBOOK_CODE,
        "notebook_url": f"https://rose.ai/dashboard/{OPTIMIZED_NOTEBOOK_CODE}",
        "portfolio_columns": optimization["portfolio_columns"],
        "portfolio_level_codes": portfolio_level_code_by_label,
        "portfolio_returns_logic_codes": {
            spec["label"]: returns_logic_codes[spec["key"]]
            for spec in optimization["portfolio_columns"]
        },
        "flagship_fund_tickers": FLAGSHIP_COMPARISON_TICKERS,
        "notebook_push_result": notebook_result,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    output_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest
