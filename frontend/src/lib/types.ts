export type HeatmapType =
  | "traffic"
  | "human_traffic"
  | "kills"
  | "deaths"
  | "storm_deaths"
  | "loot";

export type EventType =
  | "Kill"
  | "Killed"
  | "BotKill"
  | "BotKilled"
  | "KilledByStorm"
  | "Loot";

export type ReportKey =
  | "allTraffic"
  | "humanTraffic"
  | "kills"
  | "deaths"
  | "storm"
  | "loot";

export interface MapConfig {
  id: string;
  name: string;
  scale: number;
  originX: number;
  originZ: number;
  image: string;
  imageWidth: number;
  imageHeight: number;
}

export interface EventCounts {
  [key: string]: number;
}

export interface DatasetStats {
  files: number;
  rows: number;
  matches: number;
  humans: number;
  bots: number;
  days: string[];
  maps: string[];
  eventCounts: EventCounts;
  dateRange: {
    start: string | null;
    end: string | null;
  };
}

export interface MatchSummary {
  id: string;
  mapId: string;
  day: string;
  start: string;
  duration: number;
  humans: number;
  bots: number;
  rows: number;
  events: EventCounts;
  positions: number;
}

export interface QuadrantCounts {
  NW: number;
  NE: number;
  SW: number;
  SE: number;
}

export interface Hotspot {
  cell: string;
  x: number;
  y: number;
  count: number;
  share: number;
}

export interface MapReport {
  matches: number;
  humans: number;
  bots: number;
  rows: number;
  events: EventCounts;
  quadrants: Record<ReportKey, QuadrantCounts>;
  top: Record<ReportKey, Hotspot[]>;
}

export interface Manifest {
  generatedAt: string;
  source: string;
  dataset: DatasetStats;
  eventTypes: EventType[];
  maps: Record<string, MapConfig>;
  matches: MatchSummary[];
  reports: Record<string, Record<string, MapReport>>;
}

export interface MatchEvent {
  t: number;
  x: number;
  y: number;
  type: EventType;
}

/** [timeSeconds, pixelX, pixelY] in the 1024x1024 logical map space. */
export type PathPoint = [number, number, number];

export interface PlayerJourney {
  id: string;
  isBot: boolean;
  path: PathPoint[];
  events: MatchEvent[];
  distance: number;
  activeSec: number;
}

export interface MatchData {
  id: string;
  mapId: string;
  day: string;
  start: string;
  duration: number;
  humans: number;
  bots: number;
  events: EventCounts;
  players: PlayerJourney[];
}

export interface HeatmapGrid {
  values: number[];
  max: number;
  total: number;
}

export interface HeatmapFile {
  mapId: string;
  resolution: number;
  sigma: number;
  generatedAt: string;
  grids: Record<string, HeatmapGrid>;
}

export interface FocusTarget {
  x: number;
  y: number;
  nonce: number;
}
