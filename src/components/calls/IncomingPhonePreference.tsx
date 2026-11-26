import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PhoneIncoming } from "lucide-react";
import { inboundRequest, useInboundPolicy } from "@/hooks/useInboundPolicy";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export function IncomingPhonePreference() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const { data, isLoading, isError } = useInboundPolicy();
  const save = async (enabled: boolean) => {
    setBusy(true);
    try {
      await inboundRequest({ action: "save_inbound_preference", phone_enabled: enabled });
      await qc.invalidateQueries({ queryKey: ["inbound-policy"] });
      toast.success(enabled ? "Recepción en tu celular activada" : "Recepción en celular desactivada");
    } catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo guardar tu elección"); }
    finally { setBusy(false); }
  };
  const note = isError ? "No se pudo consultar tu elección. Intenta nuevamente." : !data?.can_receive_phone ? "Tu empresa desactivó la recepción en celular para tu usuario." : "El desvío al celular genera minutos adicionales.";
  const phone = `Teléfono de mi perfil: ${data?.phone ?? "Sin registrar"}`;
  return <section className="border-y border-border py-4">
    <div className="flex items-center gap-3">
      <Label htmlFor="receive-incoming-phone" className="flex shrink-0 items-center gap-2"><PhoneIncoming className="h-4 w-4 text-primary" /> Recibir llamadas en mi celular</Label>
      <span className="min-w-0 truncate text-sm" title={phone}>{phone}</span>
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={note}>{note}</span>
      <Switch id="receive-incoming-phone" className="shrink-0" checked={!!data?.can_receive_phone && !!data?.phone_enabled} disabled={busy || isLoading || isError || !data?.can_receive_phone || !data?.phone} onCheckedChange={save} />
    </div>
  </section>;
}
