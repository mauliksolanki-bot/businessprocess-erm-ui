"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";

import {
  addSupportTicketComment,
  ApiError,
  getSupportCatalog,
  getSupportQueueAssignees,
  getSupportTicketByNumber,
  searchUserMentions,
  type SupportAssigneeOption,
  type SupportQueueSummary,
  type SupportTicket,
  updateSupportTicketDetails,
} from "@/lib/api";
import { loadSession } from "@/lib/auth-storage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FloatingInputField, FloatingTextareaField, LabeledSelectField } from "@/components/ui/form-fields";
import { MentionTextareaField } from "@/components/ui/mention-textarea-field";
import { MentionText } from "@/components/ui/mention-text";
import { Spinner } from "@/components/ui/spinner";

const IMPACT_OPTIONS = ["Low", "Medium", "High", "Critical"] as const;
const URGENCY_OPTIONS = ["Low", "Medium", "High", "Critical"] as const;
const STATUS_OPTIONS: SupportTicket["status"][] = [
  "NEW",
  "ASSIGNED",
  "IN_PROGRESS",
  "PENDING_EMPLOYEE",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
  "SECURITY_ESCALATED",
];
const NON_EDITABLE_FIELD_CLASS = "bg-zinc-100 text-zinc-700 cursor-not-allowed";

