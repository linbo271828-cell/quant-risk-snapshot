"use client";

import { useEffect, useState } from "react";
import type { HoldingsInput } from "@/lib/types";

const STORAGE_KEY = "quant-risk-input";

export function useStoredPortfolioInput() {
  const [input, setInput] = useState<HoldingsInput | null>(null);
  const [storageError, setStorageError] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    try {
      setInput(JSON.parse(stored) as HoldingsInput);
    } catch {
      setStorageError("Failed to read saved input.");
    }
  }, []);

  return { input, setInput, storageError };
}
