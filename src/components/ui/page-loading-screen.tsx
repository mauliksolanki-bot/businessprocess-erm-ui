import { ErmLogo } from "@/components/erm/logo";
import { FullPageLoader } from "@/components/ui/spinner";

export function PageLoadingScreen() {
  return (
    <main className="min-h-screen bg-zinc-50 p-4 sm:p-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1600px] flex-col rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:min-h-[calc(100vh-3rem)] sm:p-5">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-100 px-2 pb-4 sm:px-3">
          <ErmLogo />
          <div className="h-9 w-9 animate-pulse rounded-xl bg-zinc-100" aria-hidden="true" />
        </header>

        <div className="grid flex-1 gap-5 pt-5 md:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="hidden rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 md:block" aria-hidden="true">
            <div className="mb-6 h-3 w-24 animate-pulse rounded bg-zinc-200" />
            <div className="space-y-2.5">
              {Array.from({ length: 7 }, (_, index) => (
                <div key={index} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                  <span className="h-4 w-4 animate-pulse rounded bg-zinc-200" />
                  <span className="h-3 w-24 animate-pulse rounded bg-zinc-200" />
                </div>
              ))}
            </div>
          </aside>

          <section className="flex min-w-0 flex-col gap-5" aria-label="Loading page">
            <div className="space-y-3 py-1" aria-hidden="true">
              <div className="h-6 w-48 animate-pulse rounded bg-zinc-200" />
              <div className="h-3 w-72 max-w-full animate-pulse rounded bg-zinc-100" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3" aria-hidden="true">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="h-28 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-50" />
              ))}
            </div>
            <div className="min-h-56 flex-1">
              <FullPageLoader label="Preparing your workspace..." />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
