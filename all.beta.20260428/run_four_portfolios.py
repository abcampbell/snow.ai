"""Orchestrate the four-portfolio backtest, regime analysis, charts, and tables."""
from __future__ import annotations

import json
import math
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import yfinance as yf

from four_portfolios import (
    CAMPBELL_WEIGHTS,
    TRADING_DAYS,
    backtest,
    build_portfolios,
    leverage_capacity,
    load_all_returns,
    rose_session,
    SLEEVE_TICKERS,
    summary_stats,
)

PROJECT_DIR = Path(__file__).parent
TABLES_DIR = PROJECT_DIR / "tables"
CHARTS_DIR = PROJECT_DIR / "charts"
OUTPUT_JSON = PROJECT_DIR / "four_portfolios_analysis.json"

TABLES_DIR.mkdir(exist_ok=True)
CHARTS_DIR.mkdir(exist_ok=True)

PALETTE = {
    "AW-synthetic":                "#c97c1a",  # amber
    "All Beta (unlev)":            "#2e6f95",  # sea
    "All Beta (lev 15%)":          "#143642",  # ink
    "Lev-constrained (RSSB-style)": "#4d908e",  # mint
    "Campbell's Book":             "#a23e48",  # rose
    "SPY":                         "#6c7a89",  # stone
    "60/40":                       "#7b6d8d",  # muted purple
}


def load_vix() -> pd.Series:
    """VIX from yahoo for regime split."""
    try:
        df = yf.Ticker("^VIX").history(period="max", auto_adjust=True, actions=False)
        closes = df["Close"].dropna()
        closes.index = pd.to_datetime(closes.index).tz_localize(None)
        return closes.sort_index()
    except Exception as e:
        print(f"[warn] vix pull failed: {e}")
        return pd.Series(dtype=float)


def load_10y() -> pd.Series:
    """10Y yield from ^TNX (x10 to get actual pct)."""
    try:
        df = yf.Ticker("^TNX").history(period="max", auto_adjust=True, actions=False)
        closes = df["Close"].dropna() / 100.0 * 10  # ^TNX reports in percent*10
        # ^TNX actually reports as e.g. 42.5 for 4.25%. So divide by 10.
        closes = df["Close"].dropna() / 10.0
        closes.index = pd.to_datetime(closes.index).tz_localize(None)
        return closes.sort_index()
    except Exception as e:
        print(f"[warn] tnx pull failed: {e}")
        return pd.Series(dtype=float)


def load_6040_return(returns: pd.DataFrame) -> pd.Series:
    if "SPY" not in returns.columns or "IEF" not in returns.columns:
        return pd.Series(dtype=float)
    r = 0.6 * returns["SPY"].fillna(0.0) + 0.4 * returns["IEF"].fillna(0.0)
    return r


def regime_labels(vix: pd.Series, tnx: pd.Series) -> pd.DataFrame:
    """Return a frame with columns: vol_regime, rate_regime, year_2022."""
    idx = vix.index.union(tnx.index)
    vix = vix.reindex(idx).ffill()
    tnx = tnx.reindex(idx).ffill()

    vol_regime = np.where(vix > 25.0, "high_vol", "low_vol")
    tnx_yoy = tnx.diff(252)
    rate_regime = np.where(tnx_yoy > 0.50, "rising_rates", np.where(tnx_yoy < -0.25, "falling_rates", "flat_rates"))
    year_2022 = (idx.year == 2022).astype(int)

    return pd.DataFrame({
        "vol_regime": vol_regime,
        "rate_regime": rate_regime,
        "year_2022": year_2022,
    }, index=idx)


