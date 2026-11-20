import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PhoneIncoming, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export function IncomingPhonePreference() {
  const { user, activeTenantId } = useAuth();
  const qc = useQueryClient();
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const key = ["incoming-phone-preference", activeTenantId, user?.id];
  const { data, isLoading, isError } = useQuery({
    queryKey: key, enabled: !!activeTenantId && !!user,
    queryFn: async () => {
      if (!user || !activeTenantId) return null;
      const { data, error } = await supabase.from("tenant_call_receiving_preferences").select("phone_enabled,phone_number").eq("tenant_id", activeTenantId).eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => { setPhone(data?.phone_number ?? ""); }, [data, activeTenantId, user?.id]);
  const save = async (enabled: boolean) => {
    if (!user || !activeTenantId) return;
    setBusy(true);
    const { data: result, error } = await supabase.functions.invoke("telephony-api", { body: { action: "save_inbound_preference", phone_enabled: enabled, phone_number: phone.trim() || null } });
    setBusy(false);
    let message = result?.error;
    if (error && "context" in error) { try { message = (await error.context.json()).error; } catch { /* no JSON */ } }
    if (error || message) { toast.error(message ?? "No se pudo guardar tu elección"); return; }
    await qc.invalidateQueries({ queryKey: key });
    toast.success(enabled ? "Recepción en tu celular activada" : "Solo recibirás avisos en Walix");
  };
  return <section className="border-y border-border py-4 space-y-3">
    <div className="flex items-center justify-between gap-4">
      <Label htmlFor="receive-incoming-phone" className="flex items-center gap-2"><PhoneIncoming className="h-4 w-4 text-primary" /> Recibir llamadas en mi celular</Label>
      <Switch id="receive-incoming-phone" checked={data?.phone_enabled ?? false} disabled={busy || isLoading || isError} onCheckedChange={save} />
    </div>
    <div className="flex flex-wrap gap-2 items-center">
      <Input aria-label="Celular para llamadas entrantes" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+52 y 10 dígitos" className="max-w-xs" disabled={busy || isLoading} />
      <Button variant="outline" size="sm" disabled={busy || isLoading || isError} onClick={() => save(data?.phone_enabled ?? false)}><Save className="h-4 w-4 mr-1" /> Guardar celular</Button>
    </div>
    <p className="text-xs text-muted-foreground">{isError ? "No se pudo consultar tu elección. Intenta nuevamente." : "El desvío al celular genera minutos adicionales de Twilio. Al recibir la llamada, presiona 1 para aceptar. Apagado: solo avisos en Walix."}</p>
  </section>;
}