"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";

import {
  addSupportTicketComment,
  ApiError,
  getSupportCatalog,
  getSupportQueueAssignees,
  getSupportWorkbenchQueues,
  getSupportTicketByNumber,
  type SupportAssigneeOption,
  type SupportQueueSummary,
  type SupportTicket,
  updateSupportTicketDetails,
} from "@/lib/api";
import { loadSession } from "@/lib/auth-storage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

const IMPACT_OPTIONS = ["Low", "Medium", "High", "Critical"] as const;
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

function statusTone(status: SupportTicket["status"]) {
  if (["RESOLVED", "CLOSED"].includes(status)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (["REOPENED", "SECURITY_ESCALATED"].includes(status)) return "border-violet-200 bg-violet-50 text-violet-700";
  if (["CANCELLED"].includes(status)) return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export default function SupportTicketDetailsPage() {
  const params = useParams<{ ticketNumber: string }>();
  const session = useMemo(() => loadSession(), []);
  const token = session?.accessToken ?? null;
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
  const [editableStatus, setEditableStatus] = useState<SupportTicket["status"]>("ASSIGNED");
  const [canEditDetails, setCanEditDetails] = useState(false);

  const initializeEditableState = (item: SupportTicket) => {
    setEditableQueueCode(item.queueCode);
    setEditableAssigneeUserId(item.assigneeUserId ? String(item.assigneeUserId) : "");
    setEditableImpact(item.impactLevel);
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
        const queues = await getSupportWorkbenchQueues(token);
        const isMember = queues.some((queue) => queue.queueCode.trim().toLowerCase() === ticket.queueCode.trim().toLowerCase());
        setCanEditDetails(isMember);
      } catch {
        setCanEditDetails(false);
      }
    };
    void evaluateEditAccess();
  }, [token, ticket?.queueCode]);

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
    const statusChanged = editableStatus !== ticket.status;

    if (statusChanged && (editableStatus === "CLOSED" || editableStatus === "RESOLVED") && !normalizedClosureDetails) {
      toast.error("Closure details are required when state is RESOLVED or CLOSED.");
      return;
    }

    if (!queueChanged && !assigneeChanged && !impactChanged && !statusChanged && !normalizedClosureDetails) {
      toast.error("No changes to update.");
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateSupportTicketDetails(token, ticket.id, {
        queueCode: editableQueueCode,
        assigneeUserId: editableAssigneeUserId ? Number(editableAssigneeUserId) : null,
        impactLevel: editableImpact,
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
            <CardDescription className="text-indigo-100">{ticket.shortDescription}</CardDescription>
            <div className="pt-2">
              <Badge className={statusTone(ticket.status)}>{ticket.status}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm"><p className="text-xs text-zinc-500">Type</p><p className="mt-1 font-medium">{ticket.ticketType}</p></div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm"><p className="text-xs text-zinc-500">Priority</p><p className="mt-1 font-medium">{ticket.priorityCode}</p></div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm"><p className="text-xs text-zinc-500">Category</p><p className="mt-1 font-medium">{ticket.categoryTitle} ({ticket.categoryCode})</p></div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm"><p className="text-xs text-zinc-500">Subcategory</p><p className="mt-1 font-medium">{ticket.subcategoryTitle ?? ticket.subcategoryCode ?? "-"}</p></div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm"><p className="text-xs text-zinc-500">Queue</p><p className="mt-1 font-medium">{ticket.queueTitle ?? ticket.queueCode ?? "-"}</p></div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm"><p className="text-xs text-zinc-500">Source</p><p className="mt-1 font-medium">{ticket.source}</p></div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm"><p className="text-xs text-zinc-500">Requester</p><p className="mt-1 font-medium">{ticket.createdByUsername}</p></div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm"><p className="text-xs text-zinc-500">Assignee</p><p className="mt-1 font-medium">{ticket.assigneeFullName ?? ticket.assigneeUsername ?? "Unassigned"}</p></div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm"><p className="text-xs text-zinc-500">Impact / Urgency</p><p className="mt-1 font-medium">{ticket.impactLevel} / {ticket.urgencyLevel}</p></div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm"><p className="text-xs text-zinc-500">Created On</p><p className="mt-1 font-medium">{new Date(ticket.createdAt).toLocaleString()}</p></div>
            </div>

            {canEditDetails ? (
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-sm font-semibold text-zinc-900">Editable Ticket Fields</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="text-sm text-zinc-700">
                      <span className="mb-1 block text-xs text-zinc-500">Assignment Group</span>
                      <select className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm" value={editableQueueCode} onChange={(event) => setEditableQueueCode(event.target.value)}>
                        {queues.map((queue) => (
                            <option key={queue.queueId} value={queue.queueCode}>{queue.queueTitle}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm text-zinc-700">
                      <span className="mb-1 block text-xs text-zinc-500">Assigned To</span>
                      <select className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm" value={editableAssigneeUserId} onChange={(event) => setEditableAssigneeUserId(event.target.value)}>
                        <option value="">Unassigned</option>
                        {assigneeOptions.map((user) => (
                            <option key={user.id} value={String(user.id)}>{user.fullName} • {user.username}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm text-zinc-700">
                      <span className="mb-1 block text-xs text-zinc-500">Impact</span>
                      <select className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm" value={editableImpact} onChange={(event) => setEditableImpact(event.target.value)}>
                        {IMPACT_OPTIONS.map((item) => (
                            <option key={item} value={item}>{item}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm text-zinc-700">
                      <span className="mb-1 block text-xs text-zinc-500">State</span>
                      <select className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm" value={editableStatus} onChange={(event) => setEditableStatus(event.target.value as SupportTicket["status"])}>
                        {STATUS_OPTIONS.map((item) => (
                            <option key={item} value={item}>{item}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="mt-3 block text-sm text-zinc-700">
                    <span className="mb-1 block text-xs text-zinc-500">Closure Details</span>
                    <textarea
                        className="min-h-24 w-full rounded-lg border border-zinc-300 bg-white p-3 text-sm"
                        onChange={(event) => setClosureDetails(event.target.value)}
                        placeholder="Add closure details (saved to tracking comment on update)"
                        value={closureDetails}
                    />
                  </label>
                  <div className="mt-3 flex justify-end">
                    <Button disabled={isSaving} onClick={handleSaveDetails}>
                      {isSaving ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
            ) : (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  Only active members of this ticket&apos;s support group can edit Assignment Group, Assigned To, Impact, and State.
                </div>
            )}

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
              <p className="font-semibold text-zinc-900">Description</p>
              <p className="mt-1 whitespace-pre-wrap">{ticket.description}</p>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-sm font-semibold text-zinc-900">Comments</p>
              <div className="mt-3 max-h-56 space-y-3 overflow-y-auto">
                {ticket.comments.length === 0 ? (
                    <div className="text-sm text-zinc-500">No comments yet.</div>
                ) : (
                    ticket.comments.map((item) => (
                        <div key={item.id} className="rounded-md border border-zinc-100 bg-white p-3 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-zinc-800">{item.actorUsername}</span>
                            <span className="text-xs text-zinc-500">{new Date(item.createdAt).toLocaleString()}</span>
                          </div>
                          <div className="mt-1 text-zinc-700">{item.commentText}</div>
                        </div>
                    ))
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <Input onChange={(event) => setComment(event.target.value)} placeholder="Add a comment" value={comment} />
                <Button disabled={isPosting || !comment.trim()} onClick={handlePostComment}>
                  {isPosting ? "Posting..." : "Post"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
  );
}
