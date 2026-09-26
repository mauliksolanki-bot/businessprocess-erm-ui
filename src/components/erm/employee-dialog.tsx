"use client";

import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { CalendarDays, Mail, Save, ShieldCheck, UserRound } from "lucide-react";

import type { Employee, EmployeeDirectReport, OnboardingDesignationOption, OnboardingManagerOption } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FloatingInputField, LabeledSelectField } from "@/components/ui/form-fields";

type EmployeeDialogProps = {
    employee: Employee | null;
    mode: "view" | "edit";
    open: boolean;
    saving?: boolean;
    hasPendingRequest?: boolean;
    designationOptions?: OnboardingDesignationOption[];
    managerOptions?: OnboardingManagerOption[];
    managerRoleName?: string;
    managersLoading?: boolean;
    managerEditable?: boolean;
    directReports?: EmployeeDirectReport[];
    replacementTeamLeadOptions?: OnboardingManagerOption[];
    replacementOptionsLoading?: boolean;
    onDesignationChange?: (designationRoleName: string) => void;
    onClose: () => void;
    onSave: (employeeId: number, payload: EmployeeEditForm) => Promise<void>;
};

export type EmployeeEditForm = {
    employeeId: string;
    fullName: string;
    email: string;
    department: string;
    employmentStatus: string;
    designationRoleName: string;
    reportingManagerUserId: string;
    replacementTeamLeadUserId: string;
};

function currentDesignation(employee: Employee) {
    if (employee.primaryRoleName?.trim()) return employee.primaryRoleName;
    if (!employee.roles.length) return "";
    return [...employee.roles].sort()[0];
}

