"""
LILA BLACK - Player Journey Visualization Tool
Backend API Server

Loads parquet telemetry data and serves it via REST API for the frontend.
"""

import os
import re
import json
import base64
from io import BytesIO
from pathlib import Path
from functools import lru_cache
from typing import Optional

import numpy as np
import pandas as pd
import pyarrow.parquet as pq
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from scipy.ndimage import gaussian_filter

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

DATA_DIR = os.environ.get("DATA_DIR", "D:/player_data/player_data")
CORS_ORIGINS = os.environ.get(
    "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
).split(",")

MAP_CONFIG = {
    "AmbroseValley": {"scale": 900, "origin_x": -370, "origin_z": -473},
    "GrandRift":     {"scale": 581, "origin_x": -290, "origin_z": -290},
    "Lockdown":      {"scale": 1000, "origin_x": -500, "origin_z": -500},
}

DAY_FOLDERS = ["February_10", "February_11", "February_12", "February_13", "February_14"]

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="LILA Viz API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

def is_bot(user_id: str) -> bool:
    """Bots have short numeric user_ids, humans have UUIDs."""
    return bool(re.match(r'^\d+$', str(user_id)))


def world_to_minimap(x: float, z: float, map_id: str):
    """Convert world coordinates to minimap pixel coordinates (1024x1024)."""
    cfg = MAP_CONFIG.get(map_id)
    if cfg is None:
        return None, None
    u = (x - cfg["origin_x"]) / cfg["scale"]
    v = (z - cfg["origin_z"]) / cfg["scale"]
    pixel_x = u * 1024
    pixel_y = (1 - v) * 1024
    return round(pixel_x, 2), round(pixel_y, 2)


@lru_cache(maxsize=1)
def load_all_data() -> pd.DataFrame:
    """Load all parquet files from all day folders into one DataFrame."""
    frames = []
    data_path = Path(DATA_DIR)

    for day in DAY_FOLDERS:
        folder = data_path / day
        if not folder.exists():
            continue
        for f in folder.iterdir():
            if f.name.startswith("."):
                continue
            try:
                table = pq.read_table(str(f))
                df = table.to_pandas()
                df["day"] = day
                df["filename"] = f.name
                frames.append(df)
            except Exception:
                continue

    if not frames:
        return pd.DataFrame()

    combined = pd.concat(frames, ignore_index=True)

    # Decode event column from bytes
    if "event" in combined.columns:
        combined["event"] = combined["event"].apply(
            lambda x: x.decode("utf-8") if isinstance(x, bytes) else str(x)
        )

    # Add is_bot column
    combined["is_bot"] = combined["user_id"].apply(lambda x: is_bot(str(x)))

    # Convert match_id - strip .nakama-0 suffix for cleaner display
    if "match_id" in combined.columns:
        combined["match_id_clean"] = combined["match_id"].apply(
            lambda x: str(x).replace(".nakama-0", "") if pd.notna(x) else x
        )

    # Convert timestamp to numeric (milliseconds) for easier JSON serialization
    if "ts" in combined.columns:
        combined["ts_ms"] = combined["ts"].apply(
            lambda x: int(x.timestamp() * 1000) if pd.notna(x) else None
        )

    # Add minimap coordinates
    px_list, py_list = [], []
    for _, row in combined.iterrows():
        px, py = world_to_minimap(row.get("x", 0), row.get("z", 0), row.get("map_id", ""))
        px_list.append(px)
        py_list.append(py)
    combined["pixel_x"] = px_list
    combined["pixel_y"] = py_list

    return combined


# Pre-warm data on startup
@app.on_event("startup")
async def startup():
    print("Loading data...")
    df = load_all_data()
    print(f"Loaded {len(df)} rows from {df['day'].nunique() if 'day' in df.columns else 0} days")


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/stats")
def get_stats():
    """Get overall dataset statistics."""
    df = load_all_data()
    if df.empty:
        return {"error": "No data loaded"}

    human_df = df[~df["is_bot"]]
    bot_df = df[df["is_bot"]]

    return {
        "total_rows": len(df),
        "total_files": df["filename"].nunique(),
        "unique_players": human_df["user_id"].nunique(),
        "unique_bots": bot_df["user_id"].nunique(),
        "unique_matches": df["match_id"].nunique() if "match_id" in df.columns else 0,
        "days": sorted(df["day"].unique().tolist()),
        "maps": sorted(df["map_id"].unique().tolist()) if "map_id" in df.columns else [],
        "event_types": sorted(df["event"].unique().tolist()) if "event" in df.columns else [],
        "event_counts": df["event"].value_counts().to_dict() if "event" in df.columns else {},
    }


