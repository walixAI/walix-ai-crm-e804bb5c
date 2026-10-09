import { useState } from "react";
import { Paperclip, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEmailAccounts, useEmailTemplates, useSendEmail, fileToBase64 } from "@/lib/queries/email";
import { useAuth } from "@/hooks/useAuth";
import { toastError, toastSuccess } from "@/lib/toast";

interface Props {
  contactId?: string;
  threadId?: string;
  defaultSubject?: string;
  onSent?: (threadId: string) => void;
}

export function EmailComposer({ contactId, threadId, defaultSubject, onSent }: Props) {
  const { user } = useAuth();
  const { data: accounts = [] } = useEmailAccounts();
  const { data: templates = [] } = useEmailTemplates();
  const send = useSendEmail();
  const mine = accounts.filter((a: any) => a.status === "connected" && ((a.kind === "personal" && a.owner_user_id === user?.id) || (a.kind === "generic" && (a.allowed_user_ids.length === 0 || a.allowed_user_ids.includes(user?.id)))));
  const [accountId, setAccountId] = useState<string>("");
  const [subject, setSubject] = useState(defaultSubject ?? "");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  async function submit() {
    try {
      const attachments = await Promise.all(files.map(async (f) => ({ filename: f.name, content: await fileToBase64(f), contentType: f.type })));
      const r: any = await send.mutateAsync({ contact_id: contactId, thread_id: threadId, subject: threadId ? undefined : subject, text, account_id: accountId || undefined, attachments });
      toastSuccess("Correo enviado");
      setText(""); setFiles([]);
      if (!threadId) setSubject("");
      onSent?.(r.thread_id);
    } catch (e) {
      toastError("No se pudo enviar", (e as Error).message);
    }
  }

  if (mine.length === 0) {
    return <p className="text-sm text-muted-foreground p-3 rounded-lg border border-dashed border-border">No tienes una cuenta de correo conectada. Pide a tu administrador una cuenta genérica o conecta la tuya en Configuración → Email.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap">
        {mine.length > 1 && (
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Enviar desde…" /></SelectTrigger>
            <SelectContent>{mine.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.email}</SelectItem>)}</SelectContent>
          </Select>
        )}
        {templates.length > 0 && (
          <Select onValueChange={(id) => { const t: any = templates.find((x: any) => x.id === id); if (t) { if (!threadId) setSubject(t.subject); setText(t.body); } }}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Usar plantilla" /></SelectTrigger>
            <SelectContent>{templates.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>
      {!threadId && <Input placeholder="Asunto" value={subject} onChange={(e) => setSubject(e.target.value)} />}
      <Textarea rows={6} placeholder="Escribe tu mensaje… puedes usar {{nombre}}, {{empresa}}, {{compania}}" value={text} onChange={(e) => setText(e.target.value)} />
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {files.map((f, i) => (
            <span key={i} className="text-xs bg-muted rounded px-2 py-1 inline-flex items-center gap-1">
              {f.name}<button onClick={() => setFiles(files.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
      <div className="flex justify-between items-center">
        <label className="text-sm text-muted-foreground inline-flex items-center gap-1 cursor-pointer hover:text-foreground">
          <Paperclip className="h-4 w-4" /> Adjuntar
          <input type="file" multiple className="hidden" onChange={(e) => {
            const list = Array.from(e.target.files ?? []);
            if ([...files, ...list].reduce((s, f) => s + f.size, 0) > 8 * 1024 * 1024) { toastError("Adjuntos muy pesados", "Máximo 8 MB en total."); return; }
            setFiles([...files, ...list]);
          }} />
        </label>
        <Button onClick={submit} disabled={send.isPending || !text.trim() || (!threadId && !subject.trim())}>
          <Send className="h-4 w-4" /> {send.isPending ? "Enviando…" : "Enviar"}
        </Button>
      </div>
    </div>
  );
}