function statusTone(status: SupportTicket["status"]) {
  if (["RESOLVED", "CLOSED"].includes(status)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (["REOPENED", "SECURITY_ESCALATED"].includes(status)) return "border-violet-200 bg-violet-50 text-violet-700";
  if (["CANCELLED"].includes(status)) return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function renderCommentText(commentText: string | null) {
  if (!commentText) {
    return <div className="mt-1 text-zinc-500">-</div>;
  }
  const lines = commentText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return (
      <div className="mt-1 space-y-1">
        {lines.map((line, index) => {
          const match = line.match(/^(.+?)\s-\s(.+?)\s-->\s(.+)$/);
          if (!match) {
            return (
                <div key={`${line}-${index}`} className="whitespace-pre-line text-zinc-700">
                  <MentionText text={line} />
                </div>
            );
          }
          const [, field, fromValue, toValue] = match;
          return (
              <div key={`${field}-${index}`} className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs">
                <span className="font-semibold text-indigo-700">{field}</span>
                <span className="rounded bg-rose-100 px-1.5 py-0.5 text-rose-700">
              <MentionText text={fromValue} />
            </span>
                <span className="text-zinc-500">--&gt;</span>
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">
              <MentionText text={toValue} />
            </span>
              </div>
          );
        })}
      </div>
  );
}

function derivePriorityPreview(
    ticketType: SupportTicket["ticketType"],
    impact: string,
    urgency: string
): SupportTicket["priorityCode"] {
  if (ticketType === "SECURITY_INCIDENT") {
    return "P1";
  }
  const key = `${impact}|${urgency}`;
  const matrix: Record<string, SupportTicket["priorityCode"]> = {
    "Critical|Critical": "P1",
    "Critical|High": "P1",
    "Critical|Medium": "P2",
    "Critical|Low": "P2",
    "High|Critical": "P1",
    "High|High": "P2",
    "High|Medium": "P2",
    "High|Low": "P3",
    "Medium|Critical": "P2",
    "Medium|High": "P3",
    "Medium|Medium": "P3",
    "Medium|Low": "P4",
    "Low|Critical": "P3",
    "Low|High": "P4",
    "Low|Medium": "P4",
    "Low|Low": "P4",
  };
  return matrix[key] ?? "P4";
}

export default function SupportTicketDetailsPage() {
  const params = useParams<{ ticketNumber: string }>();
  const session = useMemo(() => loadSession(), []);
  const token = session?.accessToken ?? null;
  const username = (session?.username ?? "").trim().toLowerCase();
  const ticketNumber = decodeURIComponent(params?.ticketNumber ?? "");

  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [queues, setQueues] = useState<SupportQueueSummary[]>([]);
  const [assigneeOptions, setAssigneeOptions] = useState<SupportAssigneeOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [comment, setComment] = useState("");
  const [closureDetails, setClosureDetails] = useState("");
  const [editableQueueCode, setEditableQueueCode] = useState("");
  const [editableAssigneeUserId, setEditableAssigneeUserId] = useState("");
  const [editableImpact, setEditableImpact] = useState("Medium");
  const [editableUrgency, setEditableUrgency] = useState("Medium");
  const [editableStatus, setEditableStatus] = useState<SupportTicket["status"]>("ASSIGNED");
  const [canEditDetails, setCanEditDetails] = useState(false);
  const isTicketLocked = ticket?.status === "RESOLVED" || ticket?.status === "CLOSED";
  const mentionSearch = useCallback(
      async (query: string) => {
        if (!token) return [];
        return searchUserMentions(token, query);
      },
      [token]
  );
  const editablePriority = useMemo(
      () => (ticket ? derivePriorityPreview(ticket.ticketType, editableImpact, editableUrgency) : "P4"),
      [ticket, editableImpact, editableUrgency]
  );

  const initializeEditableState = (item: SupportTicket) => {
    setEditableQueueCode(item.queueCode);
    setEditableAssigneeUserId(item.assigneeUserId ? String(item.assigneeUserId) : "");
    setEditableImpact(item.impactLevel);
    setEditableUrgency(item.urgencyLevel);
    setEditableStatus(item.status);
    setClosureDetails("");
  };

  const loadTicket = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const response = await getSupportTicketByNumber(token, ticketNumber);
      setTicket(response);
      initializeEditableState(response);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message || "Unable to load support ticket.");
      } else {
        toast.error("Unable to load support ticket.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadCatalog = async () => {
    if (!token) return;
    try {
      const catalog = await getSupportCatalog(token);
      setQueues(catalog.queues ?? []);
    } catch {
      setQueues([]);
    }
  };

  useEffect(() => {
    void loadCatalog();
    void loadTicket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, ticketNumber]);

  useEffect(() => {
    const evaluateEditAccess = async () => {
      if (!token || !ticket?.queueCode) {
        setCanEditDetails(false);
        return;
      }
      try {
        const queueMembers = await getSupportQueueAssignees(token, ticket.queueCode);
        const isMember = queueMembers.some((member) => member.username.trim().toLowerCase() === username);
        setCanEditDetails(isMember);
      } catch {
        setCanEditDetails(false);
      }
    };
    void evaluateEditAccess();
  }, [token, ticket?.queueCode, username]);

  useEffect(() => {
    const loadAssignees = async () => {
      const queueCode = editableQueueCode.trim();
      if (!token || !ticket || !queueCode || !canEditDetails) {
        setAssigneeOptions([]);
        return;
      }
      try {
        const response = await getSupportQueueAssignees(token, queueCode);
        setAssigneeOptions(response ?? []);
      } catch {
        setAssigneeOptions([]);
      }
    };
    void loadAssignees();
  }, [token, ticket, editableQueueCode, canEditDetails]);

  const handlePostComment = async () => {
    if (!token || !ticket || !comment.trim()) return;
    setIsPosting(true);
    try {
      const updated = await addSupportTicketComment(token, ticket.id, { comment: comment.trim() });
      setTicket(updated);
      setComment("");
      toast.success("Comment added.");
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message || "Unable to post comment.");
      } else {
        toast.error("Unable to post comment.");
      }
    } finally {
      setIsPosting(false);
    }
  };

  const handleSaveDetails = async () => {
    if (!token || !ticket || !canEditDetails) return;

    const normalizedClosureDetails = closureDetails.trim();
    const queueChanged = editableQueueCode !== ticket.queueCode;
    const assigneeChanged = editableAssigneeUserId !== String(ticket.assigneeUserId ?? "");
    const impactChanged = editableImpact !== ticket.impactLevel;
    const urgencyChanged = editableUrgency !== ticket.urgencyLevel;
    const statusChanged = editableStatus !== ticket.status;
    const nonStateChanged = queueChanged || assigneeChanged || impactChanged || urgencyChanged || Boolean(normalizedClosureDetails);

    if (statusChanged && (editableStatus === "CLOSED" || editableStatus === "RESOLVED") && !normalizedClosureDetails) {
      toast.error("Closure details are required when state is RESOLVED or CLOSED.");
      return;
    }

    if (isTicketLocked && nonStateChanged) {
      toast.error("Only State can be changed when ticket is RESOLVED or CLOSED.");
      return;
    }

    if (!queueChanged && !assigneeChanged && !impactChanged && !urgencyChanged && !statusChanged && !normalizedClosureDetails) {
      toast.error("No changes to update.");
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateSupportTicketDetails(token, ticket.id, {
        queueCode: editableQueueCode,
        assigneeUserId: editableAssigneeUserId ? Number(editableAssigneeUserId) : null,
        impactLevel: editableImpact,
        urgencyLevel: editableUrgency,
        status: editableStatus,
        closureDetails: normalizedClosureDetails || undefined,
      });
      setTicket(updated);
      initializeEditableState(updated);
      toast.success("Ticket details updated.");
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message || "Unable to update ticket details.");
      } else {
        toast.error("Unable to update ticket details.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
        <div className="flex min-h-[50vh] items-center justify-center">
          <Spinner />
        </div>
    );
  }

  if (!ticket) {
    return (
        <div className="space-y-4">
          <Link className="inline-flex items-center gap-2 text-sm text-blue-700 hover:underline" href="/support">
            <ArrowLeft className="h-4 w-4" />
            Back to Support
          </Link>
          <Card>
            <CardContent className="p-6 text-sm text-zinc-600">Ticket not found or not accessible.</CardContent>
          </Card>
        </div>
    );
  }

  return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link className="inline-flex items-center gap-2 text-sm text-blue-700 hover:underline" href="/support">
            <ArrowLeft className="h-4 w-4" />
            Back to Support
          </Link>
          <Button className="gap-2" onClick={() => void loadTicket()} variant="outline">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        <Card className="border-zinc-200 shadow-md">
          <CardHeader className="bg-linear-to-r from-indigo-600 to-violet-600 text-white">
            <CardTitle className="text-white">{ticket.ticketNumber}</CardTitle>
            <CardDescription className="text-indigo-100">Support Ticket Details</CardDescription>
            <div className="pt-2">
              <Badge className={statusTone(ticket.status)}>{ticket.status}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <FloatingInputField label="Number" value={ticket.ticketNumber} readOnly disabled className={NON_EDITABLE_FIELD_CLASS} />
                <FloatingInputField label="Request Type" value={ticket.ticketType} readOnly disabled className={NON_EDITABLE_FIELD_CLASS} />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <FloatingInputField label="Category" value={`${ticket.categoryTitle} (${ticket.categoryCode})`} readOnly disabled className={NON_EDITABLE_FIELD_CLASS} />
                <FloatingInputField label="Subcategory" value={ticket.subcategoryTitle ?? ticket.subcategoryCode ?? "-"} readOnly disabled className={NON_EDITABLE_FIELD_CLASS} />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <LabeledSelectField label="Assignment Group" value={editableQueueCode} onChange={(event) => setEditableQueueCode(event.target.value)} disabled={!canEditDetails || isTicketLocked} className={!canEditDetails || isTicketLocked ? NON_EDITABLE_FIELD_CLASS : undefined}>
                  {queues.map((queue) => (
                      <option key={queue.queueId} value={queue.queueCode}>{queue.queueTitle}</option>
                  ))}
                </LabeledSelectField>

                <LabeledSelectField label="Assigned To" value={editableAssigneeUserId} onChange={(event) => setEditableAssigneeUserId(event.target.value)} disabled={!canEditDetails || isTicketLocked} className={!canEditDetails || isTicketLocked ? NON_EDITABLE_FIELD_CLASS : undefined}>
                  <option value="">Unassigned</option>
                  {!canEditDetails && editableAssigneeUserId ? (
                      <option value={editableAssigneeUserId}>{ticket.assigneeFullName ?? ticket.assigneeUsername}</option>
                  ) : null}
                  {assigneeOptions.map((user) => (
                      <option key={user.id} value={String(user.id)}>{user.fullName} • {user.username}</option>
                  ))}
                </LabeledSelectField>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <LabeledSelectField label="Impact" value={editableImpact} onChange={(event) => setEditableImpact(event.target.value)} disabled={!canEditDetails || isTicketLocked} className={!canEditDetails || isTicketLocked ? NON_EDITABLE_FIELD_CLASS : undefined}>
                  {IMPACT_OPTIONS.map((item) => (
                      <option key={item} value={item}>{item}</option>
                  ))}
                </LabeledSelectField>

                <LabeledSelectField label="Urgency" value={editableUrgency} onChange={(event) => setEditableUrgency(event.target.value)} disabled={!canEditDetails || isTicketLocked} className={!canEditDetails || isTicketLocked ? NON_EDITABLE_FIELD_CLASS : undefined}>
                  {URGENCY_OPTIONS.map((item) => (
                      <option key={item} value={item}>{item}</option>
                  ))}
                </LabeledSelectField>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <LabeledSelectField label="Priority" value={editablePriority} onChange={() => {}} disabled className="bg-zinc-50 text-zinc-600 cursor-not-allowed">
                  <option value="P1">P1</option>
                  <option value="P2">P2</option>
                  <option value="P3">P3</option>
                  <option value="P4">P4</option>
                </LabeledSelectField>

                <LabeledSelectField label="State" value={editableStatus} onChange={(event) => setEditableStatus(event.target.value as SupportTicket["status"])} disabled={!canEditDetails} className={!canEditDetails ? NON_EDITABLE_FIELD_CLASS : undefined}>
                  {STATUS_OPTIONS.map((item) => (
                      <option key={item} value={item}>{item}</option>
                  ))}
                </LabeledSelectField>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <FloatingInputField label="Requester" value={ticket.createdByUsername} readOnly disabled className={NON_EDITABLE_FIELD_CLASS} />
                <FloatingInputField label="Created On" value={new Date(ticket.createdAt).toLocaleString()} readOnly disabled className={NON_EDITABLE_FIELD_CLASS} />
              </div>

              <FloatingInputField label="Short Description" value={ticket.shortDescription} readOnly disabled className={NON_EDITABLE_FIELD_CLASS} />

              <FloatingTextareaField label="Description" value={ticket.description} readOnly disabled className={NON_EDITABLE_FIELD_CLASS} />

              <FloatingTextareaField
                  label="Closure Details"
                  onChange={(event) => setClosureDetails(event.target.value)}
                  placeholder="Add closure details (saved to tracking comment on update)"
                  value={closureDetails}
                  disabled={!canEditDetails || isTicketLocked}
              />

              {canEditDetails ? (
                  <div className="flex justify-end">
                    <Button disabled={isSaving} onClick={handleSaveDetails}>
                      {isSaving ? "Saving..." : "Save"}
                    </Button>
                  </div>
              ) : null}
            </div>

            {!canEditDetails ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  Only active members of this ticket&apos;s support group can edit the ticket.
                </div>
            ) : isTicketLocked ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  This ticket is RESOLVED/CLOSED, so only State can be changed.
                </div>
            ) : null}

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-sm font-semibold text-zinc-900">Comments</p>
              <div className="mt-3 flex gap-2">
                <MentionTextareaField
                    className="min-h-[72px]"
                    label="Add a comment"
                    mentionSearch={mentionSearch}
                    onChange={setComment}
                    value={comment}
                    wrapperClassName="flex-1"
                />
                <Button disabled={isPosting || !comment.trim()} onClick={handlePostComment}>
                  {isPosting ? "Posting..." : "Post"}
                </Button>
              </div>
              <div className="mt-3 space-y-3">
                {ticket.comments.length === 0 ? (
                    <div className="text-sm text-zinc-500">No comments yet.</div>
                ) : (
                    [...ticket.comments].reverse().map((item) => (
                        <div key={item.id} className="rounded-md border border-zinc-100 bg-white p-3 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-zinc-800">{item.actorUsername}</span>
                            <span className="text-xs text-zinc-500">{new Date(item.createdAt).toLocaleString()}</span>
                          </div>
                          {renderCommentText(item.commentText)}
                        </div>
                    ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
  );
}
