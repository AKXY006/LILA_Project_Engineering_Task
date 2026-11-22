#!/usr/bin/env node
/**
 * LILA BLACK — Parquet to static JSON pipeline.
 *
 * Reads the raw .nakama-0 parquet files and produces the compact files the
 * Next.js app serves from /public/data. Keeping this offline (instead of an
 * always-on API) makes the visualization cheap to host and instant to open.
 *
 * Usage:
 *   node build-data.mjs
 *   node build-data.mjs --data "D:/player_data/player_data"
 *   DATA_DIR=/path/to/player_data node build-data.mjs
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parquetReadObjects } from "hyparquet";
import { compressors } from "hyparquet-compressors";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

function cliArg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const DEFAULT_DATA_DIR = path.join(REPO_ROOT, "..", "player_data");
const DATA_DIR = path.resolve(
  cliArg(
    "data",
    process.env.DATA_DIR ||
      (fs.existsSync(DEFAULT_DATA_DIR) ? DEFAULT_DATA_DIR : path.join(REPO_ROOT, "player_data"))
  )
);
const PUBLIC_DIR = path.resolve(cliArg("out", process.env.OUT_DIR || path.join(REPO_ROOT, "frontend", "public")));
const DATA_DIR_OUT = path.join(PUBLIC_DIR, "data");
const MATCH_DIR_OUT = path.join(DATA_DIR_OUT, "matches");
const HEATMAP_DIR_OUT = path.join(DATA_DIR_OUT, "heatmaps");
const MINIMAP_SRC = path.join(DATA_DIR, "minimaps");
const MINIMAP_DEST = path.join(PUBLIC_DIR, "minimaps");

const MAPS = {
  AmbroseValley: {
    id: "AmbroseValley",
    name: "Ambrose Valley",
    scale: 900,
    originX: -370,
    originZ: -473,
    image: "minimaps/AmbroseValley_Minimap.webp",
    minimapFile: "AmbroseValley_Minimap.png",
    outputFile: "AmbroseValley_Minimap.webp",
  },
  GrandRift: {
    id: "GrandRift",
    name: "Grand Rift",
    scale: 581,
    originX: -290,
    originZ: -290,
    image: "minimaps/GrandRift_Minimap.webp",
    minimapFile: "GrandRift_Minimap.png",
    outputFile: "GrandRift_Minimap.webp",
  },
  Lockdown: {
    id: "Lockdown",
    name: "Lockdown",
    scale: 1000,
    originX: -500,
    originZ: -500,
    image: "minimaps/Lockdown_Minimap.webp",
    minimapFile: "Lockdown_Minimap.jpg",
    outputFile: "Lockdown_Minimap.webp",
  },
};

const POSITION_EVENTS = new Set(["Position", "BotPosition"]);
const EVENT_TYPES = ["Kill", "Killed", "BotKill", "BotKilled", "KilledByStorm", "Loot"];
const HEATMAP_TYPES = ["traffic", "human_traffic", "kills", "deaths", "storm_deaths", "loot"];
const EVENT_HEATMAPS = {
  Position: ["traffic", "human_traffic"],
  BotPosition: ["traffic"],
  Kill: ["kills"],
  BotKill: ["kills"],
  Killed: ["deaths"],
  BotKilled: ["deaths"],
  KilledByStorm: ["deaths", "storm_deaths"],
  Loot: ["loot"],
};
const GRID = 64;
const SIGMA = 1.8;
const TOP_CELLS = 6;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value, places = 1) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

function isBotId(userId) {
  return /^\d+$/.test(String(userId));
}

function normaliseEvent(value) {
  if (typeof value === "string") return value;
  if (value instanceof Uint8Array) return Buffer.from(value).toString("utf8");
  if (value instanceof ArrayBuffer) return Buffer.from(new Uint8Array(value)).toString("utf8");
  return String(value);
}

/** World (x, z) -> minimap pixel (1024x1024), exactly as documented in the data README. */
function worldToPixel(x, z, mapId) {
  const map = MAPS[mapId];
  if (!map || !Number.isFinite(x) || !Number.isFinite(z)) return null;
  const u = (x - map.originX) / map.scale;
  const v = (z - map.originZ) / map.scale;
  return [u * 1024, (1 - v) * 1024];
}

