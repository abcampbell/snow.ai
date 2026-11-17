# Math to Atoms v037 — charts before the dollar valuation

Moves the summary charts and full-model outlook charts above the combined
resource/health dollar panel. Adds a GDP comparison with recorded history,
current trend, and a separate path with added mathematical progress. The end
values, absolute gap and percentage gap update with the sliders and the saved
energy capital-response assumption. A period toggle shows either history since
1900 or the chosen 2026–endpoint transition; the latter discloses its nonzero
vertical-axis origin. The smaller GDP chart also draws both forecast paths.

The GDP calculation reuses v036's energy-only conditional output benchmark:

    uplift = energy savings / reference GDP × capital response
    with math(t) = baseline(t) × [1 + uplift × rollout progress(t)]

The percentage is applied to projected real GDP in 2021 international dollars.
This is not a nominal-dollar-to-PPP conversion. Resource savings and monetized
DALYs are not added to GDP. Other sectors and transition costs are not newly
estimated by this presentation change. At defaults the endpoint is 0.75% above
trend; all reached/half used gives 3%, using the chosen 1.5 capital response.
These are GDP-level differences, not permanent annual growth increases.

The existing four controls, saved workspace schema 20, Undo, shared settings,
graph and essay/Word draft are retained. No new stored assumptions are added.
Static fallback includes the GDP paths when JavaScript is unavailable.

Build order:

1. Existing v036 assets must be present.
2. `node math_to_atoms_gdp_fallback_v037.mjs`
3. `python build_math_to_atoms_web_v037.py` (reads the checked-in snapshot)
4. `node math_to_atoms_snapshot_v037.mjs`
5. `python build_math_to_atoms_web_v037.py` (refreshes fallback charts)

Validation: pure calculation tests for units, zero/missing inputs, health-price
independence and horizons 1–100 years; browser checks for live paths, shared
full-model settings, Undo, chart endpoints, disclosure behavior, responsive
widths 320–1920 and no body overflow. Desktop and mobile screenshots inspected.
