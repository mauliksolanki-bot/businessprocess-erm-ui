import { LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}

export function Spinner({ size = "md", label, className }: SpinnerProps) {
  const iconSize = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-8 w-8" : "h-6 w-6";

  return (
    <div aria-live="polite" className={cn("flex flex-col items-center justify-center gap-3", className)} role="status">
      <LoaderCircle className={cn("animate-spin text-blue-600", iconSize)} strokeWidth={2} />
      {label && <p className="text-sm font-medium text-zinc-600">{label}</p>}
    </div>
  );
}

export function FullPageLoader({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-zinc-200 bg-white px-6 py-8 shadow-sm">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
          <Spinner size="md" />
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-800">ERM Portal</p>
          <p className="mt-1 text-sm text-zinc-500">{label}</p>
        </div>
        <div className="h-1 w-28 overflow-hidden rounded-full bg-zinc-100" aria-hidden="true">
          <div className="h-full w-1/2 animate-[loading-sweep_1.4s_ease-in-out_infinite] rounded-full bg-blue-600" />
        </div>
      </div>
    </div>
  );
}
