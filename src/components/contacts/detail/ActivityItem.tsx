import { CallRecordingButton } from "@/components/calls/CallRecordingButton";
import { isEffectiveCall } from "@/lib/activities/consolidateCalls";
import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  Phone, Users, Mail, FileText, MessageCircle, MoreHorizontal, Pencil, Trash2,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  useDeleteContactActivity, type ActivityRow,
} from "@/lib/queries/contacts";
import { LogActivityDialog, type LogKind } from "./dialogs/LogActivityDialog";
import { ConfirmDialog } from "@/components/walix/ConfirmDialog";
import { cn } from "@/lib/utils";
import { summarizeWaActivity } from "@/lib/activities/waSummary";

const ICONS: Record<string, any> = {
  call: Phone, meeting: Users, email: Mail, note: FileText,
  wa_sent: MessageCircle, wa_received: MessageCircle, manual: MessageCircle,
  task: FileText, deal: FileText,
};

const EDITABLE: Record<string, LogKind> = {
  call: "call", meeting: "meeting", email: "email", note: "note",
};

interface Props { contactId: string; activity: ActivityRow }

export function ActivityItem({ contactId, activity }: Props) {
  const Icon = ICONS[activity.type] ?? MessageCircle;
  const editable = activity.type in EDITABLE && activity.metadata?.source !== "consolidated_call";
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const del = useDeleteContactActivity(contactId);

  const meta = activity.metadata ?? {};
  const occurred = new Date(activity.occurredAt);
  const created = new Date(activity.createdAt);
  const sameTime = Math.abs(occurred.getTime() - created.getTime()) < 60_000;

  return (
    <>
      <div className="relative flex gap-4 pb-5 last:pb-0">
        <div className="relative z-10 h-9 w-9 rounded-full bg-muted grid place-items-center shrink-0">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 pt-0.5 min-w-0">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-sm whitespace-pre-wrap break-words">{summarizeWaActivity(activity.description, meta) ?? activity.description}</div>
              {meta.ai_summary && meta.ai_summary !== activity.description && <div className="mt-3 border-l-2 border-primary/40 pl-3"><p className="mb-1 text-xs font-medium text-muted-foreground">Resumen IA</p><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{meta.ai_summary}</p></div>}
              {activity.type === "call" && meta.call_id && isEffectiveCall(meta, meta.ai_summary ?? "") && <div className="mt-2"><CallRecordingButton callId={meta.call_id} /></div>}
              {/* metadata badges */}
              {(meta.result || meta.duration || meta.subject || meta.location || meta.source === "consolidated_call") && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {meta.source === "consolidated_call" && (
                    <Badge tone={meta.is_effective ? "effective" : "attempt"}>
                      {meta.is_effective ? "Llamada efectiva" : "Intento"}
                    </Badge>
                  )}
                  {meta.result && <Badge>{meta.result}</Badge>}
                  {meta.duration != null && <Badge>{typeof meta.duration === "number" ? `${meta.duration} s` : meta.duration}</Badge>}
                  {meta.typification_label && <Badge>{meta.typification_label}</Badge>}
                  {meta.automatic_result && meta.automatic_result !== meta.result && <Badge>{meta.automatic_result}</Badge>}
                  {meta.subject && <Badge>📧 {meta.subject}</Badge>}
                  {meta.location && <Badge>📍 {meta.location}</Badge>}
                </div>
              )}
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                <Avatar className="h-4 w-4"><AvatarFallback className="text-[8px] bg-muted">{activity.agentInitials}</AvatarFallback></Avatar>
                <span>{activity.agent}</span>
                <span>·</span>
                <span>{format(occurred, "d MMM HH:mm", { locale: es })}</span>
                {!sameTime && (
                  <>
                    <span>·</span>
                    <span className="italic">registrada hace {formatDistanceToNow(created, { locale: es })}</span>
                  </>
                )}
                {activity.updatedAt && Math.abs(new Date(activity.updatedAt).getTime() - created.getTime()) > 60_000 && (
                  <>
                    <span>·</span>
                    <span className="italic">editada</span>
                  </>
                )}
              </div>
            </div>
            {editable && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7 -mt-1">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" /> Editar</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setConfirmDel(true)} className="text-destructive">
                    <Trash2 className="h-3.5 w-3.5" /> Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
      {editable && (
        <LogActivityDialog
          open={editing}
          onOpenChange={setEditing}
          contactId={contactId}
          kind={EDITABLE[activity.type]}
          initial={{
            id: activity.id,
            description: activity.description,
            occurredAt: activity.occurredAt,
            metadata: activity.metadata,
          }}
        />
      )}
      <ConfirmDialog
        open={confirmDel}
        onOpenChange={setConfirmDel}
        title="Eliminar actividad"
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        destructive
        onConfirm={async () => {
          await del.mutateAsync(activity.id);
          toast.success("Actividad eliminada");
          setConfirmDel(false);
        }}
      />
    </>
  );
}

function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "effective" | "attempt" }) {
  return (
    <span className={cn(
      "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium",
      tone === "effective" && "bg-primary/10 text-primary",
      tone === "attempt" && "bg-muted text-muted-foreground",
      tone === "default" && "bg-muted text-foreground",
    )}>
      {children}
    </span>
  );
}