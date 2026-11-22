"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowLeft,
  Bot,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Crosshair,
  Flame,
  Gauge,
  Layers,
  Link2,
  Map as MapIcon,
  Pause,
  Play,
  RotateCcw,
  Route,
  Search,
  SkipBack,
  SkipForward,
  Skull,
  Target,
  User,
} from "lucide-react";
import {
  DAY_LABELS,
  EVENT_META,
  EVENT_ORDER,
  HEATMAP_META,
  HEATMAP_ORDER,
  HEATMAP_PALETTES,
  PLAYBACK_SPEEDS,
  PLAYER_COLORS,
  QUADRANTS,
  QUADRANT_LABELS,
} from "@/lib/constants";
import { getHeatmap, getManifest, getMatch } from "@/lib/data";
import {
  dayLabel,
  formatCompact,
  formatDate,
  formatDuration,
  formatNumber,
  formatPercent,
  plural,
  shortId,
} from "@/lib/format";
import { pixelToWorld, quadrantPercentages } from "@/lib/geometry";
import type {
  EventType,
  FocusTarget,
  HeatmapType,
  Hotspot,
  MapReport,
  MatchData,
  MatchSummary,
  PlayerJourney,
  QuadrantCounts,
  ReportKey,
} from "@/lib/types";
import { usePlayback } from "@/lib/usePlayback";
import MapCanvas from "./MapCanvas";
import { Badge, EmptyState, IconButton, SectionTitle, StatRow, Toggle } from "./ui";

const MAP_IDS = ["AmbroseValley", "GrandRift", "Lockdown"] as const;
const DEFAULT_MAP = "AmbroseValley";
const ALL_EVENTS = new Set<EventType>(EVENT_ORDER);

function MarkerGlyph({ type, size = 14 }: { type: EventType; size?: number }) {
  const meta = EVENT_META[type];
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" className="shrink-0">
      {meta.shape === "diamond" ? (
        <polygon points="8,1 15,8 8,15 1,8" fill={meta.color} stroke="#000" strokeOpacity="0.6" />
      ) : meta.shape === "triangle" ? (
        <polygon points="8,1.5 15,14 1,14" fill={meta.color} stroke="#000" strokeOpacity="0.6" />
      ) : meta.shape === "square" ? (
        <rect x="2" y="2" width="12" height="12" fill={meta.color} stroke="#000" strokeOpacity="0.6" />
      ) : (
        <g stroke={meta.color} strokeWidth="2.4" strokeLinecap="round">
          <line x1="3" y1="3" x2="13" y2="13" />
          <line x1="13" y1="3" x2="3" y2="13" />
        </g>
      )}
    </svg>
  );
}

function GradientLegend({ type }: { type: HeatmapType }) {
  const palette = HEATMAP_PALETTES[type];
  const stops = palette
    .map(([r, g, b], index) => `rgb(${r},${g},${b}) ${(index / (palette.length - 1)) * 100}%`)
    .join(", ");
  return (
    <div>
      <div
        className="h-2 w-full rounded-full border border-white/10"
        style={{ background: `linear-gradient(90deg, ${stops})` }}
      />
      <div className="mt-1 flex justify-between text-[9px] uppercase tracking-wider text-zinc-600">
        <span>Low</span>
        <span>High</span>
      </div>
    </div>
  );
}

