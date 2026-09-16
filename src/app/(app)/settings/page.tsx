import { Bell, LockKeyhole, UserCog } from "lucide-react";

import { PageHeader } from "@/components/erm/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const settingCards = [
  {
    title: "Profile and access",
    description: "Manage identity details and account-level preferences.",
    icon: UserCog,
  },
  {
    title: "Security",
    description: "Update password policy, sessions, and secure defaults.",
    icon: LockKeyhole,
  },
  {
    title: "Notifications",
    description: "Configure alerts for approvals, exceptions, and reminders.",
    icon: Bell,
  },
];

export default function SettingsPage() {
  return (
    <>
      <PageHeader description="Configure portal preferences, access settings, and notifications." title="Settings" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {settingCards.map((card) => (
          <Card key={card.title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <card.icon className="h-4 w-4" />
                </span>
                {card.title}
              </CardTitle>
              <CardDescription>{card.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-3 text-sm text-zinc-600">
                Detailed module controls can be connected with future backend APIs.
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
