// Land Engine · the twelve systems scored 1–10 for the last screened parcel.
// Log scale: 5 = middle of the road, each step toward 9 is a constant multiple better.
(() => {
  const $ = (id) => document.getElementById(id);
  const fmt = (n, d = 0) => n == null || !isFinite(n) ? "–" : Number(n).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  // 5 at `mid`, 9 at `good`; works in either direction (good < mid means lower is better).
  const lr = (v, mid, good) => v == null || !isFinite(v) || v <= 0 ? null : clamp(5 + 4 * Math.log(v / mid) / Math.log(good / mid), 1, 10);
  const avg = (xs) => { const k = xs.filter((x) => x != null); return k.length ? k.reduce((a, b) => a + b, 0) / k.length : null; };
  const heat = (s) => {
    if (s == null) return "transparent";
    const t = clamp((s - 1) / 9, 0, 1), a = [255, 93, 93], b = [245, 184, 61], c = [62, 207, 142];
    const [p, q, u] = t < 4 / 9 ? [a, b, t / (4 / 9)] : [b, c, (t - 4 / 9) / (5 / 9)];
    return `rgb(${p.map((x, i) => Math.round(x + (q[i] - x) * u)).join(",")})`;
  };
  const formVals = (calc) => { const f = document.querySelector(`form.calc[data-calc="${calc}"]`); return f ? Object.fromEntries([...f.elements].filter((e) => e.name).map((e) => [e.name, parseFloat(e.value) || 0])) : {}; };
  const loaded = () => $("calcFrom") && !$("calcFrom").hidden;

  const NAMES = ["Water intelligence", "Value decomposition", "Improvement underwriting", "Market surfaces", "Counterparty intelligence", "Verification doctrine",
    "Wholesale sourcing", "The price book", "Distribution flywheel", "Financing doctrine", "Mineral asymmetry", "Livability"];

  function score(last, pr) {
    const R = Object.fromEntries(Object.entries(last.results || {}).filter(([, r]) => r && r.status !== "err")), v = last.verdict || {};
    const errs = Object.entries(last.results || {}).filter(([, r]) => r && r.status === "err").map(([k]) => k);
    const out = [];
    // 01 water: depth to groundwater
    const gw = R.wells?.num;
    out.push(gw != null ? { s: lr(gw, 150, 15), why: `water at ~${fmt(gw)} ft (5 = 150 ft, 9 = 15 ft)` }
      : { s: R.wells ? 3 : null, why: R.wells ? "no well record nearby: water unproven" : errs.includes("wells") ? "groundwater service timed out: rerun" : "not checked" });
    // 02 value decomposition: structure $/sqft vs tract, else land vs metro median
    if (pr && pr.structure > 0 && pr.sqft && pr.tractPsf) { const x = pr.structure / pr.sqft / pr.tractPsf; out.push({ s: lr(x, 1, 0.5), why: `structure at ${fmt(x, 2)}× the tract's $/sqft (5 = par, 9 = half)` }); }
    else if (R.market?.rel != null) out.push({ s: lr(R.market.rel, 1, 0.3), why: `land at ${fmt(R.market.rel, 2)}× the metro median $/acre (5 = par, 9 = 0.3×)` });
    else out.push({ s: null, why: "needs a metro land surface, or Step 2 with sqft" });
    // 03 improvement underwriting: flip uplift on all-in cost
    if (loaded() && pr && !pr.sqft) {
      const f = formVals("flip"), allin = f.raw + f.closing + f.well + f.septic + f.road + f.power + f.other, net = f.exit * (1 - f.sellCost / 100);
      out.push(allin > 0 ? { s: lr(net / allin, 1.3, 3), why: `net exit ${fmt(net / allin, 2)}× all-in cost (5 = 1.3×, 9 = 3×)` } : { s: null, why: "flip calculator empty" });
    } else out.push({ s: null, why: pr?.sqft ? "improved property: see value decomposition" : "send a vacant parcel to the calculators in Step 2" });
    // 04 market surfaces: tract appreciation 2012–22
    const g = R.market?.growth;
    out.push(g != null ? { s: lr(1 + g, 1.5, 3), why: `${g >= 0 ? "+" : ""}${fmt(g * 100)}% land appreciation 2012–22 (5 = +50%, 9 = +200%)` } : { s: null, why: "no tract time series here" });
    // 05 counterparty: days on market and seller cushion
    if (pr && (pr.dom || (pr.last && pr.value))) {
      const parts = [pr.dom ? lr(pr.dom, 60, 300) : null, pr.last && pr.value ? lr(pr.value / pr.last, 1.3, 3) : null];
      out.push({ s: avg(parts), why: [pr.dom ? `${fmt(pr.dom)} days on market` : "", pr.last && pr.value ? `ask ${fmt(pr.value / pr.last, 2)}× seller's basis` : ""].filter(Boolean).join(" · ") + " (more = more room)" });
    } else out.push({ s: null, why: "enter days on market or the seller's last sale in Step 2" });
    // 06 verification: kills and checks
    out.push(v.v ? { s: clamp(10 - 4 * (v.kills || 0) - 1.2 * (v.cautions || 0), 1, 10), why: `${v.kills} kill · ${v.cautions} check · ${v.clear} clear` } : { s: null, why: "screen a parcel" });
    // 07 wholesale sourcing: asking vs the engine's market value
    let mkt = null;
    if (pr?.value) mkt = pr.sqft ? (pr.land != null && pr.tractPsf ? pr.land + pr.tractPsf * pr.sqft : null) : (pr.acres && pr.ppa ? pr.acres * pr.ppa : null);
    out.push(mkt ? { s: lr(pr.value / mkt, 1, 0.45), why: `asking ${fmt(pr.value / mkt, 2)}× the engine's market value (5 = par, 9 = 0.45×)` } : { s: null, why: !pr?.value ? "enter a price (and acres or sqft) in Step 2" : pr.sqft ? "no structure $/sqft benchmark for this area" : "enter acres in Step 2" });
    // 08 price book: access multiplier (landlocked = −30 to −50%)
    const ad = R.access?.num;
    out.push(ad != null ? { s: lr(ad, 300, 25), why: `road ${fmt(ad)} m away (5 = 300 m, 9 = frontage); landlocked costs 30–50%` } : { s: R.access ? 1 : null, why: R.access ? "no mapped road: landlocked discount applies" : errs.includes("access") ? "road service timed out: rerun" : "not checked" });
    // 09 distribution: portfolio-level
    out.push({ s: null, why: "portfolio-level (audience), not a parcel property" });
    // 10 financing: DTI from the carry calculator
    if (loaded() && pr?.sqft) {
      const c = formVals("carry"), loan = c.price * (1 - c.down / 100), r = c.rate / 1200;
      const pmt = r ? loan * r / (1 - (1 + r) ** -360) : loan / 360;
      const tot = pmt + c.price * c.taxRate / 1200 + c.ins / 12 + (c.down < 20 ? loan * c.pmi / 1200 : 0), dti = c.income ? tot / (c.income / 12) : null;
      out.push(dti ? { s: lr(dti, 0.30, 0.12), why: `housing DTI ${fmt(dti * 100)}% (5 = 30%, 9 = 12%)` } : { s: null, why: "enter income in Carry & DTI" });
    } else out.push({ s: null, why: pr && !pr.sqft && loaded() ? "vacant land: seller carry, no bank DTI" : "send an improved property to the calculators" });
    // 11 minerals: metallic/critical sites nearby
    const m = R.mines;
    out.push(!m || m.status === "na" ? { s: null, why: "no mineral database here" }
      : m.metal ? { s: lr(m.metal, 2, 25), why: `${m.metal} metallic/critical sites within 10 km (5 = 2, 9 = 25)` }
      : { s: m.num ? 3 : 2, why: m.num ? `${m.num} sites, all stone/gravel/clay` : "no recorded mines" });
    // 12 livability: distance to freeway (quiet), walkability noted
    const td = R.traffic?.num, w = R.walk?.num;
    out.push(td != null ? { s: lr(td, 400, 1500), why: `freeway ${td >= 1500 ? "> 1.5 km" : fmt(td) + " m"} away${w != null ? ` · walkability ${fmt(w, 1)}/20` : ""} (scored for quiet)` } : { s: null, why: "not checked" });
    return out;
  }

  function render() {
    const last = window.LandEngine?.last;
    const strip = $("uwSystems"), cards = document.querySelectorAll("#systems .sys");
    if (!last) { if (strip) strip.innerHTML = ""; cards.forEach((c) => c.querySelector(".sys-score")?.remove()); return; }
    const sc = score(last, window.LE_PRICED), place = last.p?.label || last.raw || "";
    const n = (s) => s == null ? "–" : fmt(s, 1);
    if (strip) strip.innerHTML = `<div class="sysbar-h">Twelve systems, 1–10 (log scale, 5 = middle of the road) · <a href="#systems">what they mean</a></div><div class="sysbar">` +
      sc.map((x, i) => `<div class="sysc" title="${esc(x.why)}"><span>${String(i + 1).padStart(2, "0")} ${esc(NAMES[i])}</span><b style="color:${x.s == null ? "var(--faint)" : heat(x.s)}">${n(x.s)}</b><i class="sbar"><i style="width:${x.s == null ? 0 : (x.s / 10) * 100}%;background:${heat(x.s)}"></i><u></u></i><small>${esc(x.why)}</small></div>`).join("") + "</div>";
    cards.forEach((c, i) => {
      const x = sc[i]; if (!x) return;
      let el = c.querySelector(".sys-score"); if (!el) { el = document.createElement("div"); el.className = "sys-score"; c.appendChild(el); }
      el.innerHTML = `<b style="color:${x.s == null ? "var(--faint)" : heat(x.s)}">${n(x.s)}<em>/10</em></b><span>${esc(place)}</span><small>${esc(x.why)}</small>`;
    });
    const sh = $("sysFor"); if (sh) sh.textContent = place ? `Scored for ${place}. Screen another parcel above to rescore.` : "";
  }
  let pending = false;
  document.addEventListener("le:reset", () => { pending = true; if ($("uwSystems")) $("uwSystems").innerHTML = ""; document.querySelectorAll("#systems .sys-score").forEach((x) => x.remove()); if ($("sysFor")) $("sysFor").textContent = ""; });
  document.addEventListener("le:screened", () => { pending = false; setTimeout(render, 0); });
  document.addEventListener("le:priced", () => { if (!pending) setTimeout(render, 0); });
  document.addEventListener("input", (e) => { if (!pending && e.target.closest("form.calc")) render(); });
  window.LE_SYSTEMS = { score, render };
})();
