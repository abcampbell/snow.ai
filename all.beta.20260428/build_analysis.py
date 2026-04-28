from __future__ import annotations

import json
import math
import os
import re
from datetime import datetime, timezone
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import requests
from matplotlib.backends.backend_pdf import PdfPages
from scipy.optimize import minimize

from beta_portfolio_section import (
    CHART_COLORS,
    compute_beta_portfolio_analysis,
    load_beta_manifest_rows,
    pairwise_corr,
    pull_returns_with_fallback,
    rose_session as beta_rose_session,
)


PROJECT_DIR = Path(__file__).parent
CHART_DIR = PROJECT_DIR / "charts"
ANALYSIS_JSON_PATH = PROJECT_DIR / "analysis.json"
ANALYSIS_JS_PATH = PROJECT_DIR / "analysis.js"
SUMMARY_PDF_PATH = PROJECT_DIR / "all_beta_summary.pdf"
MACRO_RETURNS_CSV_PATH = PROJECT_DIR / "macro_monthly_returns.csv"
MACRO_CORR_CSV_PATH = PROJECT_DIR / "macro_correlation.csv"
BETA_FUND_MANIFEST_PATH = PROJECT_DIR / "rose_beta_portfolios_manifest.json"

ROSE_API_URL = os.environ.get("ROSE_API_URL", "https://rose.ai")
ROSE_USER = os.environ.get("ROSE_USER", "chatgpt")
ROSE_PASS = os.environ.get("ROSE_PASS", "botsbots")
BETA_ROSE_USER = os.environ.get("BETA_ROSE_USER", "acampbell")
BETA_ROSE_PASS = os.environ.get("BETA_ROSE_PASS", "bananaman")

EQUITY_SIGMA = 0.20
EQUITY_RHO = 0.30
MAX_STOCKS = 300
TARGET_FACTOR_VOL = 0.10
MARGINAL_THRESHOLDS_BPS = [25, 10, 5, 1]

FACTOR_SPECS = [
    {"label": "U.S. Equities", "rosecode": "spy:return"},
    {"label": "DM ex-US Equities", "rosecode": "efa:return"},
    {"label": "EM Equities", "rosecode": "eem:return"},
    {"label": "Long Treasuries", "rosecode": "tlt:return"},
    {"label": "TIPS / IL Bonds", "rosecode": "tips:return"},
    {"label": "IG Credit", "rosecode": "lqd:return"},
    {"label": "HY Credit", "rosecode": "hyg:return"},
    {"label": "EM Sovereign Bonds", "rosecode": "emb:return"},
    {"label": "Broad Commodities", "rosecode": "dbc:return"},
    {"label": "Gold", "rosecode": "gld:return"},
    {"label": "U.S. REITs", "rosecode": "vnq:return"},
    {"label": "EM FX", "rosecode": "snow.beta.em.fx.cew.yahoo", "yahoo_ticker": "CEW"},
]

MACRO_PROXIES = {spec["label"]: spec["rosecode"] for spec in FACTOR_SPECS}

BROAD_FACTOR_ORDER = [
    "U.S. Equities",
    "Long Treasuries",
    "TIPS / IL Bonds",
    "Broad Commodities",
    "Gold",
    "DM ex-US Equities",
    "EM Equities",
    "EM Sovereign Bonds",
    "EM FX",
    "IG Credit",
    "HY Credit",
    "U.S. REITs",
]

SOURCE_NOTES = [
    {
        "title": "Bridgewater - The All Weather Story",
        "url": "https://www.bridgewater.com/research-and-insights/the-all-weather-story",
        "note": "Bridgewater's primary-source framing for separating cash, beta, and alpha, and for balancing assets across economic environments.",
    },
    {
        "title": "Meir Statman (1987) - How Many Stocks Make a Diversified Portfolio?",
        "url": "https://www.cambridge.org/core/journals/journal-of-financial-and-quantitative-analysis/article/how-many-stocks-make-a-diversified-portfolio/CE5CDF2C7225FC1E0EDE3E700A3C66A7",
        "note": "Canonical 30-40 stock result for random equity diversification once a risk-free asset is included.",
    },
    {
        "title": "AQR - Understanding Risk Parity",
        "url": "https://www.aqr.com/-/media/AQR/Documents/Insights/White-Papers/Understanding-Risk-Parity.pdf",
        "note": "Clear practitioner explanation of why traditional portfolios are dominated by equity risk and why risk parity reallocates risk, not just dollars.",
    },
    {
        "title": "Ang, Bass, Gladstone et al. - Total Portfolio Factor, Not Just Asset, Allocation",
        "url": "https://dmmn26wgpgtie.cloudfront.net/wp-content/uploads/2017/10/25154404/Total-portfolio-factor-not-just-asset-allocation-2.pdf",
        "note": "Cross-asset PCA framing for the broader macro factor set: growth, real rates, inflation, credit, emerging markets, commodity, with FX as an added volatility driver.",
    },
    {
        "title": "MSCI - Multi-Asset Class Factor Model Tier 1",
        "url": "https://www.msci.com/downloads/web/msci-com/indexes/msci-economic-regime/multi-asset-class-factor-model/MSCI_MAC_Factor_Model_Tier1_Factsheet_July%202020.pdf",
        "note": "Board-level multi-asset factor map that extends the core set to credit, commodities, currencies, real estate, and other cross-asset sleeves.",
    },
    {
        "title": "Attilio Meucci - Re-Defining and Managing Diversification",
        "url": "https://www.bayes.city.ac.uk/__data/assets/pdf_file/0003/213699/Meucci-ReDefining-and-Managing-Diversification.pdf",
        "note": "Useful reference for effective-number-of-bets thinking and why nominal position count overstates true diversification.",
    },
    {
        "title": "James, Menzies, Gottwald (2022) - On financial market correlation structures and diversification benefits across and within equity sectors",
        "url": "https://arxiv.org/abs/2202.10623",
        "note": "Recent evidence that 30-40 stocks is often enough for equity-specific diversification, while equity diversification becomes less effective when collective behavior rises.",
    },
]

COLORS = {
    "ink": "#143642",
    "amber": "#c97c1a",
    "stone": "#6c7a89",
    "rose": "#a23e48",
    "sea": "#2e6f95",
    "mint": "#4d908e",
    "paper": "#f6f1e8",
}

FACTOR_GROUPS = {
    "growth": ["U.S. Equities", "DM ex-US Equities", "EM Equities", "U.S. REITs"],
    "rates": ["Long Treasuries", "TIPS / IL Bonds"],
    "inflation": ["Broad Commodities", "Gold", "TIPS / IL Bonds"],
    "credit": ["IG Credit", "HY Credit", "EM Sovereign Bonds"],
    "em": ["EM Equities", "EM Sovereign Bonds", "EM FX"],
    "fx": ["EM FX"],
    "monetary": ["Gold", "Long Treasuries"],
}


def ensure_dirs() -> None:
    CHART_DIR.mkdir(exist_ok=True)


def rose_session() -> requests.Session:
    session = requests.Session()
    response = session.post(
        f"{ROSE_API_URL}/users/auth",
        json={"username": ROSE_USER, "password": ROSE_PASS},
        timeout=20,
    )
    response.raise_for_status()
    return session


def pull_rose_timeseries(session: requests.Session, rosecode: str) -> pd.Series:
    response = session.get(
        f"{ROSE_API_URL}/objects",
        params={"rosecode": rosecode, "exact_match": 1},
        timeout=60,
    )
    response.raise_for_status()
    payload = response.json()
    values = payload.get("values", {})

    if isinstance(values, dict) and "columns" not in values:
        series = pd.Series(values, name=rosecode, dtype="float64")
        series.index = pd.to_datetime(series.index)
        return series.sort_index()

    columns = values.get("columns", [])
    rows = values.get("data", [])
    if not columns or not rows:
        raise ValueError(f"No rows returned for {rosecode}")

    frame = pd.DataFrame(rows, columns=columns)
    if "date" not in frame.columns:
        raise ValueError(f"{rosecode} did not return a date column")
    value_columns = [column for column in frame.columns if column != "date"]
    if not value_columns:
        raise ValueError(f"{rosecode} did not return a value column")

    series = pd.Series(frame[value_columns[0]].astype("float64").values, index=pd.to_datetime(frame["date"]), name=rosecode)
    return series.sort_index()


def pull_factor_series(session: requests.Session, spec: dict) -> tuple[pd.Series, dict]:
    rosecode = spec["rosecode"]
    try:
        return pull_rose_timeseries(session, rosecode), {
            "rosecode": rosecode,
            "source": "rose",
        }
    except requests.HTTPError as exc:
        if spec.get("yahoo_ticker") and exc.response is not None and exc.response.status_code == 404:
            push_response = session.get(
                f"{ROSE_API_URL}/objects",
                params={"rosecode": f"yahoo:push({rosecode}, {spec['yahoo_ticker']})", "exact_match": 1},
                timeout=120,
            )
            push_response.raise_for_status()
            return pull_rose_timeseries(session, rosecode), {
                "rosecode": rosecode,
                "source": "rose_seeded_from_yahoo",
                "yahoo_ticker": spec["yahoo_ticker"],
            }
        raise


def participation_ratio(correlation: pd.DataFrame) -> float:
    eigenvalues = np.linalg.eigvalsh(correlation.values.astype(float))
    eigenvalues = np.clip(eigenvalues, 0.0, None)
    total = float(eigenvalues.sum())
    if total <= 0:
        return 0.0
    weights = eigenvalues / total
    return float(1.0 / np.sum(np.square(weights)))


def stabilize_covariance(covariance: pd.DataFrame, floor: float = 1e-10) -> pd.DataFrame:
    values = np.nan_to_num(covariance.values.astype(float), nan=0.0)
    values = 0.5 * (values + values.T)
    eigenvalues, eigenvectors = np.linalg.eigh(values)
    clipped = np.clip(eigenvalues, floor, None)
    stabilized = eigenvectors @ np.diag(clipped) @ eigenvectors.T
    stabilized = 0.5 * (stabilized + stabilized.T)
    stabilized += np.eye(stabilized.shape[0]) * floor
    return pd.DataFrame(stabilized, index=covariance.index, columns=covariance.columns)


