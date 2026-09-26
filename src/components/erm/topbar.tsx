"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bell, BriefcaseBusiness, CalendarDays, ChevronDown, Loader2, LogOut, ShieldCheck, Sparkles, UserRound } from "lucide-react";

import type { UserProfile } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ErmLogo } from "@/components/erm/logo";

export type AppNotification = {
  id: string;
  title: string;
  message: string;
  href: string;
  occurredAt: string;
  kind: "approval" | "reminder" | "update";
  tone: "warning" | "critical" | "info" | "success";
};

type TopbarProps = {
  user: UserProfile;
  onLogout: () => Promise<void>;
  notifications: AppNotification[];
  notificationError?: string | null;
};

const NOTIFICATION_READ_STORAGE_PREFIX = "erm_notification_reads_";

function kindClass(kind: AppNotification["kind"]) {
  if (kind === "approval") return "border-amber-200 bg-amber-50 text-amber-700";
  if (kind === "reminder") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function toneDotClass(tone: AppNotification["tone"]) {
  if (tone === "critical") return "bg-rose-500";
  if (tone === "warning") return "bg-amber-500";
  if (tone === "success") return "bg-emerald-500";
  return "bg-sky-500";
}

function formatNotificationTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatCompactDate(value: string | null) {
  if (!value) {
    return "TBD";
  }
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatAllocationPercent(value: number) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function Topbar({ user, onLogout, notifications, notificationError }: TopbarProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notificationMenuRef = useRef<HTMLDivElement>(null);

  async function handleLogout() {
    setIsLoggingOut(true);
    await onLogout();
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!notificationMenuRef.current?.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setShowProfile(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const displayName = user.fullName?.trim() || user.username;
  const storageKey = `${NOTIFICATION_READ_STORAGE_PREFIX}${user.username.toLowerCase()}`;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      setReadNotificationIds([]);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as string[];
      setReadNotificationIds(Array.isArray(parsed) ? parsed : []);
    } catch {
      window.localStorage.removeItem(storageKey);
      setReadNotificationIds([]);
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(storageKey, JSON.stringify(readNotificationIds));
  }, [readNotificationIds, storageKey]);

  function markNotificationAsRead(notificationId: string) {
    setReadNotificationIds((current) => {
      if (current.includes(notificationId)) {
        return current;
      }
      return [...current, notificationId];
    });
  }

  const unreadNotifications = useMemo(
      () => notifications.filter((item) => !readNotificationIds.includes(item.id)),
      [notifications, readNotificationIds]
  );
  const orderedNotifications = useMemo(
      () =>
          [...unreadNotifications, ...notifications.filter((item) => readNotificationIds.includes(item.id))],
      [notifications, readNotificationIds, unreadNotifications]
  );
  const totalNotifications = unreadNotifications.length;
  const approvalCount = unreadNotifications.filter((item) => item.kind === "approval").length;
  const reminderCount = unreadNotifications.filter((item) => item.kind === "reminder").length;
  const updateCount = unreadNotifications.filter((item) => item.kind === "update").length;

  return (
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="flex h-16 items-center justify-between gap-3 px-4 md:px-6">
          <ErmLogo />
          <div className="flex items-center gap-3">
            <div className="relative" ref={notificationMenuRef}>
              <button
                  aria-expanded={showNotifications}
                  className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/60 hover:text-indigo-700"
                  onClick={() => {
                    setShowNotifications((value) => !value);
                    setShowProfile(false);
                  }}
                  type="button"
              >
                <Bell className="h-5 w-5" />
                {totalNotifications > 0 ? (
                    <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-fuchsia-600 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-lg">
                  {totalNotifications > 99 ? "99+" : totalNotifications}
                </span>
                ) : null}
              </button>

              {showNotifications ? (
                  <div className="absolute right-0 mt-2 w-[20rem] max-h-[calc(100vh-7rem)] overflow-hidden rounded-[1.6rem] border border-zinc-200 bg-white shadow-2xl shadow-zinc-200/70">
                    <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 p-3.5 text-white">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/70">Notifications</p>
                          <h3 className="mt-1 text-base font-semibold">Alerts and reminders</h3>
                          <p className="mt-1 text-xs text-white/80">
                            {totalNotifications === 0 ? "Everything looks clear right now." : `${totalNotifications} item${totalNotifications === 1 ? "" : "s"} waiting for your attention.`}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-white/15 p-2.5 ring-1 ring-white/20">
                          <Sparkles className="h-4 w-4" />
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <SummaryPill label="Approvals" value={approvalCount} />
                        <SummaryPill label="Reminders" value={reminderCount} />
                        <SummaryPill label="Updates" value={updateCount} />
                      </div>
                    </div>

                    <div className="max-h-[21rem] space-y-2.5 overflow-y-auto p-3">
                      {notificationError ? (
                          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                            {notificationError}
                          </div>
                      ) : null}
                      {orderedNotifications.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 p-5 text-center text-sm text-zinc-600">
                            No notifications available.
                          </div>
                      ) : (
                          orderedNotifications.map((item) => {
                            const isRead = readNotificationIds.includes(item.id);
                            return (
                                <Link
                                    className={`block rounded-2xl border p-3 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/40 ${
                                        isRead ? "border-zinc-200 bg-zinc-50/80 opacity-75" : "border-zinc-200 bg-white"
                                    }`}
                                    href={item.href}
                                    key={item.id}
                                    onClick={() => {
                                      markNotificationAsRead(item.id);
                                      setShowNotifications(false);
                                    }}
                                >
                                  <div className="flex items-start gap-3">
                                    <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${toneDotClass(item.tone)}`} />
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-start justify-between gap-2">
                                        <p className={`text-sm ${isRead ? "font-medium text-zinc-700" : "font-semibold text-zinc-900"}`}>{item.title}</p>
                                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${kindClass(item.kind)}`}>
                                {item.kind}
                              </span>
                                      </div>
                                      <p className="mt-1 text-xs text-zinc-600">{item.message}</p>
                                      <div className="mt-2 flex items-center justify-between gap-2">
                                        <p className="text-[11px] text-zinc-500">{formatNotificationTime(item.occurredAt)}</p>
                                        {isRead ? <span className="text-[11px] font-medium text-zinc-400">Read</span> : null}
                                      </div>
                                    </div>
                                  </div>
                                </Link>
                            );
                          })
                      )}
                    </div>
                  </div>
              ) : null}
            </div>

            <div className="relative" ref={profileMenuRef}>
              <button
                  aria-expanded={showProfile}
                  className="group flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-3 py-1.5 text-left shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/60"
                  onClick={() => {
                    setShowProfile((value) => !value);
                    setShowNotifications(false);
                  }}
                  type="button"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 text-white shadow-md shadow-indigo-200">
                  <UserRound className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-[0.18em] leading-none text-zinc-500">Welcome</p>
                  <p className="flex items-center gap-1 truncate text-sm font-semibold leading-tight text-zinc-900">
                    {displayName}
                    <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500 transition group-hover:text-indigo-600" />
                  </p>
                </div>
              </button>

              {showProfile ? (
                  <div className="absolute right-0 mt-2 w-88 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl shadow-zinc-200/60">
                    <div className="flex items-start justify-between gap-3 border-b border-zinc-100 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 text-white">
                          <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-zinc-900">{displayName}</p>
                          <p className="text-xs text-zinc-500">{user.designation}</p>
                        </div>
                      </div>
                      <Button
                          className="h-9 w-9 shrink-0 rounded-full border-rose-200 bg-rose-50 p-0 text-rose-700 hover:bg-rose-100"
                          onClick={handleLogout}
                          size="sm"
                          variant="outline"
                      >
                        {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                      </Button>
                    </div>

                    <div className="mt-3 space-y-3 text-sm">
                      <DetailRow label="Full name" value={user.fullName || "-"} />
                      <DetailRow label="Employee ID" value={user.employeeId || "Employee ID pending"} />
                      <DetailRow label="Username" value={user.username} />
                      <DetailRow label="Email" value={user.email} />
                      <DetailRow label="Designation" value={user.designation || "-"} />
                      <DetailRow
                          label="Reporting manager"
                          value={user.reportingManagerFullName || user.reportingManagerRoleName || "-"}
                      />
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Assigned roles</p>
                        <div className="flex flex-wrap gap-2">
                          {user.roles.length > 0 ? (
                              user.roles.map((role) => (
                                  <span
                                      className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700"
                                      key={role}
                                  >
                            {role}
                          </span>
                              ))
                          ) : (
                              <span className="text-sm text-zinc-500">No roles assigned</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Active projects</p>
                          <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                        {user.currentProjects.length}
                      </span>
                        </div>
                        {user.currentProjects.length > 0 ? (
                            <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                              {user.currentProjects.map((project) => (
                                  <div className="rounded-xl border border-sky-100 bg-sky-50/70 px-3 py-2" key={project.allocationId}>
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-zinc-900">{project.projectName}</p>
                                        <p className="truncate text-[11px] text-zinc-500">{project.projectCode}</p>
                                      </div>
                                      <span className="shrink-0 rounded-full border border-indigo-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                                {formatAllocationPercent(project.allocationPercent)}%
                              </span>
                                    </div>
                                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-600">
                              <span className="inline-flex items-center gap-1">
                                <BriefcaseBusiness className="h-3.5 w-3.5 text-sky-600" />
                                {project.allocationType}
                              </span>
                                      <span className="inline-flex items-center gap-1">
                                <CalendarDays className="h-3.5 w-3.5 text-sky-600" />
                                Ends {formatCompactDate(project.endDate)}
                              </span>
                                    </div>
                                  </div>
                              ))}
                            </div>
                        ) : (
                            <div className="rounded-xl bg-zinc-50 px-3 py-2 text-sm text-zinc-500">No active projects assigned</div>
                        )}
                      </div>
                    </div>
                  </div>
              ) : null}
            </div>

          </div>
        </div>
      </header>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
      <div className="flex items-start justify-between gap-3 rounded-xl bg-zinc-50 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</span>
        <span className="max-w-[11rem] truncate text-right text-sm font-medium text-zinc-900">{value}</span>
      </div>
  );
}

function SummaryPill({ label, value }: { label: string; value: number }) {
  return (
      <div className="rounded-2xl bg-white/15 px-2.5 py-2 ring-1 ring-white/20">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/65">{label}</p>
        <p className="mt-1 text-base font-semibold text-white">{value.toLocaleString()}</p>
      </div>
  );
}
