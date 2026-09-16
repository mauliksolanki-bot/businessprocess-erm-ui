import { Orbit } from "lucide-react";

type ErmLogoProps = {
  tone?: "default" | "light";
};

export function ErmLogo({ tone = "default" }: ErmLogoProps) {
  const isLight = tone === "light";

  return (
    <div className="flex items-center gap-2">
      <div
        className={
          isLight
            ? "flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-100 via-indigo-100 to-violet-100 text-indigo-600 shadow-lg shadow-indigo-200/60 ring-1 ring-white/80"
            : "flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/30"
        }
      >
        <Orbit className="h-5 w-5" />
      </div>
      <div>
        <p className={isLight ? "text-sm font-semibold tracking-wide text-white" : "text-sm font-semibold tracking-wide text-zinc-900"}>
          ERM
        </p>
        <p className={isLight ? "text-[11px] text-blue-50/80" : "text-[11px] text-zinc-500"}>Resource Management</p>
      </div>
    </div>
  );
}
