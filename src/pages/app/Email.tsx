import { useState } from "react";
import { Mail, Plus, Trash2, Search, Send, Eye } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantId } from "@/lib/queries/tenant";
import { useTenantUsers } from "@/lib/queries/tenantUsers";
import { usePipelineStagesForEmail } from "@/components/email/usePipelineStagesForEmail";
import { useEmailThreads, useEmailTemplates, useEmailCampaigns, useEmailProviders, emailApi } from "@/lib/queries/email";
import { EmailThreadView } from "@/components/email/EmailThreadView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toastError, toastSuccess } from "@/lib/toast";
import { cn } from "@/lib/utils";

export default function EmailPage() {
  const { roles } = useAuth();
  const isSup = ["tenant_owner", "tenant_admin", "sales_manager", "platform_owner", "platform_staff", "super_admin"].some((r) => roles.includes(r as any));
  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Mail className="h-6 w-6" /> Email</h1>
        <p className="text-sm text-muted-foreground mt-1">{isSup ? "Ves los correos de todo el equipo." : "Ves los correos de tus leads."}</p>
      </header>
      <Tabs defaultValue="inbox">
        <TabsList>
          <TabsTrigger value="inbox">Bandeja</TabsTrigger>
          <TabsTrigger value="templates">Plantillas</TabsTrigger>
          {isSup && <TabsTrigger value="campaigns">Envío masivo</TabsTrigger>}
        </TabsList>
        <TabsContent value="inbox" className="mt-4"><Inbox isSup={isSup} /></TabsContent>
        <TabsContent value="templates" className="mt-4"><Templates /></TabsContent>
        {isSup && <TabsContent value="campaigns" className="mt-4"><Campaigns /></TabsContent>}
      </Tabs>
    </div>
  );
}

function Inbox({ isSup }: { isSup: boolean }) {
  const [owner, setOwner] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const { data: users = [] } = useTenantUsers();
  const { data: threads = [], isLoading } = useEmailThreads({ ownerId: owner === "all" ? null : owner, search: search || undefined });
  const current = threads.find((t) => t.id === sel);
  const nameOf = (id: string) => (users as any[]).find((u) => u.id === id)?.name ?? "";

  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-4 h-[calc(100vh-240px)] min-h-[500px]">
      <div className="rounded-xl border border-border bg-card flex flex-col min-h-0">
        <div className="p-2 space-y-2 border-b border-border">
          <div className="relative"><Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" /><Input className="pl-8" placeholder="Buscar por asunto" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          {isSup && (
            <Select value={owner} onValueChange={setOwner}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los asesores</SelectItem>
                {(users as any[]).map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {isLoading && <p className="p-4 text-sm text-muted-foreground">Cargando…</p>}
          {threads.map((t) => (
            <button key={t.id} onClick={() => setSel(t.id)} className={cn("w-full text-left p-3 hover:bg-muted/40", sel === t.id && "bg-muted/60")}>
              <div className="flex justify-between gap-2">
                <span className={cn("text-sm truncate", t.unread && "font-semibold")}>{t.contacts?.name ?? t.contacts?.email}</span>
                <span className="text-[11px] text-muted-foreground shrink-0">{new Date(t.last_message_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}</span>
              </div>
              <div className="text-xs truncate">{t.subject || "(sin asunto)"}</div>
              <div className="text-xs text-muted-foreground truncate">{t.last_snippet}</div>
              {isSup && t.owner_id && <div className="text-[10px] text-muted-foreground mt-0.5">Asesor: {nameOf(t.owner_id)}</div>}
            </button>
          ))}
          {!isLoading && threads.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Sin correos. Escribe a un lead desde su ficha (pestaña Email).</p>}
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card min-h-0">
        {current ? <EmailThreadView key={current.id} thread={current} /> : <div className="h-full grid place-items-center text-sm text-muted-foreground">Elige un correo</div>}
      </div>
    </div>
  );
}

function Templates() {
  const { data: tenantId } = useTenantId();
  const { user } = useAuth();
  const { data: templates = [] } = useEmailTemplates();
  const qc = useQueryClient();
  const [edit, setEdit] = useState<any | null>(null);

  async function save() {
    const row = { tenant_id: tenantId!, name: edit.name, subject: edit.subject, body: edit.body, updated_at: new Date().toISOString() };
    const { error } = edit.id ? await supabase.from("email_templates").update(row).eq("id", edit.id) : await supabase.from("email_templates").insert({ ...row, created_by: user?.id });
    if (error) return toastError("No se guardó", error.message);
    toastSuccess("Plantilla guardada"); setEdit(null); qc.invalidateQueries({ queryKey: ["email-templates"] });
  }
  async function del(id: string) {
    await supabase.from("email_templates").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["email-templates"] });
  }
  return (
    <div className="space-y-3">
      <Button onClick={() => setEdit({ name: "", subject: "", body: "" })}><Plus className="h-4 w-4" /> Nueva plantilla</Button>
      <div className="grid md:grid-cols-2 gap-3">
        {templates.map((t: any) => (
          <div key={t.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex justify-between"><h3 className="font-medium">{t.name}</h3>
              <div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => setEdit(t)}>Editar</Button><Button size="icon" variant="ghost" onClick={() => del(t.id)}><Trash2 className="h-4 w-4" /></Button></div>
            </div>
            <p className="text-sm text-muted-foreground">{t.subject}</p>
            <p className="text-xs mt-2 line-clamp-3 whitespace-pre-wrap">{t.body}</p>
          </div>
        ))}
      </div>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "Editar plantilla" : "Nueva plantilla"}</DialogTitle></DialogHeader>
          {edit && <div className="space-y-2">
            <Input placeholder="Nombre interno" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            <Input placeholder="Asunto" value={edit.subject} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} />
            <Textarea rows={10} placeholder="Hola {{nombre}}, …" value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
            <p className="text-xs text-muted-foreground">Variables: {"{{nombre}}, {{nombre_completo}}, {{empresa}}, {{compania}}, {{asesor}}"}</p>
          </div>}
          <DialogFooter><Button onClick={save} disabled={!edit?.name || !edit?.body}>Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const STATUS: Record<string, string> = { draft: "Borrador", scheduled: "Programada", sending: "Enviando", sent: "Enviada", failed: "Falló" };
