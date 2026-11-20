# Math to Atoms v042 — residual costs and construction time

Fixes the aggregate scenario's ability to make energy and other production free
and projects instantaneous when all three requested-gain sliders reach 100%.
Three explicit, editable minimums default to 20% of starting energy cost, other
production cost and project time. These are illustrative assumptions, not
empirically measured universal constants or a claim that 80% cuts are achievable.

For each affected sector:

    reduction = reach × adoption × min(requested local gain, 1 − residual share)

The local improvement is bounded before reach/adoption, rather than clipping
the final aggregate saving. Minimum shares must be 1–100%, so a valid workspace
cannot choose zero residual cost or duration. With default minimums and full
reach/use/gain, energy falls 80%, leaving a $2.4T annual bill; a ten-year project
takes two years. Other production also retains 20% of its cost. The published
25/50/40 case and the 100/50/40 and 100/100/40 comparisons are unchanged.

The actual bounded reductions propagate through resource totals, energy price
and savings curves, delivery durations and productivity proxy, the energy-GDP
benchmark, monetized financing value, case comparisons and live readouts. Health,
emissions and disaster losses keep their separate illustrative reduction rule;
this does not add a clinical or climate feasibility calibration.

Minimums are visible in the chart notes and editable under “Minimum costs &
build time”. Shared links carry all three; the full model persists them with
Undo/scenarios. Workspace export 21 accepts old versions, including 20, with
default minimums. Saved cases at 100% automatically receive the new minimums.

Engineering rationale: energy costs include capital, fixed/variable operation
and maintenance, and fuel; fuel-free generation is not cost-free delivered
energy. See NREL ATB 2024b equations and variables. No source is used to claim
the chosen 20% figure is a physical law.

Validation includes the original default values, local-before-adoption bounds,
zero reach, missing bases, full stress cases, finite chart/projection values,
editable minimums, invalid zero floors, links, old export migration and responsive
UI. Build with the prior snapshot present, run the snapshot Node helper, then
rerun the Python generator to refresh static fallback.