def regime_stats_table(results: dict, regimes: pd.DataFrame, riskfree: pd.Series) -> pd.DataFrame:
    rows = []
    regime_cuts = {
        "Full sample":         lambda idx: pd.Series(True, index=idx),
        "2006-2015":           lambda idx: (idx >= "2006-01-01") & (idx < "2016-01-01"),
        "2016-2021":           lambda idx: (idx >= "2016-01-01") & (idx < "2022-01-01"),
        "2022":                lambda idx: idx.year == 2022,
        "2023-present":        lambda idx: idx >= "2023-01-01",
        "High VIX (>25)":      lambda idx: regimes.reindex(idx).get("vol_regime", pd.Series(index=idx)).eq("high_vol"),
        "Low VIX":             lambda idx: regimes.reindex(idx).get("vol_regime", pd.Series(index=idx)).eq("low_vol"),
        "Rising rates (+50bps YoY)": lambda idx: regimes.reindex(idx).get("rate_regime", pd.Series(index=idx)).eq("rising_rates"),
        "Falling rates":       lambda idx: regimes.reindex(idx).get("rate_regime", pd.Series(index=idx)).eq("falling_rates"),
    }
    for name, res in results.items():
        r = res["net_returns"]
        for cut_name, cut_fn in regime_cuts.items():
            mask = cut_fn(r.index)
            if mask is None or mask.sum() < 30:
                continue
            sub = r[mask]
            stats = summary_stats(sub, riskfree_daily=riskfree)
            rows.append({
                "portfolio": name,
                "regime": cut_name,
                "n_days": int(mask.sum()),
                **stats,
            })
    return pd.DataFrame(rows)


def current_weights_table(results: dict) -> pd.DataFrame:
    all_tickers = sorted({t for res in results.values() for t in res["weights_daily"].columns})
    rows = []
    for t in all_tickers:
        row = {"ticker": t}
        for name, res in results.items():
            w = res["weights_daily"].get(t)
            if w is None or w.empty:
                row[name] = 0.0
                continue
            row[name] = float(w.iloc[-1])
        rows.append(row)
    return pd.DataFrame(rows).set_index("ticker")


def make_summary_table(results: dict) -> pd.DataFrame:
    rows = []
    for name, res in results.items():
        st = res.get("stats", {})
        gross_avg = float(res["gross_exposure"].mean())
        turn_ann = float(res["turnover_series"].sum() / max((res["dates"].max() - res["dates"].min()).days / 365.25, 1e-6))
        rows.append({
            "portfolio": name,
            "cagr": st.get("cagr"),
            "vol": st.get("vol"),
            "sharpe": st.get("sharpe"),
            "sortino": st.get("sortino"),
            "max_drawdown": st.get("max_drawdown"),
            "calmar": st.get("calmar"),
            "worst_month": st.get("worst_month"),
            "worst_quarter": st.get("worst_quarter"),
            "avg_gross": gross_avg,
            "turnover_per_year": turn_ann,
            "lev_cap_vol_20pct_dd": res.get("leverage_capacity_vol"),
            "start": st.get("start"),
            "end": st.get("end"),
            "years": st.get("years"),
        })
    return pd.DataFrame(rows).set_index("portfolio")


# --------------------------------------------------------------------------- #
# Charts
# --------------------------------------------------------------------------- #

def _setup_fig(w=11, h=5.5, dark=True):
    fig, ax = plt.subplots(figsize=(w, h))
    if dark:
        fig.patch.set_facecolor("#0e1a24")
        ax.set_facecolor("#0e1a24")
        for spine in ax.spines.values():
            spine.set_color("#f6f1e8")
        ax.tick_params(colors="#f6f1e8")
        ax.xaxis.label.set_color("#f6f1e8")
        ax.yaxis.label.set_color("#f6f1e8")
        ax.title.set_color("#f6f1e8")
    ax.grid(True, alpha=0.15, color="#f6f1e8")
    return fig, ax


def chart_cumulative(results, path, spy=None, sixty_forty=None):
    fig, ax = _setup_fig(w=11, h=5.5)
    for name, res in results.items():
        nav = (1 + res["net_returns"]).cumprod()
        ax.plot(nav.index, nav.values, color=PALETTE.get(name, "#ccc"), lw=1.6, label=name)
    if spy is not None:
        ax.plot((1 + spy).cumprod(), color=PALETTE["SPY"], lw=1.0, ls="--", alpha=0.75, label="SPY")
    if sixty_forty is not None:
        ax.plot((1 + sixty_forty).cumprod(), color=PALETTE["60/40"], lw=1.0, ls=":", alpha=0.8, label="60/40 (SPY+IEF)")
    ax.set_yscale("log")
    ax.set_title("Four Portfolios Net Total Return, 2006 to 2026 (quarterly rebalanced, log scale)")
    ax.set_xlabel("")
    ax.set_ylabel("NAV (log)")
    ax.legend(loc="upper left", facecolor="#0e1a24", labelcolor="#f6f1e8", edgecolor="#f6f1e8", fontsize=9)
    fig.tight_layout()
    fig.savefig(path, dpi=200, facecolor=fig.get_facecolor())
    plt.close(fig)


