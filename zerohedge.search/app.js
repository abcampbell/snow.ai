const state = {
  docs: [],
  results: [],
  selectedIndex: 0,
  ready: false,
};

const el = {
  appShell: document.querySelector("#appShell"),
  status: document.querySelector("#statusText"),
  query: document.querySelector("#queryInput"),
  form: document.querySelector("#searchForm"),
  results: document.querySelector("#resultsList"),
  resultCount: document.querySelector("#resultCount"),
  articleCount: document.querySelector("#articleCount"),
  loadedCount: document.querySelector("#loadedCount"),
  oldestDate: document.querySelector("#oldestDate"),
  newestDate: document.querySelector("#newestDate"),
  previewTitle: document.querySelector("#previewTitle"),
  previewMeta: document.querySelector("#previewMeta"),
  previewQuality: document.querySelector("#previewQuality"),
  previewText: document.querySelector("#previewText"),
  sourceLink: document.querySelector("#sourceLink"),
  conceptSlider: document.querySelector("#conceptSlider"),
  conceptValue: document.querySelector("#conceptValue"),
  recencySlider: document.querySelector("#recencySlider"),
  recencyValue: document.querySelector("#recencyValue"),
  toggleSidebarButton: document.querySelector("#toggleSidebarButton"),
  toggleResultsButton: document.querySelector("#toggleResultsButton"),
  passwordPanel: document.querySelector("#passwordPanel"),
  passwordForm: document.querySelector("#passwordForm"),
  passwordInput: document.querySelector("#passwordInput"),
  passwordError: document.querySelector("#passwordError"),
};

function setStatus(message) {
  el.status.textContent = message;
}

function escapeText(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}

function tokenize(value) {
  return String(value || "")
    .toLowerCase()
    .match(/[a-z0-9_.$%-]+/g)
    ?.map((token) => token.replace(/^[-_.$%]+|[-_.$%]+$/g, ""))
    .filter(Boolean) || [];
}

function fmtDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function shortDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function dateSort(value) {
  const time = Date.parse(value || "");
  return Number.isFinite(time) ? time : 0;
}

function recencyScore(value) {
  const time = dateSort(value);
  if (!time) return 0;
  const ageDays = Math.max(0, (Date.now() - time) / 86400000);
  return Math.exp(-ageDays / 365);
}

function metaLine(item) {
  return [item.a, fmtDate(item.d || item.f)].filter(Boolean).join(" - ");
}

function qualityMarkup(item) {
  const label = item.q || "Indexed preview";
  const kind = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const chars = item.n ? `${Number(item.n).toLocaleString()} chars` : "";
  return `
    <span class="quality-badge quality-${escapeText(kind)}">${escapeText(label)}</span>
    ${chars ? `<span class="quality-meta">${escapeText(chars)}</span>` : ""}
  `;
}

function b64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function deriveDecryptKey(password, manifest) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: b64ToBytes(manifest.kdf.salt),
      iterations: manifest.kdf.iterations,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
}

async function decryptShard(buffer, key) {
  const bytes = new Uint8Array(buffer);
  const nonce = bytes.slice(0, 12);
  const ciphertext = bytes.slice(12);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: nonce },
    key,
    ciphertext,
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
}

function requestPassword() {
  el.passwordPanel.hidden = false;
  el.passwordInput.value = "";
  el.passwordInput.focus();
  return new Promise((resolve) => {
    const onSubmit = (event) => {
      event.preventDefault();
      const password = el.passwordInput.value;
      if (!password) {
        el.passwordError.textContent = "Password required.";
        return;
      }
      el.passwordForm.removeEventListener("submit", onSubmit);
      resolve(password);
    };
    el.passwordForm.addEventListener("submit", onSubmit);
  });
}

function makeExcerpt(item, terms, limit = 520) {
  const text = item.p || "";
  if (text.length <= limit) return text;
  const lower = text.toLowerCase();
  const hits = terms.map((term) => lower.indexOf(term)).filter((pos) => pos >= 0);
  const center = hits.length ? Math.min(...hits) : 0;
  let start = Math.max(0, center - Math.floor(limit / 3));
  let end = Math.min(text.length, start + limit);
  start = Math.max(0, end - limit);
  let excerpt = text.slice(start, end).trim();
  if (start > 0) excerpt = `...${excerpt}`;
  if (end < text.length) excerpt += "...";
  return excerpt;
}