function gridCell(pixel) {
  return [
    clamp(Math.floor((pixel[0] / 1024) * GRID), 0, GRID - 1),
    clamp(Math.floor((pixel[1] / 1024) * GRID), 0, GRID - 1),
  ];
}

function gaussianKernel(sigma) {
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const kernel = [];
  let sum = 0;
  for (let i = -radius; i <= radius; i += 1) {
    const value = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel.push(value);
    sum += value;
  }
  return kernel.map((value) => value / sum);
}

/** Separable Gaussian blur with edge clamping. */
function gaussianBlur(source, size, sigma) {
  const kernel = gaussianKernel(sigma);
  const radius = (kernel.length - 1) / 2;
  const horizontal = new Float64Array(size * size);
  const output = new Float64Array(size * size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let value = 0;
      for (let k = -radius; k <= radius; k += 1) {
        const sx = clamp(x + k, 0, size - 1);
        value += source[y * size + sx] * kernel[k + radius];
      }
      horizontal[y * size + x] = value;
    }
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let value = 0;
      for (let k = -radius; k <= radius; k += 1) {
        const sy = clamp(y + k, 0, size - 1);
        value += horizontal[sy * size + x] * kernel[k + radius];
      }
      output[y * size + x] = value;
    }
  }

  return output;
}

function quadrantOf(x, y) {
  return `${y < 512 ? "N" : "S"}${x < 512 ? "W" : "E"}`;
}

function emptyQuadrants() {
  return { NW: 0, NE: 0, SW: 0, SE: 0 };
}

function sumQuadrants(grid) {
  const totals = emptyQuadrants();
  const half = GRID / 2;
  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      const value = grid[y * GRID + x];
      if (!value) continue;
      totals[`${y < half ? "N" : "S"}${x < half ? "W" : "E"}`] += value;
    }
  }
  return totals;
}

function topCells(grid, total) {
  const cells = [];
  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      const count = grid[y * GRID + x];
      if (count > 0) cells.push({ x, y, count });
    }
  }
  cells.sort((a, b) => b.count - a.count);
  return cells.slice(0, TOP_CELLS).map((cell) => ({
    cell: `${cell.x},${cell.y}`,
    x: round((cell.x + 0.5) * (1024 / GRID)),
    y: round((cell.y + 0.5) * (1024 / GRID)),
    count: cell.count,
    share: total > 0 ? round((cell.count / total) * 100, 1) : 0,
  }));
}

async function readParquet(filePath) {
  const buffer = await fsp.readFile(filePath);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  return parquetReadObjects({ file: arrayBuffer, compressors });
}

