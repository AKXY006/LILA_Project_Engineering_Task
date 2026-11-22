import type { EventType, HeatmapType, ReportKey } from "./types";

export const PLAYER_COLORS = {
  human: "#38bdf8",
  bot: "#f59e0b",
} as const;

export const EVENT_META: Record<
  EventType,
  { label: string; short: string; color: string; shape: "diamond" | "x" | "triangle" | "square" }
> = {
  Kill: { label: "PvP kill", short: "PvP kill", color: "#ef4444", shape: "diamond" },
  Killed: { label: "PvP death", short: "PvP death", color: "#dc2626", shape: "x" },
  BotKill: { label: "Bot killed", short: "Bot kill", color: "#f97316", shape: "diamond" },
  BotKilled: { label: "Killed by bot", short: "Bot death", color: "#ea580c", shape: "x" },
  KilledByStorm: { label: "Storm death", short: "Storm", color: "#a855f7", shape: "triangle" },
  Loot: { label: "Loot pickup", short: "Loot", color: "#22c55e", shape: "square" },
};

export const EVENT_ORDER: EventType[] = [
  "Kill",
  "Killed",
  "BotKill",
  "BotKilled",
  "KilledByStorm",
  "Loot",
];

export const HEATMAP_META: Record<
  HeatmapType,
  { label: string; description: string; reportKey: ReportKey; color: string }
> = {
  traffic: {
    label: "All traffic",
    description: "Human and bot position samples",
    reportKey: "allTraffic",
    color: "#38bdf8",
  },
  human_traffic: {
    label: "Human traffic",
    description: "Where human players spend time",
    reportKey: "humanTraffic",
    color: "#818cf8",
  },
  kills: {
    label: "Kill zones",
    description: "PvP kills and bot kills",
    reportKey: "kills",
    color: "#ef4444",
  },
  deaths: {
    label: "Death zones",
    description: "All deaths, including storm",
    reportKey: "deaths",
    color: "#dc2626",
  },
  storm_deaths: {
    label: "Storm deaths",
    description: "Players caught by the storm",
    reportKey: "storm",
    color: "#a855f7",
  },
  loot: {
    label: "Loot locations",
    description: "Loot pickups",
    reportKey: "loot",
    color: "#22c55e",
  },
};

export const HEATMAP_ORDER: HeatmapType[] = [
  "traffic",
  "human_traffic",
  "kills",
  "deaths",
  "storm_deaths",
  "loot",
];

export const QUADRANTS = ["NW", "NE", "SW", "SE"] as const;
export type Quadrant = (typeof QUADRANTS)[number];

export const QUADRANT_LABELS: Record<Quadrant, string> = {
  NW: "North-west",
  NE: "North-east",
  SW: "South-west",
  SE: "South-east",
};

export const DAY_LABELS: Record<string, string> = {
  February_10: "Feb 10",
  February_11: "Feb 11",
  February_12: "Feb 12",
  February_13: "Feb 13",
  February_14: "Feb 14",
};

export const PLAYBACK_SPEEDS = [1, 2, 5, 10, 25, 50];

export const HEATMAP_PALETTES: Record<HeatmapType, [number, number, number][]> = {
  traffic: [
    [14, 165, 233],
    [34, 211, 238],
    [250, 204, 21],
    [249, 115, 22],
    [239, 68, 68],
  ],
  human_traffic: [
    [79, 70, 229],
    [99, 102, 241],
    [56, 189, 248],
    [250, 204, 21],
    [239, 68, 68],
  ],
  kills: [
    [250, 204, 21],
    [249, 115, 22],
    [239, 68, 68],
    [190, 18, 60],
  ],
  deaths: [
    [251, 191, 36],
    [249, 115, 22],
    [220, 38, 38],
    [127, 29, 29],
  ],
  storm_deaths: [
    [139, 92, 246],
    [192, 132, 252],
    [232, 121, 249],
    [251, 207, 232],
  ],
  loot: [
    [13, 148, 136],
    [34, 197, 94],
    [163, 230, 53],
    [250, 204, 21],
  ],
};
