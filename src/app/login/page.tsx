"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, LogIn, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import { toast } from "sonner";

import { ErmLogo } from "@/components/erm/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FloatingInputField } from "@/components/ui/form-fields";
import { ApiError, login } from "@/lib/api";
import { loadSession, saveSession } from "@/lib/auth-storage";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const session = loadSession();
    if (session?.accessToken) {
      router.replace("/dashboard");
    }
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await login({ username, password });
      // store absolute expiry timestamp (ms since epoch) so client can detect expiration
      saveSession({
        accessToken: response.accessToken,
        username: response.username,
        roles: response.roles,
        expiresInMs: Date.now() + response.expiresInMs,
        tokenType: response.tokenType,
      });
      toast.success("Login successful");
      router.replace("/dashboard");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        toast.error("Invalid username or password.");
      } else {
        toast.error("Unable to login right now.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_12%_20%,#bfdbfe_0,#e0e7ff_24%,#f8fafc_60%)] p-4 md:p-8">
      <div className="pointer-events-none absolute -left-28 top-16 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-10 h-72 w-72 rounded-full bg-indigo-300/20 blur-3xl" />

      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/70 bg-white/85 shadow-2xl shadow-blue-200/60 backdrop-blur xl:grid-cols-[1.15fr_0.85fr]">
        <section className="hidden bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-10 text-white xl:block">
          <ErmLogo />
          <div className="mt-10 space-y-4">
            <h1 className="text-3xl font-semibold leading-tight">Employee Resource Management</h1>
            <p className="text-sm text-blue-100">Unified platform for projects, onboarding, approvals, and operations.</p>
          </div>
          <div className="mt-10 space-y-4">
            <div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 p-3">
              <ShieldCheck className="h-5 w-5 text-cyan-200" />
              <p className="text-sm text-blue-100">Role-based access with secure session handling.</p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 p-3">
              <Workflow className="h-5 w-5 text-indigo-200" />
              <p className="text-sm text-blue-100">Structured approval workflows for enterprise teams.</p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 p-3">
              <Sparkles className="h-5 w-5 text-violet-200" />
              <p className="text-sm text-blue-100">Modern responsive experience across all modules.</p>
            </div>
          </div>
        </section>

        <Card className="w-full rounded-none border-0 bg-transparent shadow-none">
          <CardHeader className="space-y-4 px-6 pt-7 sm:px-8">
            <div className="xl:hidden">
              <ErmLogo />
            </div>
            <div>
              <CardTitle className="text-2xl text-zinc-900">Welcome back</CardTitle>
              <CardDescription className="text-zinc-600">Sign in to continue to your workspace.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-8 sm:px-8">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <FloatingInputField
                autoComplete="username"
                id="username"
                label="Username"
                onChange={(event) => setUsername(event.target.value)}
                required
                value={username}
              />
              <FloatingInputField
                autoComplete="current-password"
                id="password"
                label="Password"
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
              <Button className="h-11 w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500" disabled={isSubmitting} type="submit">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                {isSubmitting ? "Signing in..." : "Sign in"}
                {!isSubmitting ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
              </Button>
            </form>
            <p className="mt-4 text-center text-xs text-zinc-500">Only authorized users can access this application.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