def benefit_crossing(curve: list[float], threshold: float) -> int | None:
    for index, value in enumerate(curve, start=1):
        if value >= threshold:
            return index
    return None


def marginal_crossing(marginal: list[float], threshold: float) -> int | None:
    for n_value, reduction in enumerate(marginal, start=1):
        if n_value < 2:
            continue
        if reduction <= threshold:
            return n_value
    return None


def compute_equity_analysis() -> dict:
    n_values = np.arange(1, MAX_STOCKS + 1)
    portfolio_var = EQUITY_SIGMA ** 2 * (EQUITY_RHO + (1.0 - EQUITY_RHO) / n_values)
    portfolio_vol = np.sqrt(portfolio_var)
    asymptote_vol = EQUITY_SIGMA * math.sqrt(EQUITY_RHO)

    marginal_reduction = np.empty_like(portfolio_vol)
    marginal_reduction[0] = np.nan
    marginal_reduction[1:] = portfolio_vol[:-1] - portfolio_vol[1:]

    available_diversification = portfolio_vol[0] - asymptote_vol
    captured = (portfolio_vol[0] - portfolio_vol) / available_diversification

    threshold_hits = {
        str(bps): marginal_crossing(marginal_reduction.tolist(), bps / 10000.0)
        for bps in MARGINAL_THRESHOLDS_BPS
    }

    return {
        "assumptions": {
            "single_stock_vol": EQUITY_SIGMA,
            "average_pairwise_correlation": EQUITY_RHO,
            "max_stocks": MAX_STOCKS,
            "marginal_thresholds_bps": MARGINAL_THRESHOLDS_BPS,
        },
        "n": n_values.astype(int).tolist(),
        "portfolio_vol": portfolio_vol.tolist(),
        "marginal_reduction": [None if math.isnan(value) else float(value) for value in marginal_reduction],
        "benefit_captured": captured.tolist(),
        "asymptote_vol": asymptote_vol,
        "n_for_90pct_of_available_diversification": benefit_crossing(captured.tolist(), 0.90),
        "n_for_95pct_of_available_diversification": benefit_crossing(captured.tolist(), 0.95),
        "marginal_threshold_hits": threshold_hits,
        "formula": "sigma_p^2 = sigma^2 * (rho + (1-rho)/N)",
        "interpretation": "As N grows, the idiosyncratic term shrinks toward zero and the portfolio converges to a systematic equity-beta floor of sigma * sqrt(rho).",
    }


def equal_risk_contribution_weights(covariance: np.ndarray, tolerance: float = 1e-12, max_iter: int = 5000) -> np.ndarray:
    covariance = np.asarray(covariance, dtype=float)
    if covariance.shape[0] != covariance.shape[1]:
        raise ValueError("Covariance matrix must be square")
    if covariance.shape[0] == 1:
        return np.array([1.0], dtype=float)

    budgets = np.repeat(1.0 / covariance.shape[0], covariance.shape[0])
    x = np.repeat(1.0, covariance.shape[0])

    for _ in range(max_iter):
        previous = x.copy()
        for index in range(covariance.shape[0]):
            diagonal = float(covariance[index, index])
            if diagonal <= 0:
                raise ValueError("Covariance matrix must have strictly positive diagonal entries")
            cross_term = float(covariance[index, :] @ x - diagonal * x[index])
            discriminant = max(cross_term * cross_term + 4.0 * diagonal * budgets[index], 0.0)
            x[index] = (-cross_term + math.sqrt(discriminant)) / (2.0 * diagonal)
        if float(np.max(np.abs(x - previous))) < tolerance:
            break

    weights = x / x.sum()
    return weights.astype(float)


def macro_subset_stats(
    labels: list[str],
    covariance_monthly: pd.DataFrame,
    correlation: pd.DataFrame,
) -> dict:
    subset_covariance = covariance_monthly.loc[labels, labels]
    subset_correlation = correlation.loc[labels, labels]
    weights = equal_risk_contribution_weights(subset_covariance.values)
    monthly_vols = np.sqrt(np.diag(subset_covariance.values))
    portfolio_variance_monthly = float(weights @ subset_covariance.values @ weights)
    portfolio_vol_monthly = math.sqrt(max(portfolio_variance_monthly, 0.0))
    marginal_contribution = subset_covariance.values @ weights
    raw_risk_contributions = weights * marginal_contribution / max(portfolio_vol_monthly, 1e-12)
    risk_shares = raw_risk_contributions / max(float(raw_risk_contributions.sum()), 1e-12)
    diversification_ratio = float((weights @ monthly_vols) / max(portfolio_vol_monthly, 1e-12))

    return {
        "ann_vol": portfolio_vol_monthly * math.sqrt(12),
        "effective_dimension": participation_ratio(subset_correlation),
        "diversification_ratio": diversification_ratio,
        "nominal_weights": {label: float(value) for label, value in zip(labels, weights)},
        "risk_shares": {label: float(value) for label, value in zip(labels, risk_shares)},
    }


def compute_cumulative_macro_steps(
    ordered_labels: list[str],
    covariance_monthly: pd.DataFrame,
    correlation: pd.DataFrame,
) -> list[dict]:
    steps: list[dict] = []
    previous_stats: dict | None = None

    for step_number, added_factor in enumerate(ordered_labels, start=1):
        labels = ordered_labels[:step_number]
        stats = macro_subset_stats(labels, covariance_monthly=covariance_monthly, correlation=correlation)
        ann_vol = stats["ann_vol"]
        effective_dimension = stats["effective_dimension"]
        diversification_ratio = stats["diversification_ratio"]

        steps.append(
            {
                "step": step_number,
                "added_factor": added_factor,
                "labels": labels.copy(),
                "ann_vol": ann_vol,
                "marginal_reduction": None if previous_stats is None else previous_stats["ann_vol"] - ann_vol,
                "effective_dimension": effective_dimension,
                "marginal_dimension_gain": None if previous_stats is None else effective_dimension - previous_stats["effective_dimension"],
                "diversification_ratio": diversification_ratio,
                "marginal_diversification_ratio_gain": None if previous_stats is None else diversification_ratio - previous_stats["diversification_ratio"],
                "nominal_weights": stats["nominal_weights"],
                "risk_shares": stats["risk_shares"],
                "leverage_to_target_vol": None if ann_vol <= 0 else TARGET_FACTOR_VOL / ann_vol,
            }
        )
        previous_stats = {
            "ann_vol": ann_vol,
            "effective_dimension": effective_dimension,
            "diversification_ratio": diversification_ratio,
        }

    return steps


def orient_component(loadings: pd.Series) -> pd.Series:
    top_label = loadings.abs().idxmax()
    return loadings if float(loadings.loc[top_label]) >= 0 else -loadings


def top_loading_entries(loadings: pd.Series, *, positive: bool, limit: int = 4) -> list[dict]:
    if positive:
        subset = loadings[loadings > 0].sort_values(ascending=False).head(limit)
    else:
        subset = loadings[loadings < 0].sort_values().head(limit)
    return [{"sleeve": label, "loading": float(value)} for label, value in subset.items()]


def interpret_component(loadings: pd.Series, component_number: int) -> dict:
    signed_scores = {
        group: float(loadings[[member for member in members if member in loadings.index]].sum())
        for group, members in FACTOR_GROUPS.items()
    }
    absolute_scores = {
        group: float(loadings[[member for member in members if member in loadings.index]].abs().sum())
        for group, members in FACTOR_GROUPS.items()
    }

    label = f"PC{component_number}"
    summary = "Residual cross-asset factor that matters less than the dominant macro components."

    if absolute_scores["growth"] > 1.45 and signed_scores["growth"] > 1.0:
        label = "Growth beta"
        summary = "Broad global risk appetite: equities, REITs, EM, and some commodity beta all move together."
    elif absolute_scores["rates"] > 0.55 and absolute_scores["inflation"] > 0.55 and signed_scores["rates"] * signed_scores["inflation"] < 0:
        label = "Real rates vs inflation"
        summary = "Duration and real-rate exposure run opposite commodities and other inflation-sensitive sleeves."
    elif absolute_scores["monetary"] > 0.95 and signed_scores["monetary"] > 0.75:
        label = "Monetary stress / refuge"
        summary = "Gold and duration dominate against equity and REIT beta, which reads like a refuge or monetary-stress factor."
    elif absolute_scores["credit"] > 1.0:
        label = "Credit carry"
        summary = "Credit-sensitive sleeves drive the component against duration and parts of the broader risk complex."
    elif absolute_scores["em"] > 0.85 and loadings.get("EM Equities", 0.0) * loadings.get("U.S. REITs", 0.0) < 0:
        label = "EM / external beta"
        summary = "Emerging-market equity, debt, and FX exposure separate from domestic real-asset risk."
    elif absolute_scores["growth"] > 1.25 and loadings.get("U.S. Equities", 0.0) * loadings.get("EM Equities", 0.0) < 0:
        label = "U.S. vs EM leadership"
        summary = "Separates U.S. equity leadership from EM and real-asset equity exposure."
    elif absolute_scores["inflation"] > 1.0 and loadings.get("Broad Commodities", 0.0) * loadings.get("Gold", 0.0) < 0:
        label = "Commodity inflation vs gold"
        summary = "Splits broad inflation beta from gold-led monetary hedges and collateral-like duration."
    elif absolute_scores["fx"] > 0.10:
        label = "FX / external financing"
        summary = "Currency and external-financing stress explain more of the move than the standard growth or duration buckets."

    return {
        "label": label,
        "summary": summary,
        "signed_group_scores": signed_scores,
        "absolute_group_scores": absolute_scores,
        "top_positive": top_loading_entries(loadings, positive=True),
        "top_negative": top_loading_entries(loadings, positive=False),
    }


