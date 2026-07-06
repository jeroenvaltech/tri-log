const listView = document.getElementById("listView");
const detailView = document.getElementById("detailView");
const formView = document.getElementById("formView");
const raceList = document.getElementById("raceList");
const emptyState = document.getElementById("emptyState");
const emptyTitle = document.getElementById("emptyTitle");
const emptyAddBtn = document.getElementById("emptyAddBtn");
const listToolbar = document.getElementById("listToolbar");
const sortSelect = document.getElementById("sortSelect");
const typeFilterSelect = document.getElementById("typeFilterSelect");

const themeToggle = document.getElementById("themeToggle");
themeToggle.addEventListener("click", () => {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const next = isDark ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("triLogTheme", next);
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

function showView(view) {
  for (const v of [listView, detailView, formView]) v.classList.add("hidden");
  view.classList.remove("hidden");
}

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
        <button id="editBtn" class="icon-btn-plain" aria-label="Edit">${PENCIL_ICON}</button>
        <button id="deleteBtn" class="icon-btn-plain danger" aria-label="Delete">${TRASH_ICON}</button>
      </div>
    </div>
    <div class="badges">
      <span class="type-badge type-${race.type || "other"}">${typeLabel(race.type)}</span>
      <span class="date">${formatDate(race.date)}</span>
      ${resultLabel(race) ? `<span class="result-badge">${resultLabel(race)}</span>` : ""}
    </div>
    ${photoHtml}
    <table class="detail-table">
      <tr><td>Swim (${race.swimDist || 0} m)</td><td>${formatSeconds(race.swimTime)}</td></tr>
      <tr><td>T1</td><td>${formatSeconds(race.t1Time)}</td></tr>
      <tr><td>Bike (${race.bikeDist || 0} km)</td><td>${formatSeconds(race.bikeTime)}</td></tr>
      <tr><td>T2</td><td>${formatSeconds(race.t2Time)}</td></tr>
      <tr><td>Run (${race.runDist || 0} km)</td><td>${formatSeconds(race.runTime)}</td></tr>
      <tr class="total"><td>Total</td><td>${formatSeconds(totalSeconds(race))}</td></tr>
    </table>
  `;

  document.getElementById("editBtn").addEventListener("click", () => openForm(race));
  document.getElementById("deleteBtn").addEventListener("click", deleteCurrentRace);

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

function updateTotalDisplay() {
  const total =
    getHMS("swimTime") + getHMS("t1Time") + getHMS("bikeTime") + getHMS("t2Time") + getHMS("runTime");
  document.getElementById("totalTimeDisplay").textContent = formatSeconds(total);
}

function resetForm() {
  document.getElementById("raceForm").reset();
  document.getElementById("photoPreview").classList.add("hidden");
  document.getElementById("photoPreview").src = "";
  photoBlob = null;
  for (const t of ["swimTime", "t1Time", "bikeTime", "t2Time", "runTime"]) setHMS(t, 0);
  updateTotalDisplay();
}

function openForm(race) {
  resetForm();
  document.getElementById("formTitle").textContent = race ? "Edit Race" : "New Race";

  typeSelect.value = (race && race.type) || "";

  if (race) {
    document.getElementById("nameInput").value = race.name || "";
    document.getElementById("dateInput").value = race.date || "";
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
    updateTotalDisplay();
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
  showView(listView);
});

document.getElementById("cancelBtn").addEventListener("click", () => {
  showView(currentId ? detailView : listView);
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
  [h, m, s].forEach((input) => input.addEventListener("input", updateTotalDisplay));
}

document.getElementById("raceForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const race = {
    id: currentId || `${Date.now()}-${Math.floor(performance.now())}`,
    name: document.getElementById("nameInput").value.trim(),
    type: typeSelect.value,
    date: document.getElementById("dateInput").value,
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

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

refreshList();
