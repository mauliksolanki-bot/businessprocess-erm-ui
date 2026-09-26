"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  LogIn,
  Info,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";

import { ErmLogo } from "@/components/erm/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FloatingInputField } from "@/components/ui/form-fields";
import { ApiError, getActiveNotificationBanners, login, type NotificationBanner } from "@/lib/api";
import { loadSession, saveSession } from "@/lib/auth-storage";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [notificationBanners, setNotificationBanners] = useState<NotificationBanner[]>([]);
  const router = useRouter();

  useEffect(() => {
    let isCurrent = true;
    const session = loadSession();
    if (session?.accessToken) {
      router.replace("/dashboard");
    }
    void getActiveNotificationBanners()
        .then((banners) => {
          if (isCurrent) setNotificationBanners(banners);
        })
        .catch(() => {
          if (isCurrent) setNotificationBanners([]);
        });
    return () => {
      isCurrent = false;
    };
  }, [router]);

  function getBannerStyle(type: NotificationBanner["notificationType"]) {
    if (type === "Urgent") return "border-rose-500 bg-rose-600 shadow-rose-300/40";
    if (type === "Low Priority") return "border-amber-500 bg-amber-600 shadow-amber-300/40";
    return "border-emerald-500 bg-emerald-600 shadow-emerald-300/40";
  }

  function getBannerIcon(type: NotificationBanner["notificationType"]) {
    if (type === "Urgent") return TriangleAlert;
    if (type === "Low Priority") return BellRing;
    return Info;
  }

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
      <div className="relative flex min-h-screen items-start justify-center overflow-x-hidden bg-[radial-gradient(circle_at_top_left,#dbeafe_0,#eef2ff_35%,#f8fafc_65%)] px-4 py-4 sm:py-6 md:px-8 xl:py-4 2xl:items-center 2xl:py-8">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:72px_72px]" />
        <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-cyan-300/25 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-1/4 h-80 w-80 rounded-full bg-indigo-300/25 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-violet-200/30 blur-3xl" />

        <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[32px] border border-white/70 bg-white/75 shadow-[0_30px_120px_-32px_rgba(37,99,235,0.35)] backdrop-blur-xl lg:grid-cols-[minmax(0,0.88fr)_minmax(380px,1.12fr)] lg:self-start xl:grid-cols-[minmax(0,0.92fr)_minmax(420px,1.08fr)] 2xl:max-w-6xl 2xl:grid-cols-[1fr_0.92fr]">
          <section className="relative hidden overflow-hidden bg-[linear-gradient(160deg,#0f172a_0%,#1d4ed8_50%,#312e81_100%)] px-5 py-5 text-white lg:block xl:px-6 xl:py-6 2xl:px-10 2xl:py-12">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.18),transparent_28%)]" />
            <div className="relative">
              <ErmLogo tone="light" />

              <div className="mt-4 max-w-xs space-y-3 xl:mt-5 xl:max-w-sm 2xl:mt-12 2xl:max-w-md 2xl:space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-medium text-blue-50/90 backdrop-blur xl:text-xs 2xl:px-4 2xl:py-2 2xl:text-sm">
                  <Sparkles className="h-4 w-4 text-cyan-200" />
                  One secure sign-in for all authorized users
                </div>
                <div className="space-y-3">
                  <h1 className="text-[1.35rem] font-semibold leading-tight xl:text-2xl 2xl:text-4xl">Professional access to your ERM workspace.</h1>
                  <p className="max-w-xs text-[13px] leading-5 text-blue-50/85 xl:max-w-sm xl:text-sm xl:leading-6 2xl:max-w-md 2xl:text-base 2xl:leading-7">
                    Manage operations, approvals, projects, and employee workflows from a single unified portal built for enterprise teams.
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-[28px] border border-white/15 bg-white/10 p-3.5 backdrop-blur xl:mt-6 xl:p-4 2xl:mt-10 2xl:p-6">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-white/10 p-2.5">
                      <ShieldCheck className="h-5 w-5 text-cyan-200" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Secure and role-aware access</p>
                      <p className="mt-1 text-[13px] leading-5 text-blue-50/80 xl:text-sm xl:leading-6">
                        User access is applied after authentication, keeping this page neutral and free from role-specific data.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2.5">
                    <div className="flex items-start gap-3 rounded-2xl bg-white/8 px-3 py-2.5">
                      <Workflow className="mt-0.5 h-4 w-4 text-indigo-100" />
                      <div>
                        <p className="text-sm font-medium text-white">Connected workflows</p>
                        <p className="mt-1 text-[13px] leading-5 text-blue-50/75 xl:text-sm xl:leading-6">Projects, onboarding, leave, and support in one portal.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-2xl bg-white/8 px-3 py-2.5">
                      <LockKeyhole className="mt-0.5 h-4 w-4 text-cyan-200" />
                      <div>
                        <p className="text-sm font-medium text-white">Privacy-safe entry</p>
                        <p className="mt-1 text-[13px] leading-5 text-blue-50/75 xl:text-sm xl:leading-6">No internal usernames, role lists, or sensitive details are displayed.</p>
                      </div>
                    </div>
                    <div className="hidden items-start gap-3 rounded-2xl bg-white/8 px-3 py-2.5 2xl:flex">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />
                      <div>
                        <p className="text-sm font-medium text-white">Single access point</p>
                        <p className="mt-1 text-sm leading-6 text-blue-50/75">A shared sign-in experience for every authorized user.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <Card className="w-full rounded-none border-0 bg-transparent shadow-none">
            <CardHeader className="space-y-4 px-6 pb-0 pt-6 sm:px-8 sm:pt-8 lg:px-7 lg:pt-7 xl:px-8 xl:pt-6 2xl:space-y-6 2xl:px-10 2xl:pt-10">
              <div className="flex items-start justify-between gap-4">
                <div className="lg:hidden">
                  <ErmLogo />
                </div>
                <div className="hidden rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 sm:inline-flex">
                  Secure portal access
                </div>
              </div>

              <div className="space-y-2.5">
                <CardTitle className="text-3xl text-zinc-950 xl:text-[2rem] 2xl:text-4xl">Welcome back</CardTitle>
                <CardDescription className="max-w-md text-sm leading-6 text-zinc-600 lg:text-[15px] xl:text-base">
                  Sign in with your organization credentials to continue. This single login page is shared across all users, and permissions are applied after sign-in.
                </CardDescription>
              </div>

              <div className="grid gap-3 lg:hidden lg:grid-cols-2">
                <div className="rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-4 w-4 text-blue-600" />
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">Single login for all users</p>
                      <p className="mt-1 text-sm leading-6 text-zinc-600">A shared sign-in page with access applied only after authentication.</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <LockKeyhole className="mt-0.5 h-4 w-4 text-emerald-600" />
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">Privacy-safe entry point</p>
                      <p className="mt-1 text-sm leading-6 text-zinc-600">No role lists, internal user details, or sensitive information are shown here.</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="px-6 pb-6 pt-5 sm:px-8 sm:pb-8 lg:px-7 lg:pb-7 lg:pt-4 xl:px-8 xl:pb-6 xl:pt-4 2xl:px-10 2xl:pb-10 2xl:pt-6">
              <div className="rounded-[28px] border border-zinc-200/80 bg-white/90 p-5 shadow-[0_18px_50px_-24px_rgba(15,23,42,0.25)] sm:p-6 lg:p-4 xl:p-5 2xl:p-6">
                <form className="space-y-4 lg:space-y-3 xl:space-y-3.5 2xl:space-y-5" onSubmit={handleSubmit}>
                  <FloatingInputField
                      autoComplete="username"
                      id="username"
                      label="Username"
                      onChange={(event) => setUsername(event.target.value)}
                      required
                      value={username}
                      wrapperClassName="relative"
                  />

                  <div className="relative">
                    <FloatingInputField
                        autoComplete="current-password"
                        className="pr-12"
                        id="password"
                        label="Password"
                        onChange={(event) => setPassword(event.target.value)}
                        required
                        type={showPassword ? "text" : "password"}
                        value={password}
                    />
                    <button
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-full p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        onClick={() => setShowPassword((current) => !current)}
                        type="button"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-2.5 text-sm leading-6 text-emerald-900 xl:py-2.5">
                    Access is granted based on your authenticated account. No role names, user lists, or internal data are displayed on this page.
                  </div>

                  <Button
                      className="h-12 w-full bg-[linear-gradient(135deg,#2563eb_0%,#4f46e5_55%,#7c3aed_100%)] text-white shadow-lg shadow-blue-300/40 hover:opacity-95"
                      disabled={isSubmitting}
                      type="submit"
                  >
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                    {isSubmitting ? "Signing in..." : "Sign in securely"}
                    {!isSubmitting ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
                  </Button>
                </form>
              </div>

              {notificationBanners.length > 0 ? (
                  <section aria-label="Active notifications" className="mt-4 space-y-3" aria-live="polite">
                    {notificationBanners.map((banner) => {
                      const BannerIcon = getBannerIcon(banner.notificationType);
                      return (
                          <article
                              className={`relative overflow-hidden rounded-2xl border px-4 py-4 text-white shadow-lg ${getBannerStyle(banner.notificationType)}`}
                              key={banner.id}
                          >
                            <div className="pointer-events-none absolute -right-5 -top-8 h-28 w-28 rounded-full border-[18px] border-white/10" />
                            <div className="relative flex items-start gap-3">
                              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                                <BannerIcon className="h-4 w-4" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h2 className="text-sm font-bold tracking-wide">{banner.title}</h2>
                                  <span className="rounded-full border border-white/25 bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                                    {banner.notificationType}
                                  </span>
                                </div>
                                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-white">{banner.message}</p>
                              </div>
                            </div>
                          </article>
                      );
                    })}
                  </section>
              ) : null}

              <div className="mt-6 grid gap-3 text-sm text-zinc-600 lg:hidden sm:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                  <p className="font-medium text-zinc-900">Shared login experience</p>
                  <p className="mt-1 leading-6">A single entry point supports every authorized ERM user.</p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                  <p className="font-medium text-zinc-900">Privacy-conscious design</p>
                  <p className="mt-1 leading-6">The page avoids showing internal user, role, or environment details.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
  );
}