function QuadrantGrid({ counts }: { counts: QuadrantCounts }) {
  const pct = quadrantPercentages(counts);
  const total = counts.NW + counts.NE + counts.SW + counts.SE;
  return (
    <div className="grid grid-cols-2 gap-1">
      {QUADRANTS.map((quadrant) => (
        <div
          key={quadrant}
          title={`${QUADRANT_LABELS[quadrant]}: ${formatNumber(counts[quadrant])} events`}
          className="rounded-md border border-border bg-white/[0.03] px-2 py-1.5"
        >
          <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-zinc-600">
            <span>{quadrant}</span>
            <span className="tabular-nums text-zinc-500">{formatPercent(pct[quadrant], 0)}</span>
          </div>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-accent-light/70"
              style={{ width: `${Math.min(100, pct[quadrant])}%` }}
            />
          </div>
          <div className="mt-0.5 text-[10px] tabular-nums text-zinc-400">
            {total > 0 ? formatNumber(counts[quadrant]) : "—"}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-white/[0.03] px-3 py-2">
      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.14em] text-zinc-500">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-100">{value}</div>
      {hint ? <div className="text-[10px] text-zinc-500">{hint}</div> : null}
    </div>
  );
}

export default function Dashboard() {
  const [mapId, setMapId] = useState<string>(DEFAULT_MAP);
  const [day, setDay] = useState<string>("");
  const [selectedMatch, setSelectedMatch] = useState<string>("");
  const [search, setSearch] = useState("");

  const [showHeatmap, setShowHeatmap] = useState(true);
  const [heatmapType, setHeatmapType] = useState<HeatmapType>("traffic");
  const [heatmapOpacity, setHeatmapOpacity] = useState(0.8);

  const [showHumans, setShowHumans] = useState(true);
  const [showBots, setShowBots] = useState(true);
  const [showPaths, setShowPaths] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const [visibleEvents, setVisibleEvents] = useState<Set<EventType>>(new Set(ALL_EVENTS));
  const [showGrid, setShowGrid] = useState(false);
  const [showHotspots, setShowHotspots] = useState(true);

  const [focusedPlayer, setFocusedPlayer] = useState<string | null>(null);
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);
  const [showAllPlayers, setShowAllPlayers] = useState(false);
  const [copied, setCopied] = useState(false);
  const [urlReady, setUrlReady] = useState(false);

  // ── Data ────────────────────────────────────────────────────────────────
  const {
    data: manifest,
    isLoading: manifestLoading,
    error: manifestError,
  } = useQuery({
    queryKey: ["manifest"],
    queryFn: getManifest,
    staleTime: Infinity,
  });

  const {
    data: match,
    isLoading: matchLoading,
    error: matchError,
  } = useQuery({
    queryKey: ["match", selectedMatch],
    queryFn: () => getMatch(selectedMatch),
    enabled: Boolean(selectedMatch),
    staleTime: Infinity,
    retry: false,
  });

  const activeMapId = match?.mapId ?? mapId;
  const scope = day || "all";

  const { data: heatmap } = useQuery({
    queryKey: ["heatmap", activeMapId],
    queryFn: () => getHeatmap(activeMapId),
    enabled: Boolean(activeMapId),
    staleTime: Infinity,
  });

  const heatmapGrid = heatmap?.grids[`${heatmapType}:${scope}`] ?? null;

  const playback = usePlayback(match?.duration ?? 0, match?.id);

  // ── URL state (shareable links) ─────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlMap = params.get("map");
    const urlDay = params.get("day");
    const urlMatch = params.get("match");
    const urlHeat = params.get("heat");
    if (urlMap && (MAP_IDS as readonly string[]).includes(urlMap)) setMapId(urlMap);
    if (urlDay && /^February_\d+$/.test(urlDay)) setDay(urlDay);
    if (urlHeat && (HEATMAP_ORDER as readonly string[]).includes(urlHeat)) {
      setHeatmapType(urlHeat as HeatmapType);
    }
    if (urlMatch) {
      setSelectedMatch(urlMatch);
      setShowHeatmap(false);
    }
    setUrlReady(true);
  }, []);

  useEffect(() => {
    if (!urlReady) return;
    const params = new URLSearchParams();
    params.set("map", mapId);
    if (day) params.set("day", day);
    if (selectedMatch) params.set("match", selectedMatch);
    if (heatmapType !== "traffic") params.set("heat", heatmapType);
    const next = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", next);
  }, [urlReady, mapId, day, selectedMatch, heatmapType]);

  // Keep the map selector in sync with the selected match.
  useEffect(() => {
    if (match) setMapId(match.mapId);
  }, [match]);

  // ── Derived lists ───────────────────────────────────────────────────────
  const filteredMatches = useMemo(() => {
    if (!manifest) return [];
    const query = search.trim().toLowerCase();
    return manifest.matches.filter((item) => {
      if (mapId && item.mapId !== mapId) return false;
      if (day && item.day !== day) return false;
      if (query && !item.id.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [manifest, mapId, day, search]);

  const report: MapReport | null = manifest?.reports?.[activeMapId]?.[scope] ?? null;
  const reportKey: ReportKey = HEATMAP_META[heatmapType].reportKey;
  const hotspots: Hotspot[] = report?.top?.[reportKey] ?? [];
  const mapConfig = manifest?.maps?.[activeMapId] ?? null;

  // ── Handlers ────────────────────────────────────────────────────────────
  const selectMatch = useCallback((matchId: string) => {
    setSelectedMatch(matchId);
    setShowHeatmap(false);
    setFocusedPlayer(null);
    setShowAllPlayers(false);
  }, []);

  const backToOverview = useCallback(() => {
    setSelectedMatch("");
    setFocusedPlayer(null);
    setShowHeatmap(true);
  }, []);

  const toggleEvent = (type: EventType) => {
    setVisibleEvents((previous) => {
      const next = new Set(previous);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const focusOn = useCallback((x: number, y: number) => {
    setFocusTarget({ x, y, nonce: Date.now() });
  }, []);

  const focusPlayer = useCallback((player: PlayerJourney) => {
    setFocusedPlayer((current) => (current === player.id ? null : player.id));
    const last = player.path[player.path.length - 1];
    if (last) focusOn(last[1], last[2]);
  }, [focusOn]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const totalKills = (summary: MatchSummary) =>
    (summary.events.Kill ?? 0) + (summary.events.BotKill ?? 0);

  const mapStats = manifest?.reports?.[activeMapId]?.all ?? null;

  // ── Render ──────────────────────────────────────────────────────────────
  if (manifestError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="max-w-md rounded-2xl border border-red-500/30 bg-red-500/5 p-6">
          <h1 className="text-base font-semibold text-red-300">Could not load the dataset</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            The static data files are missing. Run{" "}
            <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-xs">
              npm run build:data
            </code>{" "}
            in the <code className="font-mono text-xs">pipeline</code> folder, then rebuild the app.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-black/40 p-3 text-[11px] text-red-300/80">
            {String(manifestError)}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background lg:h-screen lg:overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="z-20 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-card/80 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-accent/30 bg-accent/15">
            <Crosshair className="h-5 w-5 text-accent-light" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-zinc-100">
              LILA BLACK <span className="font-normal text-zinc-500">/ Player Journey Explorer</span>
            </h1>
            <p className="text-[10px] text-zinc-500">
              {manifest
                ? `${formatNumber(manifest.dataset.rows)} telemetry rows · ${formatNumber(
                    manifest.dataset.matches
                  )} matches · ${manifest.dataset.humans} humans · ${manifest.dataset.bots} bots`
                : "Loading dataset…"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedMatch ? (
            <button
              type="button"
              onClick={backToOverview}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white/5 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Overview
            </button>
          ) : null}
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white/5 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Link2 className="h-3.5 w-3.5" />}
            {copied ? "Link copied" : "Share view"}
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
        {/* ── Left: filters + matches ──────────────────────────────────── */}
        <aside className="order-2 w-full shrink-0 border-b border-border bg-card/40 lg:order-none lg:w-64 lg:overflow-y-auto lg:border-b-0 lg:border-r xl:w-72">
          <div className="border-b border-border p-4">
            <SectionTitle>Map</SectionTitle>
            <div className="grid grid-cols-3 gap-1.5">
              {MAP_IDS.map((id) => {
                const config = manifest?.maps?.[id];
                const active = activeMapId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setMapId(id);
                      setSelectedMatch("");
                      setFocusedPlayer(null);
                    }}
                    className={`rounded-lg border px-2 py-2 text-left transition-colors ${
                      active
                        ? "border-accent/50 bg-accent/15 text-accent-light"
                        : "border-border bg-white/[0.03] text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                    }`}
                  >
                    <MapIcon className="mb-1 h-3.5 w-3.5" />
                    <div className="text-[11px] font-medium leading-tight">
                      {config?.name ?? id.replace(/([a-z])([A-Z])/g, "$1 $2")}
                    </div>
                    <div className="text-[9px] text-zinc-500">
                      {config
                        ? `${formatCompact(manifest?.reports?.[id]?.all?.matches ?? 0)} matches`
                        : "—"}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4">
              <label
                htmlFor="day-filter"
                className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500"
              >
                Date
              </label>
              <select
                id="day-filter"
                value={day}
                onChange={(event) => {
                  setDay(event.target.value);
                  setSelectedMatch("");
                  setFocusedPlayer(null);
                }}
                className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-zinc-300 outline-none focus:border-accent"
              >
                <option value="">All days (Feb 10–14, 2026)</option>
                {(manifest?.dataset.days ?? []).map((item) => (
                  <option key={item} value={item}>
                    {dayLabel(item)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Heatmap controls */}
          <div className="border-b border-border p-4">
            <SectionTitle
              right={
                <button
                  type="button"
                  onClick={() => setShowHeatmap((value) => !value)}
                  className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                    showHeatmap
                      ? "bg-accent text-white"
                      : "border border-border bg-white/5 text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {showHeatmap ? "On" : "Off"}
                </button>
              }
            >
              Heatmap
            </SectionTitle>

            <div className="grid grid-cols-2 gap-1">
              {HEATMAP_ORDER.map((type) => {
                const meta = HEATMAP_META[type];
                const active = heatmapType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setHeatmapType(type);
                      setShowHeatmap(true);
                    }}
                    className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-[11px] transition-colors ${
                      active
                        ? "border-accent/50 bg-accent/15 text-zinc-100"
                        : "border-border bg-white/[0.02] text-zinc-400 hover:border-zinc-600"
                    }`}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: meta.color }}
                    />
                    <span className="truncate">{meta.label}</span>
                  </button>
                );
              })}
            </div>

            {showHeatmap ? (
              <div className="mt-3 space-y-2">
                <GradientLegend type={heatmapType} />
                <div>
                  <div className="mb-1 flex items-center justify-between text-[10px] text-zinc-500">
                    <span>Opacity</span>
                    <span className="tabular-nums">{Math.round(heatmapOpacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={100}
                    step={5}
                    value={Math.round(heatmapOpacity * 100)}
                    onChange={(event) => setHeatmapOpacity(Number(event.target.value) / 100)}
                    className="w-full"
                    aria-label="Heatmap opacity"
                  />
                </div>
                <p className="text-[10px] leading-4 text-zinc-600">
                  Scope: {day ? dayLabel(day) : "all five days"} ·{" "}
                  {heatmapGrid ? plural(heatmapGrid.total, "event") : "loading…"}
                </p>
              </div>
            ) : null}
          </div>

          {/* Visibility */}
          <div className="border-b border-border p-4">
            <SectionTitle>Layers</SectionTitle>
            <div className="space-y-0.5">
              <Toggle
                label="Humans"
                hint={match ? `${match.humans} in match` : undefined}
                icon={<span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PLAYER_COLORS.human }} />}
                checked={showHumans}
                onChange={setShowHumans}
              />
              <Toggle
                label="Bots"
                hint={match ? `${match.bots} in match` : undefined}
                icon={<span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PLAYER_COLORS.bot }} />}
                checked={showBots}
                onChange={setShowBots}
              />
              <Toggle
                label="Movement trails"
                icon={<Route className="h-3.5 w-3.5 text-zinc-500" />}
                checked={showPaths}
                onChange={setShowPaths}
              />
              <Toggle
                label="Event markers"
                icon={<Target className="h-3.5 w-3.5 text-zinc-500" />}
                checked={showEvents}
                onChange={setShowEvents}
              />
              <Toggle
                label="Quadrant grid"
                icon={<Layers className="h-3.5 w-3.5 text-zinc-500" />}
                checked={showGrid}
                onChange={setShowGrid}
              />
              <Toggle
                label="Top hotspots"
                icon={<Flame className="h-3.5 w-3.5 text-zinc-500" />}
                checked={showHotspots}
                onChange={setShowHotspots}
              />
            </div>

            {showEvents ? (
              <div className="mt-2 space-y-1 border-t border-border/60 pt-2">
                {EVENT_ORDER.map((type) => {
                  const meta = EVENT_META[type];
                  const checked = visibleEvents.has(type);
                  return (
                    <label
                      key={type}
                      className="flex cursor-pointer items-center gap-2 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-200"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleEvent(type)}
                        className="accent-accent"
                      />
                      <MarkerGlyph type={type} size={12} />
                      <span className={checked ? "" : "text-zinc-600 line-through"}>{meta.label}</span>
                    </label>
                  );
                })}
              </div>
            ) : null}
          </div>

          {/* Match list */}
          <div className="p-4">
            <SectionTitle
              right={
                <span className="text-[10px] tabular-nums text-zinc-600">
                  {filteredMatches.length} / {manifest?.matches.length ?? 0}
                </span>
              }
            >
              Matches
            </SectionTitle>
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search match id…"
                className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-2 text-xs text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-accent"
              />
            </div>

            {manifestLoading ? (
              <div className="space-y-1.5">
                {[0, 1, 2, 3, 4].map((index) => (
                  <div key={index} className="h-12 animate-pulse rounded-lg bg-white/[0.03]" />
                ))}
              </div>
            ) : filteredMatches.length === 0 ? (
              <EmptyState>No matches for this map and date.</EmptyState>
            ) : (
              <div className="max-h-[42vh] space-y-1 overflow-y-auto pr-1 lg:max-h-[38vh]">
                {filteredMatches.map((summary) => {
                  const active = summary.id === selectedMatch;
                  return (
                    <button
                      key={summary.id}
                      type="button"
                      onClick={() => selectMatch(summary.id)}
                      className={`w-full rounded-lg border px-2.5 py-2 text-left transition-colors ${
                        active
                          ? "border-accent/50 bg-accent/15"
                          : "border-transparent bg-white/[0.02] hover:border-border hover:bg-white/[0.05]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-zinc-300">{shortId(summary.id, 10)}</span>
                        <span className="text-[10px] tabular-nums text-zinc-500">
                          {formatDuration(summary.duration)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[10px] text-zinc-500">
                        <span>{dayLabel(summary.day)}</span>
                        <span className="text-zinc-700">·</span>
                        <span>{formatDate(summary.start).split(", ")[1] ?? ""} UTC</span>
                        <span className="ml-auto flex items-center gap-1.5">
                          <span className="text-sky-400/80">{summary.humans}H</span>
                          <span className="text-amber-400/80">{summary.bots}B</span>
                          {totalKills(summary) > 0 ? (
                            <span className="text-red-400/80">{totalKills(summary)}K</span>
                          ) : null}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* ── Center: map + playback ───────────────────────────────────── */}
        <main className="order-1 flex min-w-0 flex-1 flex-col lg:order-none lg:min-h-0 lg:overflow-y-auto">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border bg-card/30 px-4 py-2 text-[11px] text-zinc-400">
            <span className="flex items-center gap-1.5 font-medium text-zinc-200">
              <MapIcon className="h-3.5 w-3.5 text-accent-light" />
              {mapConfig?.name ?? activeMapId}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {match ? `${dayLabel(match.day)} · ${formatDate(match.start)} UTC` : day ? dayLabel(day) : "Feb 10–14, 2026"}
            </span>
            {match ? (
              <>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDuration(match.duration)}
                </span>
                <Badge tone="human">
                  <User className="h-2.5 w-2.5" /> {match.humans} human{match.humans === 1 ? "" : "s"}
                </Badge>
                <Badge tone="bot">
                  <Bot className="h-2.5 w-2.5" /> {match.bots} bot{match.bots === 1 ? "" : "s"}
                </Badge>
                <span className="font-mono text-[10px] text-zinc-600">{shortId(match.id, 14)}</span>
              </>
            ) : (
              <>
                <Badge tone="accent">
                  <Flame className="h-2.5 w-2.5" /> {HEATMAP_META[heatmapType].label}
                </Badge>
                {mapStats ? (
                  <span>
                    {formatCompact(mapStats.matches)} matches · {mapStats.humans} humans ·{" "}
                    {mapStats.bots} bots
                  </span>
                ) : null}
              </>
            )}
          </div>

          <div className="flex flex-1 flex-col p-3 sm:p-4">
            <div className="mx-auto w-full max-w-[min(100%,calc(100vh-15rem))]">
              <MapCanvas
                map={mapConfig}
                match={match ?? null}
                heatmapGrid={heatmapGrid}
                heatmapType={heatmapType}
                showHeatmap={showHeatmap}
                heatmapOpacity={heatmapOpacity}
                showHumans={showHumans}
                showBots={showBots}
                showPaths={showPaths}
                showEvents={showEvents}
                visibleEvents={visibleEvents}
                playhead={playback.playhead}
                focusedPlayer={focusedPlayer}
                showGrid={showGrid}
                showHotspots={showHotspots && !match}
                hotspots={hotspots}
                focusTarget={focusTarget}
                onFocusConsumed={() => setFocusTarget(null)}
              />

              {matchLoading ? (
                <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  Loading match {shortId(selectedMatch)}…
                </div>
              ) : null}
              {matchError ? (
                <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300">
                  Could not load this match. It may not exist in the dataset.
                </div>
              ) : null}
            </div>

            {/* Playback */}
            {match ? (
              <div className="mx-auto mt-3 w-full max-w-[min(100%,calc(100vh-15rem))] rounded-xl border border-border bg-card/60 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <IconButton
                    label="Restart match"
                    onClick={() => {
                      playback.seek(0);
                      playback.play();
                    }}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton label="Back 10 seconds" onClick={() => playback.seek(playback.playhead - 10)}>
                    <SkipBack className="h-3.5 w-3.5" />
                  </IconButton>
                  <button
                    type="button"
                    onClick={playback.toggle}
                    aria-label={playback.isPlaying ? "Pause playback" : "Play match"}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent/25 transition-colors hover:bg-accent/85"
                  >
                    {playback.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
                  </button>
                  <IconButton label="Forward 10 seconds" onClick={() => playback.seek(playback.playhead + 10)}>
                    <SkipForward className="h-3.5 w-3.5" />
                  </IconButton>

                  <div className="min-w-0 flex-1 px-1">
                    <input
                      type="range"
                      min={0}
                      max={Math.max(0.1, match.duration)}
                      step={0.1}
                      value={playback.playhead}
                      onChange={(event) => playback.seek(Number(event.target.value))}
                      aria-label="Match timeline"
                      className="w-full"
                    />
                  </div>

                  <span className="w-24 shrink-0 text-right font-mono text-[11px] tabular-nums text-zinc-400">
                    {formatDuration(playback.playhead)} / {formatDuration(match.duration)}
                  </span>

                  <label className="flex shrink-0 items-center gap-1 text-[10px] text-zinc-500">
                    <Gauge className="h-3.5 w-3.5" />
                    <select
                      value={playback.speed}
                      onChange={(event) => playback.setSpeed(Number(event.target.value))}
                      className="rounded border border-border bg-background px-1.5 py-1 text-[11px] text-zinc-300 outline-none focus:border-accent"
                      aria-label="Playback speed"
                    >
                      {PLAYBACK_SPEEDS.map((speed) => (
                        <option key={speed} value={speed}>
                          {speed}×
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-zinc-600">
                  <span>Playback is match-relative. Trails and markers reveal up to the playhead.</span>
                  <span>{playback.isPlaying ? "Playing" : "Paused"}</span>
                </div>
              </div>
            ) : (
              <p className="mx-auto mt-2 w-full max-w-[min(100%,calc(100vh-15rem))] text-[10px] leading-4 text-zinc-600">
                Overview mode shows the aggregated {HEATMAP_META[heatmapType].label.toLowerCase()} heatmap for{" "}
                {mapConfig?.name ?? activeMapId}. Pick a match from the list to replay a single journey.
              </p>
            )}
          </div>
        </main>

        {/* ── Right: details ───────────────────────────────────────────── */}
        <aside className="order-3 w-full shrink-0 border-t border-border bg-card/40 lg:order-none lg:w-64 lg:overflow-y-auto lg:border-l lg:border-t-0 xl:w-80">
          {match ? (
            <>
              <div className="border-b border-border p-4">
                <SectionTitle>Match summary</SectionTitle>
                <div className="grid grid-cols-2 gap-1.5">
                  <StatTile label="Duration" value={formatDuration(match.duration)} icon={<Clock className="h-3 w-3" />} />
                  <StatTile label="Events" value={formatCompact(Object.values(match.events).reduce((a, b) => a + b, 0) + match.players.reduce((sum, p) => sum + p.path.length, 0))} icon={<Activity className="h-3 w-3" />} />
                  <StatTile label="Humans" value={String(match.humans)} icon={<User className="h-3 w-3" />} />
                  <StatTile label="Bots" value={String(match.bots)} icon={<Bot className="h-3 w-3" />} />
                </div>

                <div className="mt-3 space-y-1.5">
                  {EVENT_ORDER.map((type) => (
                    <StatRow
                      key={type}
                      label={EVENT_META[type].label}
                      value={formatNumber(match.events[type] ?? 0)}
                      color={type === "Loot" ? "text-emerald-400" : type === "KilledByStorm" ? "text-violet-400" : "text-zinc-200"}
                    />
                  ))}
                </div>
              </div>

              <div className="border-b border-border p-4">
                <SectionTitle
                  right={
                    <button
                      type="button"
                      onClick={() => setShowAllPlayers((value) => !value)}
                      className="text-[10px] text-zinc-500 hover:text-zinc-300"
                    >
                      {showAllPlayers ? "Collapse" : "Show all"}
                    </button>
                  }
                >
                  Journeys
                </SectionTitle>
                <div className="space-y-1">
                  {match.players
                    .slice()
                    .sort((a, b) => Number(a.isBot) - Number(b.isBot) || b.distance - a.distance)
                    .slice(0, showAllPlayers ? undefined : 10)
                    .map((player) => {
                      const active = focusedPlayer === player.id;
                      return (
                        <button
                          key={player.id}
                          type="button"
                          onClick={() => focusPlayer(player)}
                          className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors ${
                            active
                              ? "border-accent/50 bg-accent/15"
                              : "border-transparent bg-white/[0.02] hover:border-border hover:bg-white/[0.05]"
                          }`}
                        >
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: player.isBot ? PLAYER_COLORS.bot : PLAYER_COLORS.human }}
                          />
                          <span className="min-w-0 flex-1">
                            <span className={`block truncate font-mono text-[11px] ${player.isBot ? "text-amber-300/90" : "text-sky-300/90"}`}>
                              {player.isBot ? `bot ${player.id}` : shortId(player.id, 12)}
                            </span>
                            <span className="block text-[9px] text-zinc-600">
                              {player.isBot ? "Bot" : "Human"} · {formatNumber(Math.round(player.distance))} units ·{" "}
                              {player.path.length} samples
                            </span>
                          </span>
                          <ChevronRight className="h-3 w-3 shrink-0 text-zinc-600" />
                        </button>
                      );
                    })}
                </div>
                {focusedPlayer ? (
                  <button
                    type="button"
                    onClick={() => setFocusedPlayer(null)}
                    className="mt-2 text-[10px] text-accent-light hover:underline"
                  >
                    Clear player focus
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <div className="border-b border-border p-4">
                <SectionTitle>Dataset</SectionTitle>
                <div className="grid grid-cols-2 gap-1.5">
                  <StatTile label="Matches" value={formatCompact(manifest?.dataset.matches ?? 0)} icon={<Layers className="h-3 w-3" />} />
                  <StatTile label="Rows" value={formatCompact(manifest?.dataset.rows ?? 0)} icon={<Activity className="h-3 w-3" />} />
                  <StatTile label="Humans" value={String(manifest?.dataset.humans ?? 0)} icon={<User className="h-3 w-3" />} />
                  <StatTile label="Bots" value={String(manifest?.dataset.bots ?? 0)} icon={<Bot className="h-3 w-3" />} />
                </div>
                <div className="mt-2 space-y-1.5">
                  <StatRow label="Parquet files" value={formatNumber(manifest?.dataset.files ?? 0)} />
                  <StatRow
                    label="Window"
                    value={
                      manifest?.dataset.dateRange.start && manifest.dataset.dateRange.end
                        ? `${formatDate(manifest.dataset.dateRange.start)} → ${formatDate(manifest.dataset.dateRange.end)} UTC`
                        : "—"
                    }
                  />
                  <StatRow label="PvP kills" value={formatNumber(manifest?.dataset.eventCounts.Kill ?? 0)} />
                  <StatRow label="Bot kills" value={formatNumber(manifest?.dataset.eventCounts.BotKill ?? 0)} />
                  <StatRow label="Storm deaths" value={formatNumber(manifest?.dataset.eventCounts.KilledByStorm ?? 0)} />
                  <StatRow label="Loot pickups" value={formatNumber(manifest?.dataset.eventCounts.Loot ?? 0)} />
                </div>
              </div>

              <div className="border-b border-border p-4">
                <SectionTitle
                  right={<Badge tone="accent">{HEATMAP_META[heatmapType].label}</Badge>}
                >
                  Spatial report
                </SectionTitle>
                {report ? (
                  <>
                    <p className="mb-2 text-[10px] leading-4 text-zinc-500">
                      {HEATMAP_META[heatmapType].description} · {day ? dayLabel(day) : "all days"}
                    </p>
                    <QuadrantGrid counts={report.quadrants[reportKey]} />
                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-zinc-600">
                        <span>Top hotspots</span>
                        <span>share</span>
                      </div>
                      <div className="space-y-1">
                        {hotspots.slice(0, 6).map((hotspot, index) => {
                          const world = mapConfig
                            ? pixelToWorld(hotspot.x, hotspot.y, mapConfig)
                            : { x: 0, z: 0 };
                          return (
                            <button
                              key={hotspot.cell}
                              type="button"
                              onClick={() => focusOn(hotspot.x, hotspot.y)}
                              className="flex w-full items-center gap-2 rounded-md border border-transparent bg-white/[0.02] px-2 py-1 text-left text-[11px] text-zinc-400 transition-colors hover:border-border hover:bg-white/[0.05]"
                            >
                              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/10 text-[9px] font-semibold text-zinc-300">
                                {index + 1}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block tabular-nums text-zinc-300">
                                  {formatNumber(hotspot.count)} events
                                </span>
                                <span className="block font-mono text-[9px] text-zinc-600">
                                  world {Math.round(world.x)}, {Math.round(world.z)}
                                </span>
                              </span>
                              <span className="tabular-nums text-zinc-500">{formatPercent(hotspot.share)}</span>
                            </button>
                          );
                        })}
                        {hotspots.length === 0 ? (
                          <p className="text-[10px] text-zinc-600">No events for this layer yet.</p>
                        ) : null}
                      </div>
                    </div>
                  </>
                ) : (
                  <EmptyState>Select a map to see its spatial report.</EmptyState>
                )}
              </div>

              <div className="p-4">
                <SectionTitle>How to read this</SectionTitle>
                <div className="space-y-2 text-[10px] leading-4 text-zinc-500">
                  <p className="flex gap-2">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: PLAYER_COLORS.human }} />
                    <span>
                      <strong className="text-zinc-300">Humans</strong> have UUID user ids. Their trails are solid and
                      brighter than bot trails.
                    </span>
                  </p>
                  <p className="flex gap-2">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: PLAYER_COLORS.bot }} />
                    <span>
                      <strong className="text-zinc-300">Bots</strong> have numeric user ids and thinner, dimmer trails.
                    </span>
                  </p>
                  <p className="flex gap-2">
                    <Flame className="mt-0.5 h-3 w-3 shrink-0 text-zinc-600" />
                    <span>
                      Heatmaps aggregate 64×64 grid cells with a Gaussian blur. Click a hotspot to zoom to it.
                    </span>
                  </p>
                  <p className="flex gap-2">
                    <Skull className="mt-0.5 h-3 w-3 shrink-0 text-zinc-600" />
                    <span>
                      Deaths include bot kills, PvP deaths and storm deaths. Storm deaths use a violet triangle.
                    </span>
                  </p>
                </div>
              </div>
            </>
          )}

          <div className="border-t border-border px-4 py-3 text-[9px] leading-4 text-zinc-600">
            {manifest ? (
              <>
                Generated {formatDate(manifest.generatedAt)} UTC · {manifest.source}
              </>
            ) : (
              "Static dataset"
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
