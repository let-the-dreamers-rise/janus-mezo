"use client";

import { useEffect, useState } from "react";

/// False during prerendering and the first client render, true after hydration. Gates UI
/// that depends on browser-only state, such as which wallet connectors exist.
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
