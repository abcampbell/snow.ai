// Land Engine step 2: price the screened place, decompose land vs. structure,
// and feed the deal calculators. Live values via the user's own RentCast key
// (kept in this browser's localStorage only); otherwise one-click lookups on
// Zillow / Redfin / homes.com / Realtor and manual entry.
(() => {
  const RC = "https://api.rentcast.io/v1";
  const KEY_STORE = "le_rentcast_key";
  const WHOLESALE_SPREAD = 2.25; // price book: wholesale -> retail, raw rural land
  const $ = (id) => document.getElementById(id);
  const fmt = (n, d = 0) => n == null || !isFinite(n) ? "–" : Number(n).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
  const usd = (n) => n == null || !isFinite(n) ? "–" : (n < 0 ? "−$" : "$") + fmt(Math.abs(n));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const getKey = () => { try { return localStorage.getItem(KEY_STORE) || ""; } catch { return ""; } };
  const setKey = (k) => { try { k ? localStorage.setItem(KEY_STORE, k) : localStorage.removeItem(KEY_STORE); } catch { /* storage blocked */ } };

  let ctx = null;       // last underwriter screen
  let assessor = null;  // { year, land, improvements, value } from county tax roll

  const num = (name) => { const v = parseFloat($("psForm").elements[name].value); return isFinite(v) ? v : null; };
  const setField = (name, v) => { const el = $("psForm").elements[name]; if (el && v != null && isFinite(v)) el.value = Math.round(v * 100) / 100; };

  function landRate() {
    const m = ctx?.results?.market;
    if (!m || m.num == null) return null;
    return { ppa: m.num, label: m.surface?.fhfa ? `FHFA tract, ${m.surface.label}` : m.surface ? `${m.surface.label} zone estimate` : /\(cty\)/.test(m.cell || "") ? "FHFA county residential" : "regional band midpoint" };
  }

  function derive() {
    if (!ctx) return;
    const value = num("value"), acres = num("acres"), sqft = num("sqft"), last = num("lastSale"), lastYear = num("lastSaleYear"), dom = num("dom");
    const rate = landRate();
    const yearsHeld = lastYear ? Math.max(0, new Date().getFullYear() + new Date().getMonth() / 12 - lastYear) : null;
    const landBySurface = rate && acres ? rate.ppa * acres : null;
    const landShareAssessor = assessor && assessor.value ? assessor.land / assessor.value : null;
    const landByAssessor = landShareAssessor != null && value ? value * landShareAssessor : null;
    const tractShare = ctx.results?.market?.share;
    const landByTract = landByAssessor == null && tractShare != null && value && sqft ? value * tractShare : null;
    const land = landByAssessor ?? landByTract ?? landBySurface;
    const landLabel = landByAssessor != null ? "Land (assessor split)" : landByTract != null ? "Land (FHFA tract share)" : "Land (acres × $/ac)";
    const structure = value != null && land != null && sqft ? value - land : null;
    const k = [];
    if (value) k.push(["Value", usd(value), "accent"]);
    if (value && sqft) k.push(["Blended $/sqft", usd(value / sqft)]);
    if (land != null && sqft) k.push([landLabel, `${usd(land)}${value ? ` · ${fmt((land / value) * 100)}%` : ""}`]);
    if (structure != null) k.push(["Structure-only $/sqft", structure > 0 ? usd(structure / sqft) : "land ≥ value", structure > 0 ? "" : "bad"]);
    if (value && acres) k.push(["Price per acre", usd(value / acres)]);
    if (rate && value && acres && !sqft) {
      const prem = value / acres / rate.ppa;
      k.push(["vs. area land $/ac", `${fmt(prem, 2)}×`, prem > 1.5 ? "bad" : prem < 0.8 ? "good" : ""]);
    }
    if (last && value) k.push(["Seller cushion", `${usd(value - last)}${yearsHeld != null ? ` · ${fmt(yearsHeld, 1)} yrs held` : ""}`, yearsHeld != null && yearsHeld < 2 ? "good" : ""]);
    const notes = [];
    if (rate) notes.push(`Land rate: ~${usd(rate.ppa)}/acre (${rate.label}).`);
    const tractPsf = ctx.results?.market?.spsf;
    if (tractPsf && structure != null && structure > 0 && sqft) notes.push(`Tract benchmark: structures here price at ~${usd(tractPsf)}/sqft, so this one is ${(structure / sqft / tractPsf).toFixed(2)}× the neighborhood.`);
    if (assessor) notes.push(`County assessor ${assessor.year}: land ${usd(assessor.land)}, improvements ${usd(assessor.improvements)}. The assessor's land share is the primary decomposition; acres × $/acre is the cross-check.`);
    if (!sqft && value && acres) notes.push(`Vacant land: the note-machine basis assumes wholesale acquisition near 1/${WHOLESALE_SPREAD} of this retail value.`);
    $("psDerived").innerHTML = (k.length ? `<div class="kpis">${k.map(([a, b, c]) => `<div class="kpi ${c || ""}"><span>${a}</span><b>${b}</b></div>`).join("")}</div>` : "") +
      (notes.length ? `<p class="note">${notes.join(" ")}</p>` : "");
    $("psSend").disabled = !value;
    const out = { value, acres, sqft, last, yearsHeld, dom, land, structure, ppa: rate?.ppa, tractPsf };
    window.LE_PRICED = out;
    document.dispatchEvent(new CustomEvent("le:priced", { detail: out }));
    return out;
  }

  function lookupLinks(p) {
    const addr = p.label || p.query, q = (site) => `https://www.google.com/search?q=${encodeURIComponent(`"${addr}" site:${site}`)}`;
    const zillow = `https://www.zillow.com/homes/${encodeURIComponent(addr.replace(/,/g, "")).replace(/%20/g, "-")}_rb/`;
    const links = [["Zillow ↗", zillow], ["Redfin ↗", q("redfin.com")], ["homes.com ↗", q("homes.com")], ["Realtor.com ↗", q("realtor.com")], ["LandWatch ↗", q("landwatch.com")]];
    if (/^https?:\/\//i.test(ctx.raw || "")) links.unshift(["Your listing ↗", ctx.raw]);
    return links.map(([t, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${t}</a>`).join("");
  }

  function render() {
    const p = ctx.p;
    assessor = null;
    $("psForm").reset();
    const pa = ctx.results?.parcel;
    if (pa?.acres) $("psForm").elements.acres.value = Math.round(pa.acres * 100) / 100;
    $("psLinks").innerHTML = lookupLinks(p) + (pa?.url ? ` <a href="${pa.url}" target="_blank" rel="noopener">County assessor (APN ${pa.cell}) ↗</a>` : "");
    $("psStatus").textContent = getKey() ? "RentCast key set in this browser." : "Paste the list price or estimate from any site, or add a RentCast key to auto-fill.";
    $("psStatus").className = "uw-status";
    $("psAddr").textContent = p.label || p.query;
    $("priceStep").hidden = false;
    derive();
  }

  async function rc(path, params) {
    const r = await fetch(`${RC}${path}?${new URLSearchParams(params)}`, { headers: { "X-Api-Key": getKey(), Accept: "application/json" } });
    if (r.status === 401 || r.status === 403) throw new Error("RentCast rejected the key.");
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`RentCast HTTP ${r.status}`);
    return r.json();
  }

  async function autofill() {
    if (!ctx) return;
    if (!getKey()) { $("psKeyRow").hidden = false; $("psKey").focus(); return; }
    const addr = ctx.p.label || ctx.p.query, st = $("psStatus");
    st.textContent = "Querying RentCast (property record, active listing, value estimate)…"; st.className = "uw-status";
    const got = [];
    try {
      const [props, listings, avm] = await Promise.all([
        rc("/properties", { address: addr }).catch((e) => { if (/key/.test(e.message)) throw e; return null; }),
        rc("/listings/sale", { address: addr, status: "Active", limit: 1 }).catch((e) => { if (/key/.test(e.message)) throw e; return null; }),
        rc("/avm/value", { address: addr, compCount: 5 }).catch((e) => { if (/key/.test(e.message)) throw e; return null; })
      ]);
      const prop = Array.isArray(props) ? props[0] : props;
      const lst = Array.isArray(listings) ? listings[0] : listings;
      if (prop) {
        if (prop.squareFootage) { setField("sqft", prop.squareFootage); got.push("sqft"); }
        if (prop.lotSize) { setField("acres", prop.lotSize / 43560); got.push("lot size"); }
        if (prop.lastSalePrice) { setField("lastSale", prop.lastSalePrice); got.push("last sale"); }
        if (prop.lastSaleDate) { const d = new Date(prop.lastSaleDate); setField("lastSaleYear", d.getFullYear() + d.getMonth() / 12); }
        const ta = prop.taxAssessments && Object.entries(prop.taxAssessments).sort((a, b) => +b[0] - +a[0])[0];
        if (ta && ta[1] && ta[1].land != null && ta[1].value) { assessor = { year: ta[0], ...ta[1] }; got.push("assessor land/improvement split"); }
      }
      if (lst && lst.price) {
        setField("value", lst.price); $("psForm").elements.source.value = "listing";
        if (lst.daysOnMarket != null) setField("dom", lst.daysOnMarket);
        got.push(`active listing ${usd(lst.price)}`);
      } else if (avm && avm.price) {
        setField("value", avm.price); $("psForm").elements.source.value = "estimate";
        got.push(`value estimate ${usd(avm.price)} (range ${usd(avm.priceRangeLow)}–${usd(avm.priceRangeHigh)}, ${avm.comparables?.length || 0} comps)`);
      }
      st.textContent = got.length ? `Filled: ${got.join(", ")}.` : "RentCast has no record for this address (common for raw land). Enter values manually.";
      st.className = got.length ? "uw-status" : "uw-status is-err";
    } catch (e) {
      st.textContent = e.message || "RentCast lookup failed."; st.className = "uw-status is-err";
      if (/key/.test(e.message)) $("psKeyRow").hidden = false;
    }
    derive();
  }

  function setCalc(calc, values) {
    const form = document.querySelector(`form.calc[data-calc="${calc}"]`);
    if (!form) return;
    for (const [k, v] of Object.entries(values)) if (v != null && isFinite(v) && form.elements[k]) form.elements[k].value = Math.round(v * 10) / 10;
    form.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function send() {
    const d = derive();
    if (!d || !d.value) return;
    const vacant = !d.sqft;
    setCalc("offer", { list: d.value, basis: d.last, years: d.yearsHeld, dom: d.dom });
    setCalc("carry", { price: d.value });
    if (vacant) {
      setCalc("note", { sale: d.value, basis: d.value / WHOLESALE_SPREAD, down: d.value * 0.1 });
      setCalc("flip", { raw: d.value });
    }
    const pane = vacant ? "p-note" : "p-offer";
    document.querySelector(`[data-tabs="calc"] .tab[data-pane="${pane}"]`).click();
    $("calcFrom").innerHTML = `Loaded from <b>${esc(ctx.p.label || ctx.p.query)}</b>: ${vacant ? "note machine and flip (vacant land)" : "offer pricer and carry"}, plus carry for all.`;
    $("calcFrom").hidden = false;
    $("calculators").scrollIntoView({ behavior: "smooth" });
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("psForm").addEventListener("input", derive);
    $("psForm").addEventListener("submit", (e) => e.preventDefault());
    $("psAuto").addEventListener("click", autofill);
    $("psSend").addEventListener("click", send);
    $("psKeyBtn").addEventListener("click", () => { $("psKeyRow").hidden = !$("psKeyRow").hidden; });
    $("psKeySave").addEventListener("click", () => {
      setKey($("psKey").value.trim()); $("psKey").value = ""; $("psKeyRow").hidden = true;
      $("psStatus").textContent = getKey() ? "Key saved in this browser only. Click Auto-fill." : "Key cleared."; $("psStatus").className = "uw-status";
    });
  });
  document.addEventListener("le:reset", () => {
    const el = $("priceStep"); if (el) el.hidden = true;
    if ($("psForm")) $("psForm").reset();
    window.LE_PRICED = null;
    if ($("psSend")) $("psSend").disabled = true;
    if ($("calcFrom") && !$("calcFrom").hidden) { // a previous deal was loaded: put the calculators back to their defaults
      $("calcFrom").hidden = true; $("calcFrom").innerHTML = "";
      document.querySelectorAll("form.calc[data-calc]").forEach((f) => { f.reset(); f.dispatchEvent(new Event("input", { bubbles: true })); });
    }
  });
  document.addEventListener("le:screened", (e) => { ctx = e.detail; render(); });
})();
