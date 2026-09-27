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
      className="absolute left-1/2 top-24 z-20 -translate-x-1/2"
      role="status"
    >
      <div className="inline-flex items-center gap-2.5 whitespace-nowrap rounded-full border border-zinc-200 bg-white px-3.5 py-2 shadow-sm">
        <LoaderAnimation size="sm" />
        <span className="text-xs font-medium text-zinc-600">Loading data...</span>
      </div>
    </div>
  );
}
