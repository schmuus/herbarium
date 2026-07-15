// ===========================================================
// Herbarium — App-Controller
// ===========================================================
import { watchAuth, ensureSignedIn } from "./auth.js";
import * as Plants from "./plants.js";
import * as Recipes from "./recipes.js";

// ----------------------------------------------------------
// State
// ----------------------------------------------------------
let plants = [];
let recipes = [];
let unsubPlants = null;
let unsubRecipes = null;
let searchTerm = "";
let activeTagFilter = null;

const TOXICITY_LEVELS = ["ungiftig", "leicht giftig", "giftig", "stark giftig / tödlich", "unbekannt"];
const RECIPE_TYPES = ["Tinktur", "Tee", "Salbe", "Öl", "Sirup", "Essig", "Sonstiges"];
const UNITS = ["g", "kg", "ml", "l", "TL", "EL", "Prise", "Stück", "Tropfen"];
const IMAGE_LABELS = [
  { key: "habitus", label: "Habitus" },
  { key: "blatt", label: "Blatt" },
  { key: "bluete", label: "Blüte" },
  { key: "wurzel", label: "Wurzel" },
  { key: "standort", label: "Standort" },
];

// ----------------------------------------------------------
// DOM refs
// ----------------------------------------------------------
const $view = document.getElementById("view");
const $searchInput = document.getElementById("search-input");
const $newBtn = document.getElementById("new-btn");
const $exportBtn = document.getElementById("export-btn");
const $toast = document.getElementById("toast");

// ----------------------------------------------------------
// Helpers
// ----------------------------------------------------------
function esc(str) {
  if (str === undefined || str === null) return "";
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function showToast(msg) {
  $toast.textContent = msg;
  $toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { $toast.hidden = true; }, 2600);
}

function formatDate(value) {
  if (!value) return "";
  try {
    const d = typeof value === "string" ? new Date(value) : value.toDate ? value.toDate() : new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString("de-DE", { year: "numeric", month: "2-digit", day: "2-digit" });
  } catch { return value; }
}

function collectionNumber(list, id) {
  const idx = [...list].sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)).findIndex(p => p.id === id);
  return String(idx + 1).padStart(3, "0");
}

function isToxic(plant) {
  return (plant.toxicity && plant.toxicity !== "ungiftig") || (plant.confusions && plant.confusions.length > 0);
}

function navigate(hash) { window.location.hash = hash; }

function setActiveNav(section) {
  document.querySelectorAll(".main-nav a").forEach(a => {
    a.classList.toggle("active", a.dataset.nav === section);
  });
}

// ----------------------------------------------------------
// Router
// ----------------------------------------------------------
function parseHash() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const parts = hash.split("/").filter(Boolean);
  return parts;
}

function router() {
  const parts = parseHash();
  const section = parts[0] || "pflanzen";

  if (section === "pflanzen") {
    setActiveNav("pflanzen");
    if (parts[1] === "neu") return renderPlantForm(null);
    if (parts[1] && parts[2] === "bearbeiten") return renderPlantForm(parts[1]);
    if (parts[1]) return renderPlantDetail(parts[1]);
    return renderPlantList();
  }
  if (section === "rezepte") {
    setActiveNav("rezepte");
    if (parts[1] === "neu") return renderRecipeForm(null);
    if (parts[1] && parts[2] === "bearbeiten") return renderRecipeForm(parts[1]);
    if (parts[1]) return renderRecipeDetail(parts[1]);
    return renderRecipeList();
  }
  navigate("#/pflanzen");
}

function currentSection() {
  return (parseHash()[0] || "pflanzen");
}

// ----------------------------------------------------------
// Render: Plant list
// ----------------------------------------------------------
function allTags() {
  const set = new Set();
  plants.forEach(p => (p.tags || []).forEach(t => set.add(t)));
  return [...set].sort();
}

function filteredPlants() {
  let list = plants;
  if (activeTagFilter) list = list.filter(p => (p.tags || []).includes(activeTagFilter));
  if (searchTerm) {
    const t = searchTerm.toLowerCase();
    list = list.filter(p =>
      (p.latinName || "").toLowerCase().includes(t) ||
      (p.germanName || "").toLowerCase().includes(t) ||
      (p.family || "").toLowerCase().includes(t) ||
      (p.tags || []).some(tag => tag.toLowerCase().includes(t))
    );
  }
  return list;
}

function renderPlantList() {
  const list = filteredPlants();
  const tags = allTags();

  $view.innerHTML = `
    <div class="section-head">
      <h1>Pflanzen</h1>
      <span class="section-count">${list.length} von ${plants.length} Exemplaren</span>
    </div>
    ${tags.length ? `<div class="filter-tags">
      <span class="filter-tag ${!activeTagFilter ? "active" : ""}" data-tag="">Alle</span>
      ${tags.map(t => `<span class="filter-tag ${activeTagFilter === t ? "active" : ""}" data-tag="${esc(t)}">${esc(t)}</span>`).join("")}
    </div>` : ""}
    ${list.length === 0 ? `
      <div class="empty-state">
        <h3>Noch keine Pflanzen erfasst</h3>
        <p>Lege deinen ersten Herbarium-Eintrag an — mit Fundort, Merkmalen und Heilwirkung.</p>
        <button class="btn btn-primary" id="empty-new-plant">+ Pflanze erfassen</button>
      </div>` : `
      <div class="specimen-grid">
        ${list.map(renderPlantCard).join("")}
      </div>`
    }
  `;

  $view.querySelectorAll(".filter-tag").forEach(el => {
    el.addEventListener("click", () => {
      activeTagFilter = el.dataset.tag || null;
      renderPlantList();
    });
  });
  $view.querySelectorAll(".specimen-card").forEach(el => {
    el.addEventListener("click", () => navigate(`#/pflanzen/${el.dataset.id}`));
  });
  document.getElementById("empty-new-plant")?.addEventListener("click", () => navigate("#/pflanzen/neu"));
}

