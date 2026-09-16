"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { loadSession } from "@/lib/auth-storage";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const session = loadSession();
    if (session?.accessToken) {
      router.replace("/dashboard");
      return;
    }
    router.replace("/login");
  }, [router]);

  return null;
}
