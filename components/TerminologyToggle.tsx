"use client";

import { useEffect, useState } from "react";

const KEY = "qrs-show-quant-terms";

export default function TerminologyToggle() {
  const [showQuant, setShowQuant] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(KEY);
    setShowQuant(stored === "1");
  }, []);

  function onChange(next: boolean) {
    setShowQuant(next);
    window.localStorage.setItem(KEY, next ? "1" : "0");
  }

  return (
    <label className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600">
      <input type="checkbox" checked={showQuant} onChange={(e) => onChange(e.target.checked)} />
      Show quant terms
    </label>
  );
}
