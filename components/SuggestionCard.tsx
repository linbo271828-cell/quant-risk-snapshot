"use client";

import { Lightbulb } from "lucide-react";
import { cn } from "../lib/utils";

type SuggestionCardProps = {
  title: string;
  reason: string;
  confidence: "low" | "medium" | "high";
  actionLabel?: string;
  onApply?: () => void;
  className?: string;
};

const CONFIDENCE_STYLE: Record<SuggestionCardProps["confidence"], string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-emerald-100 text-emerald-700",
};

export default function SuggestionCard({
  title,
  reason,
  confidence,
  actionLabel,
  onApply,
  className,
}: SuggestionCardProps) {
  return (
    <div className={cn("card-surface p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Lightbulb className="h-4 w-4 text-yellow-500" />
          {title}
        </div>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", CONFIDENCE_STYLE[confidence])}>
          {confidence}
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-600">{reason}</p>
      {actionLabel && onApply ? (
        <button
          type="button"
          onClick={onApply}
          className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