function countHits(haystack, term) {
  let count = 0;
  let position = 0;
  while (true) {
    const found = haystack.indexOf(term, position);
    if (found < 0) return count;
    const before = found === 0 ? "" : haystack[found - 1];
    const after = haystack[found + term.length] || "";
    const leftOk = !/[a-z0-9_]/.test(before);
    const rightOk = !/[a-z0-9_]/.test(after);
    if (leftOk && rightOk) count += 1;
    position = found + term.length;
  }
}

function scoreDoc(doc, terms, conceptWeight, recencyWeight) {
  const title = doc._title;
  const haystack = doc._search;
  let titleHits = 0;
  let bodyHits = 0;
  let matched = 0;
  for (const term of terms) {
    const inTitle = countHits(title, term);
    const inBody = countHits(haystack, term);
    if (inTitle || inBody) matched += 1;
    titleHits += inTitle;
    bodyHits += inBody;
  }
  if (!matched) return null;
  const coverage = matched / terms.length;
  const titleBoost = Math.min(0.5, titleHits * 0.18);
  const bodyBoost = Math.min(0.5, bodyHits * 0.035);
  const lexical = Math.min(1, coverage * 0.72 + titleBoost + bodyBoost);
  const recency = recencyScore(doc.d || doc.f);
  const totalWeight = Math.max(1, conceptWeight + recencyWeight);
  const score = ((conceptWeight * lexical) + (recencyWeight * recency)) / totalWeight;
  return {
    doc,
    lexical,
    recency,
    score,
    dateSort: doc._dateSort,
    titleHits,
    bodyHits,
  };
}

function searchDocs() {
  const rawQuery = el.query.value.trim();
  if (!state.ready) return;
  if (!rawQuery) {
    state.results = [];
    renderResults([]);
    setStatus(`${state.docs.length.toLocaleString()} articles loaded`);
    return;
  }
  const terms = tokenize(rawQuery).filter((term) => !["zerohedge", "zh", "www", "https", "http", "com"].includes(term));
  if (!terms.length) {
    renderResults([]);
    return;
  }

  const conceptWeight = Number(el.conceptSlider.value);
  const recencyWeight = Number(el.recencySlider.value);
  const urlNeedle = rawQuery.includes("zerohedge.com")
    ? rawQuery.toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "")
    : "";
  const scored = [];
  const started = performance.now();
  for (const doc of state.docs) {
    if (urlNeedle && doc.u.toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "").includes(urlNeedle)) {
      scored.push({ doc, lexical: 1, recency: recencyScore(doc.d || doc.f), score: 1, dateSort: doc._dateSort, titleHits: 99, bodyHits: 99 });
      continue;
    }
    const result = scoreDoc(doc, terms, conceptWeight, recencyWeight);
    if (result) scored.push(result);
  }

  const dateFirst = recencyWeight > 0 && recencyWeight >= conceptWeight;
  if (dateFirst) {
    scored.sort((a, b) => (b.dateSort - a.dateSort) || (b.lexical - a.lexical) || (b.score - a.score));
  } else {
    scored.sort((a, b) => (b.score - a.score) || (b.lexical - a.lexical) || (b.dateSort - a.dateSort));
  }
  state.results = scored.slice(0, 25).map((item) => ({
    ...item,
    snippet: makeExcerpt(item.doc, terms),
  }));
  renderResults(state.results);
  const elapsed = Math.round(performance.now() - started);
  setStatus(`${scored.length.toLocaleString()} matches in ${elapsed}ms`);
}

function renderResults(results) {
  el.resultCount.textContent = String(results.length);
  if (!results.length) {
    el.results.innerHTML = `<div class="empty-state">No matching articles.</div>`;
    return;
  }
  el.results.innerHTML = results.map((item, index) => {
    const doc = item.doc;
    return `
      <button class="result-card" type="button" data-index="${index}">
        <h3>${escapeText(doc.t)}</h3>
        <div class="meta-line">${escapeText(metaLine(doc) || doc.u)}</div>
        <div class="quality-line compact">${qualityMarkup(doc)}</div>
        <p>${escapeText(item.snippet)}</p>
        <div class="score-line">
          <span>score ${item.score.toFixed(3)}</span>
          <span>lex ${item.lexical.toFixed(3)}</span>
          <span>rec ${item.recency.toFixed(3)}</span>
        </div>
      </button>
    `;
  }).join("");
  [...el.results.querySelectorAll(".result-card")].forEach((button) => {
    button.addEventListener("click", () => selectResult(Number(button.dataset.index)));
  });
  selectResult(0);
}

