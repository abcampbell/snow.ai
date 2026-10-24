// Land Engine · US parcel census section (data/census/summary.json, built by parcels/tools/build_census_summary.py).
(() => {
  const $ = (id) => document.getElementById(id);
  if (!$("czKpis")) return;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n) => n == null ? "–" : Math.round(n).toLocaleString("en-US");
  const compact = (v) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(v);
  const pct = (v, d = 1) => v == null ? "–" : `${(v * 100).toFixed(d)}%`;
  const money = (v) => v == null ? "–" : v >= 1e12 ? `$${(v / 1e12).toFixed(1)}T` : v >= 1e9 ? `$${(v / 1e9).toFixed(0)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${Math.round(v)}`;
  const row = (label, bars, value, cls = "") => `<div class="cz-row ${cls}"><span class="cz-lab">${label}</span><span class="cz-track">${bars}</span><span class="cz-val">${value}</span></div>`;
  const bar = (w, c) => `<i class="cz-bar ${c}" style="width:${Math.max(0.6, w * 100).toFixed(1)}%"></i>`;

  fetch("data/census/summary.json?v=20261024").then((r) => r.json()).then((d) => {
    const h = d.headline;
    $("czKpis").innerHTML = [
      [compact(h.parcels_all), "parcels counted, all 50 states and DC"],
      [compact(h.ge10), `are 10+ acres (${pct(h.share_ge10)} of parcels)`],
      [pct(h.share_acres_ge10, 0), "of parceled land sits in those 10+ acre parcels"],
      [money(h.value), "estimated land value, 2022 prices"]
    ].map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join("");

    const bins = d.bins, maxShare = Math.max(...bins.map((b) => Math.max(b.share_parcels, b.share_acres || 0)));
    $("czShare").innerHTML = `<div class="cz-key"><span><i class="cz-sw a"></i>share of parcels</span><span><i class="cz-sw b"></i>share of land</span></div>` +
      bins.map((b) => row(`${esc(b.label)} ac`, bar(b.share_parcels / maxShare, "a") + bar((b.share_acres || 0) / maxShare, "b"),
        `${pct(b.share_parcels, 0)} · ${b.share_acres == null ? "n/a" : pct(b.share_acres, 0)}`, "pair")).join("");

    const ex = d.exceed, lmax = Math.log10(Math.max(...ex.map((e) => e.parcels))), lmin = 3;
    $("czExceed").innerHTML = ex.map((e) => row(`${fmt(e.threshold)}+ ac`, bar((Math.log10(Math.max(e.parcels, 10)) - lmin) / (lmax - lmin), "a"), compact(e.parcels))).join("") +
      `<p class="cz-foot">Log scale. The steps at 40, 160 and 640 acres are the federal survey grid: a quarter-quarter, a quarter and a full section.</p>`;

    const vmax = Math.max(...bins.map((b) => b.value));
    $("czValue").innerHTML = bins.map((b) => row(`${esc(b.label)} ac`, bar(b.value / vmax, "a"), `${money(b.value)} · ${money(b.ppa)}/ac`)).join("") +
      `<p class="cz-foot">Value = acres × price: residential land $/ac (FHFA 2022) under 1 acre, farm real estate $/ac (USDA 2022) from 10 acres, the geometric mean between. The BEA put all US land at about $23T in 2009.</p>`;

    const drawStates = () => {
      const k = $("czSort").value;
      const st = [...d.states].sort((a, b) => (b[k] ?? -1) - (a[k] ?? -1)).slice(0, 15), m = Math.max(...st.map((s) => s[k] || 0));
      const show = { share_ge10: (s) => pct(s.share_ge10), ge40: (s) => compact(s.ge40), ge640: (s) => compact(s.ge640), value: (s) => money(s.value) }[k];
      $("czStates").innerHTML = st.map((s) => {
        const lab = s.state === "NV" ? `<a href="nevada.html">NV ↗</a>` : esc(s.state);
        return row(lab, bar((s[k] || 0) / m, s.state === "NV" ? "b" : "a"), show(s), s.state === "NV" ? "hl" : "");
      }).join("");
    };
    $("czSort").addEventListener("change", drawStates); drawStates();
    $("czCover").textContent = `Counted ${d.counted_on} from ${d.sources} public county and state parcel services, covering ${pct(h.share_land, 0)} of US land (most of the rest is federal land that many states don't parcel, plus ${fmt(h.counties_missing)} counties with no public parcel service). First pass: urban condo records and some bad acreage fields are not yet cleaned, and ${compact(h.no_size)} parcels have no recorded size.`;
  }).catch(() => { $("czKpis").innerHTML = `<p class="note">The census summary didn't load. Reload the page to try again.</p>`; });
})();
