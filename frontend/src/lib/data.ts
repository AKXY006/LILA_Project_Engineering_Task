import type { HeatmapFile, Manifest, MapConfig, MatchData } from "./types";

const DATA_BASE = process.env.NEXT_PUBLIC_DATA_BASE || "/data";

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`Could not load ${url} (HTTP ${response.status})`);
  }
  return (await response.json()) as T;
}

export function getManifest() {
  return fetchJson<Manifest>(`${DATA_BASE}/manifest.json`);
}

export function getMatch(matchId: string) {
  return fetchJson<MatchData>(`${DATA_BASE}/matches/${encodeURIComponent(matchId)}.json`);
}

export function getHeatmap(mapId: string) {
  return fetchJson<HeatmapFile>(`${DATA_BASE}/heatmaps/${encodeURIComponent(mapId)}.json`);
}

export function getMinimapUrl(map: MapConfig) {
  return map.image;
}
