"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Sparkles } from "lucide-react";

import { cn } from "@/components/ui/cn";
import { ErmLogo } from "@/components/erm/logo";
import { resolveNavIcon } from "@/lib/navigation-icons";
import type { NavigationMenu } from "@/lib/api";

type SidebarNavProps = {
  menu: NavigationMenu[];
};

export function SidebarNav({ menu }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden h-full w-80 shrink-0 border-r border-white/60 bg-white/80 p-4 backdrop-blur-xl md:block">
      <div className="flex h-full flex-col rounded-[28px] border border-zinc-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
        <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-4 text-white shadow-lg shadow-blue-600/25">
          <ErmLogo tone="light" />
          <div className="mt-4 flex items-center gap-2 text-xs text-blue-50/90">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Dynamic role-based workspace</span>
          </div>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto pr-1">
          <p className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
            Navigation
          </p>
          <div className="space-y-1.5">
            {menu.map((item) => {
              const Icon = resolveNavIcon(item.icon);
              const isActive = pathname === item.path;

              return (
                <Link
                  className={cn(
                    "group relative flex items-center gap-3 overflow-hidden rounded-2xl border px-3.5 py-3 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "border-blue-200 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/25"
                      : "border-transparent bg-white/70 text-zinc-700 hover:border-zinc-200 hover:bg-white hover:shadow-sm"
                  )}
                  href={item.path}
                  key={item.code}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all",
                      isActive ? "bg-white/15 text-white" : "bg-zinc-100 text-zinc-600 group-hover:bg-blue-50 group-hover:text-blue-600"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1 text-left">{item.title}</span>
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 transition-transform",
                      isActive ? "text-white/90" : "text-zinc-400 group-hover:translate-x-0.5 group-hover:text-zinc-600"
                    )}
                  />
                  {isActive ? <span className="absolute inset-y-0 left-0 w-1 rounded-r-full bg-white/90" /> : null}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-zinc-200 bg-white/80 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Quick tip</p>
          <p className="mt-1 text-sm text-zinc-600">Only authorized modules appear for the signed-in role.</p>
        </div>
      </div>
    </aside>
  );
}
