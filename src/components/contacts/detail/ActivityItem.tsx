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
  const editable = activity.type in EDITABLE;
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
              <div className="text-sm whitespace-pre-wrap break-words">{activity.description}</div>
              {/* metadata badges */}
              {(meta.result || meta.duration || meta.subject || meta.location) && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {meta.result && <Badge>{meta.result}</Badge>}
                  {meta.duration && <Badge>{meta.duration}</Badge>}
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

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium">{children}</span>;
}