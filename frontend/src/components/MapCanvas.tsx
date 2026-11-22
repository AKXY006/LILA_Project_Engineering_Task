"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Maximize2, Minus, Plus, RotateCcw } from "lucide-react";
import { EVENT_META, PLAYER_COLORS } from "@/lib/constants";
import { clamp, heatColor, pixelToWorld } from "@/lib/geometry";
import { formatDuration, shortId } from "@/lib/format";
import type {
  EventType,
  FocusTarget,
  HeatmapGrid,
  HeatmapType,
  Hotspot,
  MapConfig,
  MatchData,
  MatchEvent,
  PathPoint,
  PlayerJourney,
} from "@/lib/types";
import { IconButton } from "./ui";

const SIZE = 1024;
const MAX_ZOOM = 8;

interface View {
  scale: number;
  tx: number;
  ty: number;
}

interface HoverInfo {
  player: PlayerJourney;
  event: MatchEvent;
  screenX: number;
  screenY: number;
  worldX: number;
  worldZ: number;
}

interface MapCanvasProps {
  map: MapConfig | null;
  match: MatchData | null;
  heatmapGrid: HeatmapGrid | null;
  heatmapType: HeatmapType;
  showHeatmap: boolean;
  heatmapOpacity: number;
  showHumans: boolean;
  showBots: boolean;
  showPaths: boolean;
  showEvents: boolean;
  visibleEvents: Set<EventType>;
  playhead: number;
  focusedPlayer: string | null;
  showGrid: boolean;
  showHotspots: boolean;
  hotspots: Hotspot[];
  focusTarget: FocusTarget | null;
  onFocusConsumed?: () => void;
}

function clampView(view: View): View {
  const scale = clamp(view.scale, 1, MAX_ZOOM);
  const limit = SIZE * (scale - 1);
  return {
    scale,
    tx: clamp(view.tx, -limit, 0),
    ty: clamp(view.ty, -limit, 0),
  };
}

function lastPointIndex(path: PathPoint[], target: number): number {
  let low = 0;
  let high = path.length - 1;
  let result = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (path[mid][0] <= target) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return result;
}

function drawMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  type: EventType,
  inv: number,
  dimmed: boolean
) {
  const meta = EVENT_META[type];
  const radius = 5 * inv;
  ctx.globalAlpha = dimmed ? 0.12 : 1;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  if (meta.shape === "x") {
    ctx.strokeStyle = "rgba(0,0,0,0.8)";
    ctx.lineWidth = 3.6 * inv;
    ctx.beginPath();
    ctx.moveTo(x - radius, y - radius);
    ctx.lineTo(x + radius, y + radius);
    ctx.moveTo(x + radius, y - radius);
    ctx.lineTo(x - radius, y + radius);
    ctx.stroke();
    ctx.strokeStyle = meta.color;
    ctx.lineWidth = 1.9 * inv;
    ctx.stroke();
    return;
  }

  ctx.beginPath();
  if (meta.shape === "diamond") {
    ctx.moveTo(x, y - radius * 1.15);
    ctx.lineTo(x + radius * 1.15, y);
    ctx.lineTo(x, y + radius * 1.15);
    ctx.lineTo(x - radius * 1.15, y);
    ctx.closePath();
  } else if (meta.shape === "triangle") {
    ctx.moveTo(x, y - radius * 1.2);
    ctx.lineTo(x + radius * 1.1, y + radius * 0.85);
    ctx.lineTo(x - radius * 1.1, y + radius * 0.85);
    ctx.closePath();
  } else {
    ctx.rect(x - radius, y - radius, radius * 2, radius * 2);
  }
  ctx.fillStyle = meta.color;
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.8)";
  ctx.lineWidth = 1.5 * inv;
  ctx.stroke();
}

