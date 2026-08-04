import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { WBadge } from "@/components/walix/Badge";
import { toast } from "sonner";
import { Copy, Loader2, MessageCircle, Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  usePlatformChannel,
  useSavePlatformChannel,
  useTestPlatformNumber,
  useAllUserAccess,
  useToggleAccess,
  PLATFORM_WEBHOOK_URL,
} from "@/lib/queries/platformWhatsapp";

export function PlatformWhatsappCard() {
  const { data: channel, isLoading } = usePlatformChannel();
  const save = useSavePlatformChannel();
  const test = useTestPlatformNumber();
  const { data: access = [] } = useAllUserAccess();
  const toggle = useToggleAccess();

  const [form, setForm] = useState({
    display_name: "Walix Bot",
    phone_number: "",
    phone_number_id: "",
    business_account_id: "",
    access_token: "",
  });
  const [testTo, setTestTo] = useState("");

  useEffect(() => {
    if (channel) {
      setForm({
        display_name: channel.display_name ?? "Walix Bot",
        phone_number: channel.phone_number ?? "",
        phone_number_id: channel.phone_number_id ?? "",
        business_account_id: channel.business_account_id ?? "",
        access_token: "",
      });
    }
  }, [channel?.id]);

  const copy = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copiado`);
  };

  const onSave = async () => {
    try {
      await save.mutateAsync({ id: channel?.id, ...form });
      toast.success("Número global guardado");
      setForm((f) => ({ ...f, access_token: "" }));
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar");
    }
  };

  const onTest = async () => {
    if (!testTo.trim()) return toast.error("Escribe un número autorizado");
    try {
      await test.mutateAsync(testTo.trim());
      toast.success("Mensaje de prueba enviado");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo enviar");
    }
  };

  const statusVariant: "success" | "danger" | "neutral" =
    channel?.status === "connected" ? "success" : channel?.status === "error" ? "danger" : "neutral";

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
            WhatsApp global de Walix (Copilot)
          </span>
        </div>
        <WBadge variant={statusVariant}>{channel?.status ?? "sin configurar"}</WBadge>
      </div>

      <div className="p-5 space-y-6">
        <p className="text-sm text-muted-foreground">
          Un solo número para que los equipos de todas las empresas conversen con el Copilot. La empresa se
          identifica por el teléfono del remitente autorizado.
        </p>

        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 mx-auto mb-2 animate-spin" /> Cargando...
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Nombre visible" value={form.display_name}
                onChange={(v) => setForm({ ...form, display_name: v })} placeholder="Walix Bot" />
              <Field label="Número (E.164)" value={form.phone_number}
                onChange={(v) => setForm({ ...form, phone_number: v })} placeholder="+52 55 0000 0000" />
              <Field label="Phone Number ID" value={form.phone_number_id}
                onChange={(v) => setForm({ ...form, phone_number_id: v })} placeholder="1234567890" />
              <Field label="WABA ID" value={form.business_account_id}
                onChange={(v) => setForm({ ...form, business_account_id: v })} placeholder="1234567890" />
              <div className="md:col-span-2">
                <Field
                  label={channel ? "Token permanente (dejar vacío para conservar el actual)" : "Token permanente"}
                  value={form.access_token} type="password"
                  onChange={(v) => setForm({ ...form, access_token: v })} placeholder="EAAG..." />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={onSave} disabled={save.isPending}>
                {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Guardar configuración
              </Button>
            </div>

            <div className="rounded-lg border border-border p-4 space-y-3">
              <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                Datos para Meta
              </p>
              <CopyRow label="URL del webhook" value={PLATFORM_WEBHOOK_URL} onCopy={copy} />
              <CopyRow label="Verify token" value={channel?.verify_token ?? "Guarda la configuración para generarlo"}
                onCopy={copy} disabled={!channel?.verify_token} />
              <div className="text-xs text-muted-foreground grid sm:grid-cols-2 gap-1 pt-1">
                <span>
                  Último webhook:{" "}
                  {channel?.last_webhook_at
                    ? formatDistanceToNow(new Date(channel.last_webhook_at), { locale: es, addSuffix: true })
                    : "—"}
                </span>
                <span>
                  Último entrante:{" "}
                  {channel?.last_inbound_at
                    ? `${channel.last_inbound_from ?? ""} · ${formatDistanceToNow(new Date(channel.last_inbound_at), { locale: es, addSuffix: true })}`
                    : "—"}
                </span>
              </div>
              {channel?.last_error && (
                <p className="text-xs text-destructive">Último error: {channel.last_error}</p>
              )}
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs">Enviar prueba a</Label>
                <Input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="+52 55 1234 5678" />
              </div>
              <Button variant="outline" onClick={onTest} disabled={test.isPending || !channel}>
                {test.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Enviar mensaje de prueba
              </Button>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                Teléfonos autorizados ({access.length})
              </p>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-muted-foreground bg-muted/20">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Persona</th>
                      <th className="text-left px-4 py-2 font-medium">Teléfono</th>
                      <th className="text-left px-4 py-2 font-medium">Empresa</th>
                      <th className="text-left px-4 py-2 font-medium">Permiso</th>
                      <th className="text-left px-4 py-2 font-medium">Activo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {access.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                        Aún no hay teléfonos autorizados.
                      </td></tr>
                    ) : access.map((a) => (
                      <tr key={a.id} className="hover:bg-muted/30">
                        <td className="px-4 py-2">{a.display_name ?? "—"}</td>
                        <td className="px-4 py-2 font-mono text-xs">{a.phone_e164}</td>
                        <td className="px-4 py-2 text-muted-foreground">{a.tenant_name}</td>
                        <td className="px-4 py-2">{a.permission_level}</td>
                        <td className="px-4 py-2">
                          <Switch
                            checked={a.enabled}
                            onCheckedChange={(v) => toggle.mutate({ id: a.id, enabled: v })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

function Field({ label, value, onChange, placeholder, type }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input value={value} type={type} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function CopyRow({ label, value, onCopy, disabled }: {
  label: string; value: string; onCopy: (v: string, l: string) => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-32 shrink-0">{label}</span>
      <code className="flex-1 truncate text-xs bg-muted px-2 py-1 rounded">{value}</code>
      <Button size="icon" variant="ghost" disabled={disabled} onClick={() => onCopy(value, label)}>
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  );
}