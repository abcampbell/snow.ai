// Nevada Land Finder: every parcel of 10+ acres, filterable, drawn true to scale on the map.
(() => {
  const STUB = { value: "", checked: false, addEventListener() {}, insertAdjacentHTML() {}, set textContent(v) {}, set innerHTML(v) {}, querySelector() { return null; } };
  const $ = (id) => document.getElementById(id) || STUB; // a page from an older version can lack newer controls
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n, d = 0) => n == null || !isFinite(n) ? "–" : Number(n).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
  const money = (v) => v == null || !isFinite(v) ? "–" : v >= 1e6 ? `$${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${Math.round(v)}`;
  const NDWR = "https://arcgis.water.nv.gov/arcgis/rest/services";
  const PAL = ["#1c3f95", "#2f6fd0", "#6aa8e8", "#b9c3cc", "#f2b36a", "#e8673c", "#c3212b"]; // cheap/shallow (blue) -> expensive/deep (red)
  const SPECIES = ["", "", "", "Mule deer", "Elk", "Antelope", "Bighorn sheep", "Mountain goat", "Mountain lion", "Black bear"];

  let D = null, C = {}, rows = [], shown = [], listings = [], sel = null;
  const isPrivate = (i) => { const o = D?.own?.[i]; return !o || /^(pvt|private|p)$/i.test(String(o[0])) || /private/i.test(String(o[1])); };
  const ownName = (i) => { const o = D?.own?.[i]; return o ? (o[1] || o[0]) : "unknown"; };
  // NDOW lists the biologist assigned to each species in a unit; a name means the unit manages that species.
  const has = (v) => String(v ?? "").trim() !== "";
  const DESIG = { D: "designated basin", PU: "designated, preferred uses ordered", PUID: "designated, preferred uses and irrigation limits", ID: "designated, irrigation limits" };
  const apnKey = (s) => String(s || "").toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/^0+/, "");

  // ---------- map ----------
  const map = L.map("nvMap", { preferCanvas: true, zoomControl: true }).setView([38.6, -116.9], 6);
  const ctl = window.LE_LAYERS(map, { position: "topright", base: "dark" });
  if (L.esri) {
    ctl.addOverlay(L.esri.dynamicMapLayer({ url: `${NDWR}/BaseLayers/County_Parcels_In_Nevada_Yellow/MapServer`, minZoom: 13, opacity: 0.9 }), "Parcel lines (zoom in)");
    ctl.addOverlay(L.esri.dynamicMapLayer({ url: `${NDWR}/NDWR/Water_Rights_Places_of_Use/MapServer`, minZoom: 9, opacity: 0.55 }), "Water rights: places of use (≥9)");
    ctl.addOverlay(L.esri.dynamicMapLayer({ url: `${NDWR}/NDWR/Water_Rights_Points_of_Diversion/MapServer`, minZoom: 11, opacity: 0.9 }), "Water rights: points of diversion (≥11)");
    ctl.addOverlay(L.esri.dynamicMapLayer({ url: `${NDWR}/NDWR/Basins_State_Engineer_Designation_Orders/MapServer`, opacity: 0.4 }), "Designated groundwater basins");
    ctl.addOverlay(L.esri.dynamicMapLayer({ url: `${NDWR}/BaseLayers/BLM_Grazing_Allotments/MapServer`, opacity: 0.4 }), "BLM grazing allotments");
    ctl.addOverlay(L.esri.featureLayer({ url: "https://services.arcgis.com/cJ9YHowT8TU7DUyn/arcgis/rest/services/Water_System_Boundaries/FeatureServer/0",
      where: "PWSID LIKE 'NV%'", fields: ["OBJECTID", "PWS_Name", "Population_Served_Count"], simplifyFactor: 0.5, precision: 5,
      style: () => ({ color: "#4dabf7", weight: 1, fillOpacity: 0.18 }) })
      .bindPopup((l) => `<b>${esc(l.feature.properties.PWS_Name)}</b><br>Public water system · serves ${fmt(l.feature.properties.Population_Served_Count)}`), "City water (public water systems)");
    ctl.addOverlay(L.esri.featureLayer({ url: "https://services.arcgis.com/RyxlXSfFi87rAosq/arcgis/rest/services/NDOW_Hunt_Unit_Boundaries/FeatureServer/3",
      fields: ["OBJECTID", "HUNTUNIT", "Deer", "Elk", "Antelope", "Sheep", "Goat", "Lion", "Bear"], simplifyFactor: 0.6, precision: 4,
      style: () => ({ color: "#f59f00", weight: 1.2, fill: false, dashArray: "4 3" }) })
      .bindPopup((l) => { const p = l.feature.properties; return `<b>Hunt unit ${esc(p.HUNTUNIT)}</b><br>${["Deer", "Elk", "Antelope", "Sheep", "Goat", "Lion", "Bear"].filter((k) => String(p[k] ?? "").trim()).join(", ") || "no big game managed"}`; }), "Hunt units (NDOW)");
  }

  // True-to-scale squares for parcels; rebuilt on every move.
  const SquareLayer = L.Layer.extend({
    initialize(opts) { this.o = opts; this.items = []; this.hits = []; },
    onAdd(m) {
      this._m = m; this._c = L.DomUtil.create("canvas", "leaflet-zoom-hide");
      this._c.style.position = "absolute"; this._c.style.pointerEvents = "none";
      m.getPanes().overlayPane.appendChild(this._c);
      m.on("moveend zoomend resize", this._draw, this); if (this.o.click) m.on("click", this._click, this); this._draw();
    },
    onRemove(m) { L.DomUtil.remove(this._c); m.off("moveend zoomend resize", this._draw, this); m.off("click", this._click, this); },
    set(items) { this.items = items; if (this._m) this._draw(); },
    _draw() {
      const m = this._m, s = m.getSize(), r = window.devicePixelRatio || 1, c = this._c;
      L.DomUtil.setPosition(c, m.containerPointToLayerPoint([0, 0]));
      c.width = s.x * r; c.height = s.y * r; c.style.width = `${s.x}px`; c.style.height = `${s.y}px`;
      const g = c.getContext("2d"); g.setTransform(r, 0, 0, r, 0, 0); g.clearRect(0, 0, s.x, s.y);
      const z = m.getZoom(), b = m.getBounds().pad(0.05), hits = [];
      for (const it of this.items) {
        if (!b.contains([it.lat, it.lon])) continue;
        const p = m.latLngToContainerPoint([it.lat, it.lon]);
        const side = this.o.size ? this.o.size(it, z) : 4, h = side / 2;
        g.fillStyle = this.o.color(it); g.globalAlpha = this.o.alpha ? this.o.alpha(it, z) : 0.85;
        g.fillRect(p.x - h, p.y - h, side, side);
        if (it === sel) { g.globalAlpha = 1; g.strokeStyle = "#ffffff"; g.lineWidth = 2; g.strokeRect(p.x - h - 2, p.y - h - 2, side + 4, side + 4); }
        hits.push([p.x, p.y, Math.max(5, h + 2), it]);
      }
      this.hits = hits;
    },
    _click(e) {
      const p = e.containerPoint; let best = null, bd = Infinity;
      for (const [x, y, rr, it] of this.hits) { const d = Math.hypot(p.x - x, p.y - y); if (d <= rr && d < bd) { bd = d; best = it; } }
      if (best) this.o.click(best);
    }
  });
  const mpp = (z, lat) => 156543.03 * Math.cos(lat * Math.PI / 180) / Math.pow(2, z);
  const colorBy = () => $("fColor").value;
  const ramp = (v, lo, hi, log = true) => {
    if (v == null) return "#5c6370";
    const t = log ? (Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo)) : (v - lo) / (hi - lo);
    return PAL[Math.max(0, Math.min(PAL.length - 1, Math.floor(t * PAL.length)))];
  };
  const parcelLayer = new SquareLayer({
    size: (it, z) => Math.max(z <= 7 ? 2 : 3, Math.min(400, Math.sqrt(it.acres * 4046.86) / mpp(z, it.lat))),
    alpha: (it, z) => z >= 14 ? 0.35 : 0.85,
    color: (it) => {
      const k = colorBy();
      if (k === "swl") return ramp(it.swl, 20, 800);
      if (k === "avail") return it.avail ? "#3ecf8e" : "#4a5260";
      return ramp(it.ask_ppa ?? it.ppa, 300, 300000);
    },
    click: (it) => select(it, false)
  }).addTo(map);

  // depth-to-water wells (loaded on demand)
  const wellLayer = new SquareLayer({ size: (it, z) => (z >= 11 ? 5 : 3), color: (it) => ramp(it.swl, 20, 800), alpha: () => 0.9 });
  let wellsLoaded = false;
  ctl.addOverlay(wellLayer, "Depth to water: well logs (NDWR)");
  map.on("overlayadd", async (e) => {
    if (e.layer !== wellLayer || wellsLoaded) return;
    wellsLoaded = true;
    const w = await fetch("data/nevada/wells.json?v=20261024").then((r) => r.json());
    wellLayer.set(w.w.map(([lat, lon, swl, depth]) => ({ lat, lon, swl, depth })));
    legend();
  });
  // airports and metallic mines from the existing packs
  const airLayer = L.layerGroup(), mineLayer = L.layerGroup();
  ctl.addOverlay(airLayer, "Airports"); ctl.addOverlay(mineLayer, "Metallic mineral sites (USGS)");
  const METAL = /\b(?:gold|silver|copper|lithium|uranium|tungsten|antimony|molybdenum|cobalt|nickel|platinum|palladium|vanadium|zinc|lead|mercury|manganese|beryllium|tellurium|gallium|germanium|graphite|tin|chromium|titanium|niobium|tantalum|bismuth)\b/i;
  map.on("overlayadd", async (e) => {
    if (e.layer === airLayer && !airLayer.getLayers().length) {
      const a = await fetch("data/airports.json").then((r) => r.json());
      a.a.filter((x) => x[0] > 34.8 && x[0] < 42.2 && x[1] > -120.3 && x[1] < -113.8).forEach((x) => {
        const col = x[4] & 1 ? "#ff6b6b" : x[4] & 2 ? "#ffd166" : "#e9ecef";
        L.circleMarker([x[0], x[1]], { radius: x[4] & 1 ? 7 : x[4] & 2 ? 5 : 3.5, color: "#111", weight: 1, fillColor: col, fillOpacity: 1 })
          .bindTooltip(`${esc(x[3])} · ${esc(x[2])}${x[5] ? ` · ${fmt(x[5])} ft runway` : ""}`).addTo(airLayer);
      });
    }
    if (e.layer === mineLayer && !mineLayer.getLayers().length) {
      const ms = await fetch("data/mrds/NV.json").then((r) => r.json());
      ms.filter((m) => METAL.test(m[3] || "")).forEach((m) => L.circleMarker([m[0], m[1]], { radius: 3, stroke: false, fillColor: "#ffc93c", fillOpacity: 0.85 })
        .bindTooltip(`${esc(m[2] || "Mine")} · ${esc(m[3] || "")}`).addTo(mineLayer));
    }
  });
  const listingLayer = L.layerGroup().addTo(map);

  // ---------- data ----------
  async function loadParcels(url) {
    const r = await fetch(url);
    if (!r.ok || !r.body) return r.json();
    const total = +r.headers.get("content-length") || 0, reader = r.body.getReader(), parts = []; let got = 0;
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      parts.push(value); got += value.length;
      $("nvLoad").textContent = `Loading parcels… ${(got / 1e6).toFixed(1)}${total ? ` of ${(total / 1e6).toFixed(1)}` : ""} MB`;
    }
    const buf = new Uint8Array(got); let o = 0; for (const p of parts) { buf.set(p, o); o += p.length; }
    return JSON.parse(new TextDecoder().decode(buf));
  }
  const stall = setTimeout(() => { if (!D) $("nvLoad").textContent += " (slow connection: still downloading; a hard refresh, Ctrl+Shift+R, also clears an old cached copy)"; }, 20000);
  loadParcels("data/nevada/parcels10.json?v=20261026").then((doc) => {
    clearTimeout(stall);
    D = doc; C = Object.fromEntries(doc.cols.map((c, i) => [c, i]));
    rows = doc.rows.map((r) => {
      const it = Object.fromEntries(doc.cols.map((c, i) => [c, r[i]]));
      it.value = it.ppa * it.acres;
      it.avail = it.lead != null ? { kind: "lead", ...Object.fromEntries(doc.lead_cols.map((c, i) => [c, doc.leads[it.lead][i]])) } : null;
      if (it.avail?.price) { it.ask = it.avail.price; it.ask_ppa = it.avail.price / it.acres; }
      return it;
    });
    const counties = [...new Set(rows.map((r) => r.county))].sort();
    $("fCounty").insertAdjacentHTML("beforeend", counties.map((c) => `<option>${esc(c)}</option>`).join(""));
    $("nvLoad").textContent = `${fmt(rows.length)} parcels from the Nevada statewide parcel layer, built ${doc.built}. Squares are drawn at each parcel's true size.`;
    mine = loadMine(); applyMine(); readHash(); apply();
  }).catch(() => { $("nvLoad").textContent = "The parcel file didn't load. Reload the page to try again."; });

  // ---------- filters ----------
  const num = (id) => { const v = $(id).value.trim(); return v === "" ? null : Number(v); };
  const airKey = () => $("fAirT").value;
  function apply() {
    if (!D) return;
    const q = $("fQ").value.trim().toLowerCase(), minAc = num("fMinAc"), maxAc = num("fMaxAc"), maxPpa = num("fMaxPpa"), county = $("fCounty").value;
    const swl = num("fSwl"), tx = num("fTx"), hwy = num("fHwy"), air = num("fAir"), ak = airKey(), hunt = $("fHunt").value;
    const priv = $("fPrivate").checked, pubMin = num("fPub");
    const avail = $("fAvail").checked, city = $("fCity").checked, pou = $("fPou").checked, nodes = $("fNoDesig").checked, mines = $("fMines").checked;
    shown = rows.filter((r) => {
      if (q && !(r.apn.toLowerCase().includes(q) || r.county.toLowerCase().includes(q))) return false;
      if (minAc != null && r.acres < minAc) return false;
      if (maxAc != null && r.acres > maxAc) return false;
      if (maxPpa != null && (r.ask_ppa ?? r.ppa) > maxPpa) return false;
      if (county && r.county !== county) return false;
      if (avail && !r.avail) return false;
      if (priv && r.own != null && !isPrivate(r.own)) return false;
      if (pubMin != null && !((r.pub_adj ?? 0) >= pubMin)) return false;
      if (swl != null && (r.swl == null || r.swl > swl)) return false;
      if (tx != null && r.tx_km > tx) return false;
      if (hwy != null && r.hwy_km > hwy) return false;
      if (air != null && r[`${ak}_min`] > air) return false;
      if (city && r.cws == null) return false;
      if (pou && !r.pou) return false;
      if (nodes && r.basin != null && /^y/i.test(String(D.basins[r.basin][4] ?? ""))) return false;
      if (mines && !r.mines) return false;
      if (hunt && (r.hunt == null || !has(D.hunt[r.hunt][+hunt]))) return false;
      return true;
    });
    const s = $("fSort").value;
    const key = { acres: (r) => -r.acres, ppa: (r) => r.ask_ppa ?? r.ppa, value: (r) => r.ask ?? r.value, swl: (r) => r.swl ?? 1e9, tx: (r) => r.tx_km, air: (r) => r[`${ak}_min`] }[s];
    shown.sort((a, b) => key(a) - key(b));
    parcelLayer.set(shown);
    const ac = shown.reduce((t, r) => t + r.acres, 0), nav = shown.filter((r) => r.avail).length;
    $("nvCount").innerHTML = `<b>${fmt(shown.length)}</b> parcels · <b>${fmt(ac)}</b> acres${nav ? ` · <b class="good">${fmt(nav)}</b> available` : ""}`;
    $("nvList").innerHTML = shown.slice(0, 300).map((r, i) => `<tr data-i="${i}"${r === sel ? ' class="sel"' : ""}><td>${r.avail ? '<span class="av">●</span> ' : ""}${esc(r.apn)}<br><span style="color:var(--faint)">${esc(r.county)}</span></td>
      <td>${fmt(r.acres, r.acres < 100 ? 1 : 0)}</td><td>${money(r.ask_ppa ?? r.ppa)}${r.ask_ppa ? "" : "*"}</td><td>${r.swl == null ? "–" : fmt(r.swl) + " ft"}</td></tr>`).join("")
      + (shown.length > 300 ? `<tr><td colspan="4" style="color:var(--faint);cursor:default">Showing the first 300; narrow the filters or sort differently.</td></tr>` : "");
    legend(); writeHash();
  }
  $("nvList").addEventListener("click", (e) => { const tr = e.target.closest("tr[data-i]"); if (tr) select(shown[+tr.dataset.i], true); });
  ["fQ", "fMinAc", "fMaxAc", "fMaxPpa", "fSwl", "fTx", "fHwy", "fAir"].forEach((id) => $(id).addEventListener("input", debounce(apply, 200)));
  ["fPrivate", "fPub", "fCounty", "fAvail", "fAirT", "fCity", "fPou", "fNoDesig", "fMines", "fHunt", "fSort"].forEach((id) => $(id).addEventListener("change", apply));
  $("fColor").addEventListener("change", () => { parcelLayer._draw(); legend(); });
  $("bReset").addEventListener("click", () => {
    document.querySelectorAll(".nvx-side input[type=number], .nvx-side input[type=search]").forEach((i) => (i.value = ""));
    $("fMinAc").value = 10; document.querySelectorAll(".nvx-side input[type=checkbox]").forEach((i) => (i.checked = i.id === "fPrivate"));
    ["fCounty", "fHunt", "fPub"].forEach((id) => ($(id).value = "")); $("fSort").value = "acres"; apply();
  });
  $("bFit").addEventListener("click", () => { if (shown.length) map.fitBounds(L.latLngBounds(shown.map((r) => [r.lat, r.lon])).pad(0.1)); });
  function debounce(f, ms) { let t; return () => { clearTimeout(t); t = setTimeout(f, ms); }; }

  // shareable state in the hash (plain token pairs)
  const HASH = ["fPub", "fQ", "fMinAc", "fMaxAc", "fMaxPpa", "fCounty", "fSwl", "fTx", "fHwy", "fAir", "fAirT", "fHunt", "fSort", "fColor"];
  const CHK = ["fAvail", "fCity", "fPou", "fNoDesig", "fMines"];
  function writeHash() {
    const p = new URLSearchParams();
    HASH.forEach((id) => { const v = $(id).value; if (v && !(id === "fMinAc" && v === "10") && !(id === "fSort" && v === "acres") && !(id === "fColor" && v === "ppa") && !(id === "fAirT" && v === "reg")) p.set(id, v); });
    CHK.forEach((id) => { if ($(id).checked) p.set(id, "1"); });
    if (!$("fPrivate").checked) p.set("fPrivate", "0");
    history.replaceState(null, "", p.toString() ? `#${p}` : location.pathname);
  }
  function readHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    HASH.forEach((id) => { if (p.has(id)) $(id).value = p.get(id); });
    CHK.forEach((id) => { if (p.has(id)) $(id).checked = true; });
    if (p.get("fPrivate") === "0") $("fPrivate").checked = false;
  }

  // ---------- legend ----------
  function legend() {
    const k = colorBy();
    const lab = k === "swl" ? ["Depth to water", "20 ft", "800+ ft"] : k === "avail" ? null : ["$/acre (estimate or asking)", "$300", "$300K+"];
    $("nvLegend").innerHTML = lab ? `${lab[0]}<div class="ramp">${PAL.map((c) => `<i style="background:${c}"></i>`).join("")}</div><div class="ends"><span>${lab[1]}</span><span>${lab[2]}</span></div>`
      : `<span style="color:#3ecf8e">■</span> available &nbsp; <span style="color:#4a5260">■</span> not listed`;
  }

  // ---------- selection card ----------
  function select(it, zoom) {
    sel = it; parcelLayer._draw();
    document.querySelectorAll("#nvList tr").forEach((tr) => tr.classList.toggle("sel", shown[+tr.dataset.i] === it));
    if (zoom) map.setView([it.lat, it.lon], Math.max(map.getZoom(), Math.min(15, Math.round(13 - Math.log2(Math.sqrt(it.acres / 40))))));
    const A = (i) => D.airports[i], bas = it.basin != null ? D.basins[it.basin] : null, cws = it.cws != null ? D.cws[it.cws] : null, hu = it.hunt != null ? D.hunt[it.hunt] : null;
    const tmpl = D.counties[it.county], web = tmpl ? tmpl.replace("{apn}", encodeURIComponent(it.apn)) : null;
    const sp = hu ? [3, 4, 5, 6, 7, 8, 9].filter((i) => has(hu[i])).map((i) => SPECIES[i]).join(", ") : "";
    const tone = (v, good, bad) => v == null ? "" : v <= good ? "good" : v >= bad ? "bad" : "warn";
    const av = it.avail;
    $("nvCard").innerHTML = `<button class="x" type="button" aria-label="Close">×</button>
      <h4>APN ${esc(it.apn)}</h4><div class="nvx-sub">${esc(it.county)} County · ${fmt(it.acres, 2)} acres · ${it.lat.toFixed(5)}, ${it.lon.toFixed(5)}</div>
      <dl>
        <span class="grp">Price</span>
        ${av ? `<dt>Available</dt><dd class="good">${esc(av.kind === "lead" ? `${av.source || "lead"}${av.date ? " · " + av.date : ""}` : "listed for sale")} · asking ${money(av.price)} (${money(av.price / it.acres)}/ac)${av.link ? ` · <a href="${esc(av.link)}" target="_blank" rel="noopener">source ↗</a>` : ""}</dd>` : ""}
        <dt>Estimate</dt><dd>${money(it.ppa)}/ac · ${money(it.value)} total <span style="color:var(--faint)">(price book, ${fmt(it.metro_mi)} mi from a metro)</span></dd>
        <dt>Land status</dt><dd class="${it.own != null && !isPrivate(it.own) ? "bad" : ""}">${it.own == null ? "–" : esc(ownName(it.own))}${it.pub_adj != null ? ` · ${Math.round(it.pub_adj * 100)}% of the ground around it is public land` : ""}</dd>
        <span class="grp">Water</span>
        <dt>Depth</dt><dd class="${tone(it.swl, 150, 500)}">${it.swl == null ? "no well logs within 3 mi" : `~${fmt(it.swl)} ft to water (median of ${fmt(it.wells)} well logs within 3 mi)${it.depth ? `; wells drilled ~${fmt(it.depth)} ft` : ""}`}</dd>
        <dt>Water right</dt><dd>${it.pou ? '<span class="good">inside an active place of use</span>' : "none on the parcel"} · ${fmt(it.pods)} active diversions within 1 mi</dd>
        <dt>Basin</dt><dd class="${bas && /^y/i.test(String(bas[4] ?? "")) ? "warn" : ""}">${bas ? `${esc(bas[0])} ${esc(bas[1])}${bas[2] ? " · " + esc(bas[2]) : ""} · ${esc(DESIG[bas[3]] || (/^y/i.test(String(bas[4] ?? "")) ? "designated basin" : "not designated"))}` : "–"}</dd>
        <dt>City water</dt><dd class="${cws ? "good" : ""}">${cws ? `${esc(cws[1])} (serves ${fmt(cws[2])})` : "outside public water systems: well or haul"}</dd>
        <span class="grp">Power and access</span>
        <dt>Power</dt><dd class="${tone(it.tx_km, 2, 15)}">${fmt(it.tx_km, 1)} km to a ${it.tx_kv > 0 ? fmt(it.tx_kv) + " kV" : ""} transmission line</dd>
        <dt>Highway</dt><dd class="${tone(it.hwy_km, 3, 25)}">${fmt(it.hwy_km, 1)} km to a state highway</dd>
        <dt>Airports</dt><dd>Regional: ${esc(A(it.reg)[1])} ~${fmt(it.reg_min)} min<br>Jet runway: ${esc(A(it.jet)[1])} ~${fmt(it.jet_min)} min<br>Major: ${esc(A(it.intl)[0])} ~${fmt(it.intl_min)} min</dd>
        <span class="grp">Minerals and hunting</span>
        <dt>Minerals</dt><dd>${it.mines ? `<span class="good">${fmt(it.mines)} metallic sites within 5 km</span>` : "none within 5 km"}${it.mine_km != null ? ` · nearest ${fmt(it.mine_km, 1)} km` : ""}</dd>
        <dt>Hunt unit</dt><dd>${hu ? `Unit ${esc(String(hu[0]).trim() || hu[2])}${sp ? " · " + esc(sp) : " · no big game managed"}` : "–"}</dd>
      </dl>
      <div class="acts">
        <a class="nvx-btn" href="./#q=${encodeURIComponent(it.lat.toFixed(5) + ", " + it.lon.toFixed(5))}" target="_blank" rel="noopener">Full screen ↗</a>
        <a class="nvx-btn" href="explorer.html?pin=${it.lat.toFixed(5)},${it.lon.toFixed(5)}" target="_blank" rel="noopener">Drive times ↗</a>
        ${web ? `<a class="nvx-btn" href="${esc(web)}" target="_blank" rel="noopener">Assessor record ↗</a>` : ""}
      </div>
      <p class="nvx-sub" style="margin-top:8px">Distances are straight-line; drive times are estimates. Legal access, the actual water right, and mineral ownership need the title and county records.</p>`;
    $("nvCard").hidden = false;
    $("nvCard").querySelector(".x").addEventListener("click", () => { $("nvCard").hidden = true; sel = null; parcelLayer._draw(); });
  }


  // ---------- listings the user adds by hand (kept in this browser) ----------
  let mine = [];
  const MKEY = "nv_my_listings";
  const loadMine = () => { try { return JSON.parse(localStorage.getItem(MKEY) || "[]"); } catch { return []; } };
  const saveMine = () => { try { localStorage.setItem(MKEY, JSON.stringify(mine)); } catch { /* storage blocked: kept for this visit only */ } };
  function applyMine() {
    rows.forEach((r) => { if (r.avail?.kind === "mine") { r.avail = null; r.ask = r.ask_ppa = undefined; } });
    const byKey = new Map(rows.map((r) => [apnKey(r.apn), r]));
    const missing = [];
    for (const m of mine) {
      const r = byKey.get(apnKey(m.apn));
      if (!r) { missing.push(m.apn); continue; }
      r.avail = { kind: "mine", price: m.price || null, link: m.link || null, source: "your listing", date: m.added };
      if (m.price) { r.ask = m.price; r.ask_ppa = m.price / r.acres; }
    }
    $("aList").innerHTML = mine.length ? mine.map((m, i) => `${esc(m.apn)}${m.price ? " · " + money(m.price) : ""} <a href="#" data-del="${i}">remove</a>`).join("<br>")
      + (missing.length ? `<br><span class="warn">Not among the 10+ acre parcels: ${missing.map(esc).join(", ")}</span>` : "") : "";
  }
  $("aAdd").addEventListener("click", () => {
    const apn = $("aApn").value.trim(); if (!apn) { $("aStatus").textContent = "Enter the APN from the listing."; return; }
    mine = mine.filter((m) => apnKey(m.apn) !== apnKey(apn));
    mine.push({ apn, price: Number($("aPrice").value) || null, link: $("aLink").value.trim() || null, added: new Date().toISOString().slice(0, 10) });
    saveMine(); applyMine(); apply();
    const r = rows.find((x) => apnKey(x.apn) === apnKey(apn));
    $("aStatus").textContent = r ? "Marked available." : "Saved, but that APN isn't among Nevada's 10+ acre parcels.";
    if (r) select(r, true);
    $("aApn").value = $("aPrice").value = $("aLink").value = "";
  });
  $("aList").addEventListener("click", (e) => { const a = e.target.closest("[data-del]"); if (!a) return; e.preventDefault(); mine.splice(+a.dataset.del, 1); saveMine(); applyMine(); apply(); });

  // ---------- land for sale (RentCast, with the key saved in the underwriter) ----------
  const getKey = () => { try { return localStorage.getItem("le_rentcast_key") || ""; } catch { return ""; } };
  $("bListings").addEventListener("click", async () => {
    const key = getKey(), st = $("lStatus");
    if (!key) { st.innerHTML = `Add your RentCast key in the <a href="./#underwriter" target="_blank" rel="noopener">underwriter</a> (Step 2 → API key) first.`; return; }
    st.textContent = "Loading Nevada land listings…"; listings = []; let calls = 0;
    try {
      for (let off = 0; off < 5000; off += 500) {
        const r = await fetch(`https://api.rentcast.io/v1/listings/sale?${new URLSearchParams({ state: "NV", propertyType: "Land", status: "Active", limit: 500, offset: off })}`,
          { headers: { "X-Api-Key": key, Accept: "application/json" } });
        calls++;
        if (r.status === 401 || r.status === 403) throw new Error("RentCast rejected the key.");
        if (!r.ok) throw new Error(`RentCast returned ${r.status}.`);
        const j = await r.json(); const page = Array.isArray(j) ? j : j.listings || [];
        listings.push(...page); st.textContent = `Loaded ${fmt(listings.length)} listings (${calls} request${calls > 1 ? "s" : ""})…`;
        if (page.length < 500) break;
      }
    } catch (e) { st.textContent = `${e.message} Loaded ${fmt(listings.length)} before stopping.`; }
    matchListings(); st.textContent = `${fmt(listings.length)} land listings loaded (${calls} RentCast request${calls > 1 ? "s" : ""}); ${fmt(rows.filter((r) => r.avail?.kind === "listing").length)} matched to a 10+ acre parcel.`;
  });
  function matchListings() {
    listingLayer.clearLayers();
    rows.forEach((r) => { if (r.avail?.kind === "listing") { r.avail = null; r.ask = r.ask_ppa = undefined; } });
    const grid = new Map(); rows.forEach((r) => { const k = `${Math.round(r.lat * 50)},${Math.round(r.lon * 50)}`; (grid.get(k) || grid.set(k, []).get(k)).push(r); });
    for (const l of listings) {
      if (l.latitude == null || l.longitude == null) continue;
      const lotAc = l.lotSize ? l.lotSize / 43560 : null;
      L.circleMarker([l.latitude, l.longitude], { radius: 5, color: "#111", weight: 1, fillColor: "#3ecf8e", fillOpacity: 0.95 })
        .bindTooltip(`${esc(l.formattedAddress || "Listing")} · ${money(l.price)}${lotAc ? ` · ${fmt(lotAc, 1)} ac` : ""}`).addTo(listingLayer);
      if (!lotAc || lotAc < 9) continue;
      let best = null, bd = Infinity;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const r of grid.get(`${Math.round(l.latitude * 50) + i},${Math.round(l.longitude * 50) + j}`) || []) {
        const d = Math.hypot(r.lat - l.latitude, (r.lon - l.longitude) * 0.78) * 111;
        if (d < 1.5 && Math.abs(r.acres - lotAc) / lotAc < 0.25 && d < bd) { bd = d; best = r; }
      }
      if (best && !best.avail) {
        best.avail = { kind: "listing", price: l.price, link: null, date: l.listedDate ? String(l.listedDate).slice(0, 10) : null, source: `listed${l.daysOnMarket != null ? `, ${l.daysOnMarket} days on market` : ""}` };
        if (l.price) { best.ask = l.price; best.ask_ppa = l.price / best.acres; }
      }
    }
    apply();
  }
})();
