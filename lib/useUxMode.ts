"use client";

import { useEffect, useState } from "react";
import { getDefaultUxMode, subscribeUxMode, type UxMode } from "./uxMode";

export function useUxMode() {
  const [mode, setMode] = useState<UxMode>("guided");

  useEffect(() => {
    setMode(getDefaultUxMode());
    const unsubscribe = subscribeUxMode(setMode);
    return unsubscribe;
  }, []);

  return mode;
}