export default function MapCanvas({
  map,
  match,
  heatmapGrid,
  heatmapType,
  showHeatmap,
  heatmapOpacity,
  showHumans,
  showBots,
  showPaths,
  showEvents,
  visibleEvents,
  playhead,
  focusedPlayer,
  showGrid,
  showHotspots,
  hotspots,
  focusTarget,
  onFocusConsumed,
}: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const images = useRef<Record<string, HTMLImageElement>>({});
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null);
  const [, setImageVersion] = useState(0);
  const [view, setView] = useState<View>({ scale: 1, tx: 0, ty: 0 });
  const [hover, setHover] = useState<HoverInfo | null>(null);

  useEffect(() => {
    if (!map) return;
    const cached = images.current[map.id];
    if (cached?.complete) {
      setImageVersion((value) => value + 1);
      return;
    }
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      images.current[map.id] = image;
      setImageVersion((value) => value + 1);
    };
    image.onerror = () => setImageVersion((value) => value + 1);
    image.src = map.image;
  }, [map]);

  useEffect(() => {
    // Reset the viewport when the map changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setView({ scale: 1, tx: 0, ty: 0 });
    setHover(null);
  }, [map?.id]);

  useEffect(() => {
    if (!focusTarget) return;
    const scale = 4;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setView(
      clampView({
        scale,
        tx: SIZE / 2 - focusTarget.x * scale,
        ty: SIZE / 2 - focusTarget.y * scale,
      })
    );
    onFocusConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTarget?.nonce]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const cx = ((event.clientX - rect.left) / rect.width) * SIZE;
      const cy = ((event.clientY - rect.top) / rect.height) * SIZE;
      setView((previous) => {
        const factor = event.deltaY < 0 ? 1.18 : 1 / 1.18;
        const scale = clamp(previous.scale * factor, 1, MAX_ZOOM);
        const ratio = scale / previous.scale;
        return clampView({
          scale,
          tx: cx - ratio * (cx - previous.tx),
          ty: cy - ratio * (cy - previous.ty),
        });
      });
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  const updateHover = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || !map) return;
      const rect = canvas.getBoundingClientRect();
      const cx = ((event.clientX - rect.left) / rect.width) * SIZE;
      const cy = ((event.clientY - rect.top) / rect.height) * SIZE;
      const mx = (cx - view.tx) / view.scale;
      const my = (cy - view.ty) / view.scale;
      const radius = 11 / view.scale;
      let best: { player: PlayerJourney; event: MatchEvent; distance: number } | null = null;

      for (const player of match?.players ?? []) {
        if (player.isBot && !showBots) continue;
        if (!player.isBot && !showHumans) continue;
        for (const playerEvent of player.events) {
          if (playerEvent.t > playhead + 0.01) continue;
          if (!visibleEvents.has(playerEvent.type)) continue;
          const distance = Math.hypot(playerEvent.x - mx, playerEvent.y - my);
          if (distance <= radius && (!best || distance < best.distance)) {
            best = { player, event: playerEvent, distance };
          }
        }
      }

      if (!best) {
        setHover(null);
        return;
      }

      const world = pixelToWorld(best.event.x, best.event.y, map);
      setHover({
        player: best.player,
        event: best.event,
        screenX: ((best.event.x * view.scale + view.tx) / SIZE) * rect.width,
        screenY: ((best.event.y * view.scale + view.ty) / SIZE) * rect.height,
        worldX: world.x,
        worldZ: world.z,
      });
    },
    [map, match, playhead, showBots, showHumans, view, visibleEvents]
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = "#0a0c11";
    ctx.fillRect(0, 0, SIZE, SIZE);

    ctx.save();
    ctx.translate(view.tx, view.ty);
    ctx.scale(view.scale, view.scale);

    const image = map ? images.current[map.id] : null;
    if (image?.complete) {
      ctx.drawImage(image, 0, 0, SIZE, SIZE);
      ctx.fillStyle = "rgba(7,9,14,0.24)";
      ctx.fillRect(0, 0, SIZE, SIZE);
    } else {
      ctx.fillStyle = "#12151d";
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.fillStyle = "#71717a";
      ctx.font = "22px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(map ? `Loading ${map.name}…` : "Select a map", SIZE / 2, SIZE / 2);
    }

    if (showHeatmap && heatmapGrid && heatmapGrid.values.length > 0) {
      const resolution = Math.round(Math.sqrt(heatmapGrid.values.length));
      const cell = SIZE / resolution;
      for (let gy = 0; gy < resolution; gy += 1) {
        for (let gx = 0; gx < resolution; gx += 1) {
          const value = heatmapGrid.values[gy * resolution + gx];
          if (value <= 0.012) continue;
          ctx.fillStyle = heatColor(value, heatmapOpacity, heatmapType);
          ctx.fillRect(gx * cell, gy * cell, cell + 0.6, cell + 0.6);
        }
      }
    }

    if (showGrid) {
      const inv = 1 / view.scale;
      ctx.strokeStyle = "rgba(255,255,255,0.13)";
      ctx.lineWidth = inv;
      for (let index = 1; index < 8; index += 1) {
        const position = (index * SIZE) / 8;
        ctx.beginPath();
        ctx.moveTo(position, 0);
        ctx.lineTo(position, SIZE);
        ctx.moveTo(0, position);
        ctx.lineTo(SIZE, position);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(255,255,255,0.26)";
      ctx.font = `600 ${28 * inv}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("NW", SIZE * 0.25, SIZE * 0.25);
      ctx.fillText("NE", SIZE * 0.75, SIZE * 0.25);
      ctx.fillText("SW", SIZE * 0.25, SIZE * 0.75);
      ctx.fillText("SE", SIZE * 0.75, SIZE * 0.75);
    }

    const players = match?.players ?? [];
    for (const player of players) {
      if (player.isBot && !showBots) continue;
      if (!player.isBot && !showHumans) continue;
      const isFocused = focusedPlayer === player.id;
      const dimmed = Boolean(focusedPlayer && !isFocused);
      const color = player.isBot ? PLAYER_COLORS.bot : PLAYER_COLORS.human;
      const endIndex = lastPointIndex(player.path, playhead);

      if (showPaths && endIndex >= 1) {
        ctx.beginPath();
        for (let index = 0; index <= endIndex; index += 1) {
          const [, x, y] = player.path[index];
          if (index === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = color;
        ctx.globalAlpha = dimmed ? 0.06 : isFocused ? 0.95 : player.isBot ? 0.34 : 0.48;
        ctx.lineWidth = (isFocused ? 2.4 : 1.25) / view.scale;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        if (isFocused) {
          ctx.shadowColor = color;
          ctx.shadowBlur = 8 / view.scale;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      if (endIndex >= 0) {
        const [, x, y] = player.path[endIndex];
        const radius = (isFocused ? 6 : player.isBot ? 3.2 : 4.4) / view.scale;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = dimmed ? 0.18 : 1;
        ctx.fill();
        ctx.lineWidth = 1.6 / view.scale;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      if (showEvents) {
        for (const playerEvent of player.events) {
          if (playerEvent.t > playhead + 0.01) continue;
          if (!visibleEvents.has(playerEvent.type)) continue;
          drawMarker(ctx, playerEvent.x, playerEvent.y, playerEvent.type, 1 / view.scale, dimmed);
        }
      }
    }

    if (showHotspots && hotspots.length > 0) {
      const inv = 1 / view.scale;
      hotspots.forEach((hotspot, index) => {
        ctx.beginPath();
        ctx.arc(hotspot.x, hotspot.y, 12 * inv, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(8,10,15,0.72)";
        ctx.fill();
        ctx.lineWidth = 1.5 * inv;
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.font = `700 ${10 * inv}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(index + 1), hotspot.x, hotspot.y);
      });
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }, [
    focusedPlayer,
    heatmapGrid,
    heatmapOpacity,
    heatmapType,
    hotspots,
    map,
    match,
    playhead,
    showBots,
    showEvents,
    showGrid,
    showHeatmap,
    showHotspots,
    showHumans,
    showPaths,
    view,
    visibleEvents,
  ]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, tx: view.tx, ty: view.ty, moved: false };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (drag) {
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      const rect = event.currentTarget.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      setView((previous) =>
        clampView({
          scale: previous.scale,
          tx: drag.tx + (dx * SIZE) / rect.width,
          ty: drag.ty + (dy * SIZE) / rect.height,
        })
      );
      setHover(null);
      return;
    }
    updateHover(event);
  };

  // const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
  //   const drag = dragRef.current;
  //   if (drag) {
  //     const dx = event.clientX - drag.x;
  //     const dy = event.clientY - drag.y;
  //     if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
  //     const rect = event.currentTarget.getBoundingClientRect();
  //     setView((previous) =>
  //       clampView({
  //         scale: previous.scale,
  //         tx: drag.tx + (dx * SIZE) / rect.width,
  //         ty: drag.ty + (dy * SIZE) / rect.height,
  //       })
  //     );
  //     setHover(null);
  //     return;
  //   }
  //   updateHover(event);
  // };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  const resetView = () => {
    setView({ scale: 1, tx: 0, ty: 0 });
    setHover(null);
  };

  const zoomBy = (factor: number) => {
    setView((previous) => {
      const scale = clamp(previous.scale * factor, 1, MAX_ZOOM);
      const ratio = scale / previous.scale;
      const cx = SIZE / 2;
      const cy = SIZE / 2;
      return clampView({
        scale,
        tx: cx - ratio * (cx - previous.tx),
        ty: cy - ratio * (cy - previous.ty),
      });
    });
  };

  const exportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `lila-${map?.id ?? "map"}-${match ? shortId(match.id) : "overview"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const hoverMeta = hover ? EVENT_META[hover.event.type] : null;
  const tooltipLeft = hover ? clamp(hover.screenX, 84, 716) : 0;
  const tooltipTop = hover ? Math.max(64, hover.screenY) : 0;

  const zoomLabel = useMemo(() => `${view.scale.toFixed(1)}×`, [view.scale]);

  return (
    <div
      ref={wrapperRef}
      className="relative aspect-square w-full max-w-full overflow-hidden rounded-2xl border border-border bg-[#0a0c11] shadow-2xl shadow-black/40"
      style={{ maxHeight: "100%" }}
    >
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        role="img"
        aria-label={
          match
            ? `Player journeys on ${map?.name ?? "the map"} for match ${shortId(match.id)}`
            : `Overview heatmap for ${map?.name ?? "the selected map"}`
        }
        className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={() => {
          if (!dragRef.current) setHover(null);
        }}
      />

      <div className="absolute right-3 top-3 flex items-center gap-1.5">
        <IconButton label="Zoom in" onClick={() => zoomBy(1.25)}>
          <Plus className="h-4 w-4" />
        </IconButton>
        <IconButton label="Zoom out" onClick={() => zoomBy(0.8)}>
          <Minus className="h-4 w-4" />
        </IconButton>
        <IconButton label="Reset view" onClick={resetView}>
          <RotateCcw className="h-4 w-4" />
        </IconButton>
        <IconButton label="Export view as PNG" onClick={exportPng}>
          <Download className="h-4 w-4" />
        </IconButton>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 rounded-full border border-white/10 bg-black/55 px-2.5 py-1 text-[10px] text-zinc-400 backdrop-blur">
        <Maximize2 className="h-3 w-3" />
        <span>Scroll to zoom · drag to pan</span>
      </div>

      <div className="pointer-events-none absolute bottom-3 right-3 rounded-full border border-white/10 bg-black/55 px-2.5 py-1 font-mono text-[10px] text-zinc-400 backdrop-blur">
        {zoomLabel}
      </div>

      {hover && hoverMeta ? (
        <div
          className="pointer-events-none absolute z-20 w-max max-w-[220px] -translate-x-1/2 -translate-y-full rounded-xl border border-white/15 bg-[#0d1017]/95 px-3 py-2 text-xs shadow-xl shadow-black/50 backdrop-blur"
          style={{ left: tooltipLeft, top: tooltipTop - 10 }}
        >
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: hoverMeta.color }}
            />
            <span className="font-semibold text-zinc-100">{hoverMeta.label}</span>
          </div>
          <div className="mt-1 text-[10px] text-zinc-400">
            {hover.player.isBot ? "Bot" : "Human"} {shortId(hover.player.id)} ·{" "}
            {formatDuration(hover.event.t)}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-zinc-500">
            world {hover.worldX.toFixed(0)}, {hover.worldZ.toFixed(0)}
          </div>
        </div>
      ) : null}
    </div>
  );
}
