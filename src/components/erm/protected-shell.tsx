"use client";

import { type ReactNode, useEffect, useLayoutEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ShieldAlert, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/components/ui/cn";
import { clearSession, loadSession } from "@/lib/auth-storage";
import {
  ApiError,
  getAuthorizedNavigation,
  getCurrentUser,
  getMentionNotifications,
  getOnboardingRequests,
  getPendingApprovalNotifications,
  getProjectAllocationPendingApprovals,
  getProjectAllocationRequests,
  getProjectChangeRequests,
  getProjectPendingApprovals,
  getProjectRequests,
  logout,
  type NavigationMenu,
  type OnboardingRequest,
  type UserProfile,
} from "@/lib/api";
import { SidebarNav } from "@/components/erm/sidebar-nav";
import { Topbar, type AppNotification } from "@/components/erm/topbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

type ProtectedShellProps = {
  children: ReactNode;
};

export function ProtectedShell({ children }: ProtectedShellProps) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [sessionUser, setSessionUser] = useState<UserProfile | null>(null);
  const [menu, setMenu] = useState<NavigationMenu[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingApprovals, setPendingApprovals] = useState<OnboardingRequest[]>([]);
  const [pendingProjectApprovals, setPendingProjectApprovals] = useState(0);
  const [pendingChangeApprovals, setPendingChangeApprovals] = useState(0);
  const [pendingAllocationApprovals, setPendingAllocationApprovals] = useState(0);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const currentPathAuthorized = useMemo(() => {
    if (!pathname) return false;
    // Always allow any /support routes for all authenticated users
    if (pathname.startsWith("/support")) return true;

    // Allow exact matches or any child route under a top-level menu path
    return menu.some((item) => {
      if (!item.path) return false;
      if (item.path === pathname) return true;
      const normalized = item.path.endsWith("/") ? item.path.slice(0, -1) : item.path;
      return pathname.startsWith(normalized + "/");
    });
  }, [menu, pathname]);
  const shellUser = user ?? sessionUser;
  const isUnauthorized = !isLoading && (menu.length === 0 || !currentPathAuthorized);

  function addNotification(items: AppNotification[], nextItem: AppNotification) {
    if (items.some((item) => item.id === nextItem.id)) {
      return;
    }
    items.push(nextItem);
  }

  useLayoutEffect(() => {
    const session = loadSession();
    if (!session) {
      return;
    }

    setSessionUser({
      id: 0,
      username: session.username,
      email: "",
      fullName: session.username,
      designation: "",
      reportingManagerFullName: null,
      reportingManagerRoleName: null,
      roles: session.roles,
      currentProjects: [],
      personalEmailAddress: null,
      phoneNumber: null,
      educationQualification: null,
      bankDetailsEditWindowOpen: false,
      bankDetailsEditWindowMessage: null,
    });
  }, []);

  useEffect(() => {
    async function initialize() {
      const session = loadSession();

      if (!session?.accessToken) {
        router.replace("/login");
        return;
      }

      try {
        const [profile, navMenu] = await Promise.all([
          getCurrentUser(session.accessToken),
          getAuthorizedNavigation(session.accessToken),
        ]);

        setUser(profile);
        setMenu(navMenu);

        const approverRoles = ["hr head", "admin", "chro", "super admin", "ceo", "cto"];
        const projectApproverRoles = ["director", "cto", "super admin", "admin"];
        const userRoles = profile.roles.map((r) => r.toLowerCase());
        const isApprover = userRoles.some((r) => approverRoles.includes(r));
        const isProjectApprover = userRoles.some((r) => projectApproverRoles.includes(r));
        const isDeliveryManager = userRoles.includes("delivery manager");
        const isDirector = userRoles.includes("director");
        const isCto = userRoles.includes("cto");
        const canUseProjectChange = userRoles.includes("project owner") || isDirector || isCto || userRoles.includes("super admin") || userRoles.includes("admin");
        const username = profile.username.toLowerCase();
        const hasOnboardingMenu = navMenu.some((item) => item.path === "/onboarding");
        const hasProjectsMenu = navMenu.some((item) => item.path === "/projects");

        const [
          onboardingApprovalResult,
          projectApprovalResult,
          allocationApprovalResult,
          onboardingTrackerResult,
          projectTrackerResult,
          projectChangeResult,
          projectAllocationResult,
          mentionNotificationsResult,
        ] = await Promise.allSettled([
          isApprover ? getPendingApprovalNotifications(session.accessToken) : Promise.resolve([]),
          isProjectApprover ? getProjectPendingApprovals(session.accessToken) : Promise.resolve([]),
          isDeliveryManager ? getProjectAllocationPendingApprovals(session.accessToken) : Promise.resolve([]),
          hasOnboardingMenu ? getOnboardingRequests(session.accessToken, undefined, 0, 25) : Promise.resolve(null),
          hasProjectsMenu ? getProjectRequests(session.accessToken, undefined, undefined, 0, 25) : Promise.resolve(null),
          hasProjectsMenu && canUseProjectChange ? getProjectChangeRequests(session.accessToken) : Promise.resolve([]),
          hasProjectsMenu ? getProjectAllocationRequests(session.accessToken, undefined, undefined, 0, 25) : Promise.resolve(null),
          getMentionNotifications(session.accessToken),
        ]);

        const nextNotifications: AppNotification[] = [];
        let nextNotificationError: string | null = null;
        let hasAnyPending = false;

        if (onboardingApprovalResult.status === "fulfilled") {
          setPendingApprovals(onboardingApprovalResult.value);
          if (onboardingApprovalResult.value.length > 0) {
            hasAnyPending = true;
          }
          onboardingApprovalResult.value.forEach((request) => {
            addNotification(nextNotifications, {
              id: `onboarding-approval-${request.id}`,
              title: "On-boarding approval pending",
              message: `${request.firstName} ${request.lastName} is waiting at ${request.workflowStage}.`,
              href: "/onboarding",
              occurredAt: request.updatedAt,
              kind: "approval",
              tone: "warning",
            });
          });
        } else if (isApprover) {
          nextNotificationError = "Some notifications could not be loaded right now.";
        }

        if (projectApprovalResult.status === "fulfilled") {
          setPendingProjectApprovals(projectApprovalResult.value.length);
          if (projectApprovalResult.value.length > 0) {
            hasAnyPending = true;
          }
          projectApprovalResult.value.forEach((request) => {
            addNotification(nextNotifications, {
              id: `project-approval-${request.id}`,
              title: "Project approval pending",
              message: `${request.projectName} (${request.projectCode}) needs action at ${request.workflowStage}.`,
              href: "/projects",
              occurredAt: request.updatedAt,
              kind: "approval",
              tone: "warning",
            });
          });
        } else if (isProjectApprover) {
          nextNotificationError = "Some notifications could not be loaded right now.";
        }

        if (allocationApprovalResult.status === "fulfilled") {
          setPendingAllocationApprovals(allocationApprovalResult.value.length);
          if (allocationApprovalResult.value.length > 0) {
            hasAnyPending = true;
          }
          allocationApprovalResult.value.forEach((allocation) => {
            addNotification(nextNotifications, {
              id: `allocation-approval-${allocation.id}`,
              title: "Allocation approval pending",
              message: `${allocation.employeeName} is waiting for ${allocation.projectName} allocation approval.`,
              href: "/projects",
              occurredAt: allocation.updatedAt,
              kind: "approval",
              tone: "warning",
            });
          });
        } else if (isDeliveryManager) {
          nextNotificationError = "Some notifications could not be loaded right now.";
        }

        if (onboardingTrackerResult.status === "fulfilled" && onboardingTrackerResult.value) {
          onboardingTrackerResult.value.content
              .filter((request) => request.createdByUsername.toLowerCase() === username)
              .forEach((request) => {
                if (request.workflowStage === "Refer Back") {
                  addNotification(nextNotifications, {
                    id: `onboarding-refer-back-${request.id}`,
                    title: "On-boarding request sent back",
                    message: `Request #${request.id} needs your update and resubmission.`,
                    href: "/onboarding",
                    occurredAt: request.updatedAt,
                    kind: "update",
                    tone: "warning",
                  });
                }
                if (request.workflowStage === "Rejected") {
                  addNotification(nextNotifications, {
                    id: `onboarding-rejected-${request.id}`,
                    title: "On-boarding request rejected",
                    message: `Request #${request.id} was rejected. Review comments before taking the next action.`,
                    href: "/onboarding",
                    occurredAt: request.updatedAt,
                    kind: "update",
                    tone: "critical",
                  });
                }
                if (request.workflowStage === "Admin Approved" || request.workflowStage === "Additional Approval Approved") {
                  addNotification(nextNotifications, {
                    id: `onboarding-approved-${request.id}`,
                    title: "On-boarding request completed",
                    message: `Request #${request.id} completed the full approval flow.`,
                    href: "/onboarding",
                    occurredAt: request.updatedAt,
                    kind: "update",
                    tone: "success",
                  });
                }
                if (request.reminderCount > 0 && request.lastReminderAt) {
                  addNotification(nextNotifications, {
                    id: `onboarding-reminder-${request.id}`,
                    title: "Reminder sent",
                    message: `You sent ${request.reminderCount} reminder${request.reminderCount === 1 ? "" : "s"} for on-boarding request #${request.id}.`,
                    href: "/onboarding",
                    occurredAt: request.lastReminderAt,
                    kind: "reminder",
                    tone: "info",
                  });
                }
              });
        } else if (hasOnboardingMenu) {
          nextNotificationError = "Some notifications could not be loaded right now.";
        }

        if (projectTrackerResult.status === "fulfilled" && projectTrackerResult.value) {
          projectTrackerResult.value.content
              .filter((request) => request.createdByUsername.toLowerCase() === username)
              .forEach((request) => {
                if (request.workflowStage === "Refer Back") {
                  addNotification(nextNotifications, {
                    id: `project-refer-back-${request.id}`,
                    title: "Project request sent back",
                    message: `${request.projectName} requires your updates and resubmission.`,
                    href: "/projects",
                    occurredAt: request.updatedAt,
                    kind: "update",
                    tone: "warning",
                  });
                }
                if (request.workflowStage === "Rejected") {
                  addNotification(nextNotifications, {
                    id: `project-rejected-${request.id}`,
                    title: "Project request rejected",
                    message: `${request.projectName} was rejected in the workflow.`,
                    href: "/projects",
                    occurredAt: request.updatedAt,
                    kind: "update",
                    tone: "critical",
                  });
                }
                if (request.workflowStage === "Super Admin Approved") {
                  addNotification(nextNotifications, {
                    id: `project-approved-${request.id}`,
                    title: "Project request approved",
                    message: `${request.projectName} is fully approved and now live for downstream actions.`,
                    href: "/projects",
                    occurredAt: request.updatedAt,
                    kind: "update",
                    tone: "success",
                  });
                }
              });
        } else if (hasProjectsMenu) {
          nextNotificationError = "Some notifications could not be loaded right now.";
        }

        if (projectChangeResult.status === "fulfilled") {
          const directorChangeCount = projectChangeResult.value.filter((item) => item.workflowStage === "Pending Director Approval").length;
          const ctoChangeCount = projectChangeResult.value.filter((item) => item.workflowStage === "Pending CTO Approval").length;
          const totalPendingChanges = (isDirector ? directorChangeCount : 0) + (isCto ? ctoChangeCount : 0);
          setPendingChangeApprovals(totalPendingChanges);
          if (totalPendingChanges > 0) {
            hasAnyPending = true;
          }

          projectChangeResult.value.forEach((item) => {
            const isOwnChange = item.createdByUsername.toLowerCase() === username;
            const isPendingMyApproval =
                (isDirector && item.workflowStage === "Pending Director Approval") ||
                (isCto && item.workflowStage === "Pending CTO Approval");

            if (isPendingMyApproval) {
              addNotification(nextNotifications, {
                id: `change-approval-${item.id}`,
                title: "Project change approval pending",
                message: `${item.projectName} change request is waiting at ${item.workflowStage}.`,
                href: "/projects",
                occurredAt: item.updatedAt,
                kind: "approval",
                tone: "warning",
              });
            }
            if (isOwnChange && item.workflowStage === "Approved") {
              addNotification(nextNotifications, {
                id: `change-approved-${item.id}`,
                title: "Project change approved",
                message: `${item.projectName} change request has been approved.`,
                href: "/projects",
                occurredAt: item.updatedAt,
                kind: "update",
                tone: "success",
              });
            }
            if (isOwnChange && item.workflowStage === "Rejected") {
              addNotification(nextNotifications, {
                id: `change-rejected-${item.id}`,
                title: "Project change rejected",
                message: `${item.projectName} change request was rejected.`,
                href: "/projects",
                occurredAt: item.updatedAt,
                kind: "update",
                tone: "critical",
              });
            }
          });
        } else if (hasProjectsMenu) {
          nextNotificationError = "Some notifications could not be loaded right now.";
        }

        if (projectAllocationResult.status === "fulfilled" && projectAllocationResult.value) {
          projectAllocationResult.value.content
              .filter((item) => item.createdByUsername.toLowerCase() === username)
              .forEach((item) => {
                if (item.status === "Refer Back") {
                  addNotification(nextNotifications, {
                    id: `allocation-refer-back-${item.id}`,
                    title: "Allocation request sent back",
                    message: `${item.employeeName}'s allocation for ${item.projectName} needs your update.`,
                    href: "/projects",
                    occurredAt: item.updatedAt,
                    kind: "update",
                    tone: "warning",
                  });
                }
                if (item.status === "Rejected") {
                  addNotification(nextNotifications, {
                    id: `allocation-rejected-${item.id}`,
                    title: "Allocation request rejected",
                    message: `${item.employeeName}'s allocation for ${item.projectName} was rejected.`,
                    href: "/projects",
                    occurredAt: item.updatedAt,
                    kind: "update",
                    tone: "critical",
                  });
                }
                if (item.status === "Active" || item.status === "Released") {
                  addNotification(nextNotifications, {
                    id: `allocation-status-${item.id}-${item.status}`,
                    title: `Allocation ${item.status.toLowerCase()}`,
                    message: `${item.employeeName} is ${item.status.toLowerCase()} on ${item.projectName}.`,
                    href: "/projects",
                    occurredAt: item.updatedAt,
                    kind: "update",
                    tone: item.status === "Active" ? "success" : "info",
                  });
                }
              });
        } else if (hasProjectsMenu) {
          nextNotificationError = "Some notifications could not be loaded right now.";
        }

        if (mentionNotificationsResult.status === "fulfilled") {
          mentionNotificationsResult.value.forEach((item) => {
            addNotification(nextNotifications, {
              id: `mention-${item.id}`,
              title: "You were mentioned",
              message: item.message,
              href: item.href,
              occurredAt: item.createdAt,
              kind: "update",
              tone: "info",
            });
          });
        } else {
          nextNotificationError = "Some notifications could not be loaded right now.";
        }

        setNotifications(nextNotifications.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()).slice(0, 20));
        setNotificationError(nextNotificationError);
        if (hasAnyPending) {
          setShowBanner(true);
        }
      } catch (error) {
        clearSession();
        if (error instanceof ApiError && error.status === 401) {
          toast.error("Session expired. Please login again.");
        } else {
          toast.error("Unable to load your account details.");
        }
        router.replace("/login");
      } finally {
        setIsLoading(false);
      }
    }

    void initialize();
  }, [router]);

  async function handleLogout() {
    const session = loadSession();
    if (session?.accessToken) {
      try {
        await logout(session.accessToken);
      } catch (error) {
        if (error instanceof ApiError) {
          toast.error(`Logout API failed (${error.status}). Local session was cleared.`);
        } else {
          toast.error("Logout API failed. Local session was cleared.");
        }
      }
    }
    clearSession();
    router.replace("/login");
  }

  if (!shellUser) {
    return (
        <div className="flex h-screen overflow-hidden">
          <aside className="hidden w-72 shrink-0 border-r border-zinc-200 bg-white/70 md:block" />
          <main className="flex flex-1 items-center justify-center overflow-y-auto p-6">
            <Spinner size="lg" />
          </main>
        </div>
    );
  }

  return (
      <div className="flex h-screen flex-col overflow-hidden bg-[radial-gradient(circle_at_top,#dbeafe_0,#f8fafc_42%,#f8fafc_100%)]">
        <Topbar notificationError={notificationError} notifications={notifications} onLogout={handleLogout} user={shellUser} />
        {showBanner ? (
            <div className="flex shrink-0 items-center justify-between gap-3 bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 px-4 py-2.5 text-white shadow-md">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Bell className="h-4 w-4 shrink-0 animate-pulse" />
                <span>
              {pendingApprovals.length > 0 ? (
                  <>
                    You have <strong>{pendingApprovals.length}</strong> onboarding{" "}
                    {pendingApprovals.length === 1 ? "request" : "requests"} awaiting your approval.{" "}
                    <Link className="underline underline-offset-2 hover:text-white/80" href="/onboarding">
                      View requests →
                    </Link>
                  </>
              ) : null}
                  {pendingApprovals.length > 0 && pendingProjectApprovals > 0 ? " • " : null}
                  {pendingProjectApprovals > 0 ? (
                      <>
                        You have <strong>{pendingProjectApprovals}</strong> project{" "}
                        {pendingProjectApprovals === 1 ? "request" : "requests"} awaiting approval.{" "}
                        <Link className="underline underline-offset-2 hover:text-white/80" href="/projects">
                          View projects →
                        </Link>
                      </>
                  ) : null}
                  {(pendingApprovals.length > 0 || pendingProjectApprovals > 0) && pendingChangeApprovals > 0 ? " • " : null}
                  {pendingChangeApprovals > 0 ? (
                      <>
                        You have <strong>{pendingChangeApprovals}</strong> project change{" "}
                        {pendingChangeApprovals === 1 ? "request" : "requests"} awaiting approval.{" "}
                        <Link className="underline underline-offset-2 hover:text-white/80" href="/projects">
                          Open changes →
                        </Link>
                      </>
                  ) : null}
                  {(pendingApprovals.length > 0 || pendingProjectApprovals > 0 || pendingChangeApprovals > 0) && pendingAllocationApprovals > 0 ? " • " : null}
                  {pendingAllocationApprovals > 0 ? (
                      <>
                        You have <strong>{pendingAllocationApprovals}</strong> allocation{" "}
                        {pendingAllocationApprovals === 1 ? "request" : "requests"} awaiting approval.{" "}
                        <Link className="underline underline-offset-2 hover:text-white/80" href="/projects">
                          Open tracker →
                        </Link>
                      </>
                  ) : null}
            </span>
              </div>
              <button
                  aria-label="Dismiss notification"
                  className="rounded-full p-1 hover:bg-white/20"
                  onClick={() => setShowBanner(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
        ) : null}
        <div className="flex min-h-0 flex-1">
          <SidebarNav menu={menu} />
          <main className="w-full overflow-y-auto p-4 md:p-6">
            <nav className="mb-4 flex gap-2 overflow-x-auto pb-1 md:hidden">
              {menu.map((item) => (
                  <Link
                      className={cn(
                          "inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-2 text-sm font-medium shadow-sm transition-all",
                          pathname === item.path
                              ? "border-blue-200 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-600/25"
                              : "border-white/70 bg-white/90 text-zinc-700 hover:border-zinc-200 hover:bg-white"
                      )}
                      href={item.path}
                      key={item.code}
                  >
                    {pathname === item.path ? <Sparkles className="h-3.5 w-3.5" /> : null}
                    {item.title}
                  </Link>
              ))}
            </nav>
            {isUnauthorized ? (
                <Card className="max-w-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-rose-700">
                      <ShieldAlert className="h-5 w-5" />
                      Access denied
                    </CardTitle>
                    <CardDescription>
                      You are logged in, but this page is not available for your role. Use the authorized menu on the left.
                    </CardDescription>
                  </CardHeader>
                  <CardContent />
                </Card>
            ) : (
                children
            )}
          </main>
        </div>
      </div>
  );
}