function renderPlantCard(p) {
  const img = p.images && p.images[0] ? p.images[0].url : "";
  return `
    <article class="specimen-card" data-id="${p.id}">
      <div class="specimen-photo" style="${img ? `background-image:url('${esc(img)}')` : ""}">
        ${!img ? "Kein Foto" : ""}
        ${isToxic(p) ? `<span class="specimen-warn-badge">⚠ Achtung</span>` : ""}
      </div>
      <div class="specimen-body">
        <div class="specimen-latin">${esc(p.latinName) || "Unbenannt"}</div>
        <div class="specimen-german">${esc(p.germanName) || ""}</div>
        <div class="specimen-family">${esc(p.family) || "Familie unbekannt"}</div>
      </div>
      <div class="specimen-label">
        <span class="label-no">Nr. ${collectionNumber(plants, p.id)}</span>
        <span class="label-date">${esc(p.fund?.ort || "—")}</span>
      </div>
    </article>
  `;
}

// ----------------------------------------------------------
// Render: Plant detail
// ----------------------------------------------------------
function renderPlantDetail(id) {
  const p = plants.find(x => x.id === id);
  if (!p) { $view.innerHTML = `<p>Pflanze nicht gefunden.</p>`; return; }

  const linkedRecipes = recipes.filter(r => (r.linkedPlantIds || []).includes(id));
  const images = p.images || [];
  const mainImg = images[0]?.url || "";

  $view.innerHTML = `
    <div class="sheet">
      <div class="sheet-header">
        <a href="#/pflanzen" class="back-link">← Zur Übersicht</a>
        <div class="sheet-actions">
          <button class="btn btn-ghost btn-sm" id="print-btn">Drucken</button>
          <button class="btn btn-ghost btn-sm" id="edit-plant-btn">Bearbeiten</button>
          <button class="btn btn-danger btn-sm" id="delete-plant-btn">Löschen</button>
        </div>
      </div>
      <div class="sheet-grid">
        <div class="sheet-media">
          <div class="sheet-photo-main" id="main-photo" style="${mainImg ? `background-image:url('${esc(mainImg)}')` : ""}"></div>
          ${images.length > 1 ? `<div class="sheet-thumbs">
            ${images.map((img, i) => `<div class="sheet-thumb ${i === 0 ? "active" : ""}" style="background-image:url('${esc(img.url)}')" data-url="${esc(img.url)}" title="${esc(img.label || "")}"></div>`).join("")}
          </div>` : ""}
          <div class="sheet-label">
            <div class="lbl-row"><span class="lbl-key">Sammlung Nr.</span><span>${collectionNumber(plants, p.id)}</span></div>
            <div class="lbl-row"><span class="lbl-key">Fundort</span><span>${esc(p.fund?.ort) || "—"}</span></div>
            <div class="lbl-row"><span class="lbl-key">Funddatum</span><span>${formatDate(p.fund?.datum) || "—"}</span></div>
            <div class="lbl-row"><span class="lbl-key">Schutzstatus</span><span>${esc(p.schutzstatus) || "—"}</span></div>
          </div>
        </div>
        <div class="sheet-info">
          <div class="sheet-title">${esc(p.latinName) || "Unbenannt"}</div>
          <div class="sheet-german">${esc(p.germanName) || ""}${p.synonyms ? " · " + esc(p.synonyms) : ""}</div>
          ${p.family ? `<span class="sheet-family-badge">${esc(p.family)}</span>` : ""}

          ${isToxic(p) ? `<div class="warn-box">
            <strong>⚠ Vorsicht bei Bestimmung &amp; Anwendung</strong>
            ${p.toxicity && p.toxicity !== "ungiftig" ? `Giftigkeit: ${esc(p.toxicity)}. ` : ""}
            ${p.confusions?.length ? `Es gibt bekannte Verwechslungsarten — siehe unten.` : ""}
          </div>` : ""}

          <div class="field-block">
            <h3>Bestimmungsmerkmale</h3>
            <div class="field-grid">
              ${fieldItem("Blattform", p.merkmale?.blattform)}
              ${fieldItem("Blüte", p.merkmale?.bluete)}
              ${fieldItem("Wuchshöhe", p.merkmale?.wuchshoehe)}
              ${fieldItem("Stängel", p.merkmale?.stängel)}
              ${fieldItem("Wurzel", p.merkmale?.wurzel)}
            </div>
          </div>

          <div class="field-block">
            <h3>Standort</h3>
            <div class="field-grid">
              ${fieldItem("Boden", p.standort?.boden)}
              ${fieldItem("Licht", p.standort?.licht)}
              ${fieldItem("Feuchtigkeit", p.standort?.feuchtigkeit)}
            </div>
          </div>

          ${p.confusions?.length ? `
          <div class="field-block">
            <h3>Verwechslungsarten</h3>
            ${p.confusions.map(c => `<div class="confusion-item"><span class="cf-name">${esc(c.name)}</span><br>${esc(c.unterschied)}</div>`).join("")}
          </div>` : ""}

          ${p.erntekalender ? `<div class="field-block"><h3>Sammelkalender</h3><p>${esc(p.erntekalender)}</p></div>` : ""}

          <div class="field-block">
            <h3>Heilwirkung</h3>
            <div class="field-grid">
              ${fieldItem("Verwendete Pflanzenteile", p.heilwirkung?.pflanzenteile)}
              ${fieldItem("Inhaltsstoffe", p.heilwirkung?.inhaltsstoffe)}
              ${fieldItem("Übliche Dosierung", p.heilwirkung?.dosierung)}
            </div>
            ${p.heilwirkung?.indikationen ? `<div style="margin-top:10px"><div class="fi-key">Anwendungsbereiche</div><p>${esc(p.heilwirkung.indikationen)}</p></div>` : ""}
            ${p.heilwirkung?.kontraindikationen ? `<div style="margin-top:10px"><div class="fi-key">Kontraindikationen &amp; Nebenwirkungen</div><p>${esc(p.heilwirkung.kontraindikationen)}</p></div>` : ""}
          </div>

          ${p.tags?.length ? `<div class="field-block"><h3>Schlagworte</h3><div class="tag-list">${p.tags.map(t => `<span class="tag-pill">${esc(t)}</span>`).join("")}</div></div>` : ""}

          ${p.notizen ? `<div class="field-block"><h3>Bemerkungen</h3><p>${esc(p.notizen)}</p></div>` : ""}

          <div class="field-block">
            <h3>Verknüpfte Rezepte</h3>
            ${linkedRecipes.length ? `<div class="linked-recipes">
              ${linkedRecipes.map(r => `<a class="linked-recipe-row" href="#/rezepte/${r.id}"><span>${esc(r.name)}</span><span class="lr-type">${esc(r.typ)}</span></a>`).join("")}
            </div>` : `<p style="color:var(--ink-faint); font-size:13px;">Noch kein Rezept mit dieser Pflanze verknüpft.</p>`}
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("edit-plant-btn").addEventListener("click", () => navigate(`#/pflanzen/${id}/bearbeiten`));
  document.getElementById("print-btn").addEventListener("click", () => window.print());
  document.getElementById("delete-plant-btn").addEventListener("click", async () => {
    if (!confirm(`„${p.latinName || p.germanName}" wirklich unwiderruflich löschen?`)) return;
    await Plants.deletePlant(id);
    showToast("Pflanze gelöscht.");
    navigate("#/pflanzen");
  });
  $view.querySelectorAll(".sheet-thumb").forEach(t => {
    t.addEventListener("click", () => {
      document.getElementById("main-photo").style.backgroundImage = `url('${t.dataset.url}')`;
      $view.querySelectorAll(".sheet-thumb").forEach(x => x.classList.remove("active"));
      t.classList.add("active");
    });
  });
}

