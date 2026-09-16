"use client";

import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Bell, CheckCircle2, CornerUpLeft, Eye, Loader2, MessageSquareQuote, PencilLine, RefreshCcw, Send, ShieldX } from "lucide-react";
import { toast } from "sonner";

import { CommentsConversationModal } from "@/components/erm/comments-conversation-modal";
import { DataTablePagination } from "@/components/erm/data-table-pagination";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MentionTextareaField } from "@/components/ui/mention-textarea-field";
import {
  ApiError,
  addOnboardingRequestComment,
  createOnboardingRequest,
  getOnboardingDesignationOptions,
  getOnboardingManagerOptions,
  getOnboardingRequests,
  reInitiateOnboardingRequest,
  resubmitOnboardingRequest,
  sendOnboardingReminder,
  searchUserMentions,
  takeOnboardingAction,
  type OnboardingDesignationOption,
  type OnboardingManagerOption,
  type OnboardingRequest,
} from "@/lib/api";
import { loadSession } from "@/lib/auth-storage";

type RequestForm = {
  firstName: string;
  lastName: string;
  aadhaarCardNumber: string;
  panCardNumber: string;
  personalEmailAddress: string;
  permanentAddress: string;
  phoneNumber: string;
  designationRoleName: string;
  reportingManagerUserId: string;
  educationQualification: string;
  comment: string;
};

type TrackerStatusFilter = "all" | "pending" | "closed";

const initialForm: RequestForm = {
  firstName: "",
  lastName: "",
  aadhaarCardNumber: "",
  panCardNumber: "",
  personalEmailAddress: "",
  permanentAddress: "",
  phoneNumber: "",
  designationRoleName: "",
  reportingManagerUserId: "",
  educationQualification: "",
  comment: "",
};

function stageClass(stage: string) {
  const value = stage.toLowerCase();
  if (value.includes("approved")) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (value.includes("refer back")) {
    return "bg-violet-50 text-violet-700 border-violet-200";
  }
  if (value.includes("rejected")) {
    return "bg-rose-50 text-rose-700 border-rose-200";
  }
  return "bg-amber-50 text-amber-700 border-amber-200";
}

function pendingWith(request: OnboardingRequest) {
  if (request.workflowStage === "HR Submitted") {
    return "Head HR";
  }
  if (request.workflowStage === "Head HR Approved") {
    return "CHRO";
  }
  if (request.workflowStage === "CHRO Approved") {
    return "Super Admin";
  }
  if (request.workflowStage === "Refer Back") {
    return "Requester";
  }
  if (request.workflowStage === "Rejected") {
    return "Closed (Rejected)";
  }
  return "Completed";
}

function pendingWithClass(value: string) {
  if (value.includes("Closed")) {
    return "bg-rose-50 text-rose-700 border-rose-200";
  }
  if (value === "Completed") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  return "bg-violet-50 text-violet-700 border-violet-200";
}

function validateRequestForm(form: RequestForm) {
  if (!form.firstName.trim()) {
    return "First name is required.";
  }
  if (!form.lastName.trim()) {
    return "Last name is required.";
  }
  if (!/^\d{12}$/.test(form.aadhaarCardNumber.trim())) {
    return "Aadhaar number must be exactly 12 digits.";
  }
  if (!/^[A-Za-z]{5}\d{4}[A-Za-z]{1}$/.test(form.panCardNumber.trim())) {
    return "PAN number format should be like ABCDE1234F.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.personalEmailAddress.trim())) {
    return "Please enter a valid personal email address.";
  }
  if (!form.permanentAddress.trim()) {
    return "Permanent address is required.";
  }
  if (!/^\d{10}$/.test(form.phoneNumber.trim())) {
    return "Phone number must be exactly 10 digits.";
  }
  if (!form.designationRoleName.trim()) {
    return "Designation is required.";
  }
  if (!form.reportingManagerUserId.trim()) {
    return "Reporting manager is required.";
  }
  if (form.comment.trim().length > 500) {
    return "Comment cannot be more than 500 characters.";
  }
  return null;
}