def build_macro_factor_map(covariance_monthly: pd.DataFrame) -> dict:
    labels = list(covariance_monthly.index)
    eigenvalues, eigenvectors = np.linalg.eigh(covariance_monthly.values.astype(float))
    order = np.argsort(eigenvalues)[::-1]
    eigenvalues = np.clip(eigenvalues[order], 0.0, None)
    eigenvectors = eigenvectors[:, order]

    total_variance = float(eigenvalues.sum())
    explained = eigenvalues / total_variance if total_variance > 0 else np.zeros_like(eigenvalues)
    cumulative = np.cumsum(explained)

    components: list[dict] = []
    oriented_vectors: list[np.ndarray] = []
    for index in range(len(labels)):
        loadings = orient_component(pd.Series(eigenvectors[:, index], index=labels, dtype="float64"))
        interpretation = interpret_component(loadings, index + 1)
        oriented_vectors.append(loadings.values.astype(float))
        components.append(
            {
                "component": index + 1,
                "code": f"PC{index + 1}",
                "economic_label": interpretation["label"],
                "summary": interpretation["summary"],
                "eigenvalue": float(eigenvalues[index]),
                "explained_variance_ratio": float(explained[index]),
                "cumulative_explained_variance_ratio": float(cumulative[index]),
                "loadings": {label: float(loadings[label]) for label in labels},
                "top_positive": interpretation["top_positive"],
                "top_negative": interpretation["top_negative"],
                "signed_group_scores": interpretation["signed_group_scores"],
                "absolute_group_scores": interpretation["absolute_group_scores"],
            }
        )

    factors_for_90 = benefit_crossing(cumulative.tolist(), 0.90) or len(labels)
    factors_for_95 = benefit_crossing(cumulative.tolist(), 0.95) or len(labels)
    selected_factor_count = max(5, min(6, factors_for_95))

    selected_eigenvalues = eigenvalues[:selected_factor_count]
    selected_covariance = np.diag(selected_eigenvalues)
    factor_weights = equal_risk_contribution_weights(selected_covariance)
    factor_vols = np.sqrt(np.clip(selected_eigenvalues, 0.0, None))
    factor_portfolio_vol = math.sqrt(float(factor_weights @ selected_covariance @ factor_weights))
    marginal = selected_covariance @ factor_weights
    raw_contributions = factor_weights * marginal / max(factor_portfolio_vol, 1e-12)
    risk_shares = raw_contributions / max(float(raw_contributions.sum()), 1e-12)

    factor_labels = [
        f"{components[index]['code']} {components[index]['economic_label']}"
        for index in range(selected_factor_count)
    ]

    return {
        "component_labels": labels,
        "factors_for_90pct_variance": factors_for_90,
        "factors_for_95pct_variance": factors_for_95,
        "selected_factor_count": selected_factor_count,
        "eigenvalues": [float(value) for value in eigenvalues],
        "explained_variance_ratio": [float(value) for value in explained],
        "cumulative_explained_variance_ratio": [float(value) for value in cumulative],
        "components": components,
        "factor_erc": {
            "selected_factor_count": selected_factor_count,
            "factor_labels": factor_labels,
            "capital_weights": {factor_labels[index]: float(factor_weights[index]) for index in range(selected_factor_count)},
            "risk_contributions": {factor_labels[index]: float(risk_shares[index]) for index in range(selected_factor_count)},
            "variance_share": {factor_labels[index]: float(explained[index]) for index in range(selected_factor_count)},
            "factor_monthly_vols": {factor_labels[index]: float(factor_vols[index]) for index in range(selected_factor_count)},
            "portfolio_monthly_vol": float(factor_portfolio_vol),
        },
    }


def compute_macro_analysis_from_rose() -> dict:
    session = rose_session()
    series_map: dict[str, pd.Series] = {}
    proxy_details: dict[str, dict] = {}

    for spec in FACTOR_SPECS:
        series, detail = pull_factor_series(session, spec)
        series_map[spec["label"]] = series
        proxy_details[spec["label"]] = detail

    levels = pd.concat(series_map, axis=1).sort_index()
    monthly_levels = levels.resample("ME").last().dropna(how="all")
    monthly_returns = monthly_levels.pct_change(fill_method=None).dropna(how="all")

    selected_order = [label for label in BROAD_FACTOR_ORDER if label in monthly_returns.columns]
    covariance_monthly = stabilize_covariance(monthly_returns[selected_order].cov(ddof=0))
    correlation = monthly_returns[selected_order].corr().fillna(0.0)
    np.fill_diagonal(correlation.values, 1.0)
    annualized_vol = monthly_returns[selected_order].std(ddof=0) * math.sqrt(12)
    steps = compute_cumulative_macro_steps(
        ordered_labels=selected_order,
        covariance_monthly=covariance_monthly,
        correlation=correlation,
    )
    pca = build_macro_factor_map(covariance_monthly.loc[selected_order, selected_order])

    starting_dimension = steps[0]["effective_dimension"]
    ending_dimension = steps[-1]["effective_dimension"]
    benefit_captured = []
    for step in steps:
        numerator = step["effective_dimension"] - starting_dimension
        denominator = ending_dimension - starting_dimension
        benefit_captured.append(numerator / denominator if denominator != 0 else 0.0)

    monthly_returns[selected_order].to_csv(MACRO_RETURNS_CSV_PATH, index_label="date")
    correlation.to_csv(MACRO_CORR_CSV_PATH, index_label="factor")

    return {
        "mode": "rose_proxies",
        "construction": "equal_risk_contribution",
        "order_method": "all_weather_core_plus_extensions",
        "covariance_method": "pairwise_overlap_stabilized",
        "target_factor_vol": TARGET_FACTOR_VOL,
        "proxy_codes": MACRO_PROXIES,
        "proxy_details": proxy_details,
        "selected_order": selected_order,
        "start_date": monthly_returns.index.min().strftime("%Y-%m-%d"),
        "end_date": monthly_returns.index.max().strftime("%Y-%m-%d"),
        "monthly_observations": int(len(monthly_returns)),
        "annualized_vols": {label: float(value) for label, value in annualized_vol[selected_order].items()},
        "correlation_matrix": {
            row: {column: float(correlation.loc[row, column]) for column in correlation.columns}
            for row in correlation.index
        },
        "pca": pca,
        "steps": steps,
        "benefit_captured": benefit_captured,
        "n_for_90pct_of_available_diversification": benefit_crossing(benefit_captured, 0.90),
        "interpretation": "The sleeve list is just the raw material. PCA on the stabilized sleeve covariance shows that the 12 sleeves collapse into a much smaller factor map: roughly growth beta, real rates versus inflation, monetary refuge, EM or external beta, U.S. versus EM leadership, and credit carry. The factor ERC step then budgets risk across those latent drivers rather than across sleeve labels.",
    }


def compute_macro_analysis_fallback() -> dict:
    labels = [label for label in BROAD_FACTOR_ORDER if label in MACRO_PROXIES]
    fallback_annualized_vol = pd.Series(
        {
            "U.S. Equities": 0.16,
            "DM ex-US Equities": 0.17,
            "EM Equities": 0.22,
            "Long Treasuries": 0.14,
            "TIPS / IL Bonds": 0.06,
            "IG Credit": 0.09,
            "HY Credit": 0.13,
            "EM Sovereign Bonds": 0.11,
            "Broad Commodities": 0.19,
            "Gold": 0.17,
            "U.S. REITs": 0.19,
            "EM FX": 0.10,
        }
    )
    corr = pd.DataFrame(np.eye(len(labels)), index=labels, columns=labels, dtype=float)

    risky_assets = {"U.S. Equities", "DM ex-US Equities", "EM Equities", "U.S. REITs"}
    credit_assets = {"IG Credit", "HY Credit", "EM Sovereign Bonds"}
    inflation_assets = {"Broad Commodities", "Gold", "TIPS / IL Bonds", "EM FX"}

    def set_corr(left: str, right: str, value: float) -> None:
        corr.loc[left, right] = value
        corr.loc[right, left] = value

    for left in labels:
        for right in labels:
            if left >= right:
                continue
            value = 0.20
            if {left, right} <= risky_assets:
                value = 0.68
            elif {left, right} <= credit_assets:
                value = 0.62
            elif {left, right} <= inflation_assets:
                value = 0.28
            elif "Long Treasuries" in {left, right} and ({left, right} & risky_assets):
                value = -0.30
            elif "Long Treasuries" in {left, right} and ({left, right} & credit_assets):
                value = -0.05
            elif "Long Treasuries" in {left, right} and ({left, right} & inflation_assets):
                value = 0.05 if "TIPS / IL Bonds" not in {left, right} else 0.55
            elif "TIPS / IL Bonds" in {left, right} and ({left, right} & risky_assets):
                value = 0.15
            elif "TIPS / IL Bonds" in {left, right} and ({left, right} & credit_assets):
                value = 0.18
            elif "Broad Commodities" in {left, right} and ({left, right} & risky_assets):
                value = 0.22
            elif "Gold" in {left, right} and ({left, right} & risky_assets):
                value = 0.10
            elif "EM FX" in {left, right} and "EM Equities" in {left, right}:
                value = 0.42
            elif "EM FX" in {left, right} and "EM Sovereign Bonds" in {left, right}:
                value = 0.46
            elif "IG Credit" in {left, right} and ({left, right} & risky_assets):
                value = 0.48
            elif "HY Credit" in {left, right} and ({left, right} & risky_assets):
                value = 0.62
            elif "EM Sovereign Bonds" in {left, right} and ({left, right} & risky_assets):
                value = 0.44
            elif "U.S. REITs" in {left, right} and "Broad Commodities" in {left, right}:
                value = 0.25
            elif "U.S. REITs" in {left, right} and "Gold" in {left, right}:
                value = 0.12
            set_corr(left, right, value)

    monthly_vol = fallback_annualized_vol / math.sqrt(12)
    covariance_monthly = pd.DataFrame(
        np.outer(monthly_vol.loc[labels], monthly_vol.loc[labels]) * corr.values,
        index=labels,
        columns=labels,
    )
    steps = compute_cumulative_macro_steps(
        ordered_labels=labels,
        covariance_monthly=covariance_monthly,
        correlation=corr,
    )
    pca = build_macro_factor_map(covariance_monthly.loc[labels, labels])

    starting_dimension = steps[0]["effective_dimension"]
    ending_dimension = steps[-1]["effective_dimension"]
    benefit_captured = []
    for step in steps:
        numerator = step["effective_dimension"] - starting_dimension
        denominator = ending_dimension - starting_dimension
        benefit_captured.append(numerator / denominator if denominator != 0 else 0.0)

    return {
        "mode": "toy_fallback",
        "construction": "equal_risk_contribution",
        "order_method": "all_weather_core_plus_extensions",
        "covariance_method": "heuristic_static_matrix",
        "target_factor_vol": TARGET_FACTOR_VOL,
        "proxy_codes": MACRO_PROXIES,
        "proxy_details": {
            label: {
                "rosecode": MACRO_PROXIES[label],
                "source": "heuristic_fallback",
            }
            for label in labels
        },
        "selected_order": labels,
        "start_date": None,
        "end_date": None,
        "monthly_observations": None,
        "annualized_vols": {label: float(value) for label, value in fallback_annualized_vol[labels].items()},
        "correlation_matrix": {
            row: {column: float(corr.loc[row, column]) for column in corr.columns}
            for row in corr.index
        },
        "pca": pca,
        "steps": steps,
        "benefit_captured": benefit_captured,
        "n_for_90pct_of_available_diversification": benefit_crossing(benefit_captured, 0.90),
        "interpretation": "Fallback factor map built from the heuristic sleeve covariance. Even in fallback mode the same point survives: the sleeve count overstates diversification because the covariance still collapses to a smaller set of principal components.",
    }


