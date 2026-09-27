/**
 * Inline loading placeholder. The shared page and API loaders render the
 * animated indicator, preventing page sections from duplicating it.
 */
export function Spinner({ label = "Loading..." }: { size?: "sm" | "md" | "lg"; label?: string; className?: string }) {
  return (
    <span aria-live="polite" className="sr-only" role="status">
      {label}
    </span>
  );
}

export function LoaderAnimation({ size = "md" }: { size?: "sm" | "md" }) {
  const colors = ["bg-[#e53735]", "bg-[#1e88e5]", "bg-[#43a047]", "bg-[#fdd835]", "bg-[#fb8c00]"];
  const delays = ["", "[animation-delay:167ms]", "[animation-delay:334ms]", "[animation-delay:501ms]", "[animation-delay:668ms]"];
  const dotSize = size === "sm" ? "h-2.5 w-2.5" : "h-4 w-4";
  const gap = size === "sm" ? "gap-1" : "gap-2";

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
