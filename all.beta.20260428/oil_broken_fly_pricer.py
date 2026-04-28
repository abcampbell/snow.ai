"""Price the MCL Dec broken-wing condor: +90C / -105C / -130C / +140C.

Underlying: CL Dec 2026 future (in backwardation, ~$78 per IBKR display).
Expiry: 2026-11-17.
"""
from __future__ import annotations

import datetime
import math

import numpy as np
import yfinance as yf
from scipy.stats import norm


def black76_call(F: float, K: float, T: float, r: float, sigma: float) -> tuple[float, float]:
    if T <= 0 or sigma <= 0:
        return max(F - K, 0), 1.0 if F > K else 0.0
    d1 = (math.log(F / K) + 0.5 * sigma * sigma * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)
    df = math.exp(-r * T)
    return df * (F * norm.cdf(d1) - K * norm.cdf(d2)), df * norm.cdf(d1)


def main() -> None:
    # Dec 2026 WTI futures price (back-month; backwardation ~ -$15 vs front)
    cl_front = float(yf.Ticker("CL=F").history(period="2d", auto_adjust=True)["Close"].iloc[-1])
    F_dec = cl_front - 16  # IBKR analyzer showed $78.44 vs front $94.40
    iv_atm = float(yf.Ticker("^OVX").history(period="2d", auto_adjust=True)["Close"].iloc[-1]) / 100.0
    today = datetime.date.today()
    expiry = datetime.date(2026, 11, 17)
    T = (expiry - today).days / 365.0
    r = 0.045

    print(f"Front WTI:   ${cl_front:.2f}")
    print(f"Dec future:  ${F_dec:.2f} (front - $16 backwardation est.)")
    print(f"ATM IV:      {iv_atm*100:.1f}% (OVX)")
    print(f"T to expiry: {T:.3f}y ({(expiry-today).days} days)")

    # OTM skew: +5pp per 20% OTM, capped at +50% relative
    def iv_at(K: float) -> float:
        m = K / F_dec - 1.0
        return min(iv_atm + max(0.0, m * 0.25), iv_atm * 1.5)

    legs = [(90, +1), (105, -1), (130, -1), (140, +1)]
    nlv = 112251.0
    mult = 100  # MCL micro

    print(f"\n=== Per-leg pricing (Dec 2026, F=${F_dec:.2f}) ===")
    print(f"{'K':>5} {'qty':>4} {'IV':>5} {'C prem':>7} {'leg cost ($)':>15}")
    total_debit = 0.0
    leg_data = []
    for K, qty in legs:
        sigma = iv_at(K)
        c, _ = black76_call(F_dec, K, T, r, sigma)
        leg_cost = c * mult * qty
        total_debit += leg_cost
        leg_data.append((K, qty, sigma, c, leg_cost))
        print(f"{K:>5} {qty:>+4} {sigma*100:>4.0f}% {c:>6.3f}  {leg_cost:>13.0f}")

    print(f"\nNet debit: ${total_debit:.0f}  ({total_debit/nlv*100:.2f}% NLV)")

    # Payoff at various terminal F
    F_grid = np.array([60, 70, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140, 145, 150, 160])
    print(f"\n=== Terminal payoff at expiry ===")
    print(f"{'F_T':>6} {'P&L $':>9} {'%NLV':>7}")
    for FT in F_grid:
        pl = sum(qty * mult * max(FT - K, 0) for K, qty, _, _, _ in [(K, qty, s, c, lc) for K, qty, s, c, lc in leg_data]) - total_debit
        print(f"{FT:>5}  {pl:>+8.0f}  {pl/nlv*100:>+6.2f}%")

    # Key levels
    max_gain_FT = sum(qty * mult * max(120 - K, 0) for K, qty, _, _, _ in leg_data) - total_debit
    print(f"\n=== Summary ===")
    print(f"Max gain (F at $105-130): ${max_gain_FT:.0f}  ({max_gain_FT/nlv*100:.2f}% NLV)")
    max_loss_FT = -total_debit
    print(f"Max loss (F < $90 or careful zones): ${max_loss_FT:.0f}  ({max_loss_FT/nlv*100:.2f}% NLV)")
    above_140 = sum(qty * mult * max(160 - K, 0) for K, qty, _, _, _ in leg_data) - total_debit
    print(f"Tail-rip P&L (F > $140, e.g. $160): ${above_140:.0f}  ({above_140/nlv*100:.2f}% NLV)")

    rr = max_gain_FT / abs(max_loss_FT) if max_loss_FT != 0 else float("inf")
    print(f"R:R: {rr:.1f}x")


if __name__ == "__main__":
    main()
