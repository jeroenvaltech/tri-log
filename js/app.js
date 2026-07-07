const listView = document.getElementById("listView");
const detailView = document.getElementById("detailView");
const formView = document.getElementById("formView");
const mapView = document.getElementById("mapView");
const settingsView = document.getElementById("settingsView");
const statsView = document.getElementById("statsView");
const recordDetailView = document.getElementById("recordDetailView");
const raceList = document.getElementById("raceList");
const emptyState = document.getElementById("emptyState");
const emptyTitle = document.getElementById("emptyTitle");
const emptyAddBtn = document.getElementById("emptyAddBtn");
const listToolbar = document.getElementById("listToolbar");
const sortSelect = document.getElementById("sortSelect");
const typeFilterSelect = document.getElementById("typeFilterSelect");
const bottomNav = document.getElementById("bottomNav");
const navListBtn = document.getElementById("navListBtn");
const navMapBtn = document.getElementById("navMapBtn");
const navStatsBtn = document.getElementById("navStatsBtn");
const countrySelect = document.getElementById("countryInput");
const cityInput = document.getElementById("cityInput");
const citySuggestions = document.getElementById("citySuggestions");

countrySelect.innerHTML = COUNTRIES.map((c) => `<option value="${c.code}">${c.name}</option>`).join("");

let selectedCity = null;

function renderCitySuggestions(query) {
  const country = COUNTRIES.find((c) => c.code === countrySelect.value);
  if (!country || !query) {
    citySuggestions.classList.add("hidden");
    citySuggestions.innerHTML = "";
    return;
  }
  const q = query.trim().toLowerCase();
  const matches = country.cities.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  if (matches.length === 0) {
    citySuggestions.classList.add("hidden");
    citySuggestions.innerHTML = "";
    return;
  }
  citySuggestions.innerHTML = matches
    .map((c) => `<div class="city-suggestion-item" data-name="${escapeHtml(c.name)}">${escapeHtml(c.name)}</div>`)
    .join("");
  citySuggestions.classList.remove("hidden");
}

cityInput.addEventListener("input", () => {
  selectedCity = null;
  renderCitySuggestions(cityInput.value);
});

citySuggestions.addEventListener("click", (e) => {
  const item = e.target.closest(".city-suggestion-item");
  if (!item) return;
  const country = COUNTRIES.find((c) => c.code === countrySelect.value);
  selectedCity = country.cities.find((c) => c.name === item.dataset.name) || null;
  cityInput.value = item.dataset.name;
  citySuggestions.classList.add("hidden");
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".city-picker")) citySuggestions.classList.add("hidden");
});

countrySelect.addEventListener("change", () => {
  cityInput.value = "";
  selectedCity = null;
  citySuggestions.classList.add("hidden");
});

const themeToggle = document.getElementById("themeToggle");
themeToggle.addEventListener("click", () => {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const next = isDark ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("triLogTheme", next);
});

document.getElementById("settingsToggle").addEventListener("click", () => {
  showView(settingsView);
});

document.getElementById("settingsBackBtn").addEventListener("click", () => {
  showView(lastMainView);
});

const TRI_TYPES = [
  { value: "sprint", label: "Sprint" },
  { value: "olympic", label: "Olympic (OD)" },
  { value: "half", label: "Half (70.3)" },
  { value: "full", label: "Full (140.6)" },
  { value: "other", label: "Other" },
];

function typeLabel(value) {
  return TRI_TYPES.find((t) => t.value === value)?.label || "Other";
}

const typeSelect = document.getElementById("typeInput");
typeSelect.innerHTML =
  `<option value="" disabled selected hidden>Select type</option>` +
  TRI_TYPES.map((t) => `<option value="${t.value}">${t.label}</option>`).join("");

typeFilterSelect.innerHTML =
  `<option value="all">All types</option>` +
  TRI_TYPES.map((t) => `<option value="${t.value}">${t.label}</option>`).join("");

const DISTANCE_PRESETS = {
  sprint: { swim: 750, bike: 20, run: 5 },
  olympic: { swim: 1500, bike: 40, run: 10 },
  half: { swim: 1900, bike: 90, run: 21 },
  full: { swim: 3800, bike: 180, run: 42.2 },
};

