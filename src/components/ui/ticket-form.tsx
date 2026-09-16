"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { toast } from "sonner";
import { loadSession } from "@/lib/auth-storage";
import { Button } from "@/components/ui/button";
import { FloatingInputField, FloatingTextareaField, LabeledSelectField } from "@/components/ui/form-fields";
import { createSupportTicket, ApiError } from "@/lib/api";

type RequestTypeOption = "Service Request" | "Incident - Application" | "Incident - Security";

const requestTypeToPrefix: Record<RequestTypeOption, string> = {
  "Service Request": "RITM-",
  "Incident - Application": "INC-APP-",
  "Incident - Security": "INC-SEC-",
};

const requestTypeToAssignmentGroup: Record<RequestTypeOption, string> = {
  "Service Request": "ERM_APP_SUPPORT",
  "Incident - Application": "ERM_APP_SUPPORT",
  "Incident - Security": "ERM_IT_SUPPORT",
};

const requestTypeToCategoryCode: Record<RequestTypeOption, string> = {
  "Service Request": "software-access",
  "Incident - Application": "application-issue",
  "Incident - Security": "security-incident",
};

export default function TicketForm() {
  const session = useMemo(() => loadSession(), []);
  const token = session?.accessToken ?? null;

  const [requestType, setRequestType] = useState<RequestTypeOption>("Service Request");
  const [numberValue, setNumberValue] = useState("");
  const [stateValue, setStateValue] = useState("New");
  const [impact, setImpact] = useState("Medium");
  const [urgency, setUrgency] = useState("Medium");
  const [priority, setPriority] = useState<{ label: string; rank: number }>({ label: "Medium", rank: 3 });
  const [assignmentGroup, setAssignmentGroup] = useState<string>(requestTypeToAssignmentGroup[requestType]);
  const [assigneeId, setAssigneeId] = useState<number | "">("");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // update number when request type changes - show prefix only; server will finalize unique number on create
    const prefix = requestTypeToPrefix[requestType];
    setNumberValue(prefix);

    // update assignment group
    setAssignmentGroup(requestTypeToAssignmentGroup[requestType]);
  }, [requestType]);

  useEffect(() => {
    // compute priority from impact and urgency
    const levels = [impact, urgency];
    const calc = () => {
      if (levels.includes("Critical")) return { label: "Critical", rank: 1 };
      if (levels.includes("High")) return { label: "High", rank: 2 };
      if (levels.includes("Medium")) return { label: "Medium", rank: 3 };
      return { label: "Low", rank: 4 };
    };
    setPriority(calc());
  }, [impact, urgency]);

  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!token) {
      toast.error("Not authenticated.");
      return;
    }
    if (!shortDescription.trim() || !description.trim()) {
      toast.error("Please fill short description and description.");
      return;
    }
    setSubmitting(true);
    try {
      // Map our fields to existing createSupportTicket contract
      const ticketTypeMap: Record<RequestTypeOption, string> = {
        "Service Request": "SUPPORT_TICKET",
        "Incident - Application": "INCIDENT",
        "Incident - Security": "SECURITY_INCIDENT",
      };
      const payload = {
        ticketType: ticketTypeMap[requestType],
        categoryCode: requestTypeToCategoryCode[requestType],
        impactLevel: impact,
        urgencyLevel: urgency,
        shortDescription: shortDescription.trim(),
        description: description.trim(),
        source: "PORTAL",
        assigneeUserId: assigneeId === "" ? null : Number(assigneeId),
      } as any;

      const created = await createSupportTicket(token, payload);
      // server-finalized ticket number will come back in response
      const finalNumber = (created as any).ticketNumber ?? (created as any).id ?? "";
      if (finalNumber) setNumberValue(String(finalNumber));
      // Show formatted toast with ticket number
      toast.success(
          <div className="space-y-1">
            <div>Ticket has been created successfully.</div>
            <div className="font-semibold">Your Ticket - #{finalNumber}</div>
          </div>
      );

      // clear form after success (keep number shown)
      setShortDescription("");
      setDescription("");
      setAssigneeId("");
      setConfirmOpen(false);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message || "Unable to create ticket.");
      } else {
        toast.error("Unable to create ticket.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // client-side validation state
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const next: Record<string, string> = {};
    if (!shortDescription.trim()) next.shortDescription = "Short description is required";
    if (!description.trim()) next.description = "Description is required";
    if (!impact) next.impact = "Impact is required";
    if (!urgency) next.urgency = "Urgency is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <LabeledSelectField label="Request Type" value={requestType} onChange={(e) => setRequestType(e.target.value as RequestTypeOption)}>
            <option>Service Request</option>
            <option>Incident - Application</option>
            <option>Incident - Security</option>
          </LabeledSelectField>

          <FloatingInputField label="Number" value={numberValue} readOnly />
        </div>

        <FloatingInputField label="Assignment Group" value={assignmentGroup} readOnly />

        {/* Row 2: Impact + Urgency */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <LabeledSelectField label="Impact" value={impact} onChange={(e) => setImpact(e.target.value)}>
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
              <option>Critical</option>
            </LabeledSelectField>
            {errors.impact ? <div className="mt-1 text-xs text-rose-600">{errors.impact}</div> : null}
          </div>

          <div>
            <LabeledSelectField label="Urgency" value={urgency} onChange={(e) => setUrgency(e.target.value)}>
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
              <option>Critical</option>
            </LabeledSelectField>
            {errors.urgency ? <div className="mt-1 text-xs text-rose-600">{errors.urgency}</div> : null}
          </div>
        </div>

        {/* Row 3: State + Priority (priority is dropdown but disabled) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <LabeledSelectField label="State" value={stateValue} onChange={(e) => setStateValue(e.target.value)}>
            <option>New</option>
            <option>Open</option>
            <option>Pending</option>
            <option>Resolved</option>
            <option>Closed</option>
          </LabeledSelectField>

          <LabeledSelectField label="Priority" value={priority.label} onChange={() => {}} disabled className="bg-zinc-50 text-zinc-600 cursor-not-allowed">
            <option>Critical</option>
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </LabeledSelectField>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <LabeledSelectField label="Assign To" value={assigneeId ?? ""} onChange={(e) => setAssigneeId(Number(e.target.value) || "")} disabled className="bg-zinc-50 text-zinc-600 cursor-not-allowed">
            <option value="">Auto-assign</option>
          </LabeledSelectField>
        </div>

        {/* Row 5: Short Description */}
        <div>
          <FloatingInputField label="Short Description" value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} />
          {errors.shortDescription ? <div className="mt-1 text-xs text-rose-600">{errors.shortDescription}</div> : null}
        </div>

        {/* Row 6: Description */}
        <div>
          <FloatingTextareaField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          {errors.description ? <div className="mt-1 text-xs text-rose-600">{errors.description}</div> : null}
        </div>

        {/* Actions: right aligned */}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => {
            setShortDescription("");
            setDescription("");
            setAssigneeId("");
            setErrors({});
          }}>
            <X className="h-4 w-4" />
            <span className="ml-2">Clear form</span>
          </Button>

          <Button type="button" className="bg-emerald-600 hover:bg-emerald-500 inline-flex items-center gap-2 text-white" onClick={() => {
            if (validate()) setConfirmOpen(true);
          }}>
            <Search className="h-4 w-4" />
            <span className="ml-1">Create Ticket</span>
          </Button>
        </div>

        {/* Confirmation modal */}
        {confirmOpen ? (
            <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm">
              <div className="my-8 w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">Confirm Ticket Creation</h3>
                    <p className="mt-1 text-sm text-zinc-600">Please confirm the details below. The system will finalize the ticket number on save.</p>
                  </div>
                  <button className="text-zinc-400 hover:text-zinc-600" onClick={() => setConfirmOpen(false)} aria-label="Close">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-4 grid gap-2">
                  <div className="text-sm">
                    <div className="text-xs text-zinc-500">Request Type</div>
                    <div className="font-medium">{requestType}</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-xs text-zinc-500">Assignment Group</div>
                    <div className="font-medium">{assignmentGroup}</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-xs text-zinc-500">Priority</div>
                    <div className="font-medium">{priority.label} ({priority.rank})</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-xs text-zinc-500">Short description</div>
                    <div className="font-medium truncate">{shortDescription}</div>
                  </div>
                </div>

                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={submitting}>Cancel</Button>
                  <Button onClick={(e) => void handleSubmit(e)} disabled={submitting}>
                    {submitting ? "Creating..." : "Confirm & Create"}
                  </Button>
                </div>
              </div>
            </div>
        ) : null}
      </form>
  );
}
