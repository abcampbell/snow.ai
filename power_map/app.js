/* global L, echarts */

"use strict";

const MAX_SERIES = 8;
const COLORS = ["#1859c9", "#ef7d2d", "#10958f", "#7b55c7", "#d34d78", "#2f8f46", "#c79820", "#52677f"];
const DAY_MS = 86_400_000;
const Y_AXIS_STORAGE_KEY = "power-dashboard-y-axis-bounds";
// Static mode serves an encrypted snapshot built by build_static.py instead of the local Rose proxy.
const STATIC_MODE = document.documentElement.dataset.mode === "static";
let staticKey = null;

const state = {
  bootstrap: null,
  descriptors: [],
  locationGroups: [],
  selected: [],
  loaded: new Map(),
  colors: new Map(),
  map: null,
  markers: new Map(),
  selectionLayer: null,
  chart: null,
  windowStart: null,
  windowEnd: null,
  activePreset: "90",
  yAxisMin: null,
  yAxisMax: null,
  nearestCode: null,
  toastTimer: null,
};

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  restoreYAxisSettings();
  bindControls();
  if (STATIC_MODE) {
    elements.refreshButton.hidden = true;
    unlockSnapshot()
      .then(() => initialize())
      .catch((error) => showFatal(error));
  } else {
    initialize().catch((error) => showFatal(error));
  }
});

function cacheElements() {
  [
    "syncState",
    "syncLabel",
    "syncDetail",
    "refreshButton",
    "startDate",
    "endDate",
    "yAxisMin",
    "yAxisMax",
    "resetYAxis",
    "seriesLegend",
    "priceChart",
    "emptyChart",
    "observationSummary",
    "marketMap",
    "nearestBanner",
    "nearestLabel",
    "undoNearest",
    "selectionCount",
    "marketFilter",
    "deliveryFilter",
    "periodFilter",
    "seriesPicker",
    "selectedList",
    "clearButton",
    "seriesAvailable",
    "locationAvailable",
    "sourceNotebook",
    "sourceMap",
    "toast",
  ].forEach((id) => {
    elements[id] = document.getElementById(id);
  });
  elements.presetButtons = [...document.querySelectorAll("[data-days]")];
}

function bindControls() {
  elements.presetButtons.forEach((button) => {
    button.addEventListener("click", () => setPreset(button.dataset.days));
  });
  elements.startDate.addEventListener("change", applyDateInputs);
  elements.endDate.addEventListener("change", applyDateInputs);
  elements.yAxisMin.addEventListener("change", applyYAxisBounds);
  elements.yAxisMax.addEventListener("change", applyYAxisBounds);
  [elements.yAxisMin, elements.yAxisMax].forEach((input) => {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") input.blur();
    });
  });
  elements.resetYAxis.addEventListener("click", resetYAxisBounds);
  elements.refreshButton.addEventListener("click", refreshFromRose);
  elements.clearButton.addEventListener("click", clearAll);
  elements.undoNearest.addEventListener("click", () => {
    if (state.nearestCode) removeSeries(state.nearestCode);
    elements.nearestBanner.hidden = true;
  });
  [elements.marketFilter, elements.deliveryFilter, elements.periodFilter].forEach((select) => {
    select.addEventListener("change", renderMapMarkers);
  });
  elements.seriesPicker.addEventListener("change", async () => {
    const code = elements.seriesPicker.value;
    elements.seriesPicker.value = "";
    if (code) await addSeries(code);
  });
  window.addEventListener("resize", debounce(() => state.chart?.resize(), 120));
}