export function EmployeeDialog({
                                   employee,
                                   mode,
                                   open,
                                   saving = false,
                                   hasPendingRequest = false,
                                   designationOptions = [],
                                   managerOptions = [],
                                   managerRoleName = "",
                                   managersLoading = false,
                                   managerEditable = false,
                                   directReports = [],
                                   replacementTeamLeadOptions = [],
                                   replacementOptionsLoading = false,
                                   onDesignationChange,
                                   onClose,
                                   onSave,
                               }: EmployeeDialogProps) {
    const [form, setForm] = useState<EmployeeEditForm>({
        employeeId: employee?.employeeId ?? "",
        fullName: employee?.fullName ?? "",
        email: employee?.email ?? "",
        department: employee?.department ?? "",
        employmentStatus: employee?.employmentStatus ?? "Active",
        designationRoleName: employee ? currentDesignation(employee) : "",
        reportingManagerUserId: employee?.reportingManagerUserId ? String(employee.reportingManagerUserId) : "",
        replacementTeamLeadUserId: "",
    });

    const viewDesignation = useMemo(() => (employee ? currentDesignation(employee) : "-"), [employee]);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (mode !== "edit" || !employee) return;
        await onSave(employee.id, form);
    }

    if (!open || !employee) {
        return null;
    }

    const currentEmployee = employee;
    const isMovingDesignation = form.designationRoleName.trim().toLowerCase() !== currentDesignation(currentEmployee).toLowerCase();
    const showReplacementSection = directReports.length > 0 && isMovingDesignation;
    const filteredReplacementTeamLeadOptions = replacementTeamLeadOptions.filter((option) => option.id !== currentEmployee.id);
    const showFooterActions = mode === "edit" && !hasPendingRequest;

    return (
        <div
            onClick={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
            className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/45 backdrop-blur-sm"
        >
            <div className="ml-auto flex h-full w-full max-w-3xl flex-col overflow-hidden border-l border-white/50 bg-white shadow-2xl shadow-slate-900/20">
                <div className="flex items-start justify-between border-b border-zinc-200 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 px-5 py-4 text-white sm:px-6 sm:py-5">
                    <div className="min-w-0 pr-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-100">{mode === "view" ? "Employee profile" : "Edit employee"}</p>
                        <h2 className="mt-1 break-words text-xl font-semibold sm:text-2xl">{currentEmployee.fullName}</h2>
                        <p className="mt-1 break-words text-sm text-blue-100">{currentEmployee.department}</p>
                    </div>
                    <div className="shrink-0 text-right">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-100">Last updated</p>
                        <p className="mt-1 text-sm font-medium text-white">{formatDate(currentEmployee.updatedAt)}</p>
                    </div>
                </div>

                <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
                    <div className="min-h-0 overflow-y-auto p-5 sm:p-6">
                        {mode === "view" ? (
                            <Card className="border-0 bg-gradient-to-br from-blue-50 via-white to-indigo-50 shadow-none">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-zinc-900">
                                        <UserRound className="h-5 w-5 text-blue-600" />
                                        Employee summary
                                    </CardTitle>
                                    <CardDescription>Quick overview of profile, role, and reporting details.</CardDescription>
                                </CardHeader>
                                <CardContent className="grid gap-4">
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <InfoTile icon={<UserRound className="h-4 w-4 text-blue-600" />} label="Full name" value={currentEmployee.fullName} />
                                        <InfoTile icon={<UserRound className="h-4 w-4 text-blue-600" />} label="Employee ID" value={currentEmployee.employeeId ?? "Employee ID pending"} />
                                        <InfoTile icon={<Mail className="h-4 w-4 text-blue-600" />} label="Email" value={currentEmployee.email} />
                                        <InfoTile icon={<ShieldCheck className="h-4 w-4 text-blue-600" />} label="Department" value={currentEmployee.department} />
                                        <InfoTile icon={<ShieldCheck className="h-4 w-4 text-blue-600" />} label="Status" value={currentEmployee.employmentStatus} />
                                        <InfoTile icon={<ShieldCheck className="h-4 w-4 text-blue-600" />} label="Designation" value={viewDesignation || "-"} />
                                        <InfoTile icon={<UserRound className="h-4 w-4 text-blue-600" />} label="Reporting manager" value={currentEmployee.reportingManagerFullName ?? "-"} />
                                        <InfoTile icon={<ShieldCheck className="h-4 w-4 text-blue-600" />} label="Manager role" value={currentEmployee.reportingManagerRoleName ?? "-"} />
                                        <InfoTile icon={<CalendarDays className="h-4 w-4 text-blue-600" />} label="Joined" value={formatDate(currentEmployee.createdAt)} />
                                    </div>
                                    <div>
                                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Assigned roles</p>
                                        <div className="flex flex-wrap gap-2">
                                            {currentEmployee.roles.map((role) => (
                                                <span className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-medium text-blue-700" key={role}>
                          {role}
                        </span>
                                            ))}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ) : hasPendingRequest ? (
                            <div className="flex flex-col items-center justify-center gap-5 rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 px-6 py-12 text-center shadow-inner">
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
                                    <ShieldCheck className="h-8 w-8 text-amber-500" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-amber-800">Update Request In Progress</h3>
                                    <p className="mt-2 max-w-sm text-sm text-amber-700">
                                        A profile update request for <span className="font-semibold">{currentEmployee.fullName}</span> is
                                        currently awaiting approval. Please wait until the existing request is fully approved or rejected
                                        before submitting a new one.
                                    </p>
                                </div>
                                <div className="rounded-xl border border-amber-200 bg-white/70 px-4 py-3 text-xs text-amber-700">
                                    You can track the status in the <span className="font-semibold">Request Track</span> menu.
                                </div>
                            </div>
                        ) : (
                            <Card className="border-zinc-200 shadow-none">
                                <CardContent className="grid gap-4 md:grid-cols-2">
                                    <FloatingInputField disabled label="Employee ID" value={form.employeeId} />
                                    <FloatingInputField disabled label="Full Name" value={form.fullName} />
                                    <FloatingInputField disabled label="Email Address" type="email" value={form.email} />
                                    <FloatingInputField
                                        disabled={saving}
                                        label="Department"
                                        onChange={(event) => setForm((value) => ({ ...value, department: event.target.value }))}
                                        value={form.department}
                                    />
                                    <LabeledSelectField
                                        disabled={saving}
                                        label="Employment Status"
                                        onChange={(event) => setForm((value) => ({ ...value, employmentStatus: event.target.value }))}
                                        value={form.employmentStatus}
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                    </LabeledSelectField>
                                    <LabeledSelectField
                                        disabled={saving || !managerEditable || designationOptions.length === 0}
                                        label="Designation"
                                        onChange={(event) => {
                                            const value = event.target.value;
                                            setForm((current) => ({
                                                ...current,
                                                designationRoleName: value,
                                                reportingManagerUserId: "",
                                                replacementTeamLeadUserId: "",
                                            }));
                                            onDesignationChange?.(value);
                                        }}
                                        value={form.designationRoleName}
                                    >
                                        <option value="">Select designation</option>
                                        {designationOptions.map((option) => (
                                            <option key={option.designationRoleName} value={option.designationRoleName}>
                                                {option.designationRoleName}
                                            </option>
                                        ))}
                                    </LabeledSelectField>
                                    <LabeledSelectField
                                        className="disabled:bg-zinc-100"
                                        disabled={saving || !managerEditable || !form.designationRoleName}
                                        label={`Reporting Manager${managerRoleName ? ` (${managerRoleName})` : ""}`}
                                        onChange={(event) => setForm((value) => ({ ...value, reportingManagerUserId: event.target.value }))}
                                        value={form.reportingManagerUserId}
                                    >
                                        <option value="">{managersLoading ? "Loading..." : "Select manager"}</option>
                                        {managerOptions.map((manager) => (
                                            <option key={manager.id} value={manager.id}>
                                                {manager.fullName} ({manager.username})
                                            </option>
                                        ))}
                                    </LabeledSelectField>
                                    {showReplacementSection ? (
                                        <div className="rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-4 md:col-span-2">
                                            <div className="flex flex-col gap-4">
                                                <div>
                                                    <p className="text-sm font-semibold text-violet-900">Reporting reassignment required</p>
                                                    <p className="mt-1 text-sm text-violet-700">
                                                        This employee currently has direct reports. They must move to another reporting manager
                                                        when this promotion is approved.
                                                    </p>
                                                </div>

                                                <LabeledSelectField
                                                    className="disabled:bg-zinc-100"
                                                    disabled={saving || replacementOptionsLoading || directReports.length === 0}
                                                    label="Replacement Reporting Manager"
                                                    onChange={(event) => setForm((value) => ({ ...value, replacementTeamLeadUserId: event.target.value }))}
                                                    value={form.replacementTeamLeadUserId}
                                                >
                                                    <option value="">
                                                        {replacementOptionsLoading
                                                            ? "Loading replacement managers..."
                                                            : directReports.length === 0
                                                                ? "No replacement required"
                                                                : "Select replacement manager"}
                                                    </option>
                                                    {filteredReplacementTeamLeadOptions.map((manager) => (
                                                        <option key={manager.id} value={manager.id}>
                                                            {manager.fullName} ({manager.username})
                                                        </option>
                                                    ))}
                                                </LabeledSelectField>

                                                <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <p className="text-sm font-semibold text-zinc-900">Impacted direct reports</p>
                                                        <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                              {directReports.length} employee{directReports.length === 1 ? "" : "s"}
                            </span>
                                                    </div>
                                                    {replacementOptionsLoading ? (
                                                        <p className="mt-3 text-sm text-zinc-500">Loading reporting details...</p>
                                                    ) : directReports.length === 0 ? (
                                                        <p className="mt-3 text-sm text-zinc-500">No direct reports are currently assigned to this employee.</p>
                                                    ) : (
                                                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                                            {directReports.map((report) => (
                                                                <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-3" key={report.id}>
                                                                    <p className="text-sm font-semibold text-zinc-900">{report.fullName}</p>
                                                                    <p className="text-xs text-zinc-500">{report.username}</p>
                                                                    <p className="mt-1 text-xs text-zinc-600">
                                                                        {report.designationRoleName} • {report.employmentStatus}
                                                                    </p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {!replacementOptionsLoading && directReports.length > 0 && filteredReplacementTeamLeadOptions.length === 0 ? (
                                                        <p className="mt-3 text-sm text-rose-600">No other active manager with the same designation is available for reassignment.</p>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </div>
                                    ) : null}
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {showFooterActions ? (
                        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 px-4 py-4 sm:px-6">
                            <Button className="gap-2" disabled={saving} type="submit">
                                <Save className="h-4 w-4" />
                                {saving ? "Saving..." : "Save changes"}
                            </Button>
                        </div>
                    ) : null}
                </form>
            </div>
        </div>
    );
}

function InfoTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
    return (
        <div className="min-w-0 rounded-2xl bg-white/80 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {icon}
                {label}
            </div>
            <p className="mt-2 break-words text-sm font-medium leading-6 text-zinc-900">{value}</p>
        </div>
    );
}

function formatDate(value: string) {
    return new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value));
}
