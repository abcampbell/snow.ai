// Land Engine calculators: note machine, improvement flip, offer pricer, carry.
(() => {
  const fmt = (n, d = 0) => n == null || !isFinite(n) ? "–" : Number(n).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
  const usd = (n) => n == null || !isFinite(n) ? "–" : (n < 0 ? "−$" : "$") + fmt(Math.abs(n));
  const pct = (n, d = 1) => n == null || !isFinite(n) ? "–" : `${fmt(n * 100, d)}%`;

  // IRR on monthly cash flows, annualized. Bisection on the monthly rate.
  function irr(cfs) {
    const npv = (r) => cfs.reduce((a, c, t) => a + c / (1 + r) ** t, 0);
    let lo = -0.99, hi = 1.0, flo = npv(lo), fhi = npv(hi);
    if (!isFinite(flo) || !isFinite(fhi) || flo * fhi > 0) return null;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2, f = npv(mid);
      if (Math.abs(f) < 1e-7) { lo = hi = mid; break; }
      if (flo * f < 0) { hi = mid; fhi = f; } else { lo = mid; flo = f; }
    }
    return (1 + (lo + hi) / 2) ** 12 - 1;
  }
  const pmt = (principal, ratePct, n) => { const r = ratePct / 100 / 12; return r ? principal * r / (1 - (1 + r) ** -n) : principal / n; };
  const vals = (form) => Object.fromEntries([...form.querySelectorAll("input")].map((i) => [i.name, parseFloat(i.value) || 0]));
  const table = (rows, head) => `<table class="out-table">${head ? `<thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead>` : ""}<tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<${i ? "td" : "th"}>${c}</${i ? "td" : "th"}>`).join("")}</tr>`).join("")}</tbody></table>`;
  const kpis = (items) => `<div class="kpis">${items.map(([k, v, cls]) => `<div class="kpi ${cls || ""}"><span>${k}</span><b>${v}</b></div>`).join("")}</div>`;

  // ---- Note machine: buy wholesale, sell retail on seller-financed terms ----
  function noteCashflows(v, defaultAfter) {
    const loan = v.sale - v.down, pay = pmt(loan, v.rate, v.term), months = v.sellMonth + v.term + 1;
    const cf = new Array(months + v.relist + v.term + 4).fill(0);
    cf[0] -= v.basis;
    for (let t = 1; t <= v.sellMonth; t++) cf[t] -= v.tax / 12;
    cf[v.sellMonth] += v.down;
    const paidMonths = defaultAfter == null ? v.term : Math.min(defaultAfter, v.term);
    for (let k = 1; k <= paidMonths; k++) cf[v.sellMonth + k] += pay;
    if (defaultAfter != null && defaultAfter < v.term) {
      // Buyer stops paying: you keep everything paid, retake the land, relist, and resell on the same terms.
      const back = v.sellMonth + defaultAfter;
      for (let t = back + 1; t <= back + v.relist; t++) cf[t] -= v.tax / 12;
      const resale = back + v.relist;
      cf[resale] += v.down;
      for (let k = 1; k <= v.term; k++) cf[resale + k] = (cf[resale + k] || 0) + pay;
    }
    while (cf.length && cf[cf.length - 1] === 0) cf.pop();
    return { cf, pay };
  }
  function calcNote(form, out) {
    const v = vals(form);
    if (v.sale <= v.down || v.term <= 0 || v.basis <= 0) { out.innerHTML = "<p class='warn'>Check inputs: sale price must exceed down payment.</p>"; return; }
    const perf = noteCashflows(v, null), dflt = noteCashflows(v, v.defaultMonth);
    const collected = perf.cf.reduce((a, c) => a + Math.max(c, 0), 0);
    const irrP = irr(perf.cf), irrD = irr(dflt.cf);
    const blended = irrP != null && irrD != null ? irrP * (1 - v.defaultRate / 100) + irrD * (v.defaultRate / 100) : null;
    out.innerHTML = kpis([
      ["Monthly payment", usd(perf.pay)],
      ["Down payment recovers", pct(v.down / v.basis, 0) + " of basis", v.down / v.basis >= 0.3 ? "good" : ""],
      ["IRR, buyer performs", pct(irrP), "good"],
      [`IRR, default at month ${v.defaultMonth}`, pct(irrD)],
      [`Blended IRR at ${v.defaultRate}% default`, pct(blended), "accent"],
      ["Gross multiple, performing", `${fmt(collected / v.basis, 2)}×`]
    ]) + `<p class="note">On default you keep the down payment and every payment made, retake the parcel, and resell it after ${v.relist} months on the same terms. That is why defaults usually raise the return rather than lower it.</p>`;
  }

  // ---- Improvement flip: raw land + well, septic, access -> off-grid ready ----
  function calcFlip(form, out) {
    const v = vals(form);
    const improve = v.well + v.septic + v.road + v.power + v.other;
    const allIn = v.raw + v.closing + improve + v.tax * v.hold / 12;
    const net = v.exit * (1 - v.sellCost / 100);
    const flows = (exit, hold) => {
      const cf = new Array(hold + 1).fill(0);
      cf[0] -= v.raw + v.closing; cf[Math.min(3, hold)] -= improve;
      for (let t = 1; t <= hold; t++) cf[t] -= v.tax / 12;
      cf[hold] += exit * (1 - v.sellCost / 100);
      return cf;
    };
    const base = irr(flows(v.exit, v.hold));
    const breakeven = (allIn) / (1 - v.sellCost / 100);
    const exits = [0.8, 0.9, 1, 1.1, 1.2].map((k) => v.exit * k), holds = [12, 18, 24, 36];
    const grid = holds.map((h) => [`${h} mo`, ...exits.map((e) => { const r = irr(flows(e, h)); return `<span class="${r == null ? "" : r >= 0.35 ? "hi" : r < 0 ? "lo" : ""}">${pct(r, 0)}</span>`; })]);
    out.innerHTML = kpis([
      ["Improvements", usd(improve)],
      ["All-in cost", usd(allIn)],
      ["Net profit", usd(net - allIn), net > allIn ? "good" : "bad"],
      ["Multiple on cost", `${fmt(net / allIn, 2)}×`],
      ["IRR", pct(base), "accent"],
      ["Breakeven exit price", usd(breakeven)]
    ]) + `<h5>IRR by exit price and hold period</h5>` + table(grid, ["Hold", ...exits.map((e) => usd(e))]);
  }

  // ---- Offer pricer: seller basis + hold + days on market -> offer range ----
  // Heuristics from the GBLC negotiation doctrine; they are rules of thumb, not a statistical model.
  function calcOffer(form, out) {
    const v = vals(form);
    const cushion = v.list - v.basis, cushionPct = v.basis ? cushion / v.list : 0;
    let m = 0; const why = [];
    if (v.dom >= 180) { m += 30; why.push(`${fmt(v.dom)} days on market (stale)`); } else if (v.dom >= 90) { m += 18; why.push(`${fmt(v.dom)} days on market`); } else if (v.dom >= 45) { m += 8; }
    if (v.years < 2) { m += 28; why.push(`held ${fmt(v.years, 1)} yrs: likely a flipper paying carry`); } else if (v.years > 8) { m -= 8; why.push(`held ${fmt(v.years)} yrs: equity-rich, no pressure`); }
    if (v.cuts >= 5) { m += 15; why.push(`${fmt(v.cuts)}% already cut`); } else if (v.cuts > 0) m += 6;
    if (cushionPct < 0.12 && v.basis) { m += 12; why.push("thin equity cushion"); }
    m = Math.max(0, Math.min(100, m));
    const d = 0.03 + (m / 100) * 0.12;
    const open = v.list * (1 - d), target = v.list * (1 - d * 0.55);
    const floor = v.years < 2 && v.basis ? v.basis * 1.07 : null;
    const openAdj = floor ? Math.max(open, floor) : open;
    out.innerHTML = kpis([
      ["Seller motivation", `${fmt(m)} / 100`, m >= 50 ? "good" : ""],
      ["Seller equity cushion", v.basis ? `${usd(cushion)} (${pct(cushionPct, 0)})` : "enter basis"],
      ["Opening offer", usd(openAdj), "accent"],
      ["Likely landing", usd(target)],
      ["Flipper floor (basis + ~7% costs)", floor ? usd(floor) : "n/a"],
      ["Open, % off list", pct(1 - openAdj / v.list, 1)]
    ]) + `<p class="note">${why.length ? "Drivers: " + why.join(" · ") + "." : "No strong motivation signals; expect a small discount."}
      Ask for a closing-cost credit before a price cut: the seller nets the same, and the recorded price keeps comps intact. Look up the seller's purchase date and price in county records before you write the offer.</p>`;
  }

  // ---- Carry: monthly cost of owning and the debt-to-income check ----
  function calcCarry(form, out) {
    const v = vals(form);
    const loan = v.price * (1 - v.down / 100), pi = pmt(loan, v.rate, 360);
    const tax = v.price * v.taxRate / 100 / 12, ins = v.ins / 12;
    const pmi = v.down < 20 ? loan * v.pmi / 100 / 12 : 0;
    const total = pi + tax + ins + pmi, dti = v.income ? total / (v.income / 12) : null;
    out.innerHTML = kpis([
      ["Cash down", usd(v.price * v.down / 100)],
      ["Principal + interest", usd(pi)],
      ["Tax + insurance", usd(tax + ins)],
      ["PMI", pmi ? usd(pmi) : "none at 20% down"],
      ["Monthly carry", usd(total), "accent"],
      ["Housing DTI", dti == null ? "–" : pct(dti, 0), dti == null ? "" : dti <= 0.28 ? "good" : dti > 0.36 ? "bad" : ""]
    ]) + `<p class="note">Lenders typically cap total debt-to-income near 43–45%; 28% is the comfortable housing-only line. PMI drops off once equity reaches about 22%.</p>`;
  }

  const CALCS = { note: calcNote, flip: calcFlip, offer: calcOffer, carry: calcCarry };
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("form.calc[data-calc]").forEach((form) => {
      const out = form.parentElement.querySelector(".calc-out"), fn = CALCS[form.dataset.calc];
      const go = () => fn(form, out);
      form.addEventListener("input", go); form.addEventListener("submit", (e) => e.preventDefault());
      go();
    });
  });
})();
