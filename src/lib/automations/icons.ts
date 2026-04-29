import {
  Zap, Clock, MessageCircle, UserPlus, ArrowRight, Trophy, XCircle,
  CalendarClock, MessagesSquare, Send, Bell, ListTodo, Users, Tag,
  ArrowRightCircle, Bot, Sparkles, type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  zap: Zap,
  clock: Clock,
  "message-circle": MessageCircle,
  "user-plus": UserPlus,
  "arrow-right": ArrowRight,
  trophy: Trophy,
  "x-circle": XCircle,
  "calendar-clock": CalendarClock,
  "messages-square": MessagesSquare,
  send: Send,
  bell: Bell,
  "list-todo": ListTodo,
  users: Users,
  tag: Tag,
  "arrow-right-circle": ArrowRightCircle,
  bot: Bot,
  sparkles: Sparkles,
};

export function iconByName(name: string | undefined | null): LucideIcon {
  if (!name) return Zap;
  return MAP[name] ?? Zap;
}

export function iconForTriggerType(t: string): string {
  switch (t) {
    case "deal_inactive": return "clock";
    case "new_whatsapp_lead": return "message-circle";
    case "new_contact": return "user-plus";
    case "deal_stage_changed": return "arrow-right";
    case "deal_won": return "trophy";
    case "deal_lost": return "x-circle";
    case "deal_close_date_near": return "calendar-clock";
    case "contact_no_reply": return "messages-square";
    default: return "zap";
  }
}