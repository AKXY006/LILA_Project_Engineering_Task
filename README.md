# LILA BLACK — Player Journey Visualization Tool

A browser-based tool for Level Designers to explore LILA BLACK player movement, combat, loot, and storm deaths on the three production minimaps.

**Live deployment:** https://lila-black-viz-iota.vercel.app

## Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Frontend | Next.js 16, React 19, TypeScript | Static export and typed component structure |
| Visualization | HTML5 Canvas | Efficient rendering of thousands of positions, paths, and markers |
| State/query | TanStack React Query | Cached loading of static match and heatmap JSON |
| Styling | Tailwind CSS 4 | Fast, consistent product UI |
| Data pipeline | Node.js, hyparquet | Reads extensionless Apache Parquet files and creates compact static JSON |
| Image pipeline | Sharp | Converts source minimaps to optimized 2048 px WebP images |
| Hosting | Vercel | Production static hosting with HTTPS and shareable URLs |

There is no always-on backend API. The pipeline processes the raw data once, and the frontend reads static files from `frontend/public/data`.

## Features

- Human and bot player journeys on the correct minimap
- `Position`/`BotPosition` trails, with playhead-based playback
- Distinct `Kill`, `Killed`, `BotKill`, `BotKilled`, `Loot`, and `KilledByStorm` markers
- Map, date, match-ID search, and shareable URL filters
- Playback controls, scrubbing, restart, skip, and 1x-50x speeds
- Traffic, human traffic, kill, death, storm-death, and loot heatmaps
- Zoom, pan, reset, hotspot labels, quadrant grid, player focus, and PNG export

## Quick Start

The repository already includes generated static data, so no raw dataset or Python environment is required to run the evaluator build.

```bash
git clone https://github.com/AKXY006/LILA_Project_Engineering_Task.git
cd LILA_Project_Engineering_Task/frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

The checked-in static app reads:

- `frontend/public/data/manifest.json`
- `frontend/public/data/matches/<match-id>.json`
- `frontend/public/data/heatmaps/<map-id>.json`
- `frontend/public/minimaps/<map-name>_Minimap.webp`

## Production Build

```bash
cd frontend
npm run lint
npm run build
```

Next.js exports the deployable site to `frontend/out`.

## Rebuilding Data from Raw Parquet

This step is optional for using the submitted app. It is needed only when the source telemetry changes or the static files must be regenerated.

The raw input is outside this repository at `D:\player_data\player_data` in the submission environment. It contains `February_10` through `February_14` folders and the `minimaps` folder.

```bash
cd pipeline
npm install
npm run build:data -- --data "D:/player_data/player_data"
```

Alternatively, set `DATA_DIR`:

```bash
DATA_DIR="D:/player_data/player_data" npm run build:data
```

On Windows PowerShell:

```powershell
$env:DATA_DIR = "D:\player_data\player_data"
npm run build:data
```

The pipeline writes generated match JSON and heatmaps into `frontend/public/data`, and minimized minimaps into `frontend/public/minimaps`.

## Environment Variables

No environment variable is required for the normal static build.

| Variable | Used by | Default | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_DATA_BASE` | Frontend | `data` | Optional alternate base path for static JSON |
| `DATA_DIR` | Pipeline | `../player_data` when present | Source folder containing February folders and minimaps |
| `OUT_DIR` | Pipeline | `frontend/public` | Optional generated-artifact destination |

For a subdirectory deployment, set `NEXT_PUBLIC_DATA_BASE` carefully or keep the default relative `data` path.

## Using the Tool

1. Select Ambrose Valley, Grand Rift, or Lockdown.
2. Optionally filter the overview by February 10-14.
3. Choose a heatmap: all traffic, human traffic, kills, deaths, storm deaths, or loot.
4. Use the layers panel to show/hide humans, bots, trails, event markers, hotspots, or the quadrant grid.
5. Select a match from the match list. The map, timeline, and player summary switch to that match.
6. Press play or scrub the timeline. The trails and event markers appear only through the current playhead.
7. Click a journey in the right panel to isolate that player and zoom to their latest position.
8. Use the canvas controls to zoom, pan, reset the view, or export the current PNG.
9. Use **Share view** to copy the URL, preserving map, date, match, and heatmap selections.

## Project Structure

```text
lila-viz/
├── pipeline/
│   └── build-data.mjs       # Parquet, coordinate, heatmap, and image processing
├── frontend/
│   ├── public/
│   │   ├── data/            # Generated manifest, matches, and heatmaps
│   │   └── minimaps/        # Optimized minimap images
│   └── src/
│       ├── app/             # Next.js entry and layout
│       ├── components/      # Dashboard and Canvas visualization
│       └── lib/             # Static data loading, geometry, types, playback
├── ARCHITECTURE.md
├── INSIGHTS.md
└── README.md
```

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — architecture, data flow, coordinate mapping, assumptions, and tradeoffs
- [INSIGHTS.md](./INSIGHTS.md) — three evidence-backed level-design findings with actionable metrics
