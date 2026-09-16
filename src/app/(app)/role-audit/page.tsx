"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, Check, RefreshCcw, Search, ShieldCheck, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTablePagination } from "@/components/erm/data-table-pagination";
import { FloatingInputField, LabeledSelectField } from "@/components/ui/form-fields";
import SearchableMultiSelect from "@/components/ui/searchable-multiselect";
import { Spinner } from "@/components/ui/spinner";
import {
  ApiError,
  assignRolesToEmployee,
  getAllRoles,
  getRoleAuditEmployeeById,
  getRoleAuditEmployees,
  removeRolesFromEmployee,
  type Employee,
  type RoleSummary,
} from "@/lib/api";
import { loadSession } from "@/lib/auth-storage";

type RoleAuditFilters = {
  employeeName: string;
  role: string;
  department: string;
  status: string;
};

const initialFilters: RoleAuditFilters = {
  employeeName: "",
  role: "",
  department: "",
  status: "",
};

function statusClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "active") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (normalized === "inactive") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

function roleBadgeClass(index: number) {
  const classes = [
    "bg-indigo-50 text-indigo-700 border-indigo-200",
    "bg-cyan-50 text-cyan-700 border-cyan-200",
    "bg-violet-50 text-violet-700 border-violet-200",
    "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  ];
  return classes[index % classes.length];
}

export default function RoleAuditPage() {
  const [filters, setFilters] = useState<RoleAuditFilters>(initialFilters);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [employeeOptions, setEmployeeOptions] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [topSelectedRoleIds, setTopSelectedRoleIds] = useState<string[]>([]);
  const [multiSelectResetSignal, setMultiSelectResetSignal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignEmployeeId, setAssignEmployeeId] = useState("");
  const [assignEmployee, setAssignEmployee] = useState<Employee | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignedRoleIds, setAssignedRoleIds] = useState<string[]>([]);
  const [roleSearch, setRoleSearch] = useState("");

  // delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTargetEmployee, setDeleteTargetEmployee] = useState<Employee | null>(null);
  const [deleteOptions, setDeleteOptions] = useState<{ id: number; label: string }[]>([]);
  const [selectedDeleteRoleIds, setSelectedDeleteRoleIds] = useState<string[]>([]);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const accessToken = useMemo(() => loadSession()?.accessToken ?? null, []);

  const selectedRoleSet = useMemo(() => new Set(assignedRoleIds), [assignedRoleIds]);
  const primaryRoleKey = assignEmployee?.primaryRoleId ? String(assignEmployee.primaryRoleId) : null;

  const visibleRoles = useMemo(() => {
    const query = roleSearch.trim().toLowerCase();
    return roles.filter((role) => {
      if (!query) {
        return true;
      }
      return role.name.toLowerCase().includes(query) || (role.description ?? "").toLowerCase().includes(query);
    });
  }, [roleSearch, roles]);

  async function loadGrid(nextFilters?: RoleAuditFilters, nextPage = page, nextSize = pageSize) {
    if (!accessToken) {
      toast.error("Session not found. Please login again.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await getRoleAuditEmployees(accessToken, nextFilters ?? filters, nextPage, nextSize);
      setEmployees(result.content);
      setTotalElements(result.totalElements);
      setTotalPages(result.totalPages);
      setPage(result.page);
      setPageSize(result.size);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        toast.error("Only Super Admin can access role audit.");
      } else {
        toast.error("Unable to load role audit data.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function refreshGridWithCurrentSelection() {
    if (!accessToken) {
      toast.error("Session not found. Please login again.");
      return;
    }

    if (selectedEmployeeId.trim()) {
      const id = Number(selectedEmployeeId);
      if (Number.isNaN(id) || id < 1) {
        await loadGrid(filters, 0, pageSize);
        return;
      }

      try {
        setLoading(true);
        const employee = await getRoleAuditEmployeeById(accessToken, id);
        setEmployees([employee]);
        setTotalElements(1);
        setTotalPages(1);
        setPage(0);
        setPageSize(1);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          toast.error("Employee not found.");
          setEmployees([]);
          setTotalElements(0);
          setTotalPages(0);
        } else if (error instanceof ApiError && error.status === 403) {
          toast.error("Only Super Admin can access role audit.");
        } else {
          toast.error("Unable to load role audit data.");
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    await loadGrid(filters, 0, pageSize);
  }

  const loadRoles = useCallback(async () => {
    if (!accessToken) {
      return;
    }
    try {
      const data = await getAllRoles(accessToken);
      setRoles(data);
      if (assignEmployee) {
        const roleIds = assignEmployee.roles
            .map((roleName) => data.find((role) => role.name.toLowerCase() === roleName.toLowerCase())?.id)
            .filter((value): value is number => Boolean(value));
        setAssignedRoleIds(roleIds.map((value) => String(value)));
      }
    } catch {
      toast.error("Unable to load roles.");
    }
  }, [accessToken, assignEmployee]);

  const loadEmployeeOptions = useCallback(async () => {
    if (!accessToken) return;
    try {
      const result = await getRoleAuditEmployees(accessToken, {}, 0, 200);
      setEmployeeOptions(result.content);
    } catch {
      // ignore
    }
  }, [accessToken]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRoles();
      void loadEmployeeOptions();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadEmployeeOptions, loadRoles]);

  useEffect(() => {
    if (!assignModalOpen) {
      return;
    }

    const trimmed = assignEmployeeId.trim();
    if (!trimmed) {
      return;
    }

    const employeeId = Number(trimmed);
    if (Number.isNaN(employeeId) || employeeId < 1) {
      return;
    }

    const timer = setTimeout(async () => {
      if (!accessToken) {
        return;
      }

      setAssignLoading(true);
      try {
        const employee = await getRoleAuditEmployeeById(accessToken, employeeId);
        setAssignEmployee(employee);
        if (roles.length > 0) {
          const roleIds = employee.roles
              .map((roleName) => roles.find((role) => role.name.toLowerCase() === roleName.toLowerCase())?.id)
              .filter((value): value is number => Boolean(value));
          setAssignedRoleIds(roleIds.map((value) => String(value)));
        }
      } catch (error) {
        setAssignEmployee(null);
        setAssignedRoleIds([]);
        if (error instanceof ApiError && error.status === 404) {
          toast.error("Employee not found.");
        } else if (error instanceof ApiError && error.status === 403) {
          toast.error("Only Super Admin can load role audit details.");
        } else {
          toast.error("Unable to load employee role details.");
        }
      } finally {
        setAssignLoading(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [accessToken, assignEmployeeId, assignModalOpen, roles]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(0);

    // If an employee is selected, show only that employee in the grid
    if (selectedEmployeeId && selectedEmployeeId.trim()) {
      const id = Number(selectedEmployeeId);
      if (!accessToken) {
        toast.error("Session not found. Please login again.");
        return;
      }
      setLoading(true);
      try {
        const employee = await getRoleAuditEmployeeById(accessToken, id);
        setEmployees([employee]);
        setTotalElements(1);
        setTotalPages(1);
        setPage(0);
        setPageSize(1);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          toast.error("Employee not found.");
          setEmployees([]);
          setTotalElements(0);
          setTotalPages(0);
        } else if (error instanceof ApiError && error.status === 403) {
          toast.error("Only Super Admin can access role audit.");
        } else {
          toast.error("Unable to load role audit data.");
        }
      } finally {
        setLoading(false);
      }

      return;
    }

    // fallback to regular filters search
    setLoading(true);
    try {
      await loadGrid(filters, 0, pageSize);
    } finally {
      setLoading(false);
    }
  }

  function resetAssignModalState() {
    setAssignEmployeeId("");
    setAssignEmployee(null);
    setAssignedRoleIds([]);
    setRoleSearch("");
    setAssignLoading(false);
  }

  function closeAssignModal() {
    if (assignSaving) {
      return;
    }
    setAssignModalOpen(false);
    resetAssignModalState();
  }

  async function handleAssignRoles() {
    if (!accessToken) {
      toast.error("Session not found. Please login again.");
      return;
    }
    const employeeId = Number(assignEmployeeId);
    if (!employeeId || !assignEmployee) {
      toast.error("Enter a valid employee id.");
      return;
    }
    if (assignedRoleIds.length === 0) {
      toast.error("Select at least one role to assign.");
      return;
    }

    setAssignSaving(true);
    try {
      const result = await assignRolesToEmployee(accessToken, employeeId, {
        roleIds: assignedRoleIds.map((value) => Number(value)),
      });
      if (result.createdRoleIds && result.createdRoleIds.length > 0) {
        toast.success(`Assigned ${result.createdRoleIds.length} new role(s).`);
      }
      if (result.existingRoleIds && result.existingRoleIds.length > 0) {
        toast(`Skipped ${result.existingRoleIds.length} existing role(s).`);
      }
      setAssignEmployee(result.employee);
      await refreshGridWithCurrentSelection();
      closeAssignModal();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message || `Unable to assign roles (${error.status})`);
      } else {
        toast.error("Unable to assign roles.");
      }
    } finally {
      setAssignSaving(false);
    }
  }

  return (
      <>
        <Card className="border-indigo-100 shadow-md shadow-indigo-100/40">
          <CardHeader className="flex flex-col gap-3 rounded-t-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-white sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-white">
                <ShieldCheck className="h-5 w-5" />
                Access Matrix
              </CardTitle>
              <CardDescription className="text-indigo-100">Search employees, inspect current roles, and manage access assignments.</CardDescription>
            </div>
            <Button
                className="gap-2 border-white/30 bg-white/10 text-white hover:bg-white/20"
                onClick={() => void loadGrid(filters, page, pageSize)}
                type="button"
                variant="outline"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
            <form className="mb-5 grid gap-3 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-violet-50 to-cyan-50 p-4 md:grid-cols-5" onSubmit={handleSearch}>
              <div className="md:col-span-1">
                <LabeledSelectField label="Employee" value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)}>
                  <option value="">Select employee</option>
                  {employeeOptions.map((emp) => (
                      <option key={emp.id} value={String(emp.id)}>
                        {emp.fullName} • #{emp.id}
                      </option>
                  ))}
                </LabeledSelectField>
              </div>

              <div className="md:col-span-2">
                <SearchableMultiSelect
                    label="Roles"
                    options={roles.map((r) => ({ id: r.id, label: r.name }))}
                    value={topSelectedRoleIds}
                    onChange={(next) => setTopSelectedRoleIds(next)}
                    placeholder="Search roles"
                    resetSignal={multiSelectResetSignal}
                />
              </div>

              <div className="md:col-span-1">
                <FloatingInputField
                    label="Department"
                    onChange={(event) => setFilters((value) => ({ ...value, department: event.target.value }))}
                    value={filters.department}
                />
              </div>

              <div className="md:col-span-1">
                <LabeledSelectField
                    label="Status"
                    onChange={(event) => setFilters((value) => ({ ...value, status: event.target.value }))}
                    value={filters.status}
                >
                  <option value="">Any status</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </LabeledSelectField>
              </div>

              <div className="md:col-span-5 flex flex-wrap items-center justify-end gap-2">
                <Button type="submit" className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 bg-indigo-600 text-white hover:bg-indigo-500">
                  <Search className="h-4 w-4" />
                  <span className="text-sm font-medium">Search</span>
                </Button>

                <Button
                    type="button"
                    onClick={async () => {
                      // Assign selected roles to the selected employee (add-only)
                      if (!accessToken) {
                        toast.error("Session not found. Please login again.");
                        return;
                      }
                      const employeeId = Number(selectedEmployeeId);
                      if (!employeeId) {
                        toast.error("Select an employee to assign roles.");
                        return;
                      }
                      if (topSelectedRoleIds.length === 0) {
                        toast.error("Select at least one role to assign.");
                        return;
                      }
                      try {
                        const result = await assignRolesToEmployee(accessToken, employeeId, {
                          roleIds: topSelectedRoleIds.map((v) => Number(v)),
                        });
                        if (result.createdRoleIds && result.createdRoleIds.length > 0) {
                          toast.success(`Assigned ${result.createdRoleIds.length} new role(s).`);
                        }
                        if (result.existingRoleIds && result.existingRoleIds.length > 0) {
                          toast(`Skipped ${result.existingRoleIds.length} existing role(s).`);
                        }
                        void refreshGridWithCurrentSelection();
                      } catch (error) {
                        if (error instanceof ApiError) {
                          toast.error(error.message || `Unable to assign roles (${error.status})`);
                        } else {
                          toast.error("Unable to assign roles.");
                        }
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-500"
                >
                  <BadgeCheck className="h-4 w-4" />
                  <span className="text-sm font-medium">Assign</span>
                </Button>

                <Button
                    type="button"
                    onClick={() => {
                      setFilters(initialFilters);
                      setPage(0);
                      setSelectedEmployeeId("");
                      setTopSelectedRoleIds([]);
                      // signal multiselect to clear its internal search and close
                      setMultiSelectResetSignal((s) => s + 1);
                    }}
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                >
                  <X className="h-4 w-4" />
                  <span className="text-sm font-medium">Reset</span>
                </Button>
              </div>
            </form>
            <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-gradient-to-r from-indigo-50 via-violet-50 to-cyan-50 text-left text-zinc-800">
                <tr>
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Roles</th>
                  <th className="px-4 py-3 font-medium">Department</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
                </thead>
                <tbody>
                {loading ? (
                    <tr>
                      <td colSpan={5}>
                        <div className="flex justify-center py-10">
                          <Spinner size="md" />
                        </div>
                      </td>
                    </tr>
                ) : employees.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-zinc-500" colSpan={5}>
                        No employees found for selected filters.
                      </td>
                    </tr>
                ) : (
                    employees.map((employee) => (
                        <tr className="border-t border-zinc-200 hover:bg-indigo-50/30" key={employee.id}>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-zinc-900">{employee.fullName}</p>
                            <p className="text-xs text-zinc-500">
                              #{employee.id} • {employee.username}
                            </p>
                            <p className="text-xs text-zinc-500">{employee.email}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1.5">
                              {employee.roles.length > 0 ? (
                                  employee.roles.map((role, index) => (
                                      <span className={`rounded-full border px-2 py-1 text-xs ${roleBadgeClass(index)}`} key={role}>
                                {role}
                              </span>
                                  ))
                              ) : (
                                  <span className="text-zinc-500">-</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-zinc-700">{employee.department}</td>
                          <td className="px-4 py-3">
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(employee.employmentStatus)}`}>
                          {employee.employmentStatus}
                        </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <Button
                                  aria-label={`Delete roles for ${employee.fullName}`}
                                  className="h-9 w-9 rounded-full border-rose-200 bg-rose-50 p-0 text-rose-700 hover:bg-rose-100"
                                  onClick={() => {
                                    // open delete modal to let user pick roles to remove
                                    const options = employee.roles
                                        .map((roleName) => ({
                                          id: roles.find((r) => r.name.toLowerCase() === roleName.toLowerCase())?.id,
                                          label: roleName,
                                        }))
                                        .filter((item) => item.id !== undefined && String(item.id) !== String(employee.primaryRoleId)) as { id: number; label: string }[];
                                    if (options.length === 0) {
                                      toast("No removable roles for this employee.");
                                      return;
                                    }
                                    setDeleteOptions(options);
                                    setSelectedDeleteRoleIds([]);
                                    setDeleteTargetEmployee(employee);
                                    setDeleteModalOpen(true);
                                  }}
                                  size="sm"
                                  title="Delete roles"
                              >
                                <Sparkles className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                    ))
                )}
                </tbody>
              </table>
            </div>
            <DataTablePagination
                onPageChange={(nextPage) => {
                  setPage(nextPage);
                  void loadGrid(filters, nextPage, pageSize);
                }}
                onSizeChange={(nextSize) => {
                  setPage(0);
                  setPageSize(nextSize);
                  void loadGrid(filters, 0, nextSize);
                }}
                page={page}
                size={pageSize}
                totalElements={totalElements}
                totalPages={totalPages}
            />
          </CardContent>
        </Card>

        {assignModalOpen ? (
            <div
                className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/45 backdrop-blur-sm"
                onClick={(event) => {
                  if (event.target === event.currentTarget) {
                    closeAssignModal();
                  }
                }}
            >
              <div className="ml-auto flex h-full w-full max-w-4xl flex-col overflow-hidden border-l border-white/50 bg-white shadow-2xl shadow-slate-300/40">
                <div className="border-b border-zinc-200 bg-linear-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-6 py-5 text-white">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">Edit Employee Roles</h3>
                      <p className="mt-1 text-sm text-indigo-100">Edit existing roles and assign new ones for this employee.</p>
                    </div>
                    <Button className="border-white/30 bg-white/10 text-white hover:bg-white/20" disabled={assignSaving} onClick={closeAssignModal} size="sm" variant="outline">
                      Close
                    </Button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FloatingInputField
                        label="Employee ID"
                        min={1}
                        onChange={(event) => {
                          const value = event.target.value;
                          setAssignEmployeeId(value);
                          if (!value.trim()) {
                            setAssignEmployee(null);
                            setAssignedRoleIds([]);
                            setAssignLoading(false);
                          }
                        }}
                        type="number"
                        value={assignEmployeeId}
                    />

                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                      <p className="text-xs uppercase tracking-wide text-zinc-400">Current Employee</p>
                      {assignLoading ? (
                          <div className="mt-3">
                            <Spinner />
                          </div>
                      ) : assignEmployee ? (
                          <div className="mt-3 space-y-1 text-sm text-zinc-700">
                            <p className="font-semibold text-zinc-900">{assignEmployee.fullName}</p>
                            <p>Username: {assignEmployee.username}</p>
                            <p>Email: {assignEmployee.email}</p>
                            <p>Department: {assignEmployee.department}</p>
                            <p className="pt-1 text-xs text-zinc-500">
                              Roles can be edited below; save updates will replace the current set.
                            </p>
                          </div>
                      ) : (
                          <p className="mt-3 text-sm text-zinc-500">Enter a valid employee id to view current roles.</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.15fr]">
                    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-b from-indigo-50/80 to-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">Existing Roles</p>
                          <p className="mt-1 text-sm text-zinc-600">Roles already assigned to this employee.</p>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-indigo-700 shadow-sm ring-1 ring-indigo-100">
                    {assignEmployee?.roles.length ?? 0} role{assignEmployee?.roles.length === 1 ? "" : "s"}
                  </span>
                      </div>

                      <div className="mt-4 max-h-56 overflow-y-auto rounded-2xl border border-indigo-100 bg-white/85 p-3 shadow-inner">
                        {assignEmployee?.roles.length ? (
                            <div className="flex flex-wrap gap-2">
                              {assignEmployee.roles.map((role, index) => {
                                const roleId = roles.find((item) => item.name.toLowerCase() === role.toLowerCase())?.id;
                                const locked = primaryRoleKey !== null && roleId !== undefined && String(roleId) === primaryRoleKey;
                                return (
                                    <button
                                        className={`group inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-all ${
                                            locked
                                                ? "cursor-default border-amber-200 bg-amber-50 text-amber-800 shadow-sm"
                                                : roleBadgeClass(index)
                                        }`}
                                        key={role}
                                        onClick={() => {
                                          if (locked) {
                                            return;
                                          }
                                          if (!roleId) return;
                                          setAssignEmployee((current) =>
                                              current ? { ...current, roles: current.roles.filter((item) => item !== role) } : current
                                          );
                                          setAssignedRoleIds((current) => current.filter((value) => value !== String(roleId)));
                                        }}
                                        type="button"
                                    >
                                      <span>{role}</span>
                                      <span
                                          className={`flex h-5 w-5 items-center justify-center rounded-full bg-white/80 text-[11px] ${
                                              locked ? "text-amber-600" : "text-zinc-500 group-hover:bg-white"
                                          }`}
                                      >
                              {locked ? <ShieldCheck className="h-3 w-3" /> : <X className="h-3 w-3" />}
                            </span>
                                    </button>
                                );
                              })}
                            </div>
                        ) : (
                            <div className="flex min-h-24 flex-col items-center justify-center rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 px-4 text-center">
                              <p className="text-sm font-medium text-zinc-700">{assignEmployee ? "No roles assigned yet." : "No employee loaded."}</p>
                              <p className="mt-1 text-xs text-zinc-500">Load an employee ID to view the current access list.</p>
                            </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-zinc-700">Assign More Roles</p>
                        <span className="rounded-full bg-white px-3 py-1 text-xs text-zinc-500 ring-1 ring-zinc-200">
                    {visibleRoles.length} available
                  </span>
                      </div>
                      <FloatingInputField
                          label="Search Roles"
                          onChange={(event) => setRoleSearch(event.target.value)}
                          value={roleSearch}
                          wrapperClassName="mt-3"
                      />
                      <div className="mt-3 max-h-[24rem] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-3 shadow-inner">
                        {!assignEmployee ? (
                            <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50 text-sm text-zinc-500">
                              Load an employee first.
                            </div>
                        ) : visibleRoles.length === 0 ? (
                            <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50 text-sm text-zinc-500">
                              No roles match your search.
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                              {visibleRoles.map((role, index) => {
                                const checked = selectedRoleSet.has(String(role.id));
                                const isPrimary = primaryRoleKey !== null && String(role.id) === primaryRoleKey;
                                return (
                                    <button
                                        className={`flex items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-all ${
                                            checked
                                                ? "border-indigo-300 bg-indigo-50 shadow-sm ring-2 ring-indigo-100"
                                                : "border-zinc-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/40"
                                        }`}
                                        disabled={assignSaving || isPrimary}
                                        key={role.id}
                                        onClick={() =>
                                            setAssignedRoleIds((current) =>
                                                checked ? current.filter((value) => value !== String(role.id)) : [...current, String(role.id)]
                                            )
                                        }
                                        type="button"
                                    >
                            <span
                                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                                    checked ? "border-indigo-200 bg-indigo-600 text-white" : roleBadgeClass(index)
                                }`}
                            >
                              {isPrimary ? <ShieldCheck className="h-4 w-4" /> : checked ? <Check className="h-4 w-4" /> : <BadgeCheck className="h-4 w-4" />}
                            </span>
                                      <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-zinc-900">{role.name}</span>
                              <span className="block text-xs text-zinc-500">
                                {isPrimary ? "Primary role (locked)" : role.description ?? "Role access level"}
                              </span>
                            </span>
                                    </button>
                                );
                              })}
                            </div>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-zinc-500">Click any role card to toggle it on or off.</p>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-end gap-2">
                    <Button disabled={assignSaving} onClick={closeAssignModal} type="button" variant="outline">
                      Cancel
                    </Button>
                    <Button disabled={assignSaving || !assignEmployee} onClick={() => void handleAssignRoles()} type="button">
                      <BadgeCheck className="h-4 w-4" />
                      {assignSaving ? "Saving..." : "Save Role Changes"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
        ) : null}


        {deleteModalOpen ? (
            <div
                className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/45 backdrop-blur-sm"
                onClick={(event) => {
                  if (event.target === event.currentTarget) {
                    setDeleteModalOpen(false);
                  }
                }}
            >
              <div className="ml-auto flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-white/50 bg-white shadow-2xl shadow-slate-300/40">
                <div className="border-b border-zinc-200 bg-linear-to-r from-rose-600 via-rose-500 to-rose-400 px-6 py-5 text-white">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">Remove Roles</h3>
                      <p className="mt-1 text-sm text-rose-100">Select roles to remove for this employee.</p>
                    </div>
                    <Button className="border-white/30 bg-white/10 text-white hover:bg-white/20" disabled={deleteSaving} onClick={() => { setDeleteModalOpen(false); }} size="sm" variant="outline">
                      Close
                    </Button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-6">
                  <div className="mt-4">
                    <p className="text-sm font-semibold text-zinc-700">Employee</p>
                    <p className="text-sm text-zinc-600">{deleteTargetEmployee ? `${deleteTargetEmployee.fullName} • #${deleteTargetEmployee.id}` : "-"}</p>
                  </div>

                  <div className="mt-4">
                    <p className="text-xs text-zinc-500">Select roles to remove (primary role is locked)</p>
                    <div className="mt-2 max-h-48 overflow-y-auto rounded-md border p-2">
                      {deleteOptions.map((opt) => (
                          <label key={opt.id} className="flex items-center gap-3 rounded px-2 py-1 hover:bg-zinc-50">
                            <input
                                type="checkbox"
                                checked={selectedDeleteRoleIds.includes(String(opt.id))}
                                onChange={() => {
                                  setSelectedDeleteRoleIds((current) =>
                                      current.includes(String(opt.id)) ? current.filter((v) => v !== String(opt.id)) : [...current, String(opt.id)]
                                  );
                                }}
                            />
                            <div className="min-w-0 truncate text-sm">{opt.label}</div>
                          </label>
                      ))}
                      {deleteOptions.length === 0 ? <div className="p-2 text-sm text-zinc-500">No removable roles.</div> : null}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <Button disabled={deleteSaving} onClick={() => { setDeleteModalOpen(false); }} type="button" variant="outline">
                      Cancel
                    </Button>
                    <Button
                        disabled={deleteSaving || selectedDeleteRoleIds.length === 0}
                        onClick={async () => {
                          if (!accessToken || !deleteTargetEmployee) {
                            toast.error("Session or employee not found.");
                            return;
                          }
                          setDeleteSaving(true);
                          try {
                            const result = await removeRolesFromEmployee(accessToken, deleteTargetEmployee.id, {
                              roleIds: selectedDeleteRoleIds.map((v) => Number(v)),
                            });
                            if (result.removedRoleIds && result.removedRoleIds.length > 0) {
                              toast.success(`Removed ${result.removedRoleIds.length} role(s).`);
                            }
                            if (result.notAssignedRoleIds && result.notAssignedRoleIds.length > 0) {
                              toast(`Skipped ${result.notAssignedRoleIds.length} not-assigned role(s).`);
                            }
                            // refresh grid and close
                            setDeleteModalOpen(false);
                            void refreshGridWithCurrentSelection();
                            // if assign modal open and same employee, update assignEmployee
                            if (assignModalOpen && deleteTargetEmployee && String(assignEmployeeId) === String(deleteTargetEmployee.id)) {
                              try {
                                const updated = await getRoleAuditEmployeeById(accessToken, deleteTargetEmployee.id);
                                setAssignEmployee(updated);
                              } catch {}
                            }
                          } catch (error) {
                            if (error instanceof ApiError) {
                              toast.error(error.message || `Unable to remove roles (${error.status})`);
                            } else {
                              toast.error("Unable to remove roles.");
                            }
                          } finally {
                            setDeleteSaving(false);
                          }
                        }}
                        type="button"
                    >
                      {deleteSaving ? "Removing..." : "Remove selected"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
        ) : null}

      </>
  );
}
