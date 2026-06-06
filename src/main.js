import OBR from "@owlbear-rodeo/sdk";
import {
  ITEM_STATS_KEY,
  SCENE_DB_KEY,
  TOOL_MODE_ID,
  STATS,
  DEFAULT_STATS,
  normalizeStats,
  hasAnyStat,
  getItemStats
} from "./statConfig.js";
import "./styles.css";

const app = document.querySelector("#app");
let selectedItems = [];
let formStats = { ...DEFAULT_STATS };
let role = "PLAYER";
let sceneReady = false;
let statusMessage = "";
let importText = "";

function setStatus(message) {
  statusMessage = message;
  render();
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function selectedTitle() {
  if (!sceneReady) return "Sahne açık değil";
  if (selectedItems.length === 0) return "Token seçilmedi";
  if (selectedItems.length === 1) return selectedItems[0].name || "İsimsiz token";
  return `${selectedItems.length} token seçildi`;
}

async function refreshSelection() {
  if (!OBR.isAvailable || !sceneReady) {
    selectedItems = [];
    render();
    return;
  }

  const selection = (await OBR.player.getSelection()) ?? [];
  if (selection.length === 0) {
    selectedItems = [];
    formStats = { ...DEFAULT_STATS };
    render();
    return;
  }

  selectedItems = await OBR.scene.items.getItems(selection);
  const first = selectedItems[0];
  formStats = first ? getItemStats(first) : { ...DEFAULT_STATS };
  render();
}

async function updateSelectedStats(stats) {
  if (selectedItems.length === 0) {
    setStatus("Önce bir karakter/token seç.");
    return;
  }

  const normalized = normalizeStats(stats);
  await OBR.scene.items.updateItems(selectedItems, (items) => {
    for (const item of items) {
      item.metadata = item.metadata ?? {};
      item.metadata[ITEM_STATS_KEY] = normalized;
    }
  });
  formStats = normalized;
  await syncSceneDatabase(false);
  setStatus("Statlar seçili token metadata’sına kaydedildi.");
}

async function clearSelectedStats() {
  if (selectedItems.length === 0) {
    setStatus("Önce bir karakter/token seç.");
    return;
  }

  await OBR.scene.items.updateItems(selectedItems, (items) => {
    for (const item of items) {
      if (item.metadata) delete item.metadata[ITEM_STATS_KEY];
    }
  });
  formStats = { ...DEFAULT_STATS };
  await syncSceneDatabase(false);
  setStatus("Seçili token statları temizlendi.");
}

function buildExportPayload(items) {
  const tokens = items
    .map((item) => ({
      id: item.id,
      name: item.name ?? "",
      layer: item.layer,
      stats: getItemStats(item)
    }))
    .filter((token) => hasAnyStat(token.stats));

  return {
    version: 1,
    extension: "Stat Bubbles",
    exportedAt: new Date().toISOString(),
    tokenCount: tokens.length,
    tokens
  };
}

async function getCharacterItems() {
  return await OBR.scene.items.getItems((item) => item.layer === "CHARACTER" || hasAnyStat(item.metadata?.[ITEM_STATS_KEY]));
}

async function exportSceneJson() {
  const items = await getCharacterItems();
  const payload = buildExportPayload(items);
  downloadJson(`stat-bubbles-${new Date().toISOString().slice(0, 10)}.json`, payload);
  setStatus(`${payload.tokenCount} token JSON olarak indirildi.`);
}

async function syncSceneDatabase(showStatus = true) {
  const items = await getCharacterItems();
  const payload = buildExportPayload(items);
  await OBR.scene.setMetadata({ [SCENE_DB_KEY]: payload });
  if (showStatus) setStatus(`${payload.tokenCount} token Owlbear sahne metadata veritabanına kaydedildi.`);
  return payload;
}

function parseImportPayload(raw) {
  const data = JSON.parse(raw);
  if (Array.isArray(data)) return { version: 1, tokens: data };
  if (Array.isArray(data.tokens)) return data;
  if (data.stats && (data.id || data.name)) return { version: 1, tokens: [data] };
  throw new Error("JSON içinde tokens dizisi bulunamadı.");
}

async function importJson(raw) {
  const data = parseImportPayload(raw);
  const allItems = await getCharacterItems();
  const byId = new Map(allItems.map((item) => [item.id, item]));
  const byName = new Map(allItems.map((item) => [item.name, item]));
  const statsByItemId = new Map();
  const itemsToUpdate = [];

  for (const token of data.tokens) {
    const item = (token.id && byId.get(token.id)) || (token.name && byName.get(token.name));
    if (!item) continue;
    const stats = normalizeStats(token.stats ?? token);
    statsByItemId.set(item.id, stats);
    itemsToUpdate.push(item);
  }

  if (itemsToUpdate.length === 0) {
    setStatus("İçe aktarılacak eşleşen token bulunamadı. JSON’daki id veya name, sahnedeki token ile aynı olmalı.");
    return;
  }

  await OBR.scene.items.updateItems(itemsToUpdate, (items) => {
    for (const item of items) {
      item.metadata = item.metadata ?? {};
      item.metadata[ITEM_STATS_KEY] = statsByItemId.get(item.id) ?? { ...DEFAULT_STATS };
    }
  });
  await syncSceneDatabase(false);
  await refreshSelection();
  setStatus(`${itemsToUpdate.length} token JSON’dan içe aktarıldı.`);
}

async function loadImportFile(file) {
  if (!file) return;
  importText = await file.text();
  render();
}

function formFields() {
  return STATS.map((stat) => `
    <label class="field">
      <span>${stat.label}</span>
      <input
        data-stat-key="${stat.key}"
        value="${String(formStats[stat.key] ?? "").replaceAll('"', '&quot;')}"
        placeholder="-"
        ${role !== "GM" ? "disabled" : ""}
      />
    </label>
  `).join("");
}

function render() {
  app.innerHTML = `
    <section class="panel">
      <header class="header">
        <div>
          <h1>Stat Bubbles</h1>
          <p>STR/DEX/CON ve yönetim statlarını token hover baloncuğu olarak gösterir.</p>
        </div>
      </header>

      <div class="notice ${OBR.isAvailable ? "" : "warning"}">
        ${OBR.isAvailable
          ? `Durum: ${sceneReady ? "sahne hazır" : "sahne bekleniyor"}. Rol: ${role}.`
          : "Bu panel Owlbear Rodeo içinde çalışacak şekilde tasarlandı. Yerel test için manifest’i Owlbear profilinden ekle."}
      </div>

      <section class="card">
        <div class="card-title">
          <strong>${selectedTitle()}</strong>
          <button id="refresh" type="button">Yenile</button>
        </div>
        <p class="muted">Hover baloncuğunu görmek için Pointer aracındaki <strong>Stat Bubble Hover</strong> modunu seç.</p>
        <div class="grid">
          ${formFields()}
        </div>
        <div class="actions">
          <button id="save" type="button" ${role !== "GM" || selectedItems.length === 0 ? "disabled" : ""}>Seçili token’a kaydet</button>
          <button id="clear" type="button" ${role !== "GM" || selectedItems.length === 0 ? "disabled" : ""}>Statları sil</button>
        </div>
      </section>

      <section class="card">
        <h2>Session yedekleme</h2>
        <p class="muted">Veriler token metadata’sına yazılır. Ek güvenlik için GM her session sonunda JSON indirebilir veya sahne metadata veritabanını güncelleyebilir.</p>
        <div class="actions stacked">
          <button id="export" type="button" ${!sceneReady ? "disabled" : ""}>JSON indir</button>
          <button id="sync" type="button" ${role !== "GM" || !sceneReady ? "disabled" : ""}>Owlbear sahne metadata DB’ye kaydet</button>
        </div>
      </section>

      <section class="card">
        <h2>JSON içe aktar</h2>
        <input id="import-file" type="file" accept="application/json,.json" ${role !== "GM" ? "disabled" : ""} />
        <textarea id="import-text" placeholder="JSON’u buraya yapıştır..." ${role !== "GM" ? "disabled" : ""}>${importText}</textarea>
        <button id="import" type="button" ${role !== "GM" || !sceneReady ? "disabled" : ""}>JSON’u içe aktar</button>
      </section>

      <section class="card help">
        <h2>GitHub yayınlama</h2>
        <ol>
          <li><code>npm install</code></li>
          <li><code>npm run build</code></li>
          <li><code>dist/</code> klasörünü GitHub Pages’e yayınla.</li>
          <li>Owlbear profilinde manifest URL’si olarak <code>https://KULLANICI.github.io/REPO/manifest.json</code> ekle.</li>
        </ol>
      </section>

      ${statusMessage ? `<div class="status">${statusMessage}</div>` : ""}
    </section>
  `;

  app.querySelectorAll("input[data-stat-key]").forEach((input) => {
    input.addEventListener("input", (event) => {
      formStats[event.target.dataset.statKey] = event.target.value;
    });
  });

  app.querySelector("#refresh")?.addEventListener("click", refreshSelection);
  app.querySelector("#save")?.addEventListener("click", () => updateSelectedStats(formStats));
  app.querySelector("#clear")?.addEventListener("click", clearSelectedStats);
  app.querySelector("#export")?.addEventListener("click", exportSceneJson);
  app.querySelector("#sync")?.addEventListener("click", () => syncSceneDatabase(true));
  app.querySelector("#import-file")?.addEventListener("change", (event) => loadImportFile(event.target.files?.[0]));
  app.querySelector("#import-text")?.addEventListener("input", (event) => {
    importText = event.target.value;
  });
  app.querySelector("#import")?.addEventListener("click", async () => {
    try {
      await importJson(importText);
    } catch (error) {
      setStatus(`JSON içe aktarılamadı: ${error.message}`);
    }
  });
}

async function init() {
  render();

  if (!OBR.isAvailable) return;

  await OBR.onReady(async () => {
    role = await OBR.player.getRole();
    sceneReady = await OBR.scene.isReady();

    OBR.player.onChange(refreshSelection);
    OBR.scene.onReadyChange(async (ready) => {
      sceneReady = ready;
      await refreshSelection();
    });

    OBR.action.setBadgeText(undefined);
    await refreshSelection();
  });
}

init();