function fieldItem(key, val) {
  if (!val) return "";
  return `<div><div class="fi-key">${esc(key)}</div><div class="fi-val">${esc(val)}</div></div>`;
}

// ----------------------------------------------------------
// Render: Plant form (create/edit)
// ----------------------------------------------------------
function emptyPlant() {
  return {
    latinName: "", germanName: "", family: "", synonyms: "",
    merkmale: { blattform: "", bluete: "", wuchshoehe: "", stängel: "", wurzel: "" },
    standort: { boden: "", licht: "", feuchtigkeit: "" },
    toxicity: "unbekannt", schutzstatus: "",
    confusions: [],
    fund: { ort: "", datum: "" },
    erntekalender: "",
    heilwirkung: { pflanzenteile: "", inhaltsstoffe: "", indikationen: "", kontraindikationen: "", dosierung: "" },
    tags: [], notizen: "", images: [],
  };
}

let formDraft = null;
let formIsNew = true;
let formPlantId = null;
let uploadedThisSession = []; // storage paths uploaded during this form session (for cleanup on cancel)

function renderPlantForm(id) {
  formIsNew = !id;
  const existing = id ? plants.find(p => p.id === id) : null;
  formDraft = existing ? JSON.parse(JSON.stringify(existing)) : emptyPlant();
  formPlantId = id || Plants.newPlantId();
  uploadedThisSession = [];

  drawPlantForm();
}

