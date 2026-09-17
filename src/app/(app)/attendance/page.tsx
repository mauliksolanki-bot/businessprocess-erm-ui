"use client";

import { type ChangeEvent, useEffect, useMemo, useState } from "react";
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
  PencilLine,
  ShieldCheck,
  Users2,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/erm/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  actionAttendanceTimesheet,
  getAttendanceApprovals,
  getAttendanceApproverVisibility,
  getAttendanceWeek,
  saveAttendanceTimesheet,
  submitAttendanceTimesheet,
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
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

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
  const [weekStart, setWeekStart] = useState(() => toIsoDate(startOfWeek(new Date())));
  const [weekData, setWeekData] = useState<AttendanceWeek | null>(null);
  const [draftDays, setDraftDays] = useState<DraftDay[]>([]);
  const [approvals, setApprovals] = useState<AttendanceApprovalItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshingApprovals, setIsRefreshingApprovals] = useState(false);
  const [approvedEditEnabled, setApprovedEditEnabled] = useState(false);
  const [approverVisible, setApproverVisible] = useState(false);

  const session = loadSession();
  const accessToken = session?.accessToken ?? "";

  const isApprovedSheet = weekData?.timesheet?.timesheetStatus === "APPROVED";
  const canEditWeek = weekData?.editable ?? false;
  const canEditSheet = canEditWeek && (!isApprovedSheet || approvedEditEnabled);
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

  function shiftWeek(days: number) {
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
        const refreshed = await getAttendanceApprovals(accessToken);
        setApprovals(refreshed);
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

  async function handleApproval(action: "APPROVE" | "REJECT", item: AttendanceApprovalItem) {
    if (!accessToken) {
      router.replace("/login");
      return;
    }

    const comment = window.prompt(
        action === "APPROVE" ? "Enter approval comment" : "Enter rejection reason"
    );
    if (!comment) {
      return;
    }

    setIsRefreshingApprovals(true);
    try {
      await actionAttendanceTimesheet(accessToken, item.id, {
        decision: action,
        comment,
      });
      toast.success(action === "APPROVE" ? "Timesheet approved." : "Timesheet rejected.");
      setApprovals(await getAttendanceApprovals(accessToken));
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Unable to action the timesheet.");
      }
    } finally {
      setIsRefreshingApprovals(false);
    }
  }

  function unlockApprovedEdit() {
    const confirmed = window.confirm(
        "Approval will be reset if you edit the approved timesheet. Are you sure you want to edit the timesheet?"
    );
    if (confirmed) {
      setApprovedEditEnabled(true);
    }
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
                <Button onClick={() => shiftWeek(7)} variant="outline">
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

          {isLoading ? (
              <Card>
                <CardContent className="flex items-center gap-3 p-6 text-sm text-zinc-600">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  Loading attendance...
                </CardContent>
              </Card>
          ) : (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
                <Card>
                  <CardHeader className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <CardTitle>Weekly timesheet</CardTitle>
                        <CardDescription>Enter one billable and one non-billable line per day.</CardDescription>
                      </div>
                      {isApprovedSheet && !approvedEditEnabled ? (
                          <Button onClick={unlockApprovedEdit} variant="outline">
                            <PencilLine className="mr-2 h-4 w-4" />
                            Edit approved timesheet
                          </Button>
                      ) : null}
                    </div>

                    {isApprovedSheet && approvedEditEnabled ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                          Approval will be reset when you save or submit changes.
                        </div>
                    ) : null}

                    {!weekData?.hasBillableAssignments ? (
                        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                          No billable project is assigned for this week. Billable hours can be drafted, but submission will be blocked until a billable assignment exists.
                        </div>
                    ) : null}
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {draftDays.map((day, index) => {
                      const dayLocked = !canEditSheet || !day.editable;
                      return (
                          <div
                              className={`grid gap-3 rounded-2xl border p-4 lg:grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)] ${
                                  day.leaveDay
                                      ? "border-emerald-200 bg-emerald-50/70"
                                      : day.weekend
                                          ? "border-zinc-200 bg-zinc-50"
                                          : "border-zinc-200 bg-white"
                              }`}
                              key={day.workDate}
                          >
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-zinc-950">{day.dayLabel}</p>
                                {day.weekend ? <Badge className="border-zinc-200 bg-zinc-100 text-zinc-700">Holiday</Badge> : null}
                                {day.leaveDay ? <Badge className="border-emerald-200 bg-emerald-100 text-emerald-700">Leave</Badge> : null}
                              </div>
                              <p className="text-sm text-zinc-600">{formatDate(day.workDate)}</p>
                              {day.leaveLabel ? <p className="text-xs font-medium text-emerald-700">{day.leaveLabel}</p> : null}
                              {dayLocked ? <p className="text-xs text-zinc-500">Editing disabled for this day.</p> : null}
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="space-y-1.5">
                                <span className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">Billable hours</span>
                                <Input
                                    disabled={dayLocked}
                                    max="8"
                                    min="0"
                                    onChange={(event: ChangeEvent<HTMLInputElement>) => updateDay(index, "billableHours", event.target.value)}
                                    step="0.25"
                                    type="number"
                                    value={day.billableHours}
                                />
                              </label>
                              <label className="space-y-1.5">
                                <span className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">Billable project</span>
                                <select
                                    className="h-10 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-100"
                                    disabled={dayLocked || !weekData?.hasBillableAssignments}
                                    onChange={(event) => updateDay(index, "billableProjectAllocationId", event.target.value)}
                                    value={day.billableProjectAllocationId}
                                >
                                  <option value="">Select assignment</option>
                                  {weekData?.billableAssignments.map((assignment) => (
                                      <option key={assignment.allocationId} value={assignment.allocationId}>
                                        {assignment.projectName} ({assignment.projectCode})
                                      </option>
                                  ))}
                                </select>
                              </label>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="space-y-1.5">
                                <span className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">Non-billable hours</span>
                                <Input
                                    disabled={dayLocked}
                                    min="0"
                                    onChange={(event: ChangeEvent<HTMLInputElement>) => updateDay(index, "nonBillableHours", event.target.value)}
                                    step="0.25"
                                    type="number"
                                    value={day.nonBillableHours}
                                />
                              </label>
                              <label className="space-y-1.5">
                                <span className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">Non-billable project</span>
                                <select
                                    className="h-10 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-100"
                                    disabled={dayLocked || weekData?.nonBillableAssignments.length === 0}
                                    onChange={(event) => updateDay(index, "nonBillableProjectAllocationId", event.target.value)}
                                    value={day.nonBillableProjectAllocationId}
                                >
                                  <option value="">Select assignment</option>
                                  {weekData?.nonBillableAssignments.map((assignment) => (
                                      <option key={assignment.allocationId} value={assignment.allocationId}>
                                        {assignment.projectName} ({assignment.projectCode})
                                      </option>
                                  ))}
                                </select>
                              </label>
                            </div>
                          </div>
                      );
                    })}

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                      <div className="flex items-center gap-2">
                        <LockKeyhole className="h-4 w-4 text-zinc-500" />
                        Billable work above 8 hours per day is blocked.
                      </div>
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-blue-600" />
                        {canEditWeek ? "Within editable window." : "Older than 30 days is read only."}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 pt-2">
                      <Button disabled={isSaving || !canEditSheet} onClick={() => void handleSave(false)} variant="outline">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clock3 className="mr-2 h-4 w-4" />}
                        Save draft
                      </Button>
                      <Button disabled={isSubmitting || !canEditSheet} onClick={() => void handleSave(true)}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                        Submit timesheet
                      </Button>
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

                  {approverVisible ? (
                      <Card>
                        <CardHeader>
                          <CardTitle>Billable approvals</CardTitle>
                          <CardDescription>Pending timesheets for your reporting team.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {isRefreshingApprovals ? (
                              <div className="flex items-center gap-2 text-sm text-zinc-600">
                                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                                Refreshing approvals...
                              </div>
                          ) : null}

                          {approvals.length === 0 ? (
                              <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
                                No pending billable timesheets right now.
                              </div>
                          ) : (
                              approvals.map((item) => (
                                  <div className="rounded-2xl border border-zinc-200 bg-white p-4" key={item.id}>
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                      <div>
                                        <p className="font-semibold text-zinc-950">{item.employeeFullName}</p>
                                        <p className="text-sm text-zinc-600">@{item.employeeUsername}</p>
                                        <p className="mt-1 text-xs text-zinc-500">
                                          {formatWeekRange(item.weekStartDate, item.weekEndDate)}
                                        </p>
                                      </div>
                                      <Badge className="border-amber-200 bg-amber-100 text-amber-700">{item.timesheetStatus}</Badge>
                                    </div>
                                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-zinc-600">
                                      <div className="rounded-xl bg-zinc-50 p-3">
                                        <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Billable</p>
                                        <p className="mt-1 text-lg font-semibold text-zinc-950">{item.billableHours.toFixed(2)}</p>
                                      </div>
                                      <div className="rounded-xl bg-zinc-50 p-3">
                                        <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Non-billable</p>
                                        <p className="mt-1 text-lg font-semibold text-zinc-950">{item.nonBillableHours.toFixed(2)}</p>
                                      </div>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      <Button disabled={isRefreshingApprovals} onClick={() => void handleApproval("APPROVE", item)} size="sm">
                                        Approve
                                      </Button>
                                      <Button disabled={isRefreshingApprovals} onClick={() => void handleApproval("REJECT", item)} size="sm" variant="outline">
                                        Reject
                                      </Button>
                                    </div>
                                  </div>
                              ))
                          )}
                        </CardContent>
                      </Card>
                  ) : (
                      <Card>
                        <CardHeader>
                          <CardTitle>Approvals hidden</CardTitle>
                          <CardDescription>This account does not have direct-report attendance approvals.</CardDescription>
                        </CardHeader>
                        <CardContent className="text-sm text-zinc-600">
                          The attendance tab is still shared for all users; only approval controls are hidden when there are no reportees.
                        </CardContent>
                      </Card>
                  )}
                </div>
              </div>
          )}
        </div>
      </>
  );
}
