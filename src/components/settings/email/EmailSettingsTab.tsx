import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, CheckCircle2, AlertCircle, Copy } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTenantUsers } from "@/lib/queries/tenantUsers";
import { useEmailAccounts, useEmailProviders, useEmailSettings, emailApi, PROVIDER_PRESETS, BULK_PROVIDERS } from "@/lib/queries/email";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toastError, toastSuccess } from "@/lib/toast";

const MODES = [
  { v: "own", l: "Cuenta propia", d: "Cada asesor conecta su correo y envía desde él." },
  { v: "generic", l: "Cuentas genéricas", d: "Todos envían desde cuentas de la empresa (ventas@, admisiones@)." },
  { v: "mixed", l: "Mixto", d: "Cuenta propia si la tiene; si no, una genérica." },
];

export function EmailSettingsTab() {
  const { user, roles } = useAuth();
  const isAdmin = ["tenant_owner", "tenant_admin", "platform_owner", "platform_staff", "super_admin"].some((r) => roles.includes(r as any));
  const qc = useQueryClient();
  const { data: settings } = useEmailSettings();
  const { data: accounts = [] } = useEmailAccounts();
  const { data: providers = [] } = useEmailProviders();
  const { data: users = [] } = useTenantUsers();
  const [acc, setAcc] = useState<any | null>(null);
  const [prov, setProv] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => ["email-accounts", "email-providers", "email-settings"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

  const visibleAccounts = isAdmin ? accounts : accounts.filter((a: any) => a.owner_user_id === user?.id);

  async function saveMode(v: string) {
    try { await emailApi("save_settings", { send_mode: v }); refresh(); toastSuccess("Guardado"); } catch (e) { toastError("Error", (e as Error).message); }
  }
  async function saveAccount() {
    setBusy(true);
    try {
      const r: any = await emailApi("save_account", { account: acc });
      refresh();
      if (r.status === "connected") { toastSuccess("Cuenta conectada"); setAcc(null); }
      else toastError("Se guardó, pero no conecta", r.error);
    } catch (e) { toastError("Error", (e as Error).message); } finally { setBusy(false); }
  }
  async function saveProvider() {
    setBusy(true);
    try {
      const r: any = await emailApi("save_provider", { provider: prov });
      refresh();
      try { await emailApi("test_provider", { id: r.id }); toastSuccess("Proveedor conectado", "Te enviamos un correo de prueba."); setProv(null); }
      catch (e) { toastError("Se guardó, pero la prueba falló", (e as Error).message); }
    } catch (e) { toastError("Error", (e as Error).message); } finally { setBusy(false); }
  }
  async function copyHook(provider: string) {
    const r: any = await emailApi("webhook_url", { provider });
    await navigator.clipboard.writeText(r.url);
    toastSuccess("Dirección copiada", "Pégala en la sección de webhooks/eventos de tu proveedor.");
  }

  const newAccount = (kind: "personal" | "generic") => { const p = PROVIDER_PRESETS.gmail; setAcc({ kind, preset: "gmail", email: "", display_name: "", password: "", smtp_host: p.smtp_host, smtp_port: p.smtp_port, imap_host: p.imap_host, imap_port: p.imap_port, allowed_user_ids: [] }); };

  return (
    <div className="space-y-8 max-w-4xl">
      {isAdmin && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">¿Desde dónde envían tus asesores?</h2>
          <RadioGroup value={settings?.send_mode ?? "mixed"} onValueChange={saveMode} className="grid md:grid-cols-3 gap-2">
            {MODES.map((m) => (
              <label key={m.v} className="rounded-xl border border-border bg-card p-3 flex gap-2 cursor-pointer">
                <RadioGroupItem value={m.v} className="mt-1" />
                <div><div className="font-medium text-sm">{m.l}</div><div className="text-xs text-muted-foreground">{m.d}</div></div>
              </label>
            ))}
          </RadioGroup>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <h2 className="text-lg font-semibold">Cuentas de correo</h2>
          <div className="flex gap-2">
            {settings?.send_mode !== "generic" && <Button variant="outline" onClick={() => newAccount("personal")}><Plus className="h-4 w-4" /> Conectar mi correo</Button>}
            {isAdmin && <Button onClick={() => newAccount("generic")}><Plus className="h-4 w-4" /> Cuenta genérica</Button>}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Walix lee la bandeja de entrada cada 5 minutos y guarda solo los correos de tus contactos.</p>
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {visibleAccounts.map((a: any) => (
            <div key={a.id} className="p-3 flex items-center gap-3">
              {a.status === "connected" ? <CheckCircle2 className="h-5 w-5 text-success" /> : <AlertCircle className="h-5 w-5 text-destructive" />}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{a.email} <Badge variant="outline" className="ml-1">{a.kind === "generic" ? "Genérica" : "Personal"}</Badge></div>
                <div className="text-xs text-muted-foreground truncate">
                  {a.kind === "generic" ? (a.allowed_user_ids.length ? `${a.allowed_user_ids.length} asesores` : "Todo el equipo") : (users as any[]).find((u) => u.id === a.owner_user_id)?.name}
                  {a.last_error && <span className="text-destructive"> · {a.last_error}</span>}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setAcc({ ...a, password: "", preset: "otro" })}>Editar</Button>
              <Button size="icon" variant="ghost" onClick={async () => { await emailApi("delete_account", { id: a.id }); refresh(); }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          {visibleAccounts.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Sin cuentas conectadas.</p>}
        </div>
      </section>

      {isAdmin && (
        <section className="space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Proveedores para envío masivo</h2>
            <Button onClick={() => setProv({ provider: "brevo", name: "", from_email: "", from_name: "", secret: "", config: {} })}><Plus className="h-4 w-4" /> Agregar proveedor</Button>
          </div>
          <p className="text-xs text-muted-foreground">El remitente debe usar un dominio verificado en tu proveedor. El costo de los envíos lo cobra el proveedor.</p>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {providers.map((p: any) => (
              <div key={p.id} className="p-3 flex items-center gap-3">
                {p.status === "connected" ? <CheckCircle2 className="h-5 w-5 text-success" /> : <AlertCircle className="h-5 w-5 text-destructive" />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{p.name} <Badge variant="outline" className="ml-1">{BULK_PROVIDERS[p.provider]?.label}</Badge></div>
                  <div className="text-xs text-muted-foreground truncate">{p.from_email}{p.last_error && <span className="text-destructive"> · {p.last_error}</span>}</div>
                </div>
                {p.provider !== "smtp" && p.provider !== "ses" && <Button size="sm" variant="ghost" onClick={() => copyHook(p.provider)}><Copy className="h-4 w-4" /> Webhook</Button>}
                <Button size="sm" variant="ghost" onClick={() => setProv({ ...p, secret: "" })}>Editar</Button>
                <Button size="icon" variant="ghost" onClick={async () => { await emailApi("delete_provider", { id: p.id }); refresh(); }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            {providers.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Sin proveedores. Agrega Brevo, SendGrid, Mailchimp, Amazon SES o Mailgun.</p>}
          </div>
        </section>
      )}

      <Dialog open={!!acc} onOpenChange={(o) => !o && setAcc(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{acc?.kind === "generic" ? "Cuenta genérica" : "Mi cuenta de correo"}</DialogTitle></DialogHeader>
          {acc && <div className="space-y-2">
            <Label>Proveedor</Label>
            <Select value={acc.preset} onValueChange={(v) => { const p = PROVIDER_PRESETS[v]; setAcc({ ...acc, preset: v, smtp_host: p.smtp_host, smtp_port: p.smtp_port, imap_host: p.imap_host, imap_port: p.imap_port }); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(PROVIDER_PRESETS).map(([k, p]) => <SelectItem key={k} value={k}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
            {PROVIDER_PRESETS[acc.preset]?.hint && <p className="text-xs text-muted-foreground">{PROVIDER_PRESETS[acc.preset].hint}</p>}
            <Input placeholder="correo@empresa.com" value={acc.email} onChange={(e) => setAcc({ ...acc, email: e.target.value })} />
            <Input placeholder="Nombre que verá el lead (ej. Mariana – SXP)" value={acc.display_name ?? ""} onChange={(e) => setAcc({ ...acc, display_name: e.target.value })} />
            <Input type="password" placeholder={acc.id ? "Contraseña (déjala vacía para no cambiarla)" : "Contraseña o contraseña de aplicación"} value={acc.password} onChange={(e) => setAcc({ ...acc, password: e.target.value })} />
            <div className="grid grid-cols-[1fr_90px] gap-2">
              <Input placeholder="Servidor de salida (SMTP)" value={acc.smtp_host} onChange={(e) => setAcc({ ...acc, smtp_host: e.target.value })} />
              <Input placeholder="Puerto" value={acc.smtp_port} onChange={(e) => setAcc({ ...acc, smtp_port: e.target.value })} />
              <Input placeholder="Servidor de entrada (IMAP)" value={acc.imap_host} onChange={(e) => setAcc({ ...acc, imap_host: e.target.value })} />
              <Input placeholder="Puerto" value={acc.imap_port} onChange={(e) => setAcc({ ...acc, imap_port: e.target.value })} />
            </div>
            <Input placeholder="Usuario (si es distinto al correo)" value={acc.username ?? ""} onChange={(e) => setAcc({ ...acc, username: e.target.value })} />
            <Textarea rows={3} placeholder="Firma" value={acc.signature ?? ""} onChange={(e) => setAcc({ ...acc, signature: e.target.value })} />
            {acc.kind === "generic" && <div>
              <Label>¿Quién puede usarla? (vacío = todo el equipo)</Label>
              <div className="flex flex-wrap gap-3 mt-1">{(users as any[]).map((u) => <label key={u.id} className="text-sm flex items-center gap-1.5"><Checkbox checked={acc.allowed_user_ids.includes(u.id)} onCheckedChange={() => setAcc({ ...acc, allowed_user_ids: acc.allowed_user_ids.includes(u.id) ? acc.allowed_user_ids.filter((x: string) => x !== u.id) : [...acc.allowed_user_ids, u.id] })} />{u.name}</label>)}</div>
            </div>}
          </div>}
          <DialogFooter><Button onClick={saveAccount} disabled={busy || !acc?.email}>{busy ? "Probando conexión…" : "Guardar y probar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!prov} onOpenChange={(o) => !o && setProv(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Proveedor de envío masivo</DialogTitle></DialogHeader>
          {prov && <div className="space-y-2">
            <Select value={prov.provider} onValueChange={(v) => setProv({ ...prov, provider: v, config: {} })} disabled={!!prov.id}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(BULK_PROVIDERS).map(([k, p]) => <SelectItem key={k} value={k}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Nombre interno (ej. Brevo principal)" value={prov.name} onChange={(e) => setProv({ ...prov, name: e.target.value })} />
            <Input placeholder="Correo remitente (dominio verificado)" value={prov.from_email} onChange={(e) => setProv({ ...prov, from_email: e.target.value })} />
            <Input placeholder="Nombre remitente" value={prov.from_name ?? ""} onChange={(e) => setProv({ ...prov, from_name: e.target.value })} />
            {BULK_PROVIDERS[prov.provider].fields.map((f) => (
              <Input key={f.key} placeholder={f.placeholder ? `${f.label} (${f.placeholder})` : f.label} value={prov.config[f.key] ?? ""} onChange={(e) => setProv({ ...prov, config: { ...prov.config, [f.key]: e.target.value } })} />
            ))}
            <Input type="password" placeholder={prov.id ? `${BULK_PROVIDERS[prov.provider].secretLabel} (vacío = sin cambio)` : BULK_PROVIDERS[prov.provider].secretLabel} value={prov.secret} onChange={(e) => setProv({ ...prov, secret: e.target.value })} />
          </div>}
          <DialogFooter><Button onClick={saveProvider} disabled={busy || !prov?.name || !prov?.from_email}>{busy ? "Probando…" : "Guardar y enviar prueba"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
