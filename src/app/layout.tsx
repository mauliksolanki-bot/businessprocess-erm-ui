import type { Metadata } from "next";
import type { ReactNode } from "react";
import { GlobalApiLoadingIndicator } from "@/components/ui/global-api-loading-indicator";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "ERM Portal",
  description: "Employee Resource Management UI",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-50">
        <GlobalApiLoadingIndicator />
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
