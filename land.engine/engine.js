// Land Engine: parcel underwriter (single parcel + batch table).
// Input: address, "lat, lon", map link, or listing link -> go / check / kill screen.
(() => {
  const SVC = {
    geocode: "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates",
    reverse: "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode",
    elev: "https://epqs.nationalmap.gov/v1/json",
    flood: "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/identify",
    sma: "https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_SMA_Cached_without_PriUnk/MapServer/1/query",
    plss: "https://gis.blm.gov/arcgis/rest/services/Cadastral/BLM_Natl_PLSS_CadNSDI/MapServer/2/query",
    nhd: "https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer/6/query",
    roads: "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Transportation/MapServer/8/query",
    majorRoads: "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Transportation/MapServer/3/query",
    primaryRoads: "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Transportation/MapServer/2/query",
    secondaryRoads: "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Transportation/MapServer/6/query",
    walk: "https://geodata.epa.gov/arcgis/rest/services/OA/WalkabilityIndex/MapServer/0/query",
    gw: "https://api.waterdata.usgs.gov/ogcapi/v0/collections/field-measurements/items",
    smaTiles: "https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_SMA_Cached_without_PriUnk/MapServer/tile/{z}/{y}/{x}",
    imagery: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
  };
  const AGENCY = { BLM: "Bureau of Land Management", USFS: "U.S. Forest Service", NPS: "National Park Service",
    FWS: "Fish & Wildlife Service", BOR: "Bureau of Reclamation", DOD: "Dept. of Defense", BIA: "Bureau of Indian Affairs",
    DOE: "Dept. of Energy", ST: "State land", LG: "Local government", OTHF: "Other federal", TVA: "TVA", NOAA: "NOAA" };
  const NOT_PUBLIC = new Set(["PVT", "UND", "UNK", ""]); // private / undetermined -> not public land
  const isPublic = (code) => !!code && !NOT_PUBLIC.has(String(code).toUpperCase());
  const NHD_KIND = { 46003: "intermittent stream", 46006: "perennial stream", 46007: "ephemeral wash", 33600: "canal/ditch", 33601: "aqueduct", 46000: "stream", 55800: "artificial path", 42800: "pipeline", 42801: "pipeline", 42802: "pipeline" };
  const CHECK_CAP_MS = 80000;
  const STATE_ABBR = { Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA", Colorado: "CO", Connecticut: "CT", Delaware: "DE",
    "District of Columbia": "DC", Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS",
    Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS",
    Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
    "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI",
    "South Carolina": "SC", "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT", Virginia: "VA", Washington: "WA",
    "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY" };
  const stateOf = (p) => (p.state && p.state.length === 2 ? p.state.toUpperCase() : STATE_ABBR[p.state]) || null;
  const MRDS_STAT = { P: "producer", PP: "past producer", PR: "prospect", O: "occurrence", PL: "plant", U: "unknown" };

  const packCache = {};
  const $ = (id) => document.getElementById(id);
  const fmt = (n, d = 0) => n == null || isNaN(n) ? "–" : Number(n).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
  const money = (n) => n == null ? "–" : n >= 1e6 ? `$${fmt(n / 1e6, n >= 1e8 ? 0 : 1)}M` : n >= 1e3 ? `$${fmt(n / 1e3)}K` : `$${fmt(n)}`;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function hav(lat1, lon1, lat2, lon2) {
    const R = 6371008.8, r = Math.PI / 180;
    const dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }
  const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const offset = (lat, lon, dist, bearingDeg) => {
    const R = 6371008.8, b = bearingDeg * Math.PI / 180, d = dist / R, p1 = lat * Math.PI / 180, l1 = lon * Math.PI / 180;
    const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
    const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
    return [p2 * 180 / Math.PI, l2 * 180 / Math.PI];
  };
  // Shortest distance (m) from a point to an Esri polyline (WGS84 paths).
  function distToPaths(lat, lon, paths) {
    const kx = Math.cos(lat * Math.PI / 180) * 111320, ky = 110540;
    let best = Infinity;
    for (const path of paths) for (let i = 1; i < path.length; i++) {
      const ax = (path[i - 1][0] - lon) * kx, ay = (path[i - 1][1] - lat) * ky;
      const bx = (path[i][0] - lon) * kx, by = (path[i][1] - lat) * ky;
      const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
      const t = L ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L)) : 0;
      best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
    }
    return best;
  }

  // GET JSON with a per-attempt timeout and one retry (federal map services are flaky).
  async function getJSON(url, params, ms = 20000, tries = 2) {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    let last;
    for (let a = 0; a < tries; a++) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), ms);
      try {
        const r = await fetch(url + qs, { signal: ctl.signal });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        if (j && j.error) throw new Error(j.error.message || "service error");
        return j;
      } catch (e) {
        last = e.name === "AbortError" ? new Error("timed out") : e;
        if (a < tries - 1) await sleep(800 * (a + 1));
      } finally { clearTimeout(timer); }
    }
    throw last;
  }
  const capped = (promise) => Promise.race([promise, sleep(CHECK_CAP_MS).then(() => { throw new Error("service too slow"); })]);
  const ptGeom = (lat, lon) => JSON.stringify({ x: lon, y: lat, spatialReference: { wkid: 4326 } });
  const esriPoint = (lat, lon, extra) => ({ geometry: ptGeom(lat, lon), geometryType: "esriGeometryPoint", inSR: 4326,
    spatialRel: "esriSpatialRelIntersects", returnGeometry: false, f: "json", ...extra });

  async function loadPack(path) {
    if (!packCache[path]) packCache[path] = fetch(path).then((r) => { if (!r.ok) throw new Error(`pack ${r.status}`); return r.json(); });
    return packCache[path];
  }

  // ---------- input parsing ----------
  function parseInput(raw) {
    const s = raw.trim();
    let m = s.match(/^(-?\d{1,2}\.\d+)\s*[, ]\s*(-?\d{1,3}\.\d+)$/);
    if (m) return { lat: +m[1], lon: +m[2], how: "coordinates" };
    m = s.match(/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/) || s.match(/!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/) ||
        s.match(/[?&](?:q|ll|query)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/);
    if (m) return { lat: +m[1], lon: +m[2], how: "map link" };
    if (/^https?:\/\//i.test(s)) {
      let slug = null;
      try {
        const u = new URL(s), parts = u.pathname.split("/").filter(Boolean);
        if (/homes\.com/.test(u.host)) slug = parts[parts.indexOf("property") + 1];
        else if (/zillow\.com/.test(u.host)) slug = parts[parts.indexOf("homedetails") + 1];
        else if (/redfin\.com/.test(u.host)) slug = parts.slice(1, 3).reverse().join(" ") + " " + (parts[0] || "");
        else if (/realtor\.com/.test(u.host)) slug = (parts.find((p) => /_/.test(p)) || "").replace(/_M[\d-]+$/, "");
        else if (/trulia\.com/.test(u.host)) slug = parts[parts.length - 1];
        else slug = parts.find((p) => /\d+-[a-z]/i.test(p));
      } catch (e) { /* not a URL */ }
      if (slug) return { address: slug.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim(), how: "listing link" };
      return { error: "Couldn't read an address or coordinates from that link. Paste the street address instead." };
    }
    return { address: s, how: "address" };
  }

  async function geocode(q) {
    const j = await getJSON(SVC.geocode, { SingleLine: q, f: "json", maxLocations: 1,
      outFields: "Match_addr,Subregion,Region,RegionAbbr,City,Addr_type", countryCode: "USA" });
    const c = j.candidates && j.candidates[0];
    if (!c || c.score < 70) throw new Error("No confident match for that address.");
    return { lat: c.location.y, lon: c.location.x, label: c.attributes.Match_addr, county: c.attributes.Subregion,
      state: c.attributes.RegionAbbr || c.attributes.Region, precision: c.attributes.Addr_type, score: c.score };
  }
  async function reverse(lat, lon) {
    try {
      const j = await getJSON(SVC.reverse, { location: `${lon},${lat}`, f: "json", outSR: 4326 });
      const a = j.address || {};
      return { label: a.Match_addr || a.LongLabel || `${lat.toFixed(5)}, ${lon.toFixed(5)}`, county: a.Subregion, state: a.RegionAbbr || a.Region, precision: "coordinates" };
    } catch { return { label: `${lat.toFixed(5)}, ${lon.toFixed(5)}`, precision: "coordinates" }; }
  }
  async function locate(raw) {
    const parsed = parseInput(raw);
    if (parsed.error) throw new Error(parsed.error);
    if (parsed.address) return { ...(await geocode(parsed.address)), how: parsed.how, query: raw };
    return { lat: parsed.lat, lon: parsed.lon, how: parsed.how, query: raw, ...(await reverse(parsed.lat, parsed.lon)) };
  }
  const regionFor = (p) => window.LE_REGIONS.find((r) => p.lon >= r.bbox[0] && p.lon <= r.bbox[2] && p.lat >= r.bbox[1] && p.lat <= r.bbox[3]);

  // ---------- checks ----------
  // Each returns { status: go|caution|kill|info|na, headline, detail, cell (short table text), num (sortable) }
  async function chkElevation(p) {
    const j = await getJSON(SVC.elev, { x: p.lon, y: p.lat, wkid: 4326, units: "Feet", includeDate: false }, 15000, 3);
    const v = +j.value;
    if (!isFinite(v) || v < -1000) return { status: "na", headline: "No elevation data", cell: "–" };
    return { status: "info", headline: `${fmt(v)} ft`, detail: v > 6000 ? "High country: snow load, short build season, cooler summers." : "", cell: `${fmt(v)} ft`, num: v };
  }
  async function chkFlood(p) {
    // identify + match by layer name: FEMA serves mixed service versions whose layer ids differ.
    const d = 0.01;
    const j = await getJSON(SVC.flood, { geometry: `${p.lon},${p.lat}`, geometryType: "esriGeometryPoint", sr: 4326, layers: "all",
      tolerance: 1, mapExtent: `${p.lon - d},${p.lat - d},${p.lon + d},${p.lat + d}`, imageDisplay: "400,400,96", returnGeometry: false, f: "json" }, 25000, 3);
    const f = (j.results || []).find((r) => /flood hazard zones/i.test(r.layerName || ""));
    if (!f) return { status: "caution", headline: "Unmapped", detail: "No FEMA flood mapping here. That's common in rural counties; check drainage on the ground.", cell: "unmapped" };
    const a = f.attributes, sfha = a.SFHA_TF === "T";
    const sub = a.ZONE_SUBTY && !/^null$/i.test(a.ZONE_SUBTY) ? " · " + a.ZONE_SUBTY.toLowerCase() : "";
    if (a.FLD_ZONE === "D") return { status: "caution", headline: "Zone D · flood risk undetermined",
      detail: "FEMA never studied this area, which is common in rural Nevada. No insurance mandate, but no clearance either: check drainage and washes on the ground.", cell: "Zone D" };
    return { status: sfha ? "kill" : "go", headline: `Zone ${a.FLD_ZONE}${sub}`,
      detail: sfha ? "In the 100-year floodplain. A lender will require flood insurance, and basements are at risk." : "Outside the 100-year floodplain. No flood insurance requirement.",
      cell: `Zone ${a.FLD_ZONE}${sfha ? " (SFHA)" : ""}` };
  }
  async function chkLandStatus(p) {
    const code = (j) => j.features?.[0]?.attributes?.ADMIN_AGENCY_CODE || null;
    const at = getJSON(SVC.sma, esriPoint(p.lat, p.lon, { outFields: "ADMIN_AGENCY_CODE,ADMIN_UNIT_NAME" }));
    const ring = [0, 45, 90, 135, 180, 225, 270, 315].map((b) => {
      const [la, lo] = offset(p.lat, p.lon, 400, b);
      return getJSON(SVC.sma, esriPoint(la, lo, { outFields: "ADMIN_AGENCY_CODE" })).then(code).catch(() => undefined);
    });
    const [here, ...around] = await Promise.all([at, ...ring]);
    const h = here.features?.[0]?.attributes;
    const known = around.filter((x) => x !== undefined).length;
    const pubCodes = around.filter(isPublic), pub = pubCodes.length;
    const agencies = [...new Set(pubCodes)];
    if (h && isPublic(h.ADMIN_AGENCY_CODE))
      return { status: "kill", headline: `Public land: ${AGENCY[h.ADMIN_AGENCY_CODE] || h.ADMIN_AGENCY_CODE}`,
        detail: `The point itself sits on ${esc(h.ADMIN_UNIT_NAME || "public land")}, not a private parcel. Check the pin location.`, cell: `public (${h.ADMIN_AGENCY_CODE})` };
    let status = "go", detail = "Private land, with private land on all sides within 400 m.";
    if (pub >= 6) { status = "caution"; detail = `Private inholding: public land on ${pub} of ${known} sides (${agencies.join(", ")}). Great for privacy, but confirm legal access across it.`; }
    else if (pub >= 1) detail = `Public land on ${pub} of ${known} sides within 400 m (${agencies.join(", ")}).`;
    const undetermined = h && String(h.ADMIN_AGENCY_CODE).toUpperCase() === "UND";
    return { status, headline: `Private${undetermined ? " (ownership unclassified)" : ""}${pub ? ` · public land on ${pub}/${known} sides` : ""}`, detail,
      cell: pub ? `private · ${pub}/${known} public` : "private", num: pub };
  }
  async function chkPLSS(p) {
    const j = await getJSON(SVC.plss, esriPoint(p.lat, p.lon, { outFields: "PLSSID,FRSTDIVLAB,FRSTDIVNO" }));
    const a = j.features?.[0]?.attributes;
    if (!a) return { status: "na", headline: "Not on the public land survey grid", cell: "–" };
    const id = a.PLSSID || "";
    const t = id.length >= 14 ? `T${+id.slice(4, 7)}${id[8]} R${+id.slice(9, 12)}${id[13]}` : id;
    const s = `${t} · Sec ${a.FRSTDIVLAB || a.FRSTDIVNO || "?"}`;
    return { status: "info", headline: s, detail: `Survey ID ${esc(id)}. This is how rural listings and auction rolls describe parcels.`, cell: s };
  }
  async function chkWater(p) {
    const j = await getJSON(SVC.nhd, { geometry: `${p.lon},${p.lat}`, geometryType: "esriGeometryPoint", inSR: 4326, outSR: 4326,
      distance: 400, units: "esriSRUnit_Meter", spatialRel: "esriSpatialRelIntersects", outFields: "gnis_name,fcode",
      returnGeometry: true, f: "json", resultRecordCount: 60 }, 15000, 4);
    const feats = (j.features || []).map((f) => ({ name: f.attributes.gnis_name || f.attributes.GNIS_NAME, fcode: f.attributes.fcode ?? f.attributes.FCODE,
      d: f.geometry?.paths ? distToPaths(p.lat, p.lon, f.geometry.paths) : 400 }));
    if (!feats.length) return { status: "go", headline: "No mapped drainage within 400 m", detail: "Still verify on aerial imagery; small washes are often unmapped.", cell: "none mapped" };
    feats.sort((a, b) => a.d - b.d);
    const n = feats[0], kind = NHD_KIND[n.fcode] || "drainage";
    const ephem = feats.filter((f) => f.fcode === 46007 || f.fcode === 46003);
    const perennial = feats.find((f) => f.fcode === 46006);
    let status = "info", detail = `${feats.length} mapped line${feats.length > 1 ? "s" : ""} within 400 m.`;
    if (ephem.length && ephem[0].d < 120) { status = "caution"; detail = `An ${NHD_KIND[ephem[0].fcode]} runs ${fmt(ephem[0].d)} m away. Wash land is unusable acreage and a flash-flood path. Deduct it from the listed acres.`; }
    if (perennial && perennial.d < 300) detail += ` Perennial water ${fmt(perennial.d)} m away${perennial.name ? " (" + esc(perennial.name) + ")" : ""}: a real amenity, and a high-water-table check for basements.`;
    return { status, headline: `${kind[0].toUpperCase() + kind.slice(1)}${n.name ? " · " + esc(n.name) : ""} at ${fmt(n.d)} m`, detail,
      cell: `${kind} ${fmt(n.d)} m`, num: n.d };
  }
  async function chkAccess(p) {
    const q = (url, dist) => getJSON(url, { geometry: `${p.lon},${p.lat}`, geometryType: "esriGeometryPoint", inSR: 4326, outSR: 4326,
      distance: dist, units: "esriSRUnit_Meter", spatialRel: "esriSpatialRelIntersects", outFields: "NAME,MTFCC",
      returnGeometry: true, f: "json", resultRecordCount: 40 });
    const [local, major] = await Promise.all([q(SVC.roads, 1500), q(SVC.majorRoads, 15000).catch(() => ({ features: [] }))]);
    const nearest = (j) => (j.features || []).map((f) => ({ name: f.attributes.NAME, d: f.geometry?.paths ? distToPaths(p.lat, p.lon, f.geometry.paths) : Infinity }))
      .sort((a, b) => a.d - b.d)[0];
    const l = nearest(local), m = nearest(major);
    const majorTxt = m ? ` Nearest highway: ${esc(m.name || "unnamed")} at ${fmt(m.d / 1609.34, 1)} mi.` : "";
    if (!l) return { status: "kill", headline: "No mapped road within 1.5 km", detail: "Possibly landlocked. A parcel with no legal access trades 30–50% below comparable land, and lenders won't finance it." + majorTxt, cell: "none ≤1.5 km", num: 1500 };
    const status = l.d <= 60 ? "go" : l.d <= 400 ? "caution" : "kill";
    const detail = l.d <= 60 ? "Fronts a mapped road." : l.d <= 400 ? "A mapped road is nearby but not adjacent (common on private drives and campuses). Confirm a recorded easement." : "Far from any mapped road. Treat it as landlocked until a recorded easement is confirmed.";
    return { status, headline: `${esc(l.name || "Unnamed road")} · ${fmt(l.d)} m`, detail: detail + majorTxt, cell: `${fmt(l.d)} m`, num: l.d };
  }
  // Groundwater: regional well-log pack first; USGS monitoring wells (national) where the pack is silent.
  async function chkGroundwater(p, region) {
    if (region) {
      const r = await chkWells(p, region);
      if (p._wells && p._wells.length) return r;
    }
    return chkGroundwaterUSGS(p);
  }
  async function chkGroundwaterUSGS(p) {
    const dLat = 0.13, dLon = 0.13 / Math.cos(p.lat * Math.PI / 180);
    const j = await getJSON(SVC.gw, { bbox: `${p.lon - dLon},${p.lat - dLat},${p.lon + dLon},${p.lat + dLat}`, parameter_code: "72019", limit: 2000, f: "json" }, 30000, 2);
    const latest = new Map();
    for (const f of j.features || []) {
      const pr = f.properties || {}, v = parseFloat(pr.value), c = f.geometry && f.geometry.coordinates;
      if (!c || !isFinite(v) || v < 0) continue;
      const prev = latest.get(pr.monitoring_location_id);
      if (!prev || pr.time > prev.time) latest.set(pr.monitoring_location_id, { lat: c[1], lon: c[0], swl: v, time: pr.time, year: pr.year, d: hav(p.lat, p.lon, c[1], c[0]) });
    }
    const near = [...latest.values()].filter((w) => w.d <= 14500).sort((a, b) => a.d - b.d);
    p._wells = near.map((w) => ({ ...w, depth: null }));
    if (!near.length) return { status: "caution", headline: "No USGS monitoring wells within ~9 mi", detail: "No public water-level record nearby. Budget a test well, or ask neighbors and local drillers for well depths.", cell: "no data" };
    const mSwl = median(near.map((w) => w.swl)), recent = near.filter((w) => w.year >= 2010);
    const status = mSwl <= 300 ? "go" : mSwl <= 600 ? "caution" : "kill";
    return { status, headline: `${near.length} USGS wells within ~9 mi · water at ~${fmt(mSwl)} ft`,
      detail: `Latest depth-to-water per monitoring well; median ${fmt(mSwl)} ft, nearest ${fmt(near[0].d / 1609.34, 1)} mi away (${fmt(near[0].swl)} ft, ${near[0].year}). ${recent.length} of ${near.length} measured since 2010; older readings can lag today's water table.`,
      cell: `~${fmt(mSwl)} ft (${near.length} USGS)`, num: mSwl };
  }
  async function chkWalk(p) {
    const j = await getJSON(SVC.walk, esriPoint(p.lat, p.lon, { outFields: "NatWalkInd,D3B,D4A" }));
    const a = j.features?.[0]?.attributes;
    if (!a || a.NatWalkInd == null) return { status: "na", headline: "No walkability score here", cell: "–" };
    const s = a.NatWalkInd, cls = s >= 15.26 ? "most walkable" : s >= 10.51 ? "above average" : s >= 5.76 ? "below average" : "least walkable";
    const transit = a.D4A > 0 ? `Transit stop about ${fmt(a.D4A)} m away.` : "No fixed-route transit within reach.";
    return { status: "info", headline: `${fmt(s, 1)} / 20 · ${cls}`,
      detail: `EPA National Walkability Index for this block group. ${fmt(a.D3B)} street intersections per square mile. ${transit} Low scores are normal, and often the point, for rural land.`,
      cell: `${fmt(s, 1)}`, num: s };
  }
  // Traffic & noise proxy from road class and distance (no national traffic-count service exists).
  async function chkTraffic(p) {
    const q = (url, dist) => getJSON(url, { geometry: `${p.lon},${p.lat}`, geometryType: "esriGeometryPoint", inSR: 4326, outSR: 4326,
      distance: dist, units: "esriSRUnit_Meter", spatialRel: "esriSpatialRelIntersects", outFields: "NAME,MTFCC",
      returnGeometry: true, f: "json", resultRecordCount: 25 }).catch(() => ({ features: [] }));
    const [pri, sec] = await Promise.all([q(SVC.primaryRoads, 1500), q(SVC.secondaryRoads, 600)]);
    const near = (j) => (j.features || []).map((f) => ({ name: f.attributes.NAME, d: f.geometry?.paths ? distToPaths(p.lat, p.lon, f.geometry.paths) : Infinity })).sort((a, b) => a.d - b.d)[0];
    const P = near(pri), S = near(sec);
    if (P && P.d < 150) return { status: "kill", headline: `Freeway ${fmt(P.d)} m away · ${esc(P.name || "primary road")}`, detail: "Constant traffic noise, dust, and night light. Expect a resale discount, and verify the noise in person at rush hour.", cell: `freeway ${fmt(P.d)} m`, num: P.d };
    if (P && P.d < 600) return { status: "caution", headline: `Freeway ${fmt(P.d)} m away · ${esc(P.name || "primary road")}`, detail: "Audible highway hum is likely outdoors. Check a noise score and stand on the lot.", cell: `freeway ${fmt(P.d)} m`, num: P.d };
    if (S && S.d < 80) return { status: "caution", headline: `Fronts a highway/arterial · ${esc(S.name || "secondary road")}`, detail: "Busy-road frontage: traffic noise and access-turn safety. Interiors with good glazing or shutters can still be quiet.", cell: `arterial ${fmt(S.d)} m`, num: S.d };
    return { status: "go", headline: "No freeway within 600 m or arterial frontage", detail: `Quiet road context by class.${P ? ` Nearest freeway ${fmt(P.d / 1609.34, 1)} mi.` : ""} This is a proxy from road type and distance, not measured traffic counts.`, cell: "quiet", num: P ? P.d : 1500 };
  }
  async function chkWells(p, region) {
    const wells = await loadPack(region.packs.wells);
    const rM = region.wellRadiusMi * 1609.34;
    let near = [], radius = region.wellRadiusMi;
    for (const r of [rM, rM * 3]) {
      near = [];
      for (const w of wells) { const d = hav(p.lat, p.lon, w[0], w[1]); if (d <= r) near.push({ lat: w[0], lon: w[1], depth: w[2], swl: w[3], basin: w[4], year: w[5], d }); }
      radius = r / 1609.34;
      if (near.length >= 3) break;
    }
    p._wells = near;
    if (!near.length) return { status: "caution", headline: `No logged wells within ${fmt(radius)} mi`, detail: "No local proof of water. Budget a test well, or assume hauled water. (Pack coverage: the basins downloaded so far.)", cell: `none ≤${fmt(radius)} mi` };
    const swl = near.map((w) => w.swl).filter((v) => v != null && v >= 0), dep = near.map((w) => w.depth).filter((v) => v != null && v > 0);
    const mSwl = median(swl), mDep = median(dep), nearest = near.reduce((a, b) => (a.d < b.d ? a : b));
    const status = mSwl == null ? "caution" : mSwl <= 300 ? "go" : mSwl <= 600 ? "caution" : "kill";
    const cost = mDep ? `Typical drilled depth ${fmt(mDep)} ft ≈ ${money(mDep * 30)}–${money(mDep * 50)} to drill, plus pump.` : "";
    return { status, headline: `${near.length} wells within ${fmt(radius)} mi · water at ~${fmt(mSwl)} ft`,
      detail: `Median static water level ${fmt(mSwl)} ft; nearest well ${fmt(nearest.d / 1609.34, 1)} mi away (basin ${esc(nearest.basin)}). ${cost} Domestic wells need no water-right purchase in Nevada (NRS 534.180, 2 acre-ft/yr).`,
      cell: `~${fmt(mSwl)} ft (${near.length} wells)`, num: mSwl };
  }
  // Mineral history: regional pack (with assay grades) when inside a region, else the national USGS MRDS state pack.
  async function chkMines(p, region) {
    const st = stateOf(p);
    const radiusKm = region ? region.mineRadiusKm : 10;
    let mines, national = false;
    if (region) mines = await loadPack(region.packs.mines);
    else if (st) { mines = await loadPack(`data/mrds/${st}.json`).catch(() => null); national = true; }
    if (!mines) return { status: "na", headline: "No mineral database for this location", cell: "–" };
    const r = radiusKm * 1000, near = [];
    for (const m of mines) {
      const d = hav(p.lat, p.lon, m[0], m[1]);
      if (d <= r) near.push(national ? { lat: m[0], lon: m[1], name: m[2], comm: m[3], stat: m[4], d } : { lat: m[0], lon: m[1], name: m[2], comm: m[3], au: m[4], ag: m[5], d });
    }
    near.sort((a, b) => a.d - b.d);
    p._mines = near;
    if (!near.length) return { status: "info", headline: `No recorded mines within ${radiusKm} km`, cell: "0", num: 0 };
    const producers = near.filter((m) => m.stat === "P" || m.stat === "PP").length;
    if (national) {
      const comm = {};
      near.forEach((m) => (m.comm || "").split(/,\s*/).filter(Boolean).forEach((c) => (comm[c] = (comm[c] || 0) + 1)));
      const ranked = Object.entries(comm).sort((a, b) => b[1] - a[1]);
      return { status: "info", headline: `${near.length} recorded deposits within ${radiusKm} km${producers ? ` · ${producers} produced` : ""}`,
        detail: `Nearest: ${esc(near[0].name || "unnamed")} (${MRDS_STAT[near[0].stat] || "site"}) at ${fmt(near[0].d / 1000, 1)} km. Commodities: ${esc(ranked.slice(0, 4).map(([c, n]) => `${c} (${n})`).join(", "))}. Mineral upside only counts if the deed includes mineral rights. Check for severance.`,
        cell: `${near.length}${ranked[0] ? " · " + ranked[0][0].toLowerCase() : ""}`, num: near.length };
    }
    const comm = {};
    near.forEach((m) => (m.comm || "").split(/[,;]\s*/).filter(Boolean).forEach((c) => (comm[c.trim()] = (comm[c.trim()] || 0) + 1)));
    const ranked = Object.entries(comm).sort((a, b) => b[1] - a[1]);
    const top = ranked.slice(0, 4).map(([c, n]) => `${c} (${n})`).join(", ");
    return { status: "info", headline: `${near.length} recorded mines within ${region.mineRadiusKm} km`,
      detail: `Nearest: ${esc(near[0].name || "unnamed")} at ${fmt(near[0].d / 1000, 1)} km. Commodities: ${esc(top)}. Mineral upside only counts if the deed includes mineral rights. Check for severance.`,
      cell: `${near.length}${ranked[0] ? " · " + ranked[0][0].toLowerCase() : ""}`, num: near.length };
  }
  // Land value: nearest FHFA census tract (238 metros) -> region raw-land band -> county -> hand-built zone tables.
  async function chkMarket(p, region) {
    try {
      const idx = await loadPack("data/surfaces/index.json");
      const cands = idx.metros.filter((m) => p.lon >= m.bbox[0] - 0.05 && p.lon <= m.bbox[2] + 0.05 && p.lat >= m.bbox[1] - 0.05 && p.lat <= m.bbox[3] + 0.05)
        .sort((a, b) => hav(p.lat, p.lon, a.lat, a.lon) - hav(p.lat, p.lon, b.lat, b.lon)).slice(0, 2);
      let best = null;
      for (const m of cands) {
        const doc = await loadPack(`data/surfaces/m/${m.code}.json`);
        for (const t of doc.t) { const d = hav(p.lat, p.lon, t[0], t[1]); if (!best || d < best.d) best = { t, d, m, years: doc.years }; }
      }
      if (best && best.d <= 4000) {
        const [, , ser, share, spsf, lot, sqft, pv, direct] = best.t;
        const yi = ser.length - 1 - [...ser].reverse().findIndex((v) => v != null), ppa = ser[yi], yr = best.years[yi];
        const first = ser.find((v) => v != null), y0 = best.years[ser.indexOf(first)];
        const chg = first ? (ppa / first - 1) * 100 : null;
        const rel = best.m.median_ppa ? ppa / best.m.median_ppa : null;
        return { status: "info", rel, headline: `~${money(ppa)}/acre residential land (${yr})`,
          detail: `FHFA single-family land value for the nearest census tract (${fmt(best.d)} m away, ${esc(best.m.name)}). Land is ${share != null ? fmt(share * 100) + "%" : "–"} of property value; the structure prices at ~$${fmt(spsf)}/sqft on a typical ${fmt(lot)} sqft lot with ${fmt(sqft)} sqft interior. ${chg != null ? `${chg >= 0 ? "+" : ""}${fmt(chg)}% since ${y0}. ` : ""}Metro median ${money(best.m.median_ppa)}/acre.${direct ? "" : " Tract trend scaled from its county index."}`,
          cell: `~${money(ppa)}${rel != null ? ` · ${fmt(rel, 1)}× metro` : ""}`, num: ppa, share, spsf, surface: { fhfa: true, id: best.m.code, label: best.m.name } };
      }
      if (!region) {
        const cs = await loadPack("data/surfaces/counties.json");
        const c = cs.c.map((r) => ({ r, d: hav(p.lat, p.lon, r[0], r[1]) })).sort((a, b) => a.d - b.d)[0];
        if (c && c.d <= 80000) {
          const [, , , name, ppa, share, spsf] = c.r;
          return { status: "info", headline: `~${money(ppa)}/acre residential land (county)`,
            detail: `FHFA single-family land value for ${esc(name)}, the nearest county with data. Residential lots only: raw acreage outside town trades far lower.${share != null ? ` Land share ${fmt(share * 100)}%; structure ~$${fmt(spsf)}/sqft.` : ""}`,
            cell: `~${money(ppa)} (cty)`, num: ppa, share, spsf };
        }
      }
    } catch (e) { /* fall through to static tables */ }
    return chkMarketStatic(p, region);
  }
  function chkMarketStatic(p, region) {
    for (const s of window.LE_SURFACES) {
      const ds = s.zones.map((z) => ({ z, d: hav(p.lat, p.lon, z[1], z[2]) })).sort((a, b) => a.d - b.d);
      if (ds[0].d / 1000 > s.radiusKm) continue;
      const k = ds.slice(0, 3), w = k.map((x) => 1 / Math.max(x.d, 500) ** 2), sw = w.reduce((a, b) => a + b, 0);
      const est = k.reduce((a, x, i) => a + x.z[3] * w[i], 0) / sw;
      return { status: "info", headline: `~${money(est)}/acre land`, detail: `Inverse-distance blend of the 3 nearest ${s.label} zones (nearest: ${esc(ds[0].z[0])}). Zone-level estimate, not a parcel appraisal.`,
        cell: `~${money(est)}`, num: est, surface: s };
    }
    if (region) {
      const near = region.metros.map((m) => ({ ...m, d: hav(p.lat, p.lon, m.lat, m.lon) / 1609.34 })).sort((a, b) => a.d - b.d)[0];
      const band = near.d < 15 ? region.priceBands[2] : near.d < 45 ? region.priceBands[1] : region.priceBands[0];
      return { status: "info", headline: `${money(band.lo)}–${money(band.hi)}/acre band`, detail: `${band.name}: ${fmt(near.d)} mi from ${near.name}. Wholesale (county auction) clearing runs about 2–2.5× below retail for identical rural product.`,
        cell: `${money(band.lo)}–${money(band.hi)}`, num: Math.sqrt(band.lo * band.hi) };
    }
    return { status: "na", headline: "No price surface for this area yet", detail: "Add a region plug-in to price it.", cell: "–" };
  }

  // Ordered check list for a located point (id, title, source, fn).
  function checkList(p, region) {
    const list = [
      ["flood", "Flood zone", "FEMA NFHL", () => chkFlood(p)],
      ["access", "Road access", "Census TIGER roads", () => chkAccess(p)],
      ["land", "Land status", "BLM surface management", () => chkLandStatus(p)],
      ["drain", "Drainage & washes", "USGS NHD", () => chkWater(p)],
      ["wells", "Groundwater", region ? "regional well logs + USGS" : "USGS monitoring wells", () => chkGroundwater(p, region)],
      ["traffic", "Traffic & noise", "Census road classes", () => chkTraffic(p)],
      ["market", "Land value", "FHFA tract surfaces", () => chkMarket(p, region)],
      ["mines", "Mineral history", "USGS MRDS", () => chkMines(p, region)],
      ["walk", "Walkability", "EPA walkability index", () => chkWalk(p)],
      ["elev", "Elevation", "USGS 3DEP", () => chkElevation(p)],
      ["plss", "Survey grid", "BLM PLSS", () => chkPLSS(p)]
    ];
    return list;
  }
  async function runChecks(list, onEach) {
    const results = {};
    await Promise.all(list.map(async ([id, , , fn]) => {
      try { results[id] = await capped(fn()); } catch (e) { results[id] = { status: "err", headline: "Service unavailable", detail: esc(e.message || e), cell: "error" }; }
      onEach && onEach(id, results[id]);
    }));
    return results;
  }
  function scoreVerdict(results) {
    const rs = Object.values(results).filter((r) => r.status !== "err");
    const kills = rs.filter((r) => r.status === "kill").length, cautions = rs.filter((r) => r.status === "caution").length;
    return { v: kills ? "kill" : cautions ? "caution" : "go", kills, cautions, clear: rs.filter((r) => r.status === "go").length, errors: Object.values(results).length - rs.length };
  }

  // ---------- single-parcel rendering ----------
  const BADGE = { go: "GO", caution: "CHECK", kill: "KILL", info: "INFO", na: "N/A", err: "ERROR" };
  // Good/bad tone for the card and batch table; info checks get a judgment where one exists.
  function tone(id, r) {
    if (!r) return "neutral";
    if (r.status === "go") return "good";
    if (r.status === "caution") return "warn";
    if (r.status === "kill") return "bad";
    if (r.status !== "info") return "neutral";
    if (id === "market" && r.rel != null) return r.rel <= 0.8 ? "good" : r.rel >= 1.5 ? "warn" : "neutral";
    if (id === "walk" && r.num != null) return r.num >= 10.51 ? "good" : "neutral";
    if (id === "mines") return r.num > 0 ? "good" : "neutral";
    if (id === "drain") return /perennial/i.test(r.headline || "") ? "good" : "neutral";
    return "neutral";
  }
  const strip = (s) => String(s ?? "").replace(/<[^>]+>/g, "");
  const tile = (id, title) => `<div class="tile is-loading" id="tile-${id}"><span>${title}</span><b>…</b></div>`;
  function fillTile(id, res) {
    const el = $(`tile-${id}`); if (!el) return;
    el.className = `tile t-${tone(id, res)}`;
    el.querySelector("b").textContent = res.status === "err" ? "error" : (res.cell ?? strip(res.headline));
    el.title = strip(res.headline) + (res.detail ? " — " + strip(res.detail) : "");
  }
  const card = (id, title, src) => `<div class="chk is-loading" id="chk-${id}"><div class="chk-head"><span class="badge">…</span><h4>${title}</h4></div>
      <div class="chk-headline">Querying ${src}…</div><div class="chk-detail"></div></div>`;
  function fill(id, res) {
    const el = $(`chk-${id}`); if (!el) return;
    el.className = `chk is-${res.status}`;
    el.querySelector(".badge").textContent = BADGE[res.status] || "";
    el.querySelector(".chk-headline").innerHTML = res.headline || "";
    el.querySelector(".chk-detail").innerHTML = res.detail || "";
  }

  let map, layers;
  function drawMap(p) {
    if (!window.L) return;
    if (!map) {
      map = L.map("uwMap", { zoomControl: true, attributionControl: true });
      window.LE_LAYERS(map, { base: "satellite" });
      layers = L.layerGroup().addTo(map);
    }
    setTimeout(() => map.invalidateSize(), 50);
    layers.clearLayers();
    map.setView([p.lat, p.lon], 14);
    L.circleMarker([p.lat, p.lon], { radius: 9, color: "#fff", weight: 3, fillColor: "#ff5a3c", fillOpacity: 1 }).addTo(layers).bindPopup(esc(p.label));
    L.circle([p.lat, p.lon], { radius: 400, color: "#ffffff", weight: 1, dashArray: "4 4", fill: false }).addTo(layers);
  }
  function drawOverlays(p, region) {
    if (!map || !layers) return;
    (p._wells || []).forEach((w) => L.circleMarker([w.lat, w.lon], { radius: 4, color: "#0b2340", weight: 1, fillColor: "#59b8ff", fillOpacity: 0.9 })
      .addTo(layers).bindPopup(`Well ·${w.depth != null ? ` depth ${fmt(w.depth)} ft ·` : ""} water ${fmt(w.swl)} ft${w.year ? " · " + w.year : ""}`));
    (p._mines || []).slice(0, 300).forEach((m) => L.circleMarker([m.lat, m.lon], { radius: 4, color: "#3a2a00", weight: 1, fillColor: "#ffc93c", fillOpacity: 0.9 })
      .addTo(layers).bindPopup(`${esc(m.name || "Mine")} · ${esc(m.comm || "")}${m.stat ? " · " + (MRDS_STAT[m.stat] || "") : ""}`));
    if (region && p._wells?.length) L.circle([p.lat, p.lon], { radius: region.wellRadiusMi * 1609.34, color: "#59b8ff", weight: 1, fill: false }).addTo(layers);
  }
  const VERDICT_WORDS = { go: "Clean screen. Proceed to permits, title, and a field walk.", caution: "Proceed with eyes open. Resolve the flagged checks before you write an offer.", kill: "Hard flag. Walk away, or price the defect in heavily." };

  async function run(raw) {
    const out = $("uwOut"), status = $("uwStatus");
    out.hidden = true; status.textContent = "Locating…"; status.className = "uw-status";
    document.dispatchEvent(new CustomEvent("le:reset"));
    let p;
    try { p = await locate(raw); } catch (e) { status.textContent = e.message || "Geocoding failed."; status.className = "uw-status is-err"; return; }
    const region = regionFor(p);
    status.textContent = "";
    out.hidden = false;
    $("uwPlace").innerHTML = `<h3>${esc(p.label)}</h3><div class="place-meta">${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}
      ${p.county ? " · " + esc(p.county) : ""}${p.state ? ", " + esc(p.state) : ""} · matched from ${esc(p.how)}${p.precision ? " (" + esc(p.precision) + ")" : ""}
      · plug-in: <b>${region ? esc(region.label) : "national only"}</b></div>`;
    $("uwVerdict").className = "verdict is-loading"; $("uwVerdict").innerHTML = "<div>Running checks…</div>";
    const list = checkList(p, region);
    $("uwChecks").innerHTML = list.map(([id, t, s]) => card(id, t, s)).join("");
    $("uwCard").innerHTML = list.map(([id, t]) => tile(id, t)).join("");
    drawMap(p);
    const results = await runChecks(list, (id, res) => { fill(id, res); fillTile(id, res); });
    drawOverlays(p, region);
    const s = scoreVerdict(results);
    $("uwVerdict").className = `verdict is-${s.v}`;
    $("uwVerdict").innerHTML = `<div class="v-badge">${BADGE[s.v]}</div><div><strong>${VERDICT_WORDS[s.v]}</strong>
      <div class="v-sub">${s.kills} kill · ${s.cautions} check · ${s.clear} clear${s.errors ? ` · ${s.errors} service error` : ""}</div></div>`;
    const links = [
      { label: "Google satellite view", url: `https://www.google.com/maps/@${p.lat},${p.lon},500m/data=!3m1!1e3` },
      { label: "FEMA flood map (official)", url: `https://msc.fema.gov/portal/search?AddressQuery=${encodeURIComponent(p.lat + "," + p.lon)}` },
      { label: "Noise score (HowLoud)", url: "https://howloud.com/" },
      ...(region ? region.links(p) : [])
    ];
    $("uwLinks").innerHTML = links.map((l) => `<a href="${l.url}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`).join("");
    const mk = results.market?.surface;
    $("uwSurface").innerHTML = !mk ? "" : mk.fhfa
      ? `<a href="#surfaces" data-metro="${mk.id}" class="jump-metro">Open the ${esc(mk.label)} land surface ↓</a>`
      : `<a href="#surfaces" data-map="${mk.id}" class="jump-map">Open the ${esc(mk.label)} heat map ↓</a>`;
    history.replaceState(null, "", `#q=${encodeURIComponent(raw)}`);
    window.LandEngine.last = { p, region, results, verdict: s, raw };
    document.dispatchEvent(new CustomEvent("le:screened", { detail: window.LandEngine.last }));
  }

  // ---------- batch: N places x M checks ----------
  const COLS = [
    ["flood", "Flood"], ["access", "Road"], ["land", "Land status"], ["drain", "Drainage"], ["wells", "Water depth"],
    ["traffic", "Traffic"], ["market", "Land $/ac"], ["mines", "Mines ≤10 km"], ["walk", "Walk /20"], ["elev", "Elevation"], ["plss", "Survey grid"]
  ];
  let batchRows = [], batchSort = { key: null, dir: 1 };

  function batchTable() {
    const rows = [...batchRows];
    if (batchSort.key) {
      const k = batchSort.key, val = (r) => k === "verdict" ? ({ kill: 0, caution: 1, go: 2 }[r.verdict?.v] ?? 3) : k === "place" ? (r.p?.label || r.raw) : (r.results?.[k]?.num ?? r.results?.[k]?.cell ?? "");
      rows.sort((a, b) => { const x = val(a), y = val(b); return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * batchSort.dir; });
    }
    const th = (k, t) => `<th data-sort="${k}" class="${batchSort.key === k ? "sorted" : ""}">${t}${batchSort.key === k ? (batchSort.dir > 0 ? " ▲" : " ▼") : ""}</th>`;
    const cell = (r, k) => {
      if (r.state !== "done") return `<td class="pending">${r.state === "error" ? "–" : "·"}</td>`;
      const x = r.results[k];
      if (!x) return `<td class="na">n/a</td>`;
      return `<td class="c-${x.status === "err" ? "err" : tone(k, x)}" title="${esc((x.headline || "").replace(/<[^>]+>/g, ""))}">${esc(x.cell ?? "")}</td>`;
    };
    $("bOut").innerHTML = `<div class="b-scroll"><table class="b-table"><thead><tr><th>#</th>${th("place", "Place")}${th("verdict", "Verdict")}${COLS.map(([k, t]) => th(k, t)).join("")}</tr></thead><tbody>
      ${rows.map((r) => `<tr data-raw="${esc(r.raw)}"><td class="idx">${r.i + 1}</td>
        <td class="place">${r.p ? `<b>${esc(r.p.label)}</b><span>${esc([r.p.county, r.p.state].filter(Boolean).join(", "))}</span>` : `<b>${esc(r.raw)}</b><span class="${r.state === "error" ? "err" : ""}">${r.state === "error" ? esc(r.error) : r.state === "running" ? "running…" : "queued"}</span>`}</td>
        <td>${r.verdict ? `<span class="vchip is-${r.verdict.v}">${BADGE[r.verdict.v]}</span>` : ""}</td>
        ${COLS.map(([k]) => cell(r, k)).join("")}</tr>`).join("")}
      </tbody></table></div>`;
    $("bOut").querySelectorAll("th[data-sort]").forEach((h) => h.addEventListener("click", () => {
      batchSort = { key: h.dataset.sort, dir: batchSort.key === h.dataset.sort ? -batchSort.dir : 1 }; batchTable();
    }));
    $("bOut").querySelectorAll("tbody tr").forEach((tr) => tr.addEventListener("click", () => {
      const r = batchRows.find((x) => x.raw === tr.dataset.raw); if (!r || r.state !== "done") return;
      showMode("single"); $("uwInput").value = r.raw; run(r.raw); $("underwriter").scrollIntoView({ behavior: "smooth" });
    }));
  }
  function batchSummary() {
    const done = batchRows.filter((r) => r.state === "done");
    const n = (v) => done.filter((r) => r.verdict.v === v).length;
    const vals = done.map((r) => r.results.market?.num).filter((x) => x != null);
    const flood = done.filter((r) => r.results.flood?.status === "kill").length;
    const wet = done.filter((r) => r.results.wells?.num != null && r.results.wells.num <= 300).length;
    const withWells = done.filter((r) => r.results.wells).length;
    $("bSummary").innerHTML = done.length ? `<div class="kpis">
      <div class="kpi"><span>Screened</span><b>${done.length} / ${batchRows.length}</b></div>
      <div class="kpi good"><span>GO</span><b>${n("go")}</b></div>
      <div class="kpi"><span>CHECK</span><b>${n("caution")}</b></div>
      <div class="kpi bad"><span>KILL</span><b>${n("kill")}</b></div>
      <div class="kpi"><span>Median land value</span><b>${vals.length ? money(median(vals)) + "/ac" : "–"}</b></div>
      <div class="kpi"><span>In 100-yr floodplain</span><b>${flood}</b></div>
      ${withWells ? `<div class="kpi"><span>Water ≤300 ft</span><b>${wet} / ${withWells}</b></div>` : ""}
    </div>` : "";
  }
  async function runBatch(text) {
    const lines = [...new Set(text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean))].slice(0, 50);
    if (!lines.length) return;
    batchRows = lines.map((raw, i) => ({ i, raw, state: "pending" }));
    batchSort = { key: null, dir: 1 };
    $("bCsv").disabled = true; $("bRun").disabled = true;
    $("bStatus").textContent = `Screening ${lines.length} place${lines.length > 1 ? "s" : ""}…`;
    batchTable(); batchSummary();
    let next = 0;
    const worker = async () => {
      while (next < batchRows.length) {
        const r = batchRows[next++];
        r.state = "running"; batchTable();
        try {
          r.p = await locate(r.raw);
          const region = regionFor(r.p);
          r.results = await runChecks(checkList(r.p, region));
          r.verdict = scoreVerdict(r.results);
          r.state = "done";
        } catch (e) { r.state = "error"; r.error = e.message || "failed"; }
        batchTable(); batchSummary();
        $("bStatus").textContent = `${batchRows.filter((x) => x.state === "done" || x.state === "error").length} of ${batchRows.length} done`;
      }
    };
    await Promise.all([worker(), worker()]);
    $("bStatus").textContent = `Done. ${batchRows.filter((x) => x.state === "done").length} screened${batchRows.some((x) => x.state === "error") ? `, ${batchRows.filter((x) => x.state === "error").length} not found` : ""}. Click a row for the full report; click a header to sort.`;
    $("bCsv").disabled = false; $("bRun").disabled = false;
  }
  function batchCSV() {
    const q = (s) => `"${String(s ?? "").replace(/<[^>]+>/g, "").replace(/"/g, '""')}"`;
    const head = ["input", "matched_address", "county", "state", "lat", "lon", "verdict", ...COLS.flatMap(([k, t]) => [`${t} status`, t])];
    const rows = batchRows.map((r) => [r.raw, r.p?.label, r.p?.county, r.p?.state, r.p?.lat?.toFixed(6), r.p?.lon?.toFixed(6), r.verdict ? BADGE[r.verdict.v] : r.state,
      ...COLS.flatMap(([k]) => [r.results?.[k]?.status ?? "", r.results?.[k]?.headline ?? ""])]);
    const csv = [head, ...rows].map((r) => r.map(q).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `land-engine-batch-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  function showMode(mode) {
    document.querySelectorAll("[data-uwmode]").forEach((t) => t.classList.toggle("is-active", t.dataset.uwmode === mode));
    $("modeSingle").hidden = mode !== "single"; $("modeBatch").hidden = mode !== "batch";
    if (mode === "single" && map) setTimeout(() => map.invalidateSize(), 50);
  }

  window.LandEngine = { run, runBatch, last: null };
  document.addEventListener("DOMContentLoaded", () => {
    $("uwForm").addEventListener("submit", (e) => { e.preventDefault(); const v = $("uwInput").value; if (v.trim()) run(v); });
    document.querySelectorAll("[data-example]").forEach((b) => b.addEventListener("click", () => { $("uwInput").value = b.dataset.example; run(b.dataset.example); }));
    document.querySelectorAll("[data-uwmode]").forEach((t) => t.addEventListener("click", () => showMode(t.dataset.uwmode)));
    $("bRun").addEventListener("click", () => runBatch($("bInput").value));
    $("bCsv").addEventListener("click", batchCSV);
    $("bExample").addEventListener("click", () => { $("bInput").value = $("bExample").dataset.list.split("|").join("\n"); runBatch($("bInput").value); });
    const m = location.hash.match(/^#q=(.+)$/);
    if (m) { const v = decodeURIComponent(m[1]); $("uwInput").value = v; run(v); }
  });
})();
