"use client";

import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
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
  billableProjectName: string | null;
  billableProjectCode: string | null;
  nonBillableProjectAllocationId: string;
  nonBillableProjectName: string | null;
  nonBillableProjectCode: string | null;
};

type ApprovalActionType = "APPROVE" | "REJECT";

const dayLabelFormatter = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const dateFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeek(date: Date): Date {
  const clone = new Date(date);
  const day = clone.getDay();
  const diff = (day + 6) % 7; // Monday as first day
  clone.setDate(clone.getDate() - diff);
  clone.setHours(0, 0, 0, 0);
  return clone;
}

function formatDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return dateFormatter.format(parsed);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return dateTimeFormatter.format(parsed);
}

function formatWeekRange(startDate: string, endDate: string): string {
  return `${formatDate(startDate)} – ${formatDate(endDate)}`;
}

function parseOptionalNumber(value: string): number {
  if (!value.trim()) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatAssignmentLabel(name: string | null, code: string | null): string {
  if (!name && !code) return "Not set";
  if (name && code) return `${name} (${code})`;
  return name ?? code ?? "Not set";
}

function initials(name: string): string {
  return (
      name
          .split(" ")
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0]?.toUpperCase() ?? "")
          .join("") || "?"
  );
}

function statusClass(status: string): string {
  switch (status) {
    case "APPROVED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "REJECTED":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "SUBMITTED":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-zinc-200 bg-zinc-100 text-zinc-700";
  }
}

function createDraftDays(days: AttendanceDay[]): DraftDay[] {
  return days.map((day) => ({
    workDate: day.workDate,
    dayLabel: dayLabelFormatter.format(new Date(`${day.workDate}T00:00:00`)),
    weekend: day.weekend,
    leaveDay: day.leaveDay,
    leaveLabel: day.leaveLabel ?? null,
    editable: day.editable,
    billableHours: day.billableHours ? String(day.billableHours) : "",
    nonBillableHours: day.nonBillableHours ? String(day.nonBillableHours) : "",
    billableProjectAllocationId: day.billableProjectAllocationId ? String(day.billableProjectAllocationId) : "",
    billableProjectName: day.billableProjectName ?? null,
    billableProjectCode: day.billableProjectCode ?? null,
    nonBillableProjectAllocationId: day.nonBillableProjectAllocationId ? String(day.nonBillableProjectAllocationId) : "",
    nonBillableProjectName: day.nonBillableProjectName ?? null,
    nonBillableProjectCode: day.nonBillableProjectCode ?? null,
  }));
}

function emptyDraftDays(weekStart: Date): DraftDay[] {
  return Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    return {
      workDate: toIsoDate(date),
      dayLabel: dayLabelFormatter.format(date),
      weekend,
      leaveDay: false,
      leaveLabel: null,
      editable: !weekend,
      billableHours: "",
      nonBillableHours: "",
      billableProjectAllocationId: "",
      billableProjectName: null,
      billableProjectCode: null,
      nonBillableProjectAllocationId: "",
      nonBillableProjectName: null,
      nonBillableProjectCode: null,
    };
  });
}

