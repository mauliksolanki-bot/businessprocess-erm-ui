/**
 * Inline loading placeholder. Visual loading feedback is reserved for the
 * full-page route fallback so API activity does not add another loader.
 */
export function Spinner({ label = "Loading..." }: { size?: "sm" | "md" | "lg"; label?: string; className?: string }) {
  return (
    <span aria-live="polite" className="sr-only" role="status">
      {label}
    </span>
  );
}

export function LoaderAnimation() {
  const colors = ["bg-[#e53735]", "bg-[#1e88e5]", "bg-[#43a047]", "bg-[#fdd835]", "bg-[#fb8c00]"];
  const delays = ["", "[animation-delay:167ms]", "[animation-delay:334ms]", "[animation-delay:501ms]", "[animation-delay:668ms]"];

  return (
    <span className="flex items-center gap-2" aria-hidden="true">
      {colors.map((color, index) => (
        <span
          className={`h-4 w-4 animate-[loader-bounce_1.34s_ease-in-out_infinite] rounded-full shadow-sm motion-reduce:animate-none ${color} ${delays[index]}`}
          key={color}
        />
      ))}
    </span>
  );
}
