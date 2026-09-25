export type LoginRequest = {
  username: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
  tokenType: string;
  expiresInMs: number;
  username: string;
  roles: string[];
};

export type UserProfile = {
  id: number;
  username: string;
  email: string;
  fullName: string;
  designation: string;
  reportingManagerFullName: string | null;
  reportingManagerRoleName: string | null;
  roles: string[];
  currentProjects: SelfProjectAssignment[];
  personalEmailAddress: string | null;
  phoneNumber: string | null;
  educationQualification: string | null;
  bankDetailsEditWindowOpen: boolean;
  bankDetailsEditWindowMessage: string | null;
};

export type UserProfileUpdateRequest = {
  personalEmailAddress: string | null;
  phoneNumber: string | null;
  educationQualification: string | null;
};

export type BankAccountType = "SAVINGS" | "CURRENT";

export type BankDetails = {
  id: number;
  accountHolderName: string;
  bankName: string;
  maskedAccountNumber: string;
  ifscCode: string;
  branchName: string;
  accountType: string;
  updatedAt: string;
  editWindowOpen: boolean;
  editWindowMessage: string | null;
};

export type BankDetailsUpsertRequest = {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifscCode: string;
  branchName: string;
  accountType: BankAccountType;
};

export type UserMentionOption = {
  id: number;
  username: string;
  fullName: string;
};

export type MentionNotification = {
  id: number;
  actorUsername: string;
  contextType: string;
  contextId: number | null;
  message: string;
  href: string;
  createdAt: string;
  readAt: string | null;
};

export type NavigationMenu = {
  code: string;
  title: string;
  path: string;
  icon: string;
};

