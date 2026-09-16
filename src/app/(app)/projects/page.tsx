"use client";

import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, Check, CheckCircle2, ChevronDown, CornerUpLeft, Eye, KanbanSquare, Loader2, MessageSquareQuote, PencilLine, PlusCircle, RefreshCcw, Send, ShieldX } from "lucide-react";
import { toast } from "sonner";

import { CommentsConversationModal } from "@/components/erm/comments-conversation-modal";
import { DataTablePagination } from "@/components/erm/data-table-pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MentionTextareaField } from "@/components/ui/mention-textarea-field";
import { Spinner } from "@/components/ui/spinner";
import {
  ApiError,
  addProjectAllocationComment,
  addProjectChangeRequestComment,
  addProjectRequestComment,
  createProjectAllocationRequest,
  createProjectChangeRequest,
  createProjectRequest,
  getManagedProjects,
  getProjectAllocationEmployeeOptions,
  getProjectAllocationProjectOptions,
  getProjectAllocationRequests,
  getProjectChangeRequests,
  getProjectDeliveryManagerOptions,
  getProjectDirectorOptions,
  getProjectManagerOptions,
  getProjectMasterProjects,
  getProjectOwnerOptions,
  getProjectRequests,
  manageProjectAllocation,
  searchUserMentions,
  takeProjectChangeRequestAction,
  resubmitProjectRequest,
  resubmitProjectAllocationRequest,
  takeProjectAction,
  takeProjectAllocationAction,
  type ManagedProject,
  type ProjectChangeRequest,
  type ProjectManagerOption,
  type ProjectAllocation,
  type ProjectAllocationEmployeeOption,
  type ProjectAllocationProjectOption,
  type ProjectStatus,
  type ProjectAllocationType,
  type ProjectRequest,
} from "@/lib/api";
import { loadSession } from "@/lib/auth-storage";

type ProjectForm = {
  projectName: string;
  projectCode: string;
  clientName: string;
  projectType: string;
  priority: string;
  plannedStartDate: string;
  plannedEndDate: string;
  budgetAmount: string;
  currency: string;
  deliveryManagerUserId: string;
  projectOwnerUserId: string;
  projectDirectorUserId: string;
  projectManagerUserId: string;
  projectStatus: ProjectStatus | "";
  description: string;
  riskNotes: string;
  comment: string;
};

type ManageProjectForm = {
  projectName: string;
  projectCode: string;
  clientName: string;
  projectType: string;
  priority: string;
  plannedStartDate: string;
  plannedEndDate: string;
  budgetAmount: string;
  currency: string;
  deliveryManagerUserId: string;
  projectOwnerUserId: string;
  projectDirectorUserId: string;
  projectStatus: ProjectStatus | "";
  description: string;
  riskNotes: string;
  reason: string;
};

type AllocationForm = {
  projectRequestId: string;
  employeeUserIds: string[];
  allocationType: ProjectAllocationType | "";
  allocationPercent: string;
  startDate: string;
  endDate: string;
  comment: string;
};

type AllocationManageForm = {
  action: "EXTEND" | "REDUCE" | "RELEASE";
  allocationPercent: string;
  endDate: string;
  comment: string;
};

type ProjectTopTab = "raiseProject" | "projectTracker" | "projectAllocation" | "allocationTracker" | "manageProjects" | "changeTracker" | "projectMaster";

const initialForm: ProjectForm = {
  projectName: "",
  projectCode: "",
  clientName: "",
  projectType: "",
  priority: "",
  plannedStartDate: "",
  plannedEndDate: "",
  budgetAmount: "",
  currency: "INR",
  deliveryManagerUserId: "",
  projectOwnerUserId: "",
  projectDirectorUserId: "",
  projectManagerUserId: "",
  projectStatus: "Planned",
  description: "",
  riskNotes: "",
  comment: "",
};

const initialManageProjectForm: ManageProjectForm = {
  projectName: "",
  projectCode: "",
  clientName: "",
  projectType: "",
  priority: "",
  plannedStartDate: "",
  plannedEndDate: "",
  budgetAmount: "",
  currency: "INR",
  deliveryManagerUserId: "",
  projectOwnerUserId: "",
  projectDirectorUserId: "",
  projectStatus: "Planned",
  description: "",
  riskNotes: "",
  reason: "",
};

const initialAllocationForm: AllocationForm = {
  projectRequestId: "",
  employeeUserIds: [],
  allocationType: "",
  allocationPercent: "",
  startDate: "",
  endDate: "",
  comment: "",
};

const initialManageForm: AllocationManageForm = {
  action: "EXTEND",
  allocationPercent: "",
  endDate: "",
  comment: "",
};

const projectTypes = ["Internal", "Billable", "Fixed Bid", "T&M"];
const priorities = ["Low", "Medium", "High", "Critical"];
const projectStatuses: ProjectStatus[] = ["Planned", "Active", "On Hold", "Completed", "Cancelled"];

