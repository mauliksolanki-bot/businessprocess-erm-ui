"use client";

import { useEffect, useState } from "react";

import { LoaderAnimation } from "@/components/ui/spinner";

const API_LOADING_EVENT = "erm:api-loading";

export function GlobalApiLoadingIndicator() {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    const handleLoading = (event: Event) => {
      const detail = (event as CustomEvent<{ count: number }>).detail;
      const active = (detail?.count ?? 0) > 0;

      if (hideTimer) clearTimeout(hideTimer);

      if (active) {
        setIsLoading(true);
      } else {
        hideTimer = setTimeout(() => setIsLoading(false), 220);
      }
    };

    window.addEventListener(API_LOADING_EVENT, handleLoading);
    return () => {
      window.removeEventListener(API_LOADING_EVENT, handleLoading);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, []);

  if (!isLoading) return null;

  return (
    <div
      aria-live="polite"
      className="absolute inset-0 z-40 flex items-center justify-center bg-zinc-950/10 p-4 backdrop-blur-[1px]"
      role="status"
    >
      <div className="rounded-2xl border border-zinc-200 bg-white/95 px-8 py-6 shadow-xl shadow-zinc-900/10 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-3">
          <LoaderAnimation />
          <span className="text-sm font-medium text-zinc-600">Loading...</span>
        </div>
      </div>
    </div>
  );
}
