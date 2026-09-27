import { FullPageLoader } from "@/components/ui/spinner";

export function PageLoadingScreen() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_15%_0%,#dbeafe_0,transparent_34%),radial-gradient(circle_at_90%_100%,#fae8ff_0,transparent_30%),linear-gradient(135deg,#f8fafc,#eef2ff)] p-5 sm:p-8">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-7xl flex-col">
        <header className="mb-8 flex items-center gap-3 rounded-2xl border border-white/80 bg-white/65 px-5 py-4 shadow-sm backdrop-blur-lg">
          <span className="h-10 w-10 animate-pulse rounded-xl bg-gradient-to-br from-blue-500 via-indigo-600 to-fuchsia-500 shadow-md shadow-indigo-500/20" />
          <div className="space-y-2">
            <span className="block h-3 w-28 animate-pulse rounded-full bg-slate-200" />
            <span className="block h-2 w-40 animate-pulse rounded-full bg-slate-100" />
          </div>
        </header>
        <div className="grid flex-1 gap-5 lg:grid-cols-[1.1fr_2fr]">
          <div className="hidden rounded-3xl border border-white/70 bg-white/35 p-6 shadow-sm backdrop-blur sm:block">
            <div className="mb-7 h-4 w-32 animate-pulse rounded-full bg-white/90" />
            <div className="space-y-4">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="flex items-center gap-3 rounded-2xl bg-white/60 p-3">
                  <span className="h-9 w-9 animate-pulse rounded-xl bg-indigo-100" />
                  <span className="h-3 w-28 animate-pulse rounded-full bg-slate-200" />
                </div>
              ))}
            </div>
          </div>
          <section className="flex flex-col gap-5">
            <div className="h-36 animate-pulse rounded-3xl border border-white/80 bg-white/55 shadow-sm" />
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="h-44 animate-pulse rounded-3xl border border-white/80 bg-white/55 shadow-sm" />
              <div className="h-44 animate-pulse rounded-3xl border border-white/80 bg-white/55 shadow-sm" />
            </div>
            <div className="flex min-h-48 flex-1 items-center justify-center">
              <FullPageLoader label="Getting everything ready for you..." />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
