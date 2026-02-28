"use client";

import { ChevronDown, ChevronUp, HelpCircle } from "lucide-react";
import { useState } from "react";
import { cn } from "../lib/utils";

type DisclosureHelpProps = {
  title: string;
  children: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
};

export default function DisclosureHelp({
  title,
  children,
  className,
  defaultOpen = false,
}: DisclosureHelpProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn("rounded-lg border border-slate-200 bg-slate-50/70", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
          <HelpCircle className="h-3.5 w-3.5 text-blue-600" />
          {title}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>
      {open ? <div className="border-t border-slate-200 px-3 py-2 text-xs leading-relaxed text-slate-600">{children}</div> : null}
    </div>
  );
}
