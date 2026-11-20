# Campbell Ramble — review, themes, return-to list, analytics

Scope: every post I could find on campbellramble.substack.com — **236 posts, Nov 2021 → Nov 2026** (54 are older posts bulk-imported on 2021-11-09; 6 are paywalled). Six review agents read every post in full and scored it. Files:

| File | What |
|---|---|
| `INDEX.md` | Full index: date, link, rating, sub-scores, themes, reactions/comments/restacks, ★ return-to flag |
| `data/ratings_all.json` | Per-post summary, scores, best line, improvement notes, falsifiable calls, return reason |
| `data/metrics.csv` | Public engagement metrics per post |
| `data/text/`, `data/bodies/`, `data/archive_raw.json` | Source text and raw Substack API data |
| `data/analytics_raw.txt`, `data/merge_stats.txt` | Raw analytic outputs behind the numbers below |

## Caveats (read first)

- **Ratings are one model's judgment** (six agents, one rubric, read from text only). Treat them as a structured second opinion, not truth. Agents were told to be tough: mean ≈ 5.5, only 20 posts scored 8, none above 8.
- **No private analytics.** Opens, views, subscriber growth, paid conversions and traffic sources live behind the Substack login and were not available. "What worked" below uses only public signals: reactions, comments, restacks. Those measure *engaged readers*, not reach. If you export Substack → Stats → Posts (CSV) into `ramble/data/`, the analysis below can be rerun on real opens/conversions.
- **Archive completeness.** The archive API would not paginate, so I enumerated by search queries until it saturated at 236. There are long gaps (Feb–Aug 2025, late May–Sept 2026); they may be genuine silences or missed posts. Worth a 2-minute check against your dashboard.
- **Recent posts are under-counted** (they haven't had time to collect reactions), so November 2026 looks weaker than it is.
- **Calls were not graded against outcomes** — I have no market data here. The ★ list flags which calls are checkable. (The repo's password-gated `hyperstitions/`, `calibration/` and `scars/` pages already grade 594 earlier calls; I could not open them.)
- Paywalled posts were rated only on their free preview (e.g. *Dems Win, Data Centers Lose* scored 2 on two visible lines).

## Headline findings

1. **Engagement per post has grown roughly 2–3× a year, and the writing got better.** Median reactions per post: 2022 → 2, 2023 → 5, 2024 → 18, 2025 → 48, 2026 → 89. Average rating also rises from the 2021–23 pieces (many are tweet threads, one-liners, poems) to 2025–26.
2. **Strongest 2025–26 run:** the oil-shock "Cascade" series, the silver series, China bank-loss work, and "bonds in the semiconductors". These combine a mechanism, named instruments and dated checkpoints.
3. **Ratings only weakly predict reach** (correlation ≈ 0.3 overall, ≈ 0.16 in the recent era). Readers reward *topic and timing* (silver in Jan–Feb 2026, Hormuz in March, AI-bubble in May) more than analytic quality.
4. **Longer posts get more reactions, but that is mostly a growth artefact.** Raw: <1k words → median 5 reactions, 4k+ → 101. Within Sep 2025–Oct 2026 only, length has no relationship (r = 0.06; 1–2k words median 79, 3–4k median 86). Don't pad; don't be afraid of length either.
5. **Topics that outperformed (Sep 2025+ median reactions):** fed/liquidity 139 (n=3), silver ~152 (n=5), gold 114, oil/Hormuz 104, AI-capex 94, rates 94; **underperformed:** China 60 (and it is the single most-written theme: 59 posts), personal essays 71, portfolio-construction 73.
6. **Titles:** question-mark titles do poorly (median 10 vs 32 reactions). Short, punchy 1–5 word titles beat 6+ word ones (3-word median 37 vs 18). Titles with a number do well (48 vs 25: "26 Views for 2026", "10 Silver Days…").
7. **Format:** trade-ideas are the best-rated format (6.7 avg) and essays 6.0; market-notes (5.2) and "other" (2.3: poems, teasers, stubs) are the weakest.
8. **Cadence matters:** Feb–Aug 2025 (≈6 months) and Jun–Sep 2026 (≈4 months) had no posts; engagement on return was strong in both cases, so the audience waits. Autumn 2026 posts are shorter (≈0.9–1.5k words) and sit lower on reactions.
9. **Under-recognised:** 9 posts rated ≥7 got <30 reactions (2024–25): *Gold in China, How to Short a Startup, Is This China's Whatever It Takes, The Death of Globalism, No Soup (Gallium), Still Long Silver, Fill It Up Again, The S-Curve Strikes Back, The Compute Constraint*. Mostly pre-audience; a good "best of" resurface list.
10. **Over-performed vs rating (≥100 reactions, rated ≤6):** *Flash Crash* (4), *Don't F with the Money* (4), *Silver Moon* (5), *The Air Pocket*, *Don't Take the Bait*, *What the Heck Happened to Gold*, *Waking the Hegemon* — event-driven or confident-voice pieces that landed on the right day.

## Themes (post counts; avg rating)

| Theme | Posts | Avg | Notes |
|---|---|---|---|
| macro-regime | 82 | 6.0 | The "conflict is inflationary / bonds in the stocks" frame is the spine of the blog |
| china | 59 | 6.1 | Dominant 2021–25 thread: property → bank losses → "long gold in RMB". Rich but under-rewarded recently |
| gold | 54 | 6.1 | Gold-in-China, physical stress, gold vs bonds |
| positioning-flows | 49 | 5.7 | Mostly market-notes; lowest rating per post |
| personal-essay | 48 | 5.1 | *Against Entropy*, *When You Feel Pain…* are the standouts; many are filler |
| portfolio-construction | 42 | 6.0 | Protection portfolio, alpha/beta, options structures |
| commodities-supply | 40 | 6.3 | Silver, chokepoint metals, ags/fertilizer — best evidence quality |
| rates-curve | 36 | 5.7 | |
| ai-capex | 36 | 5.9 | Compute utilization, duration, S-curve |
| data-tools | 30 | 4.8 | Rose product posts; lowest-rated theme — pitches often replace analysis |
| fed-liquidity | 19 | 6.2 | Highest reach per post |
| oil-hormuz | 17 | 6.5 | Highest-rated theme; 2026 only |
| crypto | 12 | 5.8 | Early skepticism; *Convert of Doom* is the best |

Cross-cutting 2026 storyline: **silver peak and crash → Iran/Hormuz oil shock → the "Cascade" into ags/fertilizer/rates → private credit stress → AI-bubble as a duration trade.**

## What could be better (recurring, ordered by frequency across agents)

1. **Buried lede.** Long anecdotes, history or "primer" sections before the thesis (Morgan Library, pajama VIX story, Lehman stories). Put the call + trade in the first 150 words; move the story to a sidebar or end.
2. **Charts without a takeaway.** Charts are embedded or referenced with no "what to see" caption. One sentence per chart.
3. **Unsourced or invented precision.** Numbers like $7.5T haircuts, "24% decoupled", game-theory parameters and scenario probabilities appear without sources; several are flagged as LLM-generated or "check my math". Internal inconsistencies exist (7% vs 30% utilization in *The Air Pocket*; Brent $75 vs $110; an 87- vs 89-day expiry). Add a sources/assumptions box and a quick consistency pass.
4. **Calls without scoring criteria.** Trades appear without size, level, horizon or invalidation; many "views" can't be graded. State what would prove you wrong and by when. (*Sugar* and *The Cascade* are the template.)
5. **Unfinished series and deferred payoffs.** *Systems 103*, *Alpha Part 5*, "post 3 of the trilogy", "next ramble", "full details later". Close or delete.
6. **Overlong, overlapping posts.** The 7-part *China Can't Win* book repeats the overview; *Don't Take the Bait* folds several essays into one; the 10k-word *Cascade: What Oil Feeds* hides its best material. Lead with a one-page summary and put appendices behind a link.
7. **Teasers and stubs.** Paywall previews give free readers nothing (some are two lines); one-line, poem and tweet-collage posts (28 posts rated 1–3) dilute the archive. Consider unpublishing or merging the weakest imports.
8. **Tone and risk.** Victory laps over "doomers", polemical framing, and stated-as-fact allegations about named private people (the SBF post, a named Shanghai trader) weaken credibility and carry legal risk. Self-scoring in annual reviews is generous.
9. **Editing artefacts.** Leftover editor notes, stale quotes in a "correction" post, wrong labels. A last-read checklist would catch these.
10. **Commercial blur.** Rose product promotion is often implicit; method for Rose indicators is "available on request". Separate product posts clearly or publish the method.

## Top 20 posts / themes to return to

Each line names the post(s), why to revisit it, and what to do. Ordered by value, weighting rating, reach and how checkable the calls are.

1. **The Cascade series** — *The Cascade* (8, ❤265), *What Oil Feeds* (8), *The Cascade Trade* (7), *A Trade as Sweet as Sugar* (8), *Down Days* (7). Dated, scorable calls (Hormuz reopening odds, 6%/12% yield-loss scenarios, UAN >$600, sugar 14→20c, grain calls). **Do:** publish the scorecard, P&L and what you missed (the Petrobras freeze).
2. **There Are Bonds in the Semiconductors** (8, ❤179) — price action since has challenged the thesis (stocks up, bonds down). **Do:** a scored follow-up on the TLT put spreads and duration-of-equities idea.
3. **The Silver Attack** (8, ❤157) — April SHFE expiry, ~30k lots to cover, premium normalization. **Do:** close the loop on what happened to the short and the premium.
4. **Silver series scorecard** — *10 Silver Days of Christmas* (8), *My Meandering Path to Silver* (7), *The Silver Squeeze* (8), *The Silver Fox* (7), *Still Long Silver*, *Silver Moon*. Gold/silver ratio 45→30 targets, margin-cascade call, $134 solar elasticity. **Do:** one "silver, graded" post; highest-reach theme.
5. **The Strip vs. The Strait + Watch Credit** (8/7, ❤156/132) — HYG puts, BDC <0.8× NAV, CPI/Fed repricing. **Do:** grade the option structures and update private-credit stress.
6. **Long APIs, Short Slides** (8, ❤121) — Capgemini short, 12–24 month IT-services estimate-cut thesis. **Do:** quarterly estimate-revision tracker.
7. **The Dragon and the Tigers** (8) — private lifer hedging as FX plumbing; you were stopped out of long TWD. **Do:** the post-mortem and the thesis rewrite.
8. **Dear Comrade Xi** (8) — pledge-repo vs title-transfer and "minimum viable work" are original. **Do:** a standalone deep piece on reserve-currency mechanics.
9. **China bank-loss model** — *Blood Transfusion or Blood on the…* (8), *Too Big to Bail* (7), *A Depression with Chinese Characteristics* (8, flagship), *China Can't Win* (rated 6, ❤218, 54 comments — your most-discussed post). **Do:** update NPL/NIM/LGFV data; the FXI/KWEB 12–18 month trade; fold the 7-part book into one clean reference piece.
10. **Whatever Happened to Alpha, Redux** (8) — the most timeless/practical post. **Do:** deliver the promised Part 5 backtest of four beta constructions and review the TLT-trim call.
11. **Conviction Through Dissonance** (8) — the linkage-confirmed, price-disagrees sizing framework is your best original idea. **Do:** test it on 3 live trades and publish the rules.
12. **Convert of Doom** (8, ❤119) — MSTR premium compression, converts need BTC >$224k. **Do:** retrospective with actual premium and issuance.
13. **Gold in China + Gold Goes West** (7/8) — multi-year thesis, lease rates, BIS swaps, location spreads. **Do:** publish the P&L on "long gold in China, short RMB" and the stress indicators.
14. **How to Short a Bubble** (7, ❤290 — top post) — reusable framework; Canadian-bank short checkable. **Do:** turn into a recurring checklist/series.
15. **Scorecards: 26 Views for 2026 / 25 for 2025 / 24 Views** (7) — compute utilization 25–30%→10–15% by 2027–29, first LGFV default, metals vs oil. **Do:** a mid-year and year-end score every year; people share accountability posts.
16. **Dollar Doomers Missing the Point + We Still Live in a World of Dollars** (7) — reconcile the dollar-network thesis with the debasement/gold trade (the open tension in your book). **Do:** one post that resolves it, using the watch-list (foreign selling of SPY/TLT, SWIFT share, Japanese insurers).
17. **A New Oil Era + The Fragile Peace + The Return of Rimland** (7/7/6) — inventory run-out, SPR timelines, "market priced a deal that didn't exist". **Do:** grade against Q3 data; strong candidates for "I was right/wrong" posts.
18. **Don't Invade the Heartland** (7) — Rimland vs Heartland conflict dataset (81% vs 10%). **Do:** release the dataset so others can check it.
19. **Systems 101: Overconfidence** (7, ❤131) — the learning-problem thesis; *Systems 103* never arrived. **Do:** finish the series; test the "no experience-learning without test-time training" claim against newer models.
20. **When You Feel Pain, Remember to Reflect + Against Entropy** (8/7) — best personal pieces (short-gamma mechanics post-mortem; most widely engaged essay). **Do:** a recurring "mistakes ledger" and one long personal essay a quarter — it is your most distinctive voice.

**Runners-up:** *Compute Constraint / S-Curve* series, *No Soup (Gallium)*, *How to Short a Startup* ("Snow Put" — embedded liquidation-preference put; worth real pricing), *What Evergrande Means to an Old China* and *Contagion Comes to California* (rated 8, but 2021–23 and nearly no reach — good candidates to republish).

## Suggested experiments (based on the evidence)

- Resurface the 9 high-rated/low-reach posts in a "best of" or as quote-links inside new posts.
- Put a one-line calls table (call, level, date, invalidation) at the top of every trade post; audit it quarterly.
- Retire or merge ~28 stub, poem and teaser posts; keep the archive at its best.
- Question-mark → declarative titles; keep titles ≤5 words; use numbers where honest.
- Hold length steady at 1.5–3k words with a one-paragraph summary at the top, since length itself isn't driving reach.
- Keep posting through quiet markets.
- Export Substack's Stats CSV (opens, views, paid conversions) to find which posts actually *converted* — reactions are a weak proxy.

## Method

Archive enumerated via Substack's public JSON API (search-term snowball to saturation, 236 posts), full bodies fetched, converted to text, split into 6 chronologically balanced chunks of ~400k characters, each read in full by a separate review agent using one rubric (insight, clarity, evidence, actionability, timelessness; overall; themes; format; falsifiable calls; improvements; return-to flag). Public engagement metrics joined by slug; statistics computed in `data/analytics_raw.txt` and `data/merge_stats.txt`.
