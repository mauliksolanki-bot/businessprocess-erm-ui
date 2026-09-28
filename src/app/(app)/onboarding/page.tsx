"use client";

import { type ChangeEvent, type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCircle2, CornerUpLeft, Download, Eye, FileSpreadsheet, Loader2, MessageSquareQuote, PencilLine, RefreshCcw, Send, ShieldX, Upload } from "lucide-react";
import { toast } from "sonner";

import { CommentsConversationModal } from "@/components/erm/comments-conversation-modal";
import { DataTablePagination } from "@/components/erm/data-table-pagination";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MentionTextareaField } from "@/components/ui/mention-textarea-field";
import {
  ApiError,
  addOnboardingRequestComment,
  createOnboardingRequest,
  getOnboardingDesignationOptions,
  getOnboardingBulkTemplateOptions,
  getJuniorHrOptions,
  getOnboardingManagerOptions,
  getOnboardingRequests,
  reInitiateOnboardingRequest,
  resubmitOnboardingRequest,
  sendOnboardingReminder,
  searchUserMentions,
  submitBulkOnboardingRequests,
  takeBulkOnboardingAction,
  takeOnboardingAction,
  validateBulkOnboardingRequests,
  ONBOARDING_CLOSED_STAGES,
  type OnboardingAdditionalApproverDesignation,
  type OnboardingBulkRow,
  type OnboardingBulkSubmitResponse,
  type OnboardingBulkValidationResponse,
  type OnboardingDesignationOption,
  type OnboardingManagerOption,
  type OnboardingRequest,
} from "@/lib/api";
import { loadSession } from "@/lib/auth-storage";

const ADDITIONAL_APPROVER_DESIGNATIONS: OnboardingAdditionalApproverDesignation[] = ["Super Admin", "CHRO", "CEO", "CTO"];
const MAX_BULK_ONBOARDING_ROWS = 10000;
const BULK_ONBOARDING_BATCH_SIZE = 100;

function additionalApproverRoleName(designation: OnboardingAdditionalApproverDesignation) {
  return designation.toLowerCase();
}

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
  juniorHrUserId: string;
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
  juniorHrUserId: "",
  educationQualification: "",
  comment: "",
};

const bulkOnboardingColumns = [
  { key: "firstName", header: "First Name *", width: 20 },
  { key: "lastName", header: "Last Name *", width: 20 },
  { key: "aadhaarCardNumber", header: "Aadhaar Card Number *", width: 24 },
  { key: "panCardNumber", header: "PAN *", width: 18 },
  { key: "personalEmailAddress", header: "Personal Email Address *", width: 30 },
  { key: "permanentAddress", header: "Permanent Address *", width: 38 },
  { key: "phoneNumber", header: "Phone Number *", width: 20 },
  { key: "designationRoleName", header: "Designation *", width: 30 },
  { key: "reportingManagerUsername", header: "Reporting Manager Username *", width: 32 },
  { key: "hrbpUsername", header: "HRBP Username *", width: 24 },
  { key: "educationQualification", header: "Education Qualification", width: 28 },
  { key: "comment", header: "HR Comment", width: 36 },
] as const;

type BulkSaveProgress = {
  totalRows: number;
  processedRows: number;
  currentBatch: number;
  totalBatches: number;
  createdRequestIds: number[];
  status: "saving" | "paused" | "complete";
  message?: string;
};

function readExcelCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value).trim();
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const cell = value as { text?: unknown; richText?: Array<{ text?: unknown }>; result?: unknown };
    if (typeof cell.text === "string") return cell.text.trim();
    if (Array.isArray(cell.richText)) return cell.richText.map((part) => String(part.text ?? "")).join("").trim();
    if (cell.result !== undefined && cell.result !== null) return String(cell.result).trim();
  }
  return "";
}

function findCrossBatchDuplicateErrors(rows: OnboardingBulkRow[], batchSize: number) {
  const fields = [
    { field: "Aadhaar Card Number", value: (row: OnboardingBulkRow) => row.aadhaarCardNumber },
    { field: "PAN", value: (row: OnboardingBulkRow) => row.panCardNumber },
    { field: "Personal Email Address", value: (row: OnboardingBulkRow) => row.personalEmailAddress },
  ];
  const errors: OnboardingBulkValidationResponse["errors"] = [];
  for (const { field, value } of fields) {
    const firstRowByValue = new Map<string, { rowNumber: number; batchIndex: number }>();
    rows.forEach((row, index) => {
      const normalized = value(row).trim().toLowerCase();
      if (!normalized) return;
      const batchIndex = Math.floor(index / batchSize);
      const previous = firstRowByValue.get(normalized);
      if (previous && previous.batchIndex !== batchIndex) {
        errors.push({
          rowNumber: row.rowNumber,
          field,
          message: "Duplicates the value in row " + previous.rowNumber + " of this file.",
        });
      }
      firstRowByValue.set(normalized, { rowNumber: row.rowNumber, batchIndex });
    });
  }
  return errors;
}

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
    return "Admin";
  }
  if (request.workflowStage === "Additional Approval Pending") {
    return request.additionalApproverDesignation ?? "Additional Approver";
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
  if (!form.juniorHrUserId.trim()) {
    return "HRBP is required.";
  }
  if (form.comment.trim().length > 500) {
    return "Comment cannot be more than 500 characters.";
  }
  return null;
}