def compute_macro_analysis() -> dict:
    try:
        return compute_macro_analysis_from_rose()
    except Exception as exc:
        return {
            **compute_macro_analysis_fallback(),
            "warning": str(exc),
        }


def compute_beta_analysis() -> dict:
    try:
        return compute_beta_portfolio_analysis(
            manifest_path=BETA_FUND_MANIFEST_PATH,
            rose_url=ROSE_API_URL,
            username=BETA_ROSE_USER,
            password=BETA_ROSE_PASS,
        )
    except Exception as exc:
        return {
            "mode": "unavailable",
            "warning": str(exc),
        }


def parse_fee_percent(text: str) -> float | None:
    matches = [float(value) for value in re.findall(r"(\d+(?:\.\d+)?)\s*%", str(text))]
    if not matches:
        return None
    return matches[-1] / 100.0


def cosine_similarity(left: np.ndarray, right: np.ndarray) -> float:
    left_norm = float(np.linalg.norm(left))
    right_norm = float(np.linalg.norm(right))
    if left_norm <= 1e-12 or right_norm <= 1e-12:
        return 0.0
    return float(np.dot(left, right) / (left_norm * right_norm))


def monthly_returns_from_daily(daily_returns: pd.Series) -> pd.Series:
    return (1.0 + daily_returns).resample("ME").prod() - 1.0


def annualized_return_from_series(returns: pd.Series, periods_per_year: int) -> float:
    if returns.empty:
        return 0.0
    cumulative = float((1.0 + returns).prod())
    years = len(returns) / periods_per_year
    if years <= 0 or cumulative <= 0:
        return 0.0
    return cumulative ** (1.0 / years) - 1.0


def max_drawdown_from_returns(returns: pd.Series) -> float:
    if returns.empty:
        return 0.0
    wealth = (1.0 + returns).cumprod()
    peak = wealth.cummax()
    drawdown = wealth / peak - 1.0
    return float(drawdown.min())


def solve_sharpe_portfolio(returns: pd.DataFrame) -> np.ndarray:
    n_assets = returns.shape[1]
    mean_vector = returns.mean().values.astype(float)
    covariance = returns.cov(ddof=0).values.astype(float)

    def objective(weights: np.ndarray) -> float:
        port_return = float(weights @ mean_vector)
        port_var = float(weights @ covariance @ weights)
        port_vol = math.sqrt(max(port_var, 1e-12))
        return -(port_return / port_vol)

    constraints = [{"type": "eq", "fun": lambda weights: float(np.sum(weights) - 1.0)}]
    bounds = [(0.0, 1.0) for _ in range(n_assets)]
    starts = [
        np.repeat(1.0 / n_assets, n_assets),
        np.eye(n_assets)[int(np.argmax(mean_vector))],
        np.eye(n_assets)[int(np.argmax(np.diag(covariance) ** -0.5))] if np.all(np.diag(covariance) > 0) else np.repeat(1.0 / n_assets, n_assets),
    ]
    best = None
    for start in starts:
        result = minimize(objective, x0=start, method="SLSQP", bounds=bounds, constraints=constraints)
        if not result.success:
            continue
        if best is None or result.fun < best.fun:
            best = result
    if best is None:
        raise RuntimeError("Factor Sharpe optimizer failed.")
    return np.asarray(best.x, dtype=float)


def solve_sharpe_from_mean_cov(mean_vector: np.ndarray, covariance: np.ndarray) -> np.ndarray:
    n_assets = len(mean_vector)

    def objective(weights: np.ndarray) -> float:
        port_return = float(weights @ mean_vector)
        port_var = float(weights @ covariance @ weights)
        port_vol = math.sqrt(max(port_var, 1e-12))
        return -(port_return / port_vol)

    constraints = [{"type": "eq", "fun": lambda weights: float(np.sum(weights) - 1.0)}]
    bounds = [(0.0, 1.0) for _ in range(n_assets)]
    starts = [
        np.repeat(1.0 / n_assets, n_assets),
        np.eye(n_assets)[int(np.argmax(mean_vector))],
        (1.0 / np.sqrt(np.clip(np.diag(covariance), 1e-12, None))),
    ]
    starts[-1] = starts[-1] / starts[-1].sum()
    best = None
    for start in starts:
        result = minimize(objective, x0=start, method="SLSQP", bounds=bounds, constraints=constraints)
        if not result.success:
            continue
        if best is None or result.fun < best.fun:
            best = result
    if best is None:
        raise RuntimeError("Sharpe optimizer failed.")
    return np.asarray(best.x, dtype=float)


def scale_to_target_vol(returns: pd.Series, target_vol: float, periods_per_year: int) -> tuple[pd.Series, float]:
    ann_vol = float(returns.std(ddof=0) * math.sqrt(periods_per_year))
    if ann_vol <= 1e-12:
        return returns.copy(), 0.0
    scale = target_vol / ann_vol
    return returns * scale, float(scale)


def rolling_top_fund_backtest(
    monthly_fund_returns: dict[str, pd.Series],
    *,
    target_vol: float = 0.16,
    lookback_months: int = 12,
    max_funds: int = 5,
) -> dict:
    panel = pd.concat(monthly_fund_returns, axis=1).sort_index()
    all_funds = list(panel.columns)
    realized_returns: list[tuple[pd.Timestamp, float]] = []
    weights_history: list[dict[str, object]] = []
    leverage_history: list[dict[str, object]] = []

    for row_index in range(lookback_months, len(panel)):
        date = panel.index[row_index]
        history = panel.iloc[row_index - lookback_months:row_index]
        current_row = panel.iloc[row_index]
        eligible = [
            fund for fund in all_funds
            if not pd.isna(current_row[fund]) and history[fund].notna().sum() == lookback_months
        ]
        if len(eligible) < 2:
            continue

        train = history[eligible]
        mean_vector = train.mean().values.astype(float)
        covariance = train.cov(ddof=0).values.astype(float)
        full_weights = solve_sharpe_from_mean_cov(mean_vector, covariance)
        top_positions = np.argsort(full_weights)[::-1][:max_funds]
        selected_funds = [eligible[index] for index in top_positions if full_weights[index] > 1e-8]
        if not selected_funds:
            continue

        restricted_train = train[selected_funds]
        restricted_mean = restricted_train.mean().values.astype(float)
        restricted_cov = restricted_train.cov(ddof=0).values.astype(float)
        restricted_weights = solve_sharpe_from_mean_cov(restricted_mean, restricted_cov)
        expected_monthly_vol = math.sqrt(max(float(restricted_weights @ restricted_cov @ restricted_weights), 1e-12))
        leverage = target_vol / max(expected_monthly_vol * math.sqrt(12), 1e-12)
        realized = float(current_row[selected_funds] @ restricted_weights) * leverage
        realized_returns.append((date, realized))

        weight_row = {"date": date.strftime("%Y-%m-%d"), "leverage": float(leverage)}
        for fund in all_funds:
            weight_row[fund] = 0.0
        for fund, weight in zip(selected_funds, restricted_weights):
            weight_row[fund] = float(weight)
        weights_history.append(weight_row)
        leverage_history.append({"date": date.strftime("%Y-%m-%d"), "leverage": float(leverage), "active_funds": selected_funds})

    returns_series = pd.Series({date: value for date, value in realized_returns}, dtype="float64").sort_index()
    latest_weights = weights_history[-1] if weights_history else {}
    latest_date = latest_weights.get("date")
    latest_active = sorted(
        [(fund, float(latest_weights[fund])) for fund in all_funds if fund in latest_weights and float(latest_weights[fund]) > 1e-8],
        key=lambda item: item[1],
        reverse=True,
    )

    return {
        "window_start": None if returns_series.empty else returns_series.index.min().strftime("%Y-%m-%d"),
        "window_end": None if returns_series.empty else returns_series.index.max().strftime("%Y-%m-%d"),
        "monthly_observations": int(len(returns_series)),
        "lookback_months": lookback_months,
        "max_funds": max_funds,
        "target_annualized_vol": target_vol,
        "annualized_return": annualized_return_from_series(returns_series, 12),
        "annualized_vol": float(returns_series.std(ddof=0) * math.sqrt(12)) if not returns_series.empty else 0.0,
        "max_drawdown": max_drawdown_from_returns(returns_series),
        "average_leverage": float(np.mean([row["leverage"] for row in leverage_history])) if leverage_history else 0.0,
        "latest_rebalance_date": latest_date,
        "latest_active_funds": [{"ticker": fund, "weight": weight} for fund, weight in latest_active],
        "dates": [point.strftime("%Y-%m-%d") for point in returns_series.index],
        "series": ((1.0 + returns_series).cumprod() * 100.0).tolist(),
        "weights_history": weights_history,
        "leverage_history": leverage_history,
        "note": "Monthly rebalanced long-only fund portfolio. Each month it looks back 12 months, keeps only the five highest-weight funds from the Sharpe optimizer, reruns on that subset, and then scales to a 16% ex-ante annualized volatility target.",
    }


