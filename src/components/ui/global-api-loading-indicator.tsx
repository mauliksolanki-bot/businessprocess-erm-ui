"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";

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
      <div className="h-1 overflow-hidden bg-indigo-100/80">
        <div className="h-full w-1/3 animate-[loading-sweep_1.15s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-sky-500 via-indigo-600 to-fuchsia-500 shadow-[0_0_12px_rgba(99,102,241,0.65)]" />
      </div>
      <div className="absolute right-4 top-3 flex items-center gap-2.5 rounded-full border border-white/80 bg-white/90 px-3.5 py-2 text-xs font-medium text-slate-600 shadow-lg shadow-slate-900/10 backdrop-blur-xl sm:right-6 sm:top-4">
        <span className="relative flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-indigo-50 to-fuchsia-50 text-indigo-600">
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          <Sparkles className="absolute -right-1 -top-1 h-2.5 w-2.5 text-fuchsia-500" />
        </span>
        <span>Loading your data</span>
        <span className="flex items-center gap-0.5" aria-hidden="true">
          <span className="h-1 w-1 animate-bounce rounded-full bg-indigo-400" />
          <span className="h-1 w-1 animate-bounce rounded-full bg-indigo-400 [animation-delay:100ms]" />
          <span className="h-1 w-1 animate-bounce rounded-full bg-fuchsia-400 [animation-delay:200ms]" />
        </span>
      </div>
    </div>
  );
}
