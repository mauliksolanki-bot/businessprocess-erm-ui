import { FullPageLoader } from "@/components/ui/spinner";

export function PageLoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
      <div className="w-full max-w-sm">
        <FullPageLoader label="Preparing your workspace..." />
      </div>
    </main>
  );
}