@app.get("/api/filters")
def get_filters():
    """Get available filter options."""
    df = load_all_data()
    if df.empty:
        return {"days": [], "maps": [], "matches": []}

    matches_by_map = {}
    if "map_id" in df.columns and "match_id_clean" in df.columns:
        for map_id in df["map_id"].unique():
            map_df = df[df["map_id"] == map_id]
            matches = sorted(map_df["match_id_clean"].unique().tolist())
            matches_by_map[map_id] = matches

    return {
        "days": sorted(df["day"].unique().tolist()),
        "maps": sorted(df["map_id"].unique().tolist()) if "map_id" in df.columns else [],
        "matches_by_map": matches_by_map,
    }


@app.get("/api/matches")
def get_matches(
    map_id: Optional[str] = None,
    day: Optional[str] = None,
):
    """Get list of matches with summary info."""
    df = load_all_data()
    if df.empty:
        return []

    filtered = df.copy()
    if map_id:
        filtered = filtered[filtered["map_id"] == map_id]
    if day:
        filtered = filtered[filtered["day"] == day]

    matches = []
    for match_id in filtered["match_id_clean"].unique():
        match_df = filtered[filtered["match_id_clean"] == match_id]
        human_players = match_df[~match_df["is_bot"]]["user_id"].nunique()
        bot_players = match_df[match_df["is_bot"]]["user_id"].nunique()
        kills = len(match_df[match_df["event"].isin(["Kill", "BotKill"])])
        deaths = len(match_df[match_df["event"].isin(["Killed", "BotKilled", "KilledByStorm"])])

        matches.append({
            "match_id": match_id,
            "map_id": match_df["map_id"].iloc[0] if "map_id" in match_df.columns else None,
            "day": match_df["day"].iloc[0],
            "human_players": int(human_players),
            "bot_players": int(bot_players),
            "total_events": len(match_df),
            "kills": int(kills),
            "deaths": int(deaths),
        })

    return sorted(matches, key=lambda m: m["total_events"], reverse=True)


@app.get("/api/match/{match_id}")
def get_match_data(
    match_id: str,
    include_positions: bool = True,
):
    """Get full data for a specific match."""
    df = load_all_data()
    match_df = df[df["match_id_clean"] == match_id].copy()

    if match_df.empty:
        raise HTTPException(status_code=404, detail="Match not found")

    # Sort by timestamp
    if "ts_ms" in match_df.columns:
        match_df = match_df.sort_values("ts_ms")

    if not include_positions:
        match_df = match_df[~match_df["event"].isin(["Position", "BotPosition"])]

    # Group by player
    players = {}
    for user_id in match_df["user_id"].unique():
        player_df = match_df[match_df["user_id"] == user_id]
        player_is_bot = is_bot(str(user_id))

        events = []
        for _, row in player_df.iterrows():
            events.append({
                "x": float(row["x"]) if pd.notna(row.get("x")) else None,
                "z": float(row["z"]) if pd.notna(row.get("z")) else None,
                "y": float(row["y"]) if pd.notna(row.get("y")) else None,
                "pixel_x": float(row["pixel_x"]) if pd.notna(row.get("pixel_x")) else None,
                "pixel_y": float(row["pixel_y"]) if pd.notna(row.get("pixel_y")) else None,
                "ts_ms": int(row["ts_ms"]) if pd.notna(row.get("ts_ms")) else None,
                "event": row["event"],
            })

        players[str(user_id)] = {
            "user_id": str(user_id),
            "is_bot": player_is_bot,
            "event_count": len(events),
            "events": events,
        }

    return {
        "match_id": match_id,
        "map_id": match_df["map_id"].iloc[0] if "map_id" in match_df.columns else None,
        "day": match_df["day"].iloc[0],
        "total_events": len(match_df),
        "player_count": len(players),
        "human_count": sum(1 for p in players.values() if not p["is_bot"]),
        "bot_count": sum(1 for p in players.values() if p["is_bot"]),
        "ts_min": int(match_df["ts_ms"].min()) if "ts_ms" in match_df.columns else None,
        "ts_max": int(match_df["ts_ms"].max()) if "ts_ms" in match_df.columns else None,
        "players": players,
    }