def enrich_macro_and_beta_with_factor_view(macro: dict, beta: dict) -> tuple[dict, dict]:
    sleeve_returns = pd.read_csv(MACRO_RETURNS_CSV_PATH, index_col="date", parse_dates=True)[macro["selected_order"]]
    common_sleeve_returns = sleeve_returns.dropna()
    pca_components = macro["pca"]["components"]
    selected_factor_count = macro["pca"]["factor_erc"]["selected_factor_count"]
    selected_components = pca_components[:selected_factor_count]
    factor_names = [f"{component['code']} {component['economic_label']}" for component in selected_components]
    loading_matrix = np.column_stack([
        np.array([component["loadings"][label] for label in macro["selected_order"]], dtype=float)
        for component in selected_components
    ])
    factor_returns_frame = pd.DataFrame(
        common_sleeve_returns.values @ loading_matrix,
        index=common_sleeve_returns.index,
        columns=factor_names,
    )

    best_weights = solve_sharpe_portfolio(factor_returns_frame)
    equal_weights = np.repeat(1.0 / selected_factor_count, selected_factor_count)
    best_raw = factor_returns_frame @ pd.Series(best_weights, index=factor_names)
    equal_raw = factor_returns_frame @ pd.Series(equal_weights, index=factor_names)
    best_scaled, best_scale = scale_to_target_vol(best_raw, 0.16, 12)
    equal_scaled, equal_scale = scale_to_target_vol(equal_raw, 0.16, 12)

    macro["factor_backtests"] = {
        "window_start": factor_returns_frame.index.min().strftime("%Y-%m-%d"),
        "window_end": factor_returns_frame.index.max().strftime("%Y-%m-%d"),
        "monthly_observations": int(len(factor_returns_frame)),
        "target_annualized_vol": 0.16,
        "factor_names": factor_names,
        "dates": [point.strftime("%Y-%m-%d") for point in factor_returns_frame.index],
        "series": {
            "Best hindsight Sharpe @ 16% vol": ((1.0 + best_scaled).cumprod() * 100.0).tolist(),
            "Equal weight across factors @ 16% vol": ((1.0 + equal_scaled).cumprod() * 100.0).tolist(),
        },
        "portfolios": {
            "Best hindsight Sharpe @ 16% vol": {
                "weights": {factor_names[index]: float(best_weights[index]) for index in range(selected_factor_count)},
                "scale_to_16_vol": best_scale,
                "annualized_return": annualized_return_from_series(best_scaled, 12),
                "annualized_vol": float(best_scaled.std(ddof=0) * math.sqrt(12)),
                "max_drawdown": max_drawdown_from_returns(best_scaled),
                "note": "Ex-post optimizer on the factor return history. Useful as an upper bound, not as a realistic allocation rule.",
            },
            "Equal weight across factors @ 16% vol": {
                "weights": {factor_names[index]: float(equal_weights[index]) for index in range(selected_factor_count)},
                "scale_to_16_vol": equal_scale,
                "annualized_return": annualized_return_from_series(equal_scaled, 12),
                "annualized_vol": float(equal_scaled.std(ddof=0) * math.sqrt(12)),
                "max_drawdown": max_drawdown_from_returns(equal_scaled),
                "note": "Naive equal-weight portfolio across the first six principal factors, then levered or de-levered to the same 16% annualized volatility target.",
            },
        },
    }

    if beta.get("mode") == "unavailable":
        return macro, beta

    manifest_rows = load_beta_manifest_rows(BETA_FUND_MANIFEST_PATH)
    session = beta_rose_session(ROSE_API_URL, BETA_ROSE_USER, BETA_ROSE_PASS)
    sleeve_monthly = sleeve_returns.copy()
    spy_monthly = sleeve_monthly["U.S. Equities"]
    fund_name_by_ticker = {str(row["ticker"]): str(row["fund_name"]) for row in manifest_rows}

    factor_vectors = {
        component["code"]: np.array([component["loadings"][label] for label in macro["selected_order"]], dtype=float)
        for component in selected_components
    }

    fund_factor_rows: list[dict] = []
    diversification_rows: list[dict] = []
    monthly_fund_map: dict[str, pd.Series] = {}
    for row in manifest_rows:
        ticker = str(row["ticker"])
        daily_returns = pull_returns_with_fallback(
            session,
            ROSE_API_URL,
            returns_code=str(row["returns_code"]),
            base_code=str(row["series_code"]),
        )
        monthly_fund = monthly_returns_from_daily(daily_returns).dropna()
        monthly_fund_map[ticker] = monthly_fund
        sleeve_correlations = []
        sleeve_corr_map: dict[str, float] = {}
        for sleeve in macro["selected_order"]:
            corr_value, _ = pairwise_corr(monthly_fund, sleeve_monthly[sleeve])
            corr = 0.0 if pd.isna(corr_value) else float(corr_value)
            sleeve_correlations.append(corr)
            sleeve_corr_map[sleeve] = corr

        fund_vector = np.array(sleeve_correlations, dtype=float)
        factor_scores = {code: cosine_similarity(fund_vector, vector) for code, vector in factor_vectors.items()}
        absolute_scores = np.array([abs(factor_scores[component["code"]]) for component in selected_components], dtype=float)
        if absolute_scores.sum() > 0:
            factor_shares = absolute_scores / absolute_scores.sum()
        else:
            factor_shares = np.repeat(1.0 / selected_factor_count, selected_factor_count)
        balanced_score = 1.0 - float(np.sum(np.abs(factor_shares - (1.0 / selected_factor_count)))) / (2.0 * (1.0 - 1.0 / selected_factor_count))
        dominant_component = selected_components[int(np.argmax(absolute_scores))]

        fund_factor_rows.append(
            {
                "ticker": ticker,
                "fund_name": str(row["fund_name"]),
                "fee_percent": parse_fee_percent(str(row["fee"])),
                "dominant_factor": f"{dominant_component['code']} {dominant_component['economic_label']}",
                "balanced_factor_score": balanced_score,
                "factor_similarity": {
                    f"{component['code']} {component['economic_label']}": float(factor_scores[component["code"]])
                    for component in selected_components
                },
                "factor_share": {
                    f"{component['code']} {component['economic_label']}": float(factor_shares[index])
                    for index, component in enumerate(selected_components)
                },
                "sleeve_correlations": sleeve_corr_map,
            }
        )

        frame = pd.concat([spy_monthly.rename("SPY"), monthly_fund.rename(ticker)], axis=1, join="inner").dropna()
        if len(frame) >= 24:
            covariance = frame.cov(ddof=0).values.astype(float)
            det = covariance[0, 0] + covariance[1, 1] - 2.0 * covariance[0, 1]
            if abs(det) > 1e-12:
                raw_weight = float((covariance[1, 1] - covariance[0, 1]) / det)
                fund_weight = min(max(1.0 - raw_weight, 0.0), 1.0)
                spy_weight = 1.0 - fund_weight
            else:
                spy_weight, fund_weight = 0.5, 0.5
            blend = frame["SPY"] * spy_weight + frame[ticker] * fund_weight
            vol_reduction = float(frame["SPY"].std(ddof=0) * math.sqrt(12) - blend.std(ddof=0) * math.sqrt(12))
            fee_percent = parse_fee_percent(str(row["fee"]))
            diversification_rows.append(
                {
                    "ticker": ticker,
                    "fund_name": str(row["fund_name"]),
                    "fee_percent": fee_percent,
                    "spy_weight": float(spy_weight),
                    "fund_weight": float(fund_weight),
                    "overlap_months": int(len(frame)),
                    "spy_correlation": float(frame["SPY"].corr(frame[ticker])) if len(frame) >= 2 else float("nan"),
                    "vol_reduction_bps": vol_reduction * 10000.0,
                    "diversification_per_fee": None if not fee_percent or fee_percent <= 0 else float((vol_reduction * 10000.0) / (fee_percent * 100.0)),
                }
            )

    fund_factor_rows.sort(key=lambda row: row["balanced_factor_score"], reverse=True)
    raw_rank_rows = sorted(diversification_rows, key=lambda row: row["vol_reduction_bps"], reverse=True)
    fee_rank_rows = sorted(
        diversification_rows,
        key=lambda row: (float("-inf") if row["diversification_per_fee"] is None else row["diversification_per_fee"]),
        reverse=True,
    )
    dynamic_top5 = rolling_top_fund_backtest(
        monthly_fund_map,
        target_vol=0.16,
        lookback_months=12,
        max_funds=5,
    )
    dynamic_top5["latest_active_funds"] = [
        {
            "ticker": row["ticker"],
            "fund_name": fund_name_by_ticker.get(row["ticker"], row["ticker"]),
            "weight": row["weight"],
        }
        for row in dynamic_top5["latest_active_funds"]
    ]

    beta["fund_factor_view"] = {
        "factor_order": factor_names,
        "rows": fund_factor_rows,
        "best_balanced_fund": fund_factor_rows[0] if fund_factor_rows else None,
        "most_diversifying_to_spy": raw_rank_rows[0] if raw_rank_rows else None,
        "best_fee_efficient_diversifier": next((row for row in fee_rank_rows if row["diversification_per_fee"] is not None), None),
        "raw_diversification_rankings": raw_rank_rows,
        "fee_rankings": fee_rank_rows,
    }
    beta["dynamic_fund_backtest"] = dynamic_top5
    return macro, beta


def write_analysis_files(analysis: dict) -> None:
    ANALYSIS_JSON_PATH.write_text(json.dumps(analysis, indent=2), encoding="utf-8")
    ANALYSIS_JS_PATH.write_text(
        "window.ALL_BETA_ANALYSIS = " + json.dumps(analysis, indent=2) + ";\n",
        encoding="utf-8",
    )