typeSelect.addEventListener("change", () => {
  const preset = DISTANCE_PRESETS[typeSelect.value];
  if (!preset) return;
  document.getElementById("swimDist").value = preset.swim;
  document.getElementById("bikeDist").value = preset.bike;
  document.getElementById("runDist").value = preset.run;
  updateComputedDisplays();
});

let sortMode = localStorage.getItem("triLogSortMode") || "date";
sortSelect.value = sortMode;
sortSelect.addEventListener("change", () => {
  sortMode = sortSelect.value;
  localStorage.setItem("triLogSortMode", sortMode);
  refreshList();
});

let typeFilter = localStorage.getItem("triLogTypeFilter") || "all";
typeFilterSelect.value = typeFilter;
typeFilterSelect.addEventListener("change", () => {
  typeFilter = typeFilterSelect.value;
  localStorage.setItem("triLogTypeFilter", typeFilter);
  refreshList();
});

let races = [];
let currentId = null;
let photoBlob = null;

let lastMainView = listView;

function showView(view) {
  for (const v of [listView, detailView, formView, mapView, settingsView, statsView, recordDetailView]) v.classList.add("hidden");
  view.classList.remove("hidden");

  const isMainView = view === listView || view === mapView || view === statsView;
  bottomNav.classList.toggle("hidden", !isMainView);
  if (isMainView) {
    lastMainView = view;
    navListBtn.classList.toggle("active", view === listView);
    navMapBtn.classList.toggle("active", view === mapView);
    navStatsBtn.classList.toggle("active", view === statsView);
  }
}

navListBtn.addEventListener("click", () => {
  showView(listView);
});

navMapBtn.addEventListener("click", () => {
  showView(mapView);
  renderMap();
});

navStatsBtn.addEventListener("click", () => {
  showView(statsView);
  renderStats();
});

function pad(n) {
  return String(n).padStart(2, "0");
}

function secondsFromHMS(h, m, s) {
  return (Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0);
}