def chart_drawdowns(results, path):
    fig, ax = _setup_fig(w=11, h=5.0)
    for name, res in results.items():
        nav = (1 + res["net_returns"]).cumprod()
        dd = nav / nav.cummax() - 1.0
        ax.plot(dd.index, dd.values, color=PALETTE.get(name, "#ccc"), lw=1.3, label=name)
    ax.set_title("Drawdowns from peak, 2006 to 2026")
    ax.set_ylabel("Drawdown")
    ax.set_xlabel("")
    ax.legend(loc="lower left", facecolor="#0e1a24", labelcolor="#f6f1e8", edgecolor="#f6f1e8", fontsize=9)
    fig.tight_layout()
    fig.savefig(path, dpi=200, facecolor=fig.get_facecolor())
    plt.close(fig)


def chart_rolling_sharpe(results, path):
    fig, ax = _setup_fig(w=11, h=5.0)
    window = 252 * 3
    for name, res in results.items():
        r = res["net_returns"]
        mean = r.rolling(window).mean() * TRADING_DAYS
        vol = r.rolling(window).std(ddof=0) * math.sqrt(TRADING_DAYS)
        sharpe = (mean - 0.02) / vol
        ax.plot(sharpe.index, sharpe.values, color=PALETTE.get(name, "#ccc"), lw=1.3, label=name)
    ax.set_title("Rolling 3-year Sharpe (assumes 2% r_f)")
    ax.set_ylabel("Sharpe")
    ax.set_xlabel("")
    ax.axhline(0, color="#f6f1e8", alpha=0.25, lw=0.7)
    ax.legend(loc="upper left", facecolor="#0e1a24", labelcolor="#f6f1e8", edgecolor="#f6f1e8", fontsize=9)
    fig.tight_layout()
    fig.savefig(path, dpi=200, facecolor=fig.get_facecolor())
    plt.close(fig)


def chart_return_vs_risk(summary, path):
    fig, ax = _setup_fig(w=8.5, h=6.5)
    # Sharpe iso-lines at 0.25, 0.5, 0.75, 1.0
    vol_grid = np.linspace(0.03, 0.22, 50)
    for sr in [0.25, 0.5, 0.75, 1.0]:
        rets = sr * vol_grid + 0.02
        ax.plot(vol_grid, rets, color="#f6f1e8", alpha=0.18, lw=0.8)
        ax.text(vol_grid[-1], rets[-1], f"  SR={sr:.2f}", color="#f6f1e8", alpha=0.5, fontsize=9)

    for name, row in summary.iterrows():
        color = PALETTE.get(name, "#ccc")
        ax.scatter(row["vol"], row["cagr"], s=220, color=color, edgecolor="#f6f1e8", lw=1.5, zorder=5)
        ax.annotate(name, (row["vol"], row["cagr"]),
                    xytext=(10, 6), textcoords="offset points",
                    color="#f6f1e8", fontsize=10)
    ax.set_title("Return vs Risk, 2006 to 2026 (Sharpe iso-lines)")
    ax.set_xlabel("Realized annualized vol")
    ax.set_ylabel("CAGR")
    fig.tight_layout()
    fig.savefig(path, dpi=200, facecolor=fig.get_facecolor())
    plt.close(fig)


