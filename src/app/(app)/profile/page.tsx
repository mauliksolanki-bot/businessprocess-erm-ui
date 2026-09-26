"use client";

import { FormEvent, type ReactNode, useCallback, useEffect, useState } from "react";
import { BadgeCheck, Check, GraduationCap, Landmark, Lock, Mail, Pencil, Phone, ShieldCheck, User, UserRound, X } from "lucide-react";
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
  saveCurrentUserBankDetails,
  updateCurrentUserProfile,
  type BankAccountType,
  type BankDetails,
  type UserProfile,
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

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<"personal" | "bank">("personal");
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileForm>(emptyProfileForm);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [bankForm, setBankForm] = useState<BankForm>(emptyBankForm);
  const [savingBank, setSavingBank] = useState(false);
  const [editingBank, setEditingBank] = useState(false);

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
      toast.success("Bank details saved successfully.");
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message || `Unable to save bank details (${error.status})`);
      } else {
        toast.error("Unable to save bank details.");
      }
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
        ) : (
            <Card className="border-emerald-100 shadow-md shadow-emerald-100/40">
              <CardHeader className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
                <CardTitle className="flex items-center gap-2 text-white">
                  <Landmark className="h-4 w-4" />
                  Bank Account Details
                </CardTitle>
                <CardDescription className="text-emerald-100">
                  Only one bank account can be mapped to your profile. Editing is allowed between the 1st and 5th of every month.
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
