import { useState } from "react";
import { toast } from "sonner";
import { FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { relativeTime } from "@/lib/format/relativeTime";
import {
  useContactActivity,
  useCreateContactActivity,
  useDeleteContactActivity,
} from "@/lib/queries/contacts";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { aiMemory } from "@/services/aiMemory";

interface Props { contactId: string }

export function NotesTab({ contactId }: Props) {
  const { data: activity = [] } = useContactActivity(contactId);
  const create = useCreateContactActivity(contactId);
  const remove = useDeleteContactActivity(contactId);
  const [text, setText] = useState("");
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);

  const notes = activity.filter((a) => a.type === "note");

  async function save() {
    const t = text.trim();
    if (!t) return toast.error("Escribe una nota");
    if (t.length > 2000) return toast.error("Máx 2000 caracteres");
    try {
      await create.mutateAsync({ type: "note", description: t });
      aiMemory.logEvent("contact", contactId, "note_added", { length: t.length }).catch(() => {});
      setText("");
      toast.success("Nota guardada");
    } catch (e: any) {
      toast.error(e.message ?? "Error al guardar");
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 shadow-card space-y-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe una nota interna sobre este contacto…"
          rows={3}
          maxLength={2000}
        />
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">{text.length}/2000</span>
          <Button size="sm" onClick={save} disabled={create.isPending || !text.trim()}>
            {create.isPending ? "Guardando…" : "Guardar nota"}
          </Button>
        </div>
      </div>

      {notes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center shadow-card">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Aún no hay notas para este contacto.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border shadow-card">
          {notes.map((n) => (
            <div key={n.id} className="p-4 flex gap-3 group">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="text-[10px] bg-muted">{n.agentInitials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-sm whitespace-pre-wrap break-words">{n.description}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {n.agent} · {relativeTime(n.timestamp)}
                </div>
              </div>
              {uid && n.agentId === uid && (
                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100"
                  onClick={() => {
                    if (confirm("¿Eliminar esta nota?")) {
                      remove.mutate(n.id, {
                        onSuccess: () => toast.success("Nota eliminada"),
                        onError: (e: any) => toast.error(e.message ?? "Error"),
                      });
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}