async function initialize({ refresh = false } = {}) {
  setSyncStatus("loading", "Connecting to Rose", "Loading notebook and market map…");
  const suffix = refresh ? "?refresh=1" : "";
  const bootstrap = await api(`/api/bootstrap${suffix}`);
  state.bootstrap = bootstrap;
  state.descriptors = bootstrap.series;
  state.locationGroups = buildLocationGroups(bootstrap.series);
  elements.seriesAvailable.textContent = String(bootstrap.series.length);
  elements.locationAvailable.textContent = String(bootstrap.map_location_count);
  elements.sourceNotebook.textContent = bootstrap.notebook_code;
  elements.sourceMap.textContent = `${bootstrap.markets_map_code} · ${bootstrap.map_row_count.toLocaleString()} series · ${bootstrap.map_location_count} locations`;

  populateFilters();
  populateSeriesPicker();
  initializeChart();
  initializeMap();
  renderMapMarkers();
  setSyncStatus(
    "ready",
    STATIC_MODE ? "Rose snapshot" : "Rose synced",
    STATIC_MODE
      ? `${formatSnapshotDate(bootstrap.synced_at)} · ${bootstrap.series.length} price series`
      : `${bootstrap.rose_user} · ${bootstrap.series.length} price series`
  );

  if (!state.selected.length) {
    await Promise.allSettled(bootstrap.default_codes.slice(0, 3).map((code) => addSeries(code, { quiet: true })));
    if (state.selected.length) setPreset("90");
  }
}

async function refreshFromRose() {
  elements.refreshButton.disabled = true;
  try {
    state.loaded.clear();
    await initialize({ refresh: true });
    const codes = [...state.selected];
    state.selected = [];
    state.colors.clear();
    await Promise.allSettled(codes.map((code) => addSeries(code, { quiet: true })));
    setPreset(state.activePreset || "90");
    showToast("Rose notebook, map, and selected prices refreshed.");
  } catch (error) {
    setSyncStatus("error", "Rose refresh failed", error.message);
    showToast(error.message, true);
  } finally {
    elements.refreshButton.disabled = false;
  }
}

async function api(path) {
  if (STATIC_MODE) return staticApi(path);
  const response = await fetch(path, { headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

function unlockSnapshot() {
  const gate = document.getElementById("snapshotGate");
  const form = document.getElementById("gateForm");
  const input = document.getElementById("gatePassword");
  const message = document.getElementById("gateMessage");
  gate.hidden = false;
  setSyncStatus("loading", "Locked", "Enter the password to load the snapshot…");
  input.focus();
  return new Promise((resolve) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      message.textContent = "Unlocking…";
      try {
        const meta = await (await fetch("data/meta.json", { cache: "no-cache" })).json();
        const base = await crypto.subtle.importKey(
          "raw", new TextEncoder().encode(input.value), "PBKDF2", false, ["deriveKey"]
        );
        staticKey = await crypto.subtle.deriveKey(
          { name: "PBKDF2", salt: base64Bytes(meta.salt), iterations: meta.iterations, hash: "SHA-256" },
          base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]
        );
        await staticApi("/api/bootstrap");
        gate.hidden = true;
        resolve();
      } catch (error) {
        staticKey = null;
        message.textContent = "Wrong password.";
        input.select();
      }
    });
  });
}

const staticCache = new Map();

