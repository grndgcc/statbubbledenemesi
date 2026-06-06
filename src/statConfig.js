export const EXTENSION_ID = "com.grondgecici.stat-bubbles";
export const ITEM_STATS_KEY = `${EXTENSION_ID}/stats`;
export const SCENE_DB_KEY = `${EXTENSION_ID}/scene-db`;
export const TOOL_MODE_ID = `${EXTENSION_ID}/hover-mode`;
export const LOCAL_LABEL_KEY = `${EXTENSION_ID}/local-label`;

export const STATS = [
  { key: "str", label: "STR" },
  { key: "dex", label: "DEX" },
  { key: "con", label: "CON" },
  { key: "wis", label: "WIS" },
  { key: "int", label: "INT" },
  { key: "cha", label: "CHA" },
  { key: "diplomacy", label: "Diplomacy" },
  { key: "martial", label: "Martial" },
  { key: "economy", label: "Economy" },
  { key: "intrigue", label: "Intrigue" },
  { key: "learning", label: "Learning" },
  { key: "prowess", label: "Prowess" },
  { key: "prestige", label: "Prestige" },
  { key: "appearance", label: "Appearance" },
  { key: "magicItem", label: "Magic Item" }
];

export const DEFAULT_STATS = Object.fromEntries(STATS.map((stat) => [stat.key, ""]));

export function normalizeStats(input) {
  const output = { ...DEFAULT_STATS };
  if (!input || typeof input !== "object") return output;

  // Support the misspelling in the request so older JSON imports still work.
  const aliases = {
    appereance: "appearance",
    Appereance: "appearance",
    appearance: "appearance",
    Appearance: "appearance",
    "Magic Item": "magicItem",
    magic_item: "magicItem"
  };

  for (const stat of STATS) {
    const raw = input[stat.key] ?? input[stat.label] ?? input[stat.label.toUpperCase()];
    if (raw !== undefined && raw !== null) output[stat.key] = String(raw);
  }

  for (const [alias, canonical] of Object.entries(aliases)) {
    const raw = input[alias];
    if (raw !== undefined && raw !== null) output[canonical] = String(raw);
  }

  return output;
}

export function hasAnyStat(stats) {
  return STATS.some((stat) => String(stats?.[stat.key] ?? "").trim() !== "");
}

export function getItemStats(item) {
  return normalizeStats(item?.metadata?.[ITEM_STATS_KEY]);
}

export function sceneDbToMap(sceneDb) {
  const map = new Map();
  if (!sceneDb || typeof sceneDb !== "object" || !Array.isArray(sceneDb.tokens)) return map;
  for (const token of sceneDb.tokens) {
    const stats = normalizeStats(token.stats);
    if (token.id) map.set(`id:${token.id}`, stats);
    if (token.name) map.set(`name:${token.name}`, stats);
  }
  return map;
}

export function getStatsFromSceneDb(sceneDb, item) {
  const map = sceneDbToMap(sceneDb);
  return map.get(`id:${item.id}`) ?? map.get(`name:${item.name}`) ?? normalizeStats();
}

export function statsToDisplay(stats) {
  return STATS
    .map((stat) => ({ ...stat, value: String(stats?.[stat.key] ?? "").trim() }))
    .filter((stat) => stat.value !== "");
}
