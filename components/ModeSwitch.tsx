"use client";

import { useEffect, useState } from "react";
import { getDefaultUxMode, setUxMode, type UxMode } from "../lib/uxMode";
import { cn } from "../lib/utils";

export default function ModeSwitch() {
  const [mode, setMode] = useState<UxMode>("guided");

  useEffect(() => {
    setMode(getDefaultUxMode());
  }, []);

  function update(next: UxMode) {
    setMode(next);
    setUxMode(next);
  }

  return (
    <div className="ml-2 inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
      <button
        type="button"
        onClick={() => update("guided")}
        className={cn(
          "rounded px-2 py-1 text-[11px] font-semibold",
          mode === "guided" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600",
        )}
      >
        Guided
      </button>
      <button
        type="button"
        onClick={() => update("advanced")}
        className={cn(
          "rounded px-2 py-1 text-[11px] font-semibold",
          mode === "advanced" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600",
        )}
      >
        Advanced
      </button>
    </div>
  );
}
