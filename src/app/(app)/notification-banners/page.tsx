"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Ban, BellRing, CalendarDays, CheckCircle2, Megaphone, PencilLine, Plus, RefreshCw, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  ApiError,
  createNotificationBanner,
  getNotificationBanners,
  inactivateNotificationBanner,
  type NotificationBanner,
  type NotificationBannerType,
  updateNotificationBanner,
} from "@/lib/api";
import { loadSession } from "@/lib/auth-storage";

const NOTIFICATION_TYPES: NotificationBannerType[] = ["Informational", "Urgent", "Low Priority"];

function todayInputValue() {
  const today = new Date();
  const timezoneOffset = today.getTimezoneOffset() * 60_000;
  return new Date(today.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function bannerTone(type: NotificationBannerType) {
  if (type === "Urgent") return "border-rose-500 bg-rose-600 text-white";
  if (type === "Low Priority") return "border-amber-500 bg-amber-600 text-white";
  return "border-emerald-500 bg-emerald-600 text-white";
}

function getBannerState(banner: NotificationBanner) {
  if (!banner.active) return { label: "Inactive", className: "border-rose-200 bg-rose-50 text-rose-700" };
  const today = todayInputValue();
  if (today < banner.startDate) return { label: "Scheduled", className: "border-blue-200 bg-blue-50 text-blue-700" };
  if (today > banner.endDate) return { label: "Expired", className: "border-zinc-200 bg-zinc-100 text-zinc-600" };
  return { label: "Active", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
}

export default function NotificationBannersPage() {
  const session = useMemo(() => loadSession(), []);
  const token = session?.accessToken ?? null;
  const canManage = useMemo(
      () => (session?.roles ?? []).some((role) => ["admin", "super admin"].includes(role.trim().toLowerCase().replace(/^role_/, "").replaceAll("_", " "))),
      [session?.roles]
  );
  const [banners, setBanners] = useState<NotificationBanner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [startDate, setStartDate] = useState(todayInputValue);
  const [endDate, setEndDate] = useState("");
  const [notificationType, setNotificationType] = useState<NotificationBannerType>("Informational");
  const [editingBanner, setEditingBanner] = useState<NotificationBanner | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editNotificationType, setEditNotificationType] = useState<NotificationBannerType>("Informational");
  const [isUpdating, setIsUpdating] = useState(false);
  const [bannerToInactivate, setBannerToInactivate] = useState<NotificationBanner | null>(null);
  const [isInactivating, setIsInactivating] = useState(false);

  const loadBanners = useCallback(async () => {
    if (!token || !canManage) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      setBanners(await getNotificationBanners(token));
    } catch {
      toast.error("Unable to load notification banners.");
    } finally {
      setIsLoading(false);
    }
  }, [canManage, token]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadBanners();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadBanners]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !canManage) return;
    if (startDate > endDate) {
      toast.error("End date must be on or after the start date.");
      return;
    }

    setIsSaving(true);
    try {
      await createNotificationBanner(token, {
        title: title.trim(),
        message: message.trim(),
        startDate,
        endDate,
        notificationType,
      });
      setTitle("");
      setMessage("");
      setStartDate(todayInputValue());
      setEndDate("");
      setNotificationType("Informational");
      toast.success("Notification banner created.");
      await loadBanners();
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        toast.error("Only Admin and Super Admin users can manage notification banners.");
      } else {
        toast.error(error instanceof ApiError ? error.message : "Unable to create the notification banner.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  function ownsBanner(banner: NotificationBanner) {
    return canManage && session?.username?.toLowerCase() === banner.createdByUsername.toLowerCase();
  }

  function openEditDrawer(banner: NotificationBanner) {
    setEditingBanner(banner);
    setEditTitle(banner.title);
    setEditMessage(banner.message);
    setEditStartDate(banner.startDate);
    setEditEndDate(banner.endDate);
    setEditNotificationType(banner.notificationType);
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !editingBanner) return;
    if (editStartDate > editEndDate) {
      toast.error("End date must be on or after the start date.");
      return;
    }

    setIsUpdating(true);
    try {
      const updated = await updateNotificationBanner(token, editingBanner.id, {
        title: editTitle.trim(),
        message: editMessage.trim(),
        startDate: editStartDate,
        endDate: editEndDate,
        notificationType: editNotificationType,
      });
      setBanners((current) => current.map((banner) => banner.id === updated.id ? updated : banner));
      setEditingBanner(null);
      toast.success("Notification banner updated.");
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        toast.error("You can only edit notification banners you created.");
      } else {
        toast.error(error instanceof ApiError ? error.message : "Unable to update the notification banner.");
      }
    } finally {
      setIsUpdating(false);
    }
  }

  async function confirmInactivateBanner() {
    if (!token || !bannerToInactivate) return;
    setIsInactivating(true);
    try {
      const inactivated = await inactivateNotificationBanner(token, bannerToInactivate.id);
      setBanners((current) => current.map((banner) => banner.id === inactivated.id ? inactivated : banner));
      setBannerToInactivate(null);
      toast.success("Notification banner inactivated. It will no longer appear on the login page.");
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        toast.error("You can only inactivate notification banners you created.");
      } else {
        toast.error("Unable to inactivate this notification banner.");
      }
    } finally {
      setIsInactivating(false);
    }
  }

  if (!canManage) {
    return (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="flex items-center gap-3 p-6 text-rose-800">
            <ShieldAlert className="h-5 w-5" />
            <p className="text-sm font-medium">Only Admin and Super Admin users can access Notification Banner.</p>
          </CardContent>
        </Card>
    );
  }

  return (
      <div className="space-y-6">
        <Card className="overflow-hidden border-0 shadow-lg shadow-blue-950/10">
          <CardHeader className="relative overflow-hidden rounded-t-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white">
            <div className="pointer-events-none absolute -right-8 -top-16 h-56 w-56 rounded-full border-[28px] border-white/10" />
            <div className="relative flex items-center gap-4">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
                <Megaphone className="h-7 w-7" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-100">Login experience</p>
                <h1 className="mt-1 text-2xl font-semibold">Notification Banner</h1>
                <p className="mt-1 text-sm text-blue-50/85">Create announcements that appear beneath the sign-in panel during their scheduled dates.</p>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <Card className="border-zinc-200 shadow-md">
            <CardHeader className="border-b border-zinc-100 px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-blue-50 p-2 text-blue-700"><Plus className="h-4 w-4" /></span>
                <div>
                  <h2 className="font-semibold text-zinc-900">Create a banner</h2>
                  <p className="mt-0.5 text-sm text-zinc-500">Set the message, urgency, and display window.</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <form className="space-y-5" onSubmit={handleCreate}>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700" htmlFor="banner-title">Notification Title</label>
                  <input
                      autoComplete="off"
                      className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      id="banner-title"
                      maxLength={150}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="e.g. Planned system maintenance"
                      required
                      value={title}
                  />
                  <p className="text-right text-xs text-zinc-400">{title.length}/150</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700" htmlFor="banner-message">Notification Message</label>
                  <textarea
                      className="min-h-28 w-full resize-y rounded-xl border border-zinc-300 bg-white px-3.5 py-3 text-sm leading-6 text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      id="banner-message"
                      maxLength={2000}
                      onChange={(event) => setMessage(event.target.value)}
                      placeholder="Write a clear message for everyone signing in..."
                      required
                      value={message}
                  />
                  <p className="text-right text-xs text-zinc-400">{message.length}/2,000</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-700" htmlFor="banner-start-date">Start Date</label>
                    <div className="relative">
                      <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <input className="h-11 w-full rounded-xl border border-zinc-300 bg-white pl-10 pr-3 text-sm text-zinc-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" id="banner-start-date" onChange={(event) => setStartDate(event.target.value)} required type="date" value={startDate} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-700" htmlFor="banner-end-date">End Date</label>
                    <div className="relative">
                      <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <input className="h-11 w-full rounded-xl border border-zinc-300 bg-white pl-10 pr-3 text-sm text-zinc-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" id="banner-end-date" min={startDate} onChange={(event) => setEndDate(event.target.value)} required type="date" value={endDate} />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700" htmlFor="banner-type">Type of Notification</label>
                  <select className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3.5 text-sm text-zinc-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" id="banner-type" onChange={(event) => setNotificationType(event.target.value as NotificationBannerType)} value={notificationType}>
                    {NOTIFICATION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>

                <div className="flex justify-end border-t border-zinc-100 pt-4">
                  <Button className="h-11 gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 text-white shadow-md shadow-blue-600/20 hover:from-blue-500 hover:to-indigo-500" disabled={isSaving} type="submit">
                    {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    {isSaving ? "Saving banner..." : "Save notification banner"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-zinc-200 shadow-md">
            <CardHeader className="bg-gradient-to-br from-slate-50 to-blue-50/70 px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Live preview</p>
              <h2 className="mt-1 text-lg font-semibold text-zinc-900">Login page appearance</h2>
              <p className="mt-1 text-sm text-zinc-500">Banner colors update with the selected notification type.</p>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="mb-3 h-2 w-24 rounded-full bg-blue-100" />
                <div className="h-3 w-3/4 rounded-full bg-zinc-100" />
                <div className="mt-2 h-3 w-full rounded-full bg-zinc-100" />
                <div className="mt-4 h-10 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600" />
                <div className={`mt-4 flex gap-3 rounded-2xl border p-4 shadow-lg ${bannerTone(notificationType)}`}>
                  <BellRing className="mt-0.5 h-5 w-5 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{title.trim() || "Your notification title"}</p>
                      <span className="rounded-full border border-white/30 bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">{notificationType}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-5">{message.trim() || "Your notification message will appear here beneath the sign-in box."}</p>
                  </div>
                </div>
              </div>
              <p className="rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2.5 text-xs leading-5 text-blue-800">The banner is visible publicly only when today falls between the start and end dates, including both dates.</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-zinc-200 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-zinc-100 px-6 py-5">
            <div>
              <h2 className="font-semibold text-zinc-900">Created notifications</h2>
              <p className="mt-1 text-sm text-zinc-500">Scheduled, active, expired, and inactive banners. You can manage banners you created.</p>
            </div>
            <Button aria-label="Refresh notifications" className="h-9 w-9 rounded-full p-0" disabled={isLoading} onClick={() => void loadBanners()} title="Refresh" variant="outline">
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </CardHeader>
          <CardContent className="p-5">
            {isLoading ? (
                <div className="flex min-h-32 items-center justify-center"><Spinner /></div>
            ) : banners.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-8 text-center">
                  <BellRing className="mx-auto h-8 w-8 text-zinc-400" />
                  <p className="mt-3 text-sm font-semibold text-zinc-700">No notification banners yet</p>
                  <p className="mt-1 text-xs text-zinc-500">Create your first banner using the form above.</p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-2xl border border-zinc-200">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead className="bg-gradient-to-r from-indigo-50 via-violet-50 to-cyan-50 text-zinc-700">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Notification</th>
                      <th className="px-4 py-3 font-semibold">Type</th>
                      <th className="px-4 py-3 font-semibold">Display Window</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Created By</th>
                      <th className="px-4 py-3 text-center font-semibold">Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    {banners.map((banner) => {
                      const state = getBannerState(banner);
                      return (
                          <tr className="border-t border-zinc-100 align-top transition-colors hover:bg-blue-50/30" key={banner.id}>
                            <td className="max-w-[420px] px-4 py-3">
                              <p className="font-semibold text-zinc-900">{banner.title}</p>
                              <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-zinc-500">{banner.message}</p>
                            </td>
                            <td className="px-4 py-3"><Badge className="border border-zinc-200 bg-white text-zinc-700">{banner.notificationType}</Badge></td>
                            <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-600">{banner.startDate} – {banner.endDate}</td>
                            <td className="px-4 py-3"><Badge className={state.className}>{state.label}</Badge></td>
                            <td className="px-4 py-3 text-xs text-zinc-600">{banner.createdByUsername}</td>
                            <td className="px-4 py-3">
                              {ownsBanner(banner) ? (
                                  <div className="flex justify-center gap-2">
                                    <Button
                                        aria-label={`Edit ${banner.title}`}
                                        className="h-9 w-9 rounded-full border-blue-200 bg-blue-50 p-0 text-blue-700 hover:bg-blue-100"
                                        onClick={() => openEditDrawer(banner)}
                                        size="sm"
                                        title="Edit banner"
                                        variant="outline"
                                    >
                                      <PencilLine className="h-4 w-4" />
                                    </Button>
                                    {banner.active ? (
                                        <Button
                                            aria-label={`Inactivate ${banner.title}`}
                                            className="h-9 w-9 rounded-full border-rose-200 bg-rose-50 p-0 text-rose-700 hover:bg-rose-100"
                                            onClick={() => setBannerToInactivate(banner)}
                                            size="sm"
                                            title="Inactivate banner"
                                            variant="outline"
                                        >
                                          <Ban className="h-4 w-4" />
                                        </Button>
                                    ) : null}
                                  </div>
                              ) : <span className="block text-center text-xs text-zinc-400">—</span>}
                            </td>
                          </tr>
                      );
                    })}
                    </tbody>
                  </table>
                </div>
            )}
          </CardContent>
        </Card>

        {editingBanner ? (
            <div
                aria-label="Edit notification banner"
                aria-modal="true"
                className="fixed inset-0 z-[60] flex justify-end bg-slate-950/45 backdrop-blur-sm"
                onClick={(event) => {
                  if (event.target === event.currentTarget && !isUpdating) setEditingBanner(null);
                }}
                role="dialog"
            >
              <aside className="ml-auto flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-white/50 bg-white shadow-2xl shadow-slate-300/40">
                <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-6 py-5 text-white">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25"><PencilLine className="h-5 w-5" /></span>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-100">Banner settings</p>
                        <h2 className="mt-1 text-xl font-semibold">Edit notification</h2>
                      </div>
                    </div>
                    <Button aria-label="Close edit panel" className="h-9 w-9 rounded-full border-white/40 bg-white/10 p-0 text-white hover:bg-white/20" disabled={isUpdating} onClick={() => setEditingBanner(null)} size="sm" variant="outline"><X className="h-4 w-4" /></Button>
                  </div>
                  <p className="mt-3 pl-14 text-sm text-blue-50/85">Changes will appear on the login page during the updated display window.</p>
                </div>

                <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleUpdate}>
                  <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-700" htmlFor="edit-banner-title">Notification Title</label>
                      <input className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3.5 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" id="edit-banner-title" maxLength={150} onChange={(event) => setEditTitle(event.target.value)} required value={editTitle} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-700" htmlFor="edit-banner-message">Notification Message</label>
                      <textarea className="min-h-36 w-full resize-y rounded-xl border border-zinc-300 bg-white px-3.5 py-3 text-sm leading-6 text-zinc-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" id="edit-banner-message" maxLength={2000} onChange={(event) => setEditMessage(event.target.value)} required value={editMessage} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-700" htmlFor="edit-banner-start-date">Start Date</label>
                        <input className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" id="edit-banner-start-date" onChange={(event) => setEditStartDate(event.target.value)} required type="date" value={editStartDate} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-700" htmlFor="edit-banner-end-date">End Date</label>
                        <input className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" id="edit-banner-end-date" min={editStartDate} onChange={(event) => setEditEndDate(event.target.value)} required type="date" value={editEndDate} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-700" htmlFor="edit-banner-type">Type of Notification</label>
                      <select className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3.5 text-sm text-zinc-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" id="edit-banner-type" onChange={(event) => setEditNotificationType(event.target.value as NotificationBannerType)} value={editNotificationType}>
                        {NOTIFICATION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </div>
                    {!editingBanner.active ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">This banner is inactive. Editing it will not make it visible on the login page again.</p> : null}
                  </div>
                  <div className="flex justify-end gap-2 border-t border-zinc-200 bg-white px-6 py-4">
                    <Button disabled={isUpdating} onClick={() => setEditingBanner(null)} type="button" variant="outline">Cancel</Button>
                    <Button className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500" disabled={isUpdating} type="submit">
                      {isUpdating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      {isUpdating ? "Saving changes..." : "Save changes"}
                    </Button>
                  </div>
                </form>
              </aside>
            </div>
        ) : null}

        {bannerToInactivate ? (
            <div
                aria-labelledby="inactivate-banner-title"
                aria-modal="true"
                className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
                onClick={(event) => {
                  if (event.target === event.currentTarget && !isInactivating) setBannerToInactivate(null);
                }}
                role="alertdialog"
            >
              <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/60 bg-white shadow-2xl shadow-slate-950/30">
                <div className="bg-gradient-to-r from-rose-600 to-red-600 px-5 py-5 text-white">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25"><Ban className="h-5 w-5" /></span>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-100">Confirm action</p>
                      <h2 className="mt-1 text-lg font-semibold" id="inactivate-banner-title">Inactivate banner?</h2>
                    </div>
                  </div>
                </div>
                <div className="space-y-5 p-5">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <p className="font-semibold">Are you sure you want to inactivate “{bannerToInactivate.title}”?</p>
                    <p className="mt-1 text-xs leading-5 text-amber-800">This banner will stop appearing on the login page immediately. You can still view or edit it from this list.</p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button disabled={isInactivating} onClick={() => setBannerToInactivate(null)} type="button" variant="outline">Cancel</Button>
                    <Button className="gap-2 bg-gradient-to-r from-rose-600 to-red-600 text-white hover:from-rose-500 hover:to-red-500" disabled={isInactivating} onClick={() => void confirmInactivateBanner()} type="button">
                      {isInactivating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                      {isInactivating ? "Inactivating..." : "Inactivate"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
        ) : null}
      </div>
  );
}
