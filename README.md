# LILA BLACK — Player Journey Visualization Tool

A web-based visualization tool for Level Designers to explore player behavior in LILA BLACK, an extraction shooter game.

**Live deployment:** https://akxy006.github.io/LILA_Project_Engineering_Task/

![Tech Stack](https://img.shields.io/badge/Frontend-Next.js%2016%20+%20Tailwind%20CSS-blue)
![Tech Stack](https://img.shields.io/badge/Backend-FastAPI%20+%20Python-green)
![Data](https://img.shields.io/badge/Data-Apache%20Parquet-orange)

## 🎮 Features

- **Player Journey Visualization** — See movement paths plotted on actual game minimaps with proper coordinate mapping
- **Human vs Bot Distinction** — Humans shown in blue, bots in yellow, clearly distinguishable
- **Event Markers** — Kills (💀), Deaths (☠️), Bot Kills (🤖), Storm Deaths (⛈️), and Loot (📦) as distinct colored markers
- **Filtering** — Filter by map (AmbroseValley, GrandRift, Lockdown), date (Feb 10-14), and match
- **Timeline/Playback** — Watch a match unfold over time with play/pause controls and speed adjustment
- **Heatmap Overlays** — Visualize kill zones, death zones, storm deaths, loot locations, and traffic density
- **Match Statistics** — Detailed per-match stats including player counts, kill/death ratios, and event breakdowns

## 🛠 Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | Next.js 16, React 19, TypeScript | Modern app framework with server components, excellent DX |
| **Styling** | Tailwind CSS 4 | Utility-first, rapid UI development, dark theme built-in |
| **Data Viz** | HTML5 Canvas API | High-performance rendering for thousands of data points |
| **State** | TanStack React Query | Caching, background refetching, loading states |
| **Backend** | FastAPI (Python) | Native Python data science ecosystem (pandas, pyarrow) |
| **Data** | Apache Parquet + pandas | Efficient columnar format, native parquet support |
| **Icons** | Lucide React | Clean, consistent icon set |

## 📋 Prerequisites

- **Python 3.10+** (with pip)
- **Node.js 18+** (with npm)
- **Git**

## 🚀 Setup

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd lila-viz
```

### 2. Backend Setup

```bash
# Install Python dependencies
pip install -r backend/requirements.txt

# Set data directory (edit .env or use environment variable)
# Default: D:/player_data/player_data
cp backend/.env.example backend/.env
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

### 4. Configure Environment

Create `frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Create `backend/.env`:
```
DATA_DIR=D:/player_data/player_data
HOST=0.0.0.0
PORT=8000
```

## ▶️ Running Locally

**Terminal 1 — Backend:**
```bash
cd backend
python main.py
# API running at http://localhost:8000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
# App running at http://localhost:3000
```

Open **http://localhost:3000** in your browser.

## 📁 Project Structure

```
lila-viz/
├── backend/
│   ├── main.py              # FastAPI server — data loading, processing, API endpoints
│   ├── requirements.txt     # Python dependencies
│   ├── .env                 # Environment config
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx     # Entry point
│   │   │   ├── layout.tsx   # Root layout
│   │   │   └── globals.css  # Global styles + Tailwind config
│   │   ├── components/
│   │   │   └── Dashboard.tsx  # Main visualization dashboard
│   │   └── lib/
│   │       ├── api.ts       # API client + TypeScript types
│   │       ├── constants.ts # Event colors, labels, heatmap config
│   │       └── providers.tsx # React Query provider
│   ├── .env.local           # Frontend env
│   ├── next.config.ts
│   └── package.json
├── ARCHITECTURE.md
├── INSIGHTS.md
└── README.md
```

## 🔧 Environment Variables

### Backend (`backend/.env`)
| Variable | Default | Description |
|----------|---------|-------------|
| `DATA_DIR` | `D:/player_data/player_data` | Path to the parquet data files |
| `HOST` | `0.0.0.0` | Server host |
| `PORT` | `8000` | Server port |

### Frontend (`frontend/.env.local`)
| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend API URL |

## 📡 API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/stats` | Overall dataset statistics |
| `GET /api/filters` | Available filter options |
| `GET /api/matches` | List matches with summary (filterable by map/day) |
| `GET /api/match/{id}` | Full match data with all player events |
| `GET /api/match/{id}/timeline` | Match data grouped by time steps for playback |
| `GET /api/heatmap` | Heatmap grid data for a map/event type |
| `GET /api/minimap/{map_id}` | Serve minimap image |
| `GET /api/map-config` | Map coordinate configuration |