function selectResult(index) {
  const item = state.results[index];
  if (!item) return;
  state.selectedIndex = index;
  [...el.results.querySelectorAll(".result-card")].forEach((button, buttonIndex) => {
    button.classList.toggle("active", buttonIndex === index);
  });
  const doc = item.doc;
  el.previewTitle.textContent = doc.t;
  el.previewMeta.textContent = metaLine(doc) || doc.u;
  el.previewQuality.innerHTML = qualityMarkup(doc);
  el.previewText.textContent = doc.p || "";
  el.sourceLink.href = doc.u;
}

function updateLayoutButtons() {
  const sidebarCollapsed = el.appShell.classList.contains("sidebar-collapsed");
  const resultsCollapsed = el.appShell.classList.contains("results-collapsed");
  el.toggleSidebarButton.textContent = sidebarCollapsed ? "Show Options" : "Hide Options";
  el.toggleResultsButton.textContent = resultsCollapsed ? "Show Results" : "Hide Results";
}

async function loadPlainShards(manifest) {
  const shards = [];
  for (const [index, shard] of manifest.shards.entries()) {
    setStatus(`Loading index ${index + 1}/${manifest.shards.length}`);
    const docs = await fetch(`data/${shard}`, { cache: "force-cache" }).then((response) => response.json());
    el.loadedCount.textContent = String(index + 1);
    shards.push(docs);
  }
  return shards;
}

async function loadEncryptedShards(manifest) {
  if (!window.crypto?.subtle) {
    throw new Error("This browser does not support WebCrypto decryption.");
  }
  while (true) {
    const password = await requestPassword();
    try {
      const key = await deriveDecryptKey(password, manifest);
      const shards = [];
      for (const [index, shard] of manifest.shards.entries()) {
        setStatus(`Decrypting index ${index + 1}/${manifest.shards.length}`);
        const buffer = await fetch(`data/${shard}`, { cache: "force-cache" }).then((response) => response.arrayBuffer());
        const docs = await decryptShard(buffer, key);
        el.loadedCount.textContent = String(index + 1);
        shards.push(docs);
      }
      el.passwordPanel.hidden = true;
      el.passwordError.textContent = "";
      return shards;
    } catch (error) {
      el.passwordError.textContent = "Could not decrypt the archive. Check the password and try again.";
      setStatus("Locked index");
    }
  }
}

async function loadIndex() {
  const manifest = await fetch("data/manifest.json", { cache: "no-store" }).then((response) => response.json());
  el.articleCount.textContent = Number(manifest.count || 0).toLocaleString();
  el.oldestDate.textContent = shortDate(manifest.oldest);
  el.newestDate.textContent = shortDate(manifest.newest);
  const shards = manifest.encrypted
    ? await loadEncryptedShards(manifest)
    : await loadPlainShards(manifest);
  state.docs = shards.flat();
  for (const doc of state.docs) {
    doc._title = String(doc.t || "").toLowerCase();
    doc._search = `${doc._title} ${String(doc.p || "").toLowerCase()} ${String(doc.u || "").toLowerCase()}`;
    doc._dateSort = dateSort(doc.d || doc.f);
  }
  state.ready = true;
  el.loadedCount.textContent = state.docs.length.toLocaleString();
  setStatus(`${state.docs.length.toLocaleString()} articles loaded`);
  el.results.innerHTML = `<div class="empty-state">Search the hosted preview index.</div>`;
  const params = new URLSearchParams(window.location.search);
  const q = params.get("q");
  if (q) {
    el.query.value = q;
    searchDocs();
  }
}

let searchTimer = null;
function queueSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(searchDocs, 120);
}

el.form.addEventListener("submit", (event) => {
  event.preventDefault();
  searchDocs();
});

el.query.addEventListener("input", queueSearch);

for (const slider of [el.conceptSlider, el.recencySlider]) {
  slider.addEventListener("input", () => {
    el.conceptValue.textContent = el.conceptSlider.value;
    el.recencyValue.textContent = el.recencySlider.value;
    queueSearch();
  });
}

el.toggleSidebarButton.addEventListener("click", () => {
  el.appShell.classList.toggle("sidebar-collapsed");
  updateLayoutButtons();
});

el.toggleResultsButton.addEventListener("click", () => {
  el.appShell.classList.toggle("results-collapsed");
  updateLayoutButtons();
});

updateLayoutButtons();
loadIndex().catch((error) => {
  setStatus(error.message);
  el.results.innerHTML = `<div class="empty-state">${escapeText(error.message)}</div>`;
});
