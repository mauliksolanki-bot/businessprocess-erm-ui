import { cn } from "@/lib/utils";
import { LoaderCircle, Sparkles } from "lucide-react";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}

export function Spinner({ size = "md", label, className }: SpinnerProps) {
  const ringSize = size === "sm" ? "h-5 w-5" : size === "lg" ? "h-10 w-10" : "h-7 w-7";

  return (
    <div aria-live="polite" className={cn("flex flex-col items-center justify-center gap-3", className)} role="status">
      <span className="relative flex items-center justify-center">
        <span className={cn("absolute rounded-full bg-indigo-400/15 blur-md", size === "lg" ? "h-14 w-14" : "h-11 w-11")} />
        <LoaderCircle className={cn("relative animate-spin text-indigo-600", ringSize)} strokeWidth={2.25} />
        {size !== "sm" && <Sparkles className="absolute -right-1 -top-1 h-3.5 w-3.5 animate-pulse text-fuchsia-500" />}
      </span>
      {label && <p className="text-sm font-medium tracking-wide text-slate-600">{label}</p>}
    </div>
  );
}

export function FullPageLoader({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="relative flex min-h-[240px] items-center justify-center overflow-hidden rounded-3xl border border-white/80 bg-white/70 shadow-xl shadow-indigo-950/5 backdrop-blur-xl">
      <div className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full bg-blue-200/45 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 h-56 w-56 rounded-full bg-fuchsia-200/35 blur-3xl" />
      <div className="relative flex flex-col items-center gap-4 px-8 py-10 text-center">
        <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-white to-indigo-50 p-4 shadow-lg shadow-indigo-900/10">
          <Spinner size="lg" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">ERM Portal</p>
          <p className="mt-1 text-sm text-slate-500">{label}</p>
        </div>
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="h-1.5 w-5 animate-pulse rounded-full bg-blue-500" />
          <span className="h-1.5 w-5 animate-pulse rounded-full bg-indigo-500 [animation-delay:150ms]" />
          <span className="h-1.5 w-5 animate-pulse rounded-full bg-fuchsia-500 [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