const LIFECYCLE = [{ v: "prospecto", l: "Prospecto" }, { v: "cliente", l: "Cliente" }, { v: "cliente_inactivo", l: "Cliente inactivo" }, { v: "inactivo", l: "Inactivo" }];

function Campaigns() {
  const { data: tenantId } = useTenantId();
  const { user } = useAuth();
  const { data: camps = [] } = useEmailCampaigns();
  const { data: providers = [] } = useEmailProviders();
  const { data: templates = [] } = useEmailTemplates();
  const { data: users = [] } = useTenantUsers();
  const stages = usePipelineStagesForEmail();
  const qc = useQueryClient();
  const [edit, setEdit] = useState<any | null>(null);
  const [preview, setPreview] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  const toggle = (key: string, v: string) => {
    const arr: string[] = edit.conditions[key] ?? [];
    setEdit({ ...edit, conditions: { ...edit.conditions, [key]: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] } });
  };

  async function save(): Promise<string | null> {
    const row = { tenant_id: tenantId!, name: edit.name, provider_id: edit.provider_id || null, subject: edit.subject, body: edit.body, conditions: edit.conditions, updated_at: new Date().toISOString() };
    const res = edit.id ? await supabase.from("email_campaigns").update(row).eq("id", edit.id).select("id").single() : await supabase.from("email_campaigns").insert({ ...row, created_by: user?.id }).select("id").single();
    if (res.error) { toastError("No se guardó", res.error.message); return null; }
    qc.invalidateQueries({ queryKey: ["email-campaigns"] });
    setEdit({ ...edit, id: res.data.id });
    return res.data.id;
  }
  async function doPreview() {
    const id = await save(); if (!id) return;
    try { setPreview({ id, ...(await emailApi("campaign_preview", { id })) }); } catch (e) { toastError("Error", (e as Error).message); }
  }
  async function launch() {
    setBusy(true);
    try {
      const r: any = await emailApi("campaign_launch", { id: preview.id, scheduled_at: edit.scheduled_at || null });
      toastSuccess("Campaña lanzada", `${r.sendable} destinatarios en cola.`);
      setPreview(null); setEdit(null); qc.invalidateQueries({ queryKey: ["email-campaigns"] });
    } catch (e) { toastError("No se lanzó", (e as Error).message); } finally { setBusy(false); }
  }

  if (providers.length === 0) return <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Para enviar correos masivos, conecta primero un proveedor (Brevo, SendGrid, Mailchimp, Amazon SES, Mailgun…) en Configuración → Email.<br />No se usan las cuentas de Gmail u Outlook para esto, porque las bloquean al mandar volumen.</div>;

  return (
    <div className="space-y-3">
      <Button onClick={() => setEdit({ name: "", subject: "", body: "", conditions: { lifecycle: ["prospecto"] }, provider_id: providers[0]?.id })}><Plus className="h-4 w-4" /> Nuevo envío masivo</Button>
      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {camps.map((c: any) => (
          <div key={c.id} className="p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2"><span className="font-medium truncate">{c.name}</span><Badge variant="outline">{STATUS[c.status] ?? c.status}</Badge></div>
              <div className="text-xs text-muted-foreground truncate">{c.subject}</div>
            </div>
            {c.status !== "draft" && <CampaignStats id={c.id} stats={c.stats} />}
            {c.status === "draft" && <Button size="sm" variant="outline" onClick={() => setEdit(c)}>Editar</Button>}
          </div>
        ))}
        {camps.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Aún no hay envíos masivos.</p>}
      </div>

      <Dialog open={!!edit && !preview} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Envío masivo</DialogTitle></DialogHeader>
          {edit && <div className="space-y-3">
            <Input placeholder="Nombre de la campaña" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Select value={edit.provider_id ?? ""} onValueChange={(v) => setEdit({ ...edit, provider_id: v })}>
                <SelectTrigger><SelectValue placeholder="Proveedor" /></SelectTrigger>
                <SelectContent>{providers.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.from_email})</SelectItem>)}</SelectContent>
              </Select>
              <Select onValueChange={(id) => { const t: any = templates.find((x: any) => x.id === id); if (t) setEdit({ ...edit, subject: t.subject, body: t.body }); }}>
                <SelectTrigger><SelectValue placeholder="Cargar plantilla" /></SelectTrigger>
                <SelectContent>{templates.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Input placeholder="Asunto" value={edit.subject} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} />
            <Textarea rows={8} placeholder="Hola {{nombre}}, …" value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
            <p className="text-xs text-muted-foreground">El enlace para darse de baja se agrega solo al final de cada correo.</p>
            <div>
              <Label>Ciclo de vida</Label>
              <div className="flex flex-wrap gap-3 mt-1">{LIFECYCLE.map((l) => <label key={l.v} className="text-sm flex items-center gap-1.5"><Checkbox checked={(edit.conditions.lifecycle ?? []).includes(l.v)} onCheckedChange={() => toggle("lifecycle", l.v)} />{l.l}</label>)}</div>
            </div>
            {stages.length > 0 && <div>
              <Label>Etapa de la oportunidad (opcional)</Label>
              <div className="flex flex-wrap gap-3 mt-1 max-h-32 overflow-y-auto">{stages.map((s) => <label key={s.id} className="text-sm flex items-center gap-1.5"><Checkbox checked={(edit.conditions.stage_ids ?? []).includes(s.id)} onCheckedChange={() => toggle("stage_ids", s.id)} />{s.label}</label>)}</div>
            </div>}
            <div>
              <Label>Asesor (opcional)</Label>
              <div className="flex flex-wrap gap-3 mt-1">{(users as any[]).map((u) => <label key={u.id} className="text-sm flex items-center gap-1.5"><Checkbox checked={(edit.conditions.owner_ids ?? []).includes(u.id)} onCheckedChange={() => toggle("owner_ids", u.id)} />{u.name}</label>)}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Etiquetas (separadas por coma)</Label><Input value={(edit.conditions.tags ?? []).join(", ")} onChange={(e) => setEdit({ ...edit, conditions: { ...edit.conditions, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } })} /></div>
              <div><Label>Programar (opcional)</Label><Input type="datetime-local" value={edit.scheduled_at ?? ""} onChange={(e) => setEdit({ ...edit, scheduled_at: e.target.value })} /></div>
            </div>
          </div>}
          <DialogFooter>
            <Button variant="outline" onClick={save} disabled={!edit?.name}>Guardar borrador</Button>
            <Button onClick={doPreview} disabled={!edit?.name || !edit?.subject || !edit?.body || !edit?.provider_id}><Eye className="h-4 w-4" /> Revisar destinatarios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar envío</DialogTitle></DialogHeader>
          {preview && <div className="space-y-1 text-sm">
            <p>Contactos que cumplen el filtro: <b>{preview.matched}</b></p>
            <p>Correos inválidos o repetidos: <b>{preview.invalid_or_dup}</b></p>
            <p>Dados de baja o rebotados: <b>{preview.suppressed}</b></p>
            <p className="text-base pt-2">Se enviarán: <b>{preview.sendable}</b> correos</p>
            <p className="text-xs text-muted-foreground pt-2">El costo lo cobra tu proveedor según tu plan con ellos.</p>
          </div>}
          <DialogFooter><Button onClick={launch} disabled={busy || !preview?.sendable}><Send className="h-4 w-4" /> {edit?.scheduled_at ? "Programar" : "Enviar ahora"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CampaignStats({ id, stats }: { id: string; stats: any }) {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  async function load() {
    const { data } = await supabase.from("email_campaign_recipients").select("status, opened_at, clicked_at").eq("campaign_id", id).limit(20000);
    const c: Record<string, number> = { abiertos: 0, clics: 0 };
    for (const r of data ?? []) { c[r.status] = (c[r.status] ?? 0) + 1; if (r.opened_at) c.abiertos++; if (r.clicked_at) c.clics++; }
    setCounts(c);
  }
  const L: Record<string, string> = { queued: "en cola", sent: "enviados", delivered: "entregados", failed: "fallidos", bounced: "rebotes", complained: "quejas", unsubscribed: "bajas", suppressed: "excluidos", abiertos: "abiertos", clics: "clics" };
  return (
    <div className="text-xs text-muted-foreground text-right">
      {counts ? Object.entries(counts).map(([k, v]) => <span key={k} className="ml-2">{v} {L[k] ?? k}</span>)
        : <button className="underline" onClick={load}>{stats?.sent ?? 0} enviados · ver métricas</button>}
    </div>
  );
}
