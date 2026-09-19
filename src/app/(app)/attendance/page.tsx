"use client";

import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  LockKeyhole,
  MessageSquareQuote,
  PencilLine,
  ShieldCheck,
  ShieldX,
  Users2,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/erm/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MentionTextareaField } from "@/components/ui/mention-textarea-field";
import {
  actionAttendanceTimesheet,
  getAttendanceApprovals,
  getAttendanceApproverVisibility,
  getAttendanceWeek,
  saveAttendanceTimesheet,
  searchUserMentions,
  submitAttendanceTimesheet,
  type AttendanceAssignment,
  type AttendanceApprovalItem,
  type AttendanceDay,
  type AttendanceWeek,
  type AttendanceUpsertRequest,
} from "@/lib/api";
import { loadSession } from "@/lib/auth-storage";

type DraftDay = {
  workDate: string;
  dayLabel: string;
  weekend: boolean;
  leaveDay: boolean;
  leaveLabel: string | null;
  editable: boolean;
  billableHours: string;
  nonBillableHours: string;
  billableProjectAllocationId: string;
  nonBillableProjectAllocationId: string;
  billableProjectName: string | null;
  billableProjectCode: string | null;
  nonBillableProjectName: string | null;
  nonBillableProjectCode: string | null;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function statusClass(status: string) {
  const value = status.toLowerCase();
  if (value === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (value === "rejected") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function toIsoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeek(date: Date) {
  const clone = new Date(date);
  const day = clone.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  clone.setDate(clone.getDate() + diff);
  clone.setHours(0, 0, 0, 0);
  return clone;
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function formatWeekRange(weekStart: string, weekEnd: string) {
  return `${formatDate(weekStart)} - ${formatDate(weekEnd)}`;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }
  return dateTimeFormatter.format(new Date(value));
}

function formatAssignmentLabel(projectName: string | null, projectCode: string | null) {
  if (!projectName && !projectCode) {
    return "No project selected";
  }
  if (projectName && projectCode) {
    return `${projectName} (${projectCode})`;
  }
  return projectName ?? projectCode ?? "No project selected";
}

function resolveAssignmentLabel(
    assignments: AttendanceAssignment[],
    allocationId: string,
    fallbackProjectName: string | null,
    fallbackProjectCode: string | null
) {
  if (!allocationId.trim()) {
    return "No project selected";
  }

  const selectedAssignment = assignments.find((assignment) => String(assignment.allocationId) === allocationId);
  if (selectedAssignment) {
    return formatAssignmentLabel(selectedAssignment.projectName, selectedAssignment.projectCode);
  }

  return formatAssignmentLabel(fallbackProjectName, fallbackProjectCode);
}

function createDraftDays(days: AttendanceDay[]): DraftDay[] {
  return days.map((day) => ({
    workDate: day.workDate,
    dayLabel: day.dayLabel,
    weekend: day.weekend,
    leaveDay: day.leaveDay,
    leaveLabel: day.leaveLabel,
    editable: day.editable,
    billableHours: day.billableHours > 0 ? String(day.billableHours) : "",
    nonBillableHours: day.nonBillableHours > 0 ? String(day.nonBillableHours) : "",
    billableProjectAllocationId: day.billableProjectAllocationId ? String(day.billableProjectAllocationId) : "",
    nonBillableProjectAllocationId: day.nonBillableProjectAllocationId ? String(day.nonBillableProjectAllocationId) : "",
    billableProjectName: day.billableProjectName,
    billableProjectCode: day.billableProjectCode,
    nonBillableProjectName: day.nonBillableProjectName,
    nonBillableProjectCode: day.nonBillableProjectCode,
  }));
}

function emptyDraftDays(weekStart: string): DraftDay[] {
  const start = new Date(weekStart);
  return Array.from({ length: 7 }, (_, index) => {
    const workDate = new Date(start);
    workDate.setDate(start.getDate() + index);
    return {
      workDate: toIsoDate(workDate),
      dayLabel: workDate.toLocaleDateString("en-US", { weekday: "short" }),
      weekend: workDate.getDay() === 0 || workDate.getDay() === 6,
      leaveDay: false,
      leaveLabel: null,
      editable: true,
      billableHours: "",
      nonBillableHours: "",
      billableProjectAllocationId: "",
      nonBillableProjectAllocationId: "",
      billableProjectName: null,
      billableProjectCode: null,
      nonBillableProjectName: null,
      nonBillableProjectCode: null,
    };
  });
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) {
    return 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function AttendancePage() {
  const router = useRouter();
  const currentWeekStart = useMemo(() => toIsoDate(startOfWeek(new Date())), []);
  const [weekStart, setWeekStart] = useState(() => toIsoDate(startOfWeek(new Date())));
  const [weekData, setWeekData] = useState<AttendanceWeek | null>(null);
  const [draftDays, setDraftDays] = useState<DraftDay[]>([]);
  const [approvals, setApprovals] = useState<AttendanceApprovalItem[]>([]);
  const [activeTab, setActiveTab] = useState<"timesheet" | "approvals">("timesheet");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshingApprovals, setIsRefreshingApprovals] = useState(false);
  const [approvedEditEnabled, setApprovedEditEnabled] = useState(false);
  const [approverVisible, setApproverVisible] = useState(false);
  const [showApprovedEditDialog, setShowApprovedEditDialog] = useState(false);
  const [showTimesheetDrawer, setShowTimesheetDrawer] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<AttendanceApprovalItem | null>(null);
  const [approvalActionType, setApprovalActionType] = useState<"APPROVE" | "REJECT">("APPROVE");
  const [approvalComment, setApprovalComment] = useState("");
  const [isActioning, setIsActioning] = useState(false);

  const accessToken = useMemo(() => loadSession()?.accessToken ?? "", []);
  const mentionSearch = useCallback(
      async (query: string) => {
        if (!accessToken) {
          return [];
        }
        return searchUserMentions(accessToken, query);
      },
      [accessToken]
  );

  const isApprovedSheet = weekData?.timesheet?.timesheetStatus === "APPROVED";
  const canEditWeek = weekData?.editable ?? false;
  const canEditSheet = canEditWeek && (!isApprovedSheet || approvedEditEnabled);
  const canMoveToNextWeek = weekStart < currentWeekStart;
  const visibleActiveTab = approverVisible || activeTab === "timesheet" ? activeTab : "timesheet";
  const isTimesheetTabActive = visibleActiveTab === "timesheet";
  const isApprovalsTabActive = visibleActiveTab === "approvals";
  const billableTotal = useMemo(() => draftDays.reduce((total, day) => total + parseOptionalNumber(day.billableHours), 0), [draftDays]);
  const nonBillableTotal = useMemo(() => draftDays.reduce((total, day) => total + parseOptionalNumber(day.nonBillableHours), 0), [draftDays]);
  const dayCount = draftDays.length;

  useEffect(() => {
    if (!accessToken) {
      router.replace("/login");
      return;
    }

    let isMounted = true;

    async function loadWeek() {
      setIsLoading(true);
      try {
        const [weekResult, visibilityResult, approvalResult] = await Promise.all([
          getAttendanceWeek(accessToken, weekStart),
          getAttendanceApproverVisibility(accessToken),
          getAttendanceApprovals(accessToken),
        ]);

        if (!isMounted) {
          return;
        }

        setWeekData(weekResult);
        const nextDraftDays: DraftDay[] = weekResult.days.length > 0 ? createDraftDays(weekResult.days) : emptyDraftDays(weekStart);
        setDraftDays(nextDraftDays);
        setApproverVisible(visibilityResult.hasReportees);
        setApprovals(approvalResult);
        setApprovedEditEnabled(false);
      } catch {
        if (isMounted) {
          toast.error("Unable to load attendance right now.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadWeek();

    return () => {
      isMounted = false;
    };
  }, [accessToken, router, weekStart]);

  function updateDay(index: number, field: keyof DraftDay, value: string) {
    setDraftDays((current) =>
        current.map((day, dayIndex) => (dayIndex === index ? { ...day, [field]: value } : day))
    );
  }

  function updateProjectSelection(index: number, type: "billable" | "nonBillable", allocationId: string) {
    const assignments = type === "billable" ? weekData?.billableAssignments ?? [] : weekData?.nonBillableAssignments ?? [];
    const selectedAssignment = assignments.find((assignment) => String(assignment.allocationId) === allocationId) ?? null;

    setDraftDays((current) =>
        current.map((day, dayIndex) => {
          if (dayIndex !== index) {
            return day;
          }

          if (type === "billable") {
            return {
              ...day,
              billableProjectAllocationId: allocationId,
              billableProjectName: selectedAssignment?.projectName ?? null,
              billableProjectCode: selectedAssignment?.projectCode ?? null,
            };
          }

          return {
            ...day,
            nonBillableProjectAllocationId: allocationId,
            nonBillableProjectName: selectedAssignment?.projectName ?? null,
            nonBillableProjectCode: selectedAssignment?.projectCode ?? null,
          };
        })
    );
  }

  function shiftWeek(days: number) {
    if (days > 0 && !canMoveToNextWeek) {
      return;
    }
    const next = new Date(weekStart);
    next.setDate(next.getDate() + days);
    setWeekStart(toIsoDate(startOfWeek(next)));
  }

  function mapPayload(): AttendanceUpsertRequest {
    return {
      weekStartDate: weekStart,
      days: draftDays.map((day) => ({
        workDate: day.workDate,
        billableHours: parseOptionalNumber(day.billableHours),
        nonBillableHours: parseOptionalNumber(day.nonBillableHours),
        billableProjectAllocationId: day.billableProjectAllocationId.trim() ? Number(day.billableProjectAllocationId) : null,
        nonBillableProjectAllocationId: day.nonBillableProjectAllocationId.trim() ? Number(day.nonBillableProjectAllocationId) : null,
      })),
    };
  }

  async function handleSave(submit: boolean) {
    if (!accessToken) {
      router.replace("/login");
      return;
    }
    if (!canEditSheet) {
      toast.error("This timesheet cannot be edited.");
      return;
    }

    const payload = mapPayload();
    if (submit) {
      setIsSubmitting(true);
    } else {
      setIsSaving(true);
    }

    try {
      const result = submit
          ? await submitAttendanceTimesheet(accessToken, payload)
          : await saveAttendanceTimesheet(accessToken, payload);
      setWeekData(result);
      setDraftDays(createDraftDays(result.days));
      setApprovedEditEnabled(false);
      toast.success(submit ? "Timesheet submitted." : "Timesheet saved.");
      if (approverVisible) {
        await refreshApprovals();
      }
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Unable to save timesheet.");
      }
    } finally {
      setIsSaving(false);
      setIsSubmitting(false);
    }
  }

  async function refreshApprovals() {
    if (!accessToken) {
      router.replace("/login");
      return;
    }

    setIsRefreshingApprovals(true);
    try {
      setApprovals(await getAttendanceApprovals(accessToken));
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Unable to refresh approvals.");
      }
    } finally {
      setIsRefreshingApprovals(false);
    }
  }

  function openApprovalDialog(action: "APPROVE" | "REJECT", item: AttendanceApprovalItem) {
    setSelectedApproval(item);
    setApprovalActionType(action);
    setApprovalComment("");
  }

  function closeApprovalDialog() {
    setSelectedApproval(null);
    setApprovalComment("");
    setApprovalActionType("APPROVE");
  }

  async function submitApprovalAction() {
    if (!accessToken) {
      router.replace("/login");
      return;
    }
    if (!selectedApproval) {
      return;
    }
    if (!approvalComment.trim()) {
      toast.error("Comment is required.");
      return;
    }

    setIsActioning(true);
    setIsRefreshingApprovals(true);
    try {
      await actionAttendanceTimesheet(accessToken, selectedApproval.id, {
        decision: approvalActionType,
        comment: approvalComment.trim(),
      });
      toast.success(approvalActionType === "APPROVE" ? "Timesheet approved." : "Timesheet rejected.");
      closeApprovalDialog();
      setApprovals(await getAttendanceApprovals(accessToken));
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Unable to action the timesheet.");
      }
    } finally {
      setIsActioning(false);
      setIsRefreshingApprovals(false);
    }
  }

  function unlockApprovedEdit() {
    setShowApprovedEditDialog(true);
  }

  function closeTimesheetDrawer() {
    setShowTimesheetDrawer(false);
  }

  const pendingApprovalCount = approvals.length;
  const statusLabel = weekData?.timesheet?.timesheetStatus ?? "DRAFT";

  return (
      <>
        <PageHeader
            description="Fill weekly billable and non-billable hours, respect leave and holiday days, and submit billable work for approval."
            title="Attendance"
        />

        <div className="space-y-6">
          <Card className="overflow-hidden border-blue-100 bg-gradient-to-r from-blue-50 via-white to-indigo-50">
            <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border-blue-200 bg-blue-100 text-blue-700">Weekly timesheet</Badge>
                  <Badge className="border-zinc-200 bg-zinc-100 text-zinc-700">{statusLabel}</Badge>
                  {!canEditWeek ? <Badge className="border-amber-200 bg-amber-100 text-amber-700">Read only older than 30 days</Badge> : null}
                  {isApprovedSheet ? <Badge className="border-emerald-200 bg-emerald-100 text-emerald-700">Approved</Badge> : null}
                </div>
                <h2 className="text-xl font-semibold text-zinc-950">{formatWeekRange(weekStart, weekData?.weekEndDate ?? toIsoDate(new Date(weekStart)))}</h2>
                <p className="text-sm text-zinc-600">Billable time is limited to 8 hours per day. Saturday and Sunday are holidays.</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => shiftWeek(-7)} variant="outline">
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Previous week
                </Button>
                <Button
                    onClick={() => setWeekStart(toIsoDate(startOfWeek(new Date())))}
                    variant="outline"
                >
                  Current week
                </Button>
                <Button disabled={!canMoveToNextWeek} onClick={() => shiftWeek(7)} variant="outline">
                  Next week
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader>
                <CardDescription>Billable hours</CardDescription>
                <CardTitle>{billableTotal.toFixed(2)}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-zinc-600">
                {weekData?.hasBillableAssignments ? "Billable assignments available for this week." : "No billable assignment found for this week."}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Non-billable hours</CardDescription>
                <CardTitle>{nonBillableTotal.toFixed(2)}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-zinc-600">Non-billable work can be logged even when billable approval is unavailable.</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Total days</CardDescription>
                <CardTitle>{dayCount}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-zinc-600">Weekly grid includes all seven days.</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Approvals</CardDescription>
                <CardTitle>{pendingApprovalCount}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-zinc-600">
                {approverVisible ? "Pending billable timesheets for reporting manager approval." : "Approval tab is hidden for non-managers."}
              </CardContent>
            </Card>
          </section>

          <div className="flex flex-wrap gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm">
            <Button
                className={isTimesheetTabActive ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500" : ""}
                onClick={() => setActiveTab("timesheet")}
                variant={isTimesheetTabActive ? "default" : "ghost"}
            >
              Weekly Timesheet
            </Button>
            {approverVisible ? (
                <Button
                    className={isApprovalsTabActive ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500" : ""}
                    onClick={() => setActiveTab("approvals")}
                    variant={isApprovalsTabActive ? "default" : "ghost"}
                >
                  Approval Queue
                  <span className="ml-2 rounded-full bg-black/10 px-2 py-0.5 text-xs">{pendingApprovalCount}</span>
                </Button>
            ) : null}
          </div>

          {isLoading ? (
              <Card>
                <CardContent className="flex items-center gap-3 p-6 text-sm text-zinc-600">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  Loading attendance...
                </CardContent>
              </Card>
          ) : isTimesheetTabActive ? (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.75fr)]">
                <Card className="overflow-hidden">
                  <CardHeader className="rounded-t-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="border-white/20 bg-white/15 text-white">Weekly workspace</Badge>
                          <Badge className="border-white/20 bg-white/15 text-white">{statusLabel}</Badge>
                        </div>
                        <div>
                          <CardTitle className="text-2xl">Fill weekly timesheet</CardTitle>
                          <CardDescription className="mt-1 text-blue-100">
                            Open the right-side workspace to manage the full week with cleaner billable and non-billable sections.
                          </CardDescription>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button className="border-white/40 bg-white/10 text-white hover:bg-white/20" onClick={() => setShowTimesheetDrawer(true)} variant="outline">
                          <ArrowRight className="mr-2 h-4 w-4" />
                          Fill Timesheet
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5 p-5">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">Week</p>
                        <p className="mt-2 text-base font-semibold text-zinc-950">{formatWeekRange(weekStart, weekData?.weekEndDate ?? toIsoDate(new Date(weekStart)))}</p>
                        <p className="mt-1 text-sm text-zinc-600">Current weekly timesheet period.</p>
                      </div>
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600">Billable</p>
                        <p className="mt-2 text-2xl font-semibold text-zinc-950">{billableTotal.toFixed(2)}</p>
                        <p className="mt-1 text-sm text-zinc-600">Hours planned for billable work.</p>
                      </div>
                      <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">Non-billable</p>
                        <p className="mt-2 text-2xl font-semibold text-zinc-950">{nonBillableTotal.toFixed(2)}</p>
                        <p className="mt-1 text-sm text-zinc-600">Hours planned for internal work.</p>
                      </div>
                      <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-700">Availability</p>
                        <p className="mt-2 text-base font-semibold text-zinc-950">{canEditWeek ? "Editable" : "Read only"}</p>
                        <p className="mt-1 text-sm text-zinc-600">{canEditWeek ? "Within the last 30 days." : "Past the edit window."}</p>
                      </div>
                    </div>

                    {isApprovedSheet && approvedEditEnabled ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                          Approval will be reset when you save or submit changes from the timesheet drawer.
                        </div>
                    ) : null}

                    {!weekData?.hasBillableAssignments ? (
                        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                          No billable project is assigned for this week. You can still prepare the weekly draft, but billable submission stays blocked until an active assignment exists.
                        </div>
                    ) : null}

                    <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-zinc-950">Week snapshot</h3>
                          <p className="text-sm text-zinc-600">Preview all seven days before opening the timesheet drawer.</p>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-zinc-600">
                          <LockKeyhole className="h-4 w-4 text-zinc-500" />
                          Billable work stays capped at 8 hours per day.
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {draftDays.map((day) => {
                          const totalHours = parseOptionalNumber(day.billableHours) + parseOptionalNumber(day.nonBillableHours);
                          return (
                              <div
                                  className={`rounded-2xl border p-4 ${
                                      day.leaveDay
                                          ? "border-emerald-200 bg-emerald-50/70"
                                          : day.weekend
                                              ? "border-zinc-200 bg-zinc-50"
                                              : "border-zinc-200 bg-white"
                                  }`}
                                  key={day.workDate}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="font-semibold text-zinc-950">{day.dayLabel}</p>
                                    <p className="text-sm text-zinc-600">{formatDate(day.workDate)}</p>
                                  </div>
                                  <div className="flex flex-wrap justify-end gap-1.5">
                                    {day.weekend ? <Badge className="border-zinc-200 bg-zinc-100 text-zinc-700">Holiday</Badge> : null}
                                    {day.leaveDay ? <Badge className="border-emerald-200 bg-emerald-100 text-emerald-700">Leave</Badge> : null}
                                  </div>
                                </div>
                                {day.leaveLabel ? <p className="mt-2 text-xs font-medium text-emerald-700">{day.leaveLabel}</p> : null}
                                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                                  <div className="rounded-xl bg-zinc-50 px-3 py-2">
                                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Billable</p>
                                    <p className="mt-1 font-semibold text-zinc-950">{parseOptionalNumber(day.billableHours).toFixed(2)}</p>
                                  </div>
                                  <div className="rounded-xl bg-zinc-50 px-3 py-2">
                                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Non-billable</p>
                                    <p className="mt-1 font-semibold text-zinc-950">{parseOptionalNumber(day.nonBillableHours).toFixed(2)}</p>
                                  </div>
                                  <div className="rounded-xl bg-zinc-50 px-3 py-2">
                                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Total</p>
                                    <p className="mt-1 font-semibold text-zinc-950">{totalHours.toFixed(2)}</p>
                                  </div>
                                </div>
                              </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Rules and availability</CardTitle>
                      <CardDescription>Guidance for filling this weekly sheet.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm text-zinc-600">
                      <div className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                        <CalendarDays className="mt-0.5 h-4 w-4 text-blue-600" />
                        <p>Weekends are read only and highlighted as holidays.</p>
                      </div>
                      <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                        <p>Approved leave days are shown in a different color and cannot be edited.</p>
                      </div>
                      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                        <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                        <p>Billable timesheets go to the reporting manager when a billable assignment exists for that week.</p>
                      </div>
                      <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-3">
                        <Users2 className="mt-0.5 h-4 w-4 text-sky-600" />
                        <p>Billable and non-billable assignments can coexist for the same user and same time period.</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-zinc-200">
                    <CardHeader>
                      <CardTitle>Drawer workflow</CardTitle>
                      <CardDescription>The timesheet opens in a right-side workspace like other pages.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm text-zinc-600">
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                        <p className="font-medium text-zinc-900">1. Review the weekly snapshot</p>
                        <p className="mt-1">Check billable and non-billable totals before opening the detailed drawer.</p>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                        <p className="font-medium text-zinc-900">2. Open Fill Timesheet</p>
                        <p className="mt-1">A right-attached drawer shows the full week with cleaner work sections for each day.</p>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                        <p className="font-medium text-zinc-900">3. Save or submit</p>
                        <p className="mt-1">Use the footer actions in the drawer to save the draft or submit the final weekly sheet.</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
          ) : (
              <Card>
                <CardHeader className="flex min-h-[152px] flex-col gap-3 rounded-t-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>Attendance approvals</CardTitle>
                    <CardDescription className="text-emerald-100">Manager review queue for submitted weekly timesheets.</CardDescription>
                  </div>
                  <Button className="border-white/40 bg-white/10 text-white hover:bg-white/20" disabled={isRefreshingApprovals} onClick={() => void refreshApprovals()} type="button" variant="outline">
                    {isRefreshingApprovals ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Refresh queue
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isRefreshingApprovals ? (
                      <div className="flex items-center gap-2 text-sm text-zinc-600">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                        Refreshing approvals...
                      </div>
                  ) : null}

                  {approvals.length === 0 ? (
                      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">No timesheets are waiting for approval.</div>
                  ) : (
                      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
                        <table className="w-full min-w-[1080px] text-sm">
                          <thead className="bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 text-left text-zinc-800">
                          <tr>
                            <th className="px-4 py-3 font-medium">Employee</th>
                            <th className="px-4 py-3 font-medium">Week</th>
                            <th className="px-4 py-3 font-medium">Billable</th>
                            <th className="px-4 py-3 font-medium">Non-billable</th>
                            <th className="px-4 py-3 font-medium">Submitted</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Actions</th>
                          </tr>
                          </thead>
                          <tbody>
                          {approvals.map((item) => (
                              <tr className="border-t border-zinc-200 hover:bg-emerald-50/30" key={item.id}>
                                <td className="px-4 py-3">
                                  <p className="font-semibold text-zinc-900">{item.employeeFullName}</p>
                                  <p className="text-xs text-zinc-500">@{item.employeeUsername}</p>
                                </td>
                                <td className="px-4 py-3 text-zinc-700">{formatWeekRange(item.weekStartDate, item.weekEndDate)}</td>
                                <td className="px-4 py-3 text-zinc-700">{item.billableHours.toFixed(2)}</td>
                                <td className="px-4 py-3 text-zinc-700">{item.nonBillableHours.toFixed(2)}</td>
                                <td className="px-4 py-3 text-zinc-700">{formatDateTime(item.submittedAt)}</td>
                                <td className="px-4 py-3">
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(item.timesheetStatus)}`}>
                              {item.timesheetStatus}
                            </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <Button
                                        className="h-9 rounded-full bg-emerald-600 px-3 text-white hover:bg-emerald-500"
                                        disabled={isRefreshingApprovals}
                                        onClick={() => openApprovalDialog("APPROVE", item)}
                                        size="sm"
                                        title="Approve"
                                    >
                                      <CheckCircle2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        className="h-9 rounded-full border-rose-200 bg-rose-50 px-3 text-rose-700 hover:bg-rose-100"
                                        disabled={isRefreshingApprovals}
                                        onClick={() => openApprovalDialog("REJECT", item)}
                                        size="sm"
                                        title="Reject"
                                        variant="outline"
                                    >
                                      <ShieldX className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                          ))}
                          </tbody>
                        </table>
                      </div>
                  )}
                </CardContent>
              </Card>
          )}
        </div>

        {showTimesheetDrawer && isTimesheetTabActive ? (
            <div
                onClick={(event) => {
                  if (event.target === event.currentTarget) {
                    closeTimesheetDrawer();
                  }
                }}
                className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/45 backdrop-blur-sm"
            >
              <div className="ml-auto flex h-full w-full max-w-5xl flex-col overflow-hidden border-l border-white/50 bg-white shadow-2xl shadow-slate-900/20">
                <div className="border-b border-zinc-200 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-5 py-4 text-white sm:px-6 sm:py-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-2 pr-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-100">Weekly timesheet workspace</p>
                      <h2 className="break-words text-xl font-semibold sm:text-2xl">{formatWeekRange(weekStart, weekData?.weekEndDate ?? toIsoDate(new Date(weekStart)))}</h2>
                      <p className="text-sm text-blue-100">Fill billable and non-billable hours for the full week from this right-side workspace.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {isApprovedSheet && !approvedEditEnabled ? (
                          <Button className="border-white/40 bg-white/10 text-white hover:bg-white/20" onClick={unlockApprovedEdit} variant="outline">
                            <PencilLine className="mr-2 h-4 w-4" />
                            Edit approved timesheet
                          </Button>
                      ) : null}
                      <Button className="border-white/40 bg-white/10 text-white hover:bg-white/20" onClick={closeTimesheetDrawer} variant="outline">
                        Close
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-blue-100">Status</p>
                      <p className="mt-1 font-semibold text-white">{statusLabel}</p>
                    </div>
                    <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-blue-100">Billable total</p>
                      <p className="mt-1 font-semibold text-white">{billableTotal.toFixed(2)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-blue-100">Non-billable total</p>
                      <p className="mt-1 font-semibold text-white">{nonBillableTotal.toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
                  <div className="space-y-4">
                    <div className="overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-white via-blue-50/60 to-violet-50 shadow-sm">
                      <div className="overflow-x-auto p-5">
                        <div className="grid min-w-[1400px] grid-cols-[180px_repeat(7,minmax(170px,1fr))] gap-3">
                          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Work type</p>
                          </div>
                          {draftDays.map((day) => {
                            const totalHours = parseOptionalNumber(day.billableHours) + parseOptionalNumber(day.nonBillableHours);
                            return (
                                <div
                                    className={`rounded-2xl border px-4 py-3 shadow-sm ${
                                        day.leaveDay
                                            ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white"
                                            : day.weekend
                                                ? "border-zinc-200 bg-gradient-to-br from-zinc-50 to-white"
                                                : "border-slate-200 bg-gradient-to-br from-slate-50 via-white to-indigo-50/40"
                                    }`}
                                    key={`header-${day.workDate}`}
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                      <p className="font-semibold text-zinc-950">{day.dayLabel}</p>
                                      <p className="text-xs text-zinc-600">{formatDate(day.workDate)}</p>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {day.weekend ? <Badge className="border-zinc-200 bg-zinc-100 text-zinc-700">Holiday</Badge> : null}
                                      {day.leaveDay ? <Badge className="border-emerald-200 bg-emerald-100 text-emerald-700">Leave</Badge> : null}
                                    </div>
                                  </div>
                                  {day.leaveLabel ? <p className="mt-2 text-xs font-medium text-emerald-700">{day.leaveLabel}</p> : null}
                                  <div className="mt-3 rounded-xl border border-white/60 bg-white/80 px-3 py-2">
                                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Daily total</p>
                                    <p className="mt-1 text-sm font-semibold text-zinc-950">{totalHours.toFixed(2)} hrs</p>
                                  </div>
                                </div>
                            );
                          })}

                          <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-100 to-indigo-50 px-4 py-4 shadow-sm">
                            <p className="text-sm font-semibold text-blue-800">Billable</p>
                            <p className="mt-1 text-xs text-zinc-600">Client or delivery work</p>
                          </div>
                          {draftDays.map((day, index) => {
                            const dayLocked = !canEditSheet || !day.editable;
                            const selectedBillableLabel = resolveAssignmentLabel(
                                weekData?.billableAssignments ?? [],
                                day.billableProjectAllocationId,
                                day.billableProjectName,
                                day.billableProjectCode
                            );
                            return (
                                <div
                                    className={`rounded-2xl border p-3 shadow-sm ${
                                        day.leaveDay
                                            ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white"
                                            : day.weekend
                                                ? "border-zinc-200 bg-gradient-to-br from-zinc-50 to-white"
                                                : "border-blue-100 bg-gradient-to-br from-blue-50 to-white"
                                    }`}
                                    key={`billable-${day.workDate}`}
                                >
                                  {dayLocked ? (
                                      <div className="mb-2 rounded-xl border border-zinc-200 bg-white/80 px-3 py-2 text-[11px] text-zinc-500">
                                        Locked
                                      </div>
                                  ) : null}
                                  <div className="space-y-2">
                                    <Input
                                        disabled={dayLocked}
                                        max="8"
                                        min="0"
                                        onChange={(event: ChangeEvent<HTMLInputElement>) => updateDay(index, "billableHours", event.target.value)}
                                        step="0.25"
                                        type="number"
                                        value={day.billableHours}
                                    />
                                    <select
                                        className="h-10 w-full rounded-xl border border-blue-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-100"
                                        disabled={dayLocked || !weekData?.hasBillableAssignments}
                                        onChange={(event) => updateProjectSelection(index, "billable", event.target.value)}
                                        title={selectedBillableLabel}
                                        value={day.billableProjectAllocationId}
                                    >
                                      <option value="">Select project</option>
                                      {weekData?.billableAssignments.map((assignment) => (
                                          <option key={assignment.allocationId} value={assignment.allocationId}>
                                            {assignment.projectName} ({assignment.projectCode})
                                          </option>
                                      ))}
                                    </select>
                                    <p className="truncate text-[11px] text-zinc-600" title={selectedBillableLabel}>
                                      {selectedBillableLabel}
                                    </p>
                                  </div>
                                </div>
                            );
                          })}

                          <div className="rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-100 to-sky-50 px-4 py-4 shadow-sm">
                            <p className="text-sm font-semibold text-cyan-800">Non-billable</p>
                            <p className="mt-1 text-xs text-zinc-600">Internal or support work</p>
                          </div>
                          {draftDays.map((day, index) => {
                            const dayLocked = !canEditSheet || !day.editable;
                            const selectedNonBillableLabel = resolveAssignmentLabel(
                                weekData?.nonBillableAssignments ?? [],
                                day.nonBillableProjectAllocationId,
                                day.nonBillableProjectName,
                                day.nonBillableProjectCode
                            );
                            return (
                                <div
                                    className={`rounded-2xl border p-3 shadow-sm ${
                                        day.leaveDay
                                            ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white"
                                            : day.weekend
                                                ? "border-zinc-200 bg-gradient-to-br from-zinc-50 to-white"
                                                : "border-cyan-100 bg-gradient-to-br from-cyan-50 to-white"
                                    }`}
                                    key={`non-billable-${day.workDate}`}
                                >
                                  {dayLocked ? (
                                      <div className="mb-2 rounded-xl border border-zinc-200 bg-white/80 px-3 py-2 text-[11px] text-zinc-500">
                                        Locked
                                      </div>
                                  ) : null}
                                  <div className="space-y-2">
                                    <Input
                                        disabled={dayLocked}
                                        min="0"
                                        onChange={(event: ChangeEvent<HTMLInputElement>) => updateDay(index, "nonBillableHours", event.target.value)}
                                        step="0.25"
                                        type="number"
                                        value={day.nonBillableHours}
                                    />
                                    <select
                                        className="h-10 w-full rounded-xl border border-cyan-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-100"
                                        disabled={dayLocked || weekData?.nonBillableAssignments.length === 0}
                                        onChange={(event) => updateProjectSelection(index, "nonBillable", event.target.value)}
                                        title={selectedNonBillableLabel}
                                        value={day.nonBillableProjectAllocationId}
                                    >
                                      <option value="">Select project</option>
                                      {weekData?.nonBillableAssignments.map((assignment) => (
                                          <option key={assignment.allocationId} value={assignment.allocationId}>
                                            {assignment.projectName} ({assignment.projectCode})
                                          </option>
                                      ))}
                                    </select>
                                    <p className="truncate text-[11px] text-zinc-600" title={selectedNonBillableLabel}>
                                      {selectedNonBillableLabel}
                                    </p>
                                  </div>
                                </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-zinc-200 bg-white px-5 py-4 sm:px-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-600">
                      <div className="flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1.5">
                        <LockKeyhole className="h-4 w-4 text-zinc-500" />
                        Billable work above 8 hours per day is blocked.
                      </div>
                      <div className="flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-blue-700">
                        <ShieldCheck className="h-4 w-4" />
                        {canEditWeek ? "Within editable window." : "Older than 30 days is read only."}
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-end gap-3">
                      <Button onClick={closeTimesheetDrawer} variant="outline">
                        Close
                      </Button>
                      <Button disabled={isSaving || !canEditSheet} onClick={() => void handleSave(false)} variant="outline">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clock3 className="mr-2 h-4 w-4" />}
                        Save draft
                      </Button>
                      <Button disabled={isSubmitting || !canEditSheet} onClick={() => void handleSave(true)}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                        Submit timesheet
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
        ) : null}

        {showApprovedEditDialog ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
              <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl shadow-slate-900/20">
                <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 px-6 py-5 text-white">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5" />
                    <div>
                      <h3 className="text-lg font-semibold">Edit approved timesheet</h3>
                      <p className="mt-1 text-sm text-amber-50">Editing this weekly sheet will move it back into the approval flow.</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4 px-6 py-5 text-sm text-zinc-600">
                  <p>Approval will reset after you save or submit any changes for this week.</p>
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
                    Continue only if you want to reopen this approved timesheet for editing.
                  </div>
                </div>
                <div className="flex justify-end gap-2 border-t border-zinc-200 px-6 py-4">
                  <Button onClick={() => setShowApprovedEditDialog(false)} variant="outline">
                    Cancel
                  </Button>
                  <Button
                      className="bg-gradient-to-r from-amber-600 to-rose-600 text-white hover:from-amber-500 hover:to-rose-500"
                      onClick={() => {
                        setApprovedEditEnabled(true);
                        setShowApprovedEditDialog(false);
                      }}
                  >
                    Enable editing
                  </Button>
                </div>
              </div>
            </div>
        ) : null}

        {selectedApproval ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
              <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl shadow-slate-900/20">
                <div className={`px-6 py-5 text-white ${approvalActionType === "APPROVE" ? "bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600" : "bg-gradient-to-r from-rose-600 via-red-600 to-orange-600"}`}>
                  <h3 className="text-lg font-semibold">
                    {approvalActionType === "APPROVE" ? "Approve timesheet" : "Reject timesheet"} #{selectedApproval.id}
                  </h3>
                  <p className="mt-1 text-sm text-white/90">Review the weekly summary and add a mandatory comment before submitting the action.</p>
                </div>

                <div className="space-y-4 px-6 py-5">
                  <div className="grid gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Employee</p>
                      <p className="mt-1 font-semibold text-zinc-950">{selectedApproval.employeeFullName}</p>
                      <p className="text-sm text-zinc-600">@{selectedApproval.employeeUsername}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Week</p>
                      <p className="mt-1 font-semibold text-zinc-950">{formatWeekRange(selectedApproval.weekStartDate, selectedApproval.weekEndDate)}</p>
                      <p className="text-sm text-zinc-600">Submitted {formatDateTime(selectedApproval.submittedAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Billable hours</p>
                      <p className="mt-1 font-semibold text-zinc-950">{selectedApproval.billableHours.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Non-billable hours</p>
                      <p className="mt-1 font-semibold text-zinc-950">{selectedApproval.nonBillableHours.toFixed(2)}</p>
                    </div>
                  </div>

                  <MentionTextareaField
                      className="min-h-28"
                      label={approvalActionType === "APPROVE" ? "Approval comment" : "Rejection reason"}
                      mentionSearch={mentionSearch}
                      maxLength={500}
                      onChange={setApprovalComment}
                      value={approvalComment}
                  />
                </div>

                <div className="flex justify-end gap-2 border-t border-zinc-200 px-6 py-4">
                  <Button disabled={isActioning} onClick={closeApprovalDialog} variant="outline">
                    Cancel
                  </Button>
                  <Button disabled={isActioning} onClick={() => void submitApprovalAction()}>
                    {isActioning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquareQuote className="mr-2 h-4 w-4" />}
                    Submit action
                  </Button>
                </div>
              </div>
            </div>
        ) : null}
      </>
  );
}
