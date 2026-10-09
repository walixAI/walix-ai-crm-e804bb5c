import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmailMessages } from "@/lib/queries/email";
import { EmailComposer } from "./EmailComposer";
import { cn } from "@/lib/utils";

export function EmailThreadView({ thread }: { thread: any }) {
  const { data: msgs = [], isLoading } = useEmailMessages(thread.id);
  const qc = useQueryClient();
  useEffect(() => {
    if (thread.unread) supabase.from("email_threads").update({ unread: false }).eq("id", thread.id).then(() => qc.invalidateQueries({ queryKey: ["email-threads"] }));
  }, [thread.id, thread.unread, qc]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="font-semibold truncate">{thread.subject || "(sin asunto)"}</h2>
        <p className="text-xs text-muted-foreground">{thread.contacts?.name} · {thread.contacts?.email}</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {msgs.map((m: any) => (
          <div key={m.id} className={cn("rounded-xl border p-3 max-w-[90%]", m.direction === "outbound" ? "ml-auto bg-primary/5 border-primary/20" : "bg-card border-border")}>
            <div className="text-xs text-muted-foreground mb-1 flex justify-between gap-4">
              <span>{m.direction === "outbound" ? `Enviado desde ${m.from_email}` : `De ${m.from_email}`}</span>
              <span>{new Date(m.sent_at).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}</span>
            </div>
            <div className="text-sm whitespace-pre-wrap break-words">{m.body_text || "(sin texto)"}</div>
          </div>
        ))}
      </div>
      <div className="border-t border-border p-3">
        <EmailComposer threadId={thread.id} />
      </div>
    </div>
  );
}