def plot_equity_absolute(equity: dict) -> Path:
    n_values = np.array(equity["n"])
    sigma = equity["assumptions"]["single_stock_vol"]
    historical_rho = equity["assumptions"]["average_pairwise_correlation"]
    scenarios = [
        {"rho": 0.5, "label": "rho = 0.5", "color": COLORS["rose"], "linestyle": "--", "linewidth": 2.0},
        {"rho": historical_rho, "label": f"historical average (rho = {historical_rho:.1f})", "color": COLORS["sea"], "linestyle": "-", "linewidth": 3.8},
        {"rho": 0.2, "label": "rho = 0.2", "color": COLORS["mint"], "linestyle": "--", "linewidth": 2.0},
        {"rho": 0.1, "label": "rho = 0.1", "color": COLORS["amber"], "linestyle": "--", "linewidth": 2.0},
    ]

    def curve(rho: float) -> np.ndarray:
        return sigma * np.sqrt(rho + (1.0 - rho) / n_values) * 100.0

    def n_for_threshold(rho: float, threshold: float = 0.90) -> int:
        start = sigma
        asymptote = sigma * math.sqrt(rho)
        for n_value in n_values:
            current = sigma * math.sqrt(rho + (1.0 - rho) / n_value)
            captured = (start - current) / max(start - asymptote, 1e-12)
            if captured >= threshold:
                return int(n_value)
        return int(n_values[-1])

    all_vols = np.concatenate([curve(scenario["rho"]) for scenario in scenarios])

    fig, ax = plt.subplots(figsize=(11, 6.5), dpi=160)
    fig.patch.set_facecolor(COLORS["paper"])
    ax.set_facecolor("white")

    for scenario in scenarios:
        vols = curve(scenario["rho"])
        ax.plot(
            n_values,
            vols,
            color=scenario["color"],
            linewidth=scenario["linewidth"],
            linestyle=scenario["linestyle"],
            label=scenario["label"],
        )
        threshold_n = n_for_threshold(scenario["rho"], 0.90)
        ax.axvline(
            threshold_n,
            color=scenario["color"],
            linestyle="--" if scenario["rho"] != historical_rho else "-",
            linewidth=1.6 if scenario["rho"] == historical_rho else 1.1,
            alpha=0.8,
        )
        y_text = max(min(vols.max() - 1.0 - scenarios.index(scenario) * 0.6, all_vols.max() - 0.8), all_vols.min() + 0.8)
        ax.text(threshold_n + 1.5, y_text, f"N={threshold_n}", color=scenario["color"], fontsize=9, weight="bold" if scenario["rho"] == historical_rho else None)

    ax.set_title("Stage 1: Absolute Volatility vs Stock Count Across Correlation Regimes", fontsize=16, color=COLORS["ink"], pad=14)
    ax.set_xlabel("Number of stocks")
    ax.set_ylabel("Annualized portfolio volatility (%)")
    ax.set_ylim(max(0, all_vols.min() - 0.8), all_vols.max() + 0.8)
    ax.legend(frameon=False, loc="upper right")
    ax.text(
        0.015,
        0.03,
        "Vertical markers show where each curve reaches 90% of available diversification benefit. The thicker blue line uses the historical-average correlation assumption.",
        transform=ax.transAxes,
        fontsize=9.5,
        color=COLORS["stone"],
    )

    path = CHART_DIR / "equity_absolute.png"
    fig.tight_layout()
    fig.savefig(path, bbox_inches="tight")
    plt.close(fig)
    return path


def plot_equity_marginal(equity: dict) -> Path:
    n_values = np.array(equity["n"])
    marginal = np.array([np.nan if value is None else value for value in equity["marginal_reduction"]]) * 10000.0

    fig, ax = plt.subplots(figsize=(11, 6.5), dpi=160)
    fig.patch.set_facecolor(COLORS["paper"])
    ax.set_facecolor("white")
    ax.plot(n_values[1:], marginal[1:], color=COLORS["amber"], linewidth=2.3)
    ax.axhline(10, color=COLORS["rose"], linestyle="--", linewidth=1.3, label="10 bps cutoff")
    ax.axhline(5, color=COLORS["mint"], linestyle="--", linewidth=1.3, label="5 bps cutoff")
    ax.set_yscale("log")
    ax.set_title("Stage 1: Marginal Benefit of the Next Stock", fontsize=16, color=COLORS["ink"], pad=14)
    ax.set_xlabel("Nth stock added to the basket")
    ax.set_ylabel("Marginal volatility reduction (bps, log scale)")
    ax.legend(frameon=False, loc="upper right")
    ax.text(
        0.015,
        0.03,
        "The curve falls quickly because only the idiosyncratic term shrinks with N; the beta floor remains.",
        transform=ax.transAxes,
        fontsize=9.5,
        color=COLORS["stone"],
    )

    path = CHART_DIR / "equity_marginal.png"
    fig.tight_layout()
    fig.savefig(path, bbox_inches="tight")
    plt.close(fig)
    return path


def plot_macro_absolute(macro: dict) -> Path:
    steps = macro["steps"]
    x_values = np.arange(1, len(steps) + 1)
    ann_vol = np.array([step["ann_vol"] for step in steps]) * 100.0
    labels = [step["added_factor"] for step in steps]

    fig, ax = plt.subplots(figsize=(11, 6.5), dpi=160)
    fig.patch.set_facecolor(COLORS["paper"])
    ax.set_facecolor("white")
    ax.plot(x_values, ann_vol, color=COLORS["sea"], linewidth=2.5, marker="o", markersize=7)
    for x_value, y_value, label in zip(x_values, ann_vol, labels):
        short_label = "Equities" if label == "U.S. Equities" else f"+ {label}"
        ax.annotate(short_label, (x_value, y_value), textcoords="offset points", xytext=(0, 10), ha="center", fontsize=9)

    ax.set_xticks(x_values)
    ax.set_title("Stage 2: All Weather Core Plus Cross-Asset Extensions", fontsize=16, color=COLORS["ink"], pad=14)
    ax.set_xlabel("Cumulative sleeve-addition step")
    ax.set_ylabel("Annualized portfolio volatility per unit capital (%)")
    subtitle = "Live Rose proxies, equal risk contribution weights" if macro["mode"] == "rose_proxies" else "Fallback equal-risk-contribution model"
    ax.text(0.015, 0.03, subtitle, transform=ax.transAxes, fontsize=9.5, color=COLORS["stone"])

    path = CHART_DIR / "macro_absolute.png"
    fig.tight_layout()
    fig.savefig(path, bbox_inches="tight")
    plt.close(fig)
    return path


def plot_macro_marginal(macro: dict) -> Path:
    steps = macro["steps"][1:]
    x_values = np.arange(2, len(steps) + 2)
    marginal = np.array([step["marginal_reduction"] for step in steps], dtype=float) * 10000.0
    labels = [step["added_factor"] for step in steps]

    fig, ax = plt.subplots(figsize=(11, 6.5), dpi=160)
    fig.patch.set_facecolor(COLORS["paper"])
    ax.set_facecolor("white")
    colors = [COLORS["amber"] if value >= 0 else COLORS["rose"] for value in marginal]
    bars = ax.bar(x_values, marginal, color=colors, width=0.65)
    for bar, label, value in zip(bars, labels, marginal):
        y_offset = 8 if value >= 0 else -16
        ax.annotate(label, (bar.get_x() + bar.get_width() / 2.0, value), textcoords="offset points", xytext=(0, y_offset), ha="center", fontsize=9)

    ax.set_xticks(x_values)
    ax.axhline(0.0, color=COLORS["stone"], linewidth=1.0)
    ax.set_title("Stage 2: Volatility Reduction From The Next Sleeve", fontsize=16, color=COLORS["ink"], pad=14)
    ax.set_xlabel("Factor-addition step")
    ax.set_ylabel("Change in annualized portfolio vol (bps)")
    ax.text(
        0.015,
        0.03,
        "Positive bars mean the next sleeve lowered total portfolio volatility from the prior step. Negative bars mean it raised vol slightly in this sequence.",
        transform=ax.transAxes,
        fontsize=9.5,
        color=COLORS["stone"],
    )

    path = CHART_DIR / "macro_marginal.png"
    fig.tight_layout()
    fig.savefig(path, bbox_inches="tight")
    plt.close(fig)
    return path


def plot_macro_correlation(macro: dict) -> Path:
    labels = macro["selected_order"]
    corr = pd.DataFrame(macro["correlation_matrix"]).loc[labels, labels]

    fig, ax = plt.subplots(figsize=(8.5, 7.5), dpi=160)
    fig.patch.set_facecolor(COLORS["paper"])
    im = ax.imshow(corr.values, cmap="RdBu_r", vmin=-1, vmax=1)
    ax.set_xticks(np.arange(len(labels)))
    ax.set_yticks(np.arange(len(labels)))
    ax.set_xticklabels(labels, rotation=35, ha="right")
    ax.set_yticklabels(labels)

    for row in range(len(labels)):
        for column in range(len(labels)):
            ax.text(column, row, f"{corr.iloc[row, column]:.2f}", ha="center", va="center", fontsize=9, color="black")

    ax.set_title("Macro Proxy Correlations", fontsize=15, color=COLORS["ink"], pad=14)
    cbar = fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    cbar.ax.set_ylabel("Correlation", rotation=90)

    path = CHART_DIR / "macro_correlation.png"
    fig.tight_layout()
    fig.savefig(path, bbox_inches="tight")
    plt.close(fig)
    return path


def plot_macro_scree(macro: dict) -> Path:
    pca = macro["pca"]
    explained = np.array(pca["explained_variance_ratio"]) * 100.0
    cumulative = np.array(pca["cumulative_explained_variance_ratio"]) * 100.0
    components = np.arange(1, len(explained) + 1)

    fig, ax = plt.subplots(figsize=(11, 6.5), dpi=160)
    fig.patch.set_facecolor(COLORS["paper"])
    ax.set_facecolor("white")
    ax.bar(components, explained, color=COLORS["sea"], alpha=0.85, label="Explained variance")
    ax.plot(components, cumulative, color=COLORS["amber"], linewidth=2.5, marker="o", label="Cumulative")
    ax.axhline(90.0, color=COLORS["stone"], linestyle="--", linewidth=1.2)
    ax.axhline(95.0, color=COLORS["rose"], linestyle="--", linewidth=1.2)
    ax.axvline(pca["factors_for_95pct_variance"], color=COLORS["rose"], linestyle=":", linewidth=1.2)
    ax.set_xticks(components)
    ax.set_xlabel("Principal component")
    ax.set_ylabel("Variance explained (%)")
    ax.set_title("Stage 2: Covariance PCA Scree Plot", fontsize=16, color=COLORS["ink"], pad=14)
    ax.legend(frameon=False, loc="upper right")
    ax.text(
        0.015,
        0.03,
        f"Five factors explain {cumulative[4]:.1f}% of sleeve variance; six explain {cumulative[5]:.1f}%. That is the factor map hiding inside the 12 sleeves.",
        transform=ax.transAxes,
        fontsize=9.5,
        color=COLORS["stone"],
    )

    path = CHART_DIR / "macro_scree.png"
    fig.tight_layout()
    fig.savefig(path, bbox_inches="tight")
    plt.close(fig)
    return path


