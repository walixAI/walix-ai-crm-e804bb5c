import { cn } from "@/lib/utils";
import type { ConversationStatus } from "@/lib/queries/whatsapp";

const STYLES: Record<ConversationStatus, string> = {
  "Nuevo":       "bg-info/10 text-info border-info/20",
  "En atención": "bg-success/10 text-success border-success/20",
  "Esperando":   "bg-warning/10 text-warning border-warning/20",
  "Resuelto":    "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({ status, className }: { status: ConversationStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border", STYLES[status], className)}>
      {status}
    </span>
  );
}
