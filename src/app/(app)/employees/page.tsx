"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Check, Copy, Eye, KeyRound, PencilLine, Search, ShieldAlert, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { DataTablePagination } from "@/components/erm/data-table-pagination";
import { EmployeeDialog, type EmployeeEditForm } from "@/components/erm/employee-dialog";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FloatingInputField, LabeledSelectField } from "@/components/ui/form-fields";
import {
  ApiError,
  checkPendingProfileUpdateRequest,
  createEmployeeProfileUpdateRequest,
  getEmployeeById,
  getEmployeeDirectReports,
  getEmployeeReplacementOptions,
  getEmployees,
  getOnboardingDesignationOptions,
  getOnboardingManagerOptions,
  type Employee,
  type EmployeePasswordResetResponse,
  type EmployeeDirectReport,
  type OnboardingDesignationOption,
  type OnboardingManagerOption,
  resetEmployeePassword,
  updateEmployee,
} from "@/lib/api";
import { loadSession } from "@/lib/auth-storage";

type EmployeeFilters = {
  employeeName: string;
  role: string;
  department: string;
  status: string;
};

const initialFilters: EmployeeFilters = {
  employeeName: "",
  role: "",
  department: "",
  status: "",
};

function getEmployeeDesignation(employee: Employee) {
  if (employee.primaryRoleName?.trim()) {
    return employee.primaryRoleName;
  }
  return [...employee.roles].sort()[0] ?? "";
}

function statusClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "active") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (normalized === "inactive") {
    return "bg-rose-50 text-rose-700 border-rose-200";
  }
  return "bg-amber-50 text-amber-700 border-amber-200";
}

