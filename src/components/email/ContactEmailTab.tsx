import { useState } from "react";
import { Mail } from "lucide-react";
import { useEmailThreads } from "@/lib/queries/email";
import { EmailComposer } from "./EmailComposer";
import { EmailThreadView } from "./EmailThreadView";
import { Button } from "@/components/ui/button";

export function ContactEmailTab({ contactId, contactEmail }: { contactId: string; contactEmail?: string | null }) {
  const { data: threads = [] } = useEmailThreads({ contactId });
  const [openId, setOpenId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const open = threads.find((t) => t.id === openId);

  if (!contactEmail) return <p className="text-sm text-muted-foreground p-6 text-center">Este contacto no tiene correo registrado.</p>;
  if (open) return (
    <div className="rounded-xl border border-border bg-card h-[600px]">
      <Button variant="ghost" size="sm" className="m-2" onClick={() => setOpenId(null)}>← Volver</Button>
      <div className="h-[calc(100%-48px)]"><EmailThreadView thread={open} /></div>
    </div>
  );
  return (
    <div className="space-y-3">
      {composing ? (
        <div className="rounded-xl border border-border bg-card p-3">
          <EmailComposer contactId={contactId} onSent={(id) => { setComposing(false); setOpenId(id); }} />
        </div>
      ) : <Button onClick={() => setComposing(true)}><Mail className="h-4 w-4" /> Nuevo correo</Button>}
      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {threads.map((t) => (
          <button key={t.id} onClick={() => setOpenId(t.id)} className="w-full text-left p-3 hover:bg-muted/30">
            <div className="flex justify-between gap-2"><span className="text-sm font-medium truncate">{t.subject || "(sin asunto)"}</span>{t.unread && <span className="h-2 w-2 rounded-full bg-primary mt-1.5" />}</div>
            <div className="text-xs text-muted-foreground truncate">{t.last_snippet}</div>
          </button>
        ))}
        {threads.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Sin correos todavía.</div>}
      </div>
    </div>
  );
}
