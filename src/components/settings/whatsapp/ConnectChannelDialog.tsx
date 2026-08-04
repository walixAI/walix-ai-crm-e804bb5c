import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUpsertChannel, useTestChannel, type ChannelKind, type WhatsappChannel } from "@/lib/queries/whatsappChannels";

const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;

interface Props {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  kind: ChannelKind;
  existing?: WhatsappChannel;
  /** "new" fuerza la creación de un número adicional del mismo tipo. */
  channelId?: string | "new";
}

export function ConnectChannelDialog({ open, onClose, tenantId, kind, existing, channelId }: Props) {
  const { toast } = useToast();
  const upsert = useUpsertChannel(tenantId);
  const test = useTestChannel(tenantId);
  const [step, setStep] = useState<1 | 2 | 3>(existing?.verify_token ? 2 : 1);
  const [form, setForm] = useState({
    display_name: existing?.display_name ?? "",
    phone_number: existing?.phone_number ?? "",
    phone_number_id: existing?.phone_number_id ?? "",
    business_account_id: existing?.business_account_id ?? "",
    access_token: "",
  });
  const [verifyToken, setVerifyToken] = useState(existing?.verify_token ?? "");
  const [copied, setCopied] = useState<string | null>(null);

  function copy(label: string, value: string) {
    navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }

  async function handleSave() {
    if (!form.phone_number || !form.phone_number_id || !form.business_account_id || (!existing && !form.access_token)) {
      return toast({ title: "Faltan datos", variant: "destructive" });
    }
    try {
      const r = await upsert.mutateAsync({ ...form, kind, channelId: channelId ?? existing?.id });
      setVerifyToken(r.verify_token);
      setStep(3);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  async function handleConfirm() {
    if (!existing?.id && !verifyToken) return;
    const id = existing?.id;
    if (!id) return toast({ title: "Guarda primero las credenciales" });
    try {
      const r = await test.mutateAsync(id);
      if (r?.ok === false) {
        toast({ title: "No se pudo verificar", description: r.last_error ?? "Meta rechazó las credenciales", variant: "destructive" });
      } else {
        toast({ title: "Canal conectado", description: r?.meta_info?.display_phone_number ?? undefined });
        onClose();
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  const kindLabel = kind === "clients" ? "Clientes" : "Equipo (Walix Bot)";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Conectar WhatsApp · {kindLabel}</DialogTitle>
          <DialogDescription>
            Conexión vía Meta Cloud API. Necesitas una cuenta de WhatsApp Business y un número dedicado.
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4 text-sm">
            <p className="font-medium">Paso 1 — Crea tu app en Meta</p>
            <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
              <li>Entra a <a href="https://business.facebook.com" target="_blank" className="text-primary inline-flex items-center gap-1">business.facebook.com <ExternalLink className="h-3 w-3" /></a> y crea una app tipo "Negocio".</li>
              <li>Agrega el producto "WhatsApp" y registra un número dedicado para este canal ({kindLabel}).</li>
              <li>Copia tu <b>Phone Number ID</b>, <b>WhatsApp Business Account ID (WABA)</b> y genera un <b>System User Token</b> permanente con permisos <code>whatsapp_business_messaging</code> y <code>whatsapp_business_management</code>.</li>
            </ol>
            <DialogFooter>
              <Button onClick={() => setStep(2)}>Ya lo tengo, continuar</Button>
            </DialogFooter>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="font-medium text-sm">Paso 2 — Pega las credenciales</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Nombre interno</Label>
                <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="Ventas MX" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Número (E.164)</Label>
                <Input value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} placeholder="+525555551234" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Phone Number ID</Label>
                <Input value={form.phone_number_id} onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">WhatsApp Business Account ID</Label>
                <Input value={form.business_account_id} onChange={(e) => setForm({ ...form, business_account_id: e.target.value })} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">System User Token (permanente)</Label>
                <Input
                  type="password"
                  value={form.access_token}
                  onChange={(e) => setForm({ ...form, access_token: e.target.value })}
                  placeholder={existing ? "•••••••• (deja en blanco para conservar el actual)" : "EAAG..."}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep(1)}>Atrás</Button>
              {existing && verifyToken && (
                <Button variant="outline" onClick={() => setStep(3)}>Ver webhook</Button>
              )}
              <Button onClick={handleSave} disabled={upsert.isPending}>
                {existing ? "Guardar cambios" : "Guardar y continuar"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3 text-sm">
            <p className="font-medium">Paso 3 — Configura el webhook en Meta</p>
            <p className="text-muted-foreground text-xs">
              En la configuración de la app de Meta → WhatsApp → Configuración → Webhooks, pega:
            </p>
            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-xs">Callback URL</Label>
                <div className="flex gap-2">
                  <Input readOnly value={WEBHOOK_URL} className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={() => copy("url", WEBHOOK_URL)}>
                    {copied === "url" ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Verify Token</Label>
                <div className="flex gap-2">
                  <Input readOnly value={verifyToken} className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={() => copy("vt", verifyToken)}>
                    {copied === "vt" ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Suscríbete a los campos <code>messages</code>. Una vez verificado por Meta, presiona "Marcar como conectado".
              </p>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep(2)}>Atrás</Button>
              <Button variant="ghost" onClick={onClose}>Cerrar</Button>
              <Button onClick={handleConfirm} disabled={test.isPending}>Marcar como conectado</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}