function drawPlantForm() {
  const d = formDraft;
  $view.innerHTML = `
    <div class="sheet form-sheet">
      <div class="sheet-header" style="padding-bottom:20px;">
        <a href="#/pflanzen" class="back-link" id="cancel-link">← Abbrechen</a>
        <h2 style="font-size:18px; font-style:italic;">${formIsNew ? "Neue Pflanze" : "Pflanze bearbeiten"}</h2>
      </div>
      <div style="padding: 4px 28px 28px;">
        <form id="plant-form">

          <div class="form-section">
            <h3>Identifikation</h3>
            <div class="form-row">
              <div class="field"><label>Botanischer Name (lateinisch) *</label><input type="text" name="latinName" required value="${esc(d.latinName)}" placeholder="z. B. Allium ursinum"></div>
              <div class="field"><label>Deutscher Name</label><input type="text" name="germanName" value="${esc(d.germanName)}" placeholder="z. B. Bärlauch"></div>
            </div>
            <div class="form-row">
              <div class="field"><label>Pflanzenfamilie</label><input type="text" name="family" value="${esc(d.family)}" placeholder="z. B. Amaryllisgewächse"></div>
              <div class="field"><label>Weitere Namen / Synonyme</label><input type="text" name="synonyms" value="${esc(d.synonyms)}" placeholder="Kommagetrennt"></div>
            </div>
          </div>

          <div class="form-section">
            <h3>Bestimmungsmerkmale</h3>
            <div class="form-row">
              <div class="field"><label>Blattform</label><input type="text" name="m_blattform" value="${esc(d.merkmale?.blattform)}"></div>
              <div class="field"><label>Blüte (Farbe/Form)</label><input type="text" name="m_bluete" value="${esc(d.merkmale?.bluete)}"></div>
            </div>
            <div class="form-row three">
              <div class="field"><label>Wuchshöhe</label><input type="text" name="m_wuchshoehe" value="${esc(d.merkmale?.wuchshoehe)}" placeholder="z. B. 15–30 cm"></div>
              <div class="field"><label>Stängel</label><input type="text" name="m_stängel" value="${esc(d.merkmale?.stängel)}"></div>
              <div class="field"><label>Wurzel</label><input type="text" name="m_wurzel" value="${esc(d.merkmale?.wurzel)}"></div>
            </div>
          </div>

          <div class="form-section">
            <h3>Standort</h3>
            <div class="form-row three">
              <div class="field"><label>Boden</label><input type="text" name="s_boden" value="${esc(d.standort?.boden)}"></div>
              <div class="field"><label>Licht</label><input type="text" name="s_licht" value="${esc(d.standort?.licht)}" placeholder="z. B. Halbschatten"></div>
              <div class="field"><label>Feuchtigkeit</label><input type="text" name="s_feuchtigkeit" value="${esc(d.standort?.feuchtigkeit)}"></div>
            </div>
          </div>

          <div class="form-section">
            <h3>Sicherheit</h3>
            <div class="form-row">
              <div class="field">
                <label>Giftigkeit</label>
                <select name="toxicity">
                  ${TOXICITY_LEVELS.map(t => `<option value="${t}" ${d.toxicity === t ? "selected" : ""}>${t}</option>`).join("")}
                </select>
              </div>
              <div class="field"><label>Naturschutzstatus</label><input type="text" name="schutzstatus" value="${esc(d.schutzstatus)}" placeholder="z. B. nicht geschützt / geschützt"></div>
            </div>
            <div class="field" style="margin-bottom:10px;">
              <label>Verwechslungsarten</label>
              <span class="field-hint">Gefährliche Doppelgänger mit Unterscheidungsmerkmalen — sicherheitsrelevant.</span>
            </div>
            <div id="confusion-rows">
              ${(d.confusions || []).map((c, i) => confusionRowHtml(c, i)).join("")}
            </div>
            <button type="button" class="add-row-btn" id="add-confusion">+ Verwechslungsart hinzufügen</button>
          </div>

          <div class="form-section">
            <h3>Fund &amp; Sammlung</h3>
            <div class="form-row">
              <div class="field"><label>Fundort</label><input type="text" name="f_ort" value="${esc(d.fund?.ort)}"></div>
              <div class="field"><label>Funddatum</label><input type="date" name="f_datum" value="${d.fund?.datum ? String(d.fund.datum).slice(0,10) : ""}"></div>
            </div>
            <div class="field">
              <label>Sammelkalender</label>
              <textarea name="erntekalender" placeholder="z. B. Blätter: März–Mai, Blüten: April">${esc(d.erntekalender)}</textarea>
            </div>
          </div>

          <div class="form-section">
            <h3>Fotos</h3>
            <div class="image-upload-grid" id="image-grid">
              ${renderImageTiles()}
              <button type="button" class="image-add-tile" id="add-image-btn">+</button>
            </div>
            <input type="file" id="image-file-input" accept="image/*" class="visually-hidden">
            <p class="field-hint" style="margin-top:8px;">Tipp: Fotografiere Habitus, Blatt, Blüte, Wurzel und Standort einzeln.</p>
          </div>

          <div class="form-section">
            <h3>Heilwirkung</h3>
            <div class="form-row">
              <div class="field"><label>Verwendete Pflanzenteile</label><input type="text" name="h_pflanzenteile" value="${esc(d.heilwirkung?.pflanzenteile)}"></div>
              <div class="field"><label>Inhaltsstoffe / Wirkstoffe</label><input type="text" name="h_inhaltsstoffe" value="${esc(d.heilwirkung?.inhaltsstoffe)}"></div>
            </div>
            <div class="field" style="margin-bottom:14px;"><label>Anwendungsbereiche / Indikationen</label><textarea name="h_indikationen">${esc(d.heilwirkung?.indikationen)}</textarea></div>
            <div class="field" style="margin-bottom:14px;"><label>Kontraindikationen, Nebenwirkungen, Wechselwirkungen</label><textarea name="h_kontraindikationen">${esc(d.heilwirkung?.kontraindikationen)}</textarea></div>
            <div class="field"><label>Übliche Dosierung</label><input type="text" name="h_dosierung" value="${esc(d.heilwirkung?.dosierung)}"></div>
          </div>

          <div class="form-section">
            <h3>Sonstiges</h3>
            <div class="field" style="margin-bottom:14px;">
              <label>Schlagworte (Tags)</label>
              <input type="text" name="tags" value="${esc((d.tags || []).join(", "))}" placeholder="Kommagetrennt, z. B. Verdauung, Erkältung">
            </div>
            <div class="field"><label>Freie Notizen</label><textarea name="notizen">${esc(d.notizen)}</textarea></div>
          </div>

          <div class="form-footer">
            <div>${!formIsNew ? `<button type="button" class="btn btn-danger" id="delete-in-form">Löschen</button>` : ""}</div>
            <div class="form-footer-right">
              <button type="button" class="btn btn-ghost" id="cancel-btn">Abbrechen</button>
              <button type="submit" class="btn btn-primary" id="save-btn">Speichern</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `;

  wirePlantForm();
}

function confusionRowHtml(c, i) {
  return `
    <div class="repeat-row" data-idx="${i}">
      <div class="field"><input type="text" placeholder="Name der Verwechslungsart" data-cf="name" value="${esc(c.name)}"></div>
      <div class="field"><input type="text" placeholder="Unterscheidungsmerkmal" data-cf="unterschied" value="${esc(c.unterschied)}"></div>
      <button type="button" class="repeat-remove" data-remove-confusion="${i}" title="Entfernen">×</button>
    </div>
  `;
}

function renderImageTiles() {
  return (formDraft.images || []).map((img, i) => `
    <div class="image-upload-tile" style="background-image:url('${esc(img.url)}')">
      <span class="img-label">${esc(img.label || "")}</span>
      <button type="button" class="img-remove" data-remove-image="${i}" title="Entfernen">×</button>
    </div>
  `).join("");
}

function readFormIntoDraft() {
  const form = document.getElementById("plant-form");
  const fd = new FormData(form);
  const d = formDraft;
  d.latinName = fd.get("latinName")?.trim() || "";
  d.germanName = fd.get("germanName")?.trim() || "";
  d.family = fd.get("family")?.trim() || "";
  d.synonyms = fd.get("synonyms")?.trim() || "";
  d.merkmale = {
    blattform: fd.get("m_blattform")?.trim() || "",
    bluete: fd.get("m_bluete")?.trim() || "",
    wuchshoehe: fd.get("m_wuchshoehe")?.trim() || "",
    stängel: fd.get("m_stängel")?.trim() || "",
    wurzel: fd.get("m_wurzel")?.trim() || "",
  };
  d.standort = {
    boden: fd.get("s_boden")?.trim() || "",
    licht: fd.get("s_licht")?.trim() || "",
    feuchtigkeit: fd.get("s_feuchtigkeit")?.trim() || "",
  };
  d.toxicity = fd.get("toxicity") || "unbekannt";
  d.schutzstatus = fd.get("schutzstatus")?.trim() || "";
  d.fund = { ort: fd.get("f_ort")?.trim() || "", datum: fd.get("f_datum") || "" };
  d.erntekalender = fd.get("erntekalender")?.trim() || "";
  d.heilwirkung = {
    pflanzenteile: fd.get("h_pflanzenteile")?.trim() || "",
    inhaltsstoffe: fd.get("h_inhaltsstoffe")?.trim() || "",
    indikationen: fd.get("h_indikationen")?.trim() || "",
    kontraindikationen: fd.get("h_kontraindikationen")?.trim() || "",
    dosierung: fd.get("h_dosierung")?.trim() || "",
  };
  d.tags = (fd.get("tags") || "").split(",").map(t => t.trim()).filter(Boolean);
  d.notizen = fd.get("notizen")?.trim() || "";

  // Confusions from live DOM (not part of FormData structure)
  d.confusions = [...document.querySelectorAll("#confusion-rows .repeat-row")].map(row => ({
    name: row.querySelector('[data-cf="name"]').value.trim(),
    unterschied: row.querySelector('[data-cf="unterschied"]').value.trim(),
  })).filter(c => c.name || c.unterschied);
}