export default function OnboardingPage() {
  const initialTabLoadStarted = useRef(false);
  const [activeTab, setActiveTab] = useState<"raise" | "tracker" | "bulk">(() => {
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
  const [additionalApproverChoice, setAdditionalApproverChoice] = useState<"" | "NONE" | OnboardingAdditionalApproverDesignation>("");
  const [isActioning, setIsActioning] = useState(false);
  const [selectedOnboardingIds, setSelectedOnboardingIds] = useState<Set<number>>(() => new Set());
  const [bulkActionType, setBulkActionType] = useState<"APPROVE" | "REJECT" | "REFER_BACK" | null>(null);
  const [bulkActionComment, setBulkActionComment] = useState("");
  const [bulkAdditionalApproverChoice, setBulkAdditionalApproverChoice] = useState<"" | "NONE" | OnboardingAdditionalApproverDesignation>("");
  const [isBulkActioning, setIsBulkActioning] = useState(false);
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
  const [juniorHrOptions, setJuniorHrOptions] = useState<OnboardingManagerOption[]>([]);
  const [loadingJuniorHrOptions, setLoadingJuniorHrOptions] = useState(false);
  const [requiredManagerRole, setRequiredManagerRole] = useState("");
  const [loadingManagers, setLoadingManagers] = useState(false);
  const [trackerStatusFilter, setTrackerStatusFilter] = useState<TrackerStatusFilter>("all");
  const [bulkFileName, setBulkFileName] = useState("");
  const [bulkRows, setBulkRows] = useState<OnboardingBulkRow[] | null>(null);
  const [bulkValidation, setBulkValidation] = useState<OnboardingBulkValidationResponse | null>(null);
  const [bulkSubmission, setBulkSubmission] = useState<OnboardingBulkSubmitResponse | null>(null);
  const [isReadingBulkFile, setIsReadingBulkFile] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [isValidatingBulk, setIsValidatingBulk] = useState(false);
  const [bulkValidationProgress, setBulkValidationProgress] = useState<{ completedRows: number; totalRows: number } | null>(null);
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);
  const [bulkSaveProgress, setBulkSaveProgress] = useState<BulkSaveProgress | null>(null);

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
  const isSeniorHr = hasRole("senior hr");
  const isJuniorHr = hasRole("junior hr") && !canCreate;
  const canHeadHrApprove = hasRole("hr head");
  const canAdminApprove = hasRole("admin");
  const myAdditionalApproverDesignations = ADDITIONAL_APPROVER_DESIGNATIONS.filter((designation) =>
      hasRole(additionalApproverRoleName(designation))
  );
  const requestSummary = useMemo(() => {
    const pendingCount = requests.filter((request) => !ONBOARDING_CLOSED_STAGES.includes(request.workflowStage)).length;
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
      return requests.filter((request) => !ONBOARDING_CLOSED_STAGES.includes(request.workflowStage));
    }
    return requests.filter((request) => ["Rejected", "Cancelled"].includes(request.workflowStage));
  }, [requests, trackerStatusFilter]);

  const headerTitle = activeTab === "raise"
      ? (editingRequestId ? "Update request" : "Create On-Boarding Request")
      : activeTab === "tracker" ? "Track On-Boarding Request" : "Bulk On-Boarding Requests";
  const headerDescription =
      activeTab === "raise"
          ? editingRequestId
              ? "Update the details and resubmit this on-boarding request."
              : "Fill candidate details to create a new on-boarding request."
          : activeTab === "tracker"
              ? "Track request status, take actions, and review request details."
              : "Download the current template, validate the completed workbook, and submit one request per row.";

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

  const loadJuniorHrOptions = useCallback(async (designationRoleName: string) => {
    const token = accessToken();
    if (!token || !designationRoleName) {
      setJuniorHrOptions([]);
      setLoadingJuniorHrOptions(false);
      return;
    }
    setLoadingJuniorHrOptions(true);
    try {
      setJuniorHrOptions(await getJuniorHrOptions(token, designationRoleName));
    } catch {
      setJuniorHrOptions([]);
      toast.error("Unable to load HRBP options.");
    } finally {
      setLoadingJuniorHrOptions(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (initialTabLoadStarted.current) return;
    initialTabLoadStarted.current = true;
    if (activeTab === "tracker") {
      void loadRequests();
    } else if (canCreate) {
      void loadDesignationOptions();
    }
  }, [activeTab, canCreate, loadDesignationOptions, loadRequests]);

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
      juniorHrUserId: Number(form.juniorHrUserId),
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
      return canAdminApprove;
    }
    if (request.workflowStage === "Additional Approval Pending") {
      return !!request.additionalApproverDesignation && myAdditionalApproverDesignations.includes(request.additionalApproverDesignation);
    }
    return false;
  }

  const actionableRequests = filteredRequests.filter(canAction);
  const selectedActionableRequests = actionableRequests.filter((request) => selectedOnboardingIds.has(request.id));
  const allActionableRequestsSelected = actionableRequests.length > 0 &&
      actionableRequests.every((request) => selectedOnboardingIds.has(request.id));
  const bulkRequiresAdditionalApproverChoice =
      bulkActionType === "APPROVE" &&
      canAdminApprove &&
      selectedActionableRequests.some((request) => request.workflowStage === "Head HR Approved");

  function toggleOnboardingRequestSelection(requestId: number, checked: boolean) {
    setSelectedOnboardingIds((current) => {
      const next = new Set(current);
      if (checked) {
        if (next.size >= 500) {
          toast.error("You can action up to 500 onboarding requests at a time.");
          return current;
        }
        next.add(requestId);
      } else {
        next.delete(requestId);
      }
      return next;
    });
  }

  function toggleAllActionableRequests(checked: boolean) {
    setSelectedOnboardingIds((current) => {
      const next = new Set(current);
      if (checked) {
        for (const request of actionableRequests) {
          if (!next.has(request.id) && next.size >= 500) {
            toast.error("You can action up to 500 onboarding requests at a time.");
            break;
          }
          next.add(request.id);
        }
      } else {
        for (const request of actionableRequests) {
          next.delete(request.id);
        }
      }
      return next;
    });
  }

  function openBulkAction(decision: "APPROVE" | "REJECT" | "REFER_BACK") {
    setBulkActionComment("");
    setBulkAdditionalApproverChoice("");
    setBulkActionType(decision);
  }

  async function submitBulkAction() {
    const requestIds = selectedActionableRequests.map((request) => request.id);
    const token = accessToken();
    if (!token || requestIds.length === 0 || !bulkActionType) {
      return;
    }
    if (!bulkActionComment.trim()) {
      toast.error("A comment is required for the bulk action.");
      return;
    }
    if (bulkActionComment.trim().length > 500) {
      toast.error("Comment cannot be more than 500 characters.");
      return;
    }
    if (bulkRequiresAdditionalApproverChoice && !bulkAdditionalApproverChoice) {
      toast.error("Choose whether to finalize these requests or route them for additional approval.");
      return;
    }

    setIsBulkActioning(true);
    try {
      await takeBulkOnboardingAction(token, {
        requestIds,
        decision: bulkActionType,
        comment: bulkActionComment.trim(),
        additionalApproverDesignation:
            bulkRequiresAdditionalApproverChoice && bulkAdditionalApproverChoice !== "NONE" && bulkAdditionalApproverChoice !== ""
                ? bulkAdditionalApproverChoice
                : null,
      });
      toast.success(requestIds.length + " onboarding request" + (requestIds.length === 1 ? "" : "s") + " updated.");
      setSelectedOnboardingIds(new Set());
      setBulkActionType(null);
      await loadRequests();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.status === 403
            ? "You are not authorized to action one or more selected requests."
            : error.status === 400
                ? "One or more selected requests are no longer actionable. Refresh the list and try again."
                : "Bulk action failed (" + error.status + ").");
      } else {
        toast.error("Unable to complete the bulk action.");
      }
    } finally {
      setIsBulkActioning(false);
    }
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
    if (request.workflowStage === "Admin Approved" || request.workflowStage === "Additional Approval Approved" || request.workflowStage === "Rejected" || request.workflowStage === "Refer Back") {
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
      juniorHrUserId: String(request.juniorHrUserId ?? ""),
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
    await Promise.all([
      loadManagerOptions(request.designationRoleName),
      loadJuniorHrOptions(request.designationRoleName),
    ]);
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

  function requiresAdditionalApproverChoice() {
    return !!selectedRequest && selectedRequest.workflowStage === "Head HR Approved" && actionType === "APPROVE" && canAdminApprove;
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
    if (requiresAdditionalApproverChoice() && !additionalApproverChoice) {
      toast.error("Please choose whether to route this for an additional approval.");
      return;
    }
    setIsActioning(true);
    try {
      await takeOnboardingAction(token, selectedRequest.id, {
        decision: actionType,
        comment: actionComment.trim(),
        additionalApproverDesignation:
            requiresAdditionalApproverChoice() && additionalApproverChoice !== "NONE" && additionalApproverChoice !== ""
                ? additionalApproverChoice
                : null,
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
    setSelectedOnboardingIds(new Set());
    setTrackerStatusFilter(filter);
    setActiveTab("tracker");
    if (!hasLoaded) {
      void loadRequests();
    }
  }

  async function downloadBulkTemplate() {
    const token = accessToken();
    if (!token) return;
    setIsDownloadingTemplate(true);
    try {
      const templateOptions = await getOnboardingBulkTemplateOptions(token);
      const { Workbook } = await import("exceljs");
      const workbook = new Workbook();
      workbook.creator = "ERM";
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet("Onboarding Requests", {
        views: [{ state: "frozen", ySplit: 1 }],
      });
      worksheet.columns = bulkOnboardingColumns.map((column) => ({
        header: column.header,
        key: column.key,
        width: column.width,
      }));
      worksheet.autoFilter = { from: "A1", to: "L" + (MAX_BULK_ONBOARDING_ROWS + 1) };
      worksheet.getRow(1).height = 32;
      worksheet.getRow(1).eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF243B73" } };
        cell.alignment = { vertical: "middle", wrapText: true };
      });

      const optionsSheet = workbook.addWorksheet("Options");
      optionsSheet.state = "veryHidden";
      const uniqueSorted = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
      const excelColumnLetter = (columnNumber: number) => {
        let current = columnNumber;
        let letter = "";
        while (current > 0) {
          const remainder = (current - 1) % 26;
          letter = String.fromCharCode(65 + remainder) + letter;
          current = Math.floor((current - 1) / 26);
        }
        return letter;
      };
      const designationOptions = [...new Map(
        templateOptions.designations.map((option) => [option.designationRoleName, option] as const),
      ).values()]
          .sort((a, b) => a.designationRoleName.localeCompare(b.designationRoleName));
      optionsSheet.getCell("A1").value = "Designation";
      optionsSheet.getCell("A1").font = { bold: true };
      const designationItems = ["Select option", ...uniqueSorted(designationOptions.map((option) => option.designationRoleName))];
      designationItems.forEach((value, index) => {
        optionsSheet.getCell(index + 2, 1).value = value;
      });
      workbook.definedNames.add("'Options'!$A$2:$A$" + (designationItems.length + 1), "DesignationOptions");

      // Keep an empty fallback list so dependent dropdowns stay empty until a designation is selected.
      optionsSheet.getCell("B1").value = "Empty options";
      optionsSheet.getCell("B1").font = { bold: true };
      optionsSheet.getCell("B2").value = "";
      workbook.definedNames.add("'Options'!$B$2", "EmptyOptions");

      designationOptions.forEach((option, index) => {
        const designationIndex = index + 2; // "Select option" is the first item in DesignationOptions.
        const managerColumn = 3 + index * 2;
        const hrbpColumn = managerColumn + 1;
        const managerLetter = excelColumnLetter(managerColumn);
        const hrbpLetter = excelColumnLetter(hrbpColumn);
        const managerRangeName = "ReportingManager_" + designationIndex;
        const hrbpRangeName = "Hrbp_" + designationIndex;
        const managerItems = ["Select option", ...uniqueSorted(option.reportingManagerUsernames)];
        const hrbpItems = ["Select option", ...uniqueSorted(option.hrbpUsernames)];

        optionsSheet.getCell(1, managerColumn).value = option.designationRoleName + " Reporting Managers";
        optionsSheet.getCell(1, hrbpColumn).value = option.designationRoleName + " HRBP";
        optionsSheet.getCell(1, managerColumn).font = { bold: true };
        optionsSheet.getCell(1, hrbpColumn).font = { bold: true };
        managerItems.forEach((value, itemIndex) => {
          optionsSheet.getCell(itemIndex + 2, managerColumn).value = value;
        });
        hrbpItems.forEach((value, itemIndex) => {
          optionsSheet.getCell(itemIndex + 2, hrbpColumn).value = value;
        });
        workbook.definedNames.add("'Options'!$" + managerLetter + "$2:$" + managerLetter + "$" + (managerItems.length + 1), managerRangeName);
        workbook.definedNames.add("'Options'!$" + hrbpLetter + "$2:$" + hrbpLetter + "$" + (hrbpItems.length + 1), hrbpRangeName);
      });

      const instructions = workbook.addWorksheet("Instructions");
      instructions.columns = [{ width: 112 }];
      instructions.addRows([
        ["Bulk On-Boarding Request Template"],
        ["Enter one candidate per row in the Onboarding Requests sheet. Do not rename or reorder its columns."],
        ["Columns marked * are required. Aadhaar, PAN, phone, and email values must be entered as text and must be valid."],
        ["Choose Designation first. The Reporting Manager Username and HRBP Username dropdowns then show only options valid for that designation. These values are refreshed from the database each time this template is downloaded."],
        ["The reporting manager and HRBP must match the selected designation's current hierarchy and HRBP mapping. The Validate step checks this before submission."],
        ["You can submit up to " + MAX_BULK_ONBOARDING_ROWS.toLocaleString("en-IN") + " rows in one workbook. Each valid row creates a separate onboarding request; large submissions are saved in batches."],
      ]);
      instructions.getRow(1).font = { bold: true, size: 16, color: { argb: "FF243B73" } };
      instructions.getColumn(1).alignment = { wrapText: true, vertical: "middle" };
      instructions.eachRow((row) => { row.height = 32; });

      for (let rowNumber = 2; rowNumber <= MAX_BULK_ONBOARDING_ROWS + 1; rowNumber++) {
        for (const columnNumber of [8, 9, 10]) {
          const rangeFormula = columnNumber === 8
              ? "=DesignationOptions"
              : columnNumber === 9
                  ? '=INDIRECT(IFERROR("ReportingManager_"&MATCH($H' + rowNumber + ',DesignationOptions,0),"EmptyOptions"))'
                  : '=INDIRECT(IFERROR("Hrbp_"&MATCH($H' + rowNumber + ',DesignationOptions,0),"EmptyOptions"))';
          worksheet.getCell(rowNumber, columnNumber).dataValidation = {
            type: "list",
            allowBlank: true,
            formulae: [rangeFormula],
            showErrorMessage: true,
            errorTitle: "Choose a current option",
            error: "Select a value from the dropdown list.",
            showInputMessage: columnNumber !== 8,
            promptTitle: "Select designation first",
            prompt: "This list contains options for the designation in column H.",
          };
        }
        for (const columnNumber of [3, 4, 5, 6, 7]) {
          worksheet.getCell(rowNumber, columnNumber).numFmt = "@";
        }
        if (rowNumber % 2 === 0) {
          for (let columnNumber = 1; columnNumber <= bulkOnboardingColumns.length; columnNumber++) {
            worksheet.getCell(rowNumber, columnNumber).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F8FF" } };
          }
        }
      }

      const content = await workbook.xlsx.writeBuffer();
      const blob = new Blob([content as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = "onboarding-request-template.xlsx";
      anchor.click();
      URL.revokeObjectURL(downloadUrl);
      toast.success("Latest onboarding template downloaded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to download the onboarding template.");
    } finally {
      setIsDownloadingTemplate(false);
    }
  }

  async function handleBulkFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    setBulkFileName(file?.name ?? "");
    setBulkRows(null);
    setBulkValidation(null);
    setBulkSubmission(null);
    setBulkValidationProgress(null);
    setBulkSaveProgress(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Upload the downloaded .xlsx onboarding template.");
      setBulkFileName("");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("The workbook must be smaller than 15 MB.");
      setBulkFileName("");
      return;
    }

    setIsReadingBulkFile(true);
    try {
      const { Workbook } = await import("exceljs");
      const workbook = new Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const worksheet = workbook.getWorksheet("Onboarding Requests");
      if (!worksheet) throw new Error("The workbook is missing the Onboarding Requests sheet.");

      const expectedHeaders = bulkOnboardingColumns.map((column) => column.header.replaceAll("*", "").trim().toLowerCase());
      const actualHeaders = bulkOnboardingColumns.map((_, index) => readExcelCell(worksheet.getCell(1, index + 1).value).replaceAll("*", "").trim().toLowerCase());
      if (expectedHeaders.some((header, index) => header !== actualHeaders[index])) {
        throw new Error("The spreadsheet columns do not match the downloaded onboarding template.");
      }

      if (worksheet.rowCount > MAX_BULK_ONBOARDING_ROWS + 1) {
        throw new Error("A maximum of " + MAX_BULK_ONBOARDING_ROWS.toLocaleString("en-IN") + " candidate rows can be uploaded at once.");
      }
      const rows: OnboardingBulkRow[] = [];
      for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
        const values = bulkOnboardingColumns.map((_, index) => readExcelCell(worksheet.getCell(rowNumber, index + 1).value));
        if (values.every((value) => !value)) continue;
        rows.push({
          rowNumber,
          firstName: values[0],
          lastName: values[1],
          aadhaarCardNumber: values[2],
          panCardNumber: values[3],
          personalEmailAddress: values[4],
          permanentAddress: values[5],
          phoneNumber: values[6],
          designationRoleName: values[7],
          reportingManagerUsername: values[8],
          hrbpUsername: values[9],
          educationQualification: values[10],
          comment: values[11],
        });
      }
      if (rows.length === 0) throw new Error("The workbook has no candidate rows to validate.");
      setBulkRows(rows);
      toast.success(`${rows.length} onboarding row${rows.length === 1 ? "" : "s"} ready to validate.`);
    } catch (error) {
      setBulkFileName("");
      toast.error(error instanceof Error ? error.message : "Unable to read the onboarding workbook.");
    } finally {
      setIsReadingBulkFile(false);
    }
  }

  async function validateBulkFile() {
    const token = accessToken();
    if (!token || !bulkRows) return;
    setIsValidatingBulk(true);
    setBulkValidationProgress({ completedRows: 0, totalRows: bulkRows.length });
    setBulkValidation(null);
    setBulkSubmission(null);
    try {
      const errors: OnboardingBulkValidationResponse["errors"] = [];
      for (let start = 0; start < bulkRows.length; start += BULK_ONBOARDING_BATCH_SIZE) {
        const batch = bulkRows.slice(start, start + BULK_ONBOARDING_BATCH_SIZE);
        const result = await validateBulkOnboardingRequests(token, batch);
        errors.push(...result.errors);
        setBulkValidationProgress({
          completedRows: Math.min(start + batch.length, bulkRows.length),
          totalRows: bulkRows.length,
        });
      }
      errors.push(...findCrossBatchDuplicateErrors(bulkRows, BULK_ONBOARDING_BATCH_SIZE));
      const result: OnboardingBulkValidationResponse = { valid: errors.length === 0, errors };
      setBulkValidation(result);
      if (result.valid) toast.success("Validation has been passed!");
      else toast.error("Validation has been failed. " + result.errors.length + " issue(s) found.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to validate the onboarding workbook.");
    } finally {
      setIsValidatingBulk(false);
      setBulkValidationProgress(null);
    }
  }

  async function submitBulkFile() {
    const token = accessToken();
    if (!token || !bulkRows || !bulkValidation?.valid || bulkSubmission?.submitted) return;
    setIsSubmittingBulk(true);
    const totalBatches = Math.ceil(bulkRows.length / BULK_ONBOARDING_BATCH_SIZE);
    let progress: BulkSaveProgress = bulkSaveProgress ?? {
      totalRows: bulkRows.length,
      processedRows: 0,
      currentBatch: 1,
      totalBatches,
      createdRequestIds: [],
      status: "saving",
    };
    progress = { ...progress, status: "saving", message: undefined };
    setBulkSaveProgress(progress);
    try {
      for (let start = progress.processedRows; start < bulkRows.length; start += BULK_ONBOARDING_BATCH_SIZE) {
        const batch = bulkRows.slice(start, start + BULK_ONBOARDING_BATCH_SIZE);
        progress = {
          ...progress,
          currentBatch: Math.floor(start / BULK_ONBOARDING_BATCH_SIZE) + 1,
          status: "saving",
          message: undefined,
        };
        setBulkSaveProgress(progress);

        const result = await submitBulkOnboardingRequests(token, batch);
        if (!result.submitted) {
          setBulkValidation({ valid: false, errors: result.errors });
          progress = {
            ...progress,
            status: "paused",
            message: "This batch could not be saved. Fix the row errors, validate again, then resume saving.",
          };
          setBulkSaveProgress(progress);
          toast.error("A batch was not saved. Review the row errors before continuing.");
          return;
        }

        progress = {
          ...progress,
          processedRows: Math.min(start + batch.length, bulkRows.length),
          createdRequestIds: [...progress.createdRequestIds, ...result.createdRequestIds],
          status: "saving",
          message: undefined,
        };
        setBulkSaveProgress(progress);
      }
      progress = { ...progress, status: "complete", processedRows: bulkRows.length };
      setBulkSaveProgress(progress);
      setBulkSubmission({ submitted: true, errors: [], createdRequestIds: progress.createdRequestIds });
      toast.success(progress.createdRequestIds.length + " onboarding request" + (progress.createdRequestIds.length === 1 ? "" : "s") + " created.");
      setBulkValidation({ valid: true, errors: [] });
      await loadRequests(0, pageSize);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to submit onboarding requests.";
      progress = {
        ...progress,
        status: "paused",
        message: "Saving paused after " + progress.processedRows.toLocaleString("en-IN") + " of " + progress.totalRows.toLocaleString("en-IN") + " rows. " + message,
      };
      setBulkSaveProgress(progress);
      toast.error("Saving paused. " + progress.processedRows.toLocaleString("en-IN") + " of " + progress.totalRows.toLocaleString("en-IN") + " requests were confirmed saved.");
    } finally {
      setIsSubmittingBulk(false);
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
          {isSeniorHr ? (
              <Button
                  className={activeTab === "bulk" ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500" : ""}
                  onClick={() => setActiveTab("bulk")}
                  variant={activeTab === "bulk" ? "default" : "ghost"}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Bulk On-Boarding
              </Button>
          ) : null}
        </div>

        {activeTab !== "bulk" ? (
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
        ) : null}

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
                            juniorHrUserId: "",
                          }));
                          void loadManagerOptions(value);
                          void loadJuniorHrOptions(value);
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
                    <FloatingSelect
                        className="md:col-span-2"
                        label="HRBP *"
                        value={form.juniorHrUserId}
                        onChange={(value) => setForm((current) => ({ ...current, juniorHrUserId: value }))}
                        disabled={!form.designationRoleName || loadingJuniorHrOptions || juniorHrOptions.length === 0}
                    >
                      <option value="">{loadingJuniorHrOptions ? "Loading HRBP options..." : "Select HRBP"}</option>
                      {juniorHrOptions.map((juniorHr) => (
                          <option key={juniorHr.id} value={String(juniorHr.id)}>
                            {juniorHr.fullName} ({juniorHr.username})
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
        ) : activeTab === "tracker" ? (
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
                      {actionableRequests.length > 0 ? (
                          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3">
                            <span className="mr-auto text-sm font-medium text-indigo-950">
                              {selectedActionableRequests.length} selected
                              <span className="ml-2 text-xs font-normal text-indigo-700">Select requests on this page to action them together.</span>
                            </span>
                            {selectedActionableRequests.length > 0 ? (
                                <>
                                  <Button className="gap-2 bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => openBulkAction("APPROVE")} size="sm">
                                    <CheckCircle2 className="h-4 w-4" /> Approve
                                  </Button>
                                  <Button className="gap-2 border-violet-200 bg-white text-violet-700 hover:bg-violet-100" onClick={() => openBulkAction("REFER_BACK")} size="sm" variant="outline">
                                    <CornerUpLeft className="h-4 w-4" /> Refer back
                                  </Button>
                                  <Button className="gap-2 border-rose-200 bg-white text-rose-700 hover:bg-rose-100" onClick={() => openBulkAction("REJECT")} size="sm" variant="outline">
                                    <ShieldX className="h-4 w-4" /> Reject
                                  </Button>
                                </>
                            ) : null}
                          </div>
                      ) : null}
                      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
                        <table className="w-full min-w-[1020px] text-sm">
                          <thead className="bg-gradient-to-r from-indigo-50 via-violet-50 to-cyan-50 text-left text-zinc-800">
                          <tr>
                            <th className="w-10 px-4 py-3">
                              <input
                                  aria-label="Select all actionable onboarding requests on this page"
                                  checked={allActionableRequestsSelected}
                                  className="h-4 w-4 accent-indigo-600"
                                  disabled={actionableRequests.length === 0}
                                  onChange={(event) => toggleAllActionableRequests(event.currentTarget.checked)}
                                  type="checkbox"
                              />
                            </th>
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
                                <td className="px-4 py-3 align-top">
                                  {canAction(request) ? (
                                      <input
                                          aria-label={"Select onboarding request " + request.id}
                                          checked={selectedOnboardingIds.has(request.id)}
                                          className="mt-1 h-4 w-4 accent-indigo-600"
                                          onChange={(event) => toggleOnboardingRequestSelection(request.id, event.currentTarget.checked)}
                                          type="checkbox"
                                      />
                                  ) : null}
                                </td>
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
                                    <span className="block">HRBP: {request.juniorHrFullName ?? "-"}{request.juniorHrRoleName ? ` (${request.juniorHrRoleName})` : ""}</span>
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
                                                setAdditionalApproverChoice("");
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
                                                setAdditionalApproverChoice("");
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
                                                setAdditionalApproverChoice("");
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
                                setSelectedOnboardingIds(new Set());
                                setIsLoading(true);
                                void loadRequests(p, pageSize);
                              }}
                              onSizeChange={(s) => {
                                setSelectedOnboardingIds(new Set());
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
        ) : null}

        {activeTab === "bulk" && isSeniorHr ? (
            <Card className="mb-6 overflow-hidden border-emerald-100 shadow-md shadow-emerald-100/40">
              <CardHeader className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white">
                <CardTitle className="flex items-center gap-2 text-white">
                  <FileSpreadsheet className="h-5 w-5" /> Bulk On-Boarding Requests
                </CardTitle>
                <CardDescription className="text-emerald-50">
                  Download a fresh template, complete one candidate per row, then validate before submitting. Workbooks support up to 10,000 rows and are saved in small batches.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">1. Prepare the workbook</p>
                    <p className="mt-1 text-sm text-zinc-600">
                      The template includes current designation, reporting manager, and HRBP dropdown values fetched from the database when downloaded.
                    </p>
                  </div>
                  <Button disabled={isDownloadingTemplate} onClick={() => void downloadBulkTemplate()} variant="outline">
                    {isDownloadingTemplate ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    {isDownloadingTemplate ? "Preparing template..." : "Download Excel template"}
                  </Button>
                  <label className={`inline-flex h-10 cursor-pointer items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-100 ${isReadingBulkFile ? "pointer-events-none opacity-60" : ""}`}>
                    {isReadingBulkFile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    {isReadingBulkFile ? "Reading workbook..." : "Upload completed workbook"}
                    <input accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" disabled={isReadingBulkFile || isValidatingBulk || isSubmittingBulk} onChange={(event) => void handleBulkFileChange(event)} type="file" />
                  </label>
                  {bulkFileName ? (
                      <p className="text-xs text-zinc-500 lg:col-span-3">Selected file: <span className="font-medium text-zinc-700">{bulkFileName}</span>{bulkRows ? ` · ${bulkRows.length} candidate row${bulkRows.length === 1 ? "" : "s"}` : ""}</p>
                  ) : null}
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">2. Validate and submit</p>
                    <p className="mt-1 text-sm text-zinc-600">Validation checks required fields, formats, duplicate values, and each row&apos;s reporting hierarchy and HRBP mapping.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={!bulkRows || isValidatingBulk || isSubmittingBulk} onClick={() => void validateBulkFile()} variant="outline">
                      {isValidatingBulk ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                      {isValidatingBulk ? "Validating..." : "Validate workbook"}
                    </Button>
                    <Button disabled={!bulkValidation?.valid || isValidatingBulk || isSubmittingBulk || !!bulkSubmission?.submitted} onClick={() => void submitBulkFile()}>
                      {isSubmittingBulk ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      {isSubmittingBulk
                          ? "Saving " + (bulkSaveProgress?.processedRows ?? 0).toLocaleString("en-IN") + "/" + (bulkSaveProgress?.totalRows ?? bulkRows?.length ?? 0).toLocaleString("en-IN")
                          : bulkSaveProgress?.status === "paused"
                              ? bulkSaveProgress.processedRows > 0 ? "Resume saving remaining" : "Retry saving"
                              : "Submit all requests"}
                    </Button>
                  </div>
                </div>

                {isValidatingBulk && bulkValidationProgress ? (
                    <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4" role="status" aria-live="polite">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-blue-950">Validating workbook in batches</span>
                        <span className="tabular-nums text-blue-800">{bulkValidationProgress.completedRows.toLocaleString("en-IN")} / {bulkValidationProgress.totalRows.toLocaleString("en-IN")} rows</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100">
                        <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-[width]" style={{ width: (bulkValidationProgress.completedRows / Math.max(1, bulkValidationProgress.totalRows) * 100) + "%" }} />
                      </div>
                    </div>
                ) : null}

                {bulkSaveProgress ? (
                    <div className={"rounded-xl border p-4 " + (bulkSaveProgress.status === "complete" ? "border-emerald-200 bg-emerald-50" : bulkSaveProgress.status === "paused" ? "border-amber-200 bg-amber-50" : "border-indigo-200 bg-indigo-50")} role="status" aria-live="polite">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="font-semibold text-zinc-900">
                          {bulkSaveProgress.status === "complete" ? "All onboarding requests saved" : bulkSaveProgress.status === "paused" ? "Batch saving paused" : "Saving onboarding requests"}
                        </span>
                        <span className="font-medium tabular-nums text-zinc-700">
                          {bulkSaveProgress.processedRows.toLocaleString("en-IN")} / {bulkSaveProgress.totalRows.toLocaleString("en-IN")} records saved
                        </span>
                      </div>
                      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/80 ring-1 ring-black/5">
                        <div className={"h-full rounded-full transition-[width] " + (bulkSaveProgress.status === "paused" ? "bg-amber-500" : "bg-gradient-to-r from-indigo-600 via-violet-600 to-emerald-500")} style={{ width: (bulkSaveProgress.processedRows / Math.max(1, bulkSaveProgress.totalRows) * 100) + "%" }} />
                      </div>
                      <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-zinc-600">
                        <span>{bulkSaveProgress.createdRequestIds.length.toLocaleString("en-IN")} request(s) confirmed saved</span>
                        {bulkSaveProgress.status !== "complete" ? <span>Batch {Math.min(bulkSaveProgress.currentBatch, bulkSaveProgress.totalBatches)} of {bulkSaveProgress.totalBatches} · {BULK_ONBOARDING_BATCH_SIZE} records per batch</span> : null}
                      </div>
                      {bulkSaveProgress.message ? <p className="mt-2 text-sm text-amber-900">{bulkSaveProgress.message}</p> : null}
                    </div>
                ) : null}

                {bulkValidation ? (
                    <div className={`rounded-2xl border p-4 ${bulkValidation.valid ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
                      <div className="flex items-center gap-2">
                        {bulkValidation.valid ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <ShieldX className="h-5 w-5 text-rose-600" />}
                        <p className={`font-semibold ${bulkValidation.valid ? "text-emerald-800" : "text-rose-800"}`}>
                          {bulkValidation.valid ? "Validation has been passed!" : "Validation has been failed"}
                        </p>
                      </div>
                      {bulkValidation.valid ? (
                          <p className="mt-1 text-sm text-emerald-700">All {bulkRows?.length ?? 0} row(s) are valid. You can submit the requests now.</p>
                      ) : (
                          <>
                            <p className="mt-1 text-sm text-rose-700">{bulkValidation.errors.length} issue(s) found. Fix the indicated cells in Excel, upload the corrected workbook, and validate again.</p>
                            <div className="mt-3 max-h-80 overflow-auto rounded-xl border border-rose-200 bg-white">
                              <table className="w-full min-w-[620px] text-left text-sm">
                                <thead className="sticky top-0 bg-rose-100 text-rose-900">
                                <tr>
                                  <th className="px-3 py-2 font-semibold">Excel row</th>
                                  <th className="px-3 py-2 font-semibold">Field</th>
                                  <th className="px-3 py-2 font-semibold">Issue</th>
                                </tr>
                                </thead>
                                <tbody>
                                {bulkValidation.errors.map((error, index) => (
                                    <tr className="border-t border-zinc-100" key={`${error.rowNumber}-${error.field}-${index}`}>
                                      <td className="px-3 py-2 font-medium text-zinc-800">{error.rowNumber ?? "Workbook"}</td>
                                      <td className="px-3 py-2 text-zinc-700">{error.field}</td>
                                      <td className="px-3 py-2 text-zinc-700">{error.message}</td>
                                    </tr>
                                ))}
                                </tbody>
                              </table>
                            </div>
                          </>
                      )}
                    </div>
                ) : null}

                {bulkSubmission?.submitted ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                      <p className="font-semibold">{bulkSubmission.createdRequestIds.length} separate onboarding request(s) created successfully.</p>
                      <p className="mt-1">All requests are now available in Track On-Boarding Request.</p>
                    </div>
                ) : null}
              </CardContent>
            </Card>
        ) : null}

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
                    <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">HRBP</p>
                      <p className="mt-1 font-semibold text-zinc-900">{viewRequest.juniorHrFullName ?? "-"}{viewRequest.juniorHrRoleName ? ` (${viewRequest.juniorHrRoleName})` : ""}</p>
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
                  {requiresAdditionalApproverChoice() ? (
                      <div className="mb-5 rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                        <p className="text-sm font-semibold text-indigo-900">Additional approval required?</p>
                        <p className="mt-1 text-xs text-indigo-700">
                          You can finalize this request now, or route it to another designation for one more approval before the employee profile is created.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                              className={additionalApproverChoice === "NONE" ? "rounded-full" : "rounded-full bg-white text-indigo-700"}
                              onClick={() => setAdditionalApproverChoice("NONE")}
                              size="sm"
                              type="button"
                              variant={additionalApproverChoice === "NONE" ? "default" : "outline"}
                          >
                            No, finalize now
                          </Button>
                          {ADDITIONAL_APPROVER_DESIGNATIONS.map((designation) => (
                              <Button
                                  className={additionalApproverChoice === designation ? "rounded-full" : "rounded-full bg-white text-indigo-700"}
                                  key={designation}
                                  onClick={() => setAdditionalApproverChoice(designation)}
                                  size="sm"
                                  type="button"
                                  variant={additionalApproverChoice === designation ? "default" : "outline"}
                              >
                                {designation}
                              </Button>
                          ))}
                        </div>
                      </div>
                  ) : null}
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

        {bulkActionType ? (
            <div
                className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/45 backdrop-blur-sm"
                onClick={(event) => {
                  if (event.target === event.currentTarget && !isBulkActioning) {
                    setBulkActionType(null);
                  }
                }}
            >
              <div className="ml-auto flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-white/50 bg-white shadow-2xl shadow-slate-300/40">
                <div className="border-b border-zinc-200 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-6 py-5 text-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold">
                        {bulkActionType === "APPROVE" ? "Approve requests" : bulkActionType === "REJECT" ? "Reject requests" : "Refer requests back"}
                      </h3>
                      <p className="mt-1 text-sm text-indigo-100">
                        This action will apply to {selectedActionableRequests.length} selected onboarding request{selectedActionableRequests.length === 1 ? "" : "s"}.
                      </p>
                    </div>
                    <Button
                        className="border-white/30 bg-white/10 text-white hover:bg-white/20"
                        disabled={isBulkActioning}
                        onClick={() => setBulkActionType(null)}
                        variant="outline"
                    >
                      Close
                    </Button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
                  {bulkRequiresAdditionalApproverChoice ? (
                      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                        <p className="text-sm font-semibold text-indigo-900">Additional approval for Admin-approved requests</p>
                        <p className="mt-1 text-xs text-indigo-700">
                          Choose whether to finalize selected requests at the Admin step or route them for another approval.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                              className={bulkAdditionalApproverChoice === "NONE" ? "rounded-full" : "rounded-full bg-white text-indigo-700"}
                              onClick={() => setBulkAdditionalApproverChoice("NONE")}
                              size="sm"
                              type="button"
                              variant={bulkAdditionalApproverChoice === "NONE" ? "default" : "outline"}
                          >
                            No, finalize now
                          </Button>
                          {ADDITIONAL_APPROVER_DESIGNATIONS.map((designation) => (
                              <Button
                                  className={bulkAdditionalApproverChoice === designation ? "rounded-full" : "rounded-full bg-white text-indigo-700"}
                                  key={designation}
                                  onClick={() => setBulkAdditionalApproverChoice(designation)}
                                  size="sm"
                                  type="button"
                                  variant={bulkAdditionalApproverChoice === designation ? "default" : "outline"}
                              >
                                {designation}
                              </Button>
                          ))}
                        </div>
                      </div>
                  ) : null}
                  <MentionTextareaField
                      className="min-h-35"
                      label={bulkActionType === "REFER_BACK" ? "Clarification / Change Comment * (applies to all selected requests)" : "Comment * (applies to all selected requests)"}
                      mentionSearch={mentionSearch}
                      onChange={setBulkActionComment}
                      value={bulkActionComment}
                  />
                  <p className="text-right text-xs text-zinc-500">{bulkActionComment.length}/500 characters</p>
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-6 py-4">
                  <Button disabled={isBulkActioning} onClick={() => setBulkActionType(null)} variant="outline">
                    Cancel
                  </Button>
                  <Button
                      className="gap-2"
                      disabled={isBulkActioning || selectedActionableRequests.length === 0}
                      onClick={() => void submitBulkAction()}
                  >
                    {isBulkActioning ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {isBulkActioning
                        ? "Applying..."
                        : bulkActionType === "APPROVE"
                            ? "Approve selected"
                            : bulkActionType === "REJECT"
                                ? "Reject selected"
                                : "Refer back selected"}
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
                    !ONBOARDING_CLOSED_STAGES.includes(commentsRequest.workflowStage)
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