function formatSeconds(total) {
  total = Math.max(0, Math.round(total || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function totalSeconds(race) {
  return (race.swimTime || 0) + (race.t1Time || 0) + (race.bikeTime || 0) + (race.t2Time || 0) + (race.runTime || 0);
}

function resultLabel(race) {
  if (!race.place || !race.fieldSize) return "";
  return `${race.place} / ${race.fieldSize}`;
}

function formatPace(secondsPerUnit) {
  if (!isFinite(secondsPerUnit) || secondsPerUnit <= 0) return "";
  const m = Math.floor(secondsPerUnit / 60);
  const s = Math.round(secondsPerUnit % 60);
  return `${m}:${pad(s)}`;
}

function swimPace(distM, timeSec) {
  if (!distM || !timeSec) return "";
  return `${formatPace(timeSec / (distM / 100))} /100m`;
}

function bikeSpeed(distKm, timeSec) {
  if (!distKm || !timeSec) return "";
  return `${(distKm / (timeSec / 3600)).toFixed(1)} km/h`;
}

function runPace(distKm, timeSec) {
  if (!distKm || !timeSec) return "";
  return `${formatPace(timeSec / distKm)} /km`;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

async function refreshList() {
  const allRaces = await RaceStore.getAll();
  races = typeFilter === "all" ? allRaces : allRaces.filter((r) => (r.type || "other") === typeFilter);

  if (sortMode === "name") {
    races.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  } else {
    races.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }
  raceList.innerHTML = "";
  listToolbar.classList.toggle("hidden", allRaces.length === 0);
  emptyState.classList.toggle("hidden", races.length > 0);
  if (races.length === 0) {
    const noneAtAll = allRaces.length === 0;
    emptyTitle.textContent = noneAtAll ? "No races yet" : "No races match this filter";
    emptyAddBtn.classList.toggle("hidden", !noneAtAll);
  }

  for (const race of races) {
    const li = document.createElement("li");
    li.className = "race-card";
    li.dataset.id = race.id;

    let mediaHtml;
    if (race.photo) {
      const url = URL.createObjectURL(race.photo);
      mediaHtml = `<img src="${url}" alt="">`;
    } else {
      mediaHtml = `<div class="placeholder">${(race.name || "?").slice(0, 2).toUpperCase()}</div>`;
    }

    li.innerHTML = `
      ${mediaHtml}
      <div class="info">
        <div class="name">${escapeHtml(race.name || "Untitled race")}</div>
        <div class="meta">
          <span class="type-badge type-${race.type || "other"}">${typeLabel(race.type)}</span>
          <span class="meta-date">${formatDate(race.date)}</span>
          ${resultLabel(race) ? `<span class="result-badge">${resultLabel(race)}</span>` : ""}
        </div>
      </div>
      <div class="total">${formatSeconds(totalSeconds(race))}</div>
    `;
    li.addEventListener("click", () => openDetail(race.id));
    raceList.appendChild(li);
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

const PENCIL_ICON = `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
const TRASH_ICON = `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z"/></svg>`;
const SHARE_ICON = `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M12 4L7 9M12 4l5 5"/><path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/></svg>`;

function openDetail(id) {
  const race = races.find((r) => r.id === id);
  if (!race) return;
  currentId = id;

  const content = document.getElementById("detailContent");
  const photoHtml = race.photo
    ? `<img class="detail-photo" src="${URL.createObjectURL(race.photo)}" alt="">`
    : "";

  content.innerHTML = `
    <div class="detail-name-row">
      <h3>${escapeHtml(race.name || "Untitled race")}</h3>
      <div class="detail-actions">
        <button id="shareBtn" class="icon-btn-plain" aria-label="Share">${SHARE_ICON}</button>
        <button id="editBtn" class="icon-btn-plain" aria-label="Edit">${PENCIL_ICON}</button>
        <button id="deleteBtn" class="icon-btn-plain danger" aria-label="Delete">${TRASH_ICON}</button>
      </div>
    </div>
    <div class="badges">
      <span class="type-badge type-${race.type || "other"}">${typeLabel(race.type)}</span>
      <span class="date">${formatDate(race.date)}</span>
      ${resultLabel(race) ? `<span class="result-badge">${resultLabel(race)}</span>` : ""}
      ${race.city ? `<span class="date">${escapeHtml(race.city)}</span>` : ""}
    </div>
    ${photoHtml}
    <table class="detail-table">
      <tr><td>Swim (${race.swimDist || 0} m)</td><td>${formatSeconds(race.swimTime)}${swimPace(race.swimDist, race.swimTime) ? `<span class="pace">${swimPace(race.swimDist, race.swimTime)}</span>` : ""}</td></tr>
      <tr><td>T1</td><td>${formatSeconds(race.t1Time)}</td></tr>
      <tr><td>Bike (${race.bikeDist || 0} km)</td><td>${formatSeconds(race.bikeTime)}${bikeSpeed(race.bikeDist, race.bikeTime) ? `<span class="pace">${bikeSpeed(race.bikeDist, race.bikeTime)}</span>` : ""}</td></tr>
      <tr><td>T2</td><td>${formatSeconds(race.t2Time)}</td></tr>
      <tr><td>Run (${race.runDist || 0} km)</td><td>${formatSeconds(race.runTime)}${runPace(race.runDist, race.runTime) ? `<span class="pace">${runPace(race.runDist, race.runTime)}</span>` : ""}</td></tr>
      <tr class="total"><td>Total</td><td>${formatSeconds(totalSeconds(race))}</td></tr>
    </table>
  `;

  document.getElementById("editBtn").addEventListener("click", () => openForm(race));
  document.getElementById("deleteBtn").addEventListener("click", deleteCurrentRace);
  document.getElementById("shareBtn").addEventListener("click", () => openShareModal(race));

  showView(detailView);
}

async function deleteCurrentRace() {
  if (!currentId) return;
  if (!confirm("Delete this race result?")) return;
  await RaceStore.remove(currentId);
  currentId = null;
  await refreshList();
  showView(listView);
}

function hmsInputs(target) {
  const wrap = document.querySelector(`.time-input[data-target="${target}"]`);
  return {
    h: wrap.querySelector(".h"),
    m: wrap.querySelector(".m"),
    s: wrap.querySelector(".s"),
  };
}

function setHMS(target, seconds) {
  const { h, m, s } = hmsInputs(target);
  seconds = Math.max(0, Math.round(seconds || 0));
  h.value = Math.floor(seconds / 3600) || "";
  m.value = Math.floor((seconds % 3600) / 60) || "";
  s.value = seconds % 60 || "";
}

function getHMS(target) {
  const { h, m, s } = hmsInputs(target);
  return secondsFromHMS(h.value, m.value, s.value);
}

function updateComputedDisplays() {
  const total =
    getHMS("swimTime") + getHMS("t1Time") + getHMS("bikeTime") + getHMS("t2Time") + getHMS("runTime");
  document.getElementById("totalTimeDisplay").textContent = formatSeconds(total);

  const swimDist = Number(document.getElementById("swimDist").value) || 0;
  const bikeDist = Number(document.getElementById("bikeDist").value) || 0;
  const runDist = Number(document.getElementById("runDist").value) || 0;

  document.getElementById("swimPaceDisplay").textContent = swimPace(swimDist, getHMS("swimTime"));
  document.getElementById("bikePaceDisplay").textContent = bikeSpeed(bikeDist, getHMS("bikeTime"));
  document.getElementById("runPaceDisplay").textContent = runPace(runDist, getHMS("runTime"));
}

function resetForm() {
  document.getElementById("raceForm").reset();
  document.getElementById("photoPreview").classList.add("hidden");
  document.getElementById("photoPreview").src = "";
  photoBlob = null;
  selectedCity = null;
  citySuggestions.classList.add("hidden");
  for (const t of ["swimTime", "t1Time", "bikeTime", "t2Time", "runTime"]) setHMS(t, 0);
  updateComputedDisplays();
  document.getElementById("nameInput").classList.remove("invalid");
  typeSelect.classList.remove("invalid");
}

function openForm(race) {
  resetForm();
  document.getElementById("formTitle").textContent = race ? "Edit Race" : "New Race";

  typeSelect.value = (race && race.type) || "";

  if (race) {
    document.getElementById("nameInput").value = race.name || "";
    document.getElementById("dateInput").value = race.date || "";
    countrySelect.value = race.country || "NL";
    if (race.city) {
      cityInput.value = race.city;
      selectedCity = (race.lat != null && race.lng != null) ? { name: race.city, lat: race.lat, lng: race.lng } : findCity(countrySelect.value, race.city);
    }
    document.getElementById("placeInput").value = race.place || "";
    document.getElementById("fieldSizeInput").value = race.fieldSize || "";
    document.getElementById("swimDist").value = race.swimDist || "";
    document.getElementById("bikeDist").value = race.bikeDist || "";
    document.getElementById("runDist").value = race.runDist || "";
    setHMS("swimTime", race.swimTime);
    setHMS("t1Time", race.t1Time);
    setHMS("bikeTime", race.bikeTime);
    setHMS("t2Time", race.t2Time);
    setHMS("runTime", race.runTime);
    if (race.photo) {
      photoBlob = race.photo;
      const preview = document.getElementById("photoPreview");
      preview.src = URL.createObjectURL(race.photo);
      preview.classList.remove("hidden");
    }
    updateComputedDisplays();
  }

  showView(formView);
}

document.getElementById("addBtn").addEventListener("click", () => {
  currentId = null;
  openForm(null);
});

document.getElementById("emptyAddBtn").addEventListener("click", () => {
  currentId = null;
  openForm(null);
});

document.getElementById("backBtn").addEventListener("click", () => {
  showView(lastMainView);
});

document.getElementById("cancelBtn").addEventListener("click", () => {
  showView(currentId ? detailView : lastMainView);
});

document.getElementById("photoInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  photoBlob = file;
  const preview = document.getElementById("photoPreview");
  preview.src = URL.createObjectURL(file);
  preview.classList.remove("hidden");
});

for (const target of ["swimTime", "t1Time", "bikeTime", "t2Time", "runTime"]) {
  const { h, m, s } = hmsInputs(target);
  [h, m, s].forEach((input) => input.addEventListener("input", updateComputedDisplays));
}

for (const id of ["swimDist", "bikeDist", "runDist"]) {
  document.getElementById(id).addEventListener("input", updateComputedDisplays);
}

const toastEl = document.getElementById("toast");
let toastTimer = null;

function showToast(message) {
  clearTimeout(toastTimer);
  toastEl.textContent = message;
  toastEl.classList.add("show");
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 3200);
}

function fieldLabel(el) {
  const field = el.closest(".field");
  const span = field && field.querySelector("span");
  return (span && span.textContent) || "This field";
}

function clearInvalid(el) {
  el.classList.remove("invalid");
}

document.getElementById("nameInput").addEventListener("input", (e) => clearInvalid(e.target));
typeSelect.addEventListener("change", () => clearInvalid(typeSelect));

document.getElementById("raceForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const requiredFields = Array.from(e.target.querySelectorAll("[required]"));
  const invalidFields = requiredFields.filter((el) => !el.checkValidity());

  requiredFields.forEach(clearInvalid);
  if (invalidFields.length > 0) {
    invalidFields.forEach((el) => el.classList.add("invalid"));
    const labels = invalidFields.map(fieldLabel).join(", ");
    showToast(`Please fill in: ${labels}`);
    invalidFields[0].focus();
    return;
  }

  const race = {
    id: currentId || `${Date.now()}-${Math.floor(performance.now())}`,
    name: document.getElementById("nameInput").value.trim(),
    type: typeSelect.value,
    date: document.getElementById("dateInput").value,
    country: countrySelect.value,
    city: cityInput.value.trim() || null,
    lat: selectedCity ? selectedCity.lat : null,
    lng: selectedCity ? selectedCity.lng : null,
    place: Number(document.getElementById("placeInput").value) || null,
    fieldSize: Number(document.getElementById("fieldSizeInput").value) || null,
    photo: photoBlob || null,
    swimDist: Number(document.getElementById("swimDist").value) || 0,
    bikeDist: Number(document.getElementById("bikeDist").value) || 0,
    runDist: Number(document.getElementById("runDist").value) || 0,
    swimTime: getHMS("swimTime"),
    t1Time: getHMS("t1Time"),
    bikeTime: getHMS("bikeTime"),
    t2Time: getHMS("t2Time"),
    runTime: getHMS("runTime"),
  };

  await RaceStore.put(race);
  currentId = race.id;
  await refreshList();
  openDetail(race.id);
});

const statsContent = document.getElementById("statsContent");
const statsEmptyState = document.getElementById("statsEmptyState");

function transitionCard(label, field, races) {
  if (races.length === 0) return "";
  const best = races.reduce((a, b) => (a[field] <= b[field] ? a : b));
  return `
    <div class="pr-card" data-kind="transition" data-field="${field}" data-label="${label}">
      <span class="pr-label">${label}</span>
      <span class="pr-time">${formatSeconds(best[field])}</span>
      <span class="pr-race">${escapeHtml(best.name || "Untitled race")}</span>
      <span class="pr-date">${formatDate(best.date)}</span>
    </div>
  `;
}

async function renderStats() {
  const allRaces = await RaceStore.getAll();
  const typedRaces = allRaces.filter((r) => totalSeconds(r) > 0);
  const t1Races = allRaces.filter((r) => (r.t1Time || 0) > 0);
  const t2Races = allRaces.filter((r) => (r.t2Time || 0) > 0);

  if (typedRaces.length === 0 && t1Races.length === 0 && t2Races.length === 0) {
    statsContent.innerHTML = "";
    statsEmptyState.classList.remove("hidden");
    return;
  }
  statsEmptyState.classList.add("hidden");

  const typeCards = TRI_TYPES.map((t) => {
    const racesOfType = typedRaces.filter((r) => (r.type || "other") === t.value);
    if (racesOfType.length === 0) return "";
    const best = racesOfType.reduce((a, b) => (totalSeconds(a) <= totalSeconds(b) ? a : b));
    return `
      <div class="pr-card" data-kind="type" data-type="${t.value}" data-label="${t.label}">
        <span class="type-badge type-${t.value}">${t.label}</span>
        <span class="pr-time">${formatSeconds(totalSeconds(best))}</span>
        <span class="pr-race">${escapeHtml(best.name || "Untitled race")}</span>
        <span class="pr-date">${formatDate(best.date)}</span>
      </div>
    `;
  }).filter(Boolean);

  const transitionCards = [
    transitionCard("T1", "t1Time", t1Races),
    transitionCard("T2", "t2Time", t2Races),
  ].filter(Boolean);

  let html = "";
  if (typeCards.length > 0) {
    html += `<div class="stats-section-title">Race Bests</div><div class="pr-grid">${typeCards.join("")}</div>`;
  }
  if (transitionCards.length > 0) {
    html += `<div class="stats-section-title">Transition Bests</div><div class="pr-grid">${transitionCards.join("")}</div>`;
  }
  statsContent.innerHTML = html;
}

statsContent.addEventListener("click", async (e) => {
  const card = e.target.closest(".pr-card");
  if (!card) return;
  const allRaces = await RaceStore.getAll();

  let ranked;
  let title;
  let field;
  if (card.dataset.kind === "type") {
    const racesOfType = allRaces.filter((r) => (r.type || "other") === card.dataset.type && totalSeconds(r) > 0);
    ranked = racesOfType
      .map((r) => ({ race: r, value: totalSeconds(r) }))
      .sort((a, b) => a.value - b.value);
    title = `${card.dataset.label} Results`;
    field = null;
  } else {
    field = card.dataset.field;
    const racesWithField = allRaces.filter((r) => (r[field] || 0) > 0);
    ranked = racesWithField
      .map((r) => ({ race: r, value: r[field] }))
      .sort((a, b) => a.value - b.value);
    title = `${card.dataset.label} Results`;
  }

  document.getElementById("recordDetailTitle").textContent = title;
  document.getElementById("recordDetailList").innerHTML = ranked
    .map(
      ({ race, value }, i) => `
        <li class="record-row" data-id="${race.id}">
          <div class="record-rank">${i + 1}</div>
          <div class="info">
            <div class="name">${escapeHtml(race.name || "Untitled race")}</div>
            <div class="date">${formatDate(race.date)}</div>
          </div>
          <div class="time">${formatSeconds(value)}</div>
        </li>
      `
    )
    .join("");

  races = allRaces;
  showView(recordDetailView);
});

document.getElementById("recordDetailList").addEventListener("click", (e) => {
  const row = e.target.closest(".record-row");
  if (!row) return;
  openDetail(row.dataset.id);
});

document.getElementById("recordBackBtn").addEventListener("click", () => {
  showView(lastMainView);
});

let mapInstance = null;
let markerLayer = null;
const mapEmptyState = document.getElementById("mapEmptyState");

function renderMap() {
  const defaultCountry = COUNTRIES[0];

  if (!mapInstance) {
    mapInstance = L.map("mapContainer").setView(defaultCountry.center, defaultCountry.zoom);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(mapInstance);
    markerLayer = L.layerGroup().addTo(mapInstance);
  }

  setTimeout(() => mapInstance.invalidateSize(), 100);

  RaceStore.getAll().then((allRaces) => {
    markerLayer.clearLayers();
    const located = allRaces.filter((r) => r.lat != null && r.lng != null);
    mapEmptyState.classList.toggle("hidden", located.length > 0);

    located.forEach((race) => {
      const marker = L.marker([race.lat, race.lng]).addTo(markerLayer);
      const meta = [race.city, formatDate(race.date)].filter(Boolean).join(" &middot; ");
      marker.bindPopup(`
        <div class="map-popup">
          <span class="type-badge type-${race.type || "other"}">${typeLabel(race.type)}</span>
          <h4>${escapeHtml(race.name || "Untitled race")}</h4>
          <p>${meta}</p>
          <button onclick="openRaceFromMap('${race.id}')">View</button>
        </div>
      `);
    });

    if (located.length > 0) {
      const bounds = L.featureGroup(located.map((r) => L.marker([r.lat, r.lng]))).getBounds();
      mapInstance.fitBounds(bounds.pad(0.25), { maxZoom: 12 });
    }
  });
}

async function openRaceFromMap(id) {
  races = await RaceStore.getAll();
  openDetail(id);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const SHARE_TYPE_COLORS = {
  sprint: "#10b981",
  olympic: "#3b82f6",
  half: "#f59e0b",
  full: "#a855f7",
  other: "#6b7488",
};

function roundedRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapCanvasText(ctx, text, maxWidth, maxLines) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = test;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

function loadImageFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}

async function buildShareCardBlob(race) {
  const W = 1080;
  const H = 1350;
  const left = 72;
  const right = W - 72;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  if (race.photo) {
    const img = await loadImageFromBlob(race.photo);
    const scale = Math.max(W / img.width, H / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    const overlay = ctx.createLinearGradient(0, 0, 0, H);
    overlay.addColorStop(0, "rgba(8,12,24,0.55)");
    overlay.addColorStop(0.5, "rgba(8,12,24,0.55)");
    overlay.addColorStop(1, "rgba(8,12,24,0.92)");
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, W, H);
  } else {
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#0d9488");
    bg.addColorStop(0.55, "#2563eb");
    bg.addColorStop(1, "#7c3aed");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.globalAlpha = 0.14;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(W * 0.88, H * 0.1, 260, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(W * 0.05, H * 0.92, 240, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  const typeColor = SHARE_TYPE_COLORS[race.type] || SHARE_TYPE_COLORS.other;

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "800 26px -apple-system, sans-serif";
  ctx.fillText("SPLIT", left, 88);

  const typeText = typeLabel(race.type).toUpperCase();
  ctx.font = "800 28px -apple-system, sans-serif";
  const badgeW = ctx.measureText(typeText).width + 48;
  const badgeY = 150;
  roundedRectPath(ctx, left, badgeY, badgeW, 58, 29);
  ctx.fillStyle = typeColor;
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.fillText(typeText, left + 24, badgeY + 29);

  ctx.font = "600 30px -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(formatDate(race.date), left + badgeW + 22, badgeY + 29);

  ctx.textBaseline = "alphabetic";
  ctx.font = "800 66px -apple-system, sans-serif";
  ctx.fillStyle = "#ffffff";
  const nameLines = wrapCanvasText(ctx, race.name || "Untitled race", right - left, 2);
  let estimatedBottom = 320 + nameLines.length * 74;
  if (race.city) estimatedBottom += 50;
  estimatedBottom += 46 + 100 + 70 + 220 + 70;
  if (race.place && race.fieldSize) estimatedBottom += 64;
  const gapToFooter = H - 150 - estimatedBottom;
  const verticalOffset = gapToFooter > 250 ? Math.min(gapToFooter / 2, 160) : 0;

  let y = 320 + verticalOffset;
  for (const line of nameLines) {
    ctx.fillText(line, left, y);
    y += 74;
  }

  if (race.city) {
    ctx.font = "600 32px -apple-system, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.beginPath();
    ctx.arc(left + 8, y + 12, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(race.city, left + 26, y + 22);
    y += 50;
  }
  y += 46;

  ctx.font = "700 28px -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.fillText("TOTAL TIME", left, y);
  y += 100;
  ctx.font = "800 128px -apple-system, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(formatSeconds(totalSeconds(race)), left, y);

  const splitsTop = y + 70;
  const splitsH = 220;
  roundedRectPath(ctx, left, splitsTop, right - left, splitsH, 28);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fill();

  const splits = [
    { label: "SWIM", color: "#38bdf8", time: race.swimTime, sub: race.swimDist ? `${race.swimDist} m` : "" },
    { label: "T1", color: "#e2e8f0", time: race.t1Time, sub: "" },
    { label: "BIKE", color: "#fbbf24", time: race.bikeTime, sub: race.bikeDist ? `${race.bikeDist} km` : "" },
    { label: "T2", color: "#e2e8f0", time: race.t2Time, sub: "" },
    { label: "RUN", color: "#34d399", time: race.runTime, sub: race.runDist ? `${race.runDist} km` : "" },
  ];
  const colW = (right - left) / splits.length;
  ctx.textAlign = "center";
  splits.forEach((s, i) => {
    const cx = left + colW * i + colW / 2;
    ctx.font = "800 22px -apple-system, sans-serif";
    ctx.fillStyle = s.color;
    ctx.fillText(s.label, cx, splitsTop + 46);
    ctx.font = "800 34px -apple-system, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(formatSeconds(s.time || 0).replace(/^00:/, ""), cx, splitsTop + 104);
    if (s.sub) {
      ctx.font = "600 22px -apple-system, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.fillText(s.sub, cx, splitsTop + 140);
    }
    if (i > 0) {
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(left + colW * i, splitsTop + 30);
      ctx.lineTo(left + colW * i, splitsTop + splitsH - 30);
      ctx.stroke();
    }
  });
  ctx.textAlign = "left";

  const afterSplitsY = splitsTop + splitsH + 70;
  if (race.place && race.fieldSize) {
    const text = `${race.place} of ${race.fieldSize} finishers`;
    ctx.font = "700 32px -apple-system, sans-serif";
    const pillW = ctx.measureText(text).width + 56;
    roundedRectPath(ctx, left, afterSplitsY, pillW, 64, 32);
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "middle";
    ctx.fillText(text, left + 28, afterSplitsY + 32);
    ctx.textBaseline = "alphabetic";
  }

  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left, H - 90);
  ctx.lineTo(right, H - 90);
  ctx.stroke();

  ctx.font = "600 26px -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.textAlign = "center";
  ctx.fillText("Tracked with Split", W / 2, H - 52);
  ctx.textAlign = "left";

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

let currentShareBlob = null;

async function openShareModal(race) {
  const blob = await buildShareCardBlob(race);
  currentShareBlob = blob;
  document.getElementById("shareCardImg").src = URL.createObjectURL(blob);
  document.getElementById("shareModal").classList.remove("hidden");
}

document.getElementById("shareCloseBtn").addEventListener("click", () => {
  document.getElementById("shareModal").classList.add("hidden");
});

document.getElementById("shareSendBtn").addEventListener("click", async () => {
  if (!currentShareBlob) return;
  const filename = "triathlon-result.png";
  const file = new File([currentShareBlob], filename, { type: "image/png" });

  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return;
    }
    throw new Error("share unsupported");
  } catch (err) {
    if (err.name === "AbortError") return;
    downloadBlob(currentShareBlob, filename);
  }
});

async function exportData() {
  const races = (await RaceStore.getAll()).map((r) => {
    const copy = { ...r };
    delete copy.photo;
    return copy;
  });
  const payload = { app: "tri-log", version: 1, exportedAt: new Date().toISOString(), races };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const filename = `tri-log-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([blob], filename, { type: "application/json" });

  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return;
    }
    throw new Error("share unsupported");
  } catch (err) {
    if (err.name === "AbortError") return;
    downloadBlob(blob, filename);
  }
}

document.getElementById("exportBtn").addEventListener("click", exportData);

document.getElementById("importBtn").addEventListener("click", () => {
  document.getElementById("importFileInput").click();
});

document.getElementById("importFileInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;

  try {
    const parsed = JSON.parse(await file.text());
    if (parsed.app !== "tri-log" || !Array.isArray(parsed.races)) throw new Error("bad shape");

    const existing = new Map((await RaceStore.getAll()).map((r) => [r.id, r]));
    let added = 0;
    let updated = 0;
    for (const imported of parsed.races) {
      const prior = existing.get(imported.id);
      await RaceStore.put({ ...imported, photo: prior ? prior.photo : null });
      if (prior) updated++;
      else added++;
    }

    await refreshList();
    showToast(`Imported ${added} new, updated ${updated} existing`);
  } catch {
    showToast("This doesn't look like a Tri Log backup file");
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").then((reg) => {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") reg.update();
      });
    }).catch(() => {});
  });

  let hasReloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hasReloaded) return;
    hasReloaded = true;
    window.location.reload();
  });
}

refreshList();