function stageClass(stage: string) {
  const value = stage.toLowerCase();
  if (value.includes("active")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (value.includes("released")) return "bg-slate-100 text-slate-700 border-slate-300";
  if (value.includes("approved")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (value.includes("refer")) return "bg-violet-50 text-violet-700 border-violet-200";
  if (value.includes("reject")) return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

function pendingWith(request: ProjectRequest) {
  if (request.workflowStage === "PM Submitted") return request.projectDirectorName ? `Director (${request.projectDirectorName})` : "Director";
  if (request.workflowStage === "Delivery Manager Approved") return request.projectDirectorName ? `Director (${request.projectDirectorName})` : "Director";
  if (request.workflowStage === "Project Owner Approved") return request.projectDirectorName ? `Director (${request.projectDirectorName})` : "Director";
  if (request.workflowStage === "Director Approved") return "CTO";
  if (request.workflowStage === "CTO Approved") return "Super Admin";
  if (request.workflowStage === "Refer Back") return "Requester";
  if (request.workflowStage === "Rejected") return "Closed";
  return "Completed";
}

function formatReleaseDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN");
}

function normalizeComparisonValue(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }
  const text = String(value).trim();
  return text.length > 0 ? text : "-";
}

function formatBudget(currency: string, amount: number) {
  return `${currency} ${Number(amount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default function ProjectsPage() {
  const [activeTab, setActiveTab] = useState<"requests" | "allocation" | "management" | "changeTracker" | "master">("requests");
  const [projectTopTab, setProjectTopTab] = useState<ProjectTopTab>("raiseProject");
  const [requestTab, setRequestTab] = useState<"raise" | "tracker">("raise");
  const [allocationTab, setAllocationTab] = useState<"raise" | "tracker">("tracker");
  const [form, setForm] = useState<ProjectForm>(initialForm);
  const [requests, setRequests] = useState<ProjectRequest[]>([]);
  const [deliveryManagers, setDeliveryManagers] = useState<ProjectManagerOption[]>([]);
  const [projectOwners, setProjectOwners] = useState<ProjectManagerOption[]>([]);
  const [projectDirectors, setProjectDirectors] = useState<ProjectManagerOption[]>([]);
  const [projectManagers, setProjectManagers] = useState<ProjectManagerOption[]>([]);
  const [allocationForm, setAllocationForm] = useState<AllocationForm>(initialAllocationForm);
  const [allocationRequests, setAllocationRequests] = useState<ProjectAllocation[]>([]);
  const [managedProjects, setManagedProjects] = useState<ManagedProject[]>([]);
  const [changeRequests, setChangeRequests] = useState<ProjectChangeRequest[]>([]);
  const [projectMasterProjects, setProjectMasterProjects] = useState<ProjectRequest[]>([]);
  const [manageProject, setManageProject] = useState<ManagedProject | null>(null);
  const [manageProjectForm, setManageProjectForm] = useState<ManageProjectForm>(initialManageProjectForm);
  const [selectedChangeRequest, setSelectedChangeRequest] = useState<ProjectChangeRequest | null>(null);
  const [changeActionType, setChangeActionType] = useState<"APPROVE" | "REJECT">("APPROVE");
  const [changeActionComment, setChangeActionComment] = useState("");
  const [isChangeActioning, setIsChangeActioning] = useState(false);
  const [isManageProjectSubmitting, setIsManageProjectSubmitting] = useState(false);
  const [isManagedProjectsLoading, setIsManagedProjectsLoading] = useState(false);
  const [isChangeRequestsLoading, setIsChangeRequestsLoading] = useState(false);
  const [isProjectMasterLoading, setIsProjectMasterLoading] = useState(false);
  const [commentsManagedProject, setCommentsManagedProject] = useState<ManagedProject | null>(null);
  const [commentsChangeRequest, setCommentsChangeRequest] = useState<ProjectChangeRequest | null>(null);
  const [isCommentingChangeRequest, setIsCommentingChangeRequest] = useState(false);
  const [allocationProjectOptions, setAllocationProjectOptions] = useState<ProjectAllocationProjectOption[]>([]);
  const [allocationEmployeeOptions, setAllocationEmployeeOptions] = useState<ProjectAllocationEmployeeOption[]>([]);
  const [allocationPage, setAllocationPage] = useState(0);
  const [allocationPageSize, setAllocationPageSize] = useState(25);
  const [allocationTotalElements, setAllocationTotalElements] = useState(0);
  const [allocationTotalPages, setAllocationTotalPages] = useState(0);
  const [allocationQuery, setAllocationQuery] = useState("");
  const [allocationStatusFilter, setAllocationStatusFilter] = useState("");
  const [allocationHasLoaded, setAllocationHasLoaded] = useState(false);
  const [allocationIsLoading, setAllocationIsLoading] = useState(false);
  const [allocationIsSubmitting, setAllocationIsSubmitting] = useState(false);
  const [allocationEditingId, setAllocationEditingId] = useState<number | null>(null);
  const [selectedAllocation, setSelectedAllocation] = useState<ProjectAllocation | null>(null);
  const [selectedAllocationIds, setSelectedAllocationIds] = useState<number[]>([]);
  const allocationSelectAllRef = useRef<HTMLInputElement>(null);
  const [bulkAllocationActionType, setBulkAllocationActionType] = useState<"APPROVE" | "REJECT" | "REFER_BACK">("APPROVE");
  const [bulkAllocationActionComment, setBulkAllocationActionComment] = useState("");
  const [bulkAllocationActionOpen, setBulkAllocationActionOpen] = useState(false);
  const [isBulkAllocationActioning, setIsBulkAllocationActioning] = useState(false);
  const [allocationActionType, setAllocationActionType] = useState<"APPROVE" | "REJECT" | "REFER_BACK">("APPROVE");
  const [allocationActionComment, setAllocationActionComment] = useState("");
  const [isAllocationActioning, setIsAllocationActioning] = useState(false);
  const [isCommentingAllocation, setIsCommentingAllocation] = useState(false);
  const [manageAllocation, setManageAllocation] = useState<ProjectAllocation | null>(null);
  const [manageForm, setManageForm] = useState<AllocationManageForm>(initialManageForm);
  const [commentsAllocation, setCommentsAllocation] = useState<ProjectAllocation | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [query, setQuery] = useState("");
  const [workflowFilter, setWorkflowFilter] = useState("");
  const [editingRequestId, setEditingRequestId] = useState<number | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ProjectRequest | null>(null);
  const [viewRequest, setViewRequest] = useState<ProjectRequest | null>(null);
  const [viewChangeRequest, setViewChangeRequest] = useState<ProjectChangeRequest | null>(null);
  const [actionType, setActionType] = useState<"APPROVE" | "REJECT" | "REFER_BACK">("APPROVE");
  const [actionComment, setActionComment] = useState("");
  const [isActioning, setIsActioning] = useState(false);
  const [isCommentingRequest, setIsCommentingRequest] = useState(false);
  const [commentsRequest, setCommentsRequest] = useState<ProjectRequest | null>(null);

  const session = useMemo(() => loadSession(), []);
  const username = useMemo(() => session?.username?.toLowerCase() ?? "", [session]);
  const roleNames = useMemo(() => (session?.roles ?? []).map((role) => role.toLowerCase()), [session]);

  const hasProjectManagerRole = roleNames.includes("project manager");
  const hasProjectOwnerRole = roleNames.includes("project owner");
  const hasProjectDirectorRole = roleNames.includes("director");
  const hasDeliveryManagerRole = roleNames.includes("delivery manager");
  const hasCtoRole = roleNames.includes("cto");
  const hasSuperRole = roleNames.includes("super admin") || roleNames.includes("admin");
  const canCreate = roleNames.includes("project owner");
  const canProjectManager =
      hasProjectManagerRole ||
      roleNames.includes("team lead") ||
      roleNames.includes("it support manager") ||
      roleNames.includes("it support lead");
  const canDmApprove = hasDeliveryManagerRole;
  const canProjectOwnerApprove = hasProjectOwnerRole;
  const canDirectorApprove = hasProjectDirectorRole;
  const canCtoApprove = hasCtoRole;
  const canSuperApprove = hasSuperRole;
  const canManageAllocation = canDmApprove;
  const canCreateAllocation = canProjectManager;
  const canUseManageProjects = canProjectOwnerApprove || canDirectorApprove || canCtoApprove || canSuperApprove;
  const canViewProjectTrackers = canProjectManager || canProjectOwnerApprove || canDirectorApprove || canCtoApprove || canSuperApprove;
  const canUseProjectMaster = hasProjectManagerRole || hasProjectOwnerRole || hasProjectDirectorRole || hasDeliveryManagerRole || hasCtoRole || hasSuperRole;
  const visibleProjectTabs = useMemo(
      () =>
          [
            canCreate ? "raiseProject" : null,
            canCreate || canViewProjectTrackers ? "projectTracker" : null,
            canCreate ? "manageProjects" : null,
            canUseManageProjects ? "changeTracker" : null,
            canUseProjectMaster ? "projectMaster" : null,
            canCreateAllocation ? "projectAllocation" : null,
            canCreateAllocation || canManageAllocation ? "allocationTracker" : null,
          ].filter((value): value is ProjectTopTab => value !== null),
      [canCreate, canCreateAllocation, canManageAllocation, canUseManageProjects, canUseProjectMaster, canViewProjectTrackers]
  );
  const activeProjectTopTab = useMemo(
      () => (visibleProjectTabs.includes(projectTopTab) ? projectTopTab : visibleProjectTabs[0] ?? projectTopTab),
      [projectTopTab, visibleProjectTabs]
  );
  const projectMasterById = useMemo(() => {
    const entries = projectMasterProjects.map((item) => [item.id, item] as const);
    return new Map<number, ProjectRequest>(entries);
  }, [projectMasterProjects]);

  const pendingAllocationIds = useMemo(
      () => allocationRequests.filter((allocation) => allocation.status === "Pending DM Approval").map((allocation) => allocation.id),
      [allocationRequests]
  );
  const selectedPendingAllocations = useMemo(
      () => allocationRequests.filter((allocation) => selectedAllocationIds.includes(allocation.id) && allocation.status === "Pending DM Approval"),
      [allocationRequests, selectedAllocationIds]
  );
  const allPendingSelected = pendingAllocationIds.length > 0 && pendingAllocationIds.every((id) => selectedAllocationIds.includes(id));
  const somePendingSelected = pendingAllocationIds.some((id) => selectedAllocationIds.includes(id));

  useEffect(() => {
    if (allocationSelectAllRef.current) {
      allocationSelectAllRef.current.indeterminate = somePendingSelected && !allPendingSelected;
    }
  }, [allPendingSelected, somePendingSelected]);

  const accessToken = useCallback(() => {
    const current = loadSession();
    if (!current?.accessToken) {
      toast.error("Session not found. Please login again.");
      return null;
    }
    return current.accessToken;
  }, []);

  const mentionSearch = useCallback(
      async (query: string) => {
        const token = accessToken();
        if (!token) return [];
        return searchUserMentions(token, query);
      },
      [accessToken]
  );

  const takeAllocationBulkAction = useCallback(
      async (
          token: string,
          payload: {
            allocationIds: number[];
            decision: "APPROVE" | "REJECT" | "REFER_BACK";
            comment: string;
          }
      ) => {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"}/api/project-allocations/bulk-actions`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          throw new ApiError(await response.text(), response.status);
        }
        return (await response.json()) as ProjectAllocation[];
      },
      []
  );

  const loadDeliveryManagers = useCallback(async () => {
    const token = accessToken();
    if (!token) return;
    try {
      setDeliveryManagers(await getProjectDeliveryManagerOptions(token));
    } catch {
      toast.error("Unable to load delivery managers.");
    }
  }, [accessToken]);

  const loadProjectOwners = useCallback(async () => {
    const token = accessToken();
    if (!token) return;
    try {
      setProjectOwners(await getProjectOwnerOptions(token));
    } catch {
      toast.error("Unable to load project owners.");
    }
  }, [accessToken]);

  const loadProjectDirectors = useCallback(async () => {
    const token = accessToken();
    if (!token) return;
    try {
      setProjectDirectors(await getProjectDirectorOptions(token));
    } catch {
      toast.error("Unable to load project directors.");
    }
  }, [accessToken]);

  const loadProjectManagers = useCallback(async () => {
    const token = accessToken();
    if (!token) return;
    try {
      setProjectManagers(await getProjectManagerOptions(token));
    } catch {
      toast.error("Unable to load project managers.");
    }
  }, [accessToken]);

  const loadAllocationOptions = useCallback(async () => {
    const token = accessToken();
    if (!token) return;
    try {
      const [projects, employees] = await Promise.all([
        getProjectAllocationProjectOptions(token),
        getProjectAllocationEmployeeOptions(token),
      ]);
      setAllocationProjectOptions(projects);
      setAllocationEmployeeOptions(employees);
    } catch {
      toast.error("Unable to load allocation options.");
    }
  }, [accessToken]);

  const loadAllocations = useCallback(async (nextPage = allocationPage, nextSize = allocationPageSize, nextQuery = allocationQuery, nextStatus = allocationStatusFilter) => {
    const token = accessToken();
    if (!token) return;
    setAllocationIsLoading(true);
    try {
      const result = await getProjectAllocationRequests(token, nextStatus || undefined, nextQuery || undefined, nextPage, nextSize);
      setAllocationRequests(result.content);
      setAllocationTotalElements(result.totalElements);
      setAllocationTotalPages(result.totalPages);
      setAllocationPage(result.page);
      setAllocationPageSize(result.size);
      setAllocationHasLoaded(true);
      setSelectedAllocationIds([]);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        toast.error("You are not authorized to view allocations.");
      } else {
        toast.error("Unable to load allocations.");
      }
    } finally {
      setAllocationIsLoading(false);
    }
  }, [accessToken, allocationPage, allocationPageSize, allocationQuery, allocationStatusFilter]);

  const loadManagedProjects = useCallback(async () => {
    const token = accessToken();
    if (!token) return;
    setIsManagedProjectsLoading(true);
    try {
      setManagedProjects(await getManagedProjects(token));
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setManagedProjects([]);
      } else {
        toast.error("Unable to load managed projects.");
      }
    } finally {
      setIsManagedProjectsLoading(false);
    }
  }, [accessToken]);

  const loadChangeRequests = useCallback(async () => {
    const token = accessToken();
    if (!token) return;
    setIsChangeRequestsLoading(true);
    try {
      setChangeRequests(await getProjectChangeRequests(token));
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setChangeRequests([]);
      } else {
        toast.error("Unable to load project change requests.");
      }
    } finally {
      setIsChangeRequestsLoading(false);
    }
  }, [accessToken]);

  const loadProjectMaster = useCallback(async () => {
    const token = accessToken();
    if (!token) return;
    setIsProjectMasterLoading(true);
    try {
      setProjectMasterProjects(await getProjectMasterProjects(token));
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setProjectMasterProjects([]);
      } else {
        toast.error("Unable to load Project Master.");
      }
    } finally {
      setIsProjectMasterLoading(false);
    }
  }, [accessToken]);

  const loadRequests = useCallback(async (nextPage = page, nextSize = pageSize, nextQuery = query, nextWorkflow = workflowFilter) => {
    const token = accessToken();
    if (!token) return;
    setIsLoading(true);
    try {
      const result = await getProjectRequests(token, nextWorkflow || undefined, nextQuery || undefined, nextPage, nextSize);
      setRequests(result.content);
      setTotalElements(result.totalElements);
      setTotalPages(result.totalPages);
      setPage(result.page);
      setPageSize(result.size);
      setHasLoaded(true);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        toast.error("You are not authorized to view project requests.");
      } else {
        toast.error("Unable to load project requests.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, page, pageSize, query, workflowFilter]);

  const activateProjectTab = useCallback(
      (tab: ProjectTopTab) => {
        if (tab === "raiseProject") {
          setProjectTopTab("raiseProject");
          setActiveTab("requests");
          setRequestTab("raise");
          if (deliveryManagers.length === 0) void loadDeliveryManagers();
          if (projectOwners.length === 0) void loadProjectOwners();
          if (projectDirectors.length === 0) void loadProjectDirectors();
          if (projectManagers.length === 0) void loadProjectManagers();
          return;
        }
        if (tab === "projectTracker") {
          setProjectTopTab("projectTracker");
          setActiveTab("requests");
          setRequestTab("tracker");
          if (!hasLoaded) void loadRequests();
          return;
        }
        if (tab === "manageProjects") {
          setProjectTopTab("manageProjects");
          setActiveTab("management");
          if (canCreate) void loadManagedProjects();
          if (deliveryManagers.length === 0) void loadDeliveryManagers();
          if (projectOwners.length === 0) void loadProjectOwners();
          if (projectDirectors.length === 0) void loadProjectDirectors();
          if (projectManagers.length === 0) void loadProjectManagers();
          return;
        }
        if (tab === "changeTracker") {
          setProjectTopTab("changeTracker");
          setActiveTab("changeTracker");
          if (canUseManageProjects) void loadChangeRequests();
          if (canUseProjectMaster && projectMasterProjects.length === 0) void loadProjectMaster();
          return;
        }
        if (tab === "projectMaster") {
          setProjectTopTab("projectMaster");
          setActiveTab("master");
          if (canUseProjectMaster) void loadProjectMaster();
          return;
        }
        if (tab === "projectAllocation") {
          setProjectTopTab("projectAllocation");
          setActiveTab("allocation");
          setAllocationTab("raise");
          if (allocationProjectOptions.length === 0 || allocationEmployeeOptions.length === 0) void loadAllocationOptions();
          return;
        }
        setProjectTopTab("allocationTracker");
        setActiveTab("allocation");
        setAllocationTab("tracker");
        if (!allocationHasLoaded) void loadAllocations();
      },
      [
        allocationEmployeeOptions.length,
        allocationHasLoaded,
        allocationProjectOptions.length,
        canCreate,
        canUseManageProjects,
        canUseProjectMaster,
        deliveryManagers.length,
        hasLoaded,
        loadAllocationOptions,
        loadAllocations,
        loadChangeRequests,
        loadDeliveryManagers,
        loadManagedProjects,
        loadProjectMaster,
        loadProjectManagers,
        loadProjectDirectors,
        loadProjectOwners,
        loadRequests,
        projectMasterProjects.length,
        projectManagers.length,
        projectDirectors.length,
        projectOwners.length,
      ]
  );

  function validateForm(current: ProjectForm) {
    if (current.projectName.trim().length < 3) return "Project name must be at least 3 characters.";
    if (!/^[A-Z0-9-]{3,30}$/.test(current.projectCode.trim().toUpperCase())) return "Project code must be 3-30 chars (A-Z, 0-9, -).";
    if (!current.clientName.trim()) return "Client name is required.";
    if (!current.projectType) return "Project type is required.";
    if (!current.priority) return "Priority is required.";
    if (!current.plannedStartDate) return "Planned start date is required.";
    if (!current.plannedEndDate) return "Planned end date is required.";
    if (new Date(current.plannedEndDate) < new Date(current.plannedStartDate)) return "Planned end date must be after start date.";
    if (!current.budgetAmount || Number(current.budgetAmount) <= 0) return "Budget amount must be greater than zero.";
    if (!current.currency.trim()) return "Currency is required.";
    if (!current.deliveryManagerUserId) return "Delivery manager is required.";
    if (!current.projectOwnerUserId) return "Project owner is required.";
    if (!current.projectDirectorUserId) return "Project director is required.";
    if (!current.projectManagerUserId) return "Project manager is required.";
    if (!current.projectStatus) return "Project status is required.";
    if (current.description.trim().length < 20) return "Description must be at least 20 characters.";
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = accessToken();
    if (!token) return;
    const message = validateForm(form);
    if (message) {
      toast.error(message);
      return;
    }

    const payload = {
      projectName: form.projectName.trim(),
      projectCode: form.projectCode.trim().toUpperCase(),
      clientName: form.clientName.trim(),
      projectType: form.projectType,
      priority: form.priority,
      plannedStartDate: form.plannedStartDate,
      plannedEndDate: form.plannedEndDate,
      budgetAmount: Number(form.budgetAmount),
      currency: form.currency.trim().toUpperCase(),
      deliveryManagerUserId: Number(form.deliveryManagerUserId),
      projectOwnerUserId: Number(form.projectOwnerUserId),
      projectDirectorUserId: Number(form.projectDirectorUserId),
      projectManagerUserId: Number(form.projectManagerUserId),
      projectStatus: form.projectStatus as ProjectStatus,
      description: form.description.trim(),
      riskNotes: form.riskNotes.trim() || undefined,
      comment: form.comment.trim() || undefined,
    };

    setIsSubmitting(true);
    try {
      if (editingRequestId) {
        await resubmitProjectRequest(token, editingRequestId, payload);
        toast.success("Project request resubmitted.");
        setEditingRequestId(null);
      } else {
        await createProjectRequest(token, payload);
        toast.success("Project request submitted.");
      }
      setForm(initialForm);
      await loadRequests(0, pageSize, query, workflowFilter);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(`Unable to submit request (${error.status}).`);
      } else {
        toast.error("Unable to submit request.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function validateAllocationForm(current: AllocationForm, isEditing: boolean) {
    if (!current.projectRequestId) return "Approved project is required.";
    if (isEditing) {
      if (current.employeeUserIds.length !== 1) return "Select exactly one employee to resubmit the allocation.";
    } else if (current.employeeUserIds.length === 0) {
      return "Select at least one employee.";
    }
    if (!current.allocationType) return "Allocation type is required.";
    if (!current.allocationPercent || Number(current.allocationPercent) <= 0 || Number(current.allocationPercent) > 100) {
      return "Allocation percent must be between 0 and 100.";
    }
    if (!current.startDate || !current.endDate) return "Start and end date are required.";
    if (new Date(current.endDate) < new Date(current.startDate)) return "End date must be on or after start date.";
    return null;
  }

  async function handleAllocationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = accessToken();
    if (!token) return;
    const isEditing = allocationEditingId !== null;
    const message = validateAllocationForm(allocationForm, isEditing);
    if (message) {
      toast.error(message);
      return;
    }

    const createPayload = {
      projectRequestId: Number(allocationForm.projectRequestId),
      employeeUserIds: allocationForm.employeeUserIds.map((id) => Number(id)),
      allocationType: allocationForm.allocationType as ProjectAllocationType,
      allocationPercent: Number(allocationForm.allocationPercent),
      startDate: allocationForm.startDate,
      endDate: allocationForm.endDate,
      comment: allocationForm.comment.trim() || undefined,
    };

    setAllocationIsSubmitting(true);
    try {
      if (allocationEditingId) {
        await resubmitProjectAllocationRequest(token, allocationEditingId, {
          projectRequestId: Number(allocationForm.projectRequestId),
          employeeUserId: Number(allocationForm.employeeUserIds[0]),
          allocationType: allocationForm.allocationType as ProjectAllocationType,
          allocationPercent: Number(allocationForm.allocationPercent),
          startDate: allocationForm.startDate,
          endDate: allocationForm.endDate,
          comment: allocationForm.comment.trim() || undefined,
        });
        toast.success("Allocation resubmitted.");
        setAllocationEditingId(null);
      } else {
        const created = await createProjectAllocationRequest(token, createPayload);
        toast.success(created.length > 1 ? `${created.length} allocations created.` : "Allocation created.");
      }
      setAllocationForm(initialAllocationForm);
      await loadAllocations(0, allocationPageSize, allocationQuery, allocationStatusFilter);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(`Unable to save allocation (${error.status}).`);
      } else {
        toast.error("Unable to save allocation.");
      }
    } finally {
      setAllocationIsSubmitting(false);
    }
  }

  async function submitAllocationAction() {
    if (!selectedAllocation) return;
    const token = accessToken();
    if (!token) return;
    if (!allocationActionComment.trim()) {
      toast.error("Comment is required.");
      return;
    }
    setIsAllocationActioning(true);
    try {
      await takeProjectAllocationAction(token, selectedAllocation.id, {
        decision: allocationActionType,
        comment: allocationActionComment.trim(),
      });
      toast.success(allocationActionType === "APPROVE" ? "Allocation approved." : allocationActionType === "REJECT" ? "Allocation rejected." : "Allocation referred back.");
      setSelectedAllocation(null);
      setAllocationActionComment("");
      await loadAllocations();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(`Action failed (${error.status}).`);
      } else {
        toast.error("Action failed.");
      }
    } finally {
      setIsAllocationActioning(false);
    }
  }

  async function submitBulkAllocationAction() {
    if (selectedPendingAllocations.length === 0) {
      toast.error("Select at least one pending allocation.");
      return;
    }
    const token = accessToken();
    if (!token) return;
    if (!bulkAllocationActionComment.trim()) {
      toast.error("Comment is required.");
      return;
    }
    setIsBulkAllocationActioning(true);
    try {
      await takeAllocationBulkAction(token, {
        allocationIds: selectedPendingAllocations.map((allocation) => allocation.id),
        decision: bulkAllocationActionType,
        comment: bulkAllocationActionComment.trim(),
      });
      toast.success(
          bulkAllocationActionType === "APPROVE"
              ? "Allocations approved."
              : bulkAllocationActionType === "REJECT"
                  ? "Allocations rejected."
                  : "Allocations referred back."
      );
      setSelectedAllocationIds([]);
      setBulkAllocationActionOpen(false);
      setBulkAllocationActionComment("");
      await loadAllocations();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(`Bulk action failed (${error.status}).`);
      } else {
        toast.error("Bulk action failed.");
      }
    } finally {
      setIsBulkAllocationActioning(false);
    }
  }

  function toggleAllocationSelection(allocationId: number) {
    setSelectedAllocationIds((current) =>
        current.includes(allocationId) ? current.filter((id) => id !== allocationId) : [...current, allocationId]
    );
  }

  function toggleAllPendingAllocations() {
    setSelectedAllocationIds((current) =>
        allPendingSelected ? current.filter((id) => !pendingAllocationIds.includes(id)) : Array.from(new Set([...current, ...pendingAllocationIds]))
    );
  }

  async function submitProjectRequestComment(comment: string) {
    if (!commentsRequest) return;
    const token = accessToken();
    if (!token) return;
    setIsCommentingRequest(true);
    try {
      const updated = await addProjectRequestComment(token, commentsRequest.id, { comment });
      setCommentsRequest(updated);
      toast.success("Comment added successfully.");
    } catch {
      toast.error("Unable to add comment.");
    } finally {
      setIsCommentingRequest(false);
    }
  }

  async function submitProjectAllocationComment(comment: string) {
    if (!commentsAllocation) return;
    const token = accessToken();
    if (!token) return;
    setIsCommentingAllocation(true);
    try {
      const updated = await addProjectAllocationComment(token, commentsAllocation.id, { comment });
      setCommentsAllocation(updated);
      toast.success("Comment added successfully.");
    } catch {
      toast.error("Unable to add comment.");
    } finally {
      setIsCommentingAllocation(false);
    }
  }

  function validateManageProjectForm(current: ManageProjectForm) {
    if (current.projectName.trim().length < 3) return "Project name must be at least 3 characters.";
    if (!/^[A-Z0-9-]{3,30}$/.test(current.projectCode.trim().toUpperCase())) return "Project code must be 3-30 chars (A-Z, 0-9, -).";
    if (!current.clientName.trim()) return "Client name is required.";
    if (!current.projectType) return "Project type is required.";
    if (!current.priority) return "Priority is required.";
    if (!current.plannedStartDate) return "Planned start date is required.";
    if (!current.plannedEndDate) return "Planned end date is required.";
    if (new Date(current.plannedEndDate) < new Date(current.plannedStartDate)) return "Planned end date must be after start date.";
    if (!current.budgetAmount || Number(current.budgetAmount) <= 0) return "Budget amount must be greater than zero.";
    if (!current.currency.trim()) return "Currency is required.";
    if (!current.deliveryManagerUserId) return "Delivery manager is required.";
    if (!current.projectOwnerUserId) return "Project owner is required.";
    if (!current.projectDirectorUserId) return "Project director is required.";
    if (!current.projectStatus) return "Project status is required.";
    if (current.description.trim().length < 20) return "Description must be at least 20 characters.";
    if (!current.reason.trim()) return "Reason is required.";
    return null;
  }

  async function submitManagedProjectChange() {
    if (!manageProject) return;
    const token = accessToken();
    if (!token) return;
    const message = validateManageProjectForm(manageProjectForm);
    if (message) {
      toast.error(message);
      return;
    }

    setIsManageProjectSubmitting(true);
    try {
      await createProjectChangeRequest(token, manageProject.id, {
        projectName: manageProjectForm.projectName.trim(),
        projectCode: manageProjectForm.projectCode.trim().toUpperCase(),
        clientName: manageProjectForm.clientName.trim(),
        projectType: manageProjectForm.projectType,
        priority: manageProjectForm.priority,
        plannedStartDate: manageProjectForm.plannedStartDate,
        plannedEndDate: manageProjectForm.plannedEndDate,
        budgetAmount: Number(manageProjectForm.budgetAmount),
        currency: manageProjectForm.currency.trim().toUpperCase(),
        deliveryManagerUserId: Number(manageProjectForm.deliveryManagerUserId),
        projectOwnerUserId: Number(manageProjectForm.projectOwnerUserId),
        projectDirectorUserId: Number(manageProjectForm.projectDirectorUserId),
        projectStatus: manageProjectForm.projectStatus as ProjectStatus,
        description: manageProjectForm.description.trim(),
        riskNotes: manageProjectForm.riskNotes.trim() || undefined,
        reason: manageProjectForm.reason.trim(),
      });
      toast.success("Project change request submitted.");
      setManageProject(null);
      setManageProjectForm(initialManageProjectForm);
      await Promise.all([loadManagedProjects(), loadChangeRequests()]);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(`Unable to submit project changes (${error.status}).`);
      } else {
        toast.error("Unable to submit project changes.");
      }
    } finally {
      setIsManageProjectSubmitting(false);
    }
  }

  async function submitProjectChangeAction() {
    if (!selectedChangeRequest) return;
    const token = accessToken();
    if (!token) return;
    if (!changeActionComment.trim()) {
      toast.error("Comment is required.");
      return;
    }
    setIsChangeActioning(true);
    try {
      await takeProjectChangeRequestAction(token, selectedChangeRequest.id, {
        decision: changeActionType,
        comment: changeActionComment.trim(),
      });
      toast.success(changeActionType === "APPROVE" ? "Project change request approved." : "Project change request rejected.");
      setSelectedChangeRequest(null);
      setChangeActionComment("");
      await Promise.all([loadManagedProjects(), loadChangeRequests()]);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(`Action failed (${error.status}).`);
      } else {
        toast.error("Action failed.");
      }
    } finally {
      setIsChangeActioning(false);
    }
  }

  async function submitProjectChangeComment(comment: string) {
    if (!commentsChangeRequest) return;
    const token = accessToken();
    if (!token) return;
    setIsCommentingChangeRequest(true);
    try {
      const updated = await addProjectChangeRequestComment(token, commentsChangeRequest.id, { comment });
      setCommentsChangeRequest(updated);
      setChangeRequests((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      toast.success("Comment added successfully.");
    } catch {
      toast.error("Unable to add comment.");
    } finally {
      setIsCommentingChangeRequest(false);
    }
  }

  async function submitManageAllocation() {
    if (!manageAllocation) return;
    const token = accessToken();
    if (!token) return;
    if (!manageForm.comment.trim()) {
      toast.error("Comment is required.");
      return;
    }
    setIsSubmitting(true);
    try {
      await manageProjectAllocation(token, manageAllocation.id, {
        action: manageForm.action,
        allocationPercent: manageForm.allocationPercent ? Number(manageForm.allocationPercent) : undefined,
        endDate: manageForm.endDate || undefined,
        comment: manageForm.comment.trim(),
      });
      toast.success("Allocation updated.");
      setManageAllocation(null);
      setManageForm(initialManageForm);
      await loadAllocations();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(`Unable to update allocation (${error.status}).`);
      } else {
        toast.error("Unable to update allocation.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function canTakeAction(request: ProjectRequest) {
    if (request.workflowStage === "PM Submitted") return canDirectorApprove;
    if (request.workflowStage === "Delivery Manager Approved") return canDirectorApprove;
    if (request.workflowStage === "Project Owner Approved") return canDirectorApprove;
    if (request.workflowStage === "Director Approved") return canCtoApprove;
    if (request.workflowStage === "CTO Approved") return canSuperApprove;
    return false;
  }

  function canEditReferBack(request: ProjectRequest) {
    return canCreate && request.workflowStage === "Refer Back" && request.createdByUsername.toLowerCase() === username;
  }

  function canEditAllocationReferBack(allocation: ProjectAllocation) {
    return canCreateAllocation && allocation.status === "Refer Back" && allocation.createdByUsername.toLowerCase() === username;
  }

  function canTakeChangeAction(request: ProjectChangeRequest) {
    if (request.workflowStage === "Pending Director Approval") {
      return canDirectorApprove;
    }
    if (request.workflowStage === "Pending CTO Approval") {
      return canCtoApprove;
    }
    return false;
  }

  async function startEdit(request: ProjectRequest) {
    setActiveTab("requests");
    setProjectTopTab("raiseProject");
    setRequestTab("raise");
    setEditingRequestId(request.id);
    setForm({
      projectName: request.projectName,
      projectCode: request.projectCode,
      clientName: request.clientName,
      projectType: request.projectType,
      priority: request.priority,
      plannedStartDate: request.plannedStartDate,
      plannedEndDate: request.plannedEndDate,
      budgetAmount: String(request.budgetAmount),
      currency: request.currency,
      deliveryManagerUserId: String(request.deliveryManagerUserId),
      projectOwnerUserId: String(request.projectOwnerUserId),
      projectDirectorUserId: request.projectDirectorUserId ? String(request.projectDirectorUserId) : "",
      projectManagerUserId: request.projectManagerUserId ? String(request.projectManagerUserId) : "",
      projectStatus: request.projectStatus,
      description: request.description,
      riskNotes: request.riskNotes ?? "",
      comment: request.referBackComment ?? "",
    });
    if (deliveryManagers.length === 0) {
      await loadDeliveryManagers();
    }
    if (projectOwners.length === 0) {
      await loadProjectOwners();
    }
    if (projectDirectors.length === 0) {
      await loadProjectDirectors();
    }
    if (projectManagers.length === 0) {
      await loadProjectManagers();
    }
  }

  async function startAllocationEdit(allocation: ProjectAllocation) {
    setActiveTab("allocation");
    setProjectTopTab("projectAllocation");
    setAllocationTab("raise");
    setAllocationEditingId(allocation.id);
    setAllocationForm({
      projectRequestId: String(allocation.projectRequestId),
      employeeUserIds: [String(allocation.employeeUserId)],
      allocationType: allocation.allocationType,
      allocationPercent: String(allocation.allocationPercent),
      startDate: allocation.startDate,
      endDate: allocation.endDate,
      comment: allocation.referBackComment ?? "",
    });
    if (allocationProjectOptions.length === 0 || allocationEmployeeOptions.length === 0) {
      await loadAllocationOptions();
    }
  }

  async function startManagedProjectEdit(project: ManagedProject) {
    setActiveTab("management");
    setProjectTopTab("manageProjects");
    setManageProject(project);
    setManageProjectForm({
      projectName: project.projectName,
      projectCode: project.projectCode,
      clientName: project.clientName,
      projectType: project.projectType,
      priority: project.priority,
      plannedStartDate: project.plannedStartDate,
      plannedEndDate: project.plannedEndDate,
      budgetAmount: String(project.budgetAmount),
      currency: project.currency,
      deliveryManagerUserId: String(project.deliveryManagerUserId),
      projectOwnerUserId: String(project.projectOwnerUserId),
      projectDirectorUserId: project.projectDirectorUserId ? String(project.projectDirectorUserId) : "",
      projectStatus: project.projectStatus,
      description: project.description,
      riskNotes: project.riskNotes ?? "",
      reason: "",
    });
    if (deliveryManagers.length === 0) {
      await loadDeliveryManagers();
    }
    if (projectOwners.length === 0) {
      await loadProjectOwners();
    }
    if (projectDirectors.length === 0) {
      await loadProjectDirectors();
    }
  }

  async function submitAction() {
    if (!selectedRequest) return;
    if (!actionComment.trim()) {
      toast.error("Comment is required.");
      return;
    }
    const token = accessToken();
    if (!token) return;
    setIsActioning(true);
    try {
      await takeProjectAction(token, selectedRequest.id, { decision: actionType, comment: actionComment.trim() });
      toast.success(actionType === "APPROVE" ? "Request approved." : actionType === "REJECT" ? "Request rejected." : "Request referred back.");
      setSelectedRequest(null);
      setActionComment("");
      await loadRequests();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(`Action failed (${error.status}).`);
      } else {
        toast.error("Action failed.");
      }
    } finally {
      setIsActioning(false);
    }
  }

  const currentProjectForChangeRequest = viewChangeRequest
      ? projectMasterById.get(viewChangeRequest.projectRequestId)
      : undefined;
  const changeFieldRows = viewChangeRequest
      ? [
        { label: "Project Name", current: currentProjectForChangeRequest?.projectName, requested: viewChangeRequest.projectName },
        { label: "Project Code", current: currentProjectForChangeRequest?.projectCode, requested: viewChangeRequest.projectCode },
        { label: "Client Name", current: currentProjectForChangeRequest?.clientName, requested: viewChangeRequest.clientName },
        { label: "Project Type", current: currentProjectForChangeRequest?.projectType, requested: viewChangeRequest.projectType },
        { label: "Priority", current: currentProjectForChangeRequest?.priority, requested: viewChangeRequest.priority },
        { label: "Project Status", current: currentProjectForChangeRequest?.projectStatus, requested: viewChangeRequest.projectStatus },
        { label: "Planned Start Date", current: currentProjectForChangeRequest?.plannedStartDate, requested: viewChangeRequest.plannedStartDate },
        { label: "Planned End Date", current: currentProjectForChangeRequest?.plannedEndDate, requested: viewChangeRequest.plannedEndDate },
        {
          label: "Budget",
          current: currentProjectForChangeRequest ? formatBudget(currentProjectForChangeRequest.currency, currentProjectForChangeRequest.budgetAmount) : undefined,
          requested: formatBudget(viewChangeRequest.currency, viewChangeRequest.budgetAmount),
        },
        { label: "Delivery Manager", current: currentProjectForChangeRequest?.deliveryManagerName, requested: viewChangeRequest.deliveryManagerName },
        { label: "Project Owner", current: currentProjectForChangeRequest?.projectOwnerName, requested: viewChangeRequest.projectOwnerName },
        { label: "Project Director", current: currentProjectForChangeRequest?.projectDirectorName, requested: viewChangeRequest.projectDirectorName },
        { label: "Description", current: currentProjectForChangeRequest?.description, requested: viewChangeRequest.description },
        { label: "Risk Notes", current: currentProjectForChangeRequest?.riskNotes, requested: viewChangeRequest.riskNotes },
      ].map((item) => {
        const currentValue = normalizeComparisonValue(item.current);
        const requestedValue = normalizeComparisonValue(item.requested);
        return {
          label: item.label,
          current: currentValue,
          requested: requestedValue,
          changed: currentValue !== requestedValue,
        };
      })
      : [];

  return (
      <>
        <div className="mb-5 flex flex-wrap gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm">
          {canCreate ? (
              <Button
                  className={activeProjectTopTab === "raiseProject" ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500" : ""}
                  onClick={() => activateProjectTab("raiseProject")}
                  variant={activeProjectTopTab === "raiseProject" ? "default" : "ghost"}
              >
                Request New Project
              </Button>
          ) : null}
          {canCreate || canViewProjectTrackers ? (
              <Button
                  className={activeProjectTopTab === "projectTracker" ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-500 hover:to-fuchsia-500" : ""}
                  onClick={() => activateProjectTab("projectTracker")}
                  variant={activeProjectTopTab === "projectTracker" ? "default" : "ghost"}
              >
                Track New Project Request
              </Button>
          ) : null}
          {canCreate ? (
              <Button
                  className={activeProjectTopTab === "manageProjects" ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500" : ""}
                  onClick={() => activateProjectTab("manageProjects")}
                  variant={activeProjectTopTab === "manageProjects" ? "default" : "ghost"}
              >
                Change Request (Project Details)
              </Button>
          ) : null}
          {canUseManageProjects ? (
              <Button
                  className={activeProjectTopTab === "changeTracker" ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-500 hover:to-fuchsia-500" : ""}
                  onClick={() => activateProjectTab("changeTracker")}
                  variant={activeProjectTopTab === "changeTracker" ? "default" : "ghost"}
              >
                Track Project Update Request
              </Button>
          ) : null}
          {canUseProjectMaster ? (
              <Button
                  className={activeProjectTopTab === "projectMaster" ? "bg-gradient-to-r from-emerald-700 to-cyan-700 text-white hover:from-emerald-600 hover:to-cyan-600" : ""}
                  onClick={() => activateProjectTab("projectMaster")}
                  variant={activeProjectTopTab === "projectMaster" ? "default" : "ghost"}
              >
                Project Master
              </Button>
          ) : null}
          {canCreateAllocation ? (
              <Button
                  className={activeProjectTopTab === "projectAllocation" ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-500 hover:to-blue-500" : ""}
                  onClick={() => activateProjectTab("projectAllocation")}
                  variant={activeProjectTopTab === "projectAllocation" ? "default" : "ghost"}
              >
                Project Allocation
              </Button>
          ) : null}
          {canCreateAllocation || canManageAllocation ? (
              <Button
                  className={activeProjectTopTab === "allocationTracker" ? "bg-gradient-to-r from-slate-700 to-cyan-700 text-white hover:from-slate-600 hover:to-cyan-600" : ""}
                  onClick={() => activateProjectTab("allocationTracker")}
                  variant={activeProjectTopTab === "allocationTracker" ? "default" : "ghost"}
              >
                Allocation Tracker
              </Button>
          ) : null}
        </div>

        {activeTab === "requests" && requestTab === "raise" && canCreate && (
            <Card className="border-blue-100 shadow-md shadow-blue-100/40">
              <CardHeader className="min-h-[152px] bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                <CardTitle className="flex items-center gap-2 text-white">
                  <PlusCircle className="h-5 w-5" />
                  {editingRequestId ? `Edit & Resubmit #${editingRequestId}` : "Request New Project"}
                </CardTitle>
                <CardDescription className="text-blue-100">All required validations are enforced before submitting for approval.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {!canCreate ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">Only Project Owner can raise or resubmit project requests.</div>
                ) : (
                    <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
                      <Input label="Project Name *" value={form.projectName} onChange={(v) => setForm((s) => ({ ...s, projectName: v }))} />
                      <Input label="Project Code *" value={form.projectCode} onChange={(v) => setForm((s) => ({ ...s, projectCode: v.toUpperCase() }))} />
                      <Input label="Client Name *" value={form.clientName} onChange={(v) => setForm((s) => ({ ...s, clientName: v }))} />
                      <Select label="Project Type *" value={form.projectType} onChange={(v) => setForm((s) => ({ ...s, projectType: v }))}>
                        <option value="">Select project type</option>
                        {projectTypes.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                        ))}
                      </Select>
                      <Select label="Priority *" value={form.priority} onChange={(v) => setForm((s) => ({ ...s, priority: v }))}>
                        <option value="">Select priority</option>
                        {priorities.map((value) => (
                            <option key={value} value={value}>
                              {value}
                            </option>
                        ))}
                      </Select>
                      <Input label="Planned Start Date *" type="date" value={form.plannedStartDate} onChange={(v) => setForm((s) => ({ ...s, plannedStartDate: v }))} />
                      <Input label="Planned End Date *" type="date" value={form.plannedEndDate} onChange={(v) => setForm((s) => ({ ...s, plannedEndDate: v }))} />
                      <Input label="Budget Amount *" type="number" value={form.budgetAmount} onChange={(v) => setForm((s) => ({ ...s, budgetAmount: v }))} />
                      <Input label="Currency *" value={form.currency} onChange={(v) => setForm((s) => ({ ...s, currency: v.toUpperCase() }))} />
                      <Select
                          label="Delivery Manager *"
                          value={form.deliveryManagerUserId}
                          onChange={(v) => setForm((s) => ({ ...s, deliveryManagerUserId: v }))}
                          onFocus={() => {
                            if (deliveryManagers.length === 0) void loadDeliveryManagers();
                          }}
                      >
                        <option value="">Select delivery manager</option>
                        {deliveryManagers.map((manager) => (
                            <option key={manager.id} value={String(manager.id)}>
                              {manager.fullName} ({manager.username})
                            </option>
                        ))}
                      </Select>
                      <Select
                          label="Project Owner *"
                          value={form.projectOwnerUserId}
                          onChange={(v) => setForm((s) => ({ ...s, projectOwnerUserId: v }))}
                          onFocus={() => {
                            if (projectOwners.length === 0) void loadProjectOwners();
                          }}
                      >
                        <option value="">Select project owner</option>
                        {projectOwners.map((owner) => (
                            <option key={owner.id} value={String(owner.id)}>
                              {owner.fullName} ({owner.username})
                            </option>
                        ))}
                      </Select>
                      <Select
                          label="Project Director *"
                          value={form.projectDirectorUserId}
                          onChange={(v) => setForm((s) => ({ ...s, projectDirectorUserId: v }))}
                          onFocus={() => {
                            if (projectDirectors.length === 0) void loadProjectDirectors();
                          }}
                      >
                        <option value="">Select project director</option>
                        {projectDirectors.map((director) => (
                            <option key={director.id} value={String(director.id)}>
                              {director.fullName} ({director.username})
                            </option>
                        ))}
                      </Select>
                      <Select
                          label="Project Manager *"
                          value={form.projectManagerUserId}
                          onChange={(v) => setForm((s) => ({ ...s, projectManagerUserId: v }))}
                          onFocus={() => {
                            if (projectManagers.length === 0) void loadProjectManagers();
                          }}
                      >
                        <option value="">Select project manager</option>
                        {projectManagers.map((manager) => (
                            <option key={manager.id} value={String(manager.id)}>
                              {manager.fullName} ({manager.username})
                            </option>
                        ))}
                      </Select>
                      <Select label="Project Status *" value={form.projectStatus} onChange={(v) => setForm((s) => ({ ...s, projectStatus: v as ProjectStatus | "" }))}>
                        <option value="">Select project status</option>
                        {projectStatuses.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                        ))}
                      </Select>
                      <Textarea className="md:col-span-2" label="Project Description *" value={form.description} onChange={(v) => setForm((s) => ({ ...s, description: v }))} />
                      <Textarea className="md:col-span-2" label="Risk Notes" value={form.riskNotes} onChange={(v) => setForm((s) => ({ ...s, riskNotes: v }))} />
                      <MentionTextareaField className="md:col-span-2" label="Comment" mentionSearch={mentionSearch} value={form.comment} onChange={(v) => setForm((s) => ({ ...s, comment: v }))} />
                      <div className="md:col-span-2 flex justify-end gap-2">
                        {editingRequestId && (
                            <Button
                                onClick={() => {
                                  setEditingRequestId(null);
                                  setForm(initialForm);
                                }}
                                type="button"
                                variant="outline"
                            >
                              Cancel Edit
                            </Button>
                        )}
                        <Button className="min-w-44 gap-2" disabled={isSubmitting} type="submit">
                          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          {isSubmitting ? "Submitting..." : editingRequestId ? "Resubmit Request" : "Submit Request"}
                        </Button>
                      </div>
                    </form>
                )}
              </CardContent>
            </Card>
        )}

        {activeTab === "requests" && requestTab === "tracker" && (
            <Card className="mb-6 shadow-md shadow-zinc-100/80">
              <CardHeader className="flex min-h-[152px] flex-col gap-3 rounded-t-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-white sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <KanbanSquare className="h-5 w-5" />
                    Track New Project Request
                  </CardTitle>
                  <CardDescription className="text-indigo-100">Track workflow status, pending approvers, and full comment history.</CardDescription>
                </div>
                <Button className="gap-2 border-white/30 bg-white/10 text-white hover:bg-white/20" onClick={() => void loadRequests()} variant="outline">
                  <RefreshCcw className="h-4 w-4" />
                  Refresh
                </Button>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="mb-4 grid gap-3 md:grid-cols-3">
                  <Input label="Search (name/code/client)" value={query} onChange={setQuery} />
                  <Select label="Workflow Stage" value={workflowFilter} onChange={setWorkflowFilter}>
                    <option value="">All stages</option>
                    <option value="PM Submitted">PM Submitted</option>
                    <option value="Delivery Manager Approved">Delivery Manager Approved</option>
                    <option value="Project Owner Approved">Project Owner Approved</option>
                    <option value="Director Approved">Director Approved</option>
                    <option value="CTO Approved">CTO Approved</option>
                    <option value="Super Admin Approved">Super Admin Approved</option>
                    <option value="Refer Back">Refer Back</option>
                    <option value="Rejected">Rejected</option>
                  </Select>
                  <div className="flex items-end">
                    <Button
                        className="w-full"
                        onClick={() => {
                          setPage(0);
                          void loadRequests(0, pageSize, query, workflowFilter);
                        }}
                        type="button"
                    >
                      Apply Filters
                    </Button>
                  </div>
                </div>
                {!hasLoaded || isLoading ? (
                    <div className="flex justify-center py-10">
                      <Spinner size="md" />
                    </div>
                ) : requests.length === 0 ? (
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">No project requests available.</div>
                ) : (
                    <>
                      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
                        <table className="w-full min-w-[1080px] text-sm">
                          <thead className="bg-gradient-to-r from-indigo-50 via-violet-50 to-cyan-50 text-left text-zinc-800">
                          <tr>
                            <th className="px-4 py-3 font-medium">Project</th>
                            <th className="px-4 py-3 font-medium">Client & Budget</th>
                            <th className="px-4 py-3 font-medium">Schedule</th>
                            <th className="px-4 py-3 font-medium">Stage</th>
                            <th className="px-4 py-3 font-medium">Pending With</th>
                            <th className="px-4 py-3 font-medium">Actions</th>
                          </tr>
                          </thead>
                          <tbody>
                          {requests.map((request) => (
                              <tr className="border-t border-zinc-200 hover:bg-indigo-50/30" key={request.id}>
                                <td className="px-4 py-3">
                                  <p className="font-semibold text-zinc-900">{request.projectName}</p>
                                  <p className="text-xs text-zinc-600">{request.projectCode}</p>
                                  <p className="text-xs text-zinc-500">Requester: {request.createdByUsername}</p>
                                </td>
                                <td className="px-4 py-3">
                                  <p className="text-sm text-zinc-800">{request.clientName}</p>
                                  <p className="text-xs text-zinc-600">
                                    {request.currency} {Number(request.budgetAmount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                                  </p>
                                  <p className="text-xs text-zinc-500">DM: {request.deliveryManagerName}</p>
                                  <p className="text-xs text-zinc-500">PM: {request.projectManagerName || "-"}</p>
                                </td>
                                <td className="px-4 py-3 text-xs text-zinc-700">
                                  <p>{request.plannedStartDate}</p>
                                  <p>to {request.plannedEndDate}</p>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${stageClass(request.workflowStage)}`}>{request.workflowStage}</span>
                                </td>
                                <td className="px-4 py-3 text-xs text-zinc-700">{pendingWith(request)}</td>
                                <td className="px-4 py-3">
                                  <div className="flex gap-2">
                                    {canViewProjectTrackers ? (
                                        <Button
                                            aria-label={`View request details ${request.id}`}
                                            className="h-9 w-9 rounded-full border-zinc-200 bg-zinc-50 p-0 text-zinc-700 hover:bg-zinc-100"
                                            onClick={() => setViewRequest(request)}
                                            size="sm"
                                            title="View"
                                            variant="outline"
                                        >
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                    ) : null}
                                    <Button
                                        aria-label={`View comments for request ${request.id}`}
                                        className="h-9 w-9 rounded-full border-blue-200 bg-blue-50 p-0 text-blue-700 hover:bg-blue-100"
                                        onClick={() => setCommentsRequest(request)}
                                        size="sm"
                                        title="Comments"
                                        variant="outline"
                                    >
                                      <MessageSquareQuote className="h-4 w-4" />
                                    </Button>
                                    {canTakeAction(request) && (
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
                                    )}
                                    {canEditReferBack(request) && (
                                        <Button
                                            className="h-9 rounded-full border-indigo-200 bg-indigo-50 px-3 text-indigo-700 hover:bg-indigo-100"
                                            onClick={() => void startEdit(request)}
                                            size="sm"
                                            title="Edit"
                                            variant="outline"
                                        >
                                          <PencilLine className="h-4 w-4" />
                                        </Button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                          ))}
                          </tbody>
                        </table>
                      </div>
                      <DataTablePagination
                          page={page}
                          size={pageSize}
                          totalElements={totalElements}
                          totalPages={totalPages}
                          onPageChange={(nextPage) => {
                            setIsLoading(true);
                            void loadRequests(nextPage, pageSize, query, workflowFilter);
                          }}
                          onSizeChange={(nextSize) => {
                            setIsLoading(true);
                            setPage(0);
                            void loadRequests(0, nextSize, query, workflowFilter);
                          }}
                      />
                    </>
                )}
              </CardContent>
            </Card>
        )}

        {activeTab === "management" && canCreate ? (
            <div className="space-y-6">
              <Card className="border-emerald-100 shadow-md shadow-emerald-100/40">
                <CardHeader className="flex min-h-[152px] flex-col gap-3 rounded-t-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <KanbanSquare className="h-5 w-5" />
                      Managed Projects
                    </CardTitle>
                    <CardDescription className="text-emerald-100">Approved projects created by you. Any change will move through Delivery Manager and Project Owner approval.</CardDescription>
                  </div>
                  {canCreate ? (
                      <Button className="gap-2 border-white/30 bg-white/10 text-white hover:bg-white/20" onClick={() => void loadManagedProjects()} variant="outline">
                        <RefreshCcw className="h-4 w-4" />
                        Refresh
                      </Button>
                  ) : null}
                </CardHeader>
                <CardContent className="pt-6">
                  {!canCreate ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                        Only Project Owner can raise project detail changes.
                      </div>
                  ) : isManagedProjectsLoading ? (
                      <div className="flex justify-center py-10">
                        <Spinner size="md" />
                      </div>
                  ) : managedProjects.length === 0 ? (
                      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">No approved projects are available for management.</div>
                  ) : (
                      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
                        <table className="w-full min-w-[1180px] text-sm">
                          <thead className="bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 text-left text-zinc-800">
                          <tr>
                            <th className="px-4 py-3 font-medium">Project</th>
                            <th className="px-4 py-3 font-medium">Owner & Delivery</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Schedule</th>
                            <th className="px-4 py-3 font-medium">Pending Change</th>
                            <th className="px-4 py-3 font-medium">Actions</th>
                          </tr>
                          </thead>
                          <tbody>
                          {managedProjects.map((project) => (
                              <tr className="border-t border-zinc-200 hover:bg-emerald-50/30" key={project.id}>
                                <td className="px-4 py-3">
                                  <p className="font-semibold text-zinc-900">{project.projectName}</p>
                                  <p className="text-xs text-zinc-600">{project.projectCode}</p>
                                  <p className="text-xs text-zinc-500">{project.clientName}</p>
                                </td>
                                <td className="px-4 py-3 text-xs text-zinc-700">
                                  <p>Owner: {project.projectOwnerName}</p>
                                  <p>DM: {project.deliveryManagerName}</p>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${stageClass(project.projectStatus)}`}>{project.projectStatus}</span>
                                </td>
                                <td className="px-4 py-3 text-xs text-zinc-700">
                                  <p>{project.plannedStartDate}</p>
                                  <p>to {project.plannedEndDate}</p>
                                </td>
                                <td className="px-4 py-3 text-xs text-zinc-700">
                                  {project.hasOpenChangeRequest ? project.openChangeRequestStage : "No pending request"}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex gap-2">
                                    <Button
                                        aria-label={`View project comments ${project.id}`}
                                        className="h-9 w-9 rounded-full border-blue-200 bg-blue-50 p-0 text-blue-700 hover:bg-blue-100"
                                        onClick={() => setCommentsManagedProject(project)}
                                        size="sm"
                                        title="Comments"
                                        variant="outline"
                                    >
                                      <MessageSquareQuote className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        className="h-9 rounded-full border-emerald-200 bg-emerald-50 px-3 text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                                        disabled={project.hasOpenChangeRequest}
                                        onClick={() => void startManagedProjectEdit(project)}
                                        size="sm"
                                        title="Edit"
                                        variant="outline"
                                    >
                                      <PencilLine className="h-4 w-4" />
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
            </div>
        ) : null}

        {activeTab === "changeTracker" ? (
            <Card className="shadow-md shadow-zinc-100/80">
              <CardHeader className="flex min-h-[152px] flex-col gap-3 rounded-t-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 text-white sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Bell className="h-5 w-5" />
                    Track Project Update Request
                  </CardTitle>
                  <CardDescription className="text-fuchsia-100">Track submitted project changes and approve them when they reach your stage.</CardDescription>
                </div>
                {canUseManageProjects ? (
                    <Button className="gap-2 border-white/30 bg-white/10 text-white hover:bg-white/20" onClick={() => void loadChangeRequests()} variant="outline">
                      <RefreshCcw className="h-4 w-4" />
                      Refresh
                    </Button>
                ) : null}
              </CardHeader>
              <CardContent className="pt-6">
                {!canUseManageProjects ? (
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">No project change workflow is available for your role.</div>
                ) : isChangeRequestsLoading ? (
                    <div className="flex justify-center py-10">
                      <Spinner size="md" />
                    </div>
                ) : changeRequests.length === 0 ? (
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">No project change requests available.</div>
                ) : (
                    <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
                      <table className="w-full min-w-[1220px] text-sm">
                        <thead className="bg-gradient-to-r from-violet-50 via-fuchsia-50 to-pink-50 text-left text-zinc-800">
                        <tr>
                          <th className="px-4 py-3 font-medium">Project</th>
                          <th className="px-4 py-3 font-medium">Reason</th>
                          <th className="px-4 py-3 font-medium">Owner & Delivery</th>
                          <th className="px-4 py-3 font-medium">Requested Status</th>
                          <th className="px-4 py-3 font-medium">Workflow</th>
                          <th className="px-4 py-3 font-medium">Actions</th>
                        </tr>
                        </thead>
                        <tbody>
                        {changeRequests.map((request) => (
                            <tr className="border-t border-zinc-200 hover:bg-violet-50/30" key={request.id}>
                              <td className="px-4 py-3">
                                <p className="font-semibold text-zinc-900">{request.projectName}</p>
                                <p className="text-xs text-zinc-600">{request.projectCode}</p>
                                <p className="text-xs text-zinc-500">Requested by: {request.createdByUsername}</p>
                              </td>
                              <td className="px-4 py-3 text-xs text-zinc-700">{request.reason}</td>
                              <td className="px-4 py-3 text-xs text-zinc-700">
                                <p>Owner: {request.projectOwnerName}</p>
                                <p>DM: {request.deliveryManagerName}</p>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${stageClass(request.projectStatus)}`}>{request.projectStatus}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${stageClass(request.workflowStage)}`}>{request.workflowStage}</span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex gap-2">
                                  {canViewProjectTrackers ? (
                                      <Button
                                          aria-label={`View project change details ${request.id}`}
                                          className="h-9 w-9 rounded-full border-zinc-200 bg-zinc-50 p-0 text-zinc-700 hover:bg-zinc-100"
                                          onClick={() => setViewChangeRequest(request)}
                                          size="sm"
                                          title="View"
                                          variant="outline"
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                  ) : null}
                                  <Button
                                      aria-label={`View project change comments ${request.id}`}
                                      className="h-9 w-9 rounded-full border-blue-200 bg-blue-50 p-0 text-blue-700 hover:bg-blue-100"
                                      onClick={() => setCommentsChangeRequest(request)}
                                      size="sm"
                                      title="Comments"
                                      variant="outline"
                                  >
                                    <MessageSquareQuote className="h-4 w-4" />
                                  </Button>
                                  {canTakeChangeAction(request) ? (
                                      <>
                                        <Button
                                            className="h-9 rounded-full bg-emerald-600 px-3 text-white hover:bg-emerald-500"
                                            onClick={() => {
                                              setChangeActionType("APPROVE");
                                              setChangeActionComment("");
                                              setSelectedChangeRequest(request);
                                            }}
                                            size="sm"
                                            title="Approve"
                                        >
                                          <CheckCircle2 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            className="h-9 rounded-full border-rose-200 bg-rose-50 px-3 text-rose-700 hover:bg-rose-100"
                                            onClick={() => {
                                              setChangeActionType("REJECT");
                                              setChangeActionComment("");
                                              setSelectedChangeRequest(request);
                                            }}
                                            size="sm"
                                            title="Reject"
                                            variant="outline"
                                        >
                                          <ShieldX className="h-4 w-4" />
                                        </Button>
                                      </>
                                  ) : null}
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
        ) : null}

        {activeTab === "master" ? (
            <Card className="shadow-md shadow-zinc-100/80">
              <CardHeader className="flex min-h-[152px] flex-col gap-3 rounded-t-2xl bg-gradient-to-r from-emerald-700 via-cyan-700 to-blue-700 text-white sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <KanbanSquare className="h-5 w-5" />
                    Project Master
                  </CardTitle>
                  <CardDescription className="text-cyan-100">All approved projects associated with your role.</CardDescription>
                </div>
                <Button className="gap-2 border-white/30 bg-white/10 text-white hover:bg-white/20" onClick={() => void loadProjectMaster()} variant="outline">
                  <RefreshCcw className="h-4 w-4" />
                  Refresh
                </Button>
              </CardHeader>
              <CardContent className="pt-6">
                {isProjectMasterLoading ? (
                    <div className="flex justify-center py-10">
                      <Spinner size="md" />
                    </div>
                ) : projectMasterProjects.length === 0 ? (
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">No associated approved projects found.</div>
                ) : (
                    <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
                      <table className="w-full min-w-[1240px] text-sm">
                        <thead className="bg-gradient-to-r from-emerald-50 via-cyan-50 to-blue-50 text-left text-zinc-800">
                        <tr>
                          <th className="px-4 py-3 font-medium">Project</th>
                          <th className="px-4 py-3 font-medium">Leadership</th>
                          <th className="px-4 py-3 font-medium">Budget & Type</th>
                          <th className="px-4 py-3 font-medium">Schedule</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-4 py-3 font-medium">Action</th>
                        </tr>
                        </thead>
                        <tbody>
                        {projectMasterProjects.map((project) => (
                            <tr className="border-t border-zinc-200 hover:bg-cyan-50/30" key={project.id}>
                              <td className="px-4 py-3">
                                <p className="font-semibold text-zinc-900">{project.projectName}</p>
                                <p className="text-xs text-zinc-600">{project.projectCode}</p>
                                <p className="text-xs text-zinc-500">{project.clientName}</p>
                              </td>
                              <td className="px-4 py-3 text-xs text-zinc-700">
                                <p>Owner: {project.projectOwnerName}</p>
                                <p>Director: {project.projectDirectorName || "-"}</p>
                                <p>Manager: {project.projectManagerName || "-"}</p>
                                <p>Delivery: {project.deliveryManagerName}</p>
                              </td>
                              <td className="px-4 py-3 text-xs text-zinc-700">
                                <p>{project.projectType}</p>
                                <p>{project.priority}</p>
                                <p>
                                  {project.currency} {Number(project.budgetAmount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                                </p>
                              </td>
                              <td className="px-4 py-3 text-xs text-zinc-700">
                                <p>{project.plannedStartDate}</p>
                                <p>to {project.plannedEndDate}</p>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-2">
                                  <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${stageClass(project.projectStatus)}`}>{project.projectStatus}</span>
                                  <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${stageClass(project.workflowStage)}`}>{project.workflowStage}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <Button
                                    aria-label={`View project master details ${project.id}`}
                                    className="h-9 w-9 rounded-full border-zinc-200 bg-zinc-50 p-0 text-zinc-700 hover:bg-zinc-100"
                                    onClick={() => setViewRequest(project)}
                                    size="sm"
                                    title="View"
                                    variant="outline"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
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

        {activeTab === "allocation" ? (
            <>
              {allocationTab === "raise" && canCreateAllocation ? (
                  <Card className="mb-6 border-cyan-100 shadow-md shadow-cyan-100/40">
                    <CardHeader className="min-h-[152px] bg-gradient-to-r from-cyan-600 to-blue-600 text-white">
                      <CardTitle className="flex items-center gap-2 text-white">
                        <PlusCircle className="h-5 w-5" />
                        {allocationEditingId ? `Edit & Resubmit Allocation #${allocationEditingId}` : "Raise Allocation"}
                      </CardTitle>
                      <CardDescription className="text-cyan-100">Choose an approved project, one or more employees, allocation type, and percentage.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <form className="grid gap-4 md:grid-cols-2" onSubmit={handleAllocationSubmit}>
                        <Select
                            label="Approved Project *"
                            value={allocationForm.projectRequestId}
                            onChange={(v) => setAllocationForm((s) => ({ ...s, projectRequestId: v }))}
                            onFocus={() => {
                              if (allocationProjectOptions.length === 0) void loadAllocationOptions();
                            }}
                        >
                          <option value="">Select project</option>
                          {allocationProjectOptions.map((item) => (
                              <option key={item.projectRequestId} value={String(item.projectRequestId)}>
                                {item.projectName} ({item.projectCode})
                              </option>
                          ))}
                        </Select>
                        {allocationEditingId ? (
                            <Select
                                label="Employee *"
                                value={allocationForm.employeeUserIds[0] ?? ""}
                                onChange={(v) => setAllocationForm((s) => ({ ...s, employeeUserIds: v ? [v] : [] }))}
                                onFocus={() => {
                                  if (allocationEmployeeOptions.length === 0) void loadAllocationOptions();
                                }}
                            >
                              <option value="">Select employee</option>
                              {allocationEmployeeOptions.map((item) => (
                                  <option key={item.id} value={String(item.id)}>
                                    {item.fullName} ({item.username}) - {item.roleName}
                                  </option>
                              ))}
                            </Select>
                        ) : (
                            <MultiSelect
                                label="Employees *"
                                value={allocationForm.employeeUserIds}
                                onChange={(value) => setAllocationForm((s) => ({ ...s, employeeUserIds: value }))}
                                options={allocationEmployeeOptions}
                                onFocus={() => {
                                  if (allocationEmployeeOptions.length === 0) void loadAllocationOptions();
                                }}
                            />
                        )}
                        <Select label="Allocation Type *" value={allocationForm.allocationType} onChange={(v) => setAllocationForm((s) => ({ ...s, allocationType: v as ProjectAllocationType | "" }))}>
                          <option value="">Select allocation type</option>
                          <option value="Billable">Billable</option>
                          <option value="Buffer">Buffer</option>
                          <option value="Shadow">Shadow</option>
                          <option value="Training">Training</option>
                          <option value="Internal">Internal</option>
                        </Select>
                        <Input label="Allocation Percent *" type="number" value={allocationForm.allocationPercent} onChange={(v) => setAllocationForm((s) => ({ ...s, allocationPercent: v }))} />
                        <Input label="Start Date *" type="date" value={allocationForm.startDate} onChange={(v) => setAllocationForm((s) => ({ ...s, startDate: v }))} />
                        <Input label="End Date *" type="date" value={allocationForm.endDate} onChange={(v) => setAllocationForm((s) => ({ ...s, endDate: v }))} />
                        <MentionTextareaField className="md:col-span-2" label="Comment" mentionSearch={mentionSearch} value={allocationForm.comment} onChange={(v) => setAllocationForm((s) => ({ ...s, comment: v }))} />
                        <div className="md:col-span-2 flex justify-end gap-2">
                          {allocationEditingId ? (
                              <Button
                                  onClick={() => {
                                    setAllocationEditingId(null);
                                    setAllocationForm(initialAllocationForm);
                                  }}
                                  type="button"
                                  variant="outline"
                              >
                                Cancel Edit
                              </Button>
                          ) : null}
                          <Button className="min-w-44 gap-2" disabled={allocationIsSubmitting} type="submit">
                            {allocationIsSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            {allocationIsSubmitting ? "Saving..." : allocationEditingId ? "Resubmit Allocation" : "Create Allocation"}
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
              ) : null}

              {allocationTab === "tracker" ? (
                  <Card className="mb-6 shadow-md shadow-zinc-100/80">
                    <CardHeader className="flex min-h-[152px] flex-col gap-3 rounded-t-2xl bg-gradient-to-r from-slate-700 via-cyan-700 to-blue-700 text-white sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-white">
                          <KanbanSquare className="h-5 w-5" />
                          Allocation Tracker
                        </CardTitle>
                        <CardDescription className="text-cyan-100">View all allocations, approve pending items, and manage active allocations.</CardDescription>
                      </div>
                      <Button className="gap-2 border-white/30 bg-white/10 text-white hover:bg-white/20" onClick={() => void loadAllocations()} variant="outline">
                        <RefreshCcw className="h-4 w-4" />
                        Refresh
                      </Button>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="mb-4 grid gap-3 md:grid-cols-3">
                        <Input label="Search (project/employee/code)" value={allocationQuery} onChange={setAllocationQuery} />
                        <Select label="Status" value={allocationStatusFilter} onChange={setAllocationStatusFilter}>
                          <option value="">All statuses</option>
                          <option value="Pending DM Approval">Pending DM Approval</option>
                          <option value="Active">Active</option>
                          <option value="Refer Back">Refer Back</option>
                          <option value="Rejected">Rejected</option>
                          <option value="Released">Released</option>
                        </Select>
                        <div className="flex items-end">
                          <Button
                              className="w-full"
                              onClick={() => {
                                setAllocationPage(0);
                                void loadAllocations(0, allocationPageSize, allocationQuery, allocationStatusFilter);
                              }}
                              type="button"
                          >
                            Apply Filters
                          </Button>
                        </div>
                      </div>
                      {canManageAllocation ? (
                          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-cyan-200 bg-cyan-50/60 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                            <label className="flex items-center gap-3 text-sm font-medium text-cyan-950">
                              <input
                                  checked={allPendingSelected}
                                  className="h-5 w-5 rounded border-cyan-300 text-cyan-600 focus:ring-cyan-500"
                                  onChange={toggleAllPendingAllocations}
                                  type="checkbox"
                              />
                              <span>
                        Select all pending on this page
                        <span className="ml-2 text-xs font-normal text-cyan-800">
                          ({selectedPendingAllocations.length} selected)
                        </span>
                      </span>
                            </label>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                  className="gap-2 border-emerald-200 bg-emerald-600 text-white hover:bg-emerald-500"
                                  disabled={selectedPendingAllocations.length === 0}
                                  onClick={() => {
                                    setBulkAllocationActionType("APPROVE");
                                    setBulkAllocationActionComment("");
                                    setBulkAllocationActionOpen(true);
                                  }}
                                  type="button"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                Approve Selected
                              </Button>
                              <Button
                                  className="gap-2 border-violet-200 bg-violet-600 text-white hover:bg-violet-500"
                                  disabled={selectedPendingAllocations.length === 0}
                                  onClick={() => {
                                    setBulkAllocationActionType("REFER_BACK");
                                    setBulkAllocationActionComment("");
                                    setBulkAllocationActionOpen(true);
                                  }}
                                  type="button"
                              >
                                <CornerUpLeft className="h-4 w-4" />
                                Refer Back Selected
                              </Button>
                              <Button
                                  className="gap-2 border-rose-200 bg-rose-600 text-white hover:bg-rose-500"
                                  disabled={selectedPendingAllocations.length === 0}
                                  onClick={() => {
                                    setBulkAllocationActionType("REJECT");
                                    setBulkAllocationActionComment("");
                                    setBulkAllocationActionOpen(true);
                                  }}
                                  type="button"
                              >
                                <ShieldX className="h-4 w-4" />
                                Reject Selected
                              </Button>
                            </div>
                          </div>
                      ) : null}
                      {!allocationHasLoaded || allocationIsLoading ? (
                          <div className="flex justify-center py-10">
                            <Spinner size="md" />
                          </div>
                      ) : allocationRequests.length === 0 ? (
                          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">No allocations available.</div>
                      ) : (
                          <>
                            <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
                              <table className="w-full min-w-[1200px] text-sm">
                                <thead className="bg-gradient-to-r from-cyan-50 via-blue-50 to-indigo-50 text-left text-zinc-800">
                                <tr>
                                  {canManageAllocation ? (
                                      <th className="w-14 px-4 py-3 font-medium">
                                        <input
                                            ref={allocationSelectAllRef}
                                            checked={allPendingSelected}
                                            className="h-5 w-5 rounded border-zinc-300 text-cyan-600 focus:ring-cyan-500"
                                            onChange={toggleAllPendingAllocations}
                                            type="checkbox"
                                        />
                                      </th>
                                  ) : null}
                                  <th className="px-4 py-3 font-medium">Allocation</th>
                                  <th className="px-4 py-3 font-medium">Project & Employee</th>
                                  <th className="px-4 py-3 font-medium">Type & Capacity</th>
                                  <th className="px-4 py-3 font-medium">Schedule</th>
                                  <th className="px-4 py-3 font-medium">Status</th>
                                  <th className="px-4 py-3 font-medium">Actions</th>
                                </tr>
                                </thead>
                                <tbody>
                                {allocationRequests.map((allocation) => (
                                    <tr className="border-t border-zinc-200 hover:bg-cyan-50/30" key={allocation.id}>
                                      {canManageAllocation ? (
                                          <td className="px-4 py-3 align-top">
                                            <input
                                                checked={selectedAllocationIds.includes(allocation.id)}
                                                className="h-5 w-5 rounded border-zinc-300 text-cyan-600 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
                                                disabled={allocation.status !== "Pending DM Approval"}
                                                onChange={() => toggleAllocationSelection(allocation.id)}
                                                type="checkbox"
                                            />
                                          </td>
                                      ) : null}
                                      <td className="px-4 py-3">
                                        <p className="font-semibold text-zinc-900">{allocation.allocationCode}</p>
                                        <p className="text-xs text-zinc-500">By {allocation.createdByUsername}</p>
                                      </td>
                                      <td className="px-4 py-3">
                                        <p className="font-medium text-zinc-900">{allocation.projectName}</p>
                                        <p className="text-xs text-zinc-600">{allocation.projectCode}</p>
                                        <p className="mt-1 text-xs text-zinc-500">
                                          {allocation.employeeName} {allocation.employeeRoleName ? `• ${allocation.employeeRoleName}` : ""}
                                        </p>
                                        <p className="text-xs text-zinc-500">
                                          {allocation.employeeUsername ? `@${allocation.employeeUsername}` : "-"}
                                          {allocation.employeeEmail ? ` • ${allocation.employeeEmail}` : ""}
                                        </p>
                                      </td>
                                      <td className="px-4 py-3">
                                        <p className="text-sm text-zinc-800">{allocation.allocationType}</p>
                                        <p className="text-xs text-zinc-600">{Number(allocation.allocationPercent).toFixed(2)}%</p>
                                      </td>
                                      <td className="px-4 py-3 text-xs text-zinc-700">
                                        <p>{allocation.startDate}</p>
                                        <p>to {allocation.endDate}</p>
                                      </td>
                                      <td className="px-4 py-3">
                                        <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${stageClass(allocation.status)}`}>{allocation.status}</span>
                                        {allocation.status === "Released" ? (
                                            <p className="mt-1 text-[11px] text-zinc-500">Released on {formatReleaseDate(allocation.dmActionAt)}</p>
                                        ) : null}
                                      </td>
                                      <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-2">
                                          <Button
                                              aria-label={`View allocation comments ${allocation.id}`}
                                              className="h-9 w-9 rounded-full border-cyan-200 bg-cyan-50 p-0 text-cyan-700 hover:bg-cyan-100"
                                              onClick={() => setCommentsAllocation(allocation)}
                                              size="sm"
                                              title="Comments"
                                              variant="outline"
                                          >
                                            <MessageSquareQuote className="h-4 w-4" />
                                          </Button>
                                          {canManageAllocation && allocation.status === "Pending DM Approval" ? (
                                              <>
                                                <Button
                                                    className="h-9 rounded-full bg-emerald-600 px-3 text-white hover:bg-emerald-500"
                                                    onClick={() => {
                                                      setAllocationActionType("APPROVE");
                                                      setAllocationActionComment("");
                                                      setSelectedAllocation(allocation);
                                                    }}
                                                    size="sm"
                                                    title="Approve"
                                                >
                                                  <CheckCircle2 className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    className="h-9 rounded-full border-violet-200 bg-violet-50 px-3 text-violet-700 hover:bg-violet-100"
                                                    onClick={() => {
                                                      setAllocationActionType("REFER_BACK");
                                                      setAllocationActionComment("");
                                                      setSelectedAllocation(allocation);
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
                                                      setAllocationActionType("REJECT");
                                                      setAllocationActionComment("");
                                                      setSelectedAllocation(allocation);
                                                    }}
                                                    size="sm"
                                                    title="Reject"
                                                    variant="outline"
                                                >
                                                  <ShieldX className="h-4 w-4" />
                                                </Button>
                                              </>
                                          ) : null}
                                          {canManageAllocation && allocation.status === "Active" ? (
                                              <Button
                                                  className="h-9 rounded-full border-blue-200 bg-blue-50 px-3 text-blue-700 hover:bg-blue-100"
                                                  onClick={() => {
                                                    setManageAllocation(allocation);
                                                    setManageForm({
                                                      action: "EXTEND",
                                                      allocationPercent: String(allocation.allocationPercent),
                                                      endDate: allocation.endDate,
                                                      comment: allocation.dmComment ?? "",
                                                    });
                                                  }}
                                                  size="sm"
                                                  title="Manage"
                                                  variant="outline"
                                              >
                                                Manage
                                              </Button>
                                          ) : null}
                                          {canEditAllocationReferBack(allocation) ? (
                                              <Button
                                                  className="h-9 rounded-full border-indigo-200 bg-indigo-50 px-3 text-indigo-700 hover:bg-indigo-100"
                                                  onClick={() => void startAllocationEdit(allocation)}
                                                  size="sm"
                                                  title="Edit"
                                                  variant="outline"
                                              >
                                                <PencilLine className="h-4 w-4" />
                                              </Button>
                                          ) : null}
                                        </div>
                                      </td>
                                    </tr>
                                ))}
                                </tbody>
                              </table>
                            </div>
                            {canManageAllocation && selectedPendingAllocations.length > 0 ? (
                                <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50/70 px-4 py-3 text-sm text-cyan-950">
                                  {selectedPendingAllocations.length} pending allocation{selectedPendingAllocations.length > 1 ? "s" : ""} selected for bulk action.
                                </div>
                            ) : null}
                            <DataTablePagination
                                page={allocationPage}
                                size={allocationPageSize}
                                totalElements={allocationTotalElements}
                                totalPages={allocationTotalPages}
                                onPageChange={(nextPage) => {
                                  setAllocationIsLoading(true);
                                  void loadAllocations(nextPage, allocationPageSize, allocationQuery, allocationStatusFilter);
                                }}
                                onSizeChange={(nextSize) => {
                                  setAllocationIsLoading(true);
                                  setAllocationPage(0);
                                  void loadAllocations(0, nextSize, allocationQuery, allocationStatusFilter);
                                }}
                            />
                          </>
                      )}
                    </CardContent>
                  </Card>
              ) : null}
            </>
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
                        {actionType === "APPROVE" ? "Approve" : actionType === "REJECT" ? "Reject" : "Refer Back"} project #{selectedRequest.id}
                      </h3>
                      <p className="mt-1 text-sm text-indigo-100">
                        {selectedRequest.projectName} ({selectedRequest.projectCode})
                      </p>
                    </div>
                    <Button className="border-white/30 bg-white/10 text-white hover:bg-white/20" onClick={() => setSelectedRequest(null)} variant="outline">
                      Close
                    </Button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-6">
                  <MentionTextareaField className="min-h-35" label="Action Comment *" mentionSearch={mentionSearch} value={actionComment} onChange={setActionComment} />
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
                        Project Request Details #{viewRequest.id}
                      </h3>
                      <p className="mt-1 text-sm text-indigo-100">
                        {viewRequest.projectName} ({viewRequest.projectCode})
                      </p>
                    </div>
                    <Button className="border-white/30 bg-white/10 text-white hover:bg-white/20" onClick={() => setViewRequest(null)} variant="outline">
                      Close
                    </Button>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${stageClass(viewRequest.projectStatus)}`}>{viewRequest.projectStatus}</span>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${stageClass(viewRequest.workflowStage)}`}>{viewRequest.workflowStage}</span>
                  </div>
                </div>

                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Client</p>
                      <p className="mt-1 font-medium text-zinc-900">{viewRequest.clientName}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Priority</p>
                      <p className="mt-1 font-medium text-zinc-900">{viewRequest.priority}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Project Type</p>
                      <p className="mt-1 font-medium text-zinc-900">{viewRequest.projectType}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Budget</p>
                      <p className="mt-1 font-medium text-zinc-900">
                        {viewRequest.currency} {Number(viewRequest.budgetAmount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Delivery Manager</p>
                      <p className="mt-1 font-medium text-zinc-900">{viewRequest.deliveryManagerName}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Project Owner</p>
                      <p className="mt-1 font-medium text-zinc-900">{viewRequest.projectOwnerName}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Project Director</p>
                      <p className="mt-1 font-medium text-zinc-900">{viewRequest.projectDirectorName || "-"}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Project Manager</p>
                      <p className="mt-1 font-medium text-zinc-900">{viewRequest.projectManagerName || "-"}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Created By</p>
                      <p className="mt-1 font-medium text-zinc-900">{viewRequest.createdByUsername}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Version</p>
                      <p className="mt-1 font-medium text-zinc-900">{viewRequest.version}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Planned Start Date</p>
                      <p className="mt-1 font-medium text-zinc-900">{viewRequest.plannedStartDate}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Planned End Date</p>
                      <p className="mt-1 font-medium text-zinc-900">{viewRequest.plannedEndDate}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Created At</p>
                      <p className="mt-1 font-medium text-zinc-900">{new Date(viewRequest.createdAt).toLocaleString("en-IN")}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Updated At</p>
                      <p className="mt-1 font-medium text-zinc-900">{new Date(viewRequest.updatedAt).toLocaleString("en-IN")}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Project Owner User ID</p>
                      <p className="mt-1 font-medium text-zinc-900">{viewRequest.projectOwnerUserId}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Delivery Manager User ID</p>
                      <p className="mt-1 font-medium text-zinc-900">{viewRequest.deliveryManagerUserId}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Project Director User ID</p>
                      <p className="mt-1 font-medium text-zinc-900">{viewRequest.projectDirectorUserId ?? "-"}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Project Manager User ID</p>
                      <p className="mt-1 font-medium text-zinc-900">{viewRequest.projectManagerUserId ?? "-"}</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-900">Description</p>
                    <p className="mt-1 whitespace-pre-wrap">{viewRequest.description}</p>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-900">Risk Notes</p>
                    <p className="mt-1 whitespace-pre-wrap">{viewRequest.riskNotes || "-"}</p>
                  </div>
                  {(viewRequest.referBackBy || viewRequest.referBackComment || viewRequest.referBackStage || viewRequest.referBackAt) ? (
                      <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900">
                        <p className="font-semibold">Refer Back Details</p>
                        <p className="mt-1">By: {viewRequest.referBackBy || "-"}</p>
                        <p className="mt-1">Stage: {viewRequest.referBackStage || "-"}</p>
                        <p className="mt-1">At: {viewRequest.referBackAt ? new Date(viewRequest.referBackAt).toLocaleString("en-IN") : "-"}</p>
                        <p className="mt-1 whitespace-pre-wrap">Comment: {viewRequest.referBackComment || "-"}</p>
                      </div>
                  ) : null}
                </div>
              </div>
            </div>
        ) : null}

        {bulkAllocationActionOpen ? (
            <div
                className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/45 backdrop-blur-sm"
                onClick={(event) => {
                  if (event.target === event.currentTarget) {
                    setBulkAllocationActionOpen(false);
                    setBulkAllocationActionComment("");
                  }
                }}
            >
              <div className="ml-auto flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-white/50 bg-white shadow-2xl shadow-slate-300/40">
                <div className="border-b border-zinc-200 bg-linear-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-6 py-5 text-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold text-white">
                        {bulkAllocationActionType === "APPROVE" ? "Approve" : bulkAllocationActionType === "REJECT" ? "Reject" : "Refer Back"} selected allocations
                      </h3>
                      <p className="mt-1 text-sm text-indigo-100">
                        {selectedPendingAllocations.length} pending allocation{selectedPendingAllocations.length > 1 ? "s" : ""} will be updated.
                      </p>
                    </div>
                    <Button
                        className="border-white/30 bg-white/10 text-white hover:bg-white/20"
                        onClick={() => {
                          setBulkAllocationActionOpen(false);
                          setBulkAllocationActionComment("");
                        }}
                        variant="outline"
                    >
                      Close
                    </Button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-6">
                  <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
                    {selectedPendingAllocations.map((allocation) => (
                        <div className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2" key={allocation.id}>
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{allocation.allocationCode}</span>
                          <span className="block truncate text-xs text-zinc-500">
                            {allocation.projectName} • {allocation.employeeName}
                          </span>
                        </span>
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${stageClass(allocation.status)}`}>
                          {allocation.status}
                        </span>
                        </div>
                    ))}
                  </div>
                  <MentionTextareaField className="mt-4 min-h-35" label="Action Comment *" mentionSearch={mentionSearch} value={bulkAllocationActionComment} onChange={setBulkAllocationActionComment} />
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-6 py-4">
                  <Button
                      onClick={() => {
                        setBulkAllocationActionOpen(false);
                        setBulkAllocationActionComment("");
                      }}
                      variant="outline"
                  >
                    Cancel
                  </Button>
                  <Button className="gap-2" disabled={isBulkAllocationActioning} onClick={() => void submitBulkAllocationAction()}>
                    {isBulkAllocationActioning ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
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
                    commentsRequest.workflowStage !== "Rejected"
                }
                isSendingComment={isCommentingRequest}
                mentionSearchAction={mentionSearch}
                onSendCommentAction={(comment) => submitProjectRequestComment(comment)}
                onCloseAction={() => setCommentsRequest(null)}
                subtitle={`Request #${commentsRequest.id}`}
                title={`Project comments: ${commentsRequest.projectName}`}
            />
        ) : null}

        {commentsManagedProject ? (
            <CommentsConversationModal
                items={commentsManagedProject.approvalTrail}
                canSendComment={false}
                isSendingComment={false}
                onCloseAction={() => setCommentsManagedProject(null)}
                subtitle={`Project #${commentsManagedProject.projectCode}`}
                title={`Project comments: ${commentsManagedProject.projectName}`}
            />
        ) : null}

        {manageProject ? (
            <div
                className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/45 backdrop-blur-sm"
                onClick={(event) => {
                  if (event.target === event.currentTarget) {
                    setManageProject(null);
                    setManageProjectForm(initialManageProjectForm);
                  }
                }}
            >
              <div className="ml-auto flex h-full w-full max-w-4xl flex-col overflow-hidden border-l border-white/50 bg-white shadow-2xl shadow-slate-300/40">
                <div className="border-b border-zinc-200 bg-linear-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-6 py-5 text-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold text-white">Manage project #{manageProject.projectCode}</h3>
                      <p className="mt-1 text-sm text-indigo-100">
                        Update the details below. Changes will move to Director and then CTO approval.
                      </p>
                    </div>
                    <Button
                        className="border-white/30 bg-white/10 text-white hover:bg-white/20"
                        onClick={() => {
                          setManageProject(null);
                          setManageProjectForm(initialManageProjectForm);
                        }}
                        variant="outline"
                    >
                      Close
                    </Button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input label="Project Name *" value={manageProjectForm.projectName} onChange={(v) => setManageProjectForm((s) => ({ ...s, projectName: v }))} />
                    <Input label="Project Code *" value={manageProjectForm.projectCode} onChange={(v) => setManageProjectForm((s) => ({ ...s, projectCode: v.toUpperCase() }))} />
                    <Input label="Client Name *" value={manageProjectForm.clientName} onChange={(v) => setManageProjectForm((s) => ({ ...s, clientName: v }))} />
                    <Select label="Project Type *" value={manageProjectForm.projectType} onChange={(v) => setManageProjectForm((s) => ({ ...s, projectType: v }))}>
                      <option value="">Select project type</option>
                      {projectTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                      ))}
                    </Select>
                    <Select label="Priority *" value={manageProjectForm.priority} onChange={(v) => setManageProjectForm((s) => ({ ...s, priority: v }))}>
                      <option value="">Select priority</option>
                      {priorities.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                      ))}
                    </Select>
                    <Select label="Project Status *" value={manageProjectForm.projectStatus} onChange={(v) => setManageProjectForm((s) => ({ ...s, projectStatus: v as ProjectStatus | "" }))}>
                      <option value="">Select project status</option>
                      {projectStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                      ))}
                    </Select>
                    <Input label="Planned Start Date *" type="date" value={manageProjectForm.plannedStartDate} onChange={(v) => setManageProjectForm((s) => ({ ...s, plannedStartDate: v }))} />
                    <Input label="Planned End Date *" type="date" value={manageProjectForm.plannedEndDate} onChange={(v) => setManageProjectForm((s) => ({ ...s, plannedEndDate: v }))} />
                    <Input label="Budget Amount *" type="number" value={manageProjectForm.budgetAmount} onChange={(v) => setManageProjectForm((s) => ({ ...s, budgetAmount: v }))} />
                    <Input label="Currency *" value={manageProjectForm.currency} onChange={(v) => setManageProjectForm((s) => ({ ...s, currency: v.toUpperCase() }))} />
                    <Select
                        label="Delivery Manager *"
                        value={manageProjectForm.deliveryManagerUserId}
                        onChange={(v) => setManageProjectForm((s) => ({ ...s, deliveryManagerUserId: v }))}
                        onFocus={() => {
                          if (deliveryManagers.length === 0) void loadDeliveryManagers();
                        }}
                    >
                      <option value="">Select delivery manager</option>
                      {deliveryManagers.map((manager) => (
                          <option key={manager.id} value={String(manager.id)}>
                            {manager.fullName} ({manager.username})
                          </option>
                      ))}
                    </Select>
                    <Select
                        label="Project Owner * (Editable)"
                        value={manageProjectForm.projectOwnerUserId}
                        onChange={(v) => setManageProjectForm((s) => ({ ...s, projectOwnerUserId: v }))}
                        onFocus={() => {
                          if (projectOwners.length === 0) void loadProjectOwners();
                        }}
                    >
                      <option value="">Select project owner</option>
                      {projectOwners.map((owner) => (
                          <option key={owner.id} value={String(owner.id)}>
                            {owner.fullName} ({owner.username})
                          </option>
                      ))}
                    </Select>
                    <Select
                        label="Project Director * (Editable)"
                        value={manageProjectForm.projectDirectorUserId}
                        onChange={(v) => setManageProjectForm((s) => ({ ...s, projectDirectorUserId: v }))}
                        onFocus={() => {
                          if (projectDirectors.length === 0) void loadProjectDirectors();
                        }}
                    >
                      <option value="">Select project director</option>
                      {projectDirectors.map((director) => (
                          <option key={director.id} value={String(director.id)}>
                            {director.fullName} ({director.username})
                          </option>
                      ))}
                    </Select>
                    <Textarea className="md:col-span-2" label="Project Description *" value={manageProjectForm.description} onChange={(v) => setManageProjectForm((s) => ({ ...s, description: v }))} />
                    <Textarea className="md:col-span-2" label="Risk Notes" value={manageProjectForm.riskNotes} onChange={(v) => setManageProjectForm((s) => ({ ...s, riskNotes: v }))} />
                    <Textarea className="md:col-span-2" label="Reason for change *" value={manageProjectForm.reason} onChange={(v) => setManageProjectForm((s) => ({ ...s, reason: v }))} />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-6 py-4">
                  <Button
                      onClick={() => {
                        setManageProject(null);
                        setManageProjectForm(initialManageProjectForm);
                      }}
                      variant="outline"
                  >
                    Cancel
                  </Button>
                  <Button className="gap-2" disabled={isManageProjectSubmitting} onClick={() => void submitManagedProjectChange()}>
                    {isManageProjectSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Submit for approval
                  </Button>
                </div>
              </div>
            </div>
        ) : null}

        {selectedChangeRequest ? (
            <div
                className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/45 backdrop-blur-sm"
                onClick={(event) => {
                  if (event.target === event.currentTarget) {
                    setSelectedChangeRequest(null);
                  }
                }}
            >
              <div className="ml-auto flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-white/50 bg-white shadow-2xl shadow-slate-300/40">
                <div className="border-b border-zinc-200 bg-linear-to-r from-fuchsia-600 via-violet-600 to-indigo-600 px-6 py-5 text-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold text-white">
                        {changeActionType === "APPROVE" ? "Approve" : "Reject"} project change #{selectedChangeRequest.id}
                      </h3>
                      <p className="mt-1 text-sm text-fuchsia-100">
                        {selectedChangeRequest.projectName} ({selectedChangeRequest.projectCode})
                      </p>
                    </div>
                    <Button className="border-white/30 bg-white/10 text-white hover:bg-white/20" onClick={() => setSelectedChangeRequest(null)} variant="outline">
                      Close
                    </Button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-6">
                  <MentionTextareaField className="min-h-35" label="Action Comment *" mentionSearch={mentionSearch} value={changeActionComment} onChange={setChangeActionComment} />
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-6 py-4">
                  <Button onClick={() => setSelectedChangeRequest(null)} variant="outline">
                    Cancel
                  </Button>
                  <Button className="gap-2" disabled={isChangeActioning} onClick={() => void submitProjectChangeAction()}>
                    {isChangeActioning ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Submit
                  </Button>
                </div>
              </div>
            </div>
        ) : null}

        {viewChangeRequest ? (
            <div
                className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/45 backdrop-blur-sm"
                onClick={(event) => {
                  if (event.target === event.currentTarget) {
                    setViewChangeRequest(null);
                  }
                }}
            >
              <div className="ml-auto flex h-full w-full max-w-4xl flex-col overflow-hidden border-l border-white/50 bg-white shadow-2xl shadow-slate-300/40">
                <div className="border-b border-zinc-200 bg-linear-to-r from-fuchsia-600 via-violet-600 to-indigo-600 px-6 py-5 text-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="flex items-center gap-2 text-xl font-semibold">
                        <Eye className="h-5 w-5" />
                        Project Change Request Details #{viewChangeRequest.id}
                      </h3>
                      <p className="mt-1 text-sm text-fuchsia-100">
                        {viewChangeRequest.projectName} ({viewChangeRequest.projectCode})
                      </p>
                    </div>
                    <Button className="border-white/30 bg-white/10 text-white hover:bg-white/20" onClick={() => setViewChangeRequest(null)} variant="outline">
                      Close
                    </Button>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${stageClass(viewChangeRequest.projectStatus)}`}>{viewChangeRequest.projectStatus}</span>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${stageClass(viewChangeRequest.workflowStage)}`}>{viewChangeRequest.workflowStage}</span>
                  </div>
                </div>

                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Client</p>
                      <p className="mt-1 font-medium text-zinc-900">{viewChangeRequest.clientName}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Priority</p>
                      <p className="mt-1 font-medium text-zinc-900">{viewChangeRequest.priority}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Project Type</p>
                      <p className="mt-1 font-medium text-zinc-900">{viewChangeRequest.projectType}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Budget</p>
                      <p className="mt-1 font-medium text-zinc-900">
                        {viewChangeRequest.currency} {Number(viewChangeRequest.budgetAmount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Delivery Manager</p>
                      <p className="mt-1 font-medium text-zinc-900">{viewChangeRequest.deliveryManagerName}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Project Owner</p>
                      <p className="mt-1 font-medium text-zinc-900">{viewChangeRequest.projectOwnerName}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Project Director</p>
                      <p className="mt-1 font-medium text-zinc-900">{viewChangeRequest.projectDirectorName || "-"}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Planned Start Date</p>
                      <p className="mt-1 font-medium text-zinc-900">{viewChangeRequest.plannedStartDate}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Planned End Date</p>
                      <p className="mt-1 font-medium text-zinc-900">{viewChangeRequest.plannedEndDate}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Created By</p>
                      <p className="mt-1 font-medium text-zinc-900">{viewChangeRequest.createdByUsername}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Version</p>
                      <p className="mt-1 font-medium text-zinc-900">{viewChangeRequest.version}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Created At</p>
                      <p className="mt-1 font-medium text-zinc-900">{new Date(viewChangeRequest.createdAt).toLocaleString("en-IN")}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Updated At</p>
                      <p className="mt-1 font-medium text-zinc-900">{new Date(viewChangeRequest.updatedAt).toLocaleString("en-IN")}</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
                    <p className="font-semibold text-cyan-900">Updated fields (current vs requested)</p>
                    {!currentProjectForChangeRequest ? (
                        <p className="mt-2 text-sm text-cyan-800">
                          Current approved project snapshot is unavailable. Open Project Master once to load baseline values.
                        </p>
                    ) : (
                        <div className="mt-3 space-y-2">
                          {changeFieldRows.map((row) => (
                              <div
                                  className={`rounded-xl border p-3 text-sm ${
                                      row.changed ? "border-amber-200 bg-amber-50" : "border-zinc-200 bg-white"
                                  }`}
                                  key={row.label}
                              >
                                <p className="font-semibold text-zinc-900">{row.label}</p>
                                <p className="mt-1 text-xs text-zinc-600">Current: {row.current}</p>
                                <p className={`mt-1 text-xs ${row.changed ? "font-semibold text-amber-800" : "text-zinc-600"}`}>Requested: {row.requested}</p>
                              </div>
                          ))}
                        </div>
                    )}
                  </div>
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <p className="font-semibold">Reason</p>
                    <p className="mt-1 whitespace-pre-wrap">{viewChangeRequest.reason}</p>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-900">Description</p>
                    <p className="mt-1 whitespace-pre-wrap">{viewChangeRequest.description}</p>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-900">Risk Notes</p>
                    <p className="mt-1 whitespace-pre-wrap">{viewChangeRequest.riskNotes || "-"}</p>
                  </div>
                </div>
              </div>
            </div>
        ) : null}

        {selectedAllocation ? (
            <div
                className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/45 backdrop-blur-sm"
                onClick={(event) => {
                  if (event.target === event.currentTarget) {
                    setSelectedAllocation(null);
                  }
                }}
            >
              <div className="ml-auto flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-white/50 bg-white shadow-2xl shadow-slate-300/40">
                <div className="border-b border-zinc-200 bg-linear-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-6 py-5 text-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold text-white">
                        {allocationActionType === "APPROVE" ? "Approve" : allocationActionType === "REJECT" ? "Reject" : "Refer Back"} allocation #{selectedAllocation.id}
                      </h3>
                      <p className="mt-1 text-sm text-indigo-100">
                        {selectedAllocation.projectName} ({selectedAllocation.allocationCode})
                      </p>
                    </div>
                    <Button className="border-white/30 bg-white/10 text-white hover:bg-white/20" onClick={() => setSelectedAllocation(null)} variant="outline">
                      Close
                    </Button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-6">
                  <MentionTextareaField
                      className="min-h-35"
                      label="Action Comment *"
                      mentionSearch={mentionSearch}
                      value={allocationActionComment}
                      onChange={setAllocationActionComment}
                  />
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-6 py-4">
                  <Button onClick={() => setSelectedAllocation(null)} variant="outline">
                    Cancel
                  </Button>
                  <Button className="gap-2" disabled={isAllocationActioning} onClick={() => void submitAllocationAction()}>
                    {isAllocationActioning ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Submit
                  </Button>
                </div>
              </div>
            </div>
        ) : null}

        {manageAllocation ? (
            <div
                className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/45 backdrop-blur-sm"
                onClick={(event) => {
                  if (event.target === event.currentTarget) {
                    setManageAllocation(null);
                    setManageForm(initialManageForm);
                  }
                }}
            >
              <div className="ml-auto flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-white/50 bg-white shadow-2xl shadow-slate-300/40">
                <div className="border-b border-zinc-200 bg-linear-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-6 py-5 text-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold text-white">Manage allocation #{manageAllocation.id}</h3>
                      <p className="mt-1 text-sm text-indigo-100">
                        {manageAllocation.projectName} • {manageAllocation.employeeName}
                      </p>
                    </div>
                    <Button
                        className="border-white/30 bg-white/10 text-white hover:bg-white/20"
                        onClick={() => {
                          setManageAllocation(null);
                          setManageForm(initialManageForm);
                        }}
                        variant="outline"
                    >
                      Close
                    </Button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-6">
                  <Select
                      label="Manage Action"
                      value={manageForm.action}
                      onChange={(v) => setManageForm((s) => ({ ...s, action: v as AllocationManageForm["action"] }))}
                  >
                    <option value="EXTEND">Extend</option>
                    <option value="REDUCE">Reduce</option>
                    <option value="RELEASE">Release</option>
                  </Select>
                  {manageForm.action !== "RELEASE" ? (
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <Input
                            label={manageForm.action === "EXTEND" ? "New End Date *" : "New End Date"}
                            type="date"
                            value={manageForm.endDate}
                            onChange={(v) => setManageForm((s) => ({ ...s, endDate: v }))}
                        />
                        <Input
                            label={manageForm.action === "REDUCE" ? "New Allocation Percent *" : "Allocation Percent"}
                            type="number"
                            value={manageForm.allocationPercent}
                            onChange={(v) => setManageForm((s) => ({ ...s, allocationPercent: v }))}
                        />
                      </div>
                  ) : null}
                  <Textarea
                      className="mt-4"
                      label="Manage Comment *"
                      value={manageForm.comment}
                      onChange={(v) => setManageForm((s) => ({ ...s, comment: v }))}
                  />
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-6 py-4">
                  <Button
                      onClick={() => {
                        setManageAllocation(null);
                        setManageForm(initialManageForm);
                      }}
                      variant="outline"
                  >
                    Cancel
                  </Button>
                  <Button className="gap-2" disabled={isSubmitting} onClick={() => void submitManageAllocation()}>
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Save
                  </Button>
                </div>
              </div>
            </div>
        ) : null}

        {commentsAllocation ? (
            <CommentsConversationModal
                items={commentsAllocation.approvalTrail}
                canSendComment={commentsAllocation.status !== "Released" && commentsAllocation.status !== "Rejected"}
                isSendingComment={isCommentingAllocation}
                onSendCommentAction={(comment) => submitProjectAllocationComment(comment)}
                onCloseAction={() => setCommentsAllocation(null)}
                subtitle={`Allocation #${commentsAllocation.allocationCode}`}
                title={`Allocation comments: ${commentsAllocation.projectName}`}
            />
        ) : null}

        {commentsChangeRequest ? (
            <CommentsConversationModal
                items={commentsChangeRequest.approvalTrail}
                canSendComment={commentsChangeRequest.workflowStage !== "Approved" && commentsChangeRequest.workflowStage !== "Rejected"}
                isSendingComment={isCommentingChangeRequest}
                onSendCommentAction={(comment) => submitProjectChangeComment(comment)}
                onCloseAction={() => setCommentsChangeRequest(null)}
                subtitle={`Change Request #${commentsChangeRequest.id}`}
                title={`Project change comments: ${commentsChangeRequest.projectName}`}
            />
        ) : null}

      </>
  );
}

function Input({
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
  const [isFocused, setIsFocused] = useState(false);
  const isFloating = isFocused || value.length > 0;
  const isDateField = type === "date";

  return (
      <div className={`relative ${className}`}>
        <input
            className="peer h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 pt-4 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder=" "
            type={type}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
        />
        <label
            className={`pointer-events-none absolute left-3 bg-white px-1 ${
                isDateField
                    ? "-top-2 text-xs text-zinc-500"
                    : `text-zinc-500 transition-all duration-150 ${isFloating ? "-top-2 text-xs text-blue-600" : "top-3 text-sm"}`
            }`}
        >
          {label}
        </label>
      </div>
  );
}

function Select({
                  label,
                  value,
                  onChange,
                  className = "",
                  children,
                  onFocus,
                }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  children: ReactNode;
  onFocus?: () => void;
}) {
  return (
      <label className={`relative block ${className}`}>
        <span className="pointer-events-none absolute left-3 -top-2 z-10 bg-white px-1 text-xs text-zinc-500">{label}</span>
        <select
            className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 pb-1 pt-4 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onFocus={onFocus}
        >
          {children}
        </select>
      </label>
  );
}

function MultiSelect({
                       label,
                       value,
                       onChange,
                       options,
                       className = "",
                       onFocus,
                     }: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  options: ProjectAllocationEmployeeOption[];
  className?: string;
  onFocus?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleDocumentMouseDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleDocumentMouseDown);
    return () => document.removeEventListener("mousedown", handleDocumentMouseDown);
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return options;
    }
    return options.filter((option) => {
      const haystack = `${option.fullName} ${option.username} ${option.roleName}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [options, search]);

  const selectedLabels = useMemo(() => {
    const selected = new Set(value);
    return options.filter((option) => selected.has(option.id.toString())).map((option) => `${option.fullName} (${option.username}) - ${option.roleName}`);
  }, [options, value]);

  const filteredIds = useMemo(() => filteredOptions.map((option) => String(option.id)), [filteredOptions]);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => value.includes(id));
  const someFilteredSelected = filteredIds.some((id) => value.includes(id));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someFilteredSelected && !allFilteredSelected;
    }
  }, [allFilteredSelected, someFilteredSelected]);

  const displayText =
      selectedLabels.length === 0
          ? "Select employees"
          : selectedLabels.length <= 2
              ? selectedLabels.join(", ")
              : `${selectedLabels.slice(0, 2).join(", ")} + ${selectedLabels.length - 2} more`;

  const toggleEmployee = (employeeId: string) => {
    const next = new Set(value);
    if (next.has(employeeId)) {
      next.delete(employeeId);
    } else {
      next.add(employeeId);
    }
    onChange(Array.from(next));
  };

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      onChange(value.filter((employeeId) => !filteredIds.includes(employeeId)));
      return;
    }
    const next = new Set(value);
    filteredIds.forEach((employeeId) => next.add(employeeId));
    onChange(Array.from(next));
  };

  return (
      <div ref={containerRef} className={`relative block ${className}`}>
        <span className="pointer-events-none absolute left-3 -top-2 z-10 bg-white px-1 text-xs text-zinc-500">{label}</span>
        <button
            className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-zinc-300 bg-white px-3 py-3 text-left text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            onClick={() => {
              setIsOpen((current) => {
                const next = !current;
                if (!next) {
                  setSearch("");
                }
                return next;
              });
              onFocus?.();
            }}
            type="button"
        >
          <span className={`block min-w-0 flex-1 truncate ${selectedLabels.length === 0 ? "text-zinc-500" : "text-zinc-900"}`}>{displayText}</span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {isOpen ? (
            <div className="absolute z-30 mt-2 max-h-72 w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
              <div className="space-y-2 p-2">
                <input
                    className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    onChange={(event) => setSearch(event.target.value)}
                    onFocus={onFocus}
                    placeholder="Search employees..."
                    value={search}
                />

                <label
                    className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                        allFilteredSelected || someFilteredSelected ? "bg-cyan-50 text-cyan-900" : "hover:bg-zinc-50 text-zinc-800"
                    }`}
                >
                  <input
                      ref={selectAllRef}
                      checked={allFilteredSelected}
                      className="h-5 w-5 rounded border-zinc-300 text-cyan-600 focus:ring-cyan-500"
                      onChange={toggleSelectAll}
                      type="checkbox"
                  />
                  <span className="min-w-0 font-medium">Select all</span>
                </label>

                <div className="max-h-56 overflow-y-auto">
                  {filteredOptions.length === 0 ? (
                      <div className="rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-500">No employees match your search.</div>
                  ) : (
                      filteredOptions.map((option) => {
                        const checked = value.includes(String(option.id));
                        return (
                            <button
                                key={option.id}
                                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                                    checked ? "bg-cyan-50 text-cyan-900" : "hover:bg-zinc-50 text-zinc-800"
                                }`}
                                onClick={() => toggleEmployee(String(option.id))}
                                type="button"
                            >
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                              checked ? "border-cyan-600 bg-cyan-600 text-white" : "border-zinc-300 bg-white"
                          }`}
                      >
                        {checked ? <Check className="h-3.5 w-3.5" /> : null}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{option.fullName}</span>
                        <span className="block truncate text-xs text-zinc-500">
                          {option.username} - {option.roleName}
                        </span>
                      </span>
                    </span>
                            </button>
                        );
                      })
                  )}
                </div>
              </div>
            </div>
        ) : null}
      </div>
  );
}

function Textarea({
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
  const [isFocused, setIsFocused] = useState(false);
  const isFloating = isFocused || value.length > 0;

  return (
      <div className={`relative ${className}`}>
      <textarea
          className="peer h-28 w-full rounded-xl border border-zinc-300 bg-white px-3 pt-5 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          placeholder=" "
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
      />
        <label
            className={`pointer-events-none absolute left-3 bg-white px-1 text-zinc-500 transition-all duration-150 ${
                isFloating ? "-top-2 text-xs text-blue-600" : "top-3.5 text-sm"
            }`}
        >
          {label}
        </label>
      </div>
  );
}
