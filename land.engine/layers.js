// Shared map layers for Land Engine maps: basemaps + toggleable geo overlays.
// Usage: LE_LAYERS(map, { base: "dark" }) -> returns the layers control.
window.LE_LAYERS = function (map, opts = {}) {
  const T = (url, o = {}) => L.tileLayer(url, { maxZoom: 19, ...o });
  const esri = "https://server.arcgisonline.com/ArcGIS/rest/services";
  const usgs = "https://basemap.nationalmap.gov/arcgis/rest/services";
  const bases = {
    "Dark": T(`${esri}/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 16, attribution: "© Esri" }),
    "Satellite": T(`${esri}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, { attribution: "Imagery © Esri" }),
    "Topographic (USGS)": T(`${usgs}/USGSTopo/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 16, attribution: "USGS The National Map" }),
    "Elevation (hillshade)": T(`${esri}/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 16, attribution: "Hillshade © Esri, USGS" })
  };
  const overlays = {
    "Roads": T(`${esri}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`, { attribution: "© Esri" }),
    "Waterways (USGS NHD)": T(`${usgs}/USGSHydroCached/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 16, attribution: "USGS NHD" }),
    "Place names": T(`${esri}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`, { attribution: "© Esri" }),
    "Land ownership (BLM)": T("https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_SMA_Cached_without_PriUnk/MapServer/tile/{z}/{y}/{x}", { maxZoom: 16, opacity: 0.5, attribution: "BLM SMA" })
  };
  if (window.L && L.esri) {
    overlays["Flood zones (FEMA, zoom in)"] = L.esri.dynamicMapLayer({
      url: "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer", layers: [28], opacity: 0.55, minZoom: 11, f: "image"
    });
    const volt = (v) => v >= 500 ? "#ff3d71" : v >= 345 ? "#ff9f43" : v >= 230 ? "#ffd166" : v >= 100 ? "#7bdff2" : "#9aa4b1";
    overlays["Transmission lines (≥8 zoom)"] = L.esri.featureLayer({
      url: "https://services1.arcgis.com/Hp6G80Pky0om7QvQ/arcgis/rest/services/Electric_Power_Transmission_Lines/FeatureServer/0",
      minZoom: 8, fields: ["OBJECTID_1", "VOLTAGE", "OWNER"], simplifyFactor: 0.5, precision: 5,
      style: (f) => ({ color: volt(f.properties.VOLTAGE), weight: f.properties.VOLTAGE >= 230 ? 2.4 : 1.4, opacity: 0.9 })
    }).bindPopup((l) => `Transmission ${l.feature.properties.VOLTAGE > 0 ? Math.round(l.feature.properties.VOLTAGE) + " kV" : "(voltage n/a)"}<br>${l.feature.properties.OWNER || ""}`);
    overlays["Gas pipelines (≥7 zoom)"] = L.esri.featureLayer({
      url: "https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/Natural_Gas_Interstate_and_Intrastate_Pipelines_1/FeatureServer/0",
      minZoom: 7, simplifyFactor: 0.5, precision: 5, style: () => ({ color: "#c084fc", weight: 1.6, opacity: 0.85, dashArray: "4 3" })
    });
    overlays["Power plants (≥6 zoom)"] = L.esri.featureLayer({
      url: "https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/Power_Plants_in_the_US/FeatureServer/0",
      minZoom: 6, fields: ["FID", "Plant_Name", "PrimSource", "Total_MW"],
      pointToLayer: (f, ll) => L.circleMarker(ll, { radius: Math.max(3, Math.min(14, Math.sqrt(f.properties.Total_MW || 1) / 2.2)), color: "#111", weight: 1,
        fillColor: { solar: "#ffd43b", wind: "#74c0fc", "natural gas": "#c084fc", coal: "#868e96", nuclear: "#ff6b6b", hydroelectric: "#4dabf7", geothermal: "#f76707" }[(f.properties.PrimSource || "").toLowerCase()] || "#e9ecef", fillOpacity: 0.9 })
    }).bindPopup((l) => `<b>${l.feature.properties.Plant_Name}</b><br>${l.feature.properties.PrimSource} · ${Math.round(l.feature.properties.Total_MW || 0)} MW`);
  }
  bases[opts.base === "satellite" ? "Satellite" : "Dark"].addTo(map);
  return L.control.layers(bases, overlays, { collapsed: opts.collapsed ?? true, position: opts.position || "topright" }).addTo(map);
};
