"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Eye, RefreshCw, Ticket } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import {
  addSupportTicketComment,
  ApiError,
  assignSupportTicket,
  getSupportTicketById,
  getSupportTickets,
  searchUserMentions,
  type SupportTicket,
} from "@/lib/api";
import { loadSession } from "@/lib/auth-storage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MentionTextareaField } from "@/components/ui/mention-textarea-field";
import { MentionText } from "@/components/ui/mention-text";
import { Spinner } from "@/components/ui/spinner";
import TicketForm from "@/components/ui/ticket-form";

type SupportTab = "raise" | "mine" | "assigned";

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

function isSupportAssigneeRole(roles: string[]) {
  const normalized = roles.map((role) => role.toLowerCase());
  return normalized.includes("application support specialist")
      || normalized.includes("it security")
      || normalized.includes("it support lead")
      || normalized.includes("it support manager")
      || normalized.includes("role_application_support_specialist")
      || normalized.includes("role_it_security")
      || normalized.includes("role_it_support_lead")
      || normalized.includes("role_it_support_manager");
}

export default function SupportPage() {
  const session = useMemo(() => loadSession(), []);
  const token = session?.accessToken ?? null;
  const [supportTab, setSupportTab] = useState<SupportTab>("raise");
  const [myTickets, setMyTickets] = useState<SupportTicket[]>([]);
  const [assignedTickets, setAssignedTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [comment, setComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const canViewAssignedTickets = useMemo(() => isSupportAssigneeRole(session?.roles ?? []), [session?.roles]);
  const mentionSearch = useCallback(
      async (query: string) => {
        if (!token) return [];
        return searchUserMentions(token, query);
      },
      [token]
  );
  const supportHeading = supportTab === "raise"
      ? {
        title: "Support Request",
        subtitle: "Facing an issue? please raise a request / Incident so that team can help you futther",
      }
      : {
        title: "Track Support Tickets",
        subtitle: "You can track your tickets here.",
      };

  const loadTickets = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const requests: Promise<SupportTicket[]>[] = [getSupportTickets(token, { scope: "mine" })];
      if (canViewAssignedTickets) {
        requests.push(getSupportTickets(token, { scope: "assigned" }));
      }
      const [mineResult, assignedResult] = await Promise.all(requests);
      setMyTickets(mineResult ?? []);
      setAssignedTickets(canViewAssignedTickets ? (assignedResult ?? []) : []);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        toast.error("You are not authorized to access support.");
      } else {
        toast.error("Unable to load support tickets.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [canViewAssignedTickets, token]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTickets();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadTickets]);

  const refreshMine = async () => {
    if (!token) return;
    try {
      setMyTickets(await getSupportTickets(token, { scope: "mine" }));
    } catch {
      toast.error("Unable to refresh your tickets.");
    }
  };

  const refreshAssigned = async () => {
    if (!token || !canViewAssignedTickets) return;
    try {
      setAssignedTickets(await getSupportTickets(token, { scope: "assigned" }));
    } catch {
      toast.error("Unable to refresh assigned tickets.");
    }
  };

  const openTicket = async (ticketId: number) => {
    if (!token) return;
    try {
      const ticket = await getSupportTicketById(token, ticketId);
      setSelectedTicket(ticket);
      setComment("");
    } catch {
      toast.error("Unable to load ticket details.");
    }
  };

  const handleComment = async () => {
    if (!token || !selectedTicket || !comment.trim()) return;
    try {
      const updated = await addSupportTicketComment(token, selectedTicket.id, { comment: comment.trim() });
      setSelectedTicket(updated);
      setComment("");
      await refreshMine();
    } catch {
      toast.error("Unable to post comment.");
    }
  };

  if (isLoading) {
    return (
        <div className="flex min-h-[50vh] items-center justify-center">
          <Spinner />
        </div>
    );
  }

  return (
      <div className="space-y-6">
        <Card className="border-0">
          <CardHeader className="flex min-h-38 flex-col gap-3 rounded-t-2xl bg-linear-to-r from-blue-600 to-indigo-600 text-white sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">Support Portal</p>
              <h1 className="mt-2 text-3xl font-semibold">{supportHeading.title}</h1>
              <p className="mt-2 max-w-2xl text-sm text-white/80">{supportHeading.subtitle}</p>
            </div>
          </CardHeader>
        </Card>

        <Card className="border-zinc-200 shadow-md">
          <CardContent className="p-5">
            <div className="mb-5 flex flex-wrap gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm">
              <Button
                  variant={supportTab === "raise" ? "default" : "ghost"}
                  className={supportTab === "raise" ? "bg-linear-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500" : ""}
                  onClick={() => setSupportTab("raise")}
              >
                Raise a Ticket
              </Button>
              <Button
                  variant={supportTab === "mine" ? "default" : "ghost"}
                  className={supportTab === "mine" ? "bg-linear-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-500 hover:to-fuchsia-500" : ""}
                  onClick={() => setSupportTab("mine")}
              >
                My Tickets
              </Button>
              {canViewAssignedTickets ? (
                  <Button
                      variant={supportTab === "assigned" ? "default" : "ghost"}
                      className={supportTab === "assigned" ? "bg-linear-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500" : ""}
                      onClick={() => setSupportTab("assigned")}
                  >
                    Assigned Tickets
                  </Button>
              ) : null}
            </div>

            {supportTab === "raise" ? <TicketForm /> : null}

            {supportTab === "mine" ? (
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm text-zinc-500">Tickets you created.</p>
                    <Button variant="outline" onClick={refreshMine}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
                  </div>
                  {myTickets.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-500">No support tickets yet.</div>
                  ) : (
                      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
                        <table className="w-full min-w-5xl text-sm">
                          <thead className="bg-linear-to-r from-indigo-50 via-violet-50 to-cyan-50 text-left text-zinc-800">
                          <tr>
                            <th className="px-4 py-3 font-medium">Ticket</th>
                            <th className="px-4 py-3 font-medium">Summary</th>
                            <th className="px-4 py-3 font-medium">Queue</th>
                            <th className="px-4 py-3 font-medium">Priority</th>
                            <th className="px-4 py-3 font-medium">Created</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Actions</th>
                          </tr>
                          </thead>
                          <tbody>
                          {myTickets.map((ticket) => (
                              <tr key={ticket.id} className="border-t border-zinc-200 hover:bg-indigo-50/30">
                                <td className="px-4 py-3">
                                  <p className="font-semibold text-zinc-900">{ticket.ticketNumber}</p>
                                  <p className="text-xs text-zinc-600">{ticket.ticketType}</p>
                                </td>
                                <td className="px-4 py-3">
                                  <p className="text-sm text-zinc-800">{ticket.shortDescription}</p>
                                  <p className="max-w-[320px] truncate text-xs text-zinc-500">{ticket.description}</p>
                                </td>
                                <td className="px-4 py-3 text-xs text-zinc-700">{ticket.queueTitle ?? ticket.queueCode ?? "-"}</td>
                                <td className="px-4 py-3 text-xs text-zinc-700">{ticket.priorityCode}</td>
                                <td className="px-4 py-3 text-xs text-zinc-700">{new Date(ticket.createdAt).toLocaleString()}</td>
                                <td className="px-4 py-3"><Badge className={statusTone(ticket.status)}>{ticket.status}</Badge></td>
                                <td className="px-4 py-3">
                                  <div className="flex gap-2">
                                    <Button
                                        aria-label={`View ticket ${ticket.id}`}
                                        className="h-9 w-9 rounded-full border-zinc-200 bg-zinc-50 p-0 text-zinc-700 hover:bg-zinc-100"
                                        onClick={() => openTicket(ticket.id)}
                                        size="sm"
                                        title="View"
                                        variant="outline"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    {ticket.assigneeUserId == null ? (
                                        <Button
                                            className="h-9 rounded-full border-emerald-200 bg-emerald-50 px-3 text-emerald-700 hover:bg-emerald-100"
                                            onClick={async () => {
                                              if (!token) return toast.error("Not authenticated.");
                                              try {
                                                await assignSupportTicket(token, ticket.id, {});
                                                toast.success("Ticket assigned.");
                                                await refreshMine();
                                              } catch {
                                                toast.error("Unable to assign ticket.");
                                              }
                                            }}
                                            size="sm"
                                            title="Auto assign"
                                        >
                                          <CheckCircle2 className="h-4 w-4" />
                                        </Button>
                                    ) : null}
                                  </div>
                                </td>
                              </tr>
                          ))}
                          </tbody>
                        </table>
                      </div>
                  )}
                </div>
            ) : null}

            {supportTab === "assigned" && canViewAssignedTickets ? (
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm text-zinc-500">Tickets assigned to you.</p>
                    <Button variant="outline" onClick={refreshAssigned}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
                  </div>
                  {assignedTickets.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-500">No assigned tickets.</div>
                  ) : (
                      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
                        <table className="w-full min-w-5xl text-sm">
                          <thead className="bg-linear-to-r from-indigo-50 via-violet-50 to-cyan-50 text-left text-zinc-800">
                          <tr>
                            <th className="px-4 py-3 font-medium">Ticket</th>
                            <th className="px-4 py-3 font-medium">Summary</th>
                            <th className="px-4 py-3 font-medium">Requester</th>
                            <th className="px-4 py-3 font-medium">Queue</th>
                            <th className="px-4 py-3 font-medium">Priority</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Created</th>
                          </tr>
                          </thead>
                          <tbody>
                          {assignedTickets.map((ticket) => (
                              <tr key={ticket.id} className="border-t border-zinc-200 hover:bg-indigo-50/30">
                                <td className="px-4 py-3">
                                  <Link
                                      className="font-semibold text-blue-700 underline-offset-2 hover:underline"
                                      href={`/support/ticket/${encodeURIComponent(ticket.ticketNumber)}`}
                                  >
                                    {ticket.ticketNumber}
                                  </Link>
                                  <p className="text-xs text-zinc-600">{ticket.ticketType}</p>
                                </td>
                                <td className="px-4 py-3">
                                  <p className="text-sm text-zinc-800">{ticket.shortDescription}</p>
                                  <p className="max-w-[320px] truncate text-xs text-zinc-500">{ticket.description}</p>
                                </td>
                                <td className="px-4 py-3 text-xs text-zinc-700">{ticket.createdByUsername}</td>
                                <td className="px-4 py-3 text-xs text-zinc-700">{ticket.queueTitle ?? ticket.queueCode ?? "-"}</td>
                                <td className="px-4 py-3 text-xs text-zinc-700">{ticket.priorityCode}</td>
                                <td className="px-4 py-3"><Badge className={statusTone(ticket.status)}>{ticket.status}</Badge></td>
                                <td className="px-4 py-3 text-xs text-zinc-700">{new Date(ticket.createdAt).toLocaleString()}</td>
                              </tr>
                          ))}
                          </tbody>
                        </table>
                      </div>
                  )}
                </div>
            ) : null}
          </CardContent>
        </Card>

        {selectedTicket ? (
            <div
                className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/45 backdrop-blur-sm"
                onClick={(event) => {
                  if (event.target === event.currentTarget) {
                    setSelectedTicket(null);
                  }
                }}
            >
              <div className="ml-auto flex h-full w-full max-w-4xl flex-col overflow-hidden border-l border-white/50 bg-white shadow-2xl shadow-slate-300/40">
                <div className="border-b border-zinc-200 bg-linear-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-6 py-5 text-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="flex items-center gap-2 text-xl font-semibold">
                        <Ticket className="h-5 w-5" />
                        Support Ticket Details {selectedTicket.ticketNumber ? `#${selectedTicket.ticketNumber}` : ""}
                      </h3>
                      <p className="mt-1 text-sm text-indigo-100">{selectedTicket.shortDescription}</p>
                    </div>
                    <Button className="border-white/30 bg-white/10 text-white hover:bg-white/20" onClick={() => setSelectedTicket(null)} variant="outline">
                      Close
                    </Button>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge className={statusTone(selectedTicket.status)}>{selectedTicket.status}</Badge>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-6">
                  <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Ticket Number</p>
                        <p className="mt-1 font-medium text-zinc-900">{selectedTicket.ticketNumber}</p>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Type</p>
                        <p className="mt-1 font-medium text-zinc-900">{selectedTicket.ticketType}</p>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Category</p>
                        <p className="mt-1 font-medium text-zinc-900">{selectedTicket.categoryTitle} ({selectedTicket.categoryCode})</p>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Subcategory</p>
                        <p className="mt-1 font-medium text-zinc-900">{selectedTicket.subcategoryTitle ?? selectedTicket.subcategoryCode ?? "-"}</p>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Impact / Urgency</p>
                        <p className="mt-1 font-medium text-zinc-900">{selectedTicket.impactLevel} / {selectedTicket.urgencyLevel}</p>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Priority</p>
                        <p className="mt-1 font-medium text-zinc-900">{selectedTicket.priorityCode}</p>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Queue</p>
                        <p className="mt-1 font-medium text-zinc-900">{selectedTicket.queueTitle ?? selectedTicket.queueCode ?? "-"}</p>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Source</p>
                        <p className="mt-1 font-medium text-zinc-900">{selectedTicket.source}</p>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Requester</p>
                        <p className="mt-1 font-medium text-zinc-900">{selectedTicket.createdByUsername}</p>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Assignee</p>
                        <p className="mt-1 font-medium text-zinc-900">{selectedTicket.assigneeFullName ?? selectedTicket.assigneeUsername ?? "Unassigned"}</p>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Created</p>
                        <p className="mt-1 font-medium text-zinc-900">{new Date(selectedTicket.createdAt).toLocaleString()}</p>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-700">
                        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Updated</p>
                        <p className="mt-1 font-medium text-zinc-900">{new Date(selectedTicket.updatedAt).toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                      <p className="font-semibold text-zinc-900">Description</p>
                      <p className="mt-1 whitespace-pre-wrap">{selectedTicket.description}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                      <p className="font-semibold text-zinc-900">Comments</p>
                      <div className="mt-2 max-h-112 space-y-3 overflow-y-auto">
                        {selectedTicket.comments.length === 0 ? (
                            <div className="text-sm text-zinc-500">No comments yet.</div>
                        ) : (
                            selectedTicket.comments.map((item) => (
                                <div key={item.id} className="rounded-md border border-zinc-100 bg-white p-3 text-sm">
                                  <div className="flex items-center justify-between">
                                    <div className="font-medium text-zinc-700">{item.actorUsername}</div>
                                    <div className="text-xs text-zinc-500">{new Date(item.createdAt).toLocaleString()}</div>
                                  </div>
                                  {renderCommentText(item.commentText)}
                                </div>
                            ))
                        )}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <MentionTextareaField
                            className="min-h-[72px]"
                            label="Add a comment"
                            mentionSearch={mentionSearch}
                            onChange={setComment}
                            value={comment}
                            wrapperClassName="flex-1"
                        />
                        <Button onClick={handleComment} disabled={!comment.trim()}>Post</Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
        ) : null}
      </div>
  );
}