function deriveDominantAllocationId(
    days: DraftDay[],
    field: "billableProjectAllocationId" | "nonBillableProjectAllocationId"
): { value: string; mixed: boolean } {
  const counts = new Map<string, number>();
  for (const day of days) {
    const value = day[field];
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let best = "";
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return { value: best, mixed: counts.size > 1 };
}

function fillAllocationGaps(
    days: DraftDay[],
    billableId: string,
    nonBillableId: string,
    billableAssignments: AttendanceAssignment[],
    nonBillableAssignments: AttendanceAssignment[]
): DraftDay[] {
  const billableAssignment = billableAssignments.find((assignment) => String(assignment.allocationId) === billableId);
  const nonBillableAssignment = nonBillableAssignments.find(
      (assignment) => String(assignment.allocationId) === nonBillableId
  );
  return days.map((day) => {
    if (day.weekend || day.leaveDay || !day.editable) return day;
    let next = day;
    if (billableId && !next.billableProjectAllocationId) {
      next = {
        ...next,
        billableProjectAllocationId: billableId,
        billableProjectName: billableAssignment?.projectName ?? next.billableProjectName,
        billableProjectCode: billableAssignment?.projectCode ?? next.billableProjectCode,
      };
    }
    if (nonBillableId && !next.nonBillableProjectAllocationId) {
      next = {
        ...next,
        nonBillableProjectAllocationId: nonBillableId,
        nonBillableProjectName: nonBillableAssignment?.projectName ?? next.nonBillableProjectName,
        nonBillableProjectCode: nonBillableAssignment?.projectCode ?? next.nonBillableProjectCode,
      };
    }
    return next;
  });
}

function applyAllocationToAllDays(
    days: DraftDay[],
    type: "billable" | "nonBillable",
    allocationId: string,
    assignment: AttendanceAssignment | undefined
): DraftDay[] {
  return days.map((day) => {
    if (day.weekend || day.leaveDay || !day.editable) return day;
    if (type === "billable") {
      return {
        ...day,
        billableProjectAllocationId: allocationId,
        billableProjectName: assignment?.projectName ?? null,
        billableProjectCode: assignment?.projectCode ?? null,
      };
    }
    return {
      ...day,
      nonBillableProjectAllocationId: allocationId,
      nonBillableProjectName: assignment?.projectName ?? null,
      nonBillableProjectCode: assignment?.projectCode ?? null,
    };
  });
}

export default function AttendancePage() {
  const accessToken = useMemo(() => loadSession()?.accessToken ?? null, []);

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [weekData, setWeekData] = useState<AttendanceWeek | null>(null);
  const [draftDays, setDraftDays] = useState<DraftDay[]>([]);
  const [selectedBillableAllocationId, setSelectedBillableAllocationId] = useState("");
  const [selectedNonBillableAllocationId, setSelectedNonBillableAllocationId] = useState("");
  const [billableMixed, setBillableMixed] = useState(false);
  const [nonBillableMixed, setNonBillableMixed] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [approvedEditEnabled, setApprovedEditEnabled] = useState(false);
  const [showApprovedEditDialog, setShowApprovedEditDialog] = useState(false);

  const [activeTab, setActiveTab] = useState<"timesheet" | "approvals">("timesheet");
  const [approverVisible, setApproverVisible] = useState(false);
  const [approvals, setApprovals] = useState<AttendanceApprovalItem[]>([]);
  const [isRefreshingApprovals, setIsRefreshingApprovals] = useState(false);

  const [selectedApproval, setSelectedApproval] = useState<AttendanceApprovalItem | null>(null);
  const [approvalActionType, setApprovalActionType] = useState<ApprovalActionType | null>(null);
  const [approvalComment, setApprovalComment] = useState("");
  const [isActioning, setIsActioning] = useState(false);

  const weekStartIso = useMemo(() => toIsoDate(weekStart), [weekStart]);

  const loadWeek = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const weekResult = await getAttendanceWeek(accessToken, weekStartIso);
      setWeekData(weekResult);
      setApprovedEditEnabled(false);

      const nextDraftDays = weekResult.days.length > 0 ? createDraftDays(weekResult.days) : emptyDraftDays(weekStart);

      const billableDerived = deriveDominantAllocationId(nextDraftDays, "billableProjectAllocationId");
      const nonBillableDerived = deriveDominantAllocationId(nextDraftDays, "nonBillableProjectAllocationId");

      let initialBillableId = billableDerived.value;
      if (!initialBillableId && weekResult.billableAssignments.length === 1) {
        initialBillableId = String(weekResult.billableAssignments[0].allocationId);
      }
      let initialNonBillableId = nonBillableDerived.value;
      if (!initialNonBillableId && weekResult.nonBillableAssignments.length === 1) {
        initialNonBillableId = String(weekResult.nonBillableAssignments[0].allocationId);
      }

      const filledDays = fillAllocationGaps(
          nextDraftDays,
          billableDerived.mixed ? "" : initialBillableId,
          nonBillableDerived.mixed ? "" : initialNonBillableId,
          weekResult.billableAssignments,
          weekResult.nonBillableAssignments
      );

      setDraftDays(filledDays);
      setSelectedBillableAllocationId(initialBillableId);
      setSelectedNonBillableAllocationId(initialNonBillableId);
      setBillableMixed(billableDerived.mixed);
      setNonBillableMixed(nonBillableDerived.mixed);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load attendance week.");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, weekStart, weekStartIso]);

  const refreshApprovals = useCallback(async () => {
    if (!accessToken) return;
    setIsRefreshingApprovals(true);
    try {
      const visible = await getAttendanceApproverVisibility(accessToken);
      setApproverVisible(visible.hasReportees);
      if (visible.hasReportees) {
        const items = await getAttendanceApprovals(accessToken);
        setApprovals(items);
      } else {
        setApprovals([]);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load approval queue.");
    } finally {
      setIsRefreshingApprovals(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadWeek();
  }, [loadWeek]);

  useEffect(() => {
    void refreshApprovals();
  }, [refreshApprovals]);

  const shiftWeek = (deltaDays: number) => {
    setWeekStart((current) => {
      const next = new Date(current);
      next.setDate(next.getDate() + deltaDays);
      return startOfWeek(next);
    });
  };

  const updateDay = (index: number, field: "billableHours" | "nonBillableHours", value: string) => {
    setDraftDays((current) => {
      const next = [...current];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAllocationChange = (type: "billable" | "nonBillable", allocationId: string) => {
    const assignments = type === "billable" ? weekData?.billableAssignments ?? [] : weekData?.nonBillableAssignments ?? [];
    const assignment = assignments.find((item) => String(item.allocationId) === allocationId);
    setDraftDays((current) => applyAllocationToAllDays(current, type, allocationId, assignment));
    if (type === "billable") {
      setSelectedBillableAllocationId(allocationId);
      setBillableMixed(false);
    } else {
      setSelectedNonBillableAllocationId(allocationId);
      setNonBillableMixed(false);
    }
  };

  const isApprovedSheet = weekData?.timesheet?.timesheetStatus === "APPROVED";
  const canEditWeek = weekData?.editable ?? true;
  const canEditSheet = canEditWeek && (!isApprovedSheet || approvedEditEnabled);

  const billableTotal = useMemo(
      () => draftDays.reduce((sum, day) => sum + parseOptionalNumber(day.billableHours), 0),
      [draftDays]
  );
  const nonBillableTotal = useMemo(
      () => draftDays.reduce((sum, day) => sum + parseOptionalNumber(day.nonBillableHours), 0),
      [draftDays]
  );

  const mapPayload = () => ({
    weekStartDate: weekStartIso,
    days: draftDays.map((day) => ({
      workDate: day.workDate,
      billableHours: parseOptionalNumber(day.billableHours),
      nonBillableHours: parseOptionalNumber(day.nonBillableHours),
      billableProjectAllocationId: day.billableProjectAllocationId ? Number(day.billableProjectAllocationId) : null,
      nonBillableProjectAllocationId: day.nonBillableProjectAllocationId
          ? Number(day.nonBillableProjectAllocationId)
          : null,
    })),
  });

  const handleSave = async (submit: boolean) => {
    if (!accessToken) return;
    const overCap = draftDays.some((day) => parseOptionalNumber(day.billableHours) > 8);
    if (overCap) {
      toast.error("Billable hours cannot exceed 8 hours per day.");
      return;
    }
    if (isApprovedSheet && !approvedEditEnabled) {
      setShowApprovedEditDialog(true);
      return;
    }
    if (submit) {
      setIsSubmitting(true);
    } else {
      setIsSaving(true);
    }
    try {
      const payload = mapPayload();
      if (submit) {
        await submitAttendanceTimesheet(accessToken, payload);
        toast.success("Timesheet submitted for approval.");
      } else {
        await saveAttendanceTimesheet(accessToken, payload);
        toast.success("Draft saved.");
      }
      await loadWeek();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save timesheet.");
    } finally {
      setIsSaving(false);
      setIsSubmitting(false);
    }
  };

  const unlockApprovedEdit = () => {
    setApprovedEditEnabled(true);
    setShowApprovedEditDialog(false);
  };

  const openApprovalDialog = (type: ApprovalActionType, item: AttendanceApprovalItem) => {
    setApprovalActionType(type);
    setSelectedApproval(item);
    setApprovalComment("");
  };

  const closeApprovalDialog = () => {
    setApprovalActionType(null);
    setSelectedApproval(null);
    setApprovalComment("");
  };

  const submitApprovalAction = async () => {
    if (!accessToken || !selectedApproval || !approvalActionType) return;
    setIsActioning(true);
    try {
      await actionAttendanceTimesheet(accessToken, selectedApproval.id, {
        decision: approvalActionType,
        comment: approvalComment,
      });
      toast.success(approvalActionType === "APPROVE" ? "Timesheet approved." : "Timesheet rejected.");
      closeApprovalDialog();
      await refreshApprovals();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update timesheet.");
    } finally {
      setIsActioning(false);
    }
  };

  return (
      <>
        <PageHeader
            description="Fill your weekly billable and non-billable hours in a few clicks."
            title="Attendance"
        />

        <div className="space-y-6">
          <Card className="overflow-hidden border-blue-100 bg-gradient-to-r from-blue-50 via-white to-indigo-50">
            <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Button onClick={() => shiftWeek(-7)} size="sm" variant="outline">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Week</p>
                  <p className="text-lg font-semibold text-zinc-950">
                    {formatWeekRange(weekStartIso, toIsoDate(new Date(weekStart.getTime() + 6 * 86400000)))}
                  </p>
                </div>
                <Button onClick={() => shiftWeek(7)} size="sm" variant="outline">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button onClick={() => setWeekStart(startOfWeek(new Date()))} size="sm" variant="ghost">
                Jump to current week
              </Button>
            </CardContent>
          </Card>

          <section className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Billable hours</CardDescription>
                <CardTitle className="text-2xl">{billableTotal.toFixed(2)}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-zinc-600">
                {weekData?.hasBillableAssignments ? "Logged for this week." : "No billable assignment for this week."}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Non-billable hours</CardDescription>
                <CardTitle className="text-2xl">{nonBillableTotal.toFixed(2)}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-zinc-600">Internal work logged for this week.</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Status</CardDescription>
                <CardTitle className="text-2xl">{weekData?.timesheet?.timesheetStatus ?? "DRAFT"}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-zinc-600">
                {canEditWeek ? "This week is editable." : "Read only — older than 30 days."}
              </CardContent>
            </Card>
          </section>

          <div className="flex flex-wrap gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm">
            <Button
                onClick={() => setActiveTab("timesheet")}
                size="sm"
                variant={activeTab === "timesheet" ? "default" : "ghost"}
            >
              <Clock3 className="mr-2 h-4 w-4" /> My timesheet
            </Button>
            {approverVisible ? (
                <Button
                    onClick={() => setActiveTab("approvals")}
                    size="sm"
                    variant={activeTab === "approvals" ? "default" : "ghost"}
                >
                  <ShieldCheck className="mr-2 h-4 w-4" /> Approval queue
                  {approvals.length > 0 ? <Badge className="ml-2 border-white/40 bg-white/20 text-white">{approvals.length}</Badge> : null}
                </Button>
            ) : null}
          </div>

          {isLoading ? (
              <div className="flex items-center justify-center rounded-2xl border border-zinc-200 bg-white py-16">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
          ) : activeTab === "timesheet" ? (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-6">
                  {isApprovedSheet && !approvedEditEnabled ? (
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" /> This timesheet is already approved. Editing requires confirmation.
                        </div>
                        <Button onClick={() => setShowApprovedEditDialog(true)} size="sm" variant="outline">
                          <PencilLine className="mr-2 h-4 w-4" /> Edit anyway
                        </Button>
                      </div>
                  ) : null}

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Briefcase className="h-5 w-5 text-blue-600" /> Project for this week
                      </CardTitle>
                      <CardDescription>Pick your project once — it applies to every day this week automatically.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Billable</p>
                        {!weekData?.hasBillableAssignments ? (
                            <p className="mt-2 text-sm text-zinc-600">No billable project assigned for this week.</p>
                        ) : weekData.billableAssignments.length <= 1 ? (
                            <p className="mt-2 text-base font-semibold text-zinc-950">
                              {formatAssignmentLabel(
                                  weekData.billableAssignments[0]?.projectName ?? null,
                                  weekData.billableAssignments[0]?.projectCode ?? null
                              )}
                            </p>
                        ) : (
                            <>
                              <select
                                  className="mt-2 h-10 w-full rounded-xl border border-blue-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-100"
                                  disabled={!canEditSheet}
                                  onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                                      handleAllocationChange("billable", event.target.value)
                                  }
                                  value={selectedBillableAllocationId}
                              >
                                <option value="">Select project</option>
                                {weekData.billableAssignments.map((assignment) => (
                                    <option key={assignment.allocationId} value={assignment.allocationId}>
                                      {assignment.projectName} ({assignment.projectCode})
                                    </option>
                                ))}
                              </select>
                              {billableMixed ? (
                                  <p className="mt-2 text-xs text-amber-700">
                                    Different projects were used on different days before — pick one to standardize the week.
                                  </p>
                              ) : null}
                            </>
                        )}
                      </div>
                      <div className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">Non-billable</p>
                        {(weekData?.nonBillableAssignments.length ?? 0) === 0 ? (
                            <p className="mt-2 text-sm text-zinc-600">No non-billable project assigned for this week.</p>
                        ) : weekData!.nonBillableAssignments.length <= 1 ? (
                            <p className="mt-2 text-base font-semibold text-zinc-950">
                              {formatAssignmentLabel(
                                  weekData!.nonBillableAssignments[0]?.projectName ?? null,
                                  weekData!.nonBillableAssignments[0]?.projectCode ?? null
                              )}
                            </p>
                        ) : (
                            <>
                              <select
                                  className="mt-2 h-10 w-full rounded-xl border border-cyan-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:bg-zinc-100"
                                  disabled={!canEditSheet}
                                  onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                                      handleAllocationChange("nonBillable", event.target.value)
                                  }
                                  value={selectedNonBillableAllocationId}
                              >
                                <option value="">Select project</option>
                                {weekData!.nonBillableAssignments.map((assignment) => (
                                    <option key={assignment.allocationId} value={assignment.allocationId}>
                                      {assignment.projectName} ({assignment.projectCode})
                                    </option>
                                ))}
                              </select>
                              {nonBillableMixed ? (
                                  <p className="mt-2 text-xs text-amber-700">
                                    Different projects were used on different days before — pick one to standardize the week.
                                  </p>
                              ) : null}
                            </>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ClipboardList className="h-5 w-5 text-blue-600" /> Weekly hours
                      </CardTitle>
                      <CardDescription>
                        Enter billable and non-billable hours for each day. Weekends and approved leave are locked automatically.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="overflow-x-auto rounded-2xl border border-zinc-200">
                        <table className="w-full min-w-[560px] text-sm">
                          <thead className="bg-zinc-50 text-left text-zinc-600">
                          <tr>
                            <th className="px-4 py-3 font-medium">Day</th>
                            <th className="px-4 py-3 font-medium">Billable (hrs)</th>
                            <th className="px-4 py-3 font-medium">Non-billable (hrs)</th>
                            <th className="px-4 py-3 text-right font-medium">Total</th>
                          </tr>
                          </thead>
                          <tbody>
                          {draftDays.map((day, index) => {
                            const dayLocked = !canEditSheet || !day.editable;
                            const total = parseOptionalNumber(day.billableHours) + parseOptionalNumber(day.nonBillableHours);
                            return (
                                <tr
                                    className={`border-t border-zinc-100 ${
                                        day.leaveDay ? "bg-emerald-50/50" : day.weekend ? "bg-zinc-50" : ""
                                    }`}
                                    key={day.workDate}
                                >
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <div>
                                        <p className="font-semibold text-zinc-950">{day.dayLabel}</p>
                                        <p className="text-xs text-zinc-500">{formatDate(day.workDate)}</p>
                                      </div>
                                      <div className="flex flex-col gap-1">
                                        {day.weekend ? (
                                            <Badge className="border-zinc-200 bg-zinc-100 text-zinc-700">Holiday</Badge>
                                        ) : null}
                                        {day.leaveDay ? (
                                            <Badge className="border-emerald-200 bg-emerald-100 text-emerald-700">
                                              {day.leaveLabel ?? "Leave"}
                                            </Badge>
                                        ) : null}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <Input
                                        className="w-24"
                                        disabled={dayLocked}
                                        max="8"
                                        min="0"
                                        onChange={(event) => updateDay(index, "billableHours", event.target.value)}
                                        step="0.25"
                                        type="number"
                                        value={day.billableHours}
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <Input
                                        className="w-24"
                                        disabled={dayLocked}
                                        min="0"
                                        onChange={(event) => updateDay(index, "nonBillableHours", event.target.value)}
                                        step="0.25"
                                        type="number"
                                        value={day.nonBillableHours}
                                    />
                                  </td>
                                  <td className="px-4 py-3 text-right font-semibold text-zinc-900">{total.toFixed(2)}</td>
                                </tr>
                            );
                          })}
                          </tbody>
                          <tfoot>
                          <tr className="border-t border-zinc-200 bg-zinc-50 font-semibold text-zinc-900">
                            <td className="px-4 py-3">Weekly total</td>
                            <td className="px-4 py-3">{billableTotal.toFixed(2)}</td>
                            <td className="px-4 py-3">{nonBillableTotal.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right">{(billableTotal + nonBillableTotal).toFixed(2)}</td>
                          </tr>
                          </tfoot>
                        </table>
                      </div>

                      <div className="flex flex-col gap-3 border-t border-zinc-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                      <span className="flex items-center gap-1">
                        <LockKeyhole className="h-3.5 w-3.5" /> Billable hours are capped at 8/day.
                      </span>
                          <span className="flex items-center gap-1">
                        <ShieldCheck className="h-3.5 w-3.5" />{" "}
                            {canEditWeek ? "Within editable window." : "Read only — older than 30 days."}
                      </span>
                        </div>
                        <div className="flex flex-wrap justify-end gap-3">
                          <Button disabled={isSaving || !canEditSheet} onClick={() => void handleSave(false)} variant="outline">
                            {isSaving ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Clock3 className="mr-2 h-4 w-4" />
                            )}
                            Save draft
                          </Button>
                          <Button disabled={isSubmitting || !canEditSheet} onClick={() => void handleSave(true)}>
                            {isSubmitting ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <ArrowRight className="mr-2 h-4 w-4" />
                            )}
                            Submit timesheet
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users2 className="h-5 w-5 text-blue-600" /> Rules &amp; availability
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm text-zinc-600">
                      <p className="flex items-start gap-2">
                        <CalendarDays className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" /> Weekends and approved leave are
                        locked automatically and cannot be edited.
                      </p>
                      <p className="flex items-start gap-2">
                        <LockKeyhole className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" /> Billable hours cannot exceed 8
                        hours in a single day.
                      </p>
                      <p className="flex items-start gap-2">
                        <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" /> Timesheets can only be edited
                        within 30 days of the work week.
                      </p>
                      <p className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" /> Once approved, editing needs an
                        explicit confirmation since it may affect billing.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
          ) : (
              <Card>
                <CardHeader className="flex flex-col gap-3 rounded-t-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-white">Attendance approvals</CardTitle>
                    <CardDescription className="text-emerald-100">
                      Review and act on submitted weekly timesheets from your reportees.
                    </CardDescription>
                  </div>
                  <Button
                      className="border-white/40 bg-white/10 text-white hover:bg-white/20"
                      disabled={isRefreshingApprovals}
                      onClick={() => void refreshApprovals()}
                      size="sm"
                      variant="outline"
                  >
                    {isRefreshingApprovals ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <ShieldCheck className="mr-2 h-4 w-4" />
                    )}
                    Refresh queue
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3 pt-6">
                  {approvals.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-12 text-center text-zinc-500">
                        <ShieldCheck className="h-8 w-8 text-emerald-500" />
                        <p className="font-medium text-zinc-700">Nothing pending approval.</p>
                        <p className="text-sm">Submitted timesheets from your reportees will show up here.</p>
                      </div>
                  ) : (
                      approvals.map((item) => (
                          <div
                              className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                              key={item.id}
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-semibold text-white">
                                {initials(item.employeeFullName)}
                              </div>
                              <div>
                                <p className="font-semibold text-zinc-950">{item.employeeFullName}</p>
                                <p className="text-xs text-zinc-500">
                                  @{item.employeeUsername} · {formatWeekRange(item.weekStartDate, item.weekEndDate)}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className="border-blue-200 bg-blue-50 text-blue-700">
                                Billable {item.billableHours.toFixed(2)}h
                              </Badge>
                              <Badge className="border-cyan-200 bg-cyan-50 text-cyan-700">
                                Non-billable {item.nonBillableHours.toFixed(2)}h
                              </Badge>
                              <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(item.timesheetStatus)}`}>
                        {item.timesheetStatus}
                      </span>
                              <span className="text-xs text-zinc-500">Submitted {formatDateTime(item.submittedAt)}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <Button
                                  className="h-9 rounded-full bg-emerald-600 px-3 text-white hover:bg-emerald-500"
                                  onClick={() => openApprovalDialog("APPROVE", item)}
                                  size="sm"
                                  title="Approve"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button
                                  className="h-9 rounded-full border-rose-200 bg-rose-50 px-3 text-rose-700 hover:bg-rose-100"
                                  onClick={() => openApprovalDialog("REJECT", item)}
                                  size="sm"
                                  title="Reject"
                                  variant="outline"
                              >
                                <ShieldX className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                      ))
                  )}
                </CardContent>
              </Card>
          )}
        </div>

        {showApprovedEditDialog ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <Card className="w-full max-w-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-700">
                    <AlertTriangle className="h-5 w-5" /> Edit an approved timesheet?
                  </CardTitle>
                  <CardDescription>
                    This timesheet was already approved. Changing it may affect billing that has already been processed.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-end gap-3">
                  <Button onClick={() => setShowApprovedEditDialog(false)} variant="outline">
                    Cancel
                  </Button>
                  <Button onClick={unlockApprovedEdit}>Yes, allow editing</Button>
                </CardContent>
              </Card>
            </div>
        ) : null}

        {approvalActionType && selectedApproval ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <Card className="w-full max-w-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {approvalActionType === "APPROVE" ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : (
                        <ShieldX className="h-5 w-5 text-rose-600" />
                    )}
                    {approvalActionType === "APPROVE" ? "Approve timesheet" : "Reject timesheet"}
                  </CardTitle>
                  <CardDescription>
                    {selectedApproval.employeeFullName} · {formatWeekRange(selectedApproval.weekStartDate, selectedApproval.weekEndDate)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <MentionTextareaField
                      label="Comment (optional)"
                      mentionSearch={(query) => (accessToken ? searchUserMentions(accessToken, query) : Promise.resolve([]))}
                      onChange={setApprovalComment}
                      placeholder="Add a note for the employee…"
                      value={approvalComment}
                  />
                  <div className="flex justify-end gap-3">
                    <Button onClick={closeApprovalDialog} variant="outline">
                      Cancel
                    </Button>
                    <Button disabled={isActioning} onClick={() => void submitApprovalAction()}>
                      {isActioning ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                          <MessageSquareQuote className="mr-2 h-4 w-4" />
                      )}
                      Confirm {approvalActionType === "APPROVE" ? "approval" : "rejection"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
        ) : null}
      </>
  );
}
