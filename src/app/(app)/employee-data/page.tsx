"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, CheckCircle2, Eye, Loader2, MessageSquareQuote, ShieldX, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { CommentsConversationModal } from "@/components/erm/comments-conversation-modal";
import { DataTablePagination } from "@/components/erm/data-table-pagination";
import { FloatingTextareaField } from "@/components/ui/form-fields";
import { MentionTextareaField } from "@/components/ui/mention-textarea-field";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  cancelEmployeeProfileUpdateRequest,
  addEmployeeProfileUpdateRequestComment,
  getEmployeeProfileUpdateRequests,
  searchUserMentions,
  takeEmployeeProfileUpdateRequestAction,
  type EmployeeProfileUpdateRequest,
} from "@/lib/api";
import { loadSession } from "@/lib/auth-storage";

type TrackerStatusFilter = "all" | "pending" | "closed";

function stageClass(stage: string) {
  const value = stage.toLowerCase();
  if (value.includes("cancelled")) return "bg-slate-100 text-slate-700 border-slate-200";
  if (value.includes("approved")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (value.includes("rejected")) return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

function pendingWith(stage: string) {
  if (stage === "HR Submitted") return "Pending with Head HR";
  if (stage === "Head HR Approved") return "Pending with CHRO";
  if (stage === "CHRO Approved") return "Pending with Super Admin";
  if (stage === "Cancelled") return "Closed by requester";
  if (stage === "Rejected") return "Closed as rejected";
  if (stage === "Super Admin Approved") return "Completed (approved)";
  return "No pending approver";
}

function buildRequestedChanges(request: EmployeeProfileUpdateRequest) {
  const changes: Array<{ label: string; before: string; after: string }> = [];
  const pushIfChanged = (label: string, before: string | null | undefined, after: string | null | undefined) => {
    const current = (before ?? "-").trim();
    const requested = (after ?? "-").trim();
    if (current !== requested) {
      changes.push({ label, before: current || "-", after: requested || "-" });
    }
  };

  pushIfChanged("Full Name", request.currentFullName, request.requestedFullName);
  pushIfChanged("Email", request.currentEmail, request.requestedEmail);
  pushIfChanged("Department", request.currentDepartment, request.requestedDepartment);
  pushIfChanged("Employment Status", request.currentEmploymentStatus, request.requestedEmploymentStatus);
  pushIfChanged("Designation", request.currentDesignationRoleName, request.requestedDesignationRoleName);
  pushIfChanged("Reporting Manager", request.currentReportingManagerName, request.requestedReportingManagerName);

  return changes;
}

export default function EmployeeDataPage() {
  const [requests, setRequests] = useState<EmployeeProfileUpdateRequest[]>([]);
  const [hasLoadedRequests, setHasLoadedRequests] = useState(false);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<EmployeeProfileUpdateRequest | null>(null);
  const [viewChangesRequest, setViewChangesRequest] = useState<EmployeeProfileUpdateRequest | null>(null);
  const [commentsRequest, setCommentsRequest] = useState<EmployeeProfileUpdateRequest | null>(null);
  const [actionType, setActionType] = useState<"APPROVE" | "REJECT" | "CANCEL">("APPROVE");
  const [actionComment, setActionComment] = useState("");
  const [isActioning, setIsActioning] = useState(false);
  const [isCommenting, setIsCommenting] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [trackerStatusFilter, setTrackerStatusFilter] = useState<TrackerStatusFilter>("all");

  const session = useMemo(() => loadSession(), []);
  const roleNames = useMemo(() => (session?.roles ?? []).map((role) => role.toLowerCase()), [session]);
  const canHeadHrApprove = roleNames.includes("hr head");
  const canChroApprove = roleNames.includes("chro");
  const canSuperAdminApprove = roleNames.includes("super admin");
  const username = (session?.username ?? "").toLowerCase();
  const requestSummary = useMemo(() => {
    const pendingCount = requests.filter((request) => !["Super Admin Approved", "Rejected", "Cancelled"].includes(request.workflowStage)).length;
    const closedCount = requests.filter((request) => ["Rejected", "Cancelled"].includes(request.workflowStage)).length;
    return { pendingCount, closedCount };
  }, [requests]);
  const filteredRequests = useMemo(() => {
    if (trackerStatusFilter === "all") {
      return requests;
    }
    if (trackerStatusFilter === "pending") {
      return requests.filter((request) => !["Super Admin Approved", "Rejected", "Cancelled"].includes(request.workflowStage));
    }
    return requests.filter((request) => ["Rejected", "Cancelled"].includes(request.workflowStage));
  }, [requests, trackerStatusFilter]);

  const accessToken = useCallback(() => {
    const latestSession = loadSession();
    if (!latestSession?.accessToken) {
      toast.error("Session not found. Please login again.");
      return null;
    }
    return latestSession.accessToken;
  }, []);

  const mentionSearch = useCallback(
      async (query: string) => {
        const token = accessToken();
        if (!token) return [];
        return searchUserMentions(token, query);
      },
      [accessToken]
  );

  const loadRequests = useCallback(async (nextPage = page, nextSize = pageSize) => {
    const token = accessToken();
    if (!token) return;
    setIsLoadingRequests(true);
    try {
      const result = await getEmployeeProfileUpdateRequests(token, undefined, nextPage, nextSize);
      setRequests(result.content);
      setTotalElements(result.totalElements);
      setTotalPages(result.totalPages);
      setPage(result.page);
      setPageSize(result.size);
      setHasLoadedRequests(true);
    } catch {
      toast.error("Unable to load employee profile update requests.");
    } finally {
      setIsLoadingRequests(false);
    }
  }, [accessToken, page, pageSize]);

  useEffect(() => {
    void loadRequests(0, pageSize);
  }, []);

  function canAction(request: { workflowStage: string }) {
    if (request.workflowStage === "HR Submitted") return canHeadHrApprove;
    if (request.workflowStage === "Head HR Approved") return canChroApprove;
    if (request.workflowStage === "CHRO Approved") return canSuperAdminApprove;
    return false;
  }

  function canCancel(request: EmployeeProfileUpdateRequest) {
    if (request.createdByUsername.toLowerCase() !== username) {
      return false;
    }
    return !["Super Admin Approved", "Rejected", "Cancelled"].includes(request.workflowStage);
  }

  async function submitAction() {
    if (!selectedRequest) return;
    const token = accessToken();
    if (!token) return;
    if (actionType !== "CANCEL" && !actionComment.trim()) {
      toast.error("Comment is required.");
      return;
    }
    setIsActioning(true);
    try {
      if (actionType === "CANCEL") {
        await cancelEmployeeProfileUpdateRequest(token, selectedRequest.id, {
          comment: actionComment.trim() || undefined,
        });
        toast.success("Request cancelled successfully.");
      } else {
        await takeEmployeeProfileUpdateRequestAction(token, selectedRequest.id, {
          decision: actionType,
          comment: actionComment.trim(),
        });
        toast.success(`Request ${actionType === "APPROVE" ? "approved" : "rejected"} successfully.`);
      }
      setSelectedRequest(null);
      setActionComment("");
      await loadRequests();
    } catch {
      toast.error("Unable to complete workflow action.");
    } finally {
      setIsActioning(false);
    }
  }

  async function submitComment(comment: string) {
    if (!commentsRequest) return;
    const token = accessToken();
    if (!token) return;
    setIsCommenting(true);
    try {
      const updated = await addEmployeeProfileUpdateRequestComment(token, commentsRequest.id, { comment });
      setCommentsRequest(updated);
      toast.success("Comment added successfully.");
    } catch {
      toast.error("Unable to add comment.");
    } finally {
      setIsCommenting(false);
    }
  }

  return (
      <>
        <Card className="mb-6 shadow-md shadow-zinc-100/80">
          <CardHeader className="flex flex-col gap-3 rounded-t-2xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 text-white sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-white">
                <Sparkles className="h-5 w-5" />
                Change Request (Employee Data)
              </CardTitle>
              <CardDescription className="text-indigo-100">Review and action profile change requests by workflow stage with the same onboarding-style experience.</CardDescription>
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-3 md:max-w-[540px]">
              <SummaryPill
                  label="Total requests"
                  value={hasLoadedRequests ? requests.length : 0}
                  isActive={trackerStatusFilter === "all"}
                  onClick={() => setTrackerStatusFilter("all")}
              />
              <SummaryPill
                  label="Pending"
                  value={hasLoadedRequests ? requestSummary.pendingCount : 0}
                  isActive={trackerStatusFilter === "pending"}
                  onClick={() => setTrackerStatusFilter("pending")}
              />
              <SummaryPill
                  label="Closed"
                  value={hasLoadedRequests ? requestSummary.closedCount : 0}
                  isActive={trackerStatusFilter === "closed"}
                  onClick={() => setTrackerStatusFilter("closed")}
              />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {!hasLoadedRequests ? (
                <div className="flex min-h-[18rem] items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50">
                  <Spinner size="lg" />
                </div>
            ) : isLoadingRequests ? (
                <div className="flex min-h-[18rem] items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50">
                  <Spinner size="lg" />
                </div>
            ) : filteredRequests.length === 0 ? (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">No requests available.</div>
            ) : (
                <>
                  <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
                    <table className="w-full min-w-[1100px] text-sm">
                      <thead className="bg-gradient-to-r from-indigo-50 via-violet-50 to-cyan-50 text-left text-zinc-800">
                      <tr>
                        <th className="px-4 py-3 font-medium">Employee</th>
                        <th className="px-4 py-3 font-medium">Requested Changes</th>
                        <th className="px-4 py-3 font-medium">Stage</th>
                        <th className="px-4 py-3 font-medium">Pending With / Outcome</th>
                        <th className="px-4 py-3 font-medium">Actions</th>
                      </tr>
                      </thead>
                      <tbody>
                      {filteredRequests.map((request) => {
                        const changes = buildRequestedChanges(request);
                        return (
                            <tr className="border-t border-zinc-200 hover:bg-indigo-50/30" key={request.id}>
                              <td className="px-4 py-3">
                                <p className="font-semibold text-zinc-900">{request.currentFullName}</p>
                                <p className="text-xs text-zinc-500">{request.employeeUsername}</p>
                                <p className="mt-1 text-xs text-zinc-400">Requested by {request.createdByUsername}</p>
                              </td>
                              <td className="px-4 py-3">
                                {changes.length === 0 ? (
                                    <span className="text-xs text-zinc-500">No field changes detected.</span>
                                ) : (
                                    <div className="space-y-1">
                                      <p className="text-xs font-semibold text-zinc-800">
                                        {changes.length} field{changes.length === 1 ? "" : "s"} updated
                                      </p>
                                      <p className="text-xs text-zinc-500">
                                        {changes
                                            .slice(0, 3)
                                            .map((change) => change.label)
                                            .join(" • ")}
                                        {changes.length > 3 ? ` +${changes.length - 3} more` : ""}
                                      </p>
                                    </div>
                                )}
                                {request.directReportsAffectedCount > 0 && request.replacementTeamLeadName ? (
                                    <div className="mt-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-medium text-violet-700">
                                      Includes direct reports reassignment
                                    </div>
                                ) : null}
                              </td>
                              <td className="px-4 py-3">
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${stageClass(request.workflowStage)}`}>
                              {request.workflowStage}
                            </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-zinc-700">{pendingWith(request.workflowStage)}</td>
                              <td className="px-4 py-3">
                                <div className="flex gap-2">
                                  <Button
                                      aria-label={`View requested changes for request ${request.id}`}
                                      className="h-9 w-9 rounded-full border-zinc-200 bg-zinc-50 p-0 text-zinc-700 hover:bg-zinc-100"
                                      onClick={() => setViewChangesRequest(request)}
                                      size="sm"
                                      title="View requested changes"
                                      variant="outline"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                      aria-label={`View comments for request ${request.id}`}
                                      className="h-9 w-9 rounded-full border-indigo-200 bg-indigo-50 p-0 text-indigo-700 hover:bg-indigo-100"
                                      onClick={() => setCommentsRequest(request)}
                                      size="sm"
                                      title="Comments"
                                      variant="outline"
                                  >
                                    <MessageSquareQuote className="h-4 w-4" />
                                  </Button>
                                  {canAction(request) ? (
                                      <>
                                        <Button
                                            className="h-9 rounded-full bg-emerald-600 px-3 text-white hover:bg-emerald-500"
                                            onClick={() => {
                                              setActionType("APPROVE");
                                              setActionComment("");
                                              setSelectedRequest(request);
                                            }}
                                            size="sm"
                                            title="Approve"
                                        >
                                          <CheckCircle2 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            className="h-9 rounded-full border-rose-200 bg-rose-50 px-3 text-rose-700 hover:bg-rose-100"
                                            onClick={() => {
                                              setActionType("REJECT");
                                              setActionComment("");
                                              setSelectedRequest(request);
                                            }}
                                            size="sm"
                                            title="Reject"
                                            variant="outline"
                                        >
                                          <ShieldX className="h-4 w-4" />
                                        </Button>
                                      </>
                                  ) : null}
                                  {canCancel(request) ? (
                                      <Button
                                          className="h-9 rounded-full border-slate-200 bg-slate-50 px-3 text-slate-700 hover:bg-slate-100"
                                          onClick={() => {
                                            setActionType("CANCEL");
                                            setActionComment("");
                                            setSelectedRequest(request);
                                          }}
                                          size="sm"
                                          title="Cancel"
                                          variant="outline"
                                      >
                                        <Ban className="h-4 w-4" />
                                      </Button>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                        );
                      })}
                      </tbody>
                    </table>
                  </div>
                  {hasLoadedRequests && !isLoadingRequests && totalPages > 0 && (
                      <DataTablePagination
                          page={page}
                          size={pageSize}
                          totalElements={totalElements}
                          totalPages={totalPages}
                          onPageChange={(p) => {
                            setIsLoadingRequests(true);
                            void loadRequests(p, pageSize);
                          }}
                          onSizeChange={(s) => {
                            setIsLoadingRequests(true);
                            setPage(0);
                            void loadRequests(0, s);
                          }}
                      />
                  )}
                </>
            )}
          </CardContent>
        </Card>

        {viewChangesRequest ? (
            <div
                className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/45 backdrop-blur-sm"
                onClick={(event) => {
                  if (event.target === event.currentTarget) {
                    setViewChangesRequest(null);
                  }
                }}
            >
              <div className="ml-auto flex h-full w-full max-w-4xl flex-col overflow-hidden border-l border-white/50 bg-white shadow-2xl shadow-slate-300/40">
                <div className="border-b border-zinc-200 bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 px-6 py-5 text-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="flex items-center gap-2 text-xl font-semibold">
                        <Eye className="h-5 w-5" />
                        Requested Change Details #{viewChangesRequest.id}
                      </h3>
                      <p className="mt-1 text-sm text-indigo-100">
                        {viewChangesRequest.currentFullName} ({viewChangesRequest.employeeUsername})
                      </p>
                    </div>
                    <Button className="border-white/30 bg-white/10 text-white hover:bg-white/20" onClick={() => setViewChangesRequest(null)} variant="outline">
                      Close
                    </Button>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${stageClass(viewChangesRequest.workflowStage)}`}>
                  {viewChangesRequest.workflowStage}
                </span>
                    <span className="rounded-full border border-white/30 px-2.5 py-1 text-xs font-medium text-white/90">
                  Pending With: {pendingWith(viewChangesRequest.workflowStage)}
                </span>
                  </div>
                </div>

                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
                  {buildRequestedChanges(viewChangesRequest).length === 0 ? (
                      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
                        No field changes detected for this request.
                      </div>
                  ) : (
                      <div className="space-y-3">
                        {buildRequestedChanges(viewChangesRequest).map((change) => (
                            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3" key={change.label}>
                              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{change.label}</p>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                                <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-700 line-through">{change.before}</span>
                                <span className="text-zinc-400">→</span>
                                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">{change.after}</span>
                              </div>
                            </div>
                        ))}
                      </div>
                  )}

                  {viewChangesRequest.directReportsAffectedCount > 0 && viewChangesRequest.replacementTeamLeadName ? (
                      <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Direct reports reassignment</p>
                        <p className="mt-1 text-sm text-violet-800">
                          {viewChangesRequest.directReportsAffectedCount} employee
                          {viewChangesRequest.directReportsAffectedCount === 1 ? "" : "s"} will move to{" "}
                          <span className="font-semibold">{viewChangesRequest.replacementTeamLeadName}</span> when this promotion is approved.
                        </p>
                      </div>
                  ) : null}
                </div>
              </div>
            </div>
        ) : null}

        {selectedRequest ? (
            <div
                className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/45 backdrop-blur-sm"
                onClick={(event) => {
                  if (event.target === event.currentTarget) {
                    setSelectedRequest(null);
                  }
                }}
            >
              <div className="ml-auto flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-white/50 bg-white shadow-2xl shadow-slate-300/40">
                <div className="border-b border-zinc-200 bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 px-6 py-5 text-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold text-white">
                        {actionType === "APPROVE"
                            ? "Approve request"
                            : actionType === "REJECT"
                                ? "Reject request"
                                : "Cancel request"} #{selectedRequest.id}
                      </h3>
                      <p className="mt-1 text-sm text-indigo-100">
                        {selectedRequest.currentFullName} ({selectedRequest.employeeUsername})
                      </p>
                    </div>
                    <Button className="border-white/30 bg-white/10 text-white hover:bg-white/20" onClick={() => setSelectedRequest(null)} variant="outline">
                      Close
                    </Button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-6">
                  <MentionTextareaField
                      className="min-h-[140px]"
                      label={actionType === "CANCEL" ? "Cancellation Comment" : "Approval Comment *"}
                      mentionSearch={mentionSearch}
                      onChange={setActionComment}
                      value={actionComment}
                  />
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-6 py-4">
                  <Button onClick={() => setSelectedRequest(null)} variant="outline">
                    Cancel
                  </Button>
                  <Button className="gap-2" disabled={isActioning} onClick={() => void submitAction()}>
                    {isActioning ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Submit
                  </Button>
                </div>
              </div>
            </div>
        ) : null}

        {commentsRequest ? (
            <CommentsConversationModal
                items={commentsRequest.approvalTrail}
                canSendComment={
                    commentsRequest.workflowStage !== "Super Admin Approved" &&
                    commentsRequest.workflowStage !== "Rejected" &&
                    commentsRequest.workflowStage !== "Cancelled"
                }
                isSendingComment={isCommenting}
                mentionSearchAction={mentionSearch}
                onSendCommentAction={(comment) => submitComment(comment)}
                onCloseAction={() => setCommentsRequest(null)}
                subtitle={`Request #${commentsRequest.id}`}
                title={`Comments: ${commentsRequest.currentFullName}`}
            />
        ) : null}
      </>
  );
}

function SummaryPill({
                       label,
                       value,
                       onClick,
                       isActive = false,
                     }: {
  label: string;
  value: number;
  onClick?: () => void;
  isActive?: boolean;
}) {
  return (
      <button
          className={`h-[68px] w-full rounded-2xl px-3 py-2 text-left ring-1 transition ${
              isActive ? "bg-white/25 ring-white/45" : "bg-white/15 ring-white/20 hover:bg-white/20"
          }`}
          onClick={onClick}
          type="button"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/65">{label}</p>
        <p className="mt-1 text-base font-semibold text-white">{value.toLocaleString()}</p>
      </button>
  );
}
