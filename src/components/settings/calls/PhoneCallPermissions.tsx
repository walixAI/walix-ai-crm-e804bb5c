import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Phone, ShieldCheck, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { usePhoneCallPermissions, phonePermissionRequest } from "@/lib/queries/phoneCallPermissions";

export function PhoneCallPermissions() {
  const query = usePhoneCallPermissions();
  const qc = useQueryClient();
  const [all, setAll] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  useEffect(() => {
    if (query.data?.policy) {
      setAll(query.data.policy.allow_all);
      setSelected(query.data.policy.allowed_user_ids);
    }
  }, [query.data]);
  const save = useMutation({
    mutationFn: () => phonePermissionRequest({ action: "save_phone_permissions", allow_all: all, allowed_user_ids: selected }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["phone-call-permissions"] }); toast.success("Permisos de llamadas actualizados"); },
    onError: (error: Error) => toast.error(error.message),
  });
  if (query.isLoading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (query.isError) return <div role="alert" className="text-sm text-destructive">No se pudieron cargar los permisos. <Button variant="ghost" onClick={() => void query.refetch()}>Reintentar</Button></div>;
  if (!query.data?.can_manage) return null;
  const dirty = all !== query.data.policy?.allow_all || [...selected].sort().join() !== [...(query.data.policy?.allowed_user_ids ?? [])].sort().join();
  return <section className="border-t border-border pt-6 space-y-4">
    <div className="flex items-center gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></div>
      <div><h3 className="font-semibold">Llamadas desde el celular</h3><p className="text-xs text-muted-foreground">Autorización del propietario · número compartido de la empresa</p></div>
    </div>
    <RadioGroup value={all ? "all" : "selected"} onValueChange={(v) => setAll(v === "all")} className="grid gap-3 sm:grid-cols-2" disabled={save.isPending}>
      <Label htmlFor="phone-all" className="flex items-center gap-3 rounded-lg border border-border p-4 cursor-pointer has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"><RadioGroupItem value="all" id="phone-all" /><Users className="h-4 w-4 text-primary" />Todos los usuarios</Label>
      <Label htmlFor="phone-selected" className="flex items-center gap-3 rounded-lg border border-border p-4 cursor-pointer has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"><RadioGroupItem value="selected" id="phone-selected" /><Phone className="h-4 w-4 text-primary" />Solo algunos usuarios</Label>
    </RadioGroup>
    {!all && <div className="divide-y divide-border max-h-72 overflow-y-auto">
      {(query.data.members ?? []).map((member) => <Label key={member.id} className="flex items-center gap-3 py-3 cursor-pointer">
        <Checkbox checked={selected.includes(member.id)} disabled={save.isPending} onCheckedChange={(checked) => setSelected((ids) => checked === true ? [...ids, member.id] : ids.filter((id) => id !== member.id))} aria-label={`Autorizar a ${member.full_name ?? "Usuario"}`} />
        <span className="min-w-0 flex-1"><span className="block text-sm font-medium break-words">{member.full_name ?? "Usuario"}</span><span className="block text-xs text-muted-foreground">{member.phone ?? "Sin celular en su perfil"}</span></span>
      </Label>)}
      {!query.data.members?.length && <p className="py-3 text-sm text-muted-foreground">Sin usuarios activos.</p>}
    </div>}
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{all ? "Todos los usuarios activos están autorizados." : `${selected.length} usuarios seleccionados.`} La computadora sigue disponible.</p><Button size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Guardar permisos</Button></div>
  </section>;
}