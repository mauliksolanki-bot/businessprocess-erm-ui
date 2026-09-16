import { PageHeader } from "@/components/erm/page-header";
import { PlaceholderPanel } from "@/components/erm/placeholder-panel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AttendancePage() {
  return (
    <>
      <PageHeader description="Monitor attendance trends, daily compliance, and exceptions." title="Attendance" />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Present today</CardDescription>
            <CardTitle>1,042</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-zinc-600">94.8% organization attendance.</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Late check-ins</CardDescription>
            <CardTitle>39</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-zinc-600">Need manager acknowledgment.</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Work from home</CardDescription>
            <CardTitle>186</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-zinc-600">Includes flexible policy users.</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Absent</CardDescription>
            <CardTitle>57</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-zinc-600">Leave approvals in progress.</CardContent>
        </Card>
      </section>
      <div className="mt-6">
        <PlaceholderPanel
          message="Attendance check-in logs and anomaly workflows will be connected to attendance APIs."
          title="Attendance API integration pending"
        />
      </div>
    </>
  );
}