function wirePlantForm() {
  document.getElementById("add-confusion").addEventListener("click", () => {
    formDraft.confusions = formDraft.confusions || [];
    formDraft.confusions.push({ name: "", unterschied: "" });
    document.getElementById("confusion-rows").insertAdjacentHTML("beforeend", confusionRowHtml({ name: "", unterschied: "" }, formDraft.confusions.length - 1));
    wireConfusionRemoves();
  });
  wireConfusionRemoves();

  document.getElementById("add-image-btn").addEventListener("click", () => {
    const fileInput = document.getElementById("image-file-input");
    fileInput.onchange = async () => {
      const file = fileInput.files[0];
      if (!file) return;
      const label = prompt("Was zeigt dieses Foto? (z. B. Blatt, Blüte, Wurzel, Habitus, Standort)", "Habitus") || "";
      const addBtn = document.getElementById("add-image-btn");
      addBtn.textContent = "…";
      addBtn.disabled = true;
      try {
        const result = await Plants.uploadPlantImage(formPlantId, file, label);
        formDraft.images = formDraft.images || [];
        formDraft.images.push(result);
        uploadedThisSession.push(result.path);
        refreshImageGrid();
      } catch (e) {
        console.error(e);
        showToast("Bild-Upload fehlgeschlagen.");
      } finally {
        addBtn.textContent = "+";
        addBtn.disabled = false;
        fileInput.value = "";
      }
    };
    fileInput.click();
  });

  wireImageRemoves();

  document.getElementById("cancel-btn").addEventListener("click", () => history.back());
  document.getElementById("cancel-link").addEventListener("click", (e) => { e.preventDefault(); history.back(); });

  document.getElementById("delete-in-form")?.addEventListener("click", async () => {
    if (!confirm("Diese Pflanze wirklich löschen?")) return;
    await Plants.deletePlant(formPlantId);
    showToast("Pflanze gelöscht.");
    navigate("#/pflanzen");
  });

  document.getElementById("plant-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    readFormIntoDraft();
    if (!formDraft.latinName) { showToast("Bitte den botanischen Namen angeben."); return; }
    const saveBtn = document.getElementById("save-btn");
    saveBtn.disabled = true; saveBtn.textContent = "Speichert…";
    try {
      await Plants.savePlant(formPlantId, formDraft, formIsNew);
      showToast("Pflanze gespeichert.");
      navigate(`#/pflanzen/${formPlantId}`);
    } catch (err) {
      console.error(err);
      showToast("Speichern fehlgeschlagen.");
      saveBtn.disabled = false; saveBtn.textContent = "Speichern";
    }
  });
}

function wireConfusionRemoves() {
  document.querySelectorAll("[data-remove-confusion]").forEach(btn => {
    btn.onclick = () => {
      readFormIntoDraft();
      const idx = Number(btn.dataset.removeConfusion);
      formDraft.confusions.splice(idx, 1);
      document.getElementById("confusion-rows").innerHTML = formDraft.confusions.map(confusionRowHtml).join("");
      wireConfusionRemoves();
    };
  });
}

function refreshImageGrid() {
  const grid = document.getElementById("image-grid");
  grid.innerHTML = renderImageTiles() + `<button type="button" class="image-add-tile" id="add-image-btn">+</button>`;
  document.getElementById("add-image-btn").addEventListener("click", () => document.getElementById("image-file-input").click());
  wireImageRemoves();
}

function wireImageRemoves() {
  document.querySelectorAll("[data-remove-image]").forEach(btn => {
    btn.onclick = async () => {
      const idx = Number(btn.dataset.removeImage);
      const img = formDraft.images[idx];
      formDraft.images.splice(idx, 1);
      refreshImageGrid();
      if (img?.path) await Plants.deleteImageFile(img.path);
    };
  });
}

// ----------------------------------------------------------
// Render: Recipe list
// ----------------------------------------------------------
function filteredRecipes() {
  let list = recipes;
  if (searchTerm) {
    const t = searchTerm.toLowerCase();
    list = list.filter(r => {
      const plantNames = (r.linkedPlantIds || []).map(id => plantNameById(id)).join(" ").toLowerCase();
      return (r.name || "").toLowerCase().includes(t) ||
        (r.typ || "").toLowerCase().includes(t) ||
        plantNames.includes(t);
    });
  }
  return list;
}

function plantNameById(id) {
  const p = plants.find(x => x.id === id);
  return p ? (p.germanName || p.latinName) : "";
}

function renderRecipeList() {
  const list = filteredRecipes();
  $view.innerHTML = `
    <div class="section-head">
      <h1>Rezepte</h1>
      <span class="section-count">${list.length} von ${recipes.length} Rezepten</span>
    </div>
    ${list.length === 0 ? `
      <div class="empty-state">
        <h3>Noch keine Rezepte</h3>
        <p>Erfasse Tinkturen, Tees, Salben und mehr — verknüpft mit deinen Pflanzen.</p>
        <button class="btn btn-primary" id="empty-new-recipe">+ Rezept erfassen</button>
      </div>` : `
      <div class="recipe-grid">
        ${list.map(renderRecipeCard).join("")}
      </div>`
    }
  `;
  $view.querySelectorAll(".recipe-card").forEach(el => {
    el.addEventListener("click", () => navigate(`#/rezepte/${el.dataset.id}`));
  });
  document.getElementById("empty-new-recipe")?.addEventListener("click", () => navigate("#/rezepte/neu"));
}

