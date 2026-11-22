# Architecture

## Overview

The Player Journey Visualization Tool is a full-stack web application with a **Python backend** (data processing) and a **Next.js frontend** (interactive visualization).

```
┌──────────────┐     HTTP/REST     ┌──────────────────┐     Parquet I/O     ┌──────────────┐
│   Browser    │ ◄──────────────►  │  FastAPI Backend  │ ◄────────────────►  │  .nakama-0   │
│  (Next.js)   │                   │  (Python)         │                     │  Parquet     │
│  Canvas API  │                   │  pandas + pyarrow │                     │  Files       │
└──────────────┘                   └──────────────────┘                     └──────────────┘
```

## Why This Stack

| Choice | Rationale |
|--------|-----------|
| **FastAPI + Python** | Parquet files need pyarrow/pandas. Python is the natural choice. FastAPI gives fast async REST APIs with auto-generated docs. |
| **Next.js + React** | Modern component model, excellent TypeScript support, easy deployment to Vercel. |
| **Tailwind CSS** | Dark-themed gaming UI built rapidly with utility classes. No custom CSS framework overhead. |
| **Canvas API** | Rendering 1000+ position dots and paths per match. Canvas is significantly faster than SVG/DOM for this density of data. D3.js was considered but Canvas offers better raw performance for path rendering. |
| **TanStack React Query** | Automatic caching prevents re-fetching match data. Background refetching keeps data fresh. Loading/error states handled declaratively. |

## Data Flow

```
1. Parquet Files (.nakama-0)
   ↓  pyarrow.parquet.read_table()
2. pandas DataFrames (cached in memory via @lru_cache)
   ↓  Coordinate conversion: world_to_minimap(x, z, map_id)
   ↓  Event decoding: bytes → utf-8 string
   ↓  Bot detection: regex match on user_id
3. REST API (FastAPI endpoints)
   ↓  JSON response
4. React Query Cache (browser)
   ↓  Component state
5. Canvas Rendering (1024x1024 pixel canvas)
   - Minimap image as background
   - Player paths as stroked lines
   - Event markers as filled circles
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

The coordinate conversion happens **server-side** when data is first loaded. Pre-computed `pixel_x` and `pixel_y` columns are added to the DataFrame so the frontend receives ready-to-plot coordinates.

## Assumptions

1. **Timestamps are match-relative** — The `ts` column represents elapsed time within a match, not wall-clock time. This is based on the README stating timestamps are "time elapsed within the match."
2. **Bot detection by user_id format** — Numeric user_ids (regex `^\d+$`) are bots; UUIDs are human players. This is stated in the data README.
3. **Event column is bytes** — The `event` column in parquet is stored as binary. We decode with UTF-8 on load.
4. **February 14 is partial** — The last day has less data because collection was still ongoing.
5. **All `.nakama-0` suffix files are parquet** — Despite no `.parquet` extension, all files in the day folders are valid parquet files.

## Major Tradeoffs

| Decision | Alternative Considered | Why This Choice |
|----------|----------------------|-----------------|
| Server-side data processing | Client-side with DuckDB-WASM | Server caching is simpler; ~89K rows loads fast in pandas; avoids shipping 15MB+ of parquet to browser |
| Canvas rendering | SVG with D3.js | Canvas handles 1000+ elements per frame without DOM overhead; SVG would choke on position trail rendering |
| Full data pre-load on startup | Lazy loading per request | With ~89K total rows, loading everything into memory (~50MB) is fast and avoids repeated disk I/O |
| Timeline by time steps | Per-event streaming | Fixed time steps (5s default) give consistent playback speed; per-event would cause variable frame pacing |
| Gaussian-smoothed heatmap | Raw density grid | Gaussian smoothing reveals spatial patterns that raw pixel counts miss; sigma=2.5 balances detail and readability |
