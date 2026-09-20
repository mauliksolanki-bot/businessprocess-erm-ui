import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { NewRelicBrowserSnippet } from "@/components/monitoring/new-relic-browser-snippet";
import "./globals.css";

export const metadata: Metadata = {
  title: "ERM Portal",
  description: "Employee Resource Management UI",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
      <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-50">
      <NewRelicBrowserSnippet />
      {children}
      <Toaster position="top-right" richColors />
      </body>
      </html>
  );
}
