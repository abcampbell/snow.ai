"""Price MCL call spreads via Black-76 using yfinance crude spot + OVX as IV proxy.
No IB market data needed (Sunday close + likely no NYMEX delayed sub).
"""
from __future__ import annotations

import datetime
import math
from dataclasses import dataclass

import yfinance as yf
from scipy.stats import norm


@dataclass
class B76:
    price: float
    delta: float


def black76(F: float, K: float, T: float, r: float, sigma: float, is_call: bool) -> B76:
    if T <= 0 or sigma <= 0 or F <= 0 or K <= 0:
        intrinsic = max(F - K, 0) if is_call else max(K - F, 0)
        return B76(intrinsic, 1.0 if (is_call and F > K) else 0.0)
    d1 = (math.log(F / K) + 0.5 * sigma * sigma * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)
    df = math.exp(-r * T)
    if is_call:
        return B76(df * (F * norm.cdf(d1) - K * norm.cdf(d2)), df * norm.cdf(d1))
    return B76(df * (K * norm.cdf(-d2) - F * norm.cdf(-d1)), -df * norm.cdf(-d1))


def main() -> None:
    print("Pulling crude spot + OVX from yfinance...")
    cl = yf.Ticker("CL=F").history(period="5d", auto_adjust=True)
    ovx = yf.Ticker("^OVX").history(period="5d", auto_adjust=True)
    if cl.empty or ovx.empty:
        raise SystemExit("yfinance pull failed")
    F = float(cl["Close"].iloc[-1])
    iv = float(ovx["Close"].iloc[-1]) / 100.0  # OVX is quoted in pct
    print(f"  CL=F (front-month WTI): ${F:.2f}")
    print(f"  OVX (CBOE oil vol):     {iv*100:.1f}%  (used as ATM IV estimate)")

    r = 0.045  # risk-free
    today = datetime.date.today()
    expiries = [
        ("Jul 2026", datetime.date(2026, 6, 16)),  # MCN6 = July contract, options expire mid-Jun
        ("Aug 2026", datetime.date(2026, 7, 16)),  # MCQ6
        ("Sep 2026", datetime.date(2026, 8, 17)),  # MCU6
        ("Oct 2026", datetime.date(2026, 9, 17)),  # MCV6
    ]
    strikes = [85, 90, 95, 100, 105, 110, 115, 120, 125, 130]

    # Skew: deep OTM calls trade above ATM IV. Apply a mild skew for OTM strikes.
    def skew_adj(K: float, F: float, atm_iv: float) -> float:
        # crude OTM call skew: ~+5% IV per 20% OTM, capped
        moneyness = K / F - 1.0
        return min(atm_iv + max(0.0, moneyness * 0.25), atm_iv * 1.5)

    print(f"\n{'Exp':>8} {'K':>4}  {'IV':>5}  {'C prem':>7}  {'Delta':>6}  {'Cost ($per spread)':>22}")
    print("-" * 80)

    chains: dict[str, dict[int, B76]] = {}
    for label, exp_date in expiries:
        T = max((exp_date - today).days / 365.0, 1e-6)
        chains[label] = {}
        for K in strikes:
            iv_k = skew_adj(K, F, iv)
            res = black76(F, K, T, r, iv_k, is_call=True)
            chains[label][K] = res
            print(f"{label:>8} {K:>4}  {iv_k*100:>4.0f}%  {res.price:>6.3f}   {res.delta:>5.3f}   {res.price*100:>20.0f}")
        print()

    # 4) Spread pricing (debit, max gain, R:R)
    spreads = [
        (85, 95),    # current
        (95, 115),
        (95, 120),
        (95, 130),
        (100, 115),
        (100, 120),
        (100, 130),
        (105, 130),
    ]
    nlv = 112251.0  # for sizing context (% NLV)
    print(f"\n=== Spread pricing  (mult=100, NLV reference ${nlv:,.0f}) ===")
    print(f"{'Exp':>8} {'Spread':>10}  {'Debit $':>10} {'%NLV':>6}  {'MaxGain $':>10} {'%NLV':>6}  {'R:R':>5}  {'delta %NLV':>11}")
    print("-" * 90)
    for label, _ in expiries:
        for k_lo, k_hi in spreads:
            lo, hi = chains[label].get(k_lo), chains[label].get(k_hi)
            if not lo or not hi:
                continue
            debit_per_unit = lo.price - hi.price
            debit = debit_per_unit * 100  # 1 contract = $100/$ option premium
            max_gain = (k_hi - k_lo) * 100 - debit
            rr = max_gain / debit if debit > 0 else float("inf")
            net_delta_per_spread = (lo.delta - hi.delta) * 100 * F  # delta_dollars on the underlying
            print(f"{label:>8}  ${k_lo:>3}/${k_hi:<3}  {debit:>9.0f} {debit/nlv*100:>5.2f}%  {max_gain:>9.0f} {max_gain/nlv*100:>5.1f}%  {rr:>4.1f}x  {net_delta_per_spread/nlv*100:>13.1f}%")
        print()


if __name__ == "__main__":
    main()
