import OBR, { buildLabel } from "@owlbear-rodeo/sdk";
import {
  EXTENSION_ID,
  ITEM_STATS_KEY,
  SCENE_DB_KEY,
  TOOL_MODE_ID,
  LOCAL_LABEL_KEY,
  STATS,
  getItemStats,
  getStatsFromSceneDb,
  hasAnyStat,
  statsToDisplay
} from "./statConfig.js";

let currentTargetId = null;
let currentLocalIds = [];
let lastMoveRun = 0;
const MOVE_THROTTLE_MS = 80;

function iconUrl() {
  return new URL("/icon.svg", import.meta.url).toString();
}

async function clearBubbles() {
  currentTargetId = null;
  if (currentLocalIds.length > 0) {
    const ids = [...currentLocalIds];
    currentLocalIds = [];
    try {
      await OBR.scene.local.deleteItems(ids);
    } catch (error) {
      console.warn("Stat Bubbles: local labels could not be removed", error);
    }
  }
}

function readItemOrSceneStats(item, sceneDb) {
  const itemStats = getItemStats(item);
  if (hasAnyStat(itemStats)) return itemStats;
  return getStatsFromSceneDb(sceneDb, item);
}

function makeBubbleText(stat) {
  const shortLabels = new Set(["STR", "DEX", "CON", "WIS", "INT", "CHA"]);
  return shortLabels.has(stat.label) ? `${stat.label}: ${stat.value}` : `${stat.label} ${stat.value}`;
}

async function showBubblesForTarget(target) {
  if (!target || target.transformer) {
    await clearBubbles();
    return;
  }

  const item = target;
  const sceneMetadata = await OBR.scene.getMetadata();
  const stats = readItemOrSceneStats(item, sceneMetadata?.[SCENE_DB_KEY]);
  const displayStats = statsToDisplay(stats);

  if (displayStats.length === 0) {
    await clearBubbles();
    return;
  }

  const targetKey = `${item.id}:${JSON.stringify(stats)}`;
  if (currentTargetId === targetKey) return;
  await clearBubbles();
  currentTargetId = targetKey;

  let bounds;
  try {
    bounds = await OBR.scene.items.getItemBounds([item.id]);
  } catch (error) {
    console.warn("Stat Bubbles: could not read token bounds", error);
    return;
  }

  const columns = 5;
  const horizontalGap = 58;
  const verticalGap = 24;
  const rowCount = Math.ceil(displayStats.length / columns);
  const startX = bounds.center.x - ((columns - 1) * horizontalGap) / 2;
  const startY = bounds.min.y - 18 - rowCount * verticalGap;

  const labels = displayStats.map((stat, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const id = `${EXTENSION_ID}/local/${crypto.randomUUID()}`;
    currentLocalIds.push(id);

    return buildLabel()
      .id(id)
      .name(`Stat Bubble ${stat.label}`)
      .plainText(makeBubbleText(stat))
      .width("AUTO")
      .height("AUTO")
      .padding(4)
      .fontFamily("Inter, Arial, sans-serif")
      .fontSize(13)
      .fontWeight(800)
      .lineHeight(1)
      .textAlign("CENTER")
      .textAlignVertical("MIDDLE")
      .fillColor("#ffffff")
      .fillOpacity(1)
      .strokeColor("#000000")
      .strokeOpacity(0.35)
      .strokeWidth(1)
      .backgroundColor("#111827")
      .backgroundOpacity(0.88)
      .cornerRadius(8)
      .position({ x: startX + column * horizontalGap, y: startY + row * verticalGap })
      .layer("POPOVER")
      .attachedTo(item.id)
      .locked(true)
      .disableHit(true)
      .disableAutoZIndex(true)
      .metadata({ [LOCAL_LABEL_KEY]: true })
      .build();
  });

  await OBR.scene.local.addItems(labels);
}

async function onToolMove(_, event) {
  const now = performance.now();
  if (now - lastMoveRun < MOVE_THROTTLE_MS) return;
  lastMoveRun = now;

  if (!event?.target || event.transformer) {
    await clearBubbles();
    return;
  }

  // Prefer character-layer tokens, but allow any item that has saved stats.
  const target = event.target;
  const hasItemStats = hasAnyStat(target.metadata?.[ITEM_STATS_KEY]);
  if (target.layer !== "CHARACTER" && !hasItemStats) {
    await clearBubbles();
    return;
  }

  await showBubblesForTarget(target);
}

async function registerHoverMode() {
  try {
    await OBR.tool.createMode({
      id: TOOL_MODE_ID,
      icons: [
        {
          icon: iconUrl(),
          label: "Stat Bubble Hover",
          filter: { activeTools: ["rodeo.owlbear.tools/pointer"] }
        }
      ],
      onToolMove,
      onToolClick() {
        return true;
      },
      onToolDoubleClick() {
        return true;
      },
      preventDrag() {
        return true;
      },
      onDeactivate: clearBubbles
    });
  } catch (error) {
    console.warn("Stat Bubbles: hover mode could not be registered", error);
  }
}

async function registerContextMenu() {
  try {
    OBR.contextMenu.create({
      id: `${EXTENSION_ID}/open-editor`,
      icons: [
        {
          icon: iconUrl(),
          label: "Edit Stat Bubbles",
          filter: {
            roles: ["GM"],
            every: [{ key: "layer", value: "CHARACTER" }]
          }
        }
      ],
      async onClick(context) {
        const ids = context.items?.map((item) => item.id) ?? [];
        if (ids.length > 0) {
          await OBR.player.select(ids, true);
          await OBR.action.open();
        }
      }
    });
  } catch (error) {
    console.warn("Stat Bubbles: context menu could not be registered", error);
  }
}

function initWhenSceneReady() {
  OBR.scene.onReadyChange(async (ready) => {
    if (!ready) await clearBubbles();
  });
}

OBR.onReady(async () => {
  await registerHoverMode();
  await registerContextMenu();
  initWhenSceneReady();
});
