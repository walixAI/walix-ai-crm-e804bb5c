import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { PhoneIncoming } from "lucide-react";
import { inboundRequest, useInboundPolicy } from "@/hooks/useInboundPolicy";
import { Button } from "@/components/ui/button";
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
      toast.success(enabled ? "Recepción en tu celular activada" : "Solo recibirás avisos en Walix");
    } catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo guardar tu elección"); }
    finally { setBusy(false); }
  };
  return <section className="border-y border-border py-4 space-y-3">
    <div className="flex items-center justify-between gap-4">
      <Label htmlFor="receive-incoming-phone" className="flex items-center gap-2"><PhoneIncoming className="h-4 w-4 text-primary" /> Recibir llamadas en mi celular</Label>
      <Switch id="receive-incoming-phone" checked={!!data?.can_receive_phone && !!data?.phone_enabled} disabled={busy || isLoading || isError || !data?.can_receive_phone || !data?.phone} onCheckedChange={save} />
    </div>
    <div className="flex flex-wrap gap-2 items-center">
      <span className="text-sm">Teléfono de mi perfil: {data?.phone ?? "Sin registrar"}</span>
      <Button variant="outline" size="sm" asChild><Link to="/profile">Editar perfil</Link></Button>
    </div>
    <p className="text-xs text-muted-foreground">{isError ? "No se pudo consultar tu elección. Intenta nuevamente." : !data?.can_receive_phone ? "Tu empresa desactivó la recepción en celular para tu usuario. Los avisos siguen llegando a Walix." : "El desvío al celular genera minutos adicionales. Al recibir la llamada, presiona 1 para aceptar. Apagado: solo avisos en Walix."}</p>
  </section>;
}