@app.get("/api/match/{match_id}/timeline")
def get_match_timeline(match_id: str, step_ms: int = 10000):
    """Get match data grouped into time steps for playback."""
    df = load_all_data()
    match_df = df[df["match_id_clean"] == match_id].copy()

    if match_df.empty:
        raise HTTPException(status_code=404, detail="Match not found")

    if "ts_ms" not in match_df.columns:
        raise HTTPException(status_code=400, detail="No timestamp data")

    match_df = match_df.sort_values("ts_ms")
    ts_min = match_df["ts_ms"].min()
    ts_max = match_df["ts_ms"].max()

    frames = []
    current_ts = ts_min
    while current_ts <= ts_max:
        frame_df = match_df[
            (match_df["ts_ms"] >= current_ts) &
            (match_df["ts_ms"] < current_ts + step_ms)
        ]

        positions = []
        for _, row in frame_df.iterrows():
            positions.append({
                "user_id": str(row["user_id"]),
                "is_bot": bool(row["is_bot"]),
                "pixel_x": float(row["pixel_x"]) if pd.notna(row.get("pixel_x")) else None,
                "pixel_y": float(row["pixel_y"]) if pd.notna(row.get("pixel_y")) else None,
                "event": row["event"],
                "ts_ms": int(row["ts_ms"]) if pd.notna(row.get("ts_ms")) else None,
            })

        frames.append({
            "ts_start": int(current_ts),
            "ts_end": int(current_ts + step_ms),
            "events": positions,
        })
        current_ts += step_ms

    return {
        "match_id": match_id,
        "map_id": match_df["map_id"].iloc[0] if "map_id" in match_df.columns else None,
        "step_ms": step_ms,
        "total_frames": len(frames),
        "ts_min": int(ts_min),
        "ts_max": int(ts_max),
        "frames": frames,
    }


@app.get("/api/heatmap")
def get_heatmap(
    map_id: str,
    event_type: str = "all",
    day: Optional[str] = None,
    resolution: int = 64,
    sigma: float = 2.0,
):
    """Generate heatmap data for a specific map and event type."""
    df = load_all_data()
    filtered = df[df["map_id"] == map_id].copy()

    if day:
        filtered = filtered[filtered["day"] == day]

    if event_type == "kills":
        filtered = filtered[filtered["event"].isin(["Kill", "BotKill"])]
    elif event_type == "deaths":
        filtered = filtered[filtered["event"].isin(["Killed", "BotKilled", "KilledByStorm"])]
    elif event_type == "storm_deaths":
        filtered = filtered[filtered["event"] == "KilledByStorm"]
    elif event_type == "loot":
        filtered = filtered[filtered["event"] == "Loot"]
    elif event_type == "traffic":
        filtered = filtered[filtered["event"].isin(["Position", "BotPosition"])]
    elif event_type == "human_traffic":
        filtered = filtered[filtered["event"] == "Position"]
    # else "all" - use all events

    if filtered.empty:
        return {"grid": [], "max_value": 0, "resolution": resolution}

    # Create heatmap grid
    grid = np.zeros((resolution, resolution))

    px = filtered["pixel_x"].dropna().values
    py = filtered["pixel_y"].dropna().values

    # Map 1024x1024 to resolution x resolution
    gx = np.clip((px / 1024 * resolution).astype(int), 0, resolution - 1)
    gy = np.clip((py / 1024 * resolution).astype(int), 0, resolution - 1)

    for i in range(len(gx)):
        grid[gy[i], gx[i]] += 1

    # Apply Gaussian smoothing
    grid = gaussian_filter(grid, sigma=sigma)

    # Normalize to 0-1
    max_val = grid.max()
    if max_val > 0:
        grid = grid / max_val

    return {
        "grid": grid.tolist(),
        "max_value": float(max_val),
        "resolution": resolution,
        "event_type": event_type,
        "map_id": map_id,
        "total_events": len(filtered),
    }


@app.get("/api/player/{user_id}")
def get_player_data(user_id: str):
    """Get all data for a specific player across all matches."""
    df = load_all_data()
    player_df = df[df["user_id"] == user_id].copy()

    if player_df.empty:
        raise HTTPException(status_code=404, detail="Player not found")

    matches = []
    for match_id in player_df["match_id_clean"].unique():
        match_df = player_df[player_df["match_id_clean"] == match_id]
        events = match_df["event"].value_counts().to_dict()
        matches.append({
            "match_id": match_id,
            "map_id": match_df["map_id"].iloc[0],
            "day": match_df["day"].iloc[0],
            "total_events": len(match_df),
            "event_breakdown": events,
        })

    return {
        "user_id": user_id,
        "is_bot": is_bot(user_id),
        "total_matches": len(matches),
        "matches": matches,
    }


@app.get("/api/minimap/{map_id}")
def get_minimap(map_id: str):
    """Serve minimap image."""
    data_path = Path(DATA_DIR)
    extensions = [".png", ".jpg", ".jpeg"]

    for ext in extensions:
        filepath = data_path / "minimaps" / f"{map_id}_Minimap{ext}"
        if filepath.exists():
            return FileResponse(str(filepath))

    raise HTTPException(status_code=404, detail=f"Minimap not found for {map_id}")


@app.get("/api/map-config")
def get_map_config():
    """Get map coordinate configuration."""
    return MAP_CONFIG


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=os.environ.get("HOST", "0.0.0.0"),
        port=int(os.environ.get("PORT", "8000")),
        reload=True,
    )
