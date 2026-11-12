# Math-to-Atoms Ledger v029

Public-beta pass, 11 November 2026. Live site: https://snow.ai/math.to.atoms/

## Saved before editing

Commit 29450c88ab82f1e0cff07c2bda852cdbb27af838 and annotated tag `math-to-atoms-v028-before-public-review` preserve v028 before this pass. The tag is on GitHub.

## What changed

- The five top charts default to conditional annual benefits over 2026-2046. Capture and transition length update the curves while dragging. Recent history and Since 1900 remain available; no historical observations are invented.
- Resources freed is gross annual savings plus avoided losses, in fixed reference dollars, with a percentage of the assumed $120T nominal GDP. It is not added GDP. Energy is counted once. Aggregate implementation costs are excluded and identified as such.
- Health leads with healthy years saved (DALYs averted). The rough division by annual births is inside Details and is not added to a life-expectancy forecast.
- GDP and life expectancy show historical data and reference trends only. Their blue scenario curves and GDP-plus-savings totals have been removed. PPP GDP history is distinct from nominal benefit arithmetic.
- Compact Data, Assumption and Proxy tags distinguish sources from scenarios. Oil is an energy-price proxy; historical output/hour is a US productivity proxy, not global delivery data.
- The graph still ranks research priorities. Its scores do not generate macro benefits. Three separate worked examples use actual graph paths. Setting either path link to zero disconnects the example; changing a nonzero link weight does not multiply dollars.
- Five cards stay on one desktop row. Three significant digits, low-score red, all 88 explanations, editable scores/links, Undo, saved settings and custom names remain.

## Three worked examples

Gross annual saving = baseline x eligible share x reached x used x local improvement. The master reached/used settings apply, but each example has its own improvement assumption. These examples are not added to headline totals. Low/base/high are scenarios, not confidence intervals.

| Path | Reference | Eligible share | Low / base / high improvement | Base saving at 25% reached and 50% used |
| --- | --- | --- | --- | --- |
| B2 -> wall turbulence (4) -> fuel (O4) | $252B airline fuel bill, 2025 (IATA) | 10%, assumed | 0.5% / 1% / 2% | $31.5M/year |
| B1 -> catalysts (3) -> energy (O2) | 8.6 EJ ammonia energy input, 2020 (IEA), including feedstock | 10%, assumed | 5% / 10% / 15%, assumed | $108M/year at assumed $10/GJ |
| B14 -> transformer life (25) -> infrastructure (O5) | One operator's $10M maintenance budget, assumed | 100%, assumed | 8% / 10% / 12% | $125k/year |

Lufthansa reports about 1% fuel savings for aircraft fitted with AeroSHARK. This does not establish fleet-wide eligibility or a need for a new mathematical breakthrough. The 2% high case is a target. IEA's ammonia energy total includes feedstock; the eligible share avoids treating all feedstock as removable process energy. DOE's 8-12% range is general guidance on predictive versus preventive maintenance, not a measured transformer-specific saving.

Inputs and annual program costs are editable. Cost defaults to unset: no net benefit is claimed until entered. Costs can exceed gross savings. Unknown ammonia energy valuation stays unset instead of becoming zero.

Sources:
- IATA: https://www.iata.org/en/pressroom/2026-releases/06-07-middle-east-disruptions-high-fuel-prices-halve-airline-industry-profitability/
- Lufthansa: https://www.lufthansagroup.com/en/responsibility/climate-and-environment/operational-efficiency.html
- IEA: https://www.iea.org/reports/ammonia-technology-roadmap/executive-summary
- DOE, 2010: https://www.energy.gov/sites/default/files/2020/04/f74/omguide_complete_w-eo-disclaimer.pdf

Sources establish reference quantities or existing engineering results. Future mathematics, applicability, adoption and deployment remain assumptions. Independent domain-expert review has not been performed.

## Arithmetic and persistence

Annual macro benefits phase in linearly. With fixed references, cumulative benefit = final annual benefit x transition years / 2. At defaults: $1.8112T/year resources freed, 1.509333% of reference GDP, $18.112T accumulated over 20 years, and 139.85M DALYs/year saved at the end. Display rounds to three significant digits. Healthy years, money and CO2 are separate measures; project durations are not accumulated across years or projects.

Export schema is version 19 and adds `workspace.worked`. Existing imports and saved workspaces without this field receive defaults. Supported imports: 7, 8, 9, 13, 14, 15, 18 and 19. Storage key stays `mta-ledger-v7`. Campbell's v007 logarithmic scoring model and source graph data are unchanged.

## Validation

- 23 unit checks: scoring, all-node explanation coverage, oil history, annual/cumulative benefits, no GDP/lifespan gain forecast, worked-case arithmetic and units, link gating, optional costs, null valuation and state validation.
- Browser checks: live dragging before release; stable scales; history modes; three examples and cost edits; path disconnect; Undo; v019 export/v018 import; persistence; no page errors; no overflow at 320, 400, 768, 1100, 1440 and 1920 px; five desktop cards in one row. Desktop and phone screenshots reviewed.
- All 88 node explanations and their score/connection editors checked in-browser, including custom names, live payoff edits, export and reload.

Commands:

    node --test math_to_atoms_public_v029.test.mjs math_to_atoms_model_v007.test.mjs math_to_atoms_explanations_v019.test.mjs math_to_atoms_energy_history_v028.test.mjs
    python math_to_atoms_public_browser_v029.test.py
    python math_to_atoms_explanation_browser_v029.test.py

Browser tests accept `MTA_TEST_URL`; local default is http://127.0.0.1:8765/math_to_atoms_ledger_v029.html and use an isolated Playwright browser. Serve this folder with `python -m http.server 8765 --bind 127.0.0.1` for local checks.

## Deployment

Publish `math_to_atoms_ledger_v029.html` as `index.html`, plus the v029 app, public, projection, history, scenario, worked and CSS modules. Include this README and the v029 test files for version control. Reuse existing versioned v007 model/data, v009/v027 quantities, v013/v027 values, v014 payoff, v019 explanations, v017 historical JSON and v028 energy module/history JSON dependencies.

`math_to_atoms_live_v029.mjs` is an unused draft and must not be deployed. Never copy the whole workspace. In particular, unrelated ADMIN.pdf is excluded. Deployment uses the existing snow.ai GitHub Pages pipeline.
