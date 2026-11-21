import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PhoneIncoming, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inboundRequest, useInboundPolicy, type InboundSettings } from "@/hooks/useInboundPolicy";
import { toast } from "sonner";

export function InboundCallSettings() {
  const { data, isLoading, isError } = useInboundPolicy();
  const qc = useQueryClient();
  const [policy, setPolicy] = useState<InboundSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const savedPolicy = JSON.stringify(data?.policy ?? null);
  useEffect(() => { setPolicy(JSON.parse(savedPolicy)); }, [savedPolicy]);
  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando recepción de llamadas…</p>;
  if (isError) return <p className="text-sm text-destructive">No se pudo consultar la recepción de llamadas.</p>;
  if (!data?.can_manage || !policy) return null;
  const save = async () => {
    setBusy(true);
    try {
      await inboundRequest({ action: "save_inbound_policy", policy });
      await qc.invalidateQueries({ queryKey: ["inbound-policy"] });
      toast.success("Recepción de llamadas actualizada");
    } catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo guardar"); }
    finally { setBusy(false); }
  };
  return <section className="border-y border-border py-5 space-y-5">
    <h3 className="font-semibold flex items-center gap-2"><PhoneIncoming className="h-5 w-5 text-success" /> Recepción de llamadas entrantes</h3>
    <fieldset disabled={busy} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="unassigned-recipients">Números sin contacto o contactos sin asesor</Label>
        <Select value={policy.unassigned_mode} onValueChange={(v: InboundSettings["unassigned_mode"]) => setPolicy({ ...policy, unassigned_mode: v })}>
          <SelectTrigger id="unassigned-recipients"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="specific">Un asesor específico</SelectItem><SelectItem value="all">Todo el equipo</SelectItem>
            <SelectItem value="supervisors">Solo supervisión y administración</SelectItem><SelectItem value="advisors">Solo asesores</SelectItem>
          </SelectContent>
        </Select>
        {policy.unassigned_mode === "specific" && <Select value={policy.unassigned_user_id ?? ""} onValueChange={v => setPolicy({ ...policy, unassigned_user_id: v })}>
          <SelectTrigger aria-label="Destinatario de llamadas sin asesor"><SelectValue placeholder="Selecciona un miembro" /></SelectTrigger>
          <SelectContent>{data.members?.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name ?? "Usuario"}</SelectItem>)}</SelectContent>
        </Select>}
        <p className="text-xs text-muted-foreground">Los contactos con asesor asignado se dirigen a su asesor. El grupo elegido recibe los avisos; el primero que acepte con 1 atiende la llamada en su celular.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="inbound-phone-access">Quién puede activar recepción en su celular</Label>
        <Select value={policy.phone_mode} onValueChange={(v: InboundSettings["phone_mode"]) => setPolicy({ ...policy, phone_mode: v })}>
          <SelectTrigger id="inbound-phone-access"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="none">Nadie · solo avisos en Walix</SelectItem><SelectItem value="all">Todo el equipo puede elegir</SelectItem><SelectItem value="selected">Solo usuarios autorizados</SelectItem></SelectContent>
        </Select>
        {policy.phone_mode === "selected" && <div className="space-y-3 py-2">
          {data.members?.map(m => <label key={m.id} className="flex items-center gap-3">
            <Checkbox checked={policy.allowed_user_ids.includes(m.id)} onCheckedChange={checked => setPolicy({ ...policy, allowed_user_ids: checked ? [...policy.allowed_user_ids, m.id] : policy.allowed_user_ids.filter(id => id !== m.id) })} />
            <span className="min-w-0"><span className="block text-sm break-words">{m.full_name ?? "Usuario"}</span><span className="block text-xs text-muted-foreground">{m.phone ?? "Sin teléfono en su perfil"}</span></span>
          </label>)}
        </div>}
        <p className="text-xs text-muted-foreground">Cada usuario autorizado decide si activa la recepción. Se usa exclusivamente el teléfono de su perfil. El desvío genera minutos adicionales; hasta 10 celulares suenan simultáneamente, rotando en grupos mayores.</p>
      </div>
    </fieldset>
    <Button onClick={save} disabled={busy || (policy.unassigned_mode === "specific" && !policy.unassigned_user_id)}><Save className="h-4 w-4 mr-2" /> Guardar recepción</Button>
  </section>;
}