def chart_weight_comparison(weights_df, path):
    portfolios = list(weights_df.columns)
    tickers = list(weights_df.index)
    # Drop tickers with zero weight across everything
    weights_df = weights_df.loc[weights_df.abs().sum(axis=1) > 1e-4]
    tickers = list(weights_df.index)

    fig, ax = _setup_fig(w=12, h=max(5, 0.35 * len(tickers)))
    x = np.arange(len(tickers))
    n = len(portfolios)
    width = 0.8 / n
    for i, p in enumerate(portfolios):
        ax.barh(x + (i - n / 2 + 0.5) * width, weights_df[p].values, width, color=PALETTE.get(p, "#ccc"), label=p, alpha=0.9)
    ax.set_yticks(x)
    ax.set_yticklabels(tickers)
    ax.invert_yaxis()
    ax.set_title("Current weights across four portfolios + Campbell's book (most recent rebalance)")
    ax.set_xlabel("Weight")
    ax.legend(loc="lower right", facecolor="#0e1a24", labelcolor="#f6f1e8", edgecolor="#f6f1e8", fontsize=8)
    fig.tight_layout()
    fig.savefig(path, dpi=200, facecolor=fig.get_facecolor())
    plt.close(fig)


def chart_regime_heatmap(regime_df, path):
    pivot = regime_df.pivot_table(
        index="portfolio", columns="regime", values="sharpe", aggfunc="first"
    )
    # order columns
    order = ["Full sample", "2006-2015", "2016-2021", "2022", "2023-present",
             "High VIX (>25)", "Low VIX", "Rising rates (+50bps YoY)", "Falling rates"]
    cols = [c for c in order if c in pivot.columns]
    pivot = pivot[cols]

    fig, ax = _setup_fig(w=11, h=0.8 + 0.5 * len(pivot.index))
    im = ax.imshow(pivot.values, aspect="auto", cmap="RdYlGn", vmin=-1, vmax=2.0)
    ax.set_xticks(range(len(cols)))
    ax.set_xticklabels(cols, rotation=30, ha="right")
    ax.set_yticks(range(len(pivot.index)))
    ax.set_yticklabels(list(pivot.index))
    for i in range(pivot.shape[0]):
        for j in range(pivot.shape[1]):
            v = pivot.values[i, j]
            if pd.notna(v):
                ax.text(j, i, f"{v:+.2f}", ha="center", va="center", color="black", fontsize=9)
    fig.colorbar(im, ax=ax, label="Sharpe")
    ax.set_title("Sharpe by regime")
    fig.tight_layout()
    fig.savefig(path, dpi=200, facecolor=fig.get_facecolor())
    plt.close(fig)


# --------------------------------------------------------------------------- #
# Campbell delta vs equal-risk-impact reference
# --------------------------------------------------------------------------- #

def campbell_vs_reference(results: dict, returns: pd.DataFrame) -> pd.DataFrame:
    ref = results.get("All Beta (unlev)")
    campbell = results.get("Campbell's Book")
    if ref is None or campbell is None:
        return pd.DataFrame()

    ref_w = ref["weights_daily"].iloc[-1]
    cam_w = campbell["weights_daily"].iloc[-1]
    tickers = sorted(set(ref_w.index) | set(cam_w.index))
    # sleeve vols over full sample
    vols = {t: float(returns[t].dropna().iloc[-252 * 3:].std(ddof=0) * math.sqrt(TRADING_DAYS))
            for t in tickers if t in returns.columns}
    rows = []
    for t in tickers:
        w_ref = float(ref_w.get(t, 0.0))
        w_cam = float(cam_w.get(t, 0.0))
        v = vols.get(t, 0.0)
        rows.append({
            "ticker": t,
            "weight_reference_erc": w_ref,
            "weight_campbell": w_cam,
            "weight_delta": w_cam - w_ref,
            "sleeve_vol_3y_ann": v,
            "risk_contrib_reference": w_ref * v,
            "risk_contrib_campbell": w_cam * v,
            "risk_contrib_delta": (w_cam - w_ref) * v,
        })
    df = pd.DataFrame(rows).set_index("ticker")
    df = df.sort_values("weight_delta", key=lambda x: x.abs(), ascending=False)
    return df


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #

def main() -> None:
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

    # SPY and 60/40 benchmarks (from 2006)
    spy = returns["SPY"].loc[returns.index >= "2006-01-01"]
    sixty_forty = load_6040_return(returns).loc[returns.index >= "2006-01-01"]

    print("loading regimes (VIX, TNX)...")
    vix = load_vix()
    tnx = load_10y()
    regimes = regime_labels(vix, tnx)

    print("generating tables...")
    summary_df = make_summary_table(results)
    summary_df.to_csv(TABLES_DIR / "summary_stats.csv")
    print(summary_df.round(4))

    regime_df = regime_stats_table(results, regimes, returns.get("BIL"))
    regime_df.to_csv(TABLES_DIR / "regime_performance.csv", index=False)

    weights_df = current_weights_table(results)
    weights_df.to_csv(TABLES_DIR / "current_weights.csv")

    delta_df = campbell_vs_reference(results, returns)
    delta_df.to_csv(TABLES_DIR / "campbell_delta_vs_reference.csv")

    # Correlation matrix of the four/five portfolios
    net_returns_df = pd.DataFrame({n: r["net_returns"] for n, r in results.items()})
    net_returns_df["SPY"] = spy
    net_returns_df["60/40"] = sixty_forty
    corr = net_returns_df.corr()
    corr.to_csv(TABLES_DIR / "portfolio_correlations.csv")

    print("\nPortfolio correlations:")
    print(corr.round(3))

    print("\nrendering charts...")
    chart_cumulative(results, CHARTS_DIR / "four_cumulative.png", spy=spy, sixty_forty=sixty_forty)
    chart_drawdowns(results, CHARTS_DIR / "four_drawdowns.png")
    chart_rolling_sharpe(results, CHARTS_DIR / "four_rolling_sharpe.png")
    chart_return_vs_risk(summary_df, CHARTS_DIR / "four_return_vs_risk.png")
    chart_weight_comparison(weights_df, CHARTS_DIR / "four_current_weights.png")
    chart_regime_heatmap(regime_df, CHARTS_DIR / "four_regime_heatmap.png")

    # Serialize the analysis for the dashboard
    payload = {
        "title": "Four-portfolio comparison",
        "returns_window": {
            "start": str(returns.index.min().date()),
            "end": str(returns.index.max().date()),
            "observations": int(len(returns)),
        },
        "portfolios": [p.name for p in portfolios if p.name in results],
        "summary": json.loads(summary_df.reset_index().to_json(orient="records")),
        "regime_table": json.loads(regime_df.to_json(orient="records")),
        "current_weights": json.loads(weights_df.reset_index().to_json(orient="records")),
        "correlations": json.loads(corr.to_json(orient="records")),
        "correlation_labels": list(corr.index),
        "campbell_delta": json.loads(delta_df.reset_index().to_json(orient="records")),
        "cumulative": {
            name: {
                "dates": [d.strftime("%Y-%m-%d") for d in res["net_returns"].index],
                "nav":  (1 + res["net_returns"]).cumprod().round(6).tolist(),
            }
            for name, res in results.items()
        },
        "leverage_capacity": {
            name: {
                "realized_sharpe": float(res["stats"].get("sharpe", 0.0)),
                "realized_vol":    float(res["stats"].get("vol", 0.0)),
                "max_vol_20pct_dd_z2": float(res["leverage_capacity_vol"]),
                "already_exceeds_cap": bool(res["stats"].get("vol", 0.0) > res["leverage_capacity_vol"]),
            }
            for name, res in results.items()
        },
    }
    OUTPUT_JSON.write_text(json.dumps(payload, indent=2, default=str))
    # JS wrapper: same payload minus the daily NAV series (keep those only in JSON)
    light = {k: v for k, v in payload.items() if k != "cumulative"}
    js_path = PROJECT_DIR / "four_portfolios_analysis.js"
    js_path.write_text(f"window.FOUR_PORTFOLIOS = {json.dumps(light, default=str)};\n")
    print(f"wrote {OUTPUT_JSON}")
    print(f"wrote {js_path}")
    print(f"wrote tables to {TABLES_DIR}/")
    print(f"wrote charts to {CHARTS_DIR}/")


if __name__ == "__main__":
    main()
