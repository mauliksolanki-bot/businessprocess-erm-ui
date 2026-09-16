import { Clock3 } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PlaceholderPanelProps = {
  title: string;
  message: string;
};

export function PlaceholderPanel({ title, message }: PlaceholderPanelProps) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-zinc-800">
          <Clock3 className="h-5 w-5 text-blue-600" />
          {title}
        </CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl bg-zinc-100 p-4 text-sm text-zinc-600">
          API integration for this block will be connected as backend endpoints are completed.
        </div>
      </CardContent>
    </Card>
  );
}