function renderRecipeCard(r) {
  const plantNames = (r.linkedPlantIds || []).map(plantNameById).filter(Boolean);
  return `
    <article class="recipe-card" data-id="${r.id}">
      <div class="recipe-type">${esc(r.typ) || "Rezept"}</div>
      <div class="recipe-name">${esc(r.name) || "Unbenannt"}</div>
      ${plantNames.length ? `<div class="recipe-plants">${esc(plantNames.join(", "))}</div>` : ""}
    </article>
  `;
}

// ----------------------------------------------------------
// Render: Recipe detail
// ----------------------------------------------------------
function renderRecipeDetail(id) {
  const r = recipes.find(x => x.id === id);
  if (!r) { $view.innerHTML = `<p>Rezept nicht gefunden.</p>`; return; }
  const linkedPlants = (r.linkedPlantIds || []).map(pid => plants.find(p => p.id === pid)).filter(Boolean);

  $view.innerHTML = `
    <div class="sheet recipe-sheet">
      <div class="sheet-header">
        <a href="#/rezepte" class="back-link">← Zur Übersicht</a>
        <div class="sheet-actions">
          <button class="btn btn-ghost btn-sm" id="print-btn">Drucken</button>
          <button class="btn btn-ghost btn-sm" id="edit-recipe-btn">Bearbeiten</button>
          <button class="btn btn-danger btn-sm" id="delete-recipe-btn">Löschen</button>
        </div>
      </div>
      <div class="sheet-info" style="padding-top:20px;">
        <span class="sheet-family-badge">${esc(r.typ) || "Rezept"}</span>
        <div class="sheet-title" style="font-style:normal;">${esc(r.name)}</div>
        ${linkedPlants.length ? `<div class="tag-list" style="margin-top:10px;">
          ${linkedPlants.map(p => `<a class="tag-pill" style="text-decoration:none;" href="#/pflanzen/${p.id}">${esc(p.germanName || p.latinName)}</a>`).join("")}
        </div>` : ""}

        ${r.image?.url ? `<div class="sheet-photo-main" style="max-width:340px; margin-top:18px; background-image:url('${esc(r.image.url)}')"></div>` : ""}

        <div class="field-block">
          <h3>Zutaten</h3>
          <div class="scale-control">
            <label for="scale-input">Menge skalieren (Faktor)</label>
            <input type="number" id="scale-input" value="1" min="0.1" step="0.1">
          </div>
          <table class="ingredient-table" id="ingredient-table">
            ${(r.ingredients || []).map(ing => `
              <tr><td class="amt" data-base="${ing.menge || ""}" data-unit="${esc(ing.einheit || "")}">${formatAmount(ing.menge)} ${esc(ing.einheit || "")}</td><td>${esc(ing.zutat)}</td></tr>
            `).join("")}
          </table>
          ${r.ergibt ? `<p style="margin-top:8px; font-size:12.5px; color:var(--ink-soft);">Ergibt ca.: ${esc(r.ergibt)}</p>` : ""}
        </div>

        ${r.zubereitung ? `<div class="field-block"><h3>Zubereitung</h3><p>${esc(r.zubereitung)}</p></div>` : ""}

        <div class="field-grid field-block">
          ${fieldItem("Ziehzeit", r.ziehzeit)}
          ${fieldItem("Haltbarkeit", r.haltbarkeit)}
          ${fieldItem("Lagerung", r.lagerung)}
        </div>

        ${r.anwendung ? `<div class="field-block"><h3>Anwendung / Dosierung</h3><p>${esc(r.anwendung)}</p></div>` : ""}
        ${r.notizen ? `<div class="field-block"><h3>Notizen</h3><p>${esc(r.notizen)}</p></div>` : ""}
      </div>
    </div>
  `;

  document.getElementById("edit-recipe-btn").addEventListener("click", () => navigate(`#/rezepte/${id}/bearbeiten`));
  document.getElementById("print-btn").addEventListener("click", () => window.print());
  document.getElementById("delete-recipe-btn").addEventListener("click", async () => {
    if (!confirm(`„${r.name}" wirklich unwiderruflich löschen?`)) return;
    await Recipes.deleteRecipe(id);
    showToast("Rezept gelöscht.");
    navigate("#/rezepte");
  });
  document.getElementById("scale-input").addEventListener("input", (e) => {
    const factor = parseFloat(e.target.value) || 1;
    document.querySelectorAll("#ingredient-table .amt").forEach(td => {
      const base = parseFloat(td.dataset.base);
      const unit = td.dataset.unit;
      td.textContent = isNaN(base) ? "—" : `${formatAmount(base * factor)} ${unit}`;
    });
  });
}

function formatAmount(n) {
  if (n === undefined || n === null || n === "") return "—";
  const num = Number(n);
  if (isNaN(num)) return n;
  return Math.round(num * 100) / 100;
}

// ----------------------------------------------------------
// Render: Recipe form
// ----------------------------------------------------------
function emptyRecipe() {
  return {
    name: "", typ: "Tinktur", ergibt: "",
    ingredients: [{ menge: "", einheit: "g", zutat: "" }],
    zubereitung: "", ziehzeit: "", haltbarkeit: "", lagerung: "", anwendung: "",
    image: null, linkedPlantIds: [], notizen: "",
  };
}

let recipeDraft = null;
let recipeIsNew = true;
let recipeId = null;

function renderRecipeForm(id) {
  recipeIsNew = !id;
  const existing = id ? recipes.find(r => r.id === id) : null;
  recipeDraft = existing ? JSON.parse(JSON.stringify(existing)) : emptyRecipe();
  if (!recipeDraft.ingredients || !recipeDraft.ingredients.length) recipeDraft.ingredients = [{ menge: "", einheit: "g", zutat: "" }];
  recipeId = id || Recipes.newRecipeId();
  drawRecipeForm();
}

