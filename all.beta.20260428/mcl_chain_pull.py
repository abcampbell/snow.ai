"""Pull MCL option chain from IBKR (delayed-frozen, no live subscription needed).

Goal: get current premiums for MCL Aug/Sep call strikes around the Hormuz scenario,
to price out the call-spread roll from existing $85/$95 to a wider/higher structure.
"""
from __future__ import annotations

import math
from ib_insync import IB, Future, FuturesOption


def main() -> None:
    ib = IB()
    ib.connect("127.0.0.1", 7496, clientId=84, timeout=8, readonly=True)
    if not ib.isConnected():
        raise SystemExit("Could not connect to TWS")

    ib.reqMarketDataType(3)  # delayed-frozen

    # 1) Discover MCL future via contract details (exchange = NYMEX, tradingClass = MCL)
    print("=== MCL futures spot ===")
    discover = Future("MCL", exchange="NYMEX", currency="USD", includeExpired=False)
    details = ib.reqContractDetails(discover)
    futs = []
    seen = set()
    for d in details:
        c = d.contract
        exp = c.lastTradeDateOrContractMonth
        if exp in seen:
            continue
        seen.add(exp)
        futs.append(c)
    futs.sort(key=lambda c: c.lastTradeDateOrContractMonth)
    futs = futs[:6]  # next 6 expiries
    print(f"  found {len(futs)} MCL futures: {[f.lastTradeDateOrContractMonth for f in futs]}")

    fut_tickers = []
    for f in futs:
        t = ib.reqMktData(f, "", False, False)
        fut_tickers.append((f, t))
    ib.sleep(4)
    fut_spot: dict[str, float] = {}
    for f, t in fut_tickers:
        px = t.last or t.close or t.marketPrice() or 0
        if isinstance(px, float) and not math.isnan(px) and px > 0:
            fut_spot[f.lastTradeDateOrContractMonth] = float(px)
            print(f"  MCL {f.lastTradeDateOrContractMonth}  spot ${px:.2f}")

    # 2) Discover available MCO option expiries (MCO = tradingClass for MCL options)
    print("\n=== Discovering MCL option expiries (tradingClass=MCO) ===")
    discover_opt = FuturesOption(symbol="MCL", exchange="NYMEX",
                                  currency="USD", tradingClass="MCO", right="C",
                                  includeExpired=False)
    opt_details = ib.reqContractDetails(discover_opt)
    print(f"  found {len(opt_details)} MCO option contracts")
    if not opt_details:
        print("  No MCO contracts found via reqContractDetails. Aborting.")
        ib.disconnect()
        return

    # Group by expiry
    by_exp: dict[str, list] = {}
    for d in opt_details:
        c = d.contract
        by_exp.setdefault(c.lastTradeDateOrContractMonth, []).append(c)
    avail_expiries = sorted(by_exp)
    print(f"  available expiries: {avail_expiries[:8]}")

    # Pick the 2nd-4th expiries (skip current month if any)
    target_expiries = avail_expiries[1:4] if len(avail_expiries) >= 4 else avail_expiries[:3]
    target_strikes = [85, 90, 95, 100, 105, 110, 115, 120, 125, 130]

    print(f"\n=== MCL call chain ({'/'.join(target_expiries)}, strikes 85-130) ===")
    print(f"{'Exp':>10} {'K':>4}  {'Bid':>7} {'Ask':>7} {'Last':>7} {'Mid':>7} {'IV%':>6} {'delta':>7}")
    print("-" * 72)

    # Pick contracts that match strike+expiry+call from the discovered set
    contracts_to_qualify = []
    for exp in target_expiries:
        for c in by_exp.get(exp, []):
            if c.strike in target_strikes and c.right == "C":
                contracts_to_qualify.append(c)

    # contracts already qualified from contract details — just request mkt data
    tickers = [(c, ib.reqMktData(c, "106", False, False)) for c in contracts_to_qualify]
    ib.sleep(8)

    # print rows grouped by expiry
    rows_by_exp: dict[str, list] = {}
    for c, t in tickers:
        exp = c.lastTradeDateOrContractMonth
        rows_by_exp.setdefault(exp, []).append((c, t))

    for exp, rows in sorted(rows_by_exp.items()):
        for c, t in sorted(rows, key=lambda r: r[0].strike):
            bid = t.bid if t.bid and not math.isnan(t.bid) and t.bid > 0 else None
            ask = t.ask if t.ask and not math.isnan(t.ask) and t.ask > 0 else None
            last = t.last if t.last and not math.isnan(t.last) and t.last > 0 else None
            mid = (bid + ask) / 2 if (bid and ask) else None
            mg = t.modelGreeks
            iv = (mg.impliedVol if mg and mg.impliedVol and not math.isnan(mg.impliedVol) else None) if mg else None
            dlt = (mg.delta if mg and mg.delta is not None and not math.isnan(mg.delta) else None) if mg else None
            bid_s = f"{bid:.4f}" if bid else "-"
            ask_s = f"{ask:.4f}" if ask else "-"
            last_s = f"{last:.4f}" if last else "-"
            mid_s = f"{mid:.4f}" if mid else "-"
            iv_s = f"{iv*100:.1f}" if iv else "-"
            dlt_s = f"{dlt:.3f}" if dlt is not None else "-"
            print(f"{exp:>10} {c.strike:>4.0f}  {bid_s:>7} {ask_s:>7} {last_s:>7} {mid_s:>7} {iv_s:>6} {dlt_s:>7}")
        print()

    # 3) Price specific spreads
    print("\n=== Spread pricing (per spread, NOT per contract) ===")
    spreads = [
        (85, 95),   # current
        (95, 115),
        (95, 120),
        (95, 130),
        (100, 115),
        (100, 120),
    ]
    for exp in target_expiries:
        rows = {c.strike: t for c, t in rows_by_exp.get(exp, [])}
        print(f"\nExpiry {exp}:")
        for k_lo, k_hi in spreads:
            if k_lo not in rows or k_hi not in rows:
                continue
            t_lo, t_hi = rows[k_lo], rows[k_hi]
            def mid_of(t):
                bid = t.bid if t.bid and not math.isnan(t.bid) and t.bid > 0 else None
                ask = t.ask if t.ask and not math.isnan(t.ask) and t.ask > 0 else None
                if bid and ask: return (bid + ask) / 2
                return t.last if t.last and not math.isnan(t.last) and t.last > 0 else None
            mid_lo = mid_of(t_lo)
            mid_hi = mid_of(t_hi)
            if mid_lo is None or mid_hi is None:
                print(f"  ${k_lo}/${k_hi}  - mid unavailable")
                continue
            net_premium = mid_lo - mid_hi  # buy lo, sell hi → debit
            max_gain = (k_hi - k_lo) - net_premium
            max_loss = net_premium
            risk_reward = max_gain / max_loss if max_loss > 0 else float("inf")
            # MCL multiplier = 100 → contract dollars
            print(f"  ${k_lo}/${k_hi}  debit ${net_premium*100:>6.0f}  max-gain ${max_gain*100:>6.0f}  R:R {risk_reward:>4.2f}x  ({(max_gain/max_loss-1)*100:+.0f}% over premium)")

    ib.disconnect()


if __name__ == "__main__":
    main()
