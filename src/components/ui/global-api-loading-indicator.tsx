"use client";

import { useEffect, useState } from "react";
import { ApiLoaderAnimation } from "@/components/ui/spinner";

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
        showTimer = setTimeout(() => setIsLoading(true), 100);
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
    <div aria-live="polite" className="pointer-events-none fixed inset-0 z-[120] flex items-center justify-center bg-zinc-950/10 p-4 backdrop-blur-[2px]" role="status">
      <div className="min-w-52 rounded-2xl border border-zinc-200 bg-white px-7 py-5 shadow-xl shadow-zinc-900/10">
        <div className="flex flex-col items-center gap-3">
          <ApiLoaderAnimation />
          <span className="text-sm font-medium text-zinc-600">Loading...</span>
        </div>
      </div>
    </div>
  );
}