function drawRecipeForm() {
  const d = recipeDraft;
  $view.innerHTML = `
    <div class="sheet form-sheet">
      <div class="sheet-header" style="padding-bottom:20px;">
        <a href="#/rezepte" class="back-link" id="cancel-link">← Abbrechen</a>
        <h2 style="font-size:18px; font-style:italic;">${recipeIsNew ? "Neues Rezept" : "Rezept bearbeiten"}</h2>
      </div>
      <div style="padding: 4px 28px 28px;">
        <form id="recipe-form">
          <div class="form-section">
            <h3>Grunddaten</h3>
            <div class="form-row">
              <div class="field"><label>Name *</label><input type="text" name="name" required value="${esc(d.name)}" placeholder="z. B. Bärlauch-Tinktur"></div>
              <div class="field"><label>Zubereitungsart</label>
                <select name="typ">${RECIPE_TYPES.map(t => `<option ${d.typ === t ? "selected" : ""}>${t}</option>`).join("")}</select>
              </div>
            </div>
            <div class="field"><label>Ergibt (Menge)</label><input type="text" name="ergibt" value="${esc(d.ergibt)}" placeholder="z. B. ca. 200 ml"></div>
          </div>

          <div class="form-section">
            <h3>Zutaten</h3>
            <div id="ingredient-rows">
              ${d.ingredients.map((ing, i) => ingredientRowHtml(ing, i)).join("")}
            </div>
            <button type="button" class="add-row-btn" id="add-ingredient">+ Zutat hinzufügen</button>
          </div>

          <div class="form-section">
            <h3>Zubereitung</h3>
            <div class="field" style="margin-bottom:14px;"><label>Schritt-für-Schritt-Anleitung</label><textarea name="zubereitung" style="min-height:110px;">${esc(d.zubereitung)}</textarea></div>
            <div class="form-row three">
              <div class="field"><label>Ziehzeit</label><input type="text" name="ziehzeit" value="${esc(d.ziehzeit)}" placeholder="z. B. 4 Wochen"></div>
              <div class="field"><label>Haltbarkeit</label><input type="text" name="haltbarkeit" value="${esc(d.haltbarkeit)}" placeholder="z. B. 2 Jahre"></div>
              <div class="field"><label>Lagerung</label><input type="text" name="lagerung" value="${esc(d.lagerung)}" placeholder="z. B. kühl, dunkel"></div>
            </div>
            <div class="field"><label>Anwendung / Dosierung</label><textarea name="anwendung">${esc(d.anwendung)}</textarea></div>
          </div>

          <div class="form-section">
            <h3>Foto</h3>
            <div class="image-upload-grid" id="recipe-image-grid">
              ${d.image?.url ? `<div class="image-upload-tile" style="background-image:url('${esc(d.image.url)}')"><button type="button" class="img-remove" id="remove-recipe-image">×</button></div>` : `<button type="button" class="image-add-tile" id="add-recipe-image-btn">+</button>`}
            </div>
            <input type="file" id="recipe-image-input" accept="image/*" class="visually-hidden">
          </div>

          <div class="form-section">
            <h3>Verknüpfte Pflanzen</h3>
            <div class="checkbox-grid">
              ${plants.length === 0 ? `<span style="color:var(--ink-faint); font-size:13px;">Noch keine Pflanzen erfasst.</span>` :
                plants.map(p => `
                  <label class="checkbox-item">
                    <input type="checkbox" value="${p.id}" ${d.linkedPlantIds?.includes(p.id) ? "checked" : ""} class="plant-link-checkbox">
                    ${esc(p.germanName || p.latinName)}
                  </label>
                `).join("")}
            </div>
          </div>

          <div class="form-section">
            <h3>Notizen</h3>
            <div class="field"><textarea name="notizen">${esc(d.notizen)}</textarea></div>
          </div>

          <div class="form-footer">
            <div>${!recipeIsNew ? `<button type="button" class="btn btn-danger" id="delete-in-form">Löschen</button>` : ""}</div>
            <div class="form-footer-right">
              <button type="button" class="btn btn-ghost" id="cancel-btn">Abbrechen</button>
              <button type="submit" class="btn btn-primary" id="save-btn">Speichern</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `;
  wireRecipeForm();
}

function ingredientRowHtml(ing, i) {
  return `
    <div class="repeat-row" data-idx="${i}">
      <div class="field" style="max-width:100px;"><input type="number" step="any" placeholder="Menge" data-ing="menge" value="${ing.menge ?? ""}"></div>
      <div class="field" style="max-width:110px;">
        <select data-ing="einheit">
          ${UNITS.map(u => `<option ${ing.einheit === u ? "selected" : ""}>${u}</option>`).join("")}
        </select>
      </div>
      <div class="field"><input type="text" placeholder="Zutat" data-ing="zutat" value="${esc(ing.zutat)}"></div>
      <button type="button" class="repeat-remove" data-remove-ingredient="${i}" title="Entfernen">×</button>
    </div>
  `;
}

function readRecipeFormIntoDraft() {
  const form = document.getElementById("recipe-form");
  const fd = new FormData(form);
  const d = recipeDraft;
  d.name = fd.get("name")?.trim() || "";
  d.typ = fd.get("typ") || "Sonstiges";
  d.ergibt = fd.get("ergibt")?.trim() || "";
  d.zubereitung = fd.get("zubereitung")?.trim() || "";
  d.ziehzeit = fd.get("ziehzeit")?.trim() || "";
  d.haltbarkeit = fd.get("haltbarkeit")?.trim() || "";
  d.lagerung = fd.get("lagerung")?.trim() || "";
  d.anwendung = fd.get("anwendung")?.trim() || "";
  d.notizen = fd.get("notizen")?.trim() || "";

  d.ingredients = [...document.querySelectorAll("#ingredient-rows .repeat-row")].map(row => ({
    menge: row.querySelector('[data-ing="menge"]').value,
    einheit: row.querySelector('[data-ing="einheit"]').value,
    zutat: row.querySelector('[data-ing="zutat"]').value.trim(),
  })).filter(i => i.zutat || i.menge);

  d.linkedPlantIds = [...document.querySelectorAll(".plant-link-checkbox:checked")].map(cb => cb.value);
}