def plot_macro_loadings(macro: dict) -> Path:
    pca = macro["pca"]
    component_count = min(7, len(pca["components"]))
    sleeves = macro["selected_order"]
    row_labels = [f"{component['code']} {component['economic_label']}" for component in pca["components"][:component_count]]
    matrix = np.array(
        [[pca["components"][row]["loadings"][sleeve] for sleeve in sleeves] for row in range(component_count)],
        dtype=float,
    )

    fig, ax = plt.subplots(figsize=(12, 5.8), dpi=160)
    fig.patch.set_facecolor(COLORS["paper"])
    vmax = float(np.max(np.abs(matrix))) if matrix.size else 1.0
    im = ax.imshow(matrix, cmap="RdBu_r", vmin=-vmax, vmax=vmax, aspect="auto")
    ax.set_xticks(np.arange(len(sleeves)))
    ax.set_xticklabels(sleeves, rotation=35, ha="right")
    ax.set_yticks(np.arange(component_count))
    ax.set_yticklabels(row_labels)

    for row in range(component_count):
        for col in range(len(sleeves)):
            ax.text(col, row, f"{matrix[row, col]:.2f}", ha="center", va="center", fontsize=7.5, color="black")

    ax.set_title("Stage 2: First Seven Principal Components And Sleeve Loadings", fontsize=16, color=COLORS["ink"], pad=14)
    cbar = fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    cbar.ax.set_ylabel("Loading", rotation=90)

    path = CHART_DIR / "macro_factor_loadings.png"
    fig.tight_layout()
    fig.savefig(path, bbox_inches="tight")
    plt.close(fig)
    return path


def plot_macro_factor_risk(macro: dict) -> Path:
    factor_erc = macro["pca"]["factor_erc"]
    labels = factor_erc["factor_labels"]
    risk = np.array([factor_erc["risk_contributions"][label] for label in labels]) * 100.0
    variance = np.array([factor_erc["variance_share"][label] for label in labels]) * 100.0
    positions = np.arange(len(labels))

    fig, ax = plt.subplots(figsize=(11, 6.5), dpi=160)
    fig.patch.set_facecolor(COLORS["paper"])
    ax.set_facecolor("white")
    ax.bar(positions - 0.18, variance, width=0.36, color=COLORS["stone"], alpha=0.45, label="Raw variance share")
    ax.bar(positions + 0.18, risk, width=0.36, color=COLORS["amber"], alpha=0.92, label="Factor ERC risk share")
    ax.set_xticks(positions)
    ax.set_xticklabels(labels, rotation=20, ha="right")
    ax.set_ylabel("Share of total risk (%)")
    ax.set_title("Stage 2: Equal Risk Contribution Across The Principal Factors", fontsize=16, color=COLORS["ink"], pad=14)
    ax.legend(frameon=False, loc="upper right")
    ax.text(
        0.015,
        0.03,
        "PC1 dominates raw sleeve variance, but factor ERC budgets risk across the latent drivers instead of letting growth beta absorb the whole portfolio.",
        transform=ax.transAxes,
        fontsize=9.5,
        color=COLORS["stone"],
    )

    path = CHART_DIR / "macro_factor_risk.png"
    fig.tight_layout()
    fig.savefig(path, bbox_inches="tight")
    plt.close(fig)
    return path


def plot_macro_factor_backtest(macro: dict) -> Path:
    backtests = macro["factor_backtests"]
    dates = pd.to_datetime(backtests["dates"])
    series_map = backtests["series"]

    fig, ax = plt.subplots(figsize=(11, 6.5), dpi=160)
    fig.patch.set_facecolor(COLORS["paper"])
    ax.set_facecolor("white")
    color_map = {
        "Best hindsight Sharpe @ 16% vol": COLORS["rose"],
        "Equal weight across factors @ 16% vol": COLORS["sea"],
    }

    for label, values in series_map.items():
        ax.plot(dates, values, linewidth=2.5, label=label, color=color_map[label])

    ax.set_title("Stage 2: 16% Vol-Targeted Factor Portfolios", fontsize=16, color=COLORS["ink"], pad=14)
    ax.set_ylabel("Index level")
    ax.legend(frameon=False, loc="upper left")
    ax.text(
        0.015,
        0.03,
        f"Backtest window: {backtests['window_start']} to {backtests['window_end']}. The red line is an ex-post upper bound; the blue line is the naive equal-factor benchmark.",
        transform=ax.transAxes,
        fontsize=9.5,
        color=COLORS["stone"],
    )

    path = CHART_DIR / "macro_factor_backtest.png"
    fig.tight_layout()
    fig.savefig(path, bbox_inches="tight")
    plt.close(fig)
    return path


def plot_beta_correlation(beta: dict) -> Path | None:
    if beta.get("mode") == "unavailable":
        return None

    fund_order = beta["fund_order"]
    benchmark_order = beta["benchmark_order"]
    corr = pd.DataFrame(beta["correlation_matrix"]).T.loc[fund_order, benchmark_order]

    fig, ax = plt.subplots(figsize=(9.5, 10.5), dpi=160)
    fig.patch.set_facecolor(COLORS["paper"])
    im = ax.imshow(corr.values, cmap="RdBu_r", vmin=-1, vmax=1, aspect="auto")
    ax.set_xticks(np.arange(len(benchmark_order)))
    ax.set_xticklabels(benchmark_order)
    ax.set_yticks(np.arange(len(fund_order)))
    ax.set_yticklabels(fund_order)

    for row in range(len(fund_order)):
        for col in range(len(benchmark_order)):
            value = corr.iloc[row, col]
            ax.text(col, row, "n/a" if pd.isna(value) else f"{value:.2f}", ha="center", va="center", fontsize=8)

    ax.set_title("Beta Funds vs Core Beta Sleeves: Pairwise Daily Return Correlations", fontsize=15, color=COLORS["ink"], pad=14)
    ax.set_xlabel("Benchmark sleeve")
    ax.set_ylabel("Beta fund ticker")
    cbar = fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    cbar.ax.set_ylabel("Correlation", rotation=90)
    ax.text(
        0.0,
        -0.08,
        beta["correlation_window_note"],
        transform=ax.transAxes,
        fontsize=9.5,
        color=COLORS["stone"],
    )

    path = CHART_DIR / "beta_fund_benchmark_correlation.png"
    fig.tight_layout()
    fig.savefig(path, bbox_inches="tight")
    plt.close(fig)
    return path


def plot_beta_factor_affinity(beta: dict) -> Path | None:
    if beta.get("mode") == "unavailable" or "fund_factor_view" not in beta:
        return None

    factor_view = beta["fund_factor_view"]
    rows = factor_view["rows"]
    factors = factor_view["factor_order"]
    matrix = np.array([[row["factor_similarity"][factor] for factor in factors] for row in rows], dtype=float)

    fig_height = max(7.0, len(rows) * 0.35)
    fig, ax = plt.subplots(figsize=(11.5, fig_height), dpi=160)
    fig.patch.set_facecolor(COLORS["paper"])
    im = ax.imshow(matrix, cmap="RdBu_r", vmin=-1, vmax=1, aspect="auto")
    ax.set_xticks(np.arange(len(factors)))
    ax.set_xticklabels(factors, rotation=25, ha="right")
    ax.set_yticks(np.arange(len(rows)))
    ax.set_yticklabels([row["ticker"] for row in rows])

    for row_index in range(len(rows)):
        for col_index in range(len(factors)):
            ax.text(col_index, row_index, f"{matrix[row_index, col_index]:.2f}", ha="center", va="center", fontsize=7.5)

    ax.set_title("Beta Funds vs Macro Principal Factors", fontsize=15, color=COLORS["ink"], pad=14)
    ax.set_xlabel("Principal factor")
    ax.set_ylabel("Fund ticker")
    cbar = fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    cbar.ax.set_ylabel("Similarity to factor-loading vector", rotation=90)
    ax.text(
        0.0,
        -0.06,
        "Each cell is a cosine similarity between the fund's sleeve-correlation fingerprint and the PCA loading vector for that factor.",
        transform=ax.transAxes,
        fontsize=9.5,
        color=COLORS["stone"],
    )

    path = CHART_DIR / "beta_fund_factor_affinity.png"
    fig.tight_layout()
    fig.savefig(path, bbox_inches="tight")
    plt.close(fig)
    return path


def plot_beta_weights(beta: dict) -> Path | None:
    if beta.get("mode") == "unavailable":
        return None

    optimization = beta["optimization"]
    rows = optimization["display_asset_rows"]
    portfolio_columns = optimization["portfolio_columns"]
    matrix = np.array(
        [[row[spec["weight_column"]] for spec in portfolio_columns] for row in rows],
        dtype=float,
    )
    row_labels = [row["asset_label"] for row in rows]
    col_labels = [spec["label"] for spec in portfolio_columns]

    fig_height = max(5.5, len(row_labels) * 0.42)
    fig, ax = plt.subplots(figsize=(11, fig_height), dpi=160)
    fig.patch.set_facecolor(COLORS["paper"])
    im = ax.imshow(matrix, aspect="auto", cmap="YlOrBr", vmin=0.0, vmax=max(0.01, float(matrix.max())))
    ax.set_xticks(np.arange(len(col_labels)))
    ax.set_xticklabels(col_labels, rotation=18, ha="right")
    ax.set_yticks(np.arange(len(row_labels)))
    ax.set_yticklabels(row_labels)
    for row_index in range(len(row_labels)):
        for col_index in range(len(col_labels)):
            value = matrix[row_index, col_index]
            ax.text(col_index, row_index, f"{value:.2f}", ha="center", va="center", fontsize=8, color=COLORS["ink"])
    ax.set_title("Portfolio Weight Matrix", fontsize=15, color=COLORS["ink"], pad=14)
    ax.set_xlabel("Portfolio column")
    ax.set_ylabel("Asset row")
    ax.text(
        0.015,
        0.03,
        "Objective: max DR(w) = (w' sigma) / sqrt(w' Sigma w). Risk model: pairwise-overlap daily covariance, then PSD stabilization. Constraints: w_i >= 0 and sum w_i = gross budget.",
        transform=ax.transAxes,
        fontsize=9.5,
        color=COLORS["stone"],
    )
    cbar = fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    cbar.ax.set_ylabel("Weight", rotation=90)

    path = CHART_DIR / "beta_optimized_weights.png"
    fig.tight_layout()
    fig.savefig(path, bbox_inches="tight")
    plt.close(fig)
    return path


