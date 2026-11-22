"use client";

import type { ReactNode } from "react";

export function SectionTitle({
  children,
  right,
}: {
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
        {children}
      </h2>
      {right}
    </div>
  );
}

export function Toggle({
  label,
  hint,
  icon,
  checked,
  onChange,
  accent = "var(--accent-light)",
}: {
  label: string;
  hint?: string;
  icon?: ReactNode;
  checked: boolean;
  onChange: (value: boolean) => void;
  accent?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 transition-colors ${
        checked
          ? "border-white/10 bg-white/[0.045]"
          : "border-transparent bg-black/10 opacity-70 hover:border-white/5 hover:opacity-100"
      }`}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border"
          style={{
            color: checked ? accent : "#71717a",
            borderColor: checked ? `color-mix(in srgb, ${accent} 25%, transparent)` : "rgba(255,255,255,0.06)",
            backgroundColor: checked ? `color-mix(in srgb, ${accent} 7%, transparent)` : "rgba(255,255,255,0.025)",
          }}
        >
          {icon}
        </span>
        <span className="min-w-0">
          <span className={`block truncate text-[11px] font-medium ${checked ? "text-zinc-200" : "text-zinc-500"}`}>
            {label}
          </span>
          {hint ? <span className="mt-0.5 block truncate text-[9px] text-zinc-600">{hint}</span> : null}
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={`${label} layer`}
        onClick={() => onChange(!checked)}
        className="relative h-5 w-9 shrink-0 rounded-full border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{
          borderColor: checked ? `${accent}90` : "rgba(255,255,255,0.12)",
          backgroundColor: checked ? accent : "#27272a",
        }}
      >
        <span
          className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-[17px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

export function StatRow({
  label,
  value,
  color,
  title,
}: {
  label: string;
  value: ReactNode;
  color?: string;
  title?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3" title={title}>
      <span className="text-xs text-zinc-500">{label}</span>
      <span className={`text-xs font-medium tabular-nums ${color ?? "text-zinc-200"}`}>
        {value}
      </span>
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  title,
}: {
  children: ReactNode;
  tone?: "neutral" | "human" | "bot" | "kill" | "storm" | "loot" | "accent";
  title?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "border-border bg-white/5 text-zinc-400",
    human: "border-sky-400/25 bg-sky-400/10 text-sky-300",
    bot: "border-amber-400/25 bg-amber-400/10 text-amber-300",
    kill: "border-red-400/25 bg-red-400/10 text-red-300",
    storm: "border-violet-400/25 bg-violet-400/10 text-violet-300",
    loot: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
    accent: "border-violet-400/25 bg-violet-400/10 text-violet-200",
  };
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-4 ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function IconButton({
  label,
  onClick,
  children,
  active,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
        active
          ? "border-accent/50 bg-accent/20 text-accent-light"
          : "border-border bg-white/5 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-white/[0.02] p-4 text-xs leading-5 text-zinc-500">
      {children}
    </div>
  );
}
