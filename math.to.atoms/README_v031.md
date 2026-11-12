# Math to Atoms v031

History first, followed by the slider-driven benefit delta. The cover is a fixed snapshot of that view. The link reads **Explore the model →**.

## Presentation

The full model now starts in Since 1900 view. Each of the five indicators shows its historical line and reference trend, followed directly by a blue chart of the additional benefit during the chosen transition. Recent history and Change only remain available. The five cards stay on one desktop row.

Historical GDP and life expectancy provide context. Their separate blue deltas are annual budget savings and healthy years saved; those benefits are not added to GDP or lifespan. Energy retains the sourced oil-price proxy, climate retains the emissions series, and delivery retains the explicitly labeled US output/hour proxy. No historical series or arithmetic input has changed.

All five benefit deltas move during dragging, before the setting is committed. Their vertical scales stay fixed during capture dragging. Changing the transition length moves the endpoint and changes the annual build-up. Existing Details show the calculations and cumulative benefits. The graph, editable scores/connections, worked paths, Undo, imports and saved settings remain.

## Cover snapshot

`math_to_atoms_snapshot_v031.mjs` renders the published 25% reached / 50% used / 40% local improvement case over 2026-2046. It calls the same `trendCards` function as the live model, with editors and Details omitted. SVGs remain vector graphics and require no model app, network data fetch or controls on the cover.

The browser check compares the five cover delta SVGs with the default live model SVGs for exact equality. The cover stays fixed if a visitor changes and saves their own model case. Visiting the cover does not overwrite those saved settings.

The latest essay and matching v007 Word download are retained. Its appendix, timeline, source links and 13 approved images are unchanged apart from the shared navigation wording and styling.

## Runtime and build

- Full-model entry point: v031 HTML and app, projection, history and timeline modules; reuse the existing scoring, values, scenarios, worked paths and energy/history data.
- Shared shell and navigation: v031.
- Persistence: unchanged `mta-ledger-v7`, export schema 19. Campbell's logarithmic scoring formulas are unchanged.
- Build the snapshot with `node math_to_atoms_snapshot_v031.mjs`, then run `build_math_to_atoms_web_v031.py` using Python with python-docx and Pillow.
- Publish the generated cover as `index.html`, essay as `essay.html` and ledger as `model.html`. The essay reuses the versioned v030 images and the unchanged v007 Word draft.

## Validation

- Five unit checks cover physical/economic units, GDP/lifespan separation, live delta scaling, the shared static snapshot and zero/full/unset edge cases.
- Browser workflow checks cover/live equality, all five live deltas, fixed historical paths and scales during dragging, year changes, history views, Undo, persistence through the cover, essay sources and Word download checksum, legacy graph anchors and layout at 320/400/768/1100/1440/1920 pixels.
- Interaction regression checks the existing worked examples, program costs, graph-link gating, import/export and live calculations.
- All 88 node explanations/editors checked with the existing editor regression. Desktop and phone screenshots reviewed.

Commands:

    node --test math_to_atoms_timeline_v031.test.mjs
    python math_to_atoms_browser_v031.test.py
    python math_to_atoms_public_browser_v031.test.py

The new browser workflow accepts `MTA_SITE_URL`; the interaction regression accepts `MTA_TEST_URL`. Serve the retained GitHub checkout at port 8765 for their default local URLs. Use isolated Playwright browser contexts.

Deploy an explicit file allowlist to the existing snow.ai GitHub Pages site. Never copy the whole working folder; unrelated ADMIN.pdf remains excluded.