def plot_beta_growth(beta: dict) -> Path | None:
    if beta.get("mode") == "unavailable":
        return None

    optimization = beta["optimization"]
    dates = pd.to_datetime(optimization["accessible_growth_chart"]["dates"])
    series_map = optimization["accessible_growth_chart"]["series"]

    fig, ax = plt.subplots(figsize=(11, 6.5), dpi=160)
    fig.patch.set_facecolor(COLORS["paper"])
    ax.set_facecolor("white")
    color_map = {
        "SPY baseline": COLORS["ink"],
        "Constructed benchmark 1x": COLORS["sea"],
        "Constructed benchmark 2x": "#5b8fb9",
        "Constructed benchmark 3x": COLORS["amber"],
        "Retirement-cap optimizer": "#7b6d8d",
        "SPY + funds optimizer": COLORS["mint"],
        "Funds-only optimizer": COLORS["rose"],
    }

    for label, values in series_map.items():
        ax.plot(dates, values, linewidth=2.5, label=label, color=color_map[label])

    ax.set_title("Constructed Sleeves vs Accessible Alternatives", fontsize=15, color=COLORS["ink"], pad=14)
    ax.set_ylabel("Index level")
    ax.legend(frameon=False, loc="upper left")
    ax.text(
        0.015,
        0.03,
        f"Common window: {optimization['accessible_growth_chart']['start_date']} to {optimization['accessible_growth_chart']['end_date']}. Objective: maximize diversification ratio, not chase in-sample returns.",
        transform=ax.transAxes,
        fontsize=9.5,
        color=COLORS["stone"],
    )

    path = CHART_DIR / "beta_accessible_growth.png"
    fig.tight_layout()
    fig.savefig(path, bbox_inches="tight")
    plt.close(fig)
    return path


def plot_beta_flagship(beta: dict) -> Path | None:
    if beta.get("mode") == "unavailable":
        return None

    comparison = beta["optimization"]["flagship_comparison"]
    dates = pd.to_datetime(comparison["dates"])
    series_map = comparison["series"]

    fig, ax = plt.subplots(figsize=(11, 6.5), dpi=160)
    fig.patch.set_facecolor(COLORS["paper"])
    ax.set_facecolor("white")

    for label, values in series_map.items():
        ax.plot(dates, values, linewidth=2.5, label=label, color=CHART_COLORS.get(label, COLORS["stone"]))

    ax.set_title("Constructed Benchmark 3x vs Flagship Diversified Funds", fontsize=15, color=COLORS["ink"], pad=14)
    ax.set_ylabel("Index level")
    ax.legend(frameon=False, loc="upper left", ncol=2)
    ax.text(
        0.015,
        0.03,
        f"Short common window: {comparison['window_start']} to {comparison['window_end']}. ALLW is the youngest comparison fund and sets the overlap.",
        transform=ax.transAxes,
        fontsize=9.5,
        color=COLORS["stone"],
    )

    path = CHART_DIR / "beta_flagship_growth.png"
    fig.tight_layout()
    fig.savefig(path, bbox_inches="tight")
    plt.close(fig)
    return path


def build_summary_pdf(analysis: dict, chart_paths: list[Path]) -> None:
    equity = analysis["equity"]
    macro = analysis["macro"]
    beta = analysis.get("beta", {})
    with PdfPages(SUMMARY_PDF_PATH) as pdf:
        fig = plt.figure(figsize=(11, 8.5), dpi=160)
        fig.patch.set_facecolor(COLORS["paper"])
        summary_lines = [
            "Alpha, Beta, and the Geometry of Diversification",
            "",
            "Stage 1 - Within equities",
            f"Formula: {equity['formula']}",
            f"Equity beta floor: {equity['asymptote_vol'] * 100:.2f}%",
            f"90% of available diversification captured by about N={equity['n_for_90pct_of_available_diversification']}",
            f"5 bps marginal cutoff reached by about N={equity['marginal_threshold_hits'].get('5')}",
            "",
            "Stage 2 - Across macro sleeves",
            f"Mode: {macro['mode']}",
            f"Covariance method: {macro.get('covariance_method', 'n/a')}",
            f"Five factors explain {macro['pca']['cumulative_explained_variance_ratio'][4] * 100:.1f}% of sleeve variance",
            f"Six factors explain {macro['pca']['cumulative_explained_variance_ratio'][5] * 100:.1f}% of sleeve variance",
            f"Selected factor ERC count: {macro['pca']['factor_erc']['selected_factor_count']}",
            "",
            "Stage 3 - Beta fund basket and optimized beta portfolios",
        ]
        if beta.get("mode") != "unavailable":
            summary_lines.extend(
                [
                    f"Fund count: {beta['fund_count']}",
                    f"Accessible comparison window: {beta['optimization']['accessible_growth_chart']['start_date']} to {beta['optimization']['accessible_growth_chart']['end_date']}",
                    f"Flagship-fund overlap window: {beta['optimization']['flagship_comparison']['window_start']} to {beta['optimization']['flagship_comparison']['window_end']}",
                    f"Most SPY-like fund: {beta['most_spy_like']['ticker']}",
                    f"Most distinct fund: {beta['most_distinct']['ticker']}",
                    f"Closest to constructed 3x: {beta['closest_to_constructed_3x']['ticker']}",
                    f"Best factor-balanced fund: {beta['fund_factor_view']['best_balanced_fund']['ticker']}",
                    f"Most diversifying to SPY: {beta['fund_factor_view']['most_diversifying_to_spy']['ticker']}",
                    f"Best fee-efficient diversifier: {beta['fund_factor_view']['best_fee_efficient_diversifier']['ticker']}",
                    f"Rolling top-5 dynamic portfolio: {beta['dynamic_fund_backtest']['monthly_observations']} monthly observations, avg leverage {beta['dynamic_fund_backtest']['average_leverage']:.2f}x",
                    "",
                ]
            )
        else:
            summary_lines.extend(
                [
                    f"Beta section unavailable: {beta.get('warning', 'unknown error')}",
                    "",
                ]
            )
        summary_lines.extend(
            [
            "Research anchors",
            ]
        )
        for source in SOURCE_NOTES:
            summary_lines.append(f"- {source['title']}")

        fig.text(
            0.08,
            0.92,
            "\n".join(summary_lines),
            fontsize=13,
            color=COLORS["ink"],
            va="top",
            family="DejaVu Sans",
        )
        pdf.savefig(fig, bbox_inches="tight")
        plt.close(fig)

        for chart_path in chart_paths:
            fig = plt.figure(figsize=(11, 8.5), dpi=160)
            image = plt.imread(chart_path)
            plt.imshow(image)
            plt.axis("off")
            pdf.savefig(fig, bbox_inches="tight")
            plt.close(fig)


def build_analysis() -> dict:
    ensure_dirs()
    equity = compute_equity_analysis()
    macro = compute_macro_analysis()
    beta = compute_beta_analysis()
    macro, beta = enrich_macro_and_beta_with_factor_view(macro, beta)
    analysis = {
        "title": "Alpha, Beta, and the Geometry of Diversification",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "project_dir": str(PROJECT_DIR),
        "equity": equity,
        "macro": macro,
        "beta": beta,
        "sources": SOURCE_NOTES,
        "notes": [
            "Stage 1 is intentionally stylized: equal stock vol and fixed average pairwise correlation.",
            "Stage 2 now treats the 12 sleeves as raw observations and the principal components of their covariance matrix as the actual factor map.",
            "The factor ERC step budgets risk across latent factors rather than across sleeve labels, which is the same move All Weather makes from first principles.",
            "The Rose-backed macro stage is a proxy exercise, not a literal reconstruction of Bridgewater's implementation, but it now respects the leverage-friendly logic of risk budgeting.",
            "Stage 3 now stores portfolio constructions as weight columns on a single Rose asset map, then compares the constructed sleeve portfolios against both optimized fund-only alternatives and flagship diversified funds.",
        ],
    }

    write_analysis_files(analysis)
    chart_paths = [
        plot_equity_absolute(equity),
        plot_equity_marginal(equity),
        plot_macro_scree(macro),
        plot_macro_loadings(macro),
        plot_macro_factor_risk(macro),
        plot_macro_factor_backtest(macro),
    ]
    beta_chart_paths = [
        plot_beta_correlation(beta),
        plot_beta_factor_affinity(beta),
        plot_beta_weights(beta),
        plot_beta_growth(beta),
        plot_beta_flagship(beta),
    ]
    chart_paths.extend([path for path in beta_chart_paths if path is not None])
    build_summary_pdf(analysis, chart_paths)
    return analysis


if __name__ == "__main__":
    plt.style.use("seaborn-v0_8-whitegrid")
    result = build_analysis()
    print(f"Wrote {ANALYSIS_JSON_PATH.name}")
    print(f"Wrote {ANALYSIS_JS_PATH.name}")
    print(f"Wrote {SUMMARY_PDF_PATH.name}")
    if result["macro"]["mode"] == "rose_proxies":
        print(f"Wrote {MACRO_RETURNS_CSV_PATH.name}")
        print(f"Wrote {MACRO_CORR_CSV_PATH.name}")
