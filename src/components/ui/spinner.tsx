import { cn } from "@/lib/utils";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}

const dotColors = ["bg-[#e53735]", "bg-[#1e88e5]", "bg-[#43a047]", "bg-[#fdd835]", "bg-[#fb8c00]"];
const dotDelays = ["", "[animation-delay:167ms]", "[animation-delay:334ms]", "[animation-delay:501ms]", "[animation-delay:668ms]"];

export function Spinner({ size = "md", label, className }: SpinnerProps) {
  const dotSize = size === "sm" ? "h-2.5 w-2.5" : size === "lg" ? "h-4 w-4" : "h-3 w-3";
  const gap = size === "lg" ? "gap-2" : "gap-1.5";

  return (
    <div aria-live="polite" className={cn("flex flex-col items-center justify-center gap-3", className)} role="status">
      <span className={cn("flex items-center", gap)} aria-hidden="true">
        {dotColors.map((color, index) => (
          <span
            className={cn("animate-[loader-bounce_1.34s_ease-in-out_infinite] rounded-full shadow-sm", dotSize, color, dotDelays[index], "motion-reduce:animate-none")}
            key={color}
          />
        ))}
      </span>
      {label && <span className="text-sm font-medium text-zinc-600">{label}</span>}
    </div>
  );
}

export function FullPageLoader({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex min-h-[160px] items-center justify-center rounded-2xl border border-zinc-200 bg-white px-6 py-8 shadow-sm">
      <div className="flex flex-col items-center gap-4 text-center">
        <Spinner size="lg" label={label} />
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">ERM Portal</span>
      </div>
    </div>
  );
}
