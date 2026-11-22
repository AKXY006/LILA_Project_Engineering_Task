# Architecture

## Overview

The Player Journey Visualization Tool uses an offline **Node pipeline** for Parquet processing and a **static Next.js frontend** for interactive visualization.

```
┌──────────────┐     Static JSON     ┌──────────────┐     Parquet I/O     ┌──────────────┐
│   Browser    │ ◄─────────────────  │  Next.js UI  │                     │  .nakama-0   │
│  Canvas API  │                     │  / public    │ ◄────────────────►  │  Parquet     │
└──────────────┘                     └──────────────┘     Node pipeline     └──────────────┘
```

## Why This Stack

| Choice | Rationale |
|--------|-----------|
| **Node + hyparquet** | The pipeline is a small build step, so Node dependencies keep setup simple and produce static artifacts directly. hyparquet reads the extensionless Parquet files; sharp converts minimaps to WebP. |
| **Next.js + React** | Modern component model, excellent TypeScript support, easy deployment to Vercel. |
| **Tailwind CSS** | Dark-themed gaming UI built rapidly with utility classes. No custom CSS framework overhead. |
| **Canvas API** | Rendering 1000+ position dots and paths per match. Canvas is significantly faster than SVG/DOM for this density of data. D3.js was considered but Canvas offers better raw performance for path rendering. |
| **TanStack React Query** | Automatic caching prevents re-fetching match data. Background refetching keeps data fresh. Loading/error states handled declaratively. |

## Data Flow

```
1. Parquet Files (.nakama-0)
   ↓  hyparquet.parquetReadObjects()
2. Node pipeline
   ↓  Event decoding: Uint8Array/bytes → UTF-8
   ↓  Bot detection: numeric user_id regex
   ↓  Coordinate conversion: world_to_minimap(x, z, map_id)
   ↓  Match grouping, playback JSON, heatmaps, and WebP minimaps
3. Static files in frontend/public
   ↓  Fetch by TanStack React Query
4. Browser state/cache
   ↓  Component state
5. Canvas rendering (1024x1024 logical canvas)
   - Minimap image as background
   - Player paths as stroked lines
   - Distinct event markers
   - Heatmap as semi-transparent grid overlay
```

## Coordinate Mapping (The Tricky Part)

The game uses a 3D coordinate system (x, y, z) where:
- **x** = horizontal position
- **y** = elevation/height (NOT used for 2D mapping)
- **z** = "forward/back" position (used as vertical axis on 2D minimap)

### Conversion Algorithm

```
Step 1: World → UV (normalized 0-1 range)
  u = (x - origin_x) / scale
  v = (z - origin_z) / scale

Step 2: UV → Pixel (1024×1024 minimap)
  pixel_x = u * 1024
  pixel_y = (1 - v) * 1024    ← Y-axis is flipped (image origin is top-left)

Step 3: Pixel → Canvas (scaled to canvas display size)
  canvas_x = pixel_x * (canvas_display_width / 1024)
  canvas_y = pixel_y * (canvas_display_height / 1024)
```

### Map Parameters

| Map | Scale | Origin X | Origin Z |
|-----|-------|----------|----------|
| AmbroseValley | 900 | -370 | -473 |
| GrandRift | 581 | -290 | -290 |
| Lockdown | 1000 | -500 | -500 |

The coordinate conversion happens in the Node build pipeline. Each position and event stores ready-to-plot logical 1024×1024 pixel coordinates in the generated JSON. The browser only scales those coordinates to its displayed canvas size.

## Assumptions

1. **Timestamps are match-relative** — The `ts` column represents elapsed time within a match, not wall-clock time. This is based on the README stating timestamps are "time elapsed within the match."
2. **Bot detection by user_id format** — Numeric user_ids (regex `^\d+$`) are bots; UUIDs are human players. This is stated in the data README.
3. **Event column is bytes** — The `event` column in parquet is stored as binary. We decode with UTF-8 on load.
4. **February 14 is partial** — The last day has less data because collection was still ongoing.
5. **All `.nakama-0` suffix files are parquet** — Despite no `.parquet` extension, all files in the day folders are valid parquet files.

## Major Tradeoffs

| Decision | Alternative Considered | Why This Choice |
|----------|----------------------|-----------------|
| Build-time Node pipeline | Runtime backend or DuckDB-WASM | Static JSON removes server operations; only the needed match and heatmap data is downloaded |
| Canvas rendering | SVG with D3.js | Canvas handles 1000+ elements per frame without DOM overhead; SVG would choke on position trail rendering |
| Per-match static JSON | One large combined dataset | Large manifest plus small selected match payload keeps overview filters fast and match replay focused |
| Continuous playback slider | Fixed time steps | Continuous seconds give stable scrubbing and let the slider land anywhere within the match |
| Gaussian-smoothed heatmap | Raw density grid | Gaussian smoothing reveals spatial patterns that raw pixel counts miss; sigma=1.8 balances detail and readability |
