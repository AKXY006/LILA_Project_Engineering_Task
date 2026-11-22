import { HEATMAP_PALETTES } from "./constants";
import type { HeatmapType, MapConfig, QuadrantCounts } from "./types";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Logical minimap pixel (1024x1024) -> world (x, z). */
export function pixelToWorld(pixelX: number, pixelY: number, map: MapConfig) {
  const u = pixelX / 1024;
  const v = 1 - pixelY / 1024;
  return {
    x: map.originX + u * map.scale,
    z: map.originZ + v * map.scale,
  };
}

/** World (x, z) -> logical minimap pixel (1024x1024). */
export function worldToPixel(x: number, z: number, map: MapConfig) {
  const u = (x - map.originX) / map.scale;
  const v = (z - map.originZ) / map.scale;
  return {
    x: u * 1024,
    y: (1 - v) * 1024,
  };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Interpolate a heatmap palette at 0..1 and return an rgba() string. */
export function heatColor(value: number, opacity: number, type: HeatmapType): string {
  const clamped = clamp(value, 0, 1);
  if (clamped <= 0) return "rgba(0,0,0,0)";
  const palette = HEATMAP_PALETTES[type];
  const scaled = clamped * (palette.length - 1);
  const index = Math.min(palette.length - 2, Math.floor(scaled));
  const t = scaled - index;
  const from = palette[index];
  const to = palette[index + 1];
  const r = Math.round(lerp(from[0], to[0], t));
  const g = Math.round(lerp(from[1], to[1], t));
  const b = Math.round(lerp(from[2], to[2], t));
  const alpha = opacity * (0.18 + 0.82 * Math.pow(clamped, 0.65));
  return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
}

/** Interpolate a heatmap palette at 0..1 and return an rgba() string. */
// export function heatColor(value: number, opacity: number, type: HeatmapType): string {
//   if (value <= 0) return "rgba(0,0,0,0)";
//   const palette = HEATMAP_PALETTES[type];
//   const scaled = clamp(value, 0, 1) * (palette.length - 1);
//   const index = Math.min(palette.length - 2, Math.floor(scaled));
//   const t = scaled - index;
//   const from = palette[index];
//   const to = palette[index + 1];
//   const r = Math.round(lerp(from[0], to[0], t));
//   const g = Math.round(lerp(from[1], to[1], t));
//   const b = Math.round(lerp(from[2], to[2], t));
//   const alpha = opacity * (0.18 + 0.82 * Math.pow(value, 0.65));
//   return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
// }

export function quadrantPercentages(counts: QuadrantCounts): Record<keyof QuadrantCounts, number> {
  const total = counts.NW + counts.NE + counts.SW + counts.SE;
  if (total <= 0) return { NW: 0, NE: 0, SW: 0, SE: 0 };
  return {
    NW: (counts.NW / total) * 100,
    NE: (counts.NE / total) * 100,
    SW: (counts.SW / total) * 100,
    SE: (counts.SE / total) * 100,
  };
}

/** Index of the last point with t <= target. Returns -1 if none. */
export function lastIndexAtOrBefore(points: { t: number }[], target: number): number {
  let low = 0;
  let high = points.length - 1;
  let result = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (points[mid].t <= target) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return result;
}
