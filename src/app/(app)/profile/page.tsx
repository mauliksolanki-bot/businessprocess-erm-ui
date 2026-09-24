"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { BadgeCheck, Landmark, Lock, ShieldCheck, User } from "lucide-react";
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
      const [profileData, bankData] = await Promise.all([
        getCurrentUser(session.accessToken),
        getCurrentUserBankDetails(session.accessToken),
      ]);
      setProfile(profileData);
      setProfileForm({
        personalEmailAddress: profileData.personalEmailAddress ?? "",
        phoneNumber: profileData.phoneNumber ?? "",
        educationQualification: profileData.educationQualification ?? "",
      });
      setBankDetails(bankData);
      setEditingBank(!bankData);
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
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <ShieldCheck className="h-4 w-4" />
                    </span>
                    Account Overview
                  </CardTitle>
                  <CardDescription>Read-only details managed by HR/Admin.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-zinc-500">Full Name</div>
                    <div className="font-medium text-zinc-900">{profile?.fullName}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-zinc-500">Username</div>
                    <div className="font-medium text-zinc-900">{profile?.username}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-zinc-500">Work Email</div>
                    <div className="font-medium text-zinc-900">{profile?.email}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-zinc-500">Designation</div>
                    <div className="font-medium text-zinc-900">{profile?.designation}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-zinc-500">Reporting Manager</div>
                    <div className="font-medium text-zinc-900">{profile?.reportingManagerFullName ?? "-"}</div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-blue-100 shadow-md shadow-blue-100/40 lg:col-span-2">
                <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                  <CardTitle className="flex items-center gap-2 text-white">
                    <BadgeCheck className="h-4 w-4" />
                    Editable Information
                  </CardTitle>
                  <CardDescription className="text-blue-100">
                    Update your personal email, phone number, and education details.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-5">
                  <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleProfileSubmit}>
                    <FixedInputField
                        label="Personal Email Address"
                        onChange={(event) => setProfileForm((prev) => ({ ...prev, personalEmailAddress: event.target.value }))}
                        type="email"
                        value={profileForm.personalEmailAddress}
                        wrapperClassName="sm:col-span-1"
                    />
                    <FixedInputField
                        label="Phone Number"
                        onChange={(event) => setProfileForm((prev) => ({ ...prev, phoneNumber: event.target.value }))}
                        type="tel"
                        value={profileForm.phoneNumber}
                        wrapperClassName="sm:col-span-1"
                    />
                    <FixedInputField
                        label="Education Details"
                        onChange={(event) => setProfileForm((prev) => ({ ...prev, educationQualification: event.target.value }))}
                        value={profileForm.educationQualification}
                        wrapperClassName="sm:col-span-2"
                    />
                    <div className="sm:col-span-2">
                      <Button disabled={savingProfile} type="submit">
                        {savingProfile ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  </form>
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