export default function EmployeesPage() {
  const [filters, setFilters] = useState<EmployeeFilters>(initialFilters);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [dialogEmployee, setDialogEmployee] = useState<Employee | null>(null);
  const [dialogMode, setDialogMode] = useState<"view" | "edit">("view");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [dialogSaving, setDialogSaving] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [designationOptions, setDesignationOptions] = useState<OnboardingDesignationOption[]>([]);
  const [managerOptions, setManagerOptions] = useState<OnboardingManagerOption[]>([]);
  const [managerRoleName, setManagerRoleName] = useState("");
  const [isLoadingManagers, setIsLoadingManagers] = useState(false);
  const [directReports, setDirectReports] = useState<EmployeeDirectReport[]>([]);
  const [replacementTeamLeadOptions, setReplacementTeamLeadOptions] = useState<OnboardingManagerOption[]>([]);
  const [isLoadingPromotionReassignment, setIsLoadingPromotionReassignment] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [passwordResetEmployee, setPasswordResetEmployee] = useState<Employee | null>(null);
  const [passwordResetResult, setPasswordResetResult] = useState<EmployeePasswordResetResponse | null>(null);
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const roleNames = useMemo(() => (loadSession()?.roles ?? []).map((role) => role.toLowerCase()), []);
  const hasSeniorHrRole = roleNames.includes("senior hr");
  const canEditEmployees = hasSeniorHrRole;
  const canResetEmployeePasswords = roleNames.includes("admin");

  function getAccessToken() {
    const session = loadSession();
    if (!session?.accessToken) {
      toast.error("Session not found. Please login again.");
      return null;
    }
    return session.accessToken;
  }

  async function fetchEmployees(nextFilters?: EmployeeFilters, nextPage = page, nextSize = pageSize) {
    const accessToken = getAccessToken();
    if (!accessToken) {
      setIsInitialLoading(false);
      return;
    }

    try {
      const result = await getEmployees(accessToken, nextFilters ?? filters, nextPage, nextSize);
      setEmployees(result.content);
      setTotalElements(result.totalElements);
      setTotalPages(result.totalPages);
      setPage(result.page);
      setPageSize(result.size);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        toast.error("You are not authorized to view employees.");
      } else {
        toast.error("Unable to fetch employees.");
      }
    } finally {
      setIsLoading(false);
      setIsInitialLoading(false);
    }
  }

  function resetPromotionReassignmentState() {
    setDirectReports([]);
    setReplacementTeamLeadOptions([]);
    setIsLoadingPromotionReassignment(false);
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHasSearched(true);
    setIsLoading(true);
    setPage(0);
    await fetchEmployees(filters, 0, pageSize);
  }

  async function openEmployeeDialog(employeeId: number, mode: "view" | "edit") {
    const accessToken = getAccessToken();
    if (!accessToken) {
      return;
    }
    if (mode === "edit" && !canEditEmployees) {
      toast.error("You are not authorized to edit employee details.");
      return;
    }

    setDialogMode(mode);
    setDialogOpen(true);
    setDialogLoading(true);
    setHasPendingRequest(false);
    resetPromotionReassignmentState();

    try {
      const promises: [Promise<Employee>, Promise<OnboardingDesignationOption[]>?] = [getEmployeeById(accessToken, employeeId)];
      if (mode === "edit" && hasSeniorHrRole) {
        promises.push(getOnboardingDesignationOptions(accessToken));
      }
      const [employee, designations] = await Promise.all(promises);
      setDialogEmployee(employee);

      if (mode === "edit" && hasSeniorHrRole) {
        // Check for pending request before allowing edit
        const { hasPendingRequest: pending } = await checkPendingProfileUpdateRequest(accessToken, employeeId);
        setHasPendingRequest(pending);

        if (!pending && designations) {
          setDesignationOptions(designations);
          const initialDesignation = getEmployeeDesignation(employee);
          if (initialDesignation) {
            await loadManagerOptions(initialDesignation);
          } else {
            setManagerOptions([]);
            setManagerRoleName("");
          }
        }
      } else if (mode === "edit" && designations) {
        setDesignationOptions(designations);
        const initialDesignation = getEmployeeDesignation(employee);
        if (initialDesignation) {
          await loadManagerOptions(initialDesignation);
        } else {
          setManagerOptions([]);
          setManagerRoleName("");
        }
      }
    } catch (error) {
      setDialogOpen(false);
      if (error instanceof ApiError && error.status === 404) {
        toast.error("Employee record not found.");
      } else {
        toast.error("Unable to load employee details.");
      }
    } finally {
      setDialogLoading(false);
    }
  }

  async function loadManagerOptions(designationRoleName: string) {
    const accessToken = getAccessToken();
    if (!accessToken) {
      return;
    }
    if (!designationRoleName.trim()) {
      setManagerOptions([]);
      setManagerRoleName("");
      return;
    }
    setIsLoadingManagers(true);
    try {
      const response = await getOnboardingManagerOptions(accessToken, designationRoleName.trim());
      setManagerRoleName(response.managerRoleName);
      setManagerOptions(response.managers);
    } catch {
      setManagerRoleName("");
      setManagerOptions([]);
      toast.error("Unable to load reporting managers.");
    } finally {
      setIsLoadingManagers(false);
    }
  }

  async function handleDesignationChange(designationRoleName: string) {
    const accessToken = getAccessToken();
    if (!accessToken || !dialogEmployee) {
      return;
    }

    const currentDesignation = getEmployeeDesignation(dialogEmployee);
    const requiresReassignment = currentDesignation.toLowerCase() !== designationRoleName.trim().toLowerCase();

    if (!requiresReassignment) {
      resetPromotionReassignmentState();
      await loadManagerOptions(designationRoleName);
      return;
    }

    setIsLoadingPromotionReassignment(true);
    try {
      const [nextManagerOptions, nextDirectReports] = await Promise.all([
        getOnboardingManagerOptions(accessToken, designationRoleName.trim()),
        getEmployeeDirectReports(accessToken, dialogEmployee.id),
      ]);
      setManagerRoleName(nextManagerOptions.managerRoleName);
      setManagerOptions(nextManagerOptions.managers);
      setDirectReports(nextDirectReports);

      if (nextDirectReports.length > 0) {
        const replacementOptions = await getEmployeeReplacementOptions(accessToken, dialogEmployee.id);
        setReplacementTeamLeadOptions(replacementOptions);
      } else {
        setReplacementTeamLeadOptions([]);
      }
    } catch {
      resetPromotionReassignmentState();
      toast.error("Unable to load promotion reassignment details.");
    } finally {
      setIsLoadingPromotionReassignment(false);
    }
  }

  async function handleSaveEmployee(employeeId: number, payload: EmployeeEditForm) {
    const accessToken = getAccessToken();
    if (!accessToken) {
      return;
    }

    setDialogSaving(true);
    try {
      if (hasSeniorHrRole) {
        const requiresReassignment =
            dialogEmployee &&
            getEmployeeDesignation(dialogEmployee).toLowerCase() !== payload.designationRoleName.trim().toLowerCase();
        if (!payload.designationRoleName.trim()) {
          toast.error("Please select designation.");
          return;
        }
        if (!payload.reportingManagerUserId) {
          toast.error("Please select reporting manager.");
          return;
        }
        if (Number(payload.reportingManagerUserId) === employeeId) {
          toast.error("Employee and reporting manager cannot be same.");
          return;
        }
        if (requiresReassignment && directReports.length > 0 && !payload.replacementTeamLeadUserId) {
          toast.error("Please select replacement manager for direct reports.");
          return;
        }
        await createEmployeeProfileUpdateRequest(accessToken, {
          employeeUserId: employeeId,
          department: payload.department,
          employmentStatus: payload.employmentStatus,
          designationRoleName: payload.designationRoleName,
          reportingManagerUserId: Number(payload.reportingManagerUserId),
          replacementTeamLeadUserId: payload.replacementTeamLeadUserId
              ? Number(payload.replacementTeamLeadUserId)
              : undefined,
        });
        toast.success("Update request submitted for approval.");
      } else {
        const updatedEmployee = await updateEmployee(accessToken, employeeId, payload);
        setDialogEmployee(updatedEmployee);
        toast.success("Employee updated successfully.");
      }
      await fetchEmployees(filters);
      setDialogOpen(false);
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        toast.error("Please review employee details before saving/submitting.");
      } else if (error instanceof ApiError && error.status === 403) {
        toast.error("You are not authorized for this action.");
      } else {
        toast.error("Unable to process employee update.");
      }
    } finally {
      setDialogSaving(false);
    }
  }

  function closeDialog() {
    if (dialogSaving) {
      return;
    }
    setDialogOpen(false);
    setDialogEmployee(null);
    setHasPendingRequest(false);
    setDesignationOptions([]);
    setManagerOptions([]);
    setManagerRoleName("");
    resetPromotionReassignmentState();
  }

  function openPasswordReset(employee: Employee) {
    setPasswordResetEmployee(employee);
    setPasswordResetResult(null);
    setPasswordCopied(false);
  }

  function closePasswordReset() {
    if (passwordResetLoading) return;
    setPasswordResetEmployee(null);
    setPasswordResetResult(null);
    setPasswordCopied(false);
  }

  async function confirmPasswordReset() {
    if (!passwordResetEmployee) return;
    const accessToken = getAccessToken();
    if (!accessToken) return;

    setPasswordResetLoading(true);
    try {
      const result = await resetEmployeePassword(accessToken, passwordResetEmployee.id);
      setPasswordResetResult(result);
      toast.success("Password reset successfully.");
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        toast.error("Only Admin users can reset employee passwords.");
      } else if (error instanceof ApiError && error.status === 404) {
        toast.error("Employee record not found.");
      } else {
        toast.error("Unable to reset this employee's password. Please try again.");
      }
    } finally {
      setPasswordResetLoading(false);
    }
  }

  async function copyTemporaryPassword() {
    if (!passwordResetResult) return;
    try {
      await navigator.clipboard.writeText(passwordResetResult.temporaryPassword);
      setPasswordCopied(true);
      toast.success("Temporary password copied.");
    } catch {
      toast.error("Unable to copy the password. Please select and copy it manually.");
    }
  }

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (dialogOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [dialogOpen]);

  useEffect(() => {
    setHasSearched(true);
    setIsLoading(true);
    void fetchEmployees(initialFilters, 0, pageSize);
  }, []);

  return (
      <>
        <Card className="mb-6 overflow-hidden border-blue-100 shadow-md shadow-blue-100/40">
          <CardHeader className="flex min-h-[152px] flex-col gap-3 rounded-t-2xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-white">
                <Sparkles className="h-5 w-5" />
                Employees
              </CardTitle>
              <CardDescription className="text-indigo-100">Search employee records, inspect details, and update data in the same premium workflow style.</CardDescription>
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-2 md:max-w-[360px]">
              <SummaryPill label="Visible employees" value={totalElements} />
              <SummaryPill label="Current page" value={page + 1} />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <form className="mb-3 grid gap-3 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-indigo-50 to-cyan-50 p-4 md:grid-cols-5" onSubmit={handleSearch}>
              <FloatingInputField
                  label="Employee Name or ID"
                  onChange={(event) => setFilters((value) => ({ ...value, employeeName: event.target.value }))}
                  value={filters.employeeName}
              />
              <FloatingInputField label="Role" onChange={(event) => setFilters((value) => ({ ...value, role: event.target.value }))} value={filters.role} />
              <FloatingInputField
                  label="Department"
                  onChange={(event) => setFilters((value) => ({ ...value, department: event.target.value }))}
                  value={filters.department}
              />
              <LabeledSelectField
                  label="Status"
                  onChange={(event) => setFilters((value) => ({ ...value, status: event.target.value }))}
                  value={filters.status}
              >
                <option value="">Any status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </LabeledSelectField>
              <div className="flex gap-2">
                <Button className="gap-2" type="submit" variant="secondary">
                  <Search className="h-4 w-4" />
                  Search
                </Button>
                <Button
                    onClick={() => {
                      setFilters(initialFilters);
                      setHasSearched(true);
                      setIsLoading(true);
                      setPage(0);
                      void fetchEmployees(initialFilters, 0, pageSize);
                    }}
                    type="button"
                    variant="outline"
                >
                  Reset
                </Button>
              </div>
            </form>
            {isInitialLoading ? (
                <div className="flex min-h-[22rem] items-center justify-center rounded-2xl border border-dashed border-sky-200 bg-white/70">
                  <Spinner size="lg" />
                </div>
            ) : (
                <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
                  <table className="w-full min-w-[760px] text-sm">
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
                    {isLoading ? (
                        <tr>
                          <td colSpan={5}>
                            <div className="flex justify-center py-10">
                              <Spinner size="md" label="Fetching employees..." />
                            </div>
                          </td>
                        </tr>
                    ) : !hasSearched ? (
                        <tr>
                          <td className="px-4 py-6 text-zinc-500" colSpan={5}>
                            Enter any filter value and click Search to view matching employees.
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
                            <tr className="border-t border-zinc-200 hover:bg-blue-50/30" key={employee.id}>
                              <td className="px-4 py-3">
                                <p className="font-semibold text-zinc-900">{employee.fullName}</p>
                                <p className="text-xs text-blue-700">{employee.employeeId ?? "Employee ID pending"}</p>
                                <p className="text-xs text-zinc-500">{employee.email}</p>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-1.5">
                                  {employee.roles.map((role) => (
                                      <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700" key={role}>
                                {role}
                              </span>
                                  ))}
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
                                      aria-label={`View ${employee.fullName}`}
                                      className="h-9 w-9 rounded-full border-sky-200 bg-sky-50 p-0 text-sky-700 hover:bg-sky-100"
                                      onClick={() => void openEmployeeDialog(employee.id, "view")}
                                      size="sm"
                                      title="View employee"
                                      variant="outline"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  {canResetEmployeePasswords ? (
                                      <Button
                                          aria-label={`Reset password for ${employee.fullName}`}
                                          className="h-9 w-9 rounded-full border-amber-200 bg-amber-50 p-0 text-amber-700 hover:bg-amber-100"
                                          onClick={() => openPasswordReset(employee)}
                                          size="sm"
                                          title="Reset password"
                                          variant="outline"
                                      >
                                        <KeyRound className="h-4 w-4" />
                                      </Button>
                                  ) : null}
                                  {canEditEmployees ? (
                                      <Button
                                          aria-label={`Edit ${employee.fullName}`}
                                          className="h-9 w-9 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 p-0 text-white hover:from-blue-500 hover:to-indigo-500"
                                          onClick={() => void openEmployeeDialog(employee.id, "edit")}
                                          size="sm"
                                          title="Edit employee"
                                      >
                                        <PencilLine className="h-4 w-4" />
                                      </Button>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                        ))
                    )}
                    </tbody>
                  </table>
                </div>
            )}
            {hasSearched && !isLoading && totalPages > 0 ? (
                <DataTablePagination
                    page={page}
                    size={pageSize}
                    totalElements={totalElements}
                    totalPages={totalPages}
                    onPageChange={(nextPage) => {
                      setIsLoading(true);
                      void fetchEmployees(filters, nextPage, pageSize);
                    }}
                    onSizeChange={(nextSize) => {
                      setIsLoading(true);
                      setPage(0);
                      void fetchEmployees(filters, 0, nextSize);
                    }}
                />
            ) : null}
          </CardContent>
        </Card>
        {dialogOpen ? (
            dialogLoading ? (
                <div
                    onClick={(event) => {
                      if (event.target === event.currentTarget) {
                        closeDialog();
                      }
                    }}
                    className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/45 backdrop-blur-sm"
                >
                  <div className="ml-auto flex h-full w-full max-w-3xl items-center justify-center border-l border-white/50 bg-white shadow-2xl shadow-slate-900/20">
                    <Spinner size="md" label="Loading employee details..." />
                  </div>
                </div>
            ) : (
                <EmployeeDialog
                    key={dialogEmployee ? `${dialogMode}-${dialogEmployee.id}-${dialogEmployee.updatedAt}` : dialogMode}
                    employee={dialogEmployee}
                    mode={dialogMode}
                    hasPendingRequest={hasPendingRequest}
                    onClose={closeDialog}
                    designationOptions={designationOptions}
                    managerOptions={managerOptions}
                    managerRoleName={managerRoleName}
                    managersLoading={isLoadingManagers}
                    managerEditable={hasSeniorHrRole}
                    directReports={directReports}
                    replacementTeamLeadOptions={replacementTeamLeadOptions}
                    replacementOptionsLoading={isLoadingPromotionReassignment}
                    onDesignationChange={(designationRoleName) => void handleDesignationChange(designationRoleName)}
                    onSave={handleSaveEmployee}
                    open={dialogOpen}
                    saving={dialogSaving}
                />
            )
        ) : null}
        {passwordResetEmployee ? (
          <div
              aria-labelledby="password-reset-title"
              aria-modal="true"
              className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
              onClick={(event) => {
                if (event.target === event.currentTarget) closePasswordReset();
              }}
              role="dialog"
          >
            <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/60 bg-white shadow-2xl shadow-slate-950/30">
              <div className="flex items-start justify-between gap-4 bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 px-5 py-5 text-white sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
                    {passwordResetResult ? <Check className="h-5 w-5" /> : <KeyRound className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-100">Employee security</p>
                    <h2 className="mt-1 text-lg font-semibold" id="password-reset-title">
                      {passwordResetResult ? "Password reset complete" : "Reset employee password"}
                    </h2>
                  </div>
                </div>
                {!passwordResetLoading ? (
                  <Button aria-label="Close password reset" className="h-9 w-9 shrink-0 rounded-full border-white/40 bg-white/10 p-0 text-white hover:bg-white/20" onClick={closePasswordReset} size="sm" variant="outline">
                    <X className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>

              <div className="space-y-5 p-5 sm:p-6">
                {!passwordResetResult ? (
                  <>
                    <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                      <div>
                        <p className="font-semibold">Are you sure that you want to reset the password of user - {passwordResetEmployee.employeeId || "Employee ID pending"}</p>
                        <p className="mt-1 text-xs leading-relaxed text-amber-800">The current password will stop working immediately. A new temporary password will be shown here after confirmation.</p>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button disabled={passwordResetLoading} onClick={closePasswordReset} type="button" variant="outline">Cancel</Button>
                      <Button className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500" disabled={passwordResetLoading} onClick={() => void confirmPasswordReset()} type="button">
                        <KeyRound className="h-4 w-4" />
                        {passwordResetLoading ? "Resetting..." : "Reset password"}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                      <p className="font-semibold">Password reset successfully for {passwordResetResult.employeeIdCode || passwordResetEmployee.fullName}.</p>
                      <p className="mt-1 text-xs leading-relaxed">Copy the temporary password now. It will no longer be visible after this popup is closed.</p>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500" htmlFor="temporary-password">Temporary password</label>
                      <div className="flex items-center gap-2 rounded-xl border border-zinc-300 bg-zinc-50 p-2">
                        <input
                            className="min-w-0 flex-1 bg-transparent px-2 font-mono text-base font-semibold tracking-wide text-zinc-900 outline-none"
                            id="temporary-password"
                            readOnly
                            value={passwordResetResult.temporaryPassword}
                        />
                        <Button aria-label="Copy temporary password" className="h-10 w-10 shrink-0 border-blue-200 bg-blue-50 p-0 text-blue-700 hover:bg-blue-100" onClick={() => void copyTemporaryPassword()} title="Copy password" type="button" variant="outline">
                          {passwordCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={closePasswordReset} type="button" variant="secondary">Done</Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </>
  );
}

function SummaryPill({ label, value }: { label: string; value: number }) {
  return (
      <div className="h-[68px] w-full min-w-0 overflow-hidden rounded-2xl bg-white/15 px-4 py-3 ring-1 ring-white/20">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/65">{label}</p>
        <p className="mt-1 text-xl font-semibold leading-none tabular-nums text-white">{value.toLocaleString()}</p>
      </div>
  );
}