export type Employee = {
  id: number;
  fullName: string;
  username: string;
  email: string;
  roles: string[];
  primaryRoleId: number | null;
  primaryRoleName: string | null;
  department: string;
  employmentStatus: string;
  reportingManagerUserId: number | null;
  reportingManagerUsername: string | null;
  reportingManagerFullName: string | null;
  reportingManagerRoleName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeDirectReport = {
  id: number;
  fullName: string;
  username: string;
  designationRoleName: string;
  employmentStatus: string;
};

export type RoleSummary = {
  id: number;
  name: string;
  description: string | null;
};

export type AssignRolesResponse = {
  employee: Employee;
  createdRoleIds: number[];
  existingRoleIds: number[];
};

export type RemoveRolesResponse = {
  employee: Employee;
  removedRoleIds: number[];
  notAssignedRoleIds: number[];
};

export type OnboardingWorkflowStage =
    | "HR Submitted"
    | "Head HR Approved"
    | "Additional Approval Pending"
    | "Admin Approved"
    | "Additional Approval Approved"
    // Retained for the (separate) employee profile-update-request workflow, which still uses
    // the original 4-stage HR -> Head HR -> CHRO -> Super Admin approval chain.
    | "CHRO Approved"
    | "Super Admin Approved"
    | "Refer Back"
    | "Cancelled"
    | "Rejected";

export type OnboardingAdditionalApproverDesignation = "Super Admin" | "CHRO" | "CEO" | "CTO";

export const ONBOARDING_CLOSED_STAGES: OnboardingWorkflowStage[] = [
  "Admin Approved",
  "Additional Approval Approved",
  "Rejected",
  "Cancelled",
];

export type OnboardingApprovalTrailItem = {
  step: string;
  actor: string;
  decision: string;
  comment: string | null;
  actionAt: string | null;
};

export type OnboardingRequest = {
  id: number;
  firstName: string;
  lastName: string;
  aadhaarCardNumber: string;
  panCardNumber: string;
  personalEmailAddress: string;
  permanentAddress: string;
  phoneNumber: string;
  designationRoleName: string;
  reportingManagerUserId: number | null;
  reportingManagerUsername: string | null;
  reportingManagerFullName: string | null;
  reportingManagerRoleName: string | null;
  educationQualification: string | null;
  interviewStage: string;
  workflowStage: OnboardingWorkflowStage;
  additionalApproverDesignation: OnboardingAdditionalApproverDesignation | null;
  createdByUsername: string;
  generatedEmployeeId: string | null;
  generatedEmailAddress: string | null;
  referBackBy: string | null;
  referBackStage: string | null;
  referBackComment: string | null;
  referBackAt: string | null;
  approvalTrail: OnboardingApprovalTrailItem[];
  createdAt: string;
  updatedAt: string;
  lastReminderAt: string | null;
  reminderCount: number;
};

export type OnboardingDesignationOption = {
  designationRoleName: string;
  reportsToRoleName: string;
};

export type OnboardingManagerOption = {
  id: number;
  username: string;
  fullName: string;
  email: string;
};

export type OnboardingManagerOptionsResponse = {
  designationRoleName: string;
  managerRoleName: string;
  managers: OnboardingManagerOption[];
};

export type ProjectWorkflowStage =
    | "PM Submitted"
    | "Delivery Manager Approved"
    | "Project Owner Approved"
    | "Director Approved"
    | "CTO Approved"
    | "Super Admin Approved"
    | "Refer Back"
    | "Rejected";

export type ProjectStatus = "Planned" | "Active" | "On Hold" | "Completed" | "Cancelled";

export type ProjectManagerOption = {
  id: number;
  username: string;
  fullName: string;
  email: string;
};

export type ProjectRequest = {
  id: number;
  projectName: string;
  projectCode: string;
  clientName: string;
  projectType: string;
  priority: string;
  plannedStartDate: string;
  plannedEndDate: string;
  budgetAmount: number;
  currency: string;
  deliveryManagerUserId: number;
  deliveryManagerName: string;
  projectOwnerUserId: number;
  projectOwnerName: string;
  projectDirectorUserId: number | null;
  projectDirectorName: string | null;
  projectManagerUserId: number | null;
  projectManagerName: string | null;
  projectStatus: ProjectStatus;
  description: string;
  riskNotes: string | null;
  workflowStage: ProjectWorkflowStage;
  createdByUsername: string;
  referBackBy: string | null;
  referBackStage: string | null;
  referBackComment: string | null;
  referBackAt: string | null;
  approvalTrail: OnboardingApprovalTrailItem[];
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type ManagedProject = {
  id: number;
  projectName: string;
  projectCode: string;
  clientName: string;
  projectType: string;
  priority: string;
  plannedStartDate: string;
  plannedEndDate: string;
  budgetAmount: number;
  currency: string;
  deliveryManagerUserId: number;
  deliveryManagerName: string;
  projectOwnerUserId: number;
  projectOwnerName: string;
  projectDirectorUserId: number | null;
  projectDirectorName: string | null;
  projectStatus: ProjectStatus;
  description: string;
  riskNotes: string | null;
  createdByUsername: string;
  hasOpenChangeRequest: boolean;
  openChangeRequestStage: string | null;
  approvalTrail: OnboardingApprovalTrailItem[];
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type ProjectChangeWorkflowStage =
    | "Pending Director Approval"
    | "Pending CTO Approval"
    | "Approved"
    | "Rejected";

export type ProjectChangeRequest = {
  id: number;
  projectRequestId: number;
  projectName: string;
  projectCode: string;
  clientName: string;
  projectType: string;
  priority: string;
  plannedStartDate: string;
  plannedEndDate: string;
  budgetAmount: number;
  currency: string;
  deliveryManagerUserId: number;
  deliveryManagerName: string;
  projectOwnerUserId: number;
  projectOwnerName: string;
  projectDirectorUserId: number | null;
  projectDirectorName: string | null;
  projectStatus: ProjectStatus;
  description: string;
  riskNotes: string | null;
  reason: string;
  workflowStage: ProjectChangeWorkflowStage;
  createdByUsername: string;
  approvalTrail: OnboardingApprovalTrailItem[];
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type ProjectAllocationStatus =
    | "Pending DM Approval"
    | "Active"
    | "Refer Back"
    | "Rejected"
    | "Released";

export type ProjectAllocationType = "Billable" | "Buffer" | "Shadow" | "Training" | "Internal";

export type ProjectAllocation = {
  id: number;
  allocationCode: string;
  projectRequestId: number;
  projectName: string;
  projectCode: string;
  employeeUserId: number;
  employeeName: string;
  employeeUsername: string | null;
  employeeEmail: string | null;
  employeeRoleName: string | null;
  allocationType: ProjectAllocationType;
  allocationPercent: number;
  startDate: string;
  endDate: string;
  status: ProjectAllocationStatus;
  createdByUsername: string;
  dmActionBy: string | null;
  dmActionAt: string | null;
  dmComment: string | null;
  referBackBy: string | null;
  referBackAt: string | null;
  referBackComment: string | null;
  approvalTrail: OnboardingApprovalTrailItem[];
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type ProjectAllocationProjectOption = {
  projectRequestId: number;
  projectCode: string;
  projectName: string;
};

export type ProjectAllocationEmployeeOption = {
  id: number;
  username: string;
  fullName: string;
  roleName: string;
};

export type EmployeeProfileUpdateRequest = {
  id: number;
  employeeUserId: number;
  employeeUsername: string;
  currentFullName: string;
  currentEmail: string;
  currentDepartment: string;
  currentEmploymentStatus: string;
  currentDesignationRoleName: string;
  currentReportingManagerUserId: number | null;
  currentReportingManagerName: string | null;
  requestedFullName: string;
  requestedEmail: string;
  requestedDepartment: string;
  requestedEmploymentStatus: string;
  requestedDesignationRoleName: string;
  requestedReportingManagerUserId: number;
  requestedReportingManagerName: string;
  replacementTeamLeadUserId: number | null;
  replacementTeamLeadName: string | null;
  directReportsAffectedCount: number;
  workflowStage: OnboardingWorkflowStage;
  createdByUsername: string;
  approvalTrail: OnboardingApprovalTrailItem[];
  createdAt: string;
  updatedAt: string;
};

export type RequestComment = {
  comment: string;
};

export type PagedResponse<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
};

export type DashboardSummary = {
  totalEmployees: number;
  openOnboardingRequests: number;
  openEmployeeDataRequests: number;
};

export type TeamLeadLeaveSummary = {
  leaveRequestId: number;
  employeeUserId: number;
  employeeFullName: string;
  employeeUsername: string;
  leaveCategory: string;
  startDate: string;
  endDate: string;
  requestedDays: number;
  requestStatus: string;
};

export type TeamLeadProjectMember = {
  employeeUserId: number;
  employeeFullName: string;
  employeeUsername: string;
  allocationPercent: number;
};

export type TeamLeadProjectSummary = {
  projectRequestId: number;
  projectName: string;
  projectCode: string;
  clientName: string;
  projectType: string;
  priority: string;
  plannedStartDate: string;
  plannedEndDate: string;
  workflowStage: string;
  activeAllocationPercent: number;
  activeTeamMemberCount: number;
  teamMembers: TeamLeadProjectMember[];
};

export type TeamLeadDashboard = {
  teamLeadUserId: number;
  teamLeadUsername: string;
  teamLeadFullName: string;
  teamLeadDesignation: string;
  reportingEmployeesCount: number;
  currentMonthLeaveCount: number;
  activeTeamProjectCount: number;
  currentMonthLeaves: TeamLeadLeaveSummary[];
  teamProjects: TeamLeadProjectSummary[];
};

export type SelfProjectAssignment = {
  allocationId: number;
  allocationCode: string;
  projectRequestId: number;
  projectName: string;
  projectCode: string;
  allocationType: string;
  allocationPercent: number;
  startDate: string;
  endDate: string;
  status: string;
  updatedAt: string;
};

export type SelfDashboard = {
  userId: number;
  username: string;
  fullName: string;
  designation: string;
  reportingManagerFullName: string | null;
  reportingManagerRoleName: string | null;
  currentProjects: SelfProjectAssignment[];
};

export type AttendanceAssignment = {
  allocationId: number;
  projectRequestId: number;
  projectName: string;
  projectCode: string;
  allocationType: string;
  allocationPercent: number;
  startDate: string;
  endDate: string;
};

export type AttendanceDay = {
  workDate: string;
  dayLabel: string;
  weekend: boolean;
  leaveDay: boolean;
  leaveLabel: string | null;
  billableHours: number;
  nonBillableHours: number;
  billableProjectAllocationId: number | null;
  billableProjectName: string | null;
  billableProjectCode: string | null;
  nonBillableProjectAllocationId: number | null;
  nonBillableProjectName: string | null;
  nonBillableProjectCode: string | null;
  editable: boolean;
};

export type AttendanceTimesheet = {
  id: number;
  employeeUserId: number;
  employeeUsername: string;
  employeeFullName: string;
  weekStartDate: string;
  weekEndDate: string;
  approverManagerUserId: number | null;
  approverManagerUsername: string | null;
  approverManagerFullName: string | null;
  timesheetStatus: string;
  approvalRequired: boolean;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  approverComment: string | null;
  approvalReset: boolean;
  days: AttendanceDay[];
};

export type AttendanceApprovalItem = {
  id: number;
  employeeUserId: number;
  employeeUsername: string;
  employeeFullName: string;
  weekStartDate: string;
  weekEndDate: string;
  billableHours: number;
  nonBillableHours: number;
  timesheetStatus: string;
  submittedAt: string | null;
  updatedAt: string;
};

export type AttendanceWeek = {
  weekStartDate: string;
  weekEndDate: string;
  editableUntil: string;
  editable: boolean;
  hasBillableAssignments: boolean;
  hasReportees: boolean;
  timesheet: AttendanceTimesheet | null;
  days: AttendanceDay[];
  billableAssignments: AttendanceAssignment[];
  nonBillableAssignments: AttendanceAssignment[];
  pendingApprovals: AttendanceApprovalItem[];
};

export type AttendanceDayUpsert = {
  workDate: string;
  billableHours: number;
  nonBillableHours: number;
  billableProjectAllocationId: number | null;
  nonBillableProjectAllocationId: number | null;
};

export type AttendanceUpsertRequest = {
  weekStartDate: string;
  days: AttendanceDayUpsert[];
};

export type AttendanceActionDecision = "APPROVE" | "REJECT";

export type AttendanceActionRequest = {
  decision: AttendanceActionDecision;
  comment: string;
};

export type LeavePolicy = {
  id: number;
  leaveCategory: string;
  displayName: string;
  maxDaysPerYear: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LeaveRequest = {
  id: number;
  employeeUserId: number;
  employeeUsername: string;
  employeeFullName: string;
  approverManagerUserId: number | null;
  approverManagerUsername: string | null;
  approverManagerFullName: string | null;
  leaveCategory: string;
  startDate: string;
  endDate: string;
  requestedDays: number;
  reason: string;
  requestStatus: string;
  approverComment: string | null;
  approverActionAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SupportCategoryOption = {
  categoryCode: string;
  categoryTitle: string;
  ticketType: string;
  parentCategoryCode: string | null;
};

export type SupportQueueSummary = {
  queueId: number;
  queueCode: string;
  queueTitle: string;
  queueType: string;
  memberCount: number;
  openTicketCount: number;
};

export type SupportAssigneeOption = {
  id: number;
  username: string;
  fullName: string;
  email: string;
};

export type SupportTicketComment = {
  id: number;
  actorUsername: string;
  actionType: string;
  commentText: string | null;
  createdAt: string;
};

export type SupportTicket = {
  id: number;
  ticketNumber: string;
  ticketType: "SUPPORT_TICKET" | "INCIDENT" | "SECURITY_INCIDENT";
  categoryCode: string;
  categoryTitle: string;
  subcategoryCode: string | null;
  subcategoryTitle: string | null;
  impactLevel: string;
  urgencyLevel: string;
  priorityCode: "P1" | "P2" | "P3" | "P4";
  queueId: number;
  queueCode: string;
  queueTitle: string;
  assigneeUserId: number | null;
  assigneeUsername: string | null;
  assigneeFullName: string | null;
  status:
      | "NEW"
      | "ASSIGNED"
      | "IN_PROGRESS"
      | "PENDING_EMPLOYEE"
      | "RESOLVED"
      | "CLOSED"
      | "REOPENED"
      | "CANCELLED"
      | "SECURITY_ESCALATED";
  source: string;
  shortDescription: string;
  description: string;
  securityIncident: boolean;
  responseDueAt: string | null;
  resolutionDueAt: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdByUsername: string;
  updatedByUsername: string;
  vendorTicketNumber: string | null;
  vendorTicketUrl: string | null;
  comments: SupportTicketComment[];
  createdAt: string;
  updatedAt: string;
};

export type SupportCatalog = {
  ticketTypes: string[];
  impactLevels: string[];
  urgencyLevels: string[];
  categories: SupportCategoryOption[];
  queues: SupportQueueSummary[];
};

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getApiBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, "");
  }

  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:8080";
  }

  throw new Error("NEXT_PUBLIC_API_BASE_URL must be configured for deployed environments.");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(text || "API request failed", response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function login(payload: LoginRequest) {
  return request<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function logout(accessToken: string) {
  return request<{ message: string }>("/api/auth/logout", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
  });
}

export async function getCurrentUser(accessToken: string) {
  return request<UserProfile>("/api/users/me", {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function updateCurrentUserProfile(accessToken: string, payload: UserProfileUpdateRequest) {
  return request<UserProfile>("/api/users/me", {
    method: "PUT",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function getCurrentUserBankDetails(accessToken: string) {
  return request<BankDetails | null>("/api/users/me/bank-details", {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function saveCurrentUserBankDetails(accessToken: string, payload: BankDetailsUpsertRequest) {
  return request<BankDetails>("/api/users/me/bank-details", {
    method: "PUT",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function searchUserMentions(accessToken: string, query: string) {
  return request<UserMentionOption[]>(`/api/users/mentions?query=${encodeURIComponent(query)}`, {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function getMentionNotifications(accessToken: string) {
  return request<MentionNotification[]>("/api/users/mention-notifications", {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function getAuthorizedNavigation(accessToken: string) {
  return request<NavigationMenu[]>("/api/navigation/menus", {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function getDashboardSummary(accessToken: string) {
  return request<DashboardSummary>("/api/dashboard/summary", {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function getTeamLeadDashboard(accessToken: string) {
  return request<TeamLeadDashboard>("/api/dashboard/team-lead", {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function getSelfDashboard(accessToken: string) {
  return request<SelfDashboard>("/api/dashboard/self", {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function getAttendanceWeek(accessToken: string, weekStartDate?: string) {
  const params = weekStartDate ? `?weekStartDate=${encodeURIComponent(weekStartDate)}` : "";
  return request<AttendanceWeek>(`/api/attendance/weeks/current${params}`, {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function saveAttendanceTimesheet(accessToken: string, payload: AttendanceUpsertRequest) {
  return request<AttendanceWeek>("/api/attendance/timesheets/save", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function submitAttendanceTimesheet(accessToken: string, payload: AttendanceUpsertRequest) {
  return request<AttendanceWeek>("/api/attendance/timesheets/submit", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function getAttendanceApproverVisibility(accessToken: string) {
  return request<{ hasReportees: boolean }>("/api/attendance/approver-visibility", {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function getAttendanceApprovals(accessToken: string) {
  return request<AttendanceApprovalItem[]>("/api/attendance/approvals", {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function actionAttendanceTimesheet(accessToken: string, timesheetId: number, payload: AttendanceActionRequest) {
  return request<AttendanceWeek>(`/api/attendance/timesheets/${timesheetId}/actions`, {
    method: "PATCH",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function getEmployees(
    accessToken: string,
    filters?: { employeeName?: string; role?: string; department?: string; status?: string },
    page = 0,
    size = 25
) {
  const params = new URLSearchParams();

  if (filters?.employeeName?.trim()) {
    params.set("employeeName", filters.employeeName.trim());
  }
  if (filters?.role?.trim()) {
    params.set("role", filters.role.trim());
  }
  if (filters?.department?.trim()) {
    params.set("department", filters.department.trim());
  }
  if (filters?.status?.trim()) {
    params.set("status", filters.status.trim());
  }

  params.set("page", String(page));
  params.set("size", String(size));
  return request<PagedResponse<Employee>>(`/api/employees?${params.toString()}`, {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function getRoleAuditEmployees(
    accessToken: string,
    filters?: { employeeName?: string; role?: string; department?: string; status?: string },
    page = 0,
    size = 25
) {
  const params = new URLSearchParams();

  if (filters?.employeeName?.trim()) {
    params.set("employeeName", filters.employeeName.trim());
  }
  if (filters?.role?.trim()) {
    params.set("role", filters.role.trim());
  }
  if (filters?.department?.trim()) {
    params.set("department", filters.department.trim());
  }
  if (filters?.status?.trim()) {
    params.set("status", filters.status.trim());
  }

  params.set("page", String(page));
  params.set("size", String(size));
  return request<PagedResponse<Employee>>(`/api/role-audit/employees?${params.toString()}`, {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function getEmployeeById(accessToken: string, employeeId: number) {
  return request<Employee>(`/api/employees/${employeeId}`, {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function getEmployeeDirectReports(accessToken: string, employeeId: number) {
  return request<EmployeeDirectReport[]>(`/api/employees/${employeeId}/direct-reports`, {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function getEmployeeReplacementOptions(accessToken: string, employeeId: number) {
  return request<OnboardingManagerOption[]>(`/api/employees/${employeeId}/replacement-options`, {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function getRoleAuditEmployeeById(accessToken: string, employeeId: number) {
  return request<Employee>(`/api/role-audit/employees/${employeeId}`, {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function getAllRoles(accessToken: string) {
  return request<RoleSummary[]>("/api/role-audit/roles", {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function assignRolesToEmployee(
    accessToken: string,
    employeeId: number,
    payload: { roleIds: number[] }
) {
  return request<AssignRolesResponse>(`/api/role-audit/employees/${employeeId}/roles`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function removeRolesFromEmployee(
    accessToken: string,
    employeeId: number,
    payload: { roleIds: number[] }
) {
  return request<RemoveRolesResponse>(`/api/role-audit/employees/${employeeId}/roles/remove`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function updateEmployee(
    accessToken: string,
    employeeId: number,
    payload: { fullName: string; email: string; department: string; employmentStatus: string }
) {
  return request<Employee>(`/api/employees/${employeeId}`, {
    method: "PUT",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function getOnboardingRequests(accessToken: string, workflowStage?: string, page = 0, size = 25) {
  const params = new URLSearchParams();
  if (workflowStage?.trim()) {
    params.set("workflowStage", workflowStage.trim());
  }

  params.set("page", String(page));
  params.set("size", String(size));
  return request<PagedResponse<OnboardingRequest>>(`/api/onboarding-requests?${params.toString()}`, {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function getProjectRequests(accessToken: string, workflowStage?: string, query?: string, page = 0, size = 25) {
  const params = new URLSearchParams();
  if (workflowStage?.trim()) {
    params.set("workflowStage", workflowStage.trim());
  }
  if (query?.trim()) {
    params.set("query", query.trim());
  }
  params.set("page", String(page));
  params.set("size", String(size));
  return request<PagedResponse<ProjectRequest>>(`/api/project-requests?${params.toString()}`, {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function getProjectRequestById(accessToken: string, requestId: number) {
  return request<ProjectRequest>(`/api/project-requests/${requestId}`, {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function getProjectDeliveryManagerOptions(accessToken: string) {
  return request<ProjectManagerOption[]>("/api/project-requests/delivery-manager-options", {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function getProjectOwnerOptions(accessToken: string) {
  return request<ProjectManagerOption[]>("/api/project-requests/project-owner-options", {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function getProjectDirectorOptions(accessToken: string) {
  return request<ProjectManagerOption[]>("/api/project-requests/project-director-options", {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function getProjectManagerOptions(accessToken: string) {
  return request<ProjectManagerOption[]>("/api/project-requests/project-manager-options", {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function createProjectRequest(
    accessToken: string,
    payload: {
      projectName: string;
      projectCode: string;
      clientName: string;
      projectType: string;
      priority: string;
      plannedStartDate: string;
      plannedEndDate: string;
      budgetAmount: number;
      currency: string;
      deliveryManagerUserId: number;
      projectOwnerUserId: number;
      projectDirectorUserId: number;
      projectManagerUserId: number;
      projectStatus: ProjectStatus;
      description: string;
      riskNotes?: string;
      comment?: string;
    }
) {
  return request<ProjectRequest>("/api/project-requests", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function addProjectRequestComment(accessToken: string, requestId: number, payload: RequestComment) {
  return request<ProjectRequest>(`/api/project-requests/${requestId}/comments`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function takeProjectAction(
    accessToken: string,
    requestId: number,
    payload: { decision: "APPROVE" | "REJECT" | "REFER_BACK"; comment: string }
) {
  return request<ProjectRequest>(`/api/project-requests/${requestId}/actions`, {
    method: "PATCH",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function resubmitProjectRequest(
    accessToken: string,
    requestId: number,
    payload: {
      projectName: string;
      projectCode: string;
      clientName: string;
      projectType: string;
      priority: string;
      plannedStartDate: string;
      plannedEndDate: string;
      budgetAmount: number;
      currency: string;
      deliveryManagerUserId: number;
      projectOwnerUserId: number;
      projectDirectorUserId: number;
      projectManagerUserId: number;
      projectStatus: ProjectStatus;
      description: string;
      riskNotes?: string;
      comment?: string;
    }
) {
  return request<ProjectRequest>(`/api/project-requests/${requestId}/resubmit`, {
    method: "PATCH",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function getProjectPendingApprovals(accessToken: string) {
  return request<ProjectRequest[]>("/api/project-requests/pending-approvals", {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function getManagedProjects(accessToken: string) {
  return request<ManagedProject[]>("/api/project-requests/managed-projects", {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function getProjectMasterProjects(accessToken: string) {
  return request<ProjectRequest[]>("/api/project-requests/project-master", {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function createProjectChangeRequest(
    accessToken: string,
    projectId: number,
    payload: {
      projectName: string;
      projectCode: string;
      clientName: string;
      projectType: string;
      priority: string;
      plannedStartDate: string;
      plannedEndDate: string;
      budgetAmount: number;
      currency: string;
      deliveryManagerUserId: number;
      projectOwnerUserId: number;
      projectDirectorUserId: number;
      projectStatus: ProjectStatus;
      description: string;
      riskNotes?: string;
      reason: string;
    }
) {
  return request<ProjectChangeRequest>(`/api/project-requests/${projectId}/change-requests`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function getProjectChangeRequests(accessToken: string) {
  return request<ProjectChangeRequest[]>("/api/project-requests/change-requests", {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function takeProjectChangeRequestAction(
    accessToken: string,
    changeRequestId: number,
    payload: { decision: "APPROVE" | "REJECT"; comment: string }
) {
  return request<ProjectChangeRequest>(`/api/project-requests/change-requests/${changeRequestId}/actions`, {
    method: "PATCH",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function addProjectChangeRequestComment(accessToken: string, changeRequestId: number, payload: RequestComment) {
  return request<ProjectChangeRequest>(`/api/project-requests/change-requests/${changeRequestId}/comments`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function getProjectAllocationRequests(accessToken: string, status?: string, query?: string, page = 0, size = 25) {
  const params = new URLSearchParams();
  if (status?.trim()) {
    params.set("status", status.trim());
  }
  if (query?.trim()) {
    params.set("query", query.trim());
  }
  params.set("page", String(page));
  params.set("size", String(size));
  return request<PagedResponse<ProjectAllocation>>(`/api/project-allocations?${params.toString()}`, {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function getProjectAllocationById(accessToken: string, allocationId: number) {
  return request<ProjectAllocation>(`/api/project-allocations/${allocationId}`, {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function getProjectAllocationProjectOptions(accessToken: string) {
  return request<ProjectAllocationProjectOption[]>("/api/project-allocations/project-options", {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function getProjectAllocationEmployeeOptions(accessToken: string) {
  return request<ProjectAllocationEmployeeOption[]>("/api/project-allocations/employee-options", {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function createProjectAllocationRequest(
    accessToken: string,
    payload: {
      projectRequestId: number;
      employeeUserIds: number[];
      allocationType: ProjectAllocationType;
      allocationPercent: number;
      startDate: string;
      endDate: string;
      comment?: string;
    }
) {
  return request<ProjectAllocation[]>("/api/project-allocations", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function addProjectAllocationComment(accessToken: string, allocationId: number, payload: RequestComment) {
  return request<ProjectAllocation>(`/api/project-allocations/${allocationId}/comments`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function takeProjectAllocationAction(
    accessToken: string,
    allocationId: number,
    payload: { decision: "APPROVE" | "REJECT" | "REFER_BACK"; comment: string }
) {
  return request<ProjectAllocation>(`/api/project-allocations/${allocationId}/actions`, {
    method: "PATCH",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function resubmitProjectAllocationRequest(
    accessToken: string,
    allocationId: number,
    payload: {
      projectRequestId: number;
      employeeUserId: number;
      allocationType: ProjectAllocationType;
      allocationPercent: number;
      startDate: string;
      endDate: string;
      comment?: string;
    }
) {
  return request<ProjectAllocation>(`/api/project-allocations/${allocationId}/resubmit`, {
    method: "PATCH",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function manageProjectAllocation(
    accessToken: string,
    allocationId: number,
    payload: {
      action: "EXTEND" | "REDUCE" | "RELEASE";
      allocationPercent?: number;
      endDate?: string;
      comment: string;
    }
) {
  return request<ProjectAllocation>(`/api/project-allocations/${allocationId}/manage`, {
    method: "PATCH",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function getProjectAllocationPendingApprovals(accessToken: string) {
  return request<ProjectAllocation[]>("/api/project-allocations/pending-approvals", {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function getOnboardingDesignationOptions(accessToken: string) {
  return request<OnboardingDesignationOption[]>("/api/onboarding-requests/designation-options", {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function getOnboardingManagerOptions(accessToken: string, designationRoleName: string) {
  const params = new URLSearchParams();
  params.set("designationRoleName", designationRoleName);

  return request<OnboardingManagerOptionsResponse>(`/api/onboarding-requests/manager-options?${params.toString()}`, {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function createOnboardingRequest(
    accessToken: string,
    payload: {
      firstName: string;
      lastName: string;
      aadhaarCardNumber: string;
      panCardNumber: string;
      personalEmailAddress: string;
      permanentAddress: string;
      phoneNumber: string;
      designationRoleName: string;
      reportingManagerUserId: number;
      educationQualification?: string;
      comment?: string;
    }
) {
  return request<OnboardingRequest>("/api/onboarding-requests", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function takeOnboardingAction(
    accessToken: string,
    requestId: number,
    payload: {
      decision: "APPROVE" | "REJECT" | "REFER_BACK";
      comment: string;
      additionalApproverDesignation?: OnboardingAdditionalApproverDesignation | null;
    }
) {
  return request<OnboardingRequest>(`/api/onboarding-requests/${requestId}/actions`, {
    method: "PATCH",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function addOnboardingRequestComment(accessToken: string, requestId: number, payload: RequestComment) {
  return request<OnboardingRequest>(`/api/onboarding-requests/${requestId}/comments`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function reInitiateOnboardingRequest(accessToken: string, requestId: number) {
  return request<OnboardingRequest>(`/api/onboarding-requests/${requestId}/reinitiate`, {
    method: "PATCH",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
  });
}

export async function resubmitOnboardingRequest(
    accessToken: string,
    requestId: number,
    payload: {
      firstName: string;
      lastName: string;
      aadhaarCardNumber: string;
      panCardNumber: string;
      personalEmailAddress: string;
      permanentAddress: string;
      phoneNumber: string;
      designationRoleName: string;
      reportingManagerUserId: number;
      educationQualification?: string;
      comment?: string;
    }
) {
  return request<OnboardingRequest>(`/api/onboarding-requests/${requestId}/resubmit`, {
    method: "PATCH",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function sendOnboardingReminder(accessToken: string, requestId: number) {
  return request<OnboardingRequest>(`/api/onboarding-requests/${requestId}/remind`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
  });
}

export async function getPendingApprovalNotifications(accessToken: string) {
  return request<OnboardingRequest[]>("/api/onboarding-requests/pending-approvals", {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function checkPendingProfileUpdateRequest(accessToken: string, employeeUserId: number) {
  return request<{ hasPendingRequest: boolean }>(
      `/api/employee-profile-update-requests/pending-check?employeeUserId=${employeeUserId}`,
      {
        headers: {
          Authorization: "Bearer " + accessToken,
        },
        cache: "no-store",
      }
  );
}

export async function createEmployeeProfileUpdateRequest(
    accessToken: string,
    payload: {
      employeeUserId: number;
      department: string;
      employmentStatus: string;
      designationRoleName: string;
      reportingManagerUserId: number;
      replacementTeamLeadUserId?: number;
      comment?: string;
    }
) {
  return request<EmployeeProfileUpdateRequest>("/api/employee-profile-update-requests", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function getEmployeeProfileUpdateRequests(accessToken: string, workflowStage?: string, page = 0, size = 25) {
  const params = new URLSearchParams();
  if (workflowStage?.trim()) {
    params.set("workflowStage", workflowStage.trim());
  }
  params.set("page", String(page));
  params.set("size", String(size));
  return request<PagedResponse<EmployeeProfileUpdateRequest>>(`/api/employee-profile-update-requests?${params.toString()}`, {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function takeEmployeeProfileUpdateRequestAction(
    accessToken: string,
    requestId: number,
    payload: { decision: "APPROVE" | "REJECT"; comment: string }
) {
  return request<EmployeeProfileUpdateRequest>(`/api/employee-profile-update-requests/${requestId}/actions`, {
    method: "PATCH",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function addEmployeeProfileUpdateRequestComment(
    accessToken: string,
    requestId: number,
    payload: RequestComment
) {
  return request<EmployeeProfileUpdateRequest>(`/api/employee-profile-update-requests/${requestId}/comments`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function cancelEmployeeProfileUpdateRequest(
    accessToken: string,
    requestId: number,
    payload?: { comment?: string }
) {
  return request<EmployeeProfileUpdateRequest>(`/api/employee-profile-update-requests/${requestId}/cancel`, {
    method: "PATCH",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify(payload ?? {}),
  });
}

export async function getEnabledLeavePolicies(accessToken: string) {
  return request<LeavePolicy[]>("/api/leaves/policies", {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function applyLeave(
    accessToken: string,
    payload: {
      leaveCategory: string;
      startDate: string;
      endDate: string;
      reason: string;
    }
) {
  return request<LeaveRequest>("/api/leaves/apply", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function getMyLeaveRequests(accessToken: string) {
  return request<LeaveRequest[]>("/api/leaves/my-requests", {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function getLeaveApprovalRequests(accessToken: string) {
  return request<LeaveRequest[]>("/api/leaves/approvals", {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function getLeaveApproverVisibility(accessToken: string) {
  return request<{ showApproverRequests: boolean }>("/api/leaves/approver-visibility", {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function takeLeaveAction(
    accessToken: string,
    requestId: number,
    payload: { decision: "APPROVE" | "REJECT"; comment: string }
) {
  return request<LeaveRequest>(`/api/leaves/${requestId}/actions`, {
    method: "PATCH",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function getLeavePolicies(accessToken: string) {
  return request<LeavePolicy[]>("/api/leave-policies", {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function createLeavePolicy(
    accessToken: string,
    payload: {
      leaveCategory: string;
      displayName: string;
      maxDaysPerYear: number;
      enabled: boolean;
    }
) {
  return request<LeavePolicy>("/api/leave-policies", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function updateLeavePolicy(
    accessToken: string,
    id: number,
    payload: {
      displayName: string;
      maxDaysPerYear: number;
      enabled: boolean;
    }
) {
  return request<LeavePolicy>(`/api/leave-policies/${id}`, {
    method: "PUT",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function getSupportCatalog(accessToken: string) {
  return request<SupportCatalog>("/api/support/catalog/options", {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function createSupportTicket(
    accessToken: string,
    payload: {
      ticketType: string;
      categoryCode: string;
      subcategoryCode?: string;
      impactLevel: string;
      urgencyLevel: string;
      shortDescription: string;
      description: string;
      source?: string;
      assigneeUserId?: number | null;
    }
) {
  return request<SupportTicket>("/api/support/tickets", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function getSupportTickets(
    accessToken: string,
    filters?: { scope?: string; queueCode?: string; status?: string }
) {
  const params = new URLSearchParams();
  if (filters?.scope?.trim()) {
    params.set("scope", filters.scope.trim());
  }
  if (filters?.queueCode?.trim()) {
    params.set("queueCode", filters.queueCode.trim());
  }
  if (filters?.status?.trim()) {
    params.set("status", filters.status.trim());
  }
  return request<SupportTicket[]>(`/api/support/tickets?${params.toString()}`, {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function getSupportTicketById(accessToken: string, ticketId: number) {
  return request<SupportTicket>(`/api/support/tickets/${ticketId}`, {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function getSupportTicketByNumber(accessToken: string, ticketNumber: string) {
  return request<SupportTicket>(`/api/support/tickets/number/${encodeURIComponent(ticketNumber)}`, {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function addSupportTicketComment(accessToken: string, ticketId: number, payload: { comment: string }) {
  return request<SupportTicket>(`/api/support/tickets/${ticketId}/comments`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function updateSupportTicketStatus(
    accessToken: string,
    ticketId: number,
    payload: { status: SupportTicket["status"]; comment?: string }
) {
  return request<SupportTicket>(`/api/support/tickets/${ticketId}/status`, {
    method: "PATCH",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function updateSupportTicketDetails(
    accessToken: string,
    ticketId: number,
    payload: {
      queueCode?: string;
      assigneeUserId?: number | null;
      impactLevel?: string;
      urgencyLevel?: string;
      status?: SupportTicket["status"];
      closureDetails?: string;
    }
) {
  return request<SupportTicket>(`/api/support/tickets/${ticketId}/details`, {
    method: "PATCH",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function assignSupportTicket(
    accessToken: string,
    ticketId: number,
    payload: { queueCode?: string; assigneeUserId?: number | null }
) {
  return request<SupportTicket>(`/api/support/tickets/${ticketId}/assign`, {
    method: "PATCH",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function getSupportWorkbenchQueues(accessToken: string) {
  return request<SupportQueueSummary[]>("/api/support/workbench/queues", {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function getSupportWorkbenchTickets(accessToken: string, queueCode: string) {
  const params = new URLSearchParams();
  params.set("queueCode", queueCode);
  return request<SupportTicket[]>(`/api/support/workbench/tickets?${params.toString()}`, {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}

export async function getSupportQueueAssignees(accessToken: string, queueCode: string) {
  const params = new URLSearchParams();
  params.set("queueCode", queueCode);
  return request<SupportAssigneeOption[]>(`/api/support/workbench/assignees?${params.toString()}`, {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    cache: "no-store",
  });
}
