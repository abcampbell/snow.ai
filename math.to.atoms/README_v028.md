# Math-to-Atoms Ledger v028

Energy now shares the selected historical period with the other four charts. “Since 1900” shows annual oil-price observations from 1900–2025; “Recent + future” starts in 2006. Both the top and detailed comparison controls work. The year-inspection slider marks the selected year on the detailed energy chart.

Source: Energy Institute based on S&P Global Platts, Statistical Review of World Energy (2026), via Our World in Data, https://ourworldindata.org/grapher/oil-prices-inflation-adjusted . Public CSV and metadata were retrieved successfully (HTTP 200), and the CSV checksum is recorded in the versioned JSON. Source data cover 1861–2025; the deployed subset contains exactly 126 annual observations for 1900–2025. Raw units are constant 2025 USD per cubic meter. The chart divides every value by the last recorded price to index 2025 = 100. Raw data remain full precision; displays keep three significant digits.

This is explicitly labeled oil-price history: a proxy, not a historical price index for all energy. Details retain the source, scope and connection to the separate energy-spending assumptions. The global units note now includes “Energy history: oil, 2025 = 100.” No global energy-price history was invented.

The last recorded price is held flat for the future reference, with no historical trend extrapolation. The blue line starts its assumed reduction in 2026 and reaches the chosen percentage at the shared end year. The 2025–2026 connection is a fixed-price assumption, not a new observation. Historical points, baseline and chart scale stay fixed during capture dragging. Annual/cumulative energy savings and all GDP, health, climate, delivery and graph scoring calculations are unchanged.

Checks: four unit tests cover continuous source coverage, raw anchors, normalization, recent/full windows, phase-in start, zero effect, endpoint changes and validation. Browser QA checks both history toggles, 126 observations in the full view, proxy/source labels, fixed history and baseline during live dragging, unchanged savings, Undo, the 2056 endpoint when Y=30, inspection marker, 88 graph nodes, five cards in one desktop row and no overflow at 320/400/1100/1440/1920. Desktop screenshot reviewed.

Publish ledger HTML as index.html, plus v028 app, live, energy, scenario, CSS and energy-history JSON. Reuse the existing history/projection/value/data modules. Never publish the whole workspace.
