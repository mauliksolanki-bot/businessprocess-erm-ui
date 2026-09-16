"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, MessageSquareQuote, Send, ShieldX } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FixedInputField, FloatingTextareaField, LabeledSelectField } from "@/components/ui/form-fields";
import { MentionTextareaField } from "@/components/ui/mention-textarea-field";
import { Spinner } from "@/components/ui/spinner";
import {
  ApiError,
  applyLeave,
  getEnabledLeavePolicies,
  getLeaveApproverVisibility,
  getLeaveApprovalRequests,
  getMyLeaveRequests,
  searchUserMentions,
  takeLeaveAction,
  type LeavePolicy,
  type LeaveRequest,
} from "@/lib/api";
import { loadSession } from "@/lib/auth-storage";

type LeaveForm = {
  leaveCategory: string;
  startDate: string;
  endDate: string;
  reason: string;
};

const initialForm: LeaveForm = {
  leaveCategory: "",
  startDate: "",
  endDate: "",
  reason: "",
};

function statusClass(status: string) {
  const value = status.toLowerCase();
  if (value === "approved") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (value === "rejected") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

export default function LeavesPage() {
  const [activeTab, setActiveTab] = useState<"apply" | "my" | "approvals">("apply");
  const [form, setForm] = useState<LeaveForm>(initialForm);
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<LeaveRequest[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<LeaveRequest | null>(null);
  const [actionType, setActionType] = useState<"APPROVE" | "REJECT">("APPROVE");
  const [actionComment, setActionComment] = useState("");
  const [actioning, setActioning] = useState(false);
  const [showApproverRequests, setShowApproverRequests] = useState(false);

  const accessToken = useMemo(() => loadSession()?.accessToken ?? null, []);
  const mentionSearch = useCallback(
      async (query: string) => {
        if (!accessToken) return [];
        return searchUserMentions(accessToken, query);
      },
      [accessToken]
  );

  const loadData = useCallback(async () => {
    if (!accessToken) {
      toast.error("Session not found. Please login again.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [policyData, requestData, approvalsData] = await Promise.all([
        getEnabledLeavePolicies(accessToken),
        getMyLeaveRequests(accessToken),
        getLeaveApprovalRequests(accessToken),
      ]);
      setPolicies(policyData);
      setMyRequests(requestData);
      setApprovalRequests(approvalsData);
      const visibility = await getLeaveApproverVisibility(accessToken);
      setShowApproverRequests(visibility.showApproverRequests);
      if (!form.leaveCategory && policyData.length > 0) {
        setForm((prev) => ({ ...prev, leaveCategory: policyData[0].leaveCategory }));
      }
    } catch {
      toast.error("Unable to load leave details.");
    } finally {
      setHasLoaded(true);
      setLoading(false);
    }
  }, [accessToken, form.leaveCategory]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!showApproverRequests && activeTab === "approvals") {
      setActiveTab("apply");
    }
  }, [activeTab, showApproverRequests]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) {
      toast.error("Session not found. Please login again.");
      return;
    }
    if (!form.leaveCategory || !form.startDate || !form.endDate || !form.reason.trim()) {
      toast.error("Please complete all leave request fields.");
      return;
    }
    setSubmitting(true);
    try {
      await applyLeave(accessToken, {
        leaveCategory: form.leaveCategory,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason.trim(),
      });
      toast.success("Leave request submitted to your manager.");
      setForm((prev) => ({ ...initialForm, leaveCategory: prev.leaveCategory }));
      await loadData();
      setActiveTab("my");
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message || `Unable to apply leave (${error.status})`);
      } else {
        toast.error("Unable to apply leave.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function submitApprovalAction() {
    if (!selectedApproval) return;
    if (!actionComment.trim()) {
      toast.error("Comment is required to approve/reject.");
      return;
    }
    if (!accessToken) {
      toast.error("Session not found. Please login again.");
      return;
    }
    setActioning(true);
    try {
      await takeLeaveAction(accessToken, selectedApproval.id, {
        decision: actionType,
        comment: actionComment.trim(),
      });
      toast.success(`Leave request ${actionType === "APPROVE" ? "approved" : "rejected"} successfully.`);
      setSelectedApproval(null);
      setActionComment("");
      await loadData();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message || `Unable to submit action (${error.status})`);
      } else {
        toast.error("Unable to submit action.");
      }
    } finally {
      setActioning(false);
    }
  }

  return (
      <>
        <div className="mb-5 flex flex-wrap gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm">
          <Button
              className={activeTab === "apply" ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500" : ""}
              onClick={() => setActiveTab("apply")}
              variant={activeTab === "apply" ? "default" : "ghost"}
          >
            Apply Leave
          </Button>
          <Button
              className={activeTab === "my" ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-500 hover:to-blue-500" : ""}
              onClick={() => setActiveTab("my")}
              variant={activeTab === "my" ? "default" : "ghost"}
          >
            My Requests
          </Button>
          {showApproverRequests ? (
              <Button
                  className={activeTab === "approvals" ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500" : ""}
                  onClick={() => setActiveTab("approvals")}
                  variant={activeTab === "approvals" ? "default" : "ghost"}
              >
                Approver Requests
              </Button>
          ) : null}
        </div>

        {activeTab === "apply" ? (
            <Card className="border-blue-100 shadow-md shadow-blue-100/40">
              <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                <CardTitle className="text-white">Apply Leave</CardTitle>
                <CardDescription className="text-blue-100">Request leave under Sick, Casual, or Earned category.</CardDescription>
              </CardHeader>
              <CardContent className="pt-5">
                {!hasLoaded || loading ? (
                    <div className="flex justify-center py-10">
                      <Spinner />
                    </div>
                ) : policies.length === 0 ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                      No leave policy is enabled currently. Contact HR Head.
                    </div>
                ) : (
                    <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
                      <LabeledSelectField
                          disabled={submitting}
                          label="Leave Category"
                          onChange={(event) => setForm((value) => ({ ...value, leaveCategory: event.target.value }))}
                          value={form.leaveCategory}
                      >
                        {policies.map((policy) => (
                            <option key={policy.id} value={policy.leaveCategory}>
                              {policy.displayName} (Max {policy.maxDaysPerYear}/year)
                            </option>
                        ))}
                      </LabeledSelectField>
                      <div />
                      <FixedInputField
                          disabled={submitting}
                          label="Start Date"
                          onChange={(event) => setForm((value) => ({ ...value, startDate: event.target.value }))}
                          type="date"
                          value={form.startDate}
                      />
                      <FixedInputField
                          disabled={submitting}
                          label="End Date"
                          onChange={(event) => setForm((value) => ({ ...value, endDate: event.target.value }))}
                          type="date"
                          value={form.endDate}
                      />
                      <FloatingTextareaField
                          className="min-h-28"
                          disabled={submitting}
                          label="Reason"
                          maxLength={500}
                          onChange={(event) => setForm((value) => ({ ...value, reason: event.target.value }))}
                          value={form.reason}
                          wrapperClassName="md:col-span-2"
                      />
                      <div className="md:col-span-2 flex justify-end">
                        <Button className="min-w-40 gap-2" disabled={submitting} type="submit">
                          <Send className="h-4 w-4" />
                          {submitting ? "Submitting..." : "Submit Leave Request"}
                        </Button>
                      </div>
                    </form>
                )}
              </CardContent>
            </Card>
        ) : null}

        {activeTab === "my" ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>My Leave Requests</CardTitle>
                  <CardDescription>Track your leave request status and manager comments.</CardDescription>
                </div>
                <Button onClick={() => void loadData()} type="button" variant="outline">
                  Refresh
                </Button>
              </CardHeader>
              <CardContent>
                {!hasLoaded || loading ? (
                    <div className="flex justify-center py-10">
                      <Spinner />
                    </div>
                ) : myRequests.length === 0 ? (
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">No leave requests submitted yet.</div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-zinc-200">
                      <table className="w-full min-w-[1040px] text-sm">
                        <thead className="bg-gradient-to-r from-cyan-50 to-blue-50 text-left">
                        <tr>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3">Start</th>
                          <th className="px-4 py-3">End</th>
                          <th className="px-4 py-3">Days</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Manager</th>
                          <th className="px-4 py-3">Manager Comment</th>
                          <th className="px-4 py-3">Reason</th>
                        </tr>
                        </thead>
                        <tbody>
                        {myRequests.map((request) => (
                            <tr className="border-t border-zinc-200 hover:bg-zinc-50" key={request.id}>
                              <td className="px-4 py-3 font-medium">{request.leaveCategory}</td>
                              <td className="px-4 py-3">{request.startDate}</td>
                              <td className="px-4 py-3">{request.endDate}</td>
                              <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {request.requestedDays}
                          </span>
                              </td>
                              <td className="px-4 py-3">
                          <span className={`rounded-full border px-2 py-1 text-xs font-medium ${statusClass(request.requestStatus)}`}>
                            {request.requestStatus}
                          </span>
                              </td>
                              <td className="px-4 py-3 text-zinc-700">{request.approverManagerFullName ?? "-"}</td>
                              <td className="px-4 py-3 text-zinc-700">{request.approverComment ?? "-"}</td>
                              <td className="px-4 py-3 text-zinc-700">{request.reason}</td>
                            </tr>
                        ))}
                        </tbody>
                      </table>
                    </div>
                )}
              </CardContent>
            </Card>
        ) : null}

        {showApproverRequests && activeTab === "approvals" ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Approver Requests</CardTitle>
                  <CardDescription>All leave requests routed to you with action controls.</CardDescription>
                </div>
                <Button onClick={() => void loadData()} type="button" variant="outline">
                  Refresh
                </Button>
              </CardHeader>
              <CardContent>
                {!hasLoaded || loading ? (
                    <div className="flex justify-center py-10">
                      <Spinner />
                    </div>
                ) : approvalRequests.length === 0 ? (
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">No requests assigned to you.</div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-zinc-200">
                      <table className="w-full min-w-[1280px] text-sm">
                        <thead className="bg-gradient-to-r from-emerald-50 to-teal-50 text-left">
                        <tr>
                          <th className="px-4 py-3">Employee</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3">Start</th>
                          <th className="px-4 py-3">End</th>
                          <th className="px-4 py-3">Days</th>
                          <th className="px-4 py-3">Reason</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Comment</th>
                          <th className="px-4 py-3">Actions</th>
                        </tr>
                        </thead>
                        <tbody>
                        {approvalRequests.map((request) => (
                            <tr className="border-t border-zinc-200 hover:bg-zinc-50" key={request.id}>
                              <td className="px-4 py-3">
                                <p className="font-semibold text-zinc-900">{request.employeeFullName}</p>
                                <p className="text-xs text-zinc-500">{request.employeeUsername}</p>
                              </td>
                              <td className="px-4 py-3">{request.leaveCategory}</td>
                              <td className="px-4 py-3">{request.startDate}</td>
                              <td className="px-4 py-3">{request.endDate}</td>
                              <td className="px-4 py-3">{request.requestedDays}</td>
                              <td className="px-4 py-3 text-zinc-700">{request.reason}</td>
                              <td className="px-4 py-3">
                          <span className={`rounded-full border px-2 py-1 text-xs font-medium ${statusClass(request.requestStatus)}`}>
                            {request.requestStatus}
                          </span>
                              </td>
                              <td className="px-4 py-3 text-zinc-700">{request.approverComment ?? "-"}</td>
                              <td className="px-4 py-3">
                                {request.requestStatus === "PENDING" ? (
                                    <div className="flex items-center gap-2">
                                      <Button
                                          className="h-9 rounded-full bg-emerald-600 px-3 text-white hover:bg-emerald-500"
                                          onClick={() => {
                                            setSelectedApproval(request);
                                            setActionType("APPROVE");
                                            setActionComment("");
                                          }}
                                          size="sm"
                                          title="Approve"
                                      >
                                        <CheckCircle2 className="h-4 w-4" />
                                      </Button>
                                      <Button
                                          className="h-9 rounded-full border-rose-200 bg-rose-50 px-3 text-rose-700 hover:bg-rose-100"
                                          onClick={() => {
                                            setSelectedApproval(request);
                                            setActionType("REJECT");
                                            setActionComment("");
                                          }}
                                          size="sm"
                                          title="Reject"
                                          variant="outline"
                                      >
                                        <ShieldX className="h-4 w-4" />
                                      </Button>
                                    </div>
                                ) : (
                                    <span className="text-xs text-zinc-500">Closed</span>
                                )}
                              </td>
                            </tr>
                        ))}
                        </tbody>
                      </table>
                    </div>
                )}
              </CardContent>
            </Card>
        ) : null}

        {selectedApproval ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
              <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
                <h3 className="text-lg font-semibold text-zinc-900">
                  {actionType === "APPROVE" ? "Approve Leave Request" : "Reject Leave Request"} #{selectedApproval.id}
                </h3>
                <p className="mt-2 text-sm text-zinc-600">
                  Employee: <span className="font-medium">{selectedApproval.employeeFullName}</span> ({selectedApproval.employeeUsername})
                </p>
                <p className="mt-1 text-sm text-zinc-600">
                  Category: <span className="font-medium">{selectedApproval.leaveCategory}</span>, Dates:{" "}
                  <span className="font-medium">
                {selectedApproval.startDate} to {selectedApproval.endDate}
              </span>
                </p>
                <MentionTextareaField
                    className="mt-4 min-h-24"
                    label="Mandatory Comment"
                    mentionSearch={mentionSearch}
                    maxLength={500}
                    onChange={setActionComment}
                    value={actionComment}
                />
                <div className="mt-4 flex justify-end gap-2">
                  <Button onClick={() => setSelectedApproval(null)} variant="outline">
                    Cancel
                  </Button>
                  <Button className="gap-2" disabled={actioning} onClick={() => void submitApprovalAction()}>
                    <MessageSquareQuote className="h-4 w-4" />
                    {actioning ? "Submitting..." : "Submit Action"}
                  </Button>
                </div>
              </div>
            </div>
        ) : null}
      </>
  );
}
