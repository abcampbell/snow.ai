# All Beta - 2026-04-19

This folder recreates the baseline argument for the alpha-beta / all-weather essay in two steps:

1. Inside equities, diversification saturates quickly and converges to an equity-beta floor.
2. Once that floor is isolated, further diversification must come from new macro sleeves rather than more stocks.

## Files

- `build_analysis.py` - builds the local artifacts
- `index.html` - static project page
- `analysis.json` / `analysis.js` - generated data for the page
- `charts/` - generated chart images
- `all_beta_summary.pdf` - generated summary PDF
- `macro_monthly_returns.csv` - generated when live Rose proxy pulls succeed
- `macro_correlation.csv` - generated when live Rose proxy pulls succeed

## Build

```powershell
cd C:\Users\campbell\snow.ai\all.beta.20260419
python build_analysis.py
```

Then open `index.html`.

## Current framing

- Stage 1 uses the closed-form equal-weight equity basket formula:
  `sigma_p^2 = sigma^2 * (rho + (1-rho)/N)`
- Stage 2 starts from equity beta and adds macro sleeves greedily by the largest incremental diversification benefit.
- The macro step uses Rose proxies for:
  - `spy:return`
  - `tlt:return`
  - `gld:return`
  - `dbc:return`
  - `tips:return`

## Important caveat

This is not presented as a literal Bridgewater replication. It is a clean analytical frame plus a Rose-backed proxy set that we can extend into a fuller alpha-vs-beta allocation model next.
