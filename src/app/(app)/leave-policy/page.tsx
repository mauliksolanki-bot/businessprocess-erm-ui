"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PlusCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FloatingInputField, LabeledSelectField } from "@/components/ui/form-fields";
import { Spinner } from "@/components/ui/spinner";
import { ApiError, createLeavePolicy, getLeavePolicies, updateLeavePolicy, type LeavePolicy } from "@/lib/api";
import { loadSession } from "@/lib/auth-storage";

const categories = ["Sick", "Casual", "Earned"] as const;

export default function LeavePolicyPage() {
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [newCategory, setNewCategory] = useState<(typeof categories)[number]>("Sick");
  const [newDisplayName, setNewDisplayName] = useState("Sick Leave");
  const [newMaxDays, setNewMaxDays] = useState("12");
  const [newEnabled, setNewEnabled] = useState(true);

  const accessToken = useMemo(() => loadSession()?.accessToken ?? null, []);

  async function loadPolicies() {
    if (!accessToken) {
      toast.error("Session not found. Please login again.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getLeavePolicies(accessToken);
      setPolicies(data);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        toast.error("Only HR Head can manage leave policies.");
      } else {
        toast.error("Unable to load leave policies.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPolicies();
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) {
      toast.error("Session not found. Please login again.");
      return;
    }
    const maxDays = Number(newMaxDays);
    if (!newDisplayName.trim() || Number.isNaN(maxDays) || maxDays < 1) {
      toast.error("Provide a valid display name and max days.");
      return;
    }

    setCreating(true);
    try {
      await createLeavePolicy(accessToken, {
        leaveCategory: newCategory,
        displayName: newDisplayName.trim(),
        maxDaysPerYear: maxDays,
        enabled: newEnabled,
      });
      toast.success("Leave policy created.");
      await loadPolicies();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message || `Unable to create policy (${error.status})`);
      } else {
        toast.error("Unable to create leave policy.");
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdate(policy: LeavePolicy) {
    if (!accessToken) {
      toast.error("Session not found. Please login again.");
      return;
    }
    setSavingId(policy.id);
    try {
      await updateLeavePolicy(accessToken, policy.id, {
        displayName: policy.displayName,
        maxDaysPerYear: policy.maxDaysPerYear,
        enabled: policy.enabled,
      });
      toast.success("Policy updated.");
      await loadPolicies();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message || `Unable to update policy (${error.status})`);
      } else {
        toast.error("Unable to update leave policy.");
      }
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <Card className="border-indigo-100 shadow-md shadow-indigo-100/40 xl:col-span-1">
        <CardHeader className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
          <CardTitle className="flex items-center gap-2 text-white">
            <PlusCircle className="h-5 w-5" />
            Create Leave Policy
          </CardTitle>
          <CardDescription className="text-indigo-100">Create or extend leave categories and yearly limits.</CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <form className="space-y-3" onSubmit={handleCreate}>
            <LabeledSelectField
              label="Category"
              onChange={(event) => setNewCategory(event.target.value as (typeof categories)[number])}
              value={newCategory}
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </LabeledSelectField>
            <FloatingInputField label="Display Name" onChange={(event) => setNewDisplayName(event.target.value)} value={newDisplayName} />
            <FloatingInputField label="Max Days Per Year" min={1} onChange={(event) => setNewMaxDays(event.target.value)} type="number" value={newMaxDays} />
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
              <input checked={newEnabled} onChange={(event) => setNewEnabled(event.target.checked)} type="checkbox" />
              Enabled
            </label>
            <Button className="w-full" disabled={creating} type="submit">
              {creating ? "Creating..." : "Create Policy"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Leave Policies</CardTitle>
            <CardDescription>Enable/disable and edit leave policy details.</CardDescription>
          </div>
          <Button onClick={() => void loadPolicies()} variant="outline">
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : policies.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">No leave policies configured.</div>
          ) : (
            <div className="space-y-3">
              {policies.map((policy) => (
                <div className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 md:grid-cols-4" key={policy.id}>
                  <FloatingInputField
                    label="Category"
                    disabled
                    value={policy.leaveCategory}
                  />
                  <FloatingInputField
                    label="Display Name"
                    onChange={(event) =>
                      setPolicies((prev) => prev.map((item) => (item.id === policy.id ? { ...item, displayName: event.target.value } : item)))
                    }
                    value={policy.displayName}
                  />
                  <FloatingInputField
                    label="Max Days Per Year"
                    min={1}
                    onChange={(event) =>
                      setPolicies((prev) =>
                        prev.map((item) =>
                          item.id === policy.id ? { ...item, maxDaysPerYear: Number(event.target.value || "0") } : item
                        )
                      )
                    }
                    type="number"
                    value={String(policy.maxDaysPerYear)}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        checked={policy.enabled}
                        onChange={(event) =>
                          setPolicies((prev) => prev.map((item) => (item.id === policy.id ? { ...item, enabled: event.target.checked } : item)))
                        }
                        type="checkbox"
                      />
                      Enabled
                    </label>
                    <Button disabled={savingId === policy.id} onClick={() => void handleUpdate(policy)} size="sm">
                      {savingId === policy.id ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