function wireRecipeForm() {
  document.getElementById("add-ingredient").addEventListener("click", () => {
    recipeDraft.ingredients.push({ menge: "", einheit: "g", zutat: "" });
    document.getElementById("ingredient-rows").insertAdjacentHTML("beforeend", ingredientRowHtml({ menge: "", einheit: "g", zutat: "" }, recipeDraft.ingredients.length - 1));
    wireIngredientRemoves();
  });
  wireIngredientRemoves();

  wireRecipeImageControls();

  document.getElementById("cancel-btn").addEventListener("click", () => history.back());
  document.getElementById("cancel-link").addEventListener("click", (e) => { e.preventDefault(); history.back(); });

  document.getElementById("delete-in-form")?.addEventListener("click", async () => {
    if (!confirm("Dieses Rezept wirklich löschen?")) return;
    await Recipes.deleteRecipe(recipeId);
    showToast("Rezept gelöscht.");
    navigate("#/rezepte");
  });

  document.getElementById("recipe-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    readRecipeFormIntoDraft();
    if (!recipeDraft.name) { showToast("Bitte einen Namen angeben."); return; }
    const saveBtn = document.getElementById("save-btn");
    saveBtn.disabled = true; saveBtn.textContent = "Speichert…";
    try {
      await Recipes.saveRecipe(recipeId, recipeDraft, recipeIsNew);
      showToast("Rezept gespeichert.");
      navigate(`#/rezepte/${recipeId}`);
    } catch (err) {
      console.error(err);
      showToast("Speichern fehlgeschlagen.");
      saveBtn.disabled = false; saveBtn.textContent = "Speichern";
    }
  });
}

function wireRecipeImageControls() {
  const grid = document.getElementById("recipe-image-grid");

  const showAddTile = () => {
    grid.innerHTML = `<button type="button" class="image-add-tile" id="add-recipe-image-btn">+</button>`;
    document.getElementById("add-recipe-image-btn").addEventListener("click", () => document.getElementById("recipe-image-input").click());
  };

  const showImageTile = (url) => {
    grid.innerHTML = `<div class="image-upload-tile" style="background-image:url('${esc(url)}')"><button type="button" class="img-remove" id="remove-recipe-image">×</button></div>`;
    document.getElementById("remove-recipe-image").addEventListener("click", async () => {
      const path = recipeDraft.image?.path;
      recipeDraft.image = null;
      showAddTile();
      if (path) await Recipes.deleteImageFile(path);
    });
  };

  if (recipeDraft.image?.url) showImageTile(recipeDraft.image.url);
  else showAddTile();

  document.getElementById("recipe-image-input").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    grid.innerHTML = `<div class="image-add-tile">…</div>`;
    try {
      const result = await Recipes.uploadRecipeImage(recipeId, file);
      recipeDraft.image = result;
      showImageTile(result.url);
    } catch (err) {
      console.error(err);
      showToast("Bild-Upload fehlgeschlagen.");
      showAddTile();
    } finally {
      e.target.value = "";
    }
  });
}

function wireIngredientRemoves() {
  document.querySelectorAll("[data-remove-ingredient]").forEach(btn => {
    btn.onclick = () => {
      readRecipeFormIntoDraft();
      const idx = Number(btn.dataset.removeIngredient);
      recipeDraft.ingredients.splice(idx, 1);
      if (!recipeDraft.ingredients.length) recipeDraft.ingredients.push({ menge: "", einheit: "g", zutat: "" });
      document.getElementById("ingredient-rows").innerHTML = recipeDraft.ingredients.map(ingredientRowHtml).join("");
      wireIngredientRemoves();
    };
  });
}

// ----------------------------------------------------------
// Export
// ----------------------------------------------------------
function serializeForExport(list) {
  return list.map(item => {
    const clone = { ...item };
    for (const key of ["createdAt", "updatedAt"]) {
      if (clone[key]?.toDate) clone[key] = clone[key].toDate().toISOString();
    }
    return clone;
  });
}

function exportData() {
  const data = { exportedAt: new Date().toISOString(), plants: serializeForExport(plants), recipes: serializeForExport(recipes) };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `herbarium-export-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Export heruntergeladen.");
}

// ----------------------------------------------------------
// Data subscriptions
// ----------------------------------------------------------
function subscribeData() {
  unsubPlants = Plants.watchPlants((data) => {
    plants = data;
    if (currentSection() === "pflanzen") router();
  });
  unsubRecipes = Recipes.watchRecipes((data) => {
    recipes = data;
    if (currentSection() === "rezepte") router();
  });
}

function unsubscribeData() {
  unsubPlants?.(); unsubRecipes?.();
  plants = []; recipes = [];
}

// ----------------------------------------------------------
// Auth wiring — läuft unsichtbar im Hintergrund, kein Login-UI
// ----------------------------------------------------------
$view.innerHTML = `<div class="loading-row">Verbinde …</div>`;

watchAuth((user) => {
  if (user) {
    subscribeData();
    router();
  } else {
    ensureSignedIn().catch((err) => {
      console.error("Anonyme Anmeldung fehlgeschlagen:", err);
      $view.innerHTML = `<div class="loading-row">Verbindung zu Firebase fehlgeschlagen. Bitte Seite neu laden.</div>`;
    });
  }
});

// ----------------------------------------------------------
// Global UI wiring
// ----------------------------------------------------------
window.addEventListener("hashchange", router);

$searchInput.addEventListener("input", (e) => {
  searchTerm = e.target.value.trim();
  if (currentSection() === "pflanzen") renderPlantList();
  else if (currentSection() === "rezepte") renderRecipeList();
});

$newBtn.addEventListener("click", () => {
  if (currentSection() === "rezepte") navigate("#/rezepte/neu");
  else navigate("#/pflanzen/neu");
});

$exportBtn.addEventListener("click", exportData);
