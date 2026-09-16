"use client";

import { useCallback, useEffect, useState } from "react";
import { Briefcase, CalendarDays, Inbox, PenSquare, RefreshCw, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";

import {
  ApiError,
  getDashboardSummary,
  getManagedProjects,
  getProjectMasterProjects,
  getProjectAllocationPendingApprovals,
  getProjectAllocationRequests,
  getProjectChangeRequests,
  getProjectPendingApprovals,
  getProjectRequests,
  getSelfDashboard,
  getTeamLeadDashboard,
  type DashboardSummary,
  type ManagedProject,
  type ProjectAllocation,
  type ProjectChangeRequest,
  type ProjectRequest,
  type SelfDashboard,
  type TeamLeadDashboard,
} from "@/lib/api";
import { loadSession } from "@/lib/auth-storage";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

const REFRESH_INTERVAL_MS = 15000;
const AUTHORIZED_DASHBOARD_ROLES = [
  "super admin",
  "admin",
  "chro",
  "hr head",
  "senior hr",
  "team lead",
  "it support lead",
  "application support specialist",
  "employee",
  "project manager",
  "delivery manager",
  "project owner",
  "director",
  "cto",
  "role_project_manager",
  "role_delivery_manager",
  "role_project_owner",
  "role_director",
  "role_cto",
  "role_application_support_specialist",
  "role_employee",
  "role_super_admin",
  "role_admin",
];
const TEAM_LEAD_ROLES = ["team lead", "role_team_lead", "it support lead", "role_it_support_lead"];
const PROJECT_MANAGER_ROLES = ["project manager", "role_project_manager"];
const DELIVERY_MANAGER_ROLES = ["delivery manager", "role_delivery_manager"];
const PROJECT_OWNER_ROLES = ["project owner", "role_project_owner"];
const DIRECTOR_ROLES = ["director", "role_director"];
const CTO_ROLES = ["cto", "role_cto"];
const SUPER_ADMIN_ROLES = ["super admin", "admin", "role_super_admin", "role_admin"];

type ProjectRoleDashboardData = {
  projectRequests: ProjectRequest[];
  changeRequests: ProjectChangeRequest[];
  allocationRequests: ProjectAllocation[];
  pendingProjectApprovals: ProjectRequest[];
  pendingAllocationApprovals: ProjectAllocation[];
  managedProjects: ManagedProject[];
};

type FocusDashboardData = {
  associatedProjects: ProjectRequest[];
  pendingRequests: ProjectRequest[];
  pendingChangeRequests: ProjectChangeRequest[];
};

function formatCount(value: number | null) {
  if (value === null) {
    return "—";
  }
  return value.toLocaleString();
}

function formatDateOnly(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function normalizeRole(role: string) {
  return role.trim().toLowerCase();
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function workflowBadgeClass(value: string) {
  const lower = value.toLowerCase();
  if (lower.includes("approved") || lower.includes("active")) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (lower.includes("pending") || lower.includes("submitted")) return "border-amber-200 bg-amber-50 text-amber-700";
  if (lower.includes("refer")) return "border-violet-200 bg-violet-50 text-violet-700";
  if (lower.includes("rejected") || lower.includes("cancelled")) return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-zinc-200 bg-zinc-50 text-zinc-700";
}

function StatCard({
  label,
  value,
  description,
  icon: Icon,
  gradient,
}: {
  label: string;
  value: number | null;
  description: string;
  icon: typeof Users;
  gradient: string;
}) {
  return (
    <Card className={`overflow-hidden border-0 bg-gradient-to-br ${gradient} text-white shadow-xl shadow-zinc-200/60`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">{label}</p>
            <div className="mt-3 flex items-end gap-2">
              <h2 className="text-4xl font-semibold leading-none">{formatCount(value)}</h2>
              <span className="pb-1 text-xs text-white/75">live</span>
            </div>
            <p className="mt-3 text-sm text-white/80">{description}</p>
          </div>
          <div className="rounded-2xl bg-white/15 p-3 ring-1 ring-white/20">
            <Icon className="h-7 w-7" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/70 p-6 text-sm text-zinc-600">
      <p className="font-semibold text-zinc-800">{title}</p>
      <p className="mt-1">{description}</p>
    </div>
  );
}

function TeamLeadDashboardView({ dashboard }: { dashboard: TeamLeadDashboard }) {
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-0 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-white shadow-xl shadow-violet-200/60">
        <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">Team Lead Dashboard</p>
            <h1 className="mt-2 text-3xl font-semibold">{dashboard.teamLeadFullName}</h1>
            <p className="mt-2 text-sm text-white/80">
              {dashboard.teamLeadDesignation} • @{dashboard.teamLeadUsername}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatBadge label="Reporting employees" value={dashboard.reportingEmployeesCount} />
            <StatBadge label="Leaves this month" value={dashboard.currentMonthLeaveCount} />
            <StatBadge label="Active team projects" value={dashboard.activeTeamProjectCount} />
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          description="Employees directly reporting to you."
          gradient="from-blue-600 via-indigo-600 to-violet-600"
          icon={Users}
          label="Reporting Employees"
          value={dashboard.reportingEmployeesCount}
        />
        <StatCard
          description="Approved leave requests overlapping the current month."
          gradient="from-emerald-500 via-teal-500 to-cyan-500"
          icon={CalendarDays}
          label="Current Month Leave"
          value={dashboard.currentMonthLeaveCount}
        />
        <StatCard
          description="Projects with active allocations for your team."
          gradient="from-amber-500 via-orange-500 to-rose-500"
          icon={Briefcase}
          label="Team Projects"
          value={dashboard.activeTeamProjectCount}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="border-emerald-100 shadow-md shadow-emerald-100/40">
          <CardHeader className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-white">
            <CardTitle className="text-white">Employees on leave this month</CardTitle>
            <CardDescription className="text-emerald-50">Approved leaves for your direct reports.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-5">
            {dashboard.currentMonthLeaves.length === 0 ? (
              <EmptyState title="No leave entries" description="No direct report has approved leave overlapping this month." />
            ) : (
              dashboard.currentMonthLeaves.map((item) => (
                <div
                  className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm"
                  key={item.leaveRequestId}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-zinc-900">{item.employeeFullName}</p>
                      <p className="text-sm text-zinc-500">@{item.employeeUsername}</p>
                    </div>
                    <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">{item.leaveCategory}</Badge>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-zinc-600 sm:grid-cols-3">
                    <span>From {formatDateOnly(item.startDate)}</span>
                    <span>To {formatDateOnly(item.endDate)}</span>
                    <span>{item.requestedDays} day{item.requestedDays === 1 ? "" : "s"}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-sky-100 shadow-md shadow-sky-100/40">
          <CardHeader className="bg-gradient-to-r from-sky-500 to-blue-600 text-white">
            <CardTitle className="text-white">Team project details</CardTitle>
            <CardDescription className="text-sky-100">Projects with active allocations across your team.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-5">
            {dashboard.teamProjects.length === 0 ? (
              <EmptyState title="No active projects" description="No active team project allocations were found for your direct reports." />
            ) : (
              dashboard.teamProjects.map((project) => (
                <div className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm" key={project.projectRequestId}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-zinc-900">
                        {project.projectName} <span className="text-zinc-400">({project.projectCode})</span>
                      </p>
                      <p className="text-sm text-zinc-500">{project.clientName}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="border-sky-200 bg-sky-50 text-sky-700">{project.projectType}</Badge>
                      <Badge className="border-amber-200 bg-amber-50 text-amber-700">{project.priority}</Badge>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-zinc-600 sm:grid-cols-2">
                    <span>Stage: {project.workflowStage}</span>
                    <span>
                      {formatDateOnly(project.plannedStartDate)} → {formatDateOnly(project.plannedEndDate)}
                    </span>
                    <span>{project.activeTeamMemberCount} active team members</span>
                    <span>{project.activeAllocationPercent.toFixed(2)}% allocated</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {project.teamMembers.map((member) => (
                      <Badge key={member.employeeUserId} className="border-zinc-200 bg-zinc-50 text-zinc-700">
                        {member.employeeFullName} • {member.allocationPercent.toFixed(2)}%
                      </Badge>
                    ))}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function TeamLeadDashboardSkeleton() {
  return (
    <div className="flex min-h-[24rem] items-center justify-center rounded-3xl border border-zinc-200 bg-white/70">
      <Spinner size="lg" />
    </div>
  );
}

function StatBadge({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white/15 px-4 py-3 text-left ring-1 ring-white/20">
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/65">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value.toLocaleString()}</p>
    </div>
  );
}

function SelfServiceDashboardView({ dashboard }: { dashboard: SelfDashboard }) {
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-0 bg-gradient-to-r from-blue-700 via-indigo-700 to-violet-700 text-white shadow-xl shadow-indigo-200/60">
        <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">Dashboard</p>
            <h1 className="mt-2 text-3xl font-semibold">{dashboard.fullName}</h1>
            <p className="mt-2 text-sm text-white/85">
              {dashboard.designation} • Reporting Manager: {dashboard.reportingManagerFullName ?? "-"}
            </p>
          </div>
          <StatBadge label="Current Projects" value={dashboard.currentProjects.length} />
        </CardContent>
      </Card>

      <Card className="border-sky-100 shadow-md shadow-sky-100/40">
        <CardHeader className="bg-gradient-to-r from-sky-500 to-blue-600 text-white">
          <CardTitle className="text-white">Current project assignments</CardTitle>
          <CardDescription className="text-sky-100">Projects currently assigned to you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 p-5">
          {dashboard.currentProjects.length === 0 ? (
            <EmptyState title="No active assignments" description="No active project allocation is currently assigned." />
          ) : (
            dashboard.currentProjects.map((project) => (
              <div className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm" key={project.allocationId}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold text-zinc-900">
                    {project.projectName} <span className="text-zinc-400">({project.projectCode})</span>
                  </p>
                  <Badge className={workflowBadgeClass(project.status)}>{project.status}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-600">
                  <span>{project.allocationType}</span>
                  <span>•</span>
                  <span>{project.allocationPercent.toFixed(2)}%</span>
                  <span>•</span>
                  <span>
                    {formatDateOnly(project.startDate)} → {formatDateOnly(project.endDate)}
                  </span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FocusDashboardView({
  heading,
  associatedCountLabel,
  pendingLabel,
  data,
}: {
  heading: string;
  associatedCountLabel: string;
  pendingLabel: string;
  data: FocusDashboardData;
}) {
  const pendingItems = [
    ...data.pendingRequests.map((item) => ({
      id: `project-${item.id}`,
      title: `${item.projectName} (${item.projectCode})`,
      stage: item.workflowStage,
      updatedAt: item.updatedAt,
      kind: "Project Request",
    })),
    ...data.pendingChangeRequests.map((item) => ({
      id: `change-${item.id}`,
      title: `${item.projectName} (${item.projectCode})`,
      stage: item.workflowStage,
      updatedAt: item.updatedAt,
      kind: "Project Change",
    })),
  ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2">
        <StatCard
          description="Total approved projects associated with your role."
          gradient="from-indigo-600 via-violet-600 to-fuchsia-600"
          icon={Briefcase}
          label={associatedCountLabel}
          value={data.associatedProjects.length}
        />
        <StatCard
          description="Approval items currently pending for your workflow scope."
          gradient="from-amber-500 via-orange-500 to-rose-500"
          icon={Inbox}
          label={pendingLabel}
          value={pendingItems.length}
        />
      </section>
      <Card className="border-violet-100 shadow-md shadow-violet-100/40">
        <CardHeader className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white">
          <CardTitle className="text-white">{heading}</CardTitle>
          <CardDescription className="text-violet-100">Pending requests requiring your attention.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 p-5">
          {pendingItems.length === 0 ? (
            <EmptyState title="No pending approvals" description="No requests are waiting for your action right now." />
          ) : (
            pendingItems.map((item) => (
              <div className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm" key={item.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-zinc-900">{item.title}</p>
                    <p className="text-sm text-zinc-500">{item.kind}</p>
                  </div>
                  <Badge className={workflowBadgeClass(String(item.stage))}>{String(item.stage)}</Badge>
                </div>
                <p className="mt-2 text-xs text-zinc-500">Updated {formatDateTime(item.updatedAt)}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProjectRoleDashboardView({
  dashboard,
  roleNames,
  username,
  lastUpdated,
  error,
}: {
  dashboard: ProjectRoleDashboardData;
  roleNames: string[];
  username: string;
  lastUpdated: string | null;
  error: string | null;
}) {
  const isProjectManager = roleNames.some((role) => PROJECT_MANAGER_ROLES.includes(role));
  const isDeliveryManager = roleNames.some((role) => DELIVERY_MANAGER_ROLES.includes(role));
  const isProjectOwner = roleNames.some((role) => PROJECT_OWNER_ROLES.includes(role));
  const isDirector = roleNames.some((role) => DIRECTOR_ROLES.includes(role));
  const isCto = roleNames.some((role) => CTO_ROLES.includes(role));
  const roleLabel = isProjectManager && isDeliveryManager && isProjectOwner
    ? "Project Leadership"
    : isDirector
      ? "Director"
      : isCto
        ? "CTO"
    : isProjectManager
      ? "Project Manager"
      : isDeliveryManager
        ? "Delivery Manager"
        : "Project Owner";

  const openChangeRequests = dashboard.changeRequests.filter((item) => item.workflowStage !== "Approved" && item.workflowStage !== "Rejected");
  const activeAllocations = dashboard.allocationRequests.filter((item) => item.status === "Active");
  const myRaisedRequests = dashboard.projectRequests.filter((item) => item.createdByUsername.toLowerCase() === username);
  const pendingChangeApprovals = dashboard.changeRequests.filter(
    (item) =>
      (isDirector && item.workflowStage === "Pending Director Approval") ||
      (isCto && item.workflowStage === "Pending CTO Approval")
  );
  const actionQueueCount = dashboard.pendingProjectApprovals.length + dashboard.pendingAllocationApprovals.length + pendingChangeApprovals.length;
  const scopedProjects = (
    isProjectManager
      ? dashboard.managedProjects.map((item) => ({ ...item, displayStage: item.projectStatus }))
      : dashboard.projectRequests.map((item) => ({ ...item, displayStage: item.workflowStage }))
  ).slice(0, 8);

  const actionItems = [
    ...dashboard.pendingProjectApprovals.map((item) => ({
      id: `project-${item.id}`,
      title: `${item.projectName} (${item.projectCode})`,
      stage: item.workflowStage,
      kind: "Project Request",
      updatedAt: item.updatedAt,
    })),
    ...pendingChangeApprovals.map((item) => ({
      id: `change-${item.id}`,
      title: `${item.projectName} (${item.projectCode})`,
      stage: item.workflowStage,
      kind: "Change Request",
      updatedAt: item.updatedAt,
    })),
    ...dashboard.pendingAllocationApprovals.map((item) => ({
      id: `allocation-${item.id}`,
      title: `${item.employeeName} · ${item.projectName}`,
      stage: item.status,
      kind: "Allocation",
      updatedAt: item.updatedAt,
    })),
  ]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-0 bg-gradient-to-r from-slate-900 via-indigo-800 to-violet-700 text-white shadow-xl shadow-indigo-200/60">
        <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/65">{roleLabel} Dashboard</p>
            <h1 className="mt-2 text-3xl font-semibold">Project delivery control tower</h1>
            <p className="mt-2 text-sm text-white/80">
              Requests, approvals, and allocations in one place for quick decision making.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatBadge label="Visible requests" value={dashboard.projectRequests.length} />
            <StatBadge label="Action queue" value={actionQueueCount} />
            <StatBadge label="Open changes" value={openChangeRequests.length} />
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard
          description="Project requests currently visible to your role."
          gradient="from-blue-600 via-indigo-600 to-violet-600"
          icon={Briefcase}
          label="Project Requests"
          value={dashboard.projectRequests.length}
        />
        <StatCard
          description="Open project changes waiting to be finalized."
          gradient="from-fuchsia-600 via-violet-600 to-indigo-600"
          icon={PenSquare}
          label="Open Change Requests"
          value={openChangeRequests.length}
        />
        <StatCard
          description="Active employee allocations across visible projects."
          gradient="from-cyan-500 via-sky-500 to-blue-500"
          icon={Users}
          label="Active Allocations"
          value={activeAllocations.length}
        />
        <StatCard
          description="Items currently requiring approval action."
          gradient="from-amber-500 via-orange-500 to-rose-500"
          icon={Inbox}
          label="Pending Actions"
          value={actionQueueCount}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="border-violet-100 shadow-md shadow-violet-100/40">
          <CardHeader className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white">
            <CardTitle className="text-white">Approvals requiring attention</CardTitle>
            <CardDescription className="text-violet-100">Latest approval queue items for your role.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-5">
            {actionItems.length === 0 ? (
              <EmptyState title="Queue is clear" description="No pending approval actions are waiting right now." />
            ) : (
              actionItems.map((item) => (
                <div className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm" key={item.id}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-zinc-900">{item.title}</p>
                      <p className="text-sm text-zinc-500">{item.kind}</p>
                    </div>
                    <Badge className={workflowBadgeClass(item.stage)}>{item.stage}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">Updated {formatDateTime(item.updatedAt)}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-indigo-100 shadow-md shadow-indigo-100/40">
          <CardHeader className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white">
            <CardTitle className="text-white">{isProjectManager ? "Projects created by you" : "Latest project requests"}</CardTitle>
            <CardDescription className="text-indigo-100">
              {isProjectManager ? "Projects you can track and request updates for." : "Recent requests currently visible in your project workflow."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-5">
            {scopedProjects.length === 0 ? (
              <EmptyState
                title="No project records"
                description={isProjectManager ? "No approved project is available under your ownership yet." : "No project requests are visible at the moment."}
              />
            ) : (
              scopedProjects.map((item) => (
                <div className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm" key={`${item.id}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-semibold text-zinc-900">
                      {item.projectName} <span className="text-zinc-400">({item.projectCode})</span>
                    </p>
                    <Badge className={workflowBadgeClass(item.displayStage)}>{item.displayStage}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-zinc-600">{item.clientName}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500">
                    <span>{item.priority}</span>
                    <span>•</span>
                    <span>{item.projectType}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="border-sky-100 shadow-md shadow-sky-100/40">
          <CardHeader className="bg-gradient-to-r from-sky-500 to-cyan-500 text-white">
            <CardTitle className="text-white">Project change timeline</CardTitle>
            <CardDescription className="text-sky-100">Recent project change requests and their current stage.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-5">
            {dashboard.changeRequests.length === 0 ? (
              <EmptyState title="No change requests" description="No project change requests found for your current role." />
            ) : (
              dashboard.changeRequests.slice(0, 8).map((item) => (
                <div className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm" key={item.id}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-semibold text-zinc-900">
                      {item.projectName} <span className="text-zinc-400">({item.projectCode})</span>
                    </p>
                    <Badge className={workflowBadgeClass(item.workflowStage)}>{item.workflowStage}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-zinc-600 line-clamp-2">{item.reason}</p>
                  <p className="mt-2 text-xs text-zinc-500">Updated {formatDateTime(item.updatedAt)}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-emerald-100 shadow-md shadow-emerald-100/40">
          <CardHeader className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
            <CardTitle className="text-white">Allocation tracker snapshot</CardTitle>
            <CardDescription className="text-emerald-100">Current allocations from projects in your visibility.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-5">
            {dashboard.allocationRequests.length === 0 ? (
              <EmptyState title="No allocations" description="No project allocations are available for your role." />
            ) : (
              dashboard.allocationRequests.slice(0, 8).map((item) => (
                <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm" key={item.id}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-semibold text-zinc-900">{item.employeeName}</p>
                    <Badge className={workflowBadgeClass(item.status)}>{item.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-zinc-600">
                    {item.projectName} ({item.projectCode})
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500">
                    <span>{item.allocationType}</span>
                    <span>•</span>
                    <span>{item.allocationPercent.toFixed(2)}%</span>
                    <span>•</span>
                    <span>
                      {formatDateOnly(item.startDate)} → {formatDateOnly(item.endDate)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-600">
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
          <Sparkles className="h-4 w-4" />
          Live updates
        </span>
        <span>Refreshes every 15 seconds.</span>
        {isProjectManager ? <span>You raised {myRaisedRequests.length} project request(s).</span> : null}
        {lastUpdated ? <span>Last updated at {lastUpdated}.</span> : null}
        {error ? <span className="text-rose-600">{error}</span> : null}
      </div>
    </div>
  );
}

function ProjectRoleDashboardSkeleton() {
  return (
    <div className="flex min-h-[24rem] items-center justify-center rounded-3xl border border-zinc-200 bg-white/70">
      <Spinner size="lg" />
    </div>
  );
}

function GenericDashboardView({
  summary,
  isLoading,
  lastUpdated,
  error,
}: {
  summary: DashboardSummary | null;
  isLoading: boolean;
  lastUpdated: string | null;
  error: string | null;
}) {
  return (
    <>
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          description="All active user records in the system."
          gradient="from-blue-600 via-indigo-600 to-violet-600"
          icon={Users}
          label="Total Employees"
          value={isLoading ? null : summary?.totalEmployees ?? 0}
        />
        <StatCard
          description="Open requests waiting in the onboarding workflow."
          gradient="from-emerald-500 via-teal-500 to-cyan-500"
          icon={Inbox}
          label="Open Onboarding Requests"
          value={isLoading ? null : summary?.openOnboardingRequests ?? 0}
        />
        <StatCard
          description="Open requests waiting in employee data approval."
          gradient="from-amber-500 via-orange-500 to-rose-500"
          icon={PenSquare}
          label="Open Employee Data Requests"
          value={isLoading ? null : summary?.openEmployeeDataRequests ?? 0}
        />
      </section>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-zinc-600">
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
          <Sparkles className="h-4 w-4" />
          Live updates
        </span>
        <span>Refreshes every 15 seconds.</span>
        {lastUpdated ? <span>Last updated at {lastUpdated}.</span> : null}
        {error ? <span className="text-rose-600">{error}</span> : null}
      </div>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="border-sky-100 shadow-md shadow-sky-100/40">
          <CardHeader className="bg-gradient-to-r from-sky-500 to-blue-600 text-white">
            <CardTitle className="text-white">Activity snapshot</CardTitle>
            <CardDescription className="text-sky-100">Quick view of live HR metrics and workflow pressure.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-5">
            <div className="rounded-xl bg-sky-50 p-3 text-sm text-sky-800">
              Employees count updates from the live summary API.
            </div>
            <div className="rounded-xl bg-indigo-50 p-3 text-sm text-indigo-800">
              Onboarding queue reflects all non-terminal workflow stages.
            </div>
            <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              Employee data requests reflect pending approval workflow steps.
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-100 shadow-md shadow-emerald-100/40">
          <CardHeader className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-white">
            <CardTitle className="text-white">Refresh status</CardTitle>
            <CardDescription className="text-emerald-50">The dashboard auto-refreshes without page reloads.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
              <RefreshCw className="h-4 w-4" />
              Current polling interval: 15 seconds
            </div>
            <div className="rounded-xl bg-cyan-50 p-3 text-sm text-cyan-800">
              Counts update as soon as the API response changes.
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [teamLeadDashboard, setTeamLeadDashboard] = useState<TeamLeadDashboard | null>(null);
  const [projectRoleDashboard, setProjectRoleDashboard] = useState<ProjectRoleDashboardData | null>(null);
  const [selfDashboard, setSelfDashboard] = useState<SelfDashboard | null>(null);
  const [focusDashboard, setFocusDashboard] = useState<FocusDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(true);
  const [isTeamLeadView, setIsTeamLeadView] = useState(false);
  const [isSelfDashboardView, setIsSelfDashboardView] = useState(false);
  const [isDirectorFocusView, setIsDirectorFocusView] = useState(false);
  const [isProjectOwnerFocusView, setIsProjectOwnerFocusView] = useState(false);
  const [isProjectRoleView, setIsProjectRoleView] = useState(false);
  const [activeRoleNames, setActiveRoleNames] = useState<string[]>([]);
  const [activeUsername, setActiveUsername] = useState("");

  const loadDashboard = useCallback(async () => {
    const session = loadSession();
    if (!session?.accessToken) {
      setError("Session not found. Please login again.");
      setIsLoading(false);
      return;
    }

    const roleNames = (session.roles ?? []).map(normalizeRole);
    setActiveRoleNames(roleNames);
    setActiveUsername(session.username.toLowerCase());
    const allowed = roleNames.some((role) => AUTHORIZED_DASHBOARD_ROLES.includes(role));
    if (!allowed) {
      setIsAuthorized(false);
      setError("You are not authorized to view dashboard details.");
      setIsLoading(false);
      return;
    }
    setIsAuthorized(true);

    const teamLeadAllowed = roleNames.some((role) => TEAM_LEAD_ROLES.includes(role));
    const isEmployeeSelfRole = roleNames.includes("employee") || roleNames.includes("application support specialist");
    const isDirectorRole = roleNames.some((role) => DIRECTOR_ROLES.includes(role));
    const isProjectOwnerRole = roleNames.some((role) => PROJECT_OWNER_ROLES.includes(role));
    const isGlobalRole = roleNames.some((role) => SUPER_ADMIN_ROLES.includes(role) || CTO_ROLES.includes(role));
    const projectRoleAllowed = roleNames.some(
      (role) =>
        PROJECT_MANAGER_ROLES.includes(role) ||
        DELIVERY_MANAGER_ROLES.includes(role) ||
        PROJECT_OWNER_ROLES.includes(role) ||
        DIRECTOR_ROLES.includes(role) ||
        CTO_ROLES.includes(role) ||
        SUPER_ADMIN_ROLES.includes(role)
    );
    setIsTeamLeadView(teamLeadAllowed);
    setIsSelfDashboardView(isEmployeeSelfRole);
    setIsDirectorFocusView(isDirectorRole && !teamLeadAllowed && !isGlobalRole);
    setIsProjectOwnerFocusView(isProjectOwnerRole && !teamLeadAllowed && !isDirectorRole && !isGlobalRole);
    setIsProjectRoleView(projectRoleAllowed && !isEmployeeSelfRole && !isDirectorRole && !isProjectOwnerRole);

    try {
      if (teamLeadAllowed) {
        const data = await getTeamLeadDashboard(session.accessToken);
        setTeamLeadDashboard(data);
        setSummary(null);
        setSelfDashboard(null);
        setFocusDashboard(null);
        setProjectRoleDashboard(null);
      } else if (isEmployeeSelfRole) {
        const data = await getSelfDashboard(session.accessToken);
        setSelfDashboard(data);
        setSummary(null);
        setTeamLeadDashboard(null);
        setFocusDashboard(null);
        setProjectRoleDashboard(null);
      } else if (isDirectorRole && !isGlobalRole) {
        const [associatedProjects, pendingProjectApprovals, changeRequests] = await Promise.all([
          getProjectMasterProjects(session.accessToken),
          getProjectPendingApprovals(session.accessToken),
          getProjectChangeRequests(session.accessToken),
        ]);
        setFocusDashboard({
          associatedProjects,
          pendingRequests: pendingProjectApprovals.filter(
            (item) =>
              item.workflowStage === "PM Submitted" ||
              item.workflowStage === "Delivery Manager Approved" ||
              item.workflowStage === "Project Owner Approved"
          ),
          pendingChangeRequests: changeRequests.filter((item) => item.workflowStage === "Pending Director Approval"),
        });
        setSummary(null);
        setTeamLeadDashboard(null);
        setSelfDashboard(null);
        setProjectRoleDashboard(null);
      } else if (isProjectOwnerRole && !isGlobalRole && !isDirectorRole) {
        const [associatedProjects, projectRequestPage, changeRequests] = await Promise.all([
          getProjectMasterProjects(session.accessToken),
          getProjectRequests(session.accessToken, undefined, undefined, 0, 100),
          getProjectChangeRequests(session.accessToken),
        ]);
        setFocusDashboard({
          associatedProjects,
          pendingRequests: projectRequestPage.content.filter(
            (item) =>
              item.workflowStage !== "Super Admin Approved" &&
              item.workflowStage !== "Rejected"
          ),
          pendingChangeRequests: changeRequests.filter(
            (item) => item.workflowStage !== "Approved" && item.workflowStage !== "Rejected"
          ),
        });
        setSummary(null);
        setTeamLeadDashboard(null);
        setSelfDashboard(null);
        setProjectRoleDashboard(null);
      } else if (projectRoleAllowed) {
        const canProjectManager = roleNames.some((role) => PROJECT_MANAGER_ROLES.includes(role));
        const canDeliveryManager = roleNames.some((role) => DELIVERY_MANAGER_ROLES.includes(role));
        const canProjectOwner = roleNames.some((role) => PROJECT_OWNER_ROLES.includes(role));
        const canDirector = roleNames.some((role) => DIRECTOR_ROLES.includes(role));
        const canCto = roleNames.some((role) => CTO_ROLES.includes(role));
        const canSuperAdmin = roleNames.some((role) => SUPER_ADMIN_ROLES.includes(role));
        const canUseProjectChange = canProjectOwner || canDirector || canCto || canSuperAdmin;
        const [projectRequestPage, changeRequests, allocationPage, pendingProjectApprovals, pendingAllocationApprovals, managedProjects] = await Promise.all([
          getProjectRequests(session.accessToken, undefined, undefined, 0, 100),
          canUseProjectChange ? getProjectChangeRequests(session.accessToken) : Promise.resolve([]),
          getProjectAllocationRequests(session.accessToken, undefined, undefined, 0, 100),
          canDirector || canCto || canSuperAdmin ? getProjectPendingApprovals(session.accessToken) : Promise.resolve([]),
          canDeliveryManager ? getProjectAllocationPendingApprovals(session.accessToken) : Promise.resolve([]),
          canProjectOwner ? getManagedProjects(session.accessToken) : Promise.resolve([]),
        ]);
        setProjectRoleDashboard({
          projectRequests: projectRequestPage.content,
          changeRequests,
          allocationRequests: allocationPage.content,
          pendingProjectApprovals,
          pendingAllocationApprovals,
          managedProjects,
        });
        setSummary(null);
        setTeamLeadDashboard(null);
        setSelfDashboard(null);
        setFocusDashboard(null);
      } else {
        const data = await getDashboardSummary(session.accessToken);
        setSummary(data);
        setTeamLeadDashboard(null);
        setSelfDashboard(null);
        setFocusDashboard(null);
        setProjectRoleDashboard(null);
      }
      setError(null);
      setLastUpdated(new Date().toLocaleTimeString("en-IN"));
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setIsAuthorized(false);
        setError("You are not authorized to view dashboard details.");
        return;
      }
      setError("Unable to refresh dashboard data.");
      toast.error("Unable to refresh dashboard data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
    const timer = window.setInterval(() => {
      void loadDashboard();
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [loadDashboard]);

  if (!isAuthorized) {
    return (
      <Card className="border-rose-100 shadow-md shadow-rose-100/40">
        <CardHeader className="bg-gradient-to-r from-rose-500 to-red-500 text-white">
          <CardTitle className="text-white">Access Restricted</CardTitle>
          <CardDescription className="text-rose-50">You are not authorized to view dashboard details.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isTeamLeadView) {
    if (isLoading && !teamLeadDashboard) {
      return <TeamLeadDashboardSkeleton />;
    }

    if (!teamLeadDashboard) {
      return (
        <Card className="border-rose-100 shadow-md shadow-rose-100/40">
          <CardHeader className="bg-gradient-to-r from-rose-500 to-red-500 text-white">
            <CardTitle className="text-white">Unable to load team lead dashboard</CardTitle>
            <CardDescription className="text-rose-50">{error ?? "Please refresh the page and try again."}</CardDescription>
          </CardHeader>
        </Card>
      );
    }

    return <TeamLeadDashboardView dashboard={teamLeadDashboard} />;
  }

  if (isProjectRoleView) {
    if (isLoading && !projectRoleDashboard) {
      return <ProjectRoleDashboardSkeleton />;
    }

    if (!projectRoleDashboard) {
      return (
        <Card className="border-rose-100 shadow-md shadow-rose-100/40">
          <CardHeader className="bg-gradient-to-r from-rose-500 to-red-500 text-white">
            <CardTitle className="text-white">Unable to load project dashboard</CardTitle>
            <CardDescription className="text-rose-50">{error ?? "Please refresh the page and try again."}</CardDescription>
          </CardHeader>
        </Card>
      );
    }

    return (
      <ProjectRoleDashboardView
        dashboard={projectRoleDashboard}
        error={error}
        lastUpdated={lastUpdated}
        roleNames={activeRoleNames}
        username={activeUsername}
      />
    );
  }

  if (isSelfDashboardView) {
    if (isLoading && !selfDashboard) {
      return <ProjectRoleDashboardSkeleton />;
    }
    if (!selfDashboard) {
      return (
        <Card className="border-rose-100 shadow-md shadow-rose-100/40">
          <CardHeader className="bg-gradient-to-r from-rose-500 to-red-500 text-white">
            <CardTitle className="text-white">Unable to load dashboard</CardTitle>
            <CardDescription className="text-rose-50">{error ?? "Please refresh the page and try again."}</CardDescription>
          </CardHeader>
        </Card>
      );
    }
    return <SelfServiceDashboardView dashboard={selfDashboard} />;
  }

  if (isDirectorFocusView || isProjectOwnerFocusView) {
    if (isLoading && !focusDashboard) {
      return <ProjectRoleDashboardSkeleton />;
    }
    if (!focusDashboard) {
      return (
        <Card className="border-rose-100 shadow-md shadow-rose-100/40">
          <CardHeader className="bg-gradient-to-r from-rose-500 to-red-500 text-white">
            <CardTitle className="text-white">Unable to load dashboard</CardTitle>
            <CardDescription className="text-rose-50">{error ?? "Please refresh the page and try again."}</CardDescription>
          </CardHeader>
        </Card>
      );
    }
    return isDirectorFocusView ? (
      <FocusDashboardView
        associatedCountLabel="Projects Associated with Director"
        data={focusDashboard}
        heading="Approval request list pending with Director"
        pendingLabel="Pending Director Approvals"
      />
    ) : (
      <FocusDashboardView
        associatedCountLabel="Projects Associated with Project Owner"
        data={focusDashboard}
        heading="Approval request list pending with Project Owner"
        pendingLabel="Pending Project Owner Requests"
      />
    );
  }

  return <GenericDashboardView error={error} isLoading={isLoading} lastUpdated={lastUpdated} summary={summary} />;
}
