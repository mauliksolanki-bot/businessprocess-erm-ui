"use client";

import { FormEvent, type ReactNode, useCallback, useEffect, useState } from "react";
import { BadgeCheck, BriefcaseBusiness, CalendarDays, Check, Eye, GraduationCap, Landmark, Lock, Mail, Pencil, Phone, ShieldCheck, User, UserRound, X } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/erm/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FixedInputField, LabeledSelectField } from "@/components/ui/form-fields";
import { Spinner } from "@/components/ui/spinner";
import {
  ApiError,
  getCurrentUser,
  getCurrentUserBankDetails,
  getCurrentUserTeamMemberDetails,
  getCurrentUserTeamMembers,
  saveCurrentUserBankDetails,
  updateCurrentUserProfile,
  type BankAccountType,
  type BankDetails,
  type UserProfile,
  type TeamMemberDetails,
  type TeamMemberSummary,
} from "@/lib/api";
import { loadSession } from "@/lib/auth-storage";

type ProfileForm = {
  personalEmailAddress: string;
  phoneNumber: string;
  educationQualification: string;
};

const emptyProfileForm: ProfileForm = {
  personalEmailAddress: "",
  phoneNumber: "",
  educationQualification: "",
};

type BankForm = {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifscCode: string;
  branchName: string;
  accountType: BankAccountType;
};

const emptyBankForm: BankForm = {
  accountHolderName: "",
  bankName: "",
  accountNumber: "",
  confirmAccountNumber: "",
  ifscCode: "",
  branchName: "",
  accountType: "SAVINGS",
};

function formatProfileDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function getBankDetailsErrorMessage(error: unknown) {
  const fallback = error instanceof ApiError && error.status === 401
      ? "Your session has expired. Please sign in again."
      : error instanceof ApiError && error.status === 403
          ? "You don't have permission to update bank details."
          : error instanceof ApiError && error.status >= 500
              ? "We couldn't save your bank details right now. Please try again later."
              : "Please review your bank details and try again.";
  if (!(error instanceof ApiError)) return "Unable to save your bank details. Please try again.";

  let message = error.message.trim();
  try {
    const parsed = JSON.parse(message) as { message?: unknown; detail?: unknown };
    if (typeof parsed.message === "string") message = parsed.message.trim();
    else if (typeof parsed.detail === "string") message = parsed.detail.trim();
  } catch {
    // Keep plain-text API messages for user-facing validation errors.
  }

  if (!message || /exception|sql|jdbc|constraint|failed to execute|could not execute|org\.springframework|java\.|stack trace|request processing failed|internal server error/i.test(message)) {
    return fallback;
  }
  return message;
}

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<"personal" | "team" | "bank">("personal");
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileForm>(emptyProfileForm);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [bankForm, setBankForm] = useState<BankForm>(emptyBankForm);
  const [savingBank, setSavingBank] = useState(false);
  const [editingBank, setEditingBank] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMemberSummary[]>([]);
  const [teamMembersLoaded, setTeamMembersLoaded] = useState(false);
  const [loadingTeamMembers, setLoadingTeamMembers] = useState(false);
  const [teamMembersError, setTeamMembersError] = useState<string | null>(null);
  const [selectedTeamMember, setSelectedTeamMember] = useState<TeamMemberDetails | null>(null);
  const [loadingTeamMemberDetails, setLoadingTeamMemberDetails] = useState(false);

  const loadData = useCallback(async () => {
    const session = loadSession();
    if (!session) {
      toast.error("Session not found. Please login again.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [profileResult, bankResult] = await Promise.allSettled([
        getCurrentUser(session.accessToken),
        getCurrentUserBankDetails(session.accessToken),
      ]);
      if (profileResult.status === "rejected") {
        throw profileResult.reason;
      }

      const profileData = profileResult.value;
      setProfile(profileData);
      setProfileForm({
        personalEmailAddress: profileData.personalEmailAddress ?? "",
        phoneNumber: profileData.phoneNumber ?? "",
        educationQualification: profileData.educationQualification ?? "",
      });
      setEditingProfile(false);

      if (bankResult.status === "fulfilled") {
        const bankData = bankResult.value;
        setBankDetails(bankData ?? null);
        setEditingBank(!bankData);
      } else {
        setBankDetails(null);
        setEditingBank(true);
      }
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message || `Unable to load profile (${error.status})`);
      } else {
        toast.error("Unable to load profile.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function loadTeamMembers() {
    const session = loadSession();
    if (!session) {
      setTeamMembersError("Session not found. Please login again.");
      return;
    }
    setLoadingTeamMembers(true);
    setTeamMembersError(null);
    try {
      const members = await getCurrentUserTeamMembers(session.accessToken);
      setTeamMembers(members);
      setTeamMembersLoaded(true);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Unable to load team members.";
      setTeamMembersError(message);
    } finally {
      setLoadingTeamMembers(false);
    }
  }

  async function openTeamMemberDetails(teamMemberId: number) {
    const session = loadSession();
    if (!session) {
      toast.error("Session not found. Please login again.");
      return;
    }
    setSelectedTeamMember(null);
    setLoadingTeamMemberDetails(true);
    try {
      const member = await getCurrentUserTeamMemberDetails(session.accessToken, teamMemberId);
      setSelectedTeamMember(member);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message || `Unable to load team member (${error.status})`);
      } else {
        toast.error("Unable to load team member details.");
      }
    } finally {
      setLoadingTeamMemberDetails(false);
    }
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const session = loadSession();
    if (!session) {
      toast.error("Session not found. Please login again.");
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await updateCurrentUserProfile(session.accessToken, {
        personalEmailAddress: profileForm.personalEmailAddress.trim() || null,
        phoneNumber: profileForm.phoneNumber.trim() || null,
        educationQualification: profileForm.educationQualification.trim() || null,
      });
      setProfile(updated);
      setProfileForm({
        personalEmailAddress: updated.personalEmailAddress ?? "",
        phoneNumber: updated.phoneNumber ?? "",
        educationQualification: updated.educationQualification ?? "",
      });
      setEditingProfile(false);
      toast.success("Profile updated successfully.");
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message || `Unable to update profile (${error.status})`);
      } else {
        toast.error("Unable to update profile.");
      }
    } finally {
      setSavingProfile(false);
    }
  }

  function cancelProfileEdit() {
    setProfileForm({
      personalEmailAddress: profile?.personalEmailAddress ?? "",
      phoneNumber: profile?.phoneNumber ?? "",
      educationQualification: profile?.educationQualification ?? "",
    });
    setEditingProfile(false);
  }

  function startEditBank() {
    if (bankDetails && !bankDetails.editWindowOpen) {
      toast.error(bankDetails.editWindowMessage || "You can't edit the account details right now.");
      return;
    }
    setBankForm({
      accountHolderName: bankDetails?.accountHolderName ?? "",
      bankName: bankDetails?.bankName ?? "",
      accountNumber: "",
      confirmAccountNumber: "",
      ifscCode: bankDetails?.ifscCode ?? "",
      branchName: bankDetails?.branchName ?? "",
      accountType: (bankDetails?.accountType as BankAccountType) ?? "SAVINGS",
    });
    setEditingBank(true);
  }

  async function handleBankSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const session = loadSession();
    if (!session) {
      toast.error("Session not found. Please login again.");
      return;
    }
    if (
        !bankForm.accountHolderName.trim() ||
        !bankForm.bankName.trim() ||
        !bankForm.accountNumber.trim() ||
        !bankForm.confirmAccountNumber.trim() ||
        !bankForm.ifscCode.trim() ||
        !bankForm.branchName.trim()
    ) {
      toast.error("Please complete all mandatory bank details fields.");
      return;
    }
    if (bankForm.accountNumber.trim() !== bankForm.confirmAccountNumber.trim()) {
      toast.error("Account number and confirm account number do not match.");
      return;
    }
    setSavingBank(true);
    const isNewBankAccount = !bankDetails;
    try {
      const saved = await saveCurrentUserBankDetails(session.accessToken, {
        accountHolderName: bankForm.accountHolderName.trim(),
        bankName: bankForm.bankName.trim(),
        accountNumber: bankForm.accountNumber.trim(),
        confirmAccountNumber: bankForm.confirmAccountNumber.trim(),
        ifscCode: bankForm.ifscCode.trim().toUpperCase(),
        branchName: bankForm.branchName.trim(),
        accountType: bankForm.accountType,
      });
      setBankDetails(saved);
      setEditingBank(false);
      toast.success(isNewBankAccount ? "Bank account added successfully." : "Bank account details updated successfully.");
    } catch (error) {
      toast.error(getBankDetailsErrorMessage(error));
    } finally {
      setSavingBank(false);
    }
  }

  return (
      <>
        <PageHeader description="Manage your personal information and bank account details." title="My Profile" />

        <div className="mb-5 flex flex-wrap gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm">
          <Button
              className={activeTab === "personal" ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500" : ""}
              onClick={() => setActiveTab("personal")}
              variant={activeTab === "personal" ? "default" : "ghost"}
          >
            <User className="mr-2 h-4 w-4" />
            Personal Information
          </Button>
          <Button
              className={activeTab === "team" ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500" : ""}
              onClick={() => {
                setActiveTab("team");
                if (!teamMembersLoaded) void loadTeamMembers();
              }}
              variant={activeTab === "team" ? "default" : "ghost"}
          >
            <UserRound className="mr-2 h-4 w-4" />
            Team Members
          </Button>
          <Button
              className={activeTab === "bank" ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500" : ""}
              onClick={() => setActiveTab("bank")}
              variant={activeTab === "bank" ? "default" : "ghost"}
          >
            <Landmark className="mr-2 h-4 w-4" />
            Bank Details
          </Button>
        </div>

        {loading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner className="h-6 w-6" />
            </div>
        ) : activeTab === "personal" ? (
            <div className="space-y-5">
              <Card className="overflow-hidden border-0 shadow-lg shadow-blue-100/70">
                <div className="bg-gradient-to-r from-blue-700 via-indigo-600 to-cyan-600 px-6 py-7 text-white sm:px-8">
                  <div className="flex flex-wrap items-center gap-5">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/30 shadow-inner">
                      <UserRound className="h-8 w-8" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">Personal profile</p>
                      <h2 className="mt-1 truncate text-2xl font-semibold">{profile?.fullName || "Your profile"}</h2>
                      <p className="mt-1 text-sm text-blue-100">{profile?.designation || "Employee"}</p>
                    </div>
                    <div className="rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 backdrop-blur-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-100">Employee ID</p>
                      <p className="mt-1 font-semibold">{profile?.employeeId || "Pending"}</p>
                    </div>
                  </div>
                </div>
                <CardContent className="grid gap-4 bg-white p-5 sm:grid-cols-2 lg:grid-cols-3 sm:p-6">
                  <OverviewItem label="Username" value={profile?.username} />
                  <OverviewItem label="Work email" value={profile?.email} />
                  <OverviewItem label="Reporting manager" value={profile?.reportingManagerFullName} />
                  <OverviewItem label="Department" value={profile?.department} />
                  <OverviewItem label="Joined date" value={formatProfileDate(profile?.joinedDate)} />
                  <div className="min-w-0 rounded-xl border border-zinc-100 bg-zinc-50/70 px-4 py-3 sm:col-span-2 lg:col-span-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Assigned roles</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {profile?.roles.length ? profile.roles.map((role) => (
                        <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700" key={role}>{role}</span>
                      )) : <span className="text-sm font-medium text-zinc-500">No roles assigned</span>}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-indigo-100 shadow-md shadow-indigo-100/50">
                <CardHeader className="border-b border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-blue-50">
                  <CardTitle className="flex items-center gap-2 text-zinc-900">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                      <BriefcaseBusiness className="h-4 w-4" />
                    </span>
                    Current project assignments
                  </CardTitle>
                  <CardDescription>Active projects, allocation type, percentage, and assignment dates.</CardDescription>
                </CardHeader>
                <CardContent className="p-5 sm:p-6">
                  {profile?.currentProjects.length ? (
                    <div className="grid gap-4 xl:grid-cols-2">
                      {profile.currentProjects.map((project) => (
                        <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:border-indigo-200 hover:shadow-md" key={project.allocationId}>
                          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 bg-gradient-to-r from-white to-indigo-50/60 px-4 py-4">
                            <div className="min-w-0">
                              <h3 className="truncate font-semibold text-zinc-900">{project.projectName}</h3>
                              <p className="mt-1 text-xs font-medium tracking-wide text-zinc-500">{project.projectCode} <span className="px-1 text-zinc-300">·</span> {project.allocationCode}</p>
                            </div>
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{project.status}</span>
                          </div>
                          <div className="grid gap-3 p-4 sm:grid-cols-3">
                            <ProjectAssignmentDetail
                                icon={<CalendarDays className="h-4 w-4" />}
                                label="Assigned start"
                                value={formatProfileDate(project.startDate)}
                            />
                            <ProjectAssignmentDetail
                                icon={<CalendarDays className="h-4 w-4" />}
                                label="Assigned end"
                                value={formatProfileDate(project.endDate)}
                            />
                            <ProjectAssignmentDetail
                                icon={<BriefcaseBusiness className="h-4 w-4" />}
                                label="Allocation type"
                                value={project.allocationType}
                            />
                          </div>
                          <div className="px-4 pb-4">
                            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                              <span className="font-medium text-zinc-600">Allocation percentage</span>
                              <span className="font-semibold tabular-nums text-indigo-700">{new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(project.allocationPercent)}%</span>
                            </div>
                            <div aria-label={`${project.allocationPercent}% allocation`} className="h-2 overflow-hidden rounded-full bg-indigo-100">
                              <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600" style={{ width: `${Math.min(100, Math.max(0, project.allocationPercent))}%` }} />
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/70 px-6 py-10 text-center">
                      <span className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm ring-1 ring-zinc-200">
                        <BriefcaseBusiness className="h-5 w-5" />
                      </span>
                      <p className="mt-3 text-sm font-semibold text-zinc-800">No active project assignments</p>
                      <p className="mt-1 text-xs text-zinc-500">Your current assignments will appear here.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-zinc-200 shadow-md shadow-zinc-200/50">
                <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-zinc-100 bg-gradient-to-r from-slate-50 to-blue-50/70">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-zinc-900">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                        <BadgeCheck className="h-4 w-4" />
                      </span>
                      Personal details
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {editingProfile ? "Update the details you’re allowed to manage." : "Your contact and education information."}
                    </CardDescription>
                  </div>
                  {!editingProfile ? (
                    <Button className="shrink-0 gap-2" onClick={() => setEditingProfile(true)} variant="outline">
                      <Pencil className="h-4 w-4" />
                      Edit details
                    </Button>
                  ) : null}
                </CardHeader>
                <CardContent className="p-5 sm:p-6">
                  {editingProfile ? (
                    <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleProfileSubmit}>
                      <FixedInputField
                          autoComplete="email"
                          label="Personal email address"
                          onChange={(event) => setProfileForm((prev) => ({ ...prev, personalEmailAddress: event.target.value }))}
                          type="email"
                          value={profileForm.personalEmailAddress}
                      />
                      <FixedInputField
                          autoComplete="tel"
                          label="Phone number"
                          onChange={(event) => setProfileForm((prev) => ({ ...prev, phoneNumber: event.target.value }))}
                          type="tel"
                          value={profileForm.phoneNumber}
                      />
                      <FixedInputField
                          label="Education details"
                          onChange={(event) => setProfileForm((prev) => ({ ...prev, educationQualification: event.target.value }))}
                          value={profileForm.educationQualification}
                          wrapperClassName="sm:col-span-2"
                      />
                      <div className="flex flex-wrap gap-2 sm:col-span-2">
                        <Button className="gap-2" disabled={savingProfile} type="submit">
                          <Check className="h-4 w-4" />
                          {savingProfile ? "Saving..." : "Save changes"}
                        </Button>
                        <Button className="gap-2" disabled={savingProfile} onClick={cancelProfileEdit} type="button" variant="outline">
                          <X className="h-4 w-4" />
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <PersonalDetail icon={<Mail className="h-4 w-4" />} label="Personal email address" value={profile?.personalEmailAddress} />
                      <PersonalDetail icon={<Phone className="h-4 w-4" />} label="Phone number" value={profile?.phoneNumber} />
                      <PersonalDetail icon={<GraduationCap className="h-4 w-4" />} label="Education details" value={profile?.educationQualification} />
                    </div>
                  )}
                  <div className="mt-5 flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50/70 px-3.5 py-3 text-xs leading-relaxed text-blue-800">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                    Name, work email, designation, and reporting details are managed by HR/Admin.
                  </div>
                </CardContent>
              </Card>
            </div>
        ) : activeTab === "team" ? (
            <Card className="overflow-hidden border-zinc-200 shadow-md shadow-blue-100/50">
              <CardHeader className="border-b border-zinc-100 bg-gradient-to-r from-blue-50 via-white to-indigo-50">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-zinc-900">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                        <UserRound className="h-4 w-4" />
                      </span>
                      Team Members
                    </CardTitle>
                    <CardDescription className="mt-1">Employees who report directly to you. Select the eye icon to view their profile and current project assignments.</CardDescription>
                  </div>
                  {!loadingTeamMembers && !teamMembersError ? (
                    <span className="rounded-full border border-blue-100 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm">
                      {teamMembers.length} {teamMembers.length === 1 ? "member" : "members"}
                    </span>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loadingTeamMembers ? (
                  <div className="flex items-center justify-center py-16"><Spinner className="h-6 w-6" /></div>
                ) : teamMembersError ? (
                  <div className="m-5 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
                    <p>{teamMembersError}</p>
                    <Button className="mt-3" onClick={() => void loadTeamMembers()} size="sm" variant="outline">Try again</Button>
                  </div>
                ) : teamMembers.length === 0 ? (
                  <div className="px-6 py-14 text-center">
                    <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                      <UserRound className="h-5 w-5" />
                    </span>
                    <p className="mt-4 font-semibold text-zinc-900">No direct reports found</p>
                    <p className="mt-1 text-sm text-zinc-500">Team members reporting to you will appear here.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
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
                        {teamMembers.map((member) => (
                          <tr className="border-t border-zinc-200 hover:bg-blue-50/30" key={member.id}>
                            <td className="px-4 py-3">
                              <p className="font-semibold text-zinc-900">{member.fullName}</p>
                              <p className="text-xs text-blue-700">{member.employeeId ?? "Employee ID pending"}</p>
                              <p className="text-xs text-zinc-500">{member.email}</p>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1.5">
                                {member.roles.map((role) => (
                                  <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700" key={role}>{role}</span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-zinc-700">{member.department}</td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${member.employmentStatus.toLowerCase() === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
                                {member.employmentStatus}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2">
                              <Button
                                  aria-label={`View ${member.fullName} details`}
                                  className="h-9 w-9 rounded-full border-sky-200 bg-sky-50 p-0 text-sky-700 hover:bg-sky-100"
                                  onClick={() => void openTeamMemberDetails(member.id)}
                                  title="View team member details"
                                  variant="outline"
                                  size="sm"
                              >
                                <Eye className="h-4 w-4" />
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
        ) : (
            <Card className="border-emerald-100 shadow-md shadow-emerald-100/40">
              <CardHeader className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
                <CardTitle className="flex items-center gap-2 text-white">
                  <Landmark className="h-4 w-4" />
                  Bank Account Details
                </CardTitle>
                  <CardDescription className="text-emerald-100">
                    Add your bank account any time. Updating existing details is available from the 1st through 5th of each month.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-5">
                {!editingBank && bankDetails ? (
                    <div className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <div className="text-xs uppercase tracking-wide text-zinc-500">Account Holder Name</div>
                          <div className="font-medium text-zinc-900">{bankDetails.accountHolderName}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wide text-zinc-500">Bank Name</div>
                          <div className="font-medium text-zinc-900">{bankDetails.bankName}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wide text-zinc-500">Account Number</div>
                          <div className="font-medium text-zinc-900">{bankDetails.maskedAccountNumber}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wide text-zinc-500">IFSC Code</div>
                          <div className="font-medium text-zinc-900">{bankDetails.ifscCode}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wide text-zinc-500">Branch Name</div>
                          <div className="font-medium text-zinc-900">{bankDetails.branchName}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wide text-zinc-500">Account Type</div>
                          <div className="font-medium text-zinc-900">{bankDetails.accountType}</div>
                        </div>
                      </div>

                      {bankDetails.editWindowOpen ? (
                          <Button onClick={startEditBank}>Edit Bank Details</Button>
                      ) : (
                          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>
                        {bankDetails.editWindowMessage ||
                            "You can't edit the account details right now. Please try between 1st - 5th of current month."}
                      </span>
                          </div>
                      )}
                    </div>
                ) : (
                    <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleBankSubmit}>
                      <FixedInputField
                          label="Account Holder Name"
                          onChange={(event) => setBankForm((prev) => ({ ...prev, accountHolderName: event.target.value }))}
                          required
                          value={bankForm.accountHolderName}
                      />
                      <FixedInputField
                          label="Bank Name"
                          onChange={(event) => setBankForm((prev) => ({ ...prev, bankName: event.target.value }))}
                          required
                          value={bankForm.bankName}
                      />
                      <FixedInputField
                          label="Account Number"
                          onChange={(event) => setBankForm((prev) => ({ ...prev, accountNumber: event.target.value }))}
                          required
                          type="password"
                          value={bankForm.accountNumber}
                      />
                      <FixedInputField
                          label="Confirm Account Number"
                          onChange={(event) => setBankForm((prev) => ({ ...prev, confirmAccountNumber: event.target.value }))}
                          required
                          value={bankForm.confirmAccountNumber}
                      />
                      <FixedInputField
                          label="IFSC Code"
                          onChange={(event) => setBankForm((prev) => ({ ...prev, ifscCode: event.target.value.toUpperCase() }))}
                          required
                          value={bankForm.ifscCode}
                      />
                      <FixedInputField
                          label="Branch Name"
                          onChange={(event) => setBankForm((prev) => ({ ...prev, branchName: event.target.value }))}
                          required
                          value={bankForm.branchName}
                      />
                      <LabeledSelectField
                          label="Account Type"
                          onChange={(event) => setBankForm((prev) => ({ ...prev, accountType: event.target.value as BankAccountType }))}
                          value={bankForm.accountType}
                      >
                        <option value="SAVINGS">Savings</option>
                        <option value="CURRENT">Current</option>
                      </LabeledSelectField>

                      <div className="flex gap-2 sm:col-span-2">
                        <Button disabled={savingBank} type="submit">
                          {savingBank ? "Saving..." : "Save Bank Details"}
                        </Button>
                        {bankDetails ? (
                            <Button onClick={() => setEditingBank(false)} type="button" variant="outline">
                              Cancel
                            </Button>
                        ) : null}
                      </div>
                    </form>
                )}
              </CardContent>
            </Card>
        )}
        {loadingTeamMemberDetails || selectedTeamMember ? (
          <TeamMemberDetailsModal
              loading={loadingTeamMemberDetails}
              member={selectedTeamMember}
              onClose={() => setSelectedTeamMember(null)}
          />
        ) : null}
      </>
  );
}

function OverviewItem({ label, value }: { label: string; value?: string | null }) {
  return (
      <div className="min-w-0 rounded-xl border border-zinc-100 bg-zinc-50/70 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{label}</p>
        <p className="mt-1 truncate text-sm font-medium text-zinc-900">{value || "Not provided"}</p>
      </div>
  );
}

function PersonalDetail({ icon, label, value }: { icon: ReactNode; label: string; value?: string | null }) {
  return (
      <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm shadow-zinc-100">
        <div className="flex items-center gap-2 text-blue-700">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">{icon}</span>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
        </div>
        <p className="mt-3 break-words text-sm font-medium text-zinc-900">{value || "Not added yet"}</p>
      </div>
  );
}

function ProjectAssignmentDetail({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
      <div className="min-w-0 rounded-xl bg-zinc-50 px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-indigo-600">
          {icon}
          <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
        </div>
        <p className="mt-1.5 truncate text-sm font-semibold text-zinc-900">{value}</p>
      </div>
  );
}

function TeamMemberInfoTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
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

function TeamMemberDetailsModal({
  member,
  loading,
  onClose,
}: {
  member: TeamMemberDetails | null;
  loading: boolean;
  onClose: () => void;
}) {
  return (
      <div
          aria-label={loading ? "Loading team member details" : `${member?.fullName ?? "Team member"} details`}
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/45 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
          role="dialog"
      >
        <div className="ml-auto flex h-full w-full max-w-3xl flex-col overflow-hidden border-l border-white/50 bg-white shadow-2xl shadow-slate-900/20">
          {loading || !member ? (
            <div className="flex min-h-64 items-center justify-center"><Spinner className="h-7 w-7" /></div>
          ) : (
            <>
              <div className="flex items-start justify-between border-b border-zinc-200 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 px-5 py-4 text-white sm:px-6 sm:py-5">
                <div className="min-w-0 pr-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-100">Employee profile</p>
                  <h2 className="mt-1 break-words text-xl font-semibold sm:text-2xl">{member.fullName}</h2>
                  <p className="mt-1 break-words text-sm text-blue-100">{member.department} · {member.employeeId || "Employee ID pending"}</p>
                </div>
                <div className="flex shrink-0 items-start gap-3">
                  <div className="hidden text-right sm:block">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-100">Last updated</p>
                    <p className="mt-1 text-sm font-medium text-white">{formatDateTime(member.updatedAt)}</p>
                  </div>
                  <Button aria-label="Close team member details" className="h-9 w-9 shrink-0 rounded-full border-white/50 bg-white/10 p-0 text-white hover:bg-white/20" onClick={onClose} size="sm" variant="outline">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
                <Card className="border-0 bg-gradient-to-br from-blue-50 via-white to-indigo-50 shadow-none">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-zinc-900">
                      <UserRound className="h-5 w-5 text-blue-600" />
                      Employee summary
                    </CardTitle>
                    <CardDescription>Profile, role, and reporting details for this team member.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <TeamMemberInfoTile icon={<UserRound className="h-4 w-4 text-blue-600" />} label="Full name" value={member.fullName} />
                      <TeamMemberInfoTile icon={<UserRound className="h-4 w-4 text-blue-600" />} label="Employee ID" value={member.employeeId || "Employee ID pending"} />
                      <TeamMemberInfoTile icon={<UserRound className="h-4 w-4 text-blue-600" />} label="Username" value={member.username} />
                      <TeamMemberInfoTile icon={<Mail className="h-4 w-4 text-blue-600" />} label="Work email" value={member.email} />
                      <TeamMemberInfoTile icon={<Mail className="h-4 w-4 text-blue-600" />} label="Personal email" value={member.personalEmailAddress || "-"} />
                      <TeamMemberInfoTile icon={<Phone className="h-4 w-4 text-blue-600" />} label="Phone number" value={member.phoneNumber || "-"} />
                      <TeamMemberInfoTile icon={<ShieldCheck className="h-4 w-4 text-blue-600" />} label="Department" value={member.department} />
                      <TeamMemberInfoTile icon={<ShieldCheck className="h-4 w-4 text-blue-600" />} label="Status" value={member.employmentStatus} />
                      <TeamMemberInfoTile icon={<ShieldCheck className="h-4 w-4 text-blue-600" />} label="Designation" value={member.designation} />
                      <TeamMemberInfoTile icon={<CalendarDays className="h-4 w-4 text-blue-600" />} label="Joined" value={formatProfileDate(member.joinedDate)} />
                      <TeamMemberInfoTile icon={<UserRound className="h-4 w-4 text-blue-600" />} label="Reporting manager" value={member.reportingManagerFullName} />
                      <TeamMemberInfoTile icon={<ShieldCheck className="h-4 w-4 text-blue-600" />} label="Manager role" value={member.reportingManagerRoleName || "-"} />
                    </div>
                    <div className="rounded-2xl bg-white/80 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Education details</p>
                      <p className="mt-2 break-words text-sm font-medium leading-6 text-zinc-900">{member.educationQualification || "-"}</p>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Assigned roles</p>
                      <div className="flex flex-wrap gap-2">
                        {member.roles.length ? member.roles.map((role) => (
                          <span className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-medium text-blue-700" key={role}>{role}</span>
                        )) : <span className="text-sm text-zinc-500">No roles assigned</span>}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-zinc-200 shadow-none">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-zinc-900">
                      <BriefcaseBusiness className="h-5 w-5 text-blue-600" />
                      Current project assignments
                    </CardTitle>
                    <CardDescription>Active project allocation details for this employee.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                  {member.currentProjects.length ? (
                    <div className="grid gap-3 lg:grid-cols-2">
                      {member.currentProjects.map((project) => (
                        <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white" key={project.allocationId}>
                          <div className="flex items-start justify-between gap-3 border-b border-zinc-100 bg-gradient-to-r from-blue-50/70 to-indigo-50/50 px-4 py-3.5">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-zinc-900">{project.projectName}</p>
                              <p className="mt-1 text-xs text-zinc-500">{project.projectCode} <span className="px-1 text-zinc-300">·</span> {project.allocationCode}</p>
                            </div>
                            <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">{project.status}</span>
                          </div>
                          <div className="grid gap-2 p-3 sm:grid-cols-2">
                            <ProjectAssignmentDetail icon={<CalendarDays className="h-4 w-4" />} label="Start date" value={formatProfileDate(project.startDate)} />
                            <ProjectAssignmentDetail icon={<CalendarDays className="h-4 w-4" />} label="End date" value={formatProfileDate(project.endDate)} />
                            <ProjectAssignmentDetail icon={<BriefcaseBusiness className="h-4 w-4" />} label="Allocation type" value={project.allocationType} />
                          </div>
                          <div className="px-3 pb-3">
                            <div className="mb-1.5 flex justify-between text-xs">
                              <span className="text-zinc-500">Allocation</span>
                              <span className="font-semibold tabular-nums text-indigo-700">{new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(project.allocationPercent)}%</span>
                            </div>
                            <div aria-label={`${project.allocationPercent}% allocation`} className="h-1.5 overflow-hidden rounded-full bg-indigo-100">
                              <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600" style={{ width: `${Math.min(100, Math.max(0, project.allocationPercent))}%` }} />
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-5 py-8 text-center text-sm text-zinc-500">No active project assignments.</div>
                  )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
  );
}