async function staticApi(path) {
  if (staticCache.has(path)) return staticCache.get(path);
  const url = new URL(path, window.location.origin);
  let file = "data/bootstrap.bin";
  if (url.pathname === "/api/series") file = `data/s/${await seriesFile(url.searchParams.get("code"))}`;
  const response = await fetch(file, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Series not in snapshot (${response.status})`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12) }, staticKey, bytes.slice(12));
  const text = await new Response(new Blob([plain]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
  const payload = JSON.parse(text);
  staticCache.set(path, payload);
  return payload;
}

async function seriesFile(code) {
  // Must match series_file() in build_static.py.
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 20)}.bin`;
}

function base64Bytes(value) {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

function formatSnapshotDate(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "snapshot" : `as of ${date.toISOString().slice(0, 10)}`;
}

function populateFilters() {
  fillSelect(elements.marketFilter, uniqueValues("market"), "All markets");
  fillSelect(elements.deliveryFilter, uniqueValues("delivery"), "All delivery");
  fillSelect(elements.periodFilter, uniqueValues("period"), "All periods");
}

function uniqueValues(key) {
  return [...new Set(state.descriptors.map((item) => item[key]).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
}

function fillSelect(select, values, placeholder) {
  const previous = select.value;
  select.replaceChildren(new Option(placeholder, ""), ...values.map((value) => new Option(value, value)));
  if (values.includes(previous)) select.value = previous;
}

function populateSeriesPicker() {
  const sorted = [...state.descriptors].sort((a, b) => a.label.localeCompare(b.label));
  const placeholder = new Option("Choose a series…", "");
  elements.seriesPicker.replaceChildren(placeholder);
  const byMarket = new Map();
  sorted.forEach((item) => {
    if (!byMarket.has(item.market)) byMarket.set(item.market, []);
    byMarket.get(item.market).push(item);
  });
  [...byMarket].sort(([a], [b]) => a.localeCompare(b)).forEach(([market, items]) => {
    const group = document.createElement("optgroup");
    group.label = `${market} · ${items.length} series`;
    items.forEach((item) => group.append(new Option(item.label, item.code)));
    elements.seriesPicker.append(group);
  });
}

function buildLocationGroups(descriptors) {
  const groups = new Map();
  descriptors.forEach((item) => {
    const key = `${item.market}|${item.location}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        market: item.market,
        location: item.location,
        lat: item.lat,
        lon: item.lon,
        displayLat: item.lat,
        displayLon: item.lon,
        series: [],
      });
    }
    groups.get(key).series.push(item);
  });

  const coordinateCounts = new Map();
  [...groups.values()].forEach((group) => {
    const coordinateKey = `${group.lat.toFixed(2)}|${group.lon.toFixed(2)}`;
    const index = coordinateCounts.get(coordinateKey) || 0;
    coordinateCounts.set(coordinateKey, index + 1);
    if (index) {
      const angle = index * 2.15;
      const radius = 0.13 + Math.floor(index / 6) * 0.04;
      group.displayLat += Math.sin(angle) * radius;
      group.displayLon += Math.cos(angle) * radius;
    }
  });
  return [...groups.values()];
}

function initializeChart() {
  if (state.chart) return;
  if (typeof echarts === "undefined") throw new Error("The chart library did not load.");
  state.chart = echarts.init(elements.priceChart, null, { renderer: "canvas" });
  state.chart.on("datazoom", (event) => {
    const extent = globalExtent();
    if (!extent) return;
    const zoom = event.batch?.[0] || event;
    const startPercent = Number.isFinite(zoom.start) ? zoom.start : 0;
    const endPercent = Number.isFinite(zoom.end) ? zoom.end : 100;
    const span = extent.max - extent.min;
    state.windowStart = new Date(extent.min + (span * startPercent) / 100);
    state.windowEnd = new Date(extent.min + (span * endPercent) / 100);
    state.activePreset = null;
    syncDateControls();
    updatePresetButtons();
  });
  renderChart();
}

function initializeMap() {
  if (state.map) return;
  if (typeof L === "undefined") throw new Error("The map library did not load.");
  state.map = L.map(elements.marketMap, {
    zoomControl: true,
    attributionControl: true,
    minZoom: 3,
    maxZoom: 9,
    maxBoundsViscosity: 0.75,
  });
  // CARTO basemaps began requiring an API key; Esri's light gray canvas is keyless.
  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
    attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ",
    maxZoom: 16,
  }).addTo(state.map);
  const bounds = L.latLngBounds([24.2, -125.1], [49.8, -66.4]);
  state.map.fitBounds(bounds, { padding: [12, 12] });
  state.map.setMaxBounds(L.latLngBounds([18, -133], [55, -58]));
  state.selectionLayer = L.layerGroup().addTo(state.map);
  state.map.on("click", (event) => selectNearest(event.latlng));
  setTimeout(() => state.map.invalidateSize(), 0);
}

function filteredDescriptors() {
  const market = elements.marketFilter.value;
  const delivery = elements.deliveryFilter.value;
  const period = elements.periodFilter.value;
  return state.descriptors.filter(
    (item) =>
      (!market || item.market === market) &&
      (!delivery || item.delivery === delivery) &&
      (!period || item.period === period)
  );
}

function renderMapMarkers() {
  if (!state.map) return;
  for (const marker of state.markers.values()) marker.removeFrom(state.map);
  state.markers.clear();
  const visible = new Set(filteredDescriptors().map((item) => item.code));

  state.locationGroups.forEach((group) => {
    const matching = group.series.filter((item) => visible.has(item.code));
    const selectedCodes = group.series
      .map((item) => item.code)
      .filter((code) => state.selected.includes(code));
    const selected = selectedCodes.length > 0;
    const color = selected ? state.colors.get(selectedCodes[0]) : "#738196";
    const baseRadius = Math.min(7, 3.7 + Math.log2(group.series.length + 1) * 0.75);
    const marker = L.circleMarker([group.displayLat, group.displayLon], {
      radius: selected ? Math.max(7, baseRadius) : matching.length ? baseRadius : 3,
      weight: selected ? 3 : 1.3,
      color: selected ? "#ffffff" : "#ffffff",
      fillColor: color,
      fillOpacity: matching.length || selected ? 0.96 : 0.16,
      opacity: matching.length || selected ? 1 : 0.24,
      pane: selected ? "markerPane" : "overlayPane",
    });
    const filteredText = matching.length === group.series.length ? "" : ` · ${matching.length} match filters`;
    marker.bindTooltip(
      `<strong>${escapeHtml(group.market)} · ${escapeHtml(group.location)}</strong><br>${group.series.length} series${filteredText}`,
      { className: "market-tooltip", direction: "top", offset: [0, -6] }
    );
    marker.on("click", (event) => {
      L.DomEvent.stopPropagation(event.originalEvent);
      addFromLocationGroup(group);
    });
    marker.addTo(state.map);
    state.markers.set(group.key, marker);
  });
}

async function addFromLocationGroup(group) {
  const matching = group.series.filter((item) => {
    const market = elements.marketFilter.value;
    const delivery = elements.deliveryFilter.value;
    const period = elements.periodFilter.value;
    return (
      (!market || item.market === market) &&
      (!delivery || item.delivery === delivery) &&
      (!period || item.period === period)
    );
  });
  if (!matching.length) {
    showToast(`${group.market} · ${group.location} has no series matching the filters.`, true);
    return;
  }
  const descriptor = matching.find((item) => !state.selected.includes(item.code)) || matching[0];
  if (state.selected.includes(descriptor.code)) {
    showToast(`${descriptor.label} is already on the chart.`);
    return;
  }
  flashNearest({ lat: group.displayLat, lng: group.displayLon }, descriptor);
  await addSeries(descriptor.code);
}

async function selectNearest(latlng) {
  let candidates = filteredDescriptors();
  if (!candidates.length) {
    showToast("No notebook series match the current filters.", true);
    return;
  }
  const ranked = candidates
    .map((item) => ({ item, distance: haversineKm(latlng.lat, latlng.lng, item.lat, item.lon) }))
    .sort((a, b) => a.distance - b.distance);
  const nearest = ranked.find(({ item }) => !state.selected.includes(item.code)) || ranked[0];
  if (state.selected.includes(nearest.item.code)) {
    showToast(`${nearest.item.label} is already on the chart.`);
    flashNearest(latlng, nearest.item);
    return;
  }
  if (state.selected.length >= MAX_SERIES) {
    showToast(`The chart supports up to ${MAX_SERIES} series. Remove one before adding another.`, true);
    return;
  }
  flashNearest(latlng, nearest.item);
  const added = await addSeries(nearest.item.code, { quiet: true });
  if (added) {
    state.nearestCode = nearest.item.code;
    elements.nearestLabel.textContent = nearest.item.label;
    elements.nearestBanner.hidden = false;
    window.clearTimeout(elements.nearestBanner.hideTimer);
    elements.nearestBanner.hideTimer = window.setTimeout(() => {
      elements.nearestBanner.hidden = true;
    }, 5200);
  }
}

function flashNearest(clicked, item) {
  state.selectionLayer.clearLayers();
  const color = state.colors.get(item.code) || "#1859c9";
  L.polyline(
    [clicked, [item.lat, item.lon]],
    { color, weight: 1.5, opacity: 0.8, dashArray: "5 5" }
  ).addTo(state.selectionLayer);
  L.circleMarker(clicked, {
    radius: 8,
    weight: 2,
    color,
    fillColor: "#ffffff",
    fillOpacity: 0.55,
  }).addTo(state.selectionLayer);
  L.circleMarker([item.lat, item.lon], {
    radius: 11,
    weight: 2,
    color,
    fillOpacity: 0,
  }).addTo(state.selectionLayer);
  window.setTimeout(() => state.selectionLayer?.clearLayers(), 4000);
}

async function addSeries(code, { quiet = false } = {}) {
  if (state.selected.includes(code)) {
    if (!quiet) showToast("That series is already on the chart.");
    return false;
  }
  if (state.selected.length >= MAX_SERIES) {
    showToast(`The chart supports up to ${MAX_SERIES} series.`, true);
    return false;
  }
  const descriptor = descriptorFor(code);
  if (!descriptor) {
    showToast("The selected series is no longer present in the notebook.", true);
    return false;
  }

  state.selected.push(code);
  assignColor(code);
  renderSelectionUi();
  renderMapMarkers();
  try {
    setSyncStatus("loading", "Pulling Rose price", descriptor.location);
    const payload = state.loaded.get(code) || (await api(`/api/series?code=${encodeURIComponent(code)}`));
    state.loaded.set(code, payload);
    ensureWindow();
    renderSelectionUi();
    renderChart();
    renderMapMarkers();
    setSyncStatus(
      "ready",
      STATIC_MODE ? "Rose snapshot" : "Rose synced",
      STATIC_MODE
        ? `${formatSnapshotDate(state.bootstrap.synced_at)} · actual USD/MWh`
        : `${state.bootstrap.rose_user} · actual USD/MWh`
    );
    if (!quiet) showToast(`Added ${descriptor.label}`);
    return true;
  } catch (error) {
    state.selected = state.selected.filter((item) => item !== code);
    state.colors.delete(code);
    renderSelectionUi();
    renderChart();
    renderMapMarkers();
    setSyncStatus("error", "Price pull failed", descriptor.location);
    showToast(error.message, true);
    return false;
  }
}

function removeSeries(code) {
  state.selected = state.selected.filter((item) => item !== code);
  state.colors.delete(code);
  if (state.nearestCode === code) state.nearestCode = null;
  renderSelectionUi();
  renderMapMarkers();
  ensureWindow();
  renderChart();
}

function clearAll() {
  state.selected = [];
  state.colors.clear();
  state.nearestCode = null;
  elements.nearestBanner.hidden = true;
  renderSelectionUi();
  renderMapMarkers();
  renderChart();
}

function assignColor(code) {
  if (state.colors.has(code)) return state.colors.get(code);
  const used = new Set(state.colors.values());
  const color = COLORS.find((candidate) => !used.has(candidate)) || COLORS[state.colors.size % COLORS.length];
  state.colors.set(code, color);
  return color;
}

function renderSelectionUi() {
  elements.selectionCount.textContent = `${state.selected.length} of ${MAX_SERIES}`;
  elements.clearButton.disabled = state.selected.length === 0;
  elements.seriesLegend.replaceChildren();
  elements.selectedList.replaceChildren();

  if (!state.selected.length) {
    const empty = document.createElement("div");
    empty.className = "empty-selection";
    empty.innerHTML = "<strong>No markets selected</strong><span>Click the map or choose a catalog series.</span>";
    elements.selectedList.append(empty);
  }

  state.selected.forEach((code) => {
    const descriptor = descriptorFor(code);
    const payload = state.loaded.get(code);
    const color = state.colors.get(code);

    const chip = document.createElement("div");
    chip.className = "series-chip";
    chip.style.setProperty("--series-color", color);
    chip.innerHTML = `<i></i><span>${escapeHtml(shortLabel(descriptor))}</span>`;
    const chipRemove = document.createElement("button");
    chipRemove.type = "button";
    chipRemove.title = "Remove series";
    chipRemove.setAttribute("aria-label", `Remove ${descriptor.label}`);
    chipRemove.textContent = "×";
    chipRemove.addEventListener("click", () => removeSeries(code));
    chip.append(chipRemove);
    elements.seriesLegend.append(chip);

    const card = document.createElement("div");
    card.className = `selected-card${payload ? "" : " is-loading"}`;
    card.style.setProperty("--series-color", color);
    const price = payload ? `$${formatPrice(payload.latest_value)} / MWh` : "Pulling from Rose…";
    card.innerHTML = `<i></i><div><strong>${escapeHtml(descriptor.location)}</strong><span>${escapeHtml(
      `${descriptor.market} · ${descriptor.delivery} · ${descriptor.period}`
    )} · <b class="latest-price">${escapeHtml(price)}</b></span></div>`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.title = "Remove series";
    remove.setAttribute("aria-label", `Remove ${descriptor.label}`);
    remove.textContent = "×";
    remove.addEventListener("click", () => removeSeries(code));
    card.append(remove);
    elements.selectedList.append(card);
  });
}

function renderChart() {
  if (!state.chart) return;
  const loadedCodes = state.selected.filter((code) => state.loaded.has(code));
  elements.emptyChart.hidden = loadedCodes.length > 0;
  const extent = globalExtent();
  if (!extent || !loadedCodes.length) {
    state.chart.clear();
    elements.observationSummary.textContent = "No series selected";
    return;
  }
  ensureWindow();

  const series = loadedCodes.map((code) => {
    const descriptor = descriptorFor(code);
    const payload = state.loaded.get(code);
    return {
      name: shortLabel(descriptor),
      type: "line",
      data: payload.points.map(([date, value]) => [Date.parse(`${date}T00:00:00Z`), value]),
      showSymbol: false,
      symbol: "circle",
      symbolSize: 5,
      smooth: false,
      connectNulls: false,
      sampling: "lttb",
      lineStyle: { width: 2.1, color: state.colors.get(code) },
      itemStyle: { color: state.colors.get(code) },
      emphasis: { focus: "series", lineStyle: { width: 3 } },
      animation: false,
    };
  });

  const startValue = state.windowStart.getTime();
  const endValue = state.windowEnd.getTime();
  state.chart.setOption(
    {
      animation: false,
      color: loadedCodes.map((code) => state.colors.get(code)),
      grid: { left: 62, right: 24, top: 20, bottom: 78, containLabel: false },
      tooltip: {
        trigger: "axis",
        confine: true,
        backgroundColor: "rgba(255,255,255,0.98)",
        borderColor: "#dfe4ea",
        borderWidth: 1,
        padding: [10, 12],
        textStyle: { color: "#17202a", fontSize: 11 },
        axisPointer: { type: "cross", lineStyle: { color: "#94a0ae", width: 1 } },
        formatter(params) {
          if (!params?.length) return "";
          const date = new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            timeZone: "UTC",
          }).format(new Date(params[0].value[0]));
          const rows = params
            .map(
              (item) =>
                `<div style="display:flex;justify-content:space-between;gap:24px;margin-top:6px">` +
                `<span>${item.marker}${escapeHtml(item.seriesName)}</span>` +
                `<strong>$${formatPrice(item.value[1])}</strong></div>`
            )
            .join("");
          return `<strong>${date}</strong>${rows}<div style="color:#7b8796;margin-top:7px">USD / MWh</div>`;
        },
      },
      xAxis: {
        type: "time",
        min: extent.min,
        max: extent.max,
        axisLine: { lineStyle: { color: "#cfd6df" } },
        axisTick: { show: false },
        axisLabel: { color: "#697688", fontSize: 10, hideOverlap: true },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        name: "$ / MWh",
        nameTextStyle: { color: "#455267", fontSize: 10, fontWeight: 650, padding: [0, 0, 7, 0] },
        nameLocation: "end",
        scale: true,
        min: state.yAxisMin ?? undefined,
        max: state.yAxisMax ?? undefined,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "#697688",
          fontSize: 10,
          formatter: (value) => `$${abbreviateNumber(value)}`,
        },
        splitLine: { lineStyle: { color: "#e8ecf1", type: "dashed" } },
      },
      dataZoom: [
        {
          type: "inside",
          startValue,
          endValue,
          filterMode: "filter",
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
        },
        {
          type: "slider",
          startValue,
          endValue,
          filterMode: "filter",
          bottom: 15,
          height: 36,
          borderColor: "#dfe4ea",
          backgroundColor: "#f7f9fb",
          fillerColor: "rgba(24, 89, 201, 0.10)",
          dataBackground: {
            lineStyle: { color: "#a8bce1", opacity: 0.8 },
            areaStyle: { color: "#dbe6f8", opacity: 0.45 },
          },
          selectedDataBackground: {
            lineStyle: { color: "#1859c9" },
            areaStyle: { color: "#a8c3f1", opacity: 0.28 },
          },
          handleStyle: { color: "#ffffff", borderColor: "#7995c4", borderWidth: 1.5 },
          moveHandleStyle: { color: "#7995c4", opacity: 0.35 },
          textStyle: { color: "#7b8796", fontSize: 9 },
        },
      ],
      series,
    },
    true
  );

  const visibleObservations = loadedCodes.reduce((sum, code) => {
    const points = state.loaded.get(code).points;
    return (
      sum +
      points.filter(([date]) => {
        const value = Date.parse(`${date}T00:00:00Z`);
        return value >= startValue && value <= endValue;
      }).length
    );
  }, 0);
  elements.observationSummary.textContent = `${visibleObservations.toLocaleString()} observations · ${loadedCodes.length} series`;
  syncDateControls();
}

function restoreYAxisSettings() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(Y_AXIS_STORAGE_KEY) || "null");
    if (
      saved &&
      (saved.min === null || Number.isFinite(saved.min)) &&
      (saved.max === null || Number.isFinite(saved.max)) &&
      (saved.min === null || saved.max === null || saved.min < saved.max)
    ) {
      state.yAxisMin = saved.min;
      state.yAxisMax = saved.max;
    }
  } catch {
    // Ignore malformed local preferences and retain automatic scaling.
  }
  syncYAxisControls();
}

function applyYAxisBounds() {
  const min = axisInputValue(elements.yAxisMin);
  const max = axisInputValue(elements.yAxisMax);
  if (min.invalid || max.invalid) {
    showToast("Y-axis bounds must be valid numbers or blank for Auto.", true);
    syncYAxisControls();
    return;
  }
  if (min.value !== null && max.value !== null && min.value >= max.value) {
    showToast("The Y-axis minimum must be below the maximum.", true);
    syncYAxisControls();
    return;
  }
  state.yAxisMin = min.value;
  state.yAxisMax = max.value;
  persistYAxisSettings();
  renderChart();
  const minLabel = state.yAxisMin === null ? "Auto" : `$${state.yAxisMin}`;
  const maxLabel = state.yAxisMax === null ? "Auto" : `$${state.yAxisMax}`;
  showToast(`Y-axis range: ${minLabel} to ${maxLabel}`);
}

function resetYAxisBounds() {
  state.yAxisMin = null;
  state.yAxisMax = null;
  syncYAxisControls();
  persistYAxisSettings();
  renderChart();
  showToast("Y-axis returned to automatic scaling.");
}

function axisInputValue(input) {
  const text = input.value.trim();
  if (!text) return { value: null, invalid: false };
  const value = Number(text);
  return { value, invalid: !Number.isFinite(value) };
}

function syncYAxisControls() {
  elements.yAxisMin.value = state.yAxisMin === null ? "" : String(state.yAxisMin);
  elements.yAxisMax.value = state.yAxisMax === null ? "" : String(state.yAxisMax);
}

function persistYAxisSettings() {
  try {
    window.localStorage.setItem(
      Y_AXIS_STORAGE_KEY,
      JSON.stringify({ min: state.yAxisMin, max: state.yAxisMax })
    );
  } catch {
    // The controls still work if local storage is unavailable.
  }
}

function globalExtent() {
  let min = Infinity;
  let max = -Infinity;
  state.selected.forEach((code) => {
    const payload = state.loaded.get(code);
    if (!payload) return;
    min = Math.min(min, Date.parse(`${payload.first_date}T00:00:00Z`));
    max = Math.max(max, Date.parse(`${payload.last_date}T00:00:00Z`));
  });
  return Number.isFinite(min) && Number.isFinite(max) ? { min, max } : null;
}

function ensureWindow() {
  const extent = globalExtent();
  if (!extent) {
    state.windowStart = null;
    state.windowEnd = null;
    return;
  }
  if (!state.windowStart || !state.windowEnd) {
    state.windowEnd = new Date(extent.max);
    state.windowStart = new Date(Math.max(extent.min, extent.max - 90 * DAY_MS));
    state.activePreset = "90";
  } else {
    state.windowStart = new Date(Math.max(extent.min, state.windowStart.getTime()));
    state.windowEnd = new Date(Math.min(extent.max, state.windowEnd.getTime()));
    if (state.windowStart >= state.windowEnd) {
      state.windowEnd = new Date(extent.max);
      state.windowStart = new Date(Math.max(extent.min, extent.max - 90 * DAY_MS));
    }
  }
  syncDateControls();
}

function setPreset(value) {
  const extent = globalExtent();
  if (!extent) return;
  state.activePreset = value;
  state.windowEnd = new Date(extent.max);
  state.windowStart =
    value === "all"
      ? new Date(extent.min)
      : new Date(Math.max(extent.min, extent.max - Number(value) * DAY_MS));
  updatePresetButtons();
  syncDateControls();
  renderChart();
}

function applyDateInputs() {
  if (!elements.startDate.value || !elements.endDate.value) return;
  const start = new Date(`${elements.startDate.value}T00:00:00Z`);
  const end = new Date(`${elements.endDate.value}T00:00:00Z`);
  if (start >= end) {
    showToast("The start date must be before the end date.", true);
    syncDateControls();
    return;
  }
  const extent = globalExtent();
  if (!extent) return;
  state.windowStart = new Date(Math.max(extent.min, start.getTime()));
  state.windowEnd = new Date(Math.min(extent.max, end.getTime()));
  state.activePreset = null;
  updatePresetButtons();
  renderChart();
}

function syncDateControls() {
  const extent = globalExtent();
  if (!extent || !state.windowStart || !state.windowEnd) {
    elements.startDate.value = "";
    elements.endDate.value = "";
    return;
  }
  const min = isoDate(extent.min);
  const max = isoDate(extent.max);
  elements.startDate.min = min;
  elements.startDate.max = max;
  elements.endDate.min = min;
  elements.endDate.max = max;
  elements.startDate.value = isoDate(state.windowStart);
  elements.endDate.value = isoDate(state.windowEnd);
}

function updatePresetButtons() {
  elements.presetButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.days === state.activePreset);
  });
}

function descriptorFor(code) {
  return state.descriptors.find((item) => item.code === code);
}

function shortLabel(descriptor) {
  return `${descriptor.market} · ${descriptor.location} · ${descriptor.delivery} ${descriptor.period}`;
}

function setSyncStatus(kind, label, detail) {
  const dot = elements.syncState.querySelector(".sync-dot");
  dot.className = `sync-dot${kind === "loading" ? " is-loading" : kind === "error" ? " is-error" : ""}`;
  elements.syncLabel.textContent = label;
  elements.syncDetail.textContent = detail;
}

function showFatal(error) {
  setSyncStatus("error", "Dashboard could not start", error.message);
  showToast(error.message, true, 9000);
  console.error(error);
}

function showToast(message, isError = false, duration = 3600) {
  window.clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.className = `toast is-visible${isError ? " is-error" : ""}`;
  state.toastTimer = window.setTimeout(() => {
    elements.toast.className = "toast";
  }, duration);
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isoDate(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function formatPrice(value) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: Math.abs(value) < 100 ? 2 : 1,
    maximumFractionDigits: Math.abs(value) < 100 ? 2 : 1,
  }).format(value);
}

function abbreviateNumber(value) {
  const abs = Math.abs(value);
  if (abs >= 1000) return `${(value / 1000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return Number(value).toFixed(abs < 10 ? 1 : 0);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function debounce(fn, wait) {
  let timer;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
}
