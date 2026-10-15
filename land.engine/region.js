// Land Engine · Region engine (Scale 2: block/corridor, Scale 3: region/town).
// Input: a place + an idea ("southern Idaho, data centers"). Samples the area, pulls national
// layers once, then scores every factor 0-100 and weights them by use-case profile.
(() => {
  const S = {
    geocode: "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates",
    nri: "https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/National_Risk_Index_Census_Tracts/FeatureServer/0/query",
    tx: "https://services1.arcgis.com/Hp6G80Pky0om7QvQ/arcgis/rest/services/Electric_Power_Transmission_Lines/FeatureServer/0/query",
    plants: "https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/Power_Plants_in_the_US/FeatureServer/0/query",
    gas: "https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/Natural_Gas_Interstate_and_Intrastate_Pipelines_1/FeatureServer/0/query",
    roads: "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Transportation/MapServer/2/query",
    sma: "https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_SMA_Cached_without_PriUnk/MapServer/1/query",
    nhd: "https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer/6/query",
    gw: "https://api.waterdata.usgs.gov/ogcapi/v0/collections/field-measurements/items",
    rivers: "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Rivers_and_Streams/FeatureServer/0/query",
    walk: "https://geodata.epa.gov/arcgis/rest/services/OA/WalkabilityIndex/MapServer/0/query",
    elev: "https://api.open-meteo.com/v1/elevation",
    climate: "https://archive-api.open-meteo.com/v1/archive"
  };
  const MI = 1609.34;
  const $ = (id) => document.getElementById(id);
  const fmt = (n, d = 0) => n == null || !isFinite(n) ? "–" : Number(n).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
  const money = (n) => n == null || !isFinite(n) ? "–" : n >= 1e6 ? `$${fmt(n / 1e6, 1)}M` : n >= 1e3 ? `$${fmt(n / 1e3)}K` : `$${fmt(n)}`;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clamp = (x, a = 0, b = 100) => Math.max(a, Math.min(b, x));
  const median = (a) => { const s = a.filter((x) => x != null && isFinite(x)).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const hav = (a, b, c, d) => { const R = 6371008.8, r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
  function distToPaths(lat, lon, paths) {
    const kx = Math.cos(lat * Math.PI / 180) * 111320, ky = 110540; let best = Infinity;
    for (const path of paths) for (let i = 1; i < path.length; i++) {
      const ax = (path[i - 1][0] - lon) * kx, ay = (path[i - 1][1] - lat) * ky, bx = (path[i][0] - lon) * kx, by = (path[i][1] - lat) * ky;
      const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy, t = L2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L2)) : 0;
      best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
    }
    return best;
  }
  // Linear score between a "bad" and a "good" value (either direction); log option for money/pop.
  const lin = (v, bad, good) => v == null || !isFinite(v) ? null : clamp(((v - bad) / (good - bad)) * 100);
  const logs = (v, bad, good) => v == null || !isFinite(v) || v <= 0 ? null : clamp(((Math.log(v) - Math.log(bad)) / (Math.log(good) - Math.log(bad))) * 100);

  async function getJSON(url, params, ms = 30000, tries = 2) {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    let last;
    for (let a = 0; a < tries; a++) {
      const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), ms);
      try {
        const r = await fetch(url + qs, { signal: ctl.signal });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        if (j && j.error) throw new Error(j.error.message || "service error");
        return j;
      } catch (e) { last = e.name === "AbortError" ? new Error("timed out") : e; if (a < tries - 1) await sleep(900); }
      finally { clearTimeout(timer); }
    }
    throw last;
  }
  const packCache = {};
  const pack = (p) => (packCache[p] ||= fetch(p).then((r) => { if (!r.ok) throw new Error(p); return r.json(); }));
  const near = (c, R, extra) => ({ geometry: `${c.lon},${c.lat}`, geometryType: "esriGeometryPoint", inSR: 4326, distance: Math.round(R), units: "esriSRUnit_Meter",
    spatialRel: "esriSpatialRelIntersects", f: "json", ...extra });

  // ---------- profiles ----------
  // Each factor: { w } weight in the profile. "inv" flips a score (e.g. public land is good for mining claims).
  const PROFILES = {
    datacenter: { label: "Data centers / AI compute", kw: /data ?cent|datacent|\bai\b|compute|hyperscal|gpu|server farm|\bdc\b/i,
      w: { grid: 18, gen: 8, price: 12, gas: 4, water: 8, cool: 9, seismic: 5, flood: 4, fire: 4, hazard: 4, flat: 6, private: 5, landcost: 4, labor: 5, metro: 6 } },
    solar: { label: "Utility solar farm", kw: /solar|\bpv\b|photovolt/i,
      w: { sun: 26, grid: 20, flat: 15, landcost: 12, private: 5, flood: 5, hazard: 5, fire: 4, highway: 4, water: 2, drought: 2 } },
    housing: { label: "Housing / master-planned community", kw: /hous|homes|subdivi|residential|master.?plan|apartment|multifamily|community|town|city/i,
      w: { growth: 16, labor: 12, metro: 12, landcost: 10, water: 10, flood: 8, fire: 8, hazard: 6, flat: 5, private: 7, highway: 6 } },
    industrial: { label: "Industrial / logistics", kw: /industr|logistic|warehouse|distribution|manufactur|factory|plant|fulfil/i,
      w: { highway: 22, labor: 15, landcost: 12, flat: 12, grid: 8, flood: 8, private: 8, metro: 8, hazard: 7 } },
    agriculture: { label: "Agriculture / ranch", kw: /farm|agricult|ranch|cattle|crop|orchard|vineyard|hemp|alfalfa|greenhouse/i,
      w: { water: 18, surface: 12, drought: 15, flat: 10, landcost: 15, climate: 10, flood: 5, private: 10, hazard: 5 } },
    mining: { label: "Mining / mineral claims", kw: /mine|mining|gold|silver|lithium|mineral|claim|copper|antimony|uranium/i,
      w: { minerals: 35, public: 15, highway: 10, grid: 8, water: 14, landcost: 5, hazard: 5, labor: 8 } },
    conservation: { label: "Conservation / recreation", kw: /conserv|recreat|preserv|park|hunting|wildlife|eco|trail|camp/i,
      w: { publicadj: 22, surface: 18, relief: 15, landcost: 15, fire: 10, metro: 12, water: 8 } },
    homestead: { label: "Homestead / retreat (GBLC)", kw: /homestead|retreat|cabin|off.?grid|bug.?out|ranchette|land bank/i,
      w: { water: 22, private: 10, landcost: 18, fire: 10, flood: 8, metro: 10, relief: 10, climate: 12 } },
    multifamily: { label: "Multifamily / mixed-use (block)", kw: /multi.?family|mixed.?use|block|infill|apartments|condo|retail|commercial|office/i,
      w: { walk: 18, density: 15, growth: 15, metro: 10, landcost: 10, flood: 8, hazard: 7, highway: 7, labor: 10 } }
  };
  const DEFAULT_PROFILE = "datacenter";

  // ---------- factor definitions: id -> { label, fmt(v), score(v, ctx) } ----------
  const RATING = { "Very High": 5, "Relatively High": 4, "Relatively Moderate": 3, "Relatively Low": 2, "Very Low": 1 };
  const ratingScore = (r) => r == null ? null : clamp(100 - (r - 1) * 25);
  const ratingWord = (r) => r == null ? "–" : ["", "very low", "rel. low", "moderate", "rel. high", "very high"][Math.round(r)];
  const F = {
    grid: { label: "Grid access (≥230 kV)", show: (d) => d.txNear230 == null ? "none ≤40 mi" : `${fmt(d.txNear230 / MI, 1)} mi · max ${fmt(d.txMax)} kV`, score: (d) => d.txNear230 == null ? 0 : lin(d.txNear230 / MI, 30, 1) },
    gen: { label: "Generation nearby", show: (d) => `${fmt(d.genMW)} MW · ${d.genTop || "–"}`, score: (d) => logs(d.genMW || 1, 20, 4000) },
    price: { label: "Industrial power ¢/kWh", show: (d) => d.priceInd == null ? "–" : `${fmt(d.priceInd, 2)}¢ (${d.state})`, score: (d) => lin(d.priceInd, 16, 6) },
    gas: { label: "Gas pipeline", show: (d) => d.gasDist == null ? "none ≤40 mi" : `${fmt(d.gasDist / MI, 1)} mi`, score: (d) => d.gasDist == null ? 0 : lin(d.gasDist / MI, 40, 2) },
    water: { label: "Groundwater depth", show: (d) => d.gwDepth == null ? "no data" : `~${fmt(d.gwDepth)} ft (${d.gwN} wells)`, score: (d) => d.gwDepth == null ? 35 : lin(d.gwDepth, 600, 40) },
    surface: { label: "Surface water", show: (d) => d.streamShare == null ? "–" : `${fmt(d.streamShare * 100)}% of area near water${d.riverNear ? ` · ${esc(d.riverNear.n)} ${fmt(d.riverNear.d / MI)} mi` : ""}`, score: (d) => d.streamShare == null ? null : clamp(d.streamShare * 160) },
    drought: { label: "Drought risk", show: (d) => ratingWord(d.hz.DRGT), score: (d) => ratingScore(d.hz.DRGT) },
    cool: { label: "Cooling load (CDD)", show: (d) => d.cdd == null ? "–" : `${fmt(d.cdd)} CDD · ${fmt(d.meanF, 0)}°F`, score: (d) => lin(d.cdd, 3500, 300) },
    climate: { label: "Climate mildness", show: (d) => d.meanF == null ? "–" : `${fmt(d.meanF, 0)}°F mean · ${fmt(d.precip)} mm rain`, score: (d) => d.meanF == null ? null : clamp(100 - Math.abs(d.meanF - 58) * 4) },
    sun: { label: "Solar resource", show: (d) => d.ghi == null ? "–" : `${fmt(d.ghi)} kWh/m²/yr`, score: (d) => lin(d.ghi, 1200, 2000) },
    seismic: { label: "Earthquake risk", show: (d) => ratingWord(d.hz.ERQK), score: (d) => ratingScore(d.hz.ERQK) },
    flood: { label: "Flood risk", show: (d) => ratingWord(d.hz.IFLD), score: (d) => ratingScore(d.hz.IFLD) },
    fire: { label: "Wildfire risk", show: (d) => ratingWord(d.hz.WFIR), score: (d) => ratingScore(d.hz.WFIR) },
    hazard: { label: "All-hazard risk", show: (d) => ratingWord(d.hz.ALL), score: (d) => ratingScore(d.hz.ALL) },
    flat: { label: "Buildable terrain", show: (d) => d.slopeMed == null ? "–" : `${fmt(d.slopeMed, 1)}% median grade · ${fmt(d.flatShare * 100)}% flat`, score: (d) => d.slopeMed == null ? null : clamp(lin(d.slopeMed, 8, 1) * 0.6 + d.flatShare * 40) },
    relief: { label: "Scenery / relief", show: (d) => d.elevSd == null ? "–" : `±${fmt(d.elevSd)} m · ${fmt(d.elevMean * 3.281)} ft`, score: (d) => lin(d.elevSd, 10, 220) },
    private: { label: "Private land", show: (d) => d.privShare == null ? "–" : `${fmt(d.privShare * 100)}% private`, score: (d) => d.privShare == null ? null : d.privShare * 100 },
    public: { label: "Public land (claimable)", show: (d) => d.privShare == null ? "–" : `${fmt((1 - d.privShare) * 100)}% public`, score: (d) => d.privShare == null ? null : (1 - d.privShare) * 100 },
    publicadj: { label: "Public land adjacency", show: (d) => d.privShare == null ? "–" : `${fmt((1 - d.privShare) * 100)}% public`, score: (d) => d.privShare == null ? null : clamp(100 - Math.abs(1 - d.privShare - 0.55) * 160) },
    landcost: { label: "Land cost", show: (d) => d.ppa == null ? "–" : `~${money(d.ppa)}/ac (${d.ppaSrc})`, score: (d) => logs(d.ppa, 400000, 1500) },
    labor: { label: "Labor shed (50 mi)", show: (d) => d.pop50 == null ? "–" : `${fmt(d.pop50 / 1000)}K people`, score: (d) => logs(d.pop50, 15000, 1500000) },
    density: { label: "Population density", show: (d) => d.density == null ? "–" : `${fmt(d.density)}/sq mi`, score: (d) => logs(d.density, 200, 15000) },
    metro: { label: "Metro proximity", show: (d) => d.metroDist == null ? "–" : `${fmt(d.metroDist / MI)} mi · ${esc(d.metroName)}`, score: (d) => d.metroDist == null ? null : lin(d.metroDist / MI, 200, 15) },
    highway: { label: "Interstate / highway", show: (d) => d.hwyDist == null ? "none ≤50 mi" : `${fmt(d.hwyDist / MI, 1)} mi · ${esc(d.hwyName || "")}`, score: (d) => d.hwyDist == null ? 0 : lin(d.hwyDist / MI, 50, 2) },
    growth: { label: "Land appreciation", show: (d) => d.growth == null ? "–" : `${d.growth >= 0 ? "+" : ""}${fmt(d.growth * 100)}% 2012–22`, score: (d) => lin(d.growth, 0, 2.2) },
    walk: { label: "Walkability", show: (d) => d.walk == null ? "–" : `${fmt(d.walk, 1)} / 20`, score: (d) => lin(d.walk, 4, 17) },
    minerals: { label: "Mineral occurrences", show: (d) => d.mines == null ? "–" : `${fmt(d.mines)} sites · ${d.minesProd} produced`, score: (d) => d.mines == null ? null : clamp(Math.sqrt(d.mines) * 9 + d.minesProd * 2) }
  };

  // ---------- data gathering (once per area; profiles rescore instantly) ----------
  function sampleGrid(c, R, n = 7) {
    const pts = [], dLat = R / 110540, dLon = R / (111320 * Math.cos(c.lat * Math.PI / 180));
    for (let i = -n / 2 + 0.5; i < n / 2; i++) for (let j = -n / 2 + 0.5; j < n / 2; j++) {
      const lat = c.lat + (i / (n / 2)) * dLat, lon = c.lon + (j / (n / 2)) * dLon;
      if (hav(c.lat, c.lon, lat, lon) <= R) pts.push({ lat, lon, gi: i, gj: j });
    }
    return pts;
  }
  async function pool(items, k, fn) { const out = new Array(items.length); let i = 0; await Promise.all(Array.from({ length: k }, async () => { while (i < items.length) { const j = i++; out[j] = await fn(items[j]).catch(() => undefined); } })); return out; }

  async function gather(c, R, onStep) {
    const d = { hz: {}, state: c.state, center: c };
    const step = (k, fn) => fn().then((v) => { onStep(k, true); return v; }).catch((e) => { onStep(k, false, e); });
    const grid = sampleGrid(c, R);
    d.grid = grid;
    await Promise.all([
      step("hazards", async () => {
        const j = await getJSON(S.nri, near(c, R, { outFields: "POPULATION,AREA,WFIR_RISKR,ERQK_RISKR,IFLD_RISKR,DRGT_RISKR,HWAV_RISKR,RISK_RATNG", returnGeometry: false, resultRecordCount: 2000 }), 45000);
        const rows = (j.features || []).map((f) => f.attributes);
        const wavg = (k) => { let s = 0, w = 0; rows.forEach((r) => { const v = RATING[r[k]]; if (v) { const ww = Math.max(1, r.POPULATION || 1); s += v * ww; w += ww; } }); return w ? s / w : null; };
        d.hz = { WFIR: wavg("WFIR_RISKR"), ERQK: wavg("ERQK_RISKR"), IFLD: wavg("IFLD_RISKR"), DRGT: wavg("DRGT_RISKR"), HWAV: wavg("HWAV_RISKR"), ALL: wavg("RISK_RATNG") };
        const pop = rows.reduce((a, r) => a + (r.POPULATION || 0), 0), area = rows.reduce((a, r) => a + (r.AREA || 0), 0);
        d.pop = pop; d.tracts = rows.length; d.density = area ? pop / area : null;
      }),
      step("labor", async () => {
        const j = await getJSON(S.nri, near(c, Math.max(R, 50 * MI), { outStatistics: JSON.stringify([{ statisticType: "sum", onStatisticField: "POPULATION", outStatisticFieldName: "pop" }]) }), 45000);
        d.pop50 = j.features?.[0]?.attributes?.pop ?? null;
      }),
      step("grid", async () => {
        const j = await getJSON(S.tx, near(c, Math.max(R, 40 * MI), { where: "VOLTAGE>=115", outFields: "VOLTAGE,OWNER", returnGeometry: true, outSR: 4326, maxAllowableOffset: 0.004, geometryPrecision: 4 }), 45000);
        const lines = (j.features || []).map((f) => ({ v: f.attributes.VOLTAGE, owner: f.attributes.OWNER, paths: f.geometry?.paths || [], d: f.geometry?.paths ? distToPaths(c.lat, c.lon, f.geometry.paths) : Infinity }));
        d.txLines = lines;
        const hv = lines.filter((l) => l.v >= 230).sort((a, b) => a.d - b.d);
        d.txNear230 = hv.length ? hv[0].d : null;
        d.txMax = lines.length ? Math.max(...lines.map((l) => l.v || 0)) : null;
        d.tx345 = lines.filter((l) => l.v >= 345 && l.d <= R).length;
      }),
      step("generation", async () => {
        const j = await getJSON(S.plants, near(c, R + 25 * MI, { outFields: "Plant_Name,PrimSource,Total_MW,Latitude,Longitude", returnGeometry: false }), 40000);
        const ps = (j.features || []).map((f) => f.attributes);
        d.plants = ps;
        d.genMW = ps.reduce((a, p) => a + (p.Total_MW || 0), 0);
        const by = {}; ps.forEach((p) => (by[p.PrimSource] = (by[p.PrimSource] || 0) + (p.Total_MW || 0)));
        const top = Object.entries(by).sort((a, b) => b[1] - a[1])[0];
        d.genTop = top ? `${top[0]} ${Math.round((top[1] / (d.genMW || 1)) * 100)}%` : null;
      }),
      step("gas", async () => {
        const j = await getJSON(S.gas, near(c, Math.max(R, 40 * MI), { outFields: "FID", returnGeometry: true, outSR: 4326, maxAllowableOffset: 0.005, geometryPrecision: 4 }), 40000);
        const ds = (j.features || []).map((f) => f.geometry?.paths ? distToPaths(c.lat, c.lon, f.geometry.paths) : Infinity);
        d.gasDist = ds.length ? Math.min(...ds) : null;
      }),
      step("highway", async () => {
        const j = await getJSON(S.roads, near(c, Math.max(R, 50 * MI), { outFields: "NAME,MTFCC", returnGeometry: true, outSR: 4326, maxAllowableOffset: 0.005, geometryPrecision: 4, resultRecordCount: 200 }), 40000);
        const rs = (j.features || []).map((f) => ({ name: f.attributes.NAME, d: f.geometry?.paths ? distToPaths(c.lat, c.lon, f.geometry.paths) : Infinity })).sort((a, b) => a.d - b.d);
        d.hwyDist = rs.length ? rs[0].d : null; d.hwyName = rs[0]?.name;
      }),
      step("terrain", async () => {
        const j = await getJSON(S.elev, { latitude: grid.map((p) => p.lat.toFixed(4)).join(","), longitude: grid.map((p) => p.lon.toFixed(4)).join(",") }, 30000);
        const e = (j.elevation || []).filter((x) => x != null);
        grid.forEach((p, i) => (p.elev = j.elevation?.[i]));
        const m = e.reduce((a, b) => a + b, 0) / (e.length || 1);
        d.elevMean = m; d.elevSd = e.length ? Math.sqrt(e.reduce((a, b) => a + (b - m) ** 2, 0) / e.length) : null;
        // Mean grade between neighboring sample points: flat valley floors score high even inside a mountainous circle.
        const key = (p) => `${p.gi},${p.gj}`, at = new Map(grid.map((p) => [key(p), p])), slopes = [];
        grid.forEach((p) => [[1, 0], [0, 1]].forEach(([a, b]) => {
          const q = at.get(`${p.gi + a},${p.gj + b}`);
          if (q && p.elev != null && q.elev != null) slopes.push(Math.abs(q.elev - p.elev) / hav(p.lat, p.lon, q.lat, q.lon) * 100);
        }));
        d.slopeMed = median(slopes);
        d.flatShare = slopes.length ? slopes.filter((s) => s < 2).length / slopes.length : null;
      }),
      step("climate", async () => {
        const y = new Date().getFullYear() - 1;
        const j = await getJSON(S.climate, { latitude: c.lat.toFixed(3), longitude: c.lon.toFixed(3), start_date: `${y}-01-01`, end_date: `${y}-12-31`,
          daily: "temperature_2m_mean,shortwave_radiation_sum,precipitation_sum", timezone: "UTC" }, 40000);
        const t = j.daily.temperature_2m_mean.filter((x) => x != null).map((x) => x * 9 / 5 + 32);
        d.meanF = t.reduce((a, b) => a + b, 0) / t.length;
        d.cdd = t.reduce((a, x) => a + Math.max(0, x - 65), 0);
        d.ghi = j.daily.shortwave_radiation_sum.reduce((a, x) => a + (x || 0), 0) / 3.6;
        d.precip = j.daily.precipitation_sum.reduce((a, x) => a + (x || 0), 0);
        d.climYear = y;
      }),
      step("land status", async () => {
        const codes = await pool(grid, 6, (p) => getJSON(S.sma, { geometry: JSON.stringify({ x: p.lon, y: p.lat, spatialReference: { wkid: 4326 } }), geometryType: "esriGeometryPoint",
          inSR: 4326, spatialRel: "esriSpatialRelIntersects", outFields: "ADMIN_AGENCY_CODE", returnGeometry: false, f: "json" }, 20000).then((j) => j.features?.[0]?.attributes?.ADMIN_AGENCY_CODE || "PVT"));
        grid.forEach((p, i) => (p.agency = codes[i]));
        const k = codes.filter((x) => x !== undefined);
        d.privShare = k.length ? k.filter((x) => ["PVT", "UND", "UNK"].includes(String(x).toUpperCase())).length / k.length : null;
      }),
      step("groundwater", async () => {
        const R2 = Math.min(R, 25 * MI), dLat = R2 / 110540, dLon = R2 / (111320 * Math.cos(c.lat * Math.PI / 180));
        const j = await getJSON(S.gw, { bbox: `${c.lon - dLon},${c.lat - dLat},${c.lon + dLon},${c.lat + dLat}`, parameter_code: "72019", limit: 5000, f: "json" }, 45000);
        const latest = new Map();
        (j.features || []).forEach((f) => { const p = f.properties, v = parseFloat(p.value); if (!isFinite(v) || v < 0) return; const o = latest.get(p.monitoring_location_id); if (!o || p.time > o.time) latest.set(p.monitoring_location_id, { v, time: p.time }); });
        const vs = [...latest.values()].map((x) => x.v);
        d.gwDepth = median(vs); d.gwN = vs.length;
        if (!vs.length && c.region) { // Great Basin pack fallback
          const wells = await pack(c.region.packs.wells);
          const inR = wells.filter((w) => hav(c.lat, c.lon, w[0], w[1]) <= R2 && w[3] != null && w[3] >= 0).map((w) => w[3]);
          d.gwDepth = median(inR); d.gwN = inR.length;
        }
      }),
      step("streams", async () => {
        // Area-wide NHD counts time out; sample: share of grid points within 2 km of a perennial stream.
        const pts = grid.filter((_, i) => i % Math.max(1, Math.floor(grid.length / 12)) === 0).slice(0, 12);
        const probe = (p) => getJSON(S.nhd, near(p, 2000, { where: "fcode=46006", returnCountOnly: true }), 12000, 1).then((j) => (j.count || 0) > 0);
        const first = await probe(pts[0]).catch(() => undefined); // NHD is often down; one probe decides
        const hits = first === undefined ? [] : [first, ...(await pool(pts.slice(1), 4, probe))];
        const k = hits.filter((x) => x !== undefined);
        if (k.length) { d.streamShare = k.filter(Boolean).length / k.length; d.streamSrc = "NHD perennial, 2 km"; return; }
        // Fallback when USGS NHD is down: Esri national rivers (major rivers only), share within 5 km.
        const j = await getJSON(S.rivers, near(c, R + 10 * MI, { outFields: "Name,Feature", returnGeometry: true, outSR: 4326, maxAllowableOffset: 0.004, geometryPrecision: 4, resultRecordCount: 500 }), 40000);
        const rv = (j.features || []).filter((f) => f.geometry?.paths);
        const within = grid.filter((p) => rv.some((f) => distToPaths(p.lat, p.lon, f.geometry.paths) <= 5000)).length;
        d.streamShare = grid.length ? within / grid.length : null;
        const named = rv.map((f) => ({ n: f.attributes.Name, d: distToPaths(c.lat, c.lon, f.geometry.paths) })).filter((x) => x.n).sort((a, b) => a.d - b.d)[0];
        d.riverNear = named || null; d.streamSrc = "major rivers, 5 km";
      }),
      step("walkability", async () => {
        const j = await getJSON(S.walk, { geometry: JSON.stringify({ x: c.lon, y: c.lat, spatialReference: { wkid: 4326 } }), geometryType: "esriGeometryPoint", inSR: 4326,
          spatialRel: "esriSpatialRelIntersects", outFields: "NatWalkInd", returnGeometry: false, f: "json" }, 25000);
        d.walk = j.features?.[0]?.attributes?.NatWalkInd ?? null;
      }),
      step("land value", async () => {
        const idx = await pack("data/surfaces/index.json");
        const m = idx.metros.map((x) => ({ ...x, d: hav(c.lat, c.lon, x.lat, x.lon) })).sort((a, b) => a.d - b.d)[0];
        d.metroDist = m.d; d.metroName = m.name;
        const insideMetro = c.lon >= m.bbox[0] && c.lon <= m.bbox[2] && c.lat >= m.bbox[1] && c.lat <= m.bbox[3];
        if (insideMetro) {
          const doc = await pack(`data/surfaces/m/${m.code}.json`);
          const ts = doc.t.filter((t) => hav(c.lat, c.lon, t[0], t[1]) <= Math.max(R, 3 * MI));
          if (ts.length) {
            d.ppa = median(ts.map((t) => t[2].at(-1))); d.ppaSrc = `FHFA ${ts.length} tracts`;
            const g = ts.map((t) => t[2][0] ? t[2].at(-1) / t[2][0] - 1 : null); d.growth = median(g);
          }
        }
        if (d.ppa == null) {
          const cs = await pack("data/surfaces/counties.json");
          const nc = cs.c.map((r) => ({ r, d: hav(c.lat, c.lon, r[0], r[1]) })).sort((a, b) => a.d - b.d)[0];
          if (c.region && m.d > 40 * MI) { // rural Great Basin: raw-land band beats residential-lot pricing
            const band = c.region.priceBands[0]; d.ppa = Math.sqrt(band.lo * band.hi); d.ppaSrc = "raw-land band";
          } else if (nc) { d.ppa = nc.r[4] * (m.d > 30 * MI ? 0.25 : 1); d.ppaSrc = m.d > 30 * MI ? "county lots, rural-discounted" : `${nc.r[3]} lots`; }
        }
      }),
      step("minerals", async () => {
        const st = c.stateAbbr; if (!st) return;
        const ms = await pack(`data/mrds/${st}.json`);
        const inR = ms.filter((x) => hav(c.lat, c.lon, x[0], x[1]) <= R);
        d.mines = inR.length; d.minesProd = inR.filter((x) => x[4] === "P" || x[4] === "PP").length; d.mineList = inR;
      }),
      step("power price", async () => {
        const s = await pack("data/states.json"); const p = s.states[c.stateAbbr];
        if (p) { d.priceInd = p.ind; d.priceSrc = s.source; }
      })
    ]);
    return d;
  }

  function score(d, profileId) {
    const prof = PROFILES[profileId], rows = [];
    let sw = 0, ss = 0;
    for (const [k, w] of Object.entries(prof.w)) {
      const f = F[k]; if (!f) continue;
      const s = f.score(d);
      rows.push({ k, label: f.label, value: f.show(d), s, w });
      if (s != null) { sw += w; ss += s * w; }
    }
    const total = sw ? ss / sw : null;
    rows.sort((a, b) => b.w - a.w);
    const grade = total == null ? "–" : total >= 80 ? "A" : total >= 68 ? "B" : total >= 55 ? "C" : total >= 42 ? "D" : "F";
    const coverage = rows.filter((r) => r.s != null).reduce((a, r) => a + r.w, 0) / rows.reduce((a, r) => a + r.w, 0);
    return { total, grade, rows, coverage, prof };
  }
  const toneOf = (s) => s == null ? "neutral" : s >= 70 ? "good" : s >= 40 ? "warn" : "bad";

  function narrative(sc, d, place) {
    const strong = sc.rows.filter((r) => r.s != null && r.s >= 75).sort((a, b) => b.w * b.s - a.w * a.s).slice(0, 4);
    const weak = sc.rows.filter((r) => r.s != null && r.s < 40).sort((a, b) => b.w * (100 - b.s) - a.w * (100 - a.s)).slice(0, 4);
    const breakers = [];
    const pid = Object.keys(PROFILES).find((k) => PROFILES[k] === sc.prof);
    if (pid === "datacenter" && (d.txNear230 == null || d.txNear230 > 20 * MI)) breakers.push("No ≥230 kV transmission within 20 miles: interconnection is a multi-year, nine-figure question.");
    if (["datacenter", "housing", "industrial", "agriculture"].includes(pid) && d.privShare != null && d.privShare < 0.35) breakers.push(`Only ${fmt(d.privShare * 100)}% of sampled land is private; assembling acreage means BLM land sales or exchanges.`);
    if (["agriculture", "homestead", "housing"].includes(pid) && d.gwDepth != null && d.gwDepth > 500) breakers.push(`Groundwater sits around ${fmt(d.gwDepth)} ft: wells are expensive and basins may be closed to new appropriations.`);
    if (pid === "solar" && d.ghi != null && d.ghi < 1350) breakers.push("Solar resource is weak for utility-scale PV.");
    if (d.hz.WFIR != null && d.hz.WFIR >= 4) breakers.push("Wildfire risk is relatively high across the area: insurance and defensible-space costs.");
    const li = (r) => `<li><b>${esc(r.label)}</b> · ${r.value} <span class="sc">${fmt(r.s)}</span></li>`;
    return `<div class="rx-cols">
      <div><h5>Strengths</h5><ul>${strong.map(li).join("") || "<li>None stand out.</li>"}</ul></div>
      <div><h5>Weaknesses</h5><ul>${weak.map(li).join("") || "<li>None below 40.</li>"}</ul></div>
      <div><h5>Deal breakers to resolve</h5><ul>${breakers.map((b) => `<li>${esc(b)}</li>`).join("") || "<li>None triggered by the screen.</li>"}</ul></div></div>`;
  }

  // ---------- parsing ----------
  const STATE = { Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA", Colorado: "CO", Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS", Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY", "District of Columbia": "DC" };
  function parseIdea(text) {
    const t = text.trim();
    const pid = Object.keys(PROFILES).find((k) => PROFILES[k].kw.test(t)) || null;
    let where = t;
    const m = t.match(/(?:\bin|\bnear|\baround|\bat|\boutside(?: of)?|part of|\bof)\s+([A-Z][^,.;]*?(?:,\s*[A-Z]{2}|\b(?:Idaho|Nevada|Utah|Texas|Arizona|Montana|Wyoming|Oregon|Washington|Colorado|New Mexico|California)\b)?)(?:\s+(?:and|to|for|into)\b|[.;]|$)/);
    if (m) where = m[1];
    else where = t.replace(PROFILES[pid]?.kw || /$^/, "").replace(/\b(buy|build|turn|it|into|and|this|the|a|for|develop|put|make|some|land|acres?)\b/gi, " ").replace(/\s+/g, " ").trim();
    let dir = null; const dm = t.match(/\b(north|south|east|west|central|northern|southern|eastern|western)(?:\s|-)?(east|west)?(?:ern)?\b/i);
    if (dm) dir = dm[0].toLowerCase();
    return { pid, where: where.replace(/^(northern|southern|eastern|western|central|north|south|east|west)\s+/i, "").trim() || t, dir };
  }
  const SHIFT = { north: [1, 0], northern: [1, 0], south: [-1, 0], southern: [-1, 0], east: [0, 1], eastern: [0, 1], west: [0, -1], western: [0, -1] };
  async function locate(where, dir) {
    const m = where.match(/^(-?\d{1,2}\.\d+)\s*[, ]\s*(-?\d{1,3}\.\d+)$/);
    let c;
    if (m) c = { lat: +m[1], lon: +m[2], label: `${(+m[1]).toFixed(4)}, ${(+m[2]).toFixed(4)}`, type: "point" };
    else {
      const j = await getJSON(S.geocode, { SingleLine: where, f: "json", maxLocations: 1, countryCode: "USA", outFields: "Match_addr,Addr_type,Region,RegionAbbr,Subregion" });
      const k = j.candidates?.[0]; if (!k || k.score < 60) throw new Error(`Couldn't place "${where}".`);
      const ext = k.extent;
      c = { lat: k.location.y, lon: k.location.x, label: k.attributes.Match_addr, type: k.attributes.Addr_type, state: k.attributes.Region,
        stateAbbr: k.attributes.RegionAbbr, extent: ext };
      // A state-level match + a direction: move toward that part of the state.
      if (dir && ext && (ext.xmax - ext.xmin > 1.5 || ext.ymax - ext.ymin > 1.5)) { // state-sized match (Esri labels states "Locality")
        const parts = dir.split(/\s|-/), h = (ext.ymax - ext.ymin) / 2, w = (ext.xmax - ext.xmin) / 2;
        let dy = 0, dx = 0; parts.forEach((p) => { const s = SHIFT[p.replace(/ern$/, "")] || SHIFT[p]; if (s) { dy += s[0]; dx += s[1]; } });
        c.lat += dy * h * 0.55; c.lon += dx * w * 0.55; c.label = `${dir} ${c.label}`;
      }
    }
    c.stateAbbr = c.stateAbbr && c.stateAbbr.length === 2 ? c.stateAbbr : STATE[c.state] || c.stateAbbr;
    c.region = (window.LE_REGIONS || []).find((r) => c.lon >= r.bbox[0] && c.lon <= r.bbox[2] && c.lat >= r.bbox[1] && c.lat <= r.bbox[3]) || null;
    return c;
  }

  // ---------- UI ----------
  let map, lyr, current = null;
  const STEPS = ["hazards", "labor", "grid", "generation", "gas", "highway", "terrain", "climate", "land status", "groundwater", "streams", "walkability", "land value", "minerals", "power price"];
  function drawMap(c, R, d) {
    if (!map) { map = L.map("rxMap", { preferCanvas: true }); window.LE_LAYERS(map, { position: "topright" }); lyr = L.layerGroup().addTo(map); }
    setTimeout(() => map.invalidateSize(), 50);
    lyr.clearLayers();
    const dLat = R / 110540, dLon = R / (111320 * Math.cos(c.lat * Math.PI / 180));
    map.fitBounds([[c.lat - dLat, c.lon - dLon], [c.lat + dLat, c.lon + dLon]], { padding: [12, 12] });
    L.circle([c.lat, c.lon], { radius: R, color: "#ff7a45", weight: 1.5, fill: false, dashArray: "6 5" }).addTo(lyr);
    if (!d) return;
    (d.txLines || []).forEach((l) => L.polyline(l.paths.map((p) => p.map(([x, y]) => [y, x])), { color: l.v >= 500 ? "#ff3d71" : l.v >= 345 ? "#ff9f43" : l.v >= 230 ? "#ffd166" : "#7bdff2", weight: l.v >= 230 ? 2.2 : 1.2, opacity: 0.85 }).bindTooltip(`${Math.round(l.v)} kV`).addTo(lyr));
    (d.plants || []).forEach((p) => p.Latitude && L.circleMarker([p.Latitude, p.Longitude], { radius: Math.max(3, Math.min(12, Math.sqrt(p.Total_MW || 1) / 2.2)), color: "#111", weight: 1, fillColor: "#e9ecef", fillOpacity: 0.85 }).bindTooltip(`${esc(p.Plant_Name)} · ${esc(p.PrimSource)} ${Math.round(p.Total_MW || 0)} MW`).addTo(lyr));
    (d.grid || []).forEach((p) => p.agency && L.circleMarker([p.lat, p.lon], { radius: 4, stroke: false, fillColor: ["PVT", "UND", "UNK"].includes(String(p.agency).toUpperCase()) ? "#3ecf8e" : "#f5b83d", fillOpacity: 0.9 })
      .bindTooltip(`${["PVT", "UND", "UNK"].includes(String(p.agency).toUpperCase()) ? "private" : "public (" + p.agency + ")"}${p.elev != null ? " · " + Math.round(p.elev * 3.281) + " ft" : ""}`).addTo(lyr));
  }
  function render() {
    if (!current) return;
    const { c, R, d } = current, pid = $("rxProfile").value, sc = score(d, pid);
    current.score = sc;
    const scale = R / MI <= 3 ? "Scale 2 · block" : R / MI <= 12 ? "Scale 2 · corridor" : R / MI <= 35 ? "Scale 3 · town / region" : "Scale 3 · region";
    $("rxHead").innerHTML = `<div class="rx-grade g-${sc.grade}">${sc.grade}<small>${fmt(sc.total)}</small></div>
      <div><h3>${esc(sc.prof.label)} · ${esc(c.label)}</h3>
      <div class="place-meta">${scale} · ${fmt(R / MI)}-mile radius · ${fmt(d.tracts || 0)} census tracts · ${fmt(d.pop || 0)} people inside · ${fmt(sc.coverage * 100)}% of weight scored</div></div>`;
    $("rxCard").innerHTML = sc.rows.map((r) => `<div class="tile t-${toneOf(r.s)}" title="weight ${r.w}"><span>${esc(r.label)} <em>×${r.w}</em></span><b>${r.value}</b><i class="bar"><i style="width:${r.s == null ? 0 : r.s}%"></i></i><small>${r.s == null ? "no data" : fmt(r.s) + " / 100"}</small></div>`).join("");
    $("rxNarr").innerHTML = narrative(sc, d, c);
    $("rxOut").hidden = false;
  }
  async function analyze(text, whereOverride, radiusMi, profileOverride) {
    const st = $("rxStatus"); st.className = "uw-status"; st.textContent = "Reading the idea…";
    const p = parseIdea(text);
    const pid = profileOverride || p.pid || DEFAULT_PROFILE;
    $("rxProfile").value = pid;
    $("rxWhere").value = whereOverride || p.where;
    let c;
    try { c = await locate(whereOverride || p.where, whereOverride ? null : p.dir); } catch (e) { st.textContent = e.message; st.className = "uw-status is-err"; return null; }
    const R = radiusMi * MI;
    $("rxOut").hidden = false; $("rxHead").innerHTML = `<div><h3>${esc(PROFILES[pid].label)} · ${esc(c.label)}</h3><div class="place-meta">Pulling ${STEPS.length} data layers…</div></div>`;
    $("rxCard").innerHTML = ""; $("rxNarr").innerHTML = "";
    $("rxSteps").innerHTML = STEPS.map((s) => `<span class="stp" data-s="${s}">${s}</span>`).join("");
    drawMap(c, R, null);
    const d = await gather(c, R, (k, ok) => { const el = document.querySelector(`.stp[data-s="${k}"]`); if (el) el.className = `stp ${ok ? "ok" : "bad"}`; });
    current = { c, R, d, text };
    drawMap(c, R, d);
    render();
    st.textContent = `Detected use: ${PROFILES[pid].label}${p.pid ? "" : " (default; pick another above)"} · place: ${c.label}. Switch the use to rescore instantly.`;
    history.replaceState(null, "", `#idea=${encodeURIComponent(text)}&r=${radiusMi}&use=${pid}`);
    return { c, R, d };
  }

  // ---------- compare ----------
  async function compare(lines, radiusMi) {
    const rows = [], out = $("rxCmp");
    out.innerHTML = `<p class="note">Scoring ${lines.length} areas…</p>`;
    for (const line of lines) {
      const [where, idea] = line.split("|").map((s) => s.trim());
      const p = parseIdea(idea || where), pid = p.pid || $("rxProfile").value || DEFAULT_PROFILE;
      try {
        const c = await locate(idea ? where : p.where, idea ? null : p.dir);
        const d = await gather(c, radiusMi * MI, () => {});
        rows.push({ line, c, d, pid, sc: score(d, pid) });
      } catch (e) { rows.push({ line, err: e.message }); }
      drawCmp(rows);
    }
  }
  function drawCmp(rows) {
    const done = rows.filter((r) => r.sc).sort((a, b) => (b.sc.total ?? -1) - (a.sc.total ?? -1));
    const keys = [...new Set(done.flatMap((r) => r.sc.rows.map((x) => x.k)))];
    $("rxCmp").innerHTML = `<div class="b-scroll"><table class="b-table"><thead><tr><th>#</th><th>Area · use</th><th>Score</th>${keys.map((k) => `<th>${esc(F[k].label)}</th>`).join("")}</tr></thead><tbody>
      ${done.map((r, i) => `<tr><td class="idx">${i + 1}</td><td class="place"><b>${esc(r.c.label)}</b><span>${esc(PROFILES[r.pid].label)}</span></td>
        <td><span class="vchip g-${r.sc.grade}">${r.sc.grade} ${fmt(r.sc.total)}</span></td>
        ${keys.map((k) => { const x = r.sc.rows.find((y) => y.k === k); return x ? `<td class="c-${toneOf(x.s)}" title="${esc(String(x.value).replace(/<[^>]+>/g, ""))}">${x.s == null ? "–" : fmt(x.s)}</td>` : `<td class="na">·</td>`; }).join("")}</tr>`).join("")}
      ${rows.filter((r) => r.err).map((r) => `<tr><td></td><td class="place"><b>${esc(r.line)}</b><span class="err">${esc(r.err)}</span></td></tr>`).join("")}
      </tbody></table></div><p class="note">Cells are factor scores 0–100 (hover for the raw value). Ranked by weighted total.</p>`;
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("rxProfile").innerHTML = Object.entries(PROFILES).map(([k, p]) => `<option value="${k}">${p.label}</option>`).join("");
    $("rxForm").addEventListener("submit", (e) => { e.preventDefault(); const t = $("rxIdea").value.trim(); if (t) analyze(t, null, +$("rxRadius").value); });
    $("rxRerun").addEventListener("click", () => { const t = $("rxIdea").value.trim() || $("rxWhere").value; analyze(t, $("rxWhere").value.trim(), +$("rxRadius").value, $("rxProfile").value); });
    $("rxProfile").addEventListener("change", render);
    document.querySelectorAll("[data-idea]").forEach((b) => b.addEventListener("click", () => { $("rxIdea").value = b.dataset.idea; $("rxRadius").value = b.dataset.r || "25"; analyze(b.dataset.idea, null, +$("rxRadius").value); }));
    $("rxCmpRun").addEventListener("click", () => { const ls = $("rxCmpIn").value.split(/\n/).map((s) => s.trim()).filter(Boolean).slice(0, 12); if (ls.length) compare(ls, +$("rxRadius").value); });
    const h = new URLSearchParams(location.hash.slice(1));
    if (h.get("idea")) { $("rxIdea").value = h.get("idea"); $("rxRadius").value = h.get("r") || "25"; analyze(h.get("idea"), null, +$("rxRadius").value, h.get("use")); }
  });
  window.RegionEngine = { analyze, compare, PROFILES, F };
})();
