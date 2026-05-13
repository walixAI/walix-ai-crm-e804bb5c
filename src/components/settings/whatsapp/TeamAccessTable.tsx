import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { useMembers } from "@/lib/queries/team";
import { useWhatsappUserAccess, useUpsertUserAccess, type PermLevel } from "@/lib/queries/whatsappChannels";
import { useToast } from "@/hooks/use-toast";

interface RowState {
  phone: string;
  enabled: boolean;
  level: PermLevel;
  dirty: boolean;
}

const EMPTY_LIST: [] = [];

export function TeamAccessTable({ tenantId }: { tenantId: string }) {
  const { data: membersData } = useMembers(tenantId);
  const { data: accessData } = useWhatsappUserAccess(tenantId);
  const members = membersData ?? EMPTY_LIST;
  const access = accessData ?? EMPTY_LIST;
  const upsert = useUpsertUserAccess(tenantId);
  const { toast } = useToast();
  const [rows, setRows] = useState<Record<string, RowState>>({});

  useEffect(() => {
    const next: Record<string, RowState> = {};
    members.forEach((m) => {
      const a = access.find((x) => x.user_id === m.id);
      next[m.id] = {
        phone: a?.phone_e164 ?? "",
        enabled: a?.enabled ?? false,
        level: (a?.permission_level ?? "write_light") as PermLevel,
        dirty: false,
      };
    });
    setRows((current) => {
      const currentKeys = Object.keys(current);
      const nextKeys = Object.keys(next);
      const hasChanged = currentKeys.length !== nextKeys.length || nextKeys.some((id) => {
        const a = current[id];
        const b = next[id];
        return !a || a.phone !== b.phone || a.enabled !== b.enabled || a.level !== b.level;
      });
      return hasChanged ? next : current;
    });
  }, [members, access]);

  function update(id: string, patch: Partial<RowState>) {
    setRows((r) => ({ ...r, [id]: { ...r[id], ...patch, dirty: true } }));
  }

  async function save(userId: string) {
    const r = rows[userId];
    if (!r) return;
    if (r.enabled && !r.phone.match(/^\+\d{8,15}$/)) {
      return toast({ title: "Teléfono inválido", description: "Usa formato E.164: +525512345678", variant: "destructive" });
    }
    try {
      await upsert.mutateAsync({
        user_id: userId, phone_e164: r.phone, enabled: r.enabled, permission_level: r.level,
      });
      toast({ title: "Acceso actualizado" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  const activeMembers = members.filter((m) => m.is_active);

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Vendedores autorizados (canal Equipo)</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Define qué miembros pueden enviar comandos a Walix por WhatsApp y con qué permisos.
          Los <b>sales_rep</b> solo verán y operarán sus propios contactos y oportunidades.
        </p>
      </div>
      <div className="space-y-2">
        {activeMembers.length === 0 && (
          <p className="text-sm text-muted-foreground">Aún no hay miembros activos.</p>
        )}
        {activeMembers.map((m) => {
          const r = rows[m.id];
          if (!r) return null;
          return (
            <div key={m.id} className="grid gap-2 p-3 rounded-lg border border-border md:grid-cols-[1.4fr_1.4fr_1fr_auto_auto] items-center">
              <div>
                <div className="text-sm font-medium">{m.full_name ?? "—"}</div>
                <div className="text-xs text-muted-foreground">{m.email}</div>
              </div>
              <Input
                value={r.phone}
                onChange={(e) => update(m.id, { phone: e.target.value })}
                placeholder="+525512345678"
                className="font-mono text-xs"
              />
              <Select value={r.level} onValueChange={(v) => update(m.id, { level: v as PermLevel })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">Solo lectura</SelectItem>
                  <SelectItem value="write_light">Escritura ligera (notas/tareas)</SelectItem>
                  <SelectItem value="write_strong">Escritura fuerte (con confirmación)</SelectItem>
                </SelectContent>
              </Select>
              <Switch checked={r.enabled} onCheckedChange={(v) => update(m.id, { enabled: v })} />
              <Button size="sm" variant={r.dirty ? "default" : "outline"} onClick={() => save(m.id)} disabled={!r.dirty || upsert.isPending}>
                <Save className="h-3.5 w-3.5 mr-1" /> Guardar
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}