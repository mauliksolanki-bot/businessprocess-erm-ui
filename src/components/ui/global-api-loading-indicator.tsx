"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

const API_LOADING_EVENT = "erm:api-loading";

export function GlobalApiLoadingIndicator() {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let showTimer: ReturnType<typeof setTimeout> | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    const handleLoading = (event: Event) => {
      const detail = (event as CustomEvent<{ count: number }>).detail;
      const active = (detail?.count ?? 0) > 0;

      if (showTimer) clearTimeout(showTimer);
      if (hideTimer) clearTimeout(hideTimer);

      if (active) {
        showTimer = setTimeout(() => setIsLoading(true), 160);
      } else {
        hideTimer = setTimeout(() => setIsLoading(false), 240);
      }
    };

    window.addEventListener(API_LOADING_EVENT, handleLoading);
    return () => {
      window.removeEventListener(API_LOADING_EVENT, handleLoading);
      if (showTimer) clearTimeout(showTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, []);

  if (!isLoading) return null;

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-0 z-[120]" role="status">
      <div className="h-0.5 overflow-hidden bg-blue-100">
        <div className="h-full w-1/3 animate-[loading-sweep_1.4s_ease-in-out_infinite] rounded-full bg-blue-600" />
      </div>
      <div className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-2 rounded-full border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-600 shadow-md shadow-zinc-900/10 sm:top-4">
        <LoaderCircle className="h-3.5 w-3.5 animate-spin text-blue-600" />
        <span>Loading</span>
      </div>
    </div>
  );
}
