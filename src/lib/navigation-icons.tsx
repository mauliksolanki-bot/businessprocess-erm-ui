import {
  ClipboardList,
  CalendarCheck2,
  ContactRound,
  Headset,
  KanbanSquare,
  LayoutDashboard,
  Megaphone,
  Plane,
  ShieldCheck,
  Settings,
  UserRoundPlus,
  Users,
  type LucideIcon,
} from "lucide-react";

const iconByName: Record<string, LucideIcon> = {
  "calendar-check-2": CalendarCheck2,
  "clipboard-list": ClipboardList,
  "contact-round": ContactRound,
  "kanban-square": KanbanSquare,
  "layout-dashboard": LayoutDashboard,
  megaphone: Megaphone,
  headset: Headset,
  plane: Plane,
  "shield-check": ShieldCheck,
  settings: Settings,
  "user-round-plus": UserRoundPlus,
  users: Users,
};

export function resolveNavIcon(iconName: string | null | undefined): LucideIcon {
  if (!iconName) {
    return LayoutDashboard;
  }
  return iconByName[iconName] ?? LayoutDashboard;
}
