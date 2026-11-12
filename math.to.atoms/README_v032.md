# Math to Atoms v032

Show the arithmetic directly on all three worked-example cards. The aviation example exposes its previously buried 10% eligibility assumption, compares the restricted scenario with a saving across the full airline fuel bill, and makes clear that this covers aircraft surface coatings rather than all turbulence applications. Existing coating performance does not establish the extra saving from new mathematics.

At the screenshot settings: $252B/year × 10% eligible × 62% reached × 52% used × 1% fuel saving = $81.2448M/year, displayed as $81.2M/year. Intermediate amounts retain full precision. Without the eligibility limit the same deployment gives $812.448M/year; 1% across the entire bill gives $2.52B/year.

Source check on November 11, 2026: IATA's June 7, 2026 airline outlook reports a 2025 fuel bill of $252B (and forecasts $350B for 2026). The model retains 2025 as a fixed reference, not today's bill. Lufthansa's operational-efficiency page reports approximately 1% fuel savings from AeroSHARK at its current stage of development. Neither source provides the assumed 10% eligible share or the top-slider reach/adoption rates.

The arithmetic now updates visibly during slider movement, example input edits, presets and Undo. The current input remains mounted during editing. Captions also update during incremental edits. Unknown energy valuation stays unknown; disconnected graph paths show their arithmetic as uncounted.

No benefit assumptions, defaults, scoring formulas, saved-state schema or headline totals change. The cover and essay remain v031. Only model.html points to the new v032 app, worked-examples module and small stylesheet importing the existing v031 shell. Retain all v031 shared modules and assets.

Validation: node --test math_to_atoms_worked_v032.test.mjs; python math_to_atoms_worked_browser_v032.test.py; existing math_to_atoms_public_browser_v031.test.py interaction regression. Browser checks use an isolated Playwright context and cover the screenshot numbers, altered eligibility, live dragging, presets, Undo, persistence and widths 320 through 1920.

Publish an explicit allowlist to the retained snow.ai GitHub Pages checkout. Never copy unrelated ADMIN.pdf or the whole workspace.
