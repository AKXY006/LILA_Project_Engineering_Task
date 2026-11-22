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
}: {
  label: string;
  hint?: string;
  icon?: ReactNode;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="group flex cursor-pointer items-center justify-between gap-3 py-1">
      <span className="flex min-w-0 items-center gap-2 text-xs text-zinc-300">
        {icon}
        <span className="truncate">{label}</span>
        {hint ? <span className="truncate text-[10px] text-zinc-600">{hint}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-4 w-8 shrink-0 rounded-full transition-colors ${
          checked ? "bg-accent" : "bg-zinc-700"
        }`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
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
