import { cn } from "@/components/ui/cn";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("animate-pulse rounded-md bg-zinc-200", className)} {...props} />;
}
