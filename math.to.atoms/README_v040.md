# Math to Atoms v040 — today and both endpoint GDP values

Shows three GDP readouts: today (the model's 2026 estimate), without added math
at the selected endpoint, and with added math at that same endpoint. The selected
number of years and start/end dates appear above them. Both chart sizes include
a labeled today marker at 2026. Readouts retain 2021 PPP international dollars
and three significant digits. GDP calculations and historical series are
unchanged; 2026 remains the model's starting year, not a new observed data point.

The synthesis stays directly below the homepage title. The same GDP presentation
is used in the full model. Existing browser checks cover horizon changes, live
sliders, today/end values, chart markers, saved settings and mobile layouts.

Build: run `node math_to_atoms_gdp_fallback_v040.mjs`, then
`python build_math_to_atoms_web_v040.py`. The generator creates the v040 GDP
module; on the first build use the checked-in fallback, then regenerate it with
the Node helper and rerun the generator.
