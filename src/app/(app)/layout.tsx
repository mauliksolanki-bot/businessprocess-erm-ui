import type { ReactNode } from "react";

import { ProtectedShell } from "@/components/erm/protected-shell";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <ProtectedShell>{children}</ProtectedShell>;
}