export default function OnboardingPage() {
  const [activeTab, setActiveTab] = useState<"raise" | "tracker">(() => {
    const roleNames = (loadSession()?.roles ?? []).map((role) => role.toLowerCase());
    return roleNames.includes("senior hr") || roleNames.includes("hr") ? "raise" : "tracker";
  });
  const [form, setForm] = useState<RequestForm>(initialForm);
  const [requests, setRequests] = useState<OnboardingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<OnboardingRequest | null>(null);
  const [viewRequest, setViewRequest] = useState<OnboardingRequest | null>(null);
  const [commentsRequest, setCommentsRequest] = useState<OnboardingRequest | null>(null);
  const [actionType, setActionType] = useState<"APPROVE" | "REJECT" | "REFER_BACK">("APPROVE");
  const [actionComment, setActionComment] = useState("");
  const [isActioning, setIsActioning] = useState(false);
  const [isCommenting, setIsCommenting] = useState(false);
  const [isReInitiating, setIsReInitiating] = useState<number | null>(null);
  const [isSendingReminder, setIsSendingReminder] = useState<number | null>(null);
  const [editingRequestId, setEditingRequestId] = useState<number | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [designationOptions, setDesignationOptions] = useState<OnboardingDesignationOption[]>([]);
  const [managerOptions, setManagerOptions] = useState<OnboardingManagerOption[]>([]);
  const [requiredManagerRole, setRequiredManagerRole] = useState("");
  const [loadingManagers, setLoadingManagers] = useState(false);
  const [trackerStatusFilter, setTrackerStatusFilter] = useState<TrackerStatusFilter>("all");

  const session = useMemo(() => {
    return loadSession();
  }, []);

  const userRoles = useMemo(() => {
    return session?.roles ?? [];
  }, [session]);

  const username = useMemo(() => {
    return session?.username?.toLowerCase() ?? "";
  }, [session]);

  const roleNames = userRoles.map((role) => role.toLowerCase());
  const hasRole = (roleName: string) => roleNames.includes(roleName);
  const canCreate = hasRole("senior hr") || hasRole("hr");
  const isJuniorHr = hasRole("junior hr") && !canCreate;
  const canHeadHrApprove = hasRole("hr head");
  const canChroApprove = hasRole("chro");
  const canSuperAdminApprove = hasRole("super admin");
  const requestSummary = useMemo(() => {
    const pendingCount = requests.filter((request) => !["Super Admin Approved", "Rejected", "Cancelled"].includes(request.workflowStage)).length;
    const closedCount = requests.filter((request) => ["Rejected", "Cancelled"].includes(request.workflowStage)).length;
    return { pendingCount, closedCount };
  }, [requests]);

  const mentionSearch = useCallback(
      async (query: string) => {
        const token = session?.accessToken ?? null;
        if (!token) return [];
        return searchUserMentions(token, query);
      },
      [session?.accessToken]
  );

  const filteredRequests = useMemo(() => {
    if (trackerStatusFilter === "all") {
      return requests;
    }
    if (trackerStatusFilter === "pending") {
      return requests.filter((request) => !["Super Admin Approved", "Rejected", "Cancelled"].includes(request.workflowStage));
    }
    return requests.filter((request) => ["Rejected", "Cancelled"].includes(request.workflowStage));
  }, [requests, trackerStatusFilter]);

  const headerTitle = activeTab === "raise" ? (editingRequestId ? "Update request" : "Create On-Boarding Request") : "Track On-Boarding Request";
  const headerDescription =
      activeTab === "raise"
          ? editingRequestId
              ? "Update the details and resubmit this on-boarding request."
              : "Fill candidate details to create a new on-boarding request."
          : "Track request status, take actions, and review request details.";

  useEffect(() => {
    if (!canCreate && activeTab === "raise") {
      setActiveTab("tracker");
    }
  }, [activeTab, canCreate]);

  const accessToken = useCallback(() => {
    const session = loadSession();
    if (!session?.accessToken) {
      toast.error("Session not found. Please login again.");
      return null;
    }
    return session.accessToken;
  }, []);

  const loadRequests = useCallback(async (nextPage = page, nextSize = pageSize) => {
    const token = accessToken();
    if (!token) {
      return;
    }
    setIsLoading(true);
    try {
      const result = await getOnboardingRequests(token, undefined, nextPage, nextSize);
      setRequests(result.content);
      setTotalElements(result.totalElements);
      setTotalPages(result.totalPages);
      setPage(result.page);
      setPageSize(result.size);
      setHasLoaded(true);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        toast.error("You are not authorized to view onboarding requests.");
      } else {
        toast.error("Unable to load onboarding requests.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, page, pageSize]);

  const loadDesignationOptions = useCallback(async () => {
    const token = accessToken();
    if (!token) {
      return;
    }
    try {
      const options = await getOnboardingDesignationOptions(token);
      setDesignationOptions(options);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        toast.error("You are not authorized to fetch designation options.");
      } else {
        toast.error("Unable to load designation options.");
      }
    }
  }, [accessToken]);

  const loadManagerOptions = useCallback(
      async (designationRoleName: string) => {
        if (!designationRoleName) {
          setManagerOptions([]);
          setRequiredManagerRole("");
          return;
        }
        const token = accessToken();
        if (!token) {
          return;
        }

        setLoadingManagers(true);
        try {
          const response = await getOnboardingManagerOptions(token, designationRoleName);
          setRequiredManagerRole(response.managerRoleName);
          setManagerOptions(response.managers);
        } catch (error) {
          setRequiredManagerRole("");
          setManagerOptions([]);
          if (error instanceof ApiError && error.status === 400) {
            toast.error("Invalid designation selected for hierarchy.");
          } else {
            toast.error("Unable to load reporting managers.");
          }
        } finally {
          setLoadingManagers(false);
        }
      },
      [accessToken]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = accessToken();
    if (!token) {
      return;
    }

    const validationMessage = validateRequestForm(form);
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }

    const payload = {
      ...form,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      aadhaarCardNumber: form.aadhaarCardNumber.trim(),
      panCardNumber: form.panCardNumber.trim().toUpperCase(),
      personalEmailAddress: form.personalEmailAddress.trim().toLowerCase(),
      permanentAddress: form.permanentAddress.trim(),
      phoneNumber: form.phoneNumber.trim(),
      designationRoleName: form.designationRoleName.trim(),
      reportingManagerUserId: Number(form.reportingManagerUserId),
      educationQualification: form.educationQualification.trim(),
      comment: form.comment.trim(),
    };

    setIsSubmitting(true);
    try {
      const requestPayload = {
        ...payload,
        designationRoleName: payload.designationRoleName,
        reportingManagerUserId: payload.reportingManagerUserId,
        educationQualification: payload.educationQualification || undefined,
        comment: payload.comment || undefined,
      };

      if (editingRequestId) {
        await resubmitOnboardingRequest(token, editingRequestId, requestPayload);
        toast.success("On-boarding request resubmitted.");
        cancelEditRequest();
      } else {
        await createOnboardingRequest(token, requestPayload);
        toast.success("On-boarding request created.");
        setForm(initialForm);
      }
      await loadRequests(page, pageSize);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 400) {
          toast.error("Invalid details. Verify designation, reporting manager, Aadhaar, PAN, phone, and email.");
        } else if (error.status === 403) {
          toast.error(editingRequestId ? "You are not authorized to edit this request." : "You are not authorized to create on-boarding requests.");
        } else {
          toast.error(`Unable to submit request (${error.status}).`);
        }
      } else {
        toast.error("Unable to submit request.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function canAction(request: OnboardingRequest) {
    if (request.workflowStage === "HR Submitted") {
      return canHeadHrApprove;
    }
    if (request.workflowStage === "Head HR Approved") {
      return canChroApprove;
    }
    if (request.workflowStage === "CHRO Approved") {
      return canSuperAdminApprove;
    }
    return false;
  }

  function canReInitiate(request: OnboardingRequest) {
    return canCreate && request.workflowStage === "Rejected" && request.createdByUsername.toLowerCase() === username;
  }

  function canEditAfterReferBack(request: OnboardingRequest) {
    return canCreate && request.workflowStage === "Refer Back" && request.createdByUsername.toLowerCase() === username;
  }

  function canSendReminder(request: OnboardingRequest) {
    if (isJuniorHr) {
      return false;
    }
    if (request.workflowStage === "Super Admin Approved" || request.workflowStage === "Rejected" || request.workflowStage === "Refer Back") {
      return false;
    }
    if (request.createdByUsername.toLowerCase() !== username) {
      return false;
    }
    const createdMs = new Date(request.createdAt).getTime();
    const eightHoursMs = 8 * 60 * 60 * 1000;
    if (Date.now() - createdMs < eightHoursMs) {
      return false;
    }
    if (request.lastReminderAt) {
      const lastMs = new Date(request.lastReminderAt).getTime();
      const fourHoursMs = 4 * 60 * 60 * 1000;
      if (Date.now() - lastMs < fourHoursMs) {
        return false;
      }
    }
    return true;
  }

  async function handleSendReminder(requestId: number) {
    const token = accessToken();
    if (!token) {
      return;
    }
    setIsSendingReminder(requestId);
    try {
      await sendOnboardingReminder(token, requestId);
      toast.success("Reminder sent to the approver.");
      await loadRequests();
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 429) {
          toast.error("You can only send a reminder once every 4 hours.");
        } else if (error.status === 400) {
          toast.error("Reminder can only be sent after the request has been pending for 8 hours.");
        } else {
          toast.error(`Unable to send reminder (${error.status}).`);
        }
      } else {
        toast.error("Unable to send reminder.");
      }
    } finally {
      setIsSendingReminder(null);
    }
  }

  function toFormFromRequest(request: OnboardingRequest) {
    return {
      firstName: request.firstName,
      lastName: request.lastName,
      aadhaarCardNumber: request.aadhaarCardNumber,
      panCardNumber: request.panCardNumber,
      personalEmailAddress: request.personalEmailAddress,
      permanentAddress: request.permanentAddress,
      phoneNumber: request.phoneNumber,
      designationRoleName: request.designationRoleName,
      reportingManagerUserId: String(request.reportingManagerUserId ?? ""),
      educationQualification: request.educationQualification ?? "",
      comment: request.referBackComment ?? request.approvalTrail.find((item) => item.step === "HR Submission")?.comment ?? "",
    };
  }

  async function startEditRequest(request: OnboardingRequest) {
    const token = accessToken();
    if (!token) {
      return;
    }
    setActiveTab("raise");
    setEditingRequestId(request.id);
    setForm(toFormFromRequest(request));
    await loadDesignationOptions();
    await loadManagerOptions(request.designationRoleName);
  }

  function cancelEditRequest() {
    setEditingRequestId(null);
    setForm(initialForm);
    setManagerOptions([]);
    setRequiredManagerRole("");
  }

  async function reInitiateRequest(requestId: number) {
    const token = accessToken();
    if (!token) {
      return;
    }

    setIsReInitiating(requestId);
    try {
      await reInitiateOnboardingRequest(token, requestId);
      toast.success("Request re-initiated and moved to Head HR approval.");
      await loadRequests();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(`Unable to re-initiate request (${error.status}).`);
      } else {
        toast.error("Unable to re-initiate request.");
      }
    } finally {
      setIsReInitiating(null);
    }
  }

  function formatDateTime(value: string) {
    return new Date(value).toLocaleString("en-IN");
  }

  async function submitAction() {
    if (!selectedRequest) {
      return;
    }
    const token = accessToken();
    if (!token) {
      return;
    }
    if (!actionComment.trim()) {
      toast.error("Approval comment is required.");
      return;
    }
    setIsActioning(true);
    try {
      await takeOnboardingAction(token, selectedRequest.id, {
        decision: actionType,
        comment: actionComment.trim(),
      });
      toast.success(
          actionType === "APPROVE"
              ? "Request approved successfully."
              : actionType === "REJECT"
                  ? "Request rejected successfully."
                  : "Request sent back for correction."
      );
      setSelectedRequest(null);
      setActionComment("");
      await loadRequests();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(`Action failed (${error.status}).`);
      } else {
        toast.error("Unable to complete action.");
      }
    } finally {
      setIsActioning(false);
    }
  }

  async function submitComment(comment: string) {
    if (!commentsRequest) {
      return;
    }
    const token = accessToken();
    if (!token) {
      return;
    }
    setIsCommenting(true);
    try {
      const updated = await addOnboardingRequestComment(token, commentsRequest.id, { comment });
      setCommentsRequest(updated);
      toast.success("Comment added successfully.");
    } catch {
      toast.error("Unable to add comment.");
    } finally {
      setIsCommenting(false);
    }
  }

  function onSummaryFilterClick(filter: TrackerStatusFilter) {
    setTrackerStatusFilter(filter);
    setActiveTab("tracker");
    if (!hasLoaded) {
      void loadRequests();
    }
  }

  return (
      <>
        <div className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm">
          {canCreate ? (
              <Button
                  className={activeTab === "raise" ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500" : ""}
                  onClick={() => {
                    setActiveTab("raise");
                    if (designationOptions.length === 0) {
                      void loadDesignationOptions();
                    }
                  }}
                  variant={activeTab === "raise" ? "default" : "ghost"}
              >
                Create On-Boarding Request
              </Button>
          ) : null}
          <Button
              className={activeTab === "tracker" ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-500 hover:to-violet-500" : ""}
              onClick={() => {
                setActiveTab("tracker");
                if (!hasLoaded) {
                  void loadRequests();
                }
              }}
              variant={activeTab === "tracker" ? "default" : "ghost"}
          >
            Track On-Boarding Request
          </Button>
        </div>

        <Card className="mb-6 overflow-hidden border-0 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-white shadow-xl shadow-violet-200/60">
          <CardContent className="flex min-h-[152px] flex-col justify-center gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">On-Boarding</p>
              <h1 className="mt-1 text-2xl font-semibold">{headerTitle}</h1>
              <p className="mt-1 text-sm text-white/80">{headerDescription}</p>
            </div>
            {activeTab === "tracker" ? (
                <div className="grid w-full gap-3 sm:grid-cols-3 md:max-w-[430px]">
                  <SummaryPill
                      label="Total requests"
                      value={hasLoaded ? requests.length : 0}
                      isActive={trackerStatusFilter === "all"}
                      onClick={() => onSummaryFilterClick("all")}
                  />
                  <SummaryPill
                      label="Pending"
                      value={hasLoaded ? requestSummary.pendingCount : 0}
                      isActive={trackerStatusFilter === "pending"}
                      onClick={() => onSummaryFilterClick("pending")}
                  />
                  <SummaryPill
                      label="Closed"
                      value={hasLoaded ? requestSummary.closedCount : 0}
                      isActive={trackerStatusFilter === "closed"}
                      onClick={() => onSummaryFilterClick("closed")}
                  />
                </div>
            ) : null}
          </CardContent>
        </Card>

        {activeTab === "raise" && canCreate ? (
            <Card className="overflow-hidden border-blue-100 shadow-md shadow-blue-100/40">
              <CardContent className="pt-6">
                <>
                  {editingRequestId ? (
                      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700">
                        <span>Editing refer-back request #{editingRequestId}. Make changes and resubmit.</span>
                        <Button className="h-8 rounded-full" onClick={cancelEditRequest} size="sm" type="button" variant="outline">
                          Cancel edit
                        </Button>
                      </div>
                  ) : null}
                  <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
                    <FloatingInput
                        label="First Name *"
                        value={form.firstName}
                        onChange={(value) => setForm((v) => ({ ...v, firstName: value }))}
                    />
                    <FloatingInput
                        label="Last Name *"
                        value={form.lastName}
                        onChange={(value) => setForm((v) => ({ ...v, lastName: value }))}
                    />
                    <FloatingInput
                        label="Aadhaar Number *"
                        value={form.aadhaarCardNumber}
                        onChange={(value) => setForm((v) => ({ ...v, aadhaarCardNumber: value }))}
                    />
                    <FloatingInput
                        label="PAN Number *"
                        value={form.panCardNumber}
                        onChange={(value) => setForm((v) => ({ ...v, panCardNumber: value }))}
                    />
                    <FloatingInput
                        className="md:col-span-2"
                        label="Personal Email Address *"
                        type="email"
                        value={form.personalEmailAddress}
                        onChange={(value) => setForm((v) => ({ ...v, personalEmailAddress: value }))}
                    />
                    <FloatingInput
                        className="md:col-span-2"
                        label="Permanent Address *"
                        value={form.permanentAddress}
                        onChange={(value) => setForm((v) => ({ ...v, permanentAddress: value }))}
                    />
                    <FloatingInput
                        label="Phone Number *"
                        value={form.phoneNumber}
                        onChange={(value) => setForm((v) => ({ ...v, phoneNumber: value }))}
                    />
                    <FloatingSelect
                        label="Designation *"
                        value={form.designationRoleName}
                        onChange={(value) => {
                          setForm((current) => ({
                            ...current,
                            designationRoleName: value,
                            reportingManagerUserId: "",
                          }));
                          void loadManagerOptions(value);
                        }}
                        onFocus={() => {
                          if (designationOptions.length === 0) {
                            void loadDesignationOptions();
                          }
                        }}
                    >
                      <option value="">Select designation</option>
                      {designationOptions.map((option) => (
                          <option key={option.designationRoleName} value={option.designationRoleName}>
                            {option.designationRoleName}
                          </option>
                      ))}
                    </FloatingSelect>
                    <FloatingSelect
                        className="md:col-span-2"
                        label={`Reporting Manager *${requiredManagerRole ? ` (${requiredManagerRole})` : ""}`}
                        value={form.reportingManagerUserId}
                        onChange={(value) => setForm((current) => ({ ...current, reportingManagerUserId: value }))}
                        disabled={!form.designationRoleName || loadingManagers}
                    >
                      <option value="">{loadingManagers ? "Loading managers..." : "Select reporting manager"}</option>
                      {managerOptions.map((manager) => (
                          <option key={manager.id} value={String(manager.id)}>
                            {manager.fullName} ({manager.username})
                          </option>
                      ))}
                    </FloatingSelect>
                    <FloatingInput
                        className="md:col-span-2"
                        label="Education Qualification"
                        value={form.educationQualification}
                        onChange={(value) => setForm((v) => ({ ...v, educationQualification: value }))}
                    />
                    <MentionTextareaField
                        className="md:col-span-2"
                        label="HR Comment"
                        mentionSearch={mentionSearch}
                        onChange={(value) => setForm((v) => ({ ...v, comment: value }))}
                        value={form.comment}
                    />
                    <div className="md:col-span-2 flex justify-end">
                      <Button className="mt-1 min-w-40 gap-2" disabled={isSubmitting} type="submit">
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        {isSubmitting ? "Submitting..." : editingRequestId ? "Resubmit Request" : "Submit Request"}
                      </Button>
                    </div>
                  </form>
                </>
              </CardContent>
            </Card>
        ) : (
            <Card className="mb-6 overflow-hidden shadow-md shadow-zinc-100/80">
              <CardContent className="pt-6">
                {!hasLoaded || isLoading ? (
                    <div className="flex justify-center py-10">
                      <Spinner size="md" />
                    </div>
                ) : filteredRequests.length === 0 ? (
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
                      {trackerStatusFilter === "all" ? "No requests available." : "No requests available for the selected status."}
                    </div>
                ) : (
                    <>
                      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
                        <table className="w-full min-w-[980px] text-sm">
                          <thead className="bg-gradient-to-r from-indigo-50 via-violet-50 to-cyan-50 text-left text-zinc-800">
                          <tr>
                            <th className="px-4 py-3 font-medium">Candidate</th>
                            <th className="px-4 py-3 font-medium">Requester</th>
                            <th className="px-4 py-3 font-medium">IDs</th>
                            <th className="px-4 py-3 font-medium">Stage</th>
                            <th className="px-4 py-3 font-medium">Pending With</th>
                            <th className="px-4 py-3 font-medium">Created</th>
                            <th className="px-4 py-3 font-medium">Actions</th>
                          </tr>
                          </thead>
                          <tbody>
                          {filteredRequests.map((request) => (
                              <tr className="border-t border-zinc-200 hover:bg-indigo-50/30" key={request.id}>
                                <td className="px-4 py-3">
                                  <p className="font-semibold text-zinc-900">
                                    {request.firstName} {request.lastName}
                                  </p>
                                  <p className="text-xs text-zinc-500">{request.personalEmailAddress}</p>
                                  <p className="text-xs text-indigo-700">Designation: {request.designationRoleName}</p>
                                </td>
                                <td className="px-4 py-3">
                                  <p className="font-medium text-zinc-800">{request.createdByUsername}</p>
                                  <p className="text-xs text-zinc-500">{request.phoneNumber}</p>
                                  <p className="text-xs text-zinc-600">
                                    Manager: {request.reportingManagerFullName ?? "-"} ({request.reportingManagerRoleName ?? "-"})
                                  </p>
                                </td>
                                <td className="px-4 py-3">
                                  <p className="text-xs text-zinc-700">Emp ID: {request.generatedEmployeeId ?? "-"}</p>
                                  <p className="text-xs text-zinc-700">Email: {request.generatedEmailAddress ?? "-"}</p>
                                </td>
                                <td className="px-4 py-3 align-top">
                          <span className={`inline-flex max-w-[180px] whitespace-normal break-words rounded-full border px-2.5 py-1 text-xs font-medium leading-tight ${stageClass(request.workflowStage)}`}>
                            {request.workflowStage}
                          </span>
                                </td>
                                <td className="px-4 py-3 align-top">
                          <span
                              className={`inline-flex max-w-[180px] whitespace-normal break-words rounded-full border px-2.5 py-1 text-xs font-medium leading-tight ${pendingWithClass(pendingWith(request))}`}
                          >
                            {pendingWith(request)}
                          </span>
                                </td>
                                <td className="px-4 py-3 text-xs text-zinc-600">{formatDateTime(request.createdAt)}</td>
                                <td className="px-4 py-3">
                                  <div className="flex gap-2">
                                    <Button
                                        aria-label={`View request details ${request.id}`}
                                        className="h-9 w-9 rounded-full border-zinc-200 bg-zinc-50 p-0 text-zinc-700 hover:bg-zinc-100"
                                        onClick={() => setViewRequest(request)}
                                        size="sm"
                                        title="View request details"
                                        variant="outline"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        aria-label={`View comments for request ${request.id}`}
                                        className="h-9 w-9 rounded-full border-blue-200 bg-blue-50 p-0 text-blue-700 hover:bg-blue-100"
                                        onClick={() => setCommentsRequest(request)}
                                        size="sm"
                                        title="View comments"
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
                                              className="h-9 rounded-full border-violet-200 bg-violet-50 px-3 text-violet-700 hover:bg-violet-100"
                                              onClick={() => {
                                                setActionType("REFER_BACK");
                                                setActionComment("");
                                                setSelectedRequest(request);
                                              }}
                                              size="sm"
                                              title="Refer back"
                                              variant="outline"
                                          >
                                            <CornerUpLeft className="h-4 w-4" />
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
                                    {canReInitiate(request) ? (
                                        <Button
                                            className="h-9 rounded-full border-amber-200 bg-amber-50 px-3 text-amber-700 hover:bg-amber-100"
                                            disabled={isReInitiating === request.id}
                                            onClick={() => void reInitiateRequest(request.id)}
                                            size="sm"
                                            title="Re-initiate"
                                            variant="outline"
                                        >
                                          {isReInitiating === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                                        </Button>
                                    ) : null}
                                    {canEditAfterReferBack(request) ? (
                                        <Button
                                            className="h-9 rounded-full border-indigo-200 bg-indigo-50 px-3 text-indigo-700 hover:bg-indigo-100"
                                            onClick={() => void startEditRequest(request)}
                                            size="sm"
                                            title="Edit"
                                            variant="outline"
                                        >
                                          <PencilLine className="h-4 w-4" />
                                        </Button>
                                    ) : null}
                                    {canSendReminder(request) ? (
                                        <Button
                                            aria-label={`Send reminder for request ${request.id}`}
                                            className="h-9 w-9 rounded-full border-violet-200 bg-violet-50 p-0 text-violet-700 hover:bg-violet-100"
                                            disabled={isSendingReminder === request.id}
                                            onClick={() => void handleSendReminder(request.id)}
                                            size="sm"
                                            title="Send reminder to approver"
                                            variant="outline"
                                        >
                                          {isSendingReminder === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                                        </Button>
                                    ) : null}
                                  </div>
                                </td>
                              </tr>
                          ))}
                          </tbody>
                        </table>
                      </div>
                      {hasLoaded && !isLoading && totalPages > 0 && (
                          <DataTablePagination
                              page={page}
                              size={pageSize}
                              totalElements={totalElements}
                              totalPages={totalPages}
                              onPageChange={(p) => {
                                setIsLoading(true);
                                void loadRequests(p, pageSize);
                              }}
                              onSizeChange={(s) => {
                                setIsLoading(true);
                                setPage(0);
                                void loadRequests(0, s);
                              }}
                          />
                      )}
                    </>
                )}
              </CardContent>
            </Card>
        )}

        {viewRequest ? (
            <div
                className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/45 backdrop-blur-sm"
                onClick={(event) => {
                  if (event.target === event.currentTarget) {
                    setViewRequest(null);
                  }
                }}
            >
              <div className="ml-auto flex h-full w-full max-w-4xl flex-col overflow-hidden border-l border-white/50 bg-white shadow-2xl shadow-slate-300/40">
                <div className="border-b border-zinc-200 bg-linear-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-6 py-5 text-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="flex items-center gap-2 text-xl font-semibold">
                        <Eye className="h-5 w-5" />
                        On-boarding Request Details #{viewRequest.id}
                      </h3>
                      <p className="mt-1 text-sm text-indigo-100">
                        {viewRequest.firstName} {viewRequest.lastName}
                      </p>
                    </div>
                    <Button className="border-white/30 bg-white/10 text-white hover:bg-white/20" onClick={() => setViewRequest(null)} variant="outline">
                      Close
                    </Button>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${stageClass(viewRequest.workflowStage)}`}>{viewRequest.workflowStage}</span>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${pendingWithClass(pendingWith(viewRequest))}`}>{pendingWith(viewRequest)}</span>
                  </div>
                </div>

                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Requester</p>
                      <p className="mt-1 font-medium text-zinc-900">{viewRequest.createdByUsername}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Designation</p>
                      <p className="mt-1 font-medium text-zinc-900">{viewRequest.designationRoleName}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Personal Email</p>
                      <p className="mt-1 font-medium text-zinc-900">{viewRequest.personalEmailAddress}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Phone Number</p>
                      <p className="mt-1 font-medium text-zinc-900">{viewRequest.phoneNumber}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Reporting Manager</p>
                      <p className="mt-1 font-medium text-zinc-900">
                        {viewRequest.reportingManagerFullName ?? "-"}
                        {viewRequest.reportingManagerRoleName ? ` (${viewRequest.reportingManagerRoleName})` : ""}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Education</p>
                      <p className="mt-1 font-medium text-zinc-900">{viewRequest.educationQualification?.trim() ? viewRequest.educationQualification : "-"}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Generated Employee ID</p>
                      <p className="mt-1 font-medium text-zinc-900">{viewRequest.generatedEmployeeId ?? "-"}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Generated Email</p>
                      <p className="mt-1 font-medium text-zinc-900">{viewRequest.generatedEmailAddress ?? "-"}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Created</p>
                      <p className="mt-1 font-medium text-zinc-900">{formatDateTime(viewRequest.createdAt)}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Updated</p>
                      <p className="mt-1 font-medium text-zinc-900">{formatDateTime(viewRequest.updatedAt)}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Permanent Address</p>
                    <p className="mt-1 font-medium text-zinc-900">{viewRequest.permanentAddress}</p>
                  </div>

                  {viewRequest.referBackComment ? (
                      <div className="rounded-2xl border border-violet-200 bg-violet-50 p-3 text-sm text-violet-800">
                        <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">Refer Back Comment</p>
                        <p className="mt-1">{viewRequest.referBackComment}</p>
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
                <div className="border-b border-zinc-200 bg-linear-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-6 py-5 text-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold text-white">
                        {actionType === "APPROVE" ? "Approve request" : actionType === "REJECT" ? "Reject request" : "Refer back request"} #{selectedRequest.id}
                      </h3>
                      <p className="mt-1 text-sm text-indigo-100">
                        Candidate: {selectedRequest.firstName} {selectedRequest.lastName}
                      </p>
                    </div>
                    <Button className="border-white/30 bg-white/10 text-white hover:bg-white/20" onClick={() => setSelectedRequest(null)} variant="outline">
                      Close
                    </Button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-6">
                  <MentionTextareaField
                      className="min-h-35"
                      label={actionType === "REFER_BACK" ? "Clarification / Change Comment *" : "Approval Comment *"}
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
                    {actionType === "APPROVE" ? "Approve" : actionType === "REJECT" ? "Reject" : "Refer Back"}
                  </Button>
                </div>
              </div>
            </div>
        ) : null}

        {commentsRequest ? (
            <CommentsConversationModal
                items={commentsRequest.approvalTrail}
                canSendComment={
                    !isJuniorHr &&
                    commentsRequest.workflowStage !== "Super Admin Approved" &&
                    commentsRequest.workflowStage !== "Rejected" &&
                    commentsRequest.workflowStage !== "Cancelled"
                }
                isSendingComment={isCommenting}
                mentionSearchAction={mentionSearch}
                onSendCommentAction={(comment) => submitComment(comment)}
                onCloseAction={() => setCommentsRequest(null)}
                subtitle={`Request #${commentsRequest.id}`}
                title={`Comments: ${commentsRequest.firstName} ${commentsRequest.lastName}`}
            />
        ) : null}
      </>
  );
}

function FloatingInput({
                         label,
                         value,
                         onChange,
                         type = "text",
                         className = "",
                       }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  className?: string;
}) {
  return (
      <div className={`relative ${className}`}>
        <input
            className="peer h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 pt-4 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder=" "
            type={type}
            value={value}
            onChange={(event) => onChange(event.target.value)}
        />
        <label className="pointer-events-none absolute left-3 -top-2 bg-white px-1 text-xs text-zinc-500 transition-all duration-150 peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-focus:-top-2 peer-focus:text-xs peer-focus:text-blue-600">
          {label}
        </label>
      </div>
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
          className={`w-full rounded-2xl px-3 py-2 text-left ring-1 transition ${
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

function FloatingSelect({
                          label,
                          value,
                          onChange,
                          className = "",
                          disabled = false,
                          onFocus,
                          children,
                        }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  onFocus?: () => void;
  children: ReactNode;
}) {
  return (
      <div className={`relative ${className}`}>
        <select
            className="peer h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 pt-4 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-zinc-100 disabled:text-zinc-500"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onFocus={onFocus}
            disabled={disabled}
        >
          {children}
        </select>
        <label className="pointer-events-none absolute left-3 -top-2 bg-white px-1 text-xs text-zinc-500">
          {label}
        </label>
      </div>
  );
}

function FloatingTextarea({
                            label,
                            value,
                            onChange,
                            className = "",
                          }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
      <div className={`relative ${className}`}>
      <textarea
          className="peer h-28 w-full rounded-xl border border-zinc-300 bg-white px-3 pt-5 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          placeholder=" "
          value={value}
          onChange={(event) => onChange(event.target.value)}
      />
        <label className="pointer-events-none absolute left-3 -top-2 bg-white px-1 text-xs text-zinc-500 transition-all duration-150 peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-focus:-top-2 peer-focus:text-xs peer-focus:text-blue-600">
          {label}
        </label>
      </div>
  );
}