async function main() {
  const startedAt = Date.now();
  if (!fs.existsSync(DATA_DIR)) {
    throw new Error(`Data directory not found: ${DATA_DIR}\nSet DATA_DIR or pass --data <path>.`);
  }

  const dayFolders = fs
    .readdirSync(DATA_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^February_\d+$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  if (dayFolders.length === 0) {
    throw new Error(`No February_* folders found in ${DATA_DIR}`);
  }

  console.log(`Reading parquet files from ${DATA_DIR}`);
  const rows = [];
  let fileCount = 0;

  for (const day of dayFolders) {
    const folder = path.join(DATA_DIR, day);
    const files = fs
      .readdirSync(folder)
      .filter((name) => !name.startsWith(".") && !name.endsWith(".md"))
      .sort();

    for (const name of files) {
      try {
        const records = await readParquet(path.join(folder, name));
        fileCount += 1;
        for (const record of records) {
          const event = normaliseEvent(record.event);
          const rawTimestamp = record.ts instanceof Date ? record.ts.getTime() : Number(record.ts);
          const x = Number(record.x);
          const z = Number(record.z);
          const mapId = String(record.map_id);
          if (!MAPS[mapId] || !Number.isFinite(rawTimestamp) || !Number.isFinite(x) || !Number.isFinite(z)) {
            continue;
          }
          rows.push({
            userId: String(record.user_id),
            matchId: String(record.match_id).replace(/\.nakama-0$/, ""),
            mapId,
            x,
            y: Number(record.y),
            z,
            // The parquet field is typed TIMESTAMP_MILLIS, but production values
            // are Unix seconds. Multiplying by 1000 restores the real wall clock.
            timestampMs: rawTimestamp * 1000,
            event,
            day,
          });
        }
      } catch (error) {
        console.warn(`  ! skipped ${day}/${name}: ${error.message}`);
      }
    }
    console.log(`  ${day}: ${files.length} files`);
  }

  if (rows.length === 0) throw new Error("No valid rows were read.");

  // -------------------------------------------------------------------------
  // Group rows into matches and player journeys
  // -------------------------------------------------------------------------
  const matchRows = new Map();
  for (const row of rows) {
    if (!matchRows.has(row.matchId)) matchRows.set(row.matchId, []);
    matchRows.get(row.matchId).push(row);
  }

  const matches = [];
  const matchFiles = [];
  const matchSummaries = new Map();

  for (const [matchId, records] of matchRows) {
    records.sort((a, b) => a.timestampMs - b.timestampMs);
    const first = records[0];
    const startMs = records[0].timestampMs;
    const endMs = records[records.length - 1].timestampMs;
    const duration = round((endMs - startMs) / 1000, 1);
    const playersById = new Map();
    const eventCounts = Object.fromEntries(EVENT_TYPES.map((event) => [event, 0]));

    for (const record of records) {
      let player = playersById.get(record.userId);
      if (!player) {
        player = {
          id: record.userId,
          isBot: isBotId(record.userId),
          path: [],
          events: [],
          distance: 0,
          firstT: null,
          lastT: null,
        };
        playersById.set(record.userId, player);
      }

      const pixel = worldToPixel(record.x, record.z, record.mapId);
      if (!pixel) continue;
      const t = round((record.timestampMs - startMs) / 1000, 1);
      if (player.firstT === null || t < player.firstT) player.firstT = t;
      if (player.lastT === null || t > player.lastT) player.lastT = t;

      if (POSITION_EVENTS.has(record.event)) {
        const previous = player.path[player.path.length - 1];
        if (previous) {
          const dx = record.x - previous[3];
          const dz = record.z - previous[4];
          player.distance += Math.hypot(dx, dz);
        }
        player.path.push([t, round(pixel[0]), round(pixel[1]), record.x, record.z]);
      } else {
        player.events.push({
          t,
          x: round(pixel[0]),
          y: round(pixel[1]),
          type: record.event,
          worldX: round(record.x, 2),
          worldZ: round(record.z, 2),
        });
        if (eventCounts[record.event] !== undefined) eventCounts[record.event] += 1;
      }
    }

    const players = [...playersById.values()].map((player) => ({
      id: player.id,
      isBot: player.isBot,
      path: player.path.map(([t, x, y]) => [t, x, y]),
      events: player.events.map(({ t, x, y, type }) => ({ t, x, y, type })),
      distance: round(player.distance),
      activeSec: round((player.lastT ?? 0) - (player.firstT ?? 0)),
    }));
    players.sort((a, b) => Number(a.isBot) - Number(b.isBot) || b.path.length - a.path.length);

    const humans = players.filter((player) => !player.isBot).length;
    const bots = players.filter((player) => player.isBot).length;
    const summary = {
      id: matchId,
      mapId: first.mapId,
      day: first.day,
      start: new Date(startMs).toISOString(),
      duration,
      humans,
      bots,
      rows: records.length,
      events: eventCounts,
      positions: records.length - Object.values(eventCounts).reduce((sum, value) => sum + value, 0),
    };

    matches.push(summary);
    matchSummaries.set(matchId, summary);
    matchFiles.push({
      id: matchId,
      mapId: first.mapId,
      day: first.day,
      start: summary.start,
      duration,
      humans,
      bots,
      events: eventCounts,
      players,
    });
  }

  matches.sort((a, b) => (a.start < b.start ? 1 : a.start > b.start ? -1 : 0));

  // -------------------------------------------------------------------------
  // Heatmap grids and per-map reports (all days + each day)
  // -------------------------------------------------------------------------
  console.log("Building heatmaps and map reports...");
  const scopes = ["all", ...dayFolders];
  const grids = new Map();
  const mapStats = new Map();

  const gridKey = (mapId, scope, type) => `${mapId}|${scope}|${type}`;
  for (const mapId of Object.keys(MAPS)) {
    mapStats.set(mapId, new Map());
    for (const scope of scopes) {
      mapStats.get(mapId).set(scope, {
        matches: 0,
        humans: new Set(),
        bots: new Set(),
        rows: 0,
        events: Object.fromEntries(EVENT_TYPES.map((event) => [event, 0])),
      });
      for (const type of HEATMAP_TYPES) {
        grids.set(gridKey(mapId, scope, type), new Float64Array(GRID * GRID));
      }
    }
  }

  for (const row of rows) {
    const pixel = worldToPixel(row.x, row.z, row.mapId);
    if (!pixel) continue;
    const [gx, gy] = gridCell(pixel);
    const types = EVENT_HEATMAPS[row.event] ?? [];
    for (const scope of ["all", row.day]) {
      for (const type of types) {
        const grid = grids.get(gridKey(row.mapId, scope, type));
        if (grid) grid[gy * GRID + gx] += 1;
      }
    }
  }

  for (const summary of matches) {
    for (const scope of ["all", summary.day]) {
      const stats = mapStats.get(summary.mapId)?.get(scope);
      if (!stats) continue;
      stats.matches += 1;
      stats.rows += summary.rows;
      for (const [event, count] of Object.entries(summary.events)) {
        stats.events[event] += count;
      }
    }
  }

  for (const row of rows) {
    const stats = mapStats.get(row.mapId)?.get("all");
    const dayStats = mapStats.get(row.mapId)?.get(row.day);
    for (const target of [stats, dayStats]) {
      if (!target) continue;
      if (isBotId(row.userId)) target.bots.add(row.userId);
      else target.humans.add(row.userId);
    }
  }

  const reports = {};
  for (const mapId of Object.keys(MAPS)) {
    reports[mapId] = {};
    for (const scope of scopes) {
      const stats = mapStats.get(mapId).get(scope);
      const report = {
        matches: stats.matches,
        humans: stats.humans.size,
        bots: stats.bots.size,
        rows: stats.rows,
        events: stats.events,
        quadrants: {},
        top: {},
      };
      for (const type of HEATMAP_TYPES) {
        const grid = grids.get(gridKey(mapId, scope, type));
        const total = grid.reduce((sum, value) => sum + value, 0);
        const reportKey = {
          traffic: "allTraffic",
          human_traffic: "humanTraffic",
          kills: "kills",
          deaths: "deaths",
          storm_deaths: "storm",
          loot: "loot",
        }[type];
        report.quadrants[reportKey] = sumQuadrants(grid);
        report.top[reportKey] = topCells(grid, total);
      }
      reports[mapId][scope] = report;
    }
  }

  // -------------------------------------------------------------------------
  // Write output
  // -------------------------------------------------------------------------
  console.log("Writing static data...");
  await fsp.rm(DATA_DIR_OUT, { recursive: true, force: true });
  await fsp.mkdir(MATCH_DIR_OUT, { recursive: true });
  await fsp.mkdir(HEATMAP_DIR_OUT, { recursive: true });
  await fsp.rm(MINIMAP_DEST, { recursive: true, force: true });
  await fsp.mkdir(MINIMAP_DEST, { recursive: true });

  for (const map of Object.values(MAPS)) {
    const source = path.join(MINIMAP_SRC, map.minimapFile);
    const destination = path.join(MINIMAP_DEST, map.outputFile);
    if (!fs.existsSync(source)) {
      console.warn(`  ! minimap missing: ${source}`);
      continue;
    }
    try {
      // Source art is 2160-9000px and 24 MB in total. 2048px WebP keeps
      // zoomed-in detail while making the deployed site fast to load.
      await sharp(source)
        .resize(2048, 2048, { fit: "fill" })
        .webp({ quality: 86 })
        .toFile(destination);
    } catch (error) {
      throw new Error(`Could not resize ${map.minimapFile}: ${error.message}`);
    }
  }

  const heatmapFiles = [];
  for (const mapId of Object.keys(MAPS)) {
    const payload = {
      mapId,
      resolution: GRID,
      sigma: SIGMA,
      generatedAt: new Date().toISOString(),
      grids: {},
    };
    for (const scope of scopes) {
      for (const type of HEATMAP_TYPES) {
        const raw = grids.get(gridKey(mapId, scope, type));
        const total = raw.reduce((sum, value) => sum + value, 0);
        const maxRaw = raw.reduce((max, value) => Math.max(max, value), 0);
        const smoothed = gaussianBlur(raw, GRID, SIGMA);
        const max = smoothed.reduce((value, cell) => Math.max(value, cell), 0);
        payload.grids[`${type}:${scope}`] = {
          values: Array.from(smoothed, (value) => (max > 0 ? round(value / max, 3) : 0)),
          max: maxRaw,
          total,
        };
      }
    }
    heatmapFiles.push([mapId, payload]);
  }

  const writeJson = (filePath, value) => fsp.writeFile(filePath, JSON.stringify(value));

  for (const [mapId, payload] of heatmapFiles) {
    await writeJson(path.join(HEATMAP_DIR_OUT, `${mapId}.json`), payload);
  }

  for (let index = 0; index < matchFiles.length; index += 40) {
    const batch = matchFiles.slice(index, index + 40);
    await Promise.all(
      batch.map((match) => writeJson(path.join(MATCH_DIR_OUT, `${match.id}.json`), match))
    );
    if ((index + 40) % 200 === 0 || index + 40 >= matchFiles.length) {
      console.log(`  matches: ${Math.min(index + 40, matchFiles.length)}/${matchFiles.length}`);
    }
  }

  const dataset = {
    files: fileCount,
    rows: rows.length,
    matches: matches.length,
    humans: new Set(rows.filter((row) => !isBotId(row.userId)).map((row) => row.userId)).size,
    bots: new Set(rows.filter((row) => isBotId(row.userId)).map((row) => row.userId)).size,
    days: dayFolders,
    maps: Object.keys(MAPS),
    eventCounts: rows.reduce((counts, row) => {
      counts[row.event] = (counts[row.event] ?? 0) + 1;
      return counts;
    }, {}),
    dateRange: {
      start: matches[matches.length - 1]?.start ?? null,
      end: matches[0]?.start ?? null,
    },
  };

  const manifest = {
    generatedAt: new Date().toISOString(),
    source: "LILA BLACK production telemetry, Feb 10-14, 2026",
    dataset,
    eventTypes: EVENT_TYPES,
    maps: Object.fromEntries(
      Object.entries(MAPS).map(([mapId, map]) => [
        mapId,
        {
          id: map.id,
          name: map.name,
          scale: map.scale,
          originX: map.originX,
          originZ: map.originZ,
          image: map.image,
          imageWidth: 2048,
          imageHeight: 2048,
        },
      ])
    ),
    matches,
    reports,
  };

  await writeJson(path.join(DATA_DIR_OUT, "manifest.json"), manifest);

  const size = (directory) => {
    let total = 0;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      total += entry.isDirectory() ? size(entryPath) : fs.statSync(entryPath).size;
    }
    return total;
  };

  console.log("");
  console.log(`Done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
  console.log(`  ${dataset.files.toLocaleString()} files, ${dataset.rows.toLocaleString()} rows`);
  console.log(`  ${dataset.matches.toLocaleString()} matches, ${dataset.humans} humans, ${dataset.bots} bots`);
  console.log(`  ${matches.length} match files, ${heatmapFiles.length} heatmap files`);
  console.log(`  output: ${DATA_DIR_OUT} (${(size(DATA_DIR_OUT) / 1024 / 1024).toFixed(1)} MB)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
