# Math to Atoms v030

Summary first, with the latest essay and full model available separately. Published on the existing snow.ai GitHub Pages site.

## Routes

- `index.html`: a short cover with the question, three headline figures, one expandable assumption note, and links to read or experiment. It loads no model data or controls.
- `essay.html`: the revised v007 essay as readable HTML, including its 13 figures, five tables, clickable references, and matching Word download. The extra size/year chart, 37-entry timeline and references start closed.
- `model.html`: the complete interactive ledger, with navigation back to the summary and essay. It uses the unchanged v029 application and supporting modules. The five live charts, all 88 graph nodes, score and connection editors, worked examples, history and import/export remain.

The summary shows the published 25% reached / 50% used / 40% local improvement case over 2026-2046: $1.81T/year gross savings at the endpoint, 1.51% of the assumed $120T nominal GDP reference, 140M healthy years saved annually, and a 5% lower energy price with $600B/year savings already included in the dollar total. These are conditional reference-based benefits, not GDP or life-expectancy forecasts.

The model still loads the visitor's own saved settings. Visiting the cover or essay does not write to `mta-ledger-v7`. A cover value can therefore differ from a visitor's edited case; the cover explicitly describes one published case. Export schema remains version 19 and scoring formulas are unchanged.

The lightweight navigation module redirects common former model bookmarks, such as `/#graph-details`, to `model.html#graph-details`. Essay reference links open their containing Sources disclosure before scrolling.

## Essay source

`math_to_atoms_v007_20261111.docx` is the authoritative revised draft. The published download is byte-for-byte identical. SHA-256:

`4edd835a49b9e1b1982a9043ed8bfd2bb34554b3f68d5852eb6e982325c7d774`

The static builder extracts approved figures from the Word package, preserves paragraphs and tables, converts references into links, and publishes appendix material as disclosures. It does not fetch new claims or modify the Word document.

Run `build_math_to_atoms_web_v030.py` with a Python runtime containing python-docx and Pillow. It writes versioned local cover, essay and model HTML plus `math_to_atoms_essay_assets_v030/`. Copy those three HTML files to the entry-point names above. The shell CSS and navigation module are shared across the three routes.

## Validation

- New browser workflow: summary has no dials or model-app requests; essay contains 13 figures and 37 timeline entries; source anchors open disclosures; Word download checksum matches; navigation reaches all three pages; all 88 model nodes load; saved settings survive returning through the cover; old graph bookmarks redirect correctly.
- Responsive checks on summary, essay and model at 320, 400, 768, 1100, 1440 and 1920 pixels. Tables scroll inside their own regions. Desktop and phone screenshots reviewed. No JavaScript errors or missing local assets.
- Existing v029 interaction regression passes at `model.html`: live sliders, stable chart scales, GDP/lifespan context, worked paths and costs, Undo, schema migration/export and persistence.
- Existing 88-node explanation/editor regression passes at `model.html`, including editable connections, custom names, live payoff changes and reload.

Commands (with a server at port 8765):

    python math_to_atoms_browser_v030.test.py
    MTA_TEST_URL=http://127.0.0.1:8765/model.html python math_to_atoms_public_browser_v029.test.py
    MTA_TEST_URL=http://127.0.0.1:8765/model.html python math_to_atoms_explanation_browser_v029.test.py

The new workflow accepts `MTA_SITE_URL` for a deployed root. Browser checks use isolated Playwright contexts.

## Deployment

Retain the existing snow.ai repository and Pages deployment. Publish only the three entry points, shared v030 CSS/navigation, 13 extracted images, the approved Word draft, builder, test and this README. Reuse all existing model assets; do not copy the workspace wholesale. In particular, unrelated ADMIN.pdf is excluded.

The prior full-model site remains preserved in GitHub history at `42ef2831245cc6a0bddeca67e4088ac1fbb51934`. Mathematical scores, economic assumptions and disputed research claims retain the qualifications described in v029 and in the essay; this layout change adds no validation of those claims.
