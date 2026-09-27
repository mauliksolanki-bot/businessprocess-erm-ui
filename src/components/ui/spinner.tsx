import { cn } from "@/lib/utils";

export function Spinner({
  size = "md",
  label,
  className,
}: {
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}) {
  return (
    <div aria-label={label ?? "Loading data"} aria-live="polite" className={cn("flex flex-col items-center justify-center gap-2", className)} role="status">
      <LoaderAnimation size={size} />
      {label && <span className="text-sm font-medium text-zinc-600">{label}</span>}
    </div>
  );
}

export function LoaderAnimation({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const colors = ["bg-[#e53735]", "bg-[#1e88e5]", "bg-[#43a047]", "bg-[#fdd835]", "bg-[#fb8c00]"];
  const delays = ["", "[animation-delay:167ms]", "[animation-delay:334ms]", "[animation-delay:501ms]", "[animation-delay:668ms]"];
  const dotSize = size === "sm" ? "h-2.5 w-2.5" : size === "lg" ? "h-4 w-4" : "h-3 w-3";
  const gap = size === "sm" ? "gap-1" : size === "lg" ? "gap-2" : "gap-1.5";

  return (
    <span className={`flex items-center ${gap}`} aria-hidden="true">
      {colors.map((color, index) => (
        <span
          className={`${dotSize} animate-[loader-bounce_1.34s_ease-in-out_infinite] rounded-full motion-reduce:animate-none ${color} ${delays[index]}`}
          key={color}
        />
      ))}
    </span>
  );
}
