import { LoaderAnimation } from "@/components/ui/spinner";

export function PageLoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
      <div className="flex w-full max-w-sm flex-col items-center rounded-2xl border border-zinc-200 bg-white px-8 py-9 text-center shadow-sm">
        <LoaderAnimation />
        <p className="mt-5 text-sm font-semibold text-zinc-800">ERM Portal</p>
        <p className="mt-1 text-sm text-zinc-500">Preparing your workspace...</p>
      </div>
    </main>
  );
}
