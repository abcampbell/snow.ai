# Math to Atoms v034

The summary is now interactive. Four prominent range controls set how much math helps with, how widely solutions get used, their improvement where used, and the number of years to spread. The five outcome readouts, historical overlays, separate blue benefit deltas, explanatory calculation and target dates update during input, before release.

Presentation follows the existing dark palette with restrained typography, fine rules, open columns instead of boxed cards, muted historical lines and blue outcome deltas. The upper historical charts remain context. GDP is not augmented by savings and lifespan is not augmented by a DALY conversion. On phones an immediate five-outcome summary follows the controls, with the historical/delta plots below it. Keyboard, fractional query values and reduced-motion settings are supported.

The cover uses the existing v029 scenario arithmetic, v031 projection/timeline renderer and v017/v028 history datasets. The original static 25/50/40/20 snapshot remains a fallback when JavaScript or reference data is unavailable. No new data, assumptions or scoring formulas. Each percentage slider's scales remain fixed during its drag; starting a different control sets an appropriate range for that control. Changing years keeps the current benefit scale.

Current cover settings are shareable in the URL. The cover does not read or write the full model's stored workspace. Explore the model passes only the four chosen settings to the v034 model entry point. The full model retains all saved graph edits, references, other assumptions and scenarios; applies the four settings as one undoable change; and consumes the parameters so a reload does not reapply a change after Undo. Edited references can make the full-model results differ, as explained in the calculation disclosure. Reset on the cover restores the published case without touching model storage.

Build: `python build_math_to_atoms_cover_v034.py`. Model v034 is v032 plus the bounded four-setting URL handoff. Shared case parser rejects absent/partial/invalid cases and preserves unrelated query parameters and hashes.

Checks: `node --test math_to_atoms_cover_case_v034.test.mjs`; `python math_to_atoms_cover_browser_v034.test.py` (MTA_SITE_URL override); existing v031 interaction regression and v032 worked-example browser checks continue to apply to model.html. The new workflow covers all four live controls, historical/scale stability, zero/full gain, years 1/100, fractional shared links, keyboard, phone summaries, widths 320–1920, saved-state isolation, full-model handoff and Undo, and data-load fallback.

Publish only index.html, model.html and the explicit v034 module/style/build/test/readme allowlist to the retained snow.ai GitHub Pages worktree. Preserve essay.html, older versioned assets and the v032 worked-example breakdown. Exclude unrelated workspace files, including ADMIN.pdf.
