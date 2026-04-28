# All Weather vs PCA Factor Map

## Why TIPS increased the sleeve in our demo

In the current dashboard, TIPS increased portfolio volatility at step 5 because the construction rule is:

1. Equal-vol scale each sleeve to 10% annualized volatility
2. Add the next sleeve by equal-weight averaging
3. Judge the new sleeve only by whether it lowers total volatility in-sample

That is **not** the same objective as All Weather.

### What happened in our sample

- Base 4-sleeve basket:
  - U.S. Equities
  - Long Treasuries
  - Broad Commodities
  - Gold
- Annualized vol of that basket: `5.75%`
- TIPS raw annualized vol in the sample: `5.94%`
- After equal-vol scaling, TIPS are levered up to `10%` target vol
- Correlation of TIPS to the existing 4-sleeve basket: `0.6898`
- Maximum correlation that would keep equal-weight addition from increasing volatility: about `0.4293`

So under the current *equal-vol + equal-weight + minimum-vol* rule, TIPS are too overlapping with the already-built basket, especially with long Treasuries and gold.

### Important correction: raw TIPS actually helped

If we add **raw** TIPS to the raw 4-sleeve basket by equal weighting, volatility falls:

- Raw 4-sleeve basket vol: `9.77%`
- Raw TIPS vol: `5.95%`
- Raw 5-sleeve basket vol: `7.19%`

So the issue is not simply "TIPS are redundant." The issue is that our demo first rescales TIPS up to `10%` annualized volatility, which effectively **leverages a low-vol sleeve** and then asks whether that resized sleeve lowers volatility in a basket that already contains a large duration component.

That is why the current chart should be interpreted as:

- a statement about our **construction rule**
- not a statement that TIPS do not belong in an All Weather-style portfolio

### Key correlations in the sample

- TIPS vs Long Treasuries: `0.564`
- TIPS vs Gold: `0.465`
- TIPS vs U.S. Equities: `0.310`
- TIPS vs Broad Commodities: `0.247`

That overlap is enough to raise volatility in this particular sequence.

## Why this does **not** mean TIPS are wrong for All Weather

Bridgewater says inflation-linked bonds fill a structural diversification gap in conventional portfolios.

From Bridgewater's *All Weather Story*:

- inflation-linked bonds are "a viable, underutilized asset class"
- they "do well in environments of rising inflation, whereas stocks and nominal government bonds do not"
- they "filled a diversification gap that existed (and continues to exist) in the conventional portfolio"

So the issue is not the asset. The issue is the demo objective.

## What the bigger macro factor literature says

### Bridgewater / All Weather

All Weather is a **2-axis environmental model**, not a PCA decomposition:

- growth rises relative to expectations
- growth falls relative to expectations
- inflation rises relative to expectations
- inflation falls relative to expectations

Bridgewater's idea is to hold four balanced risk buckets that survive those four environments.

### BlackRock / PCA-based macro factor model

BlackRock's "Total Portfolio Factor, Not Just Asset, Allocation" uses PCA on 13 global asset classes and finds:

- first 6 principal components explain `95%` of cross-asset comovement
- first 3 explain `85%`

Their resulting macro factor set is:

1. Economic growth
2. Real rates
3. Inflation
4. Credit
5. Emerging markets
6. Commodity
7. FX (added separately because it matters for volatility even if not a rewarded macro factor)

### MSCI multi-asset factor model

MSCI's multi-asset class factor model uses a broader top-level framework for strategic allocation. Their Tier 1 model highlights 9 top-level factors:

1. Equity
2. Interest rates
3. Inflation
4. Credit
5. Commodities
6. Foreign currency
7. Real estate
8. Private equity
9. Home bias

For our purpose, the first six are the most relevant liquid macro sleeves for an All Weather comparison.

### UC / BlackRock risk reporting example

The UC investment materials using BlackRock factor analytics show a very similar factor set:

1. Economic growth
2. Real rates
3. Inflation
4. Credit
5. Commodity
6. Emerging markets
7. Foreign exchange

## Clean comparison: All Weather vs richer factor models

These are not contradictions.

### All Weather is the coarse economic map

- Growth surprise
- Inflation surprise

This creates the familiar 4 quadrants.

### PCA / factor models are the finer decomposition

They usually split the cross-asset world into something like:

1. Growth / risky assets
2. Real rates / duration
3. Inflation
4. Credit spread
5. Commodity / real-asset beta
6. Emerging-market beta
7. FX / currency

And in some models, additional sleeves can be layered on top:

8. Liquidity / funding stress
9. Volatility / uncertainty
10. Trend / time-series momentum (not a macro state variable, but often a useful crisis diversifier)

## What we should change in the dashboard

To compare to All Weather properly, the macro demo should **not** ask only:

> does this next sleeve lower total volatility in a greedy equal-weight sequence?

It should ask:

1. Does this sleeve add a new macro factor?
2. Does it improve balance across growth and inflation environments?
3. Does it reduce concentration in the dominant factor?
4. How does it change effective dimension?
5. How does it behave in inflation up / growth down regimes?

## Recommended next factor set for the dashboard

For an All Weather comparison plus broader cross-asset factor coverage, the sleeve universe should be closer to:

1. U.S. equities
2. Developed ex-US equities
3. Emerging-market equities
4. Nominal duration
5. Inflation-linked bonds
6. Investment-grade credit
7. High-yield credit
8. Emerging-market sovereign bonds
9. Broad commodities
10. Gold
11. REITs / listed real estate
12. EM FX

Optional additional overlays:

13. Trend-following
14. Liquidity / volatility stress
15. Value / carry or another explicit diversifier

## Sources

- Bridgewater, *The All Weather Story*
- BlackRock / Ang / Bass / Gladstone, *Total Portfolio Factor, Not Just Asset, Allocation*
- University of California materials citing BlackRock macro factor analytics
