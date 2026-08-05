import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Save, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import {
  useWhatsappUserAccess,
  useUpsertUserAccess,
  useDeleteUserAccess,
  type PermLevel,
  type WhatsappUserAccess,
} from "@/lib/queries/whatsappChannels";
import { useToast } from "@/hooks/use-toast";
import { PhoneInput, isValidPhoneNumber } from "@/components/ui/phone-input";
import { useTenantUsers } from "@/lib/queries/tenantUsers";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

interface DraftRow {
  id?: string;
  display_name: string;
  phone: string;
  level: PermLevel;
  enabled: boolean;
  web_enabled: boolean;
  user_id: string | null;
  dirty: boolean;
}

function toDraft(a: WhatsappUserAccess): DraftRow {
  return {
    id: a.id,
    display_name: a.display_name ?? "",
    phone: a.phone_e164,
    level: a.permission_level,
    enabled: a.enabled,
    web_enabled: a.web_enabled ?? true,
    user_id: a.user_id ?? null,
    dirty: false,
  };
}

export function TeamAccessTable({ tenantId }: { tenantId: string }) {
  const { data: accessData } = useWhatsappUserAccess(tenantId);
  const { data: tenantUsers = [] } = useTenantUsers();
  const upsert = useUpsertUserAccess(tenantId);
  const remove = useDeleteUserAccess(tenantId);
  const { toast } = useToast();
  const [newRows, setNewRows] = useState<DraftRow[]>([]);
  const [edits, setEdits] = useState<Record<string, DraftRow>>({});

  const rows: DraftRow[] = [
    ...(accessData ?? []).map((a) => edits[a.id] ?? toDraft(a)),
    ...newRows,
  ];

  function patchExisting(id: string, base: WhatsappUserAccess, patch: Partial<DraftRow>) {
    setEdits((e) => ({
      ...e,
      [id]: { ...(e[id] ?? toDraft(base)), ...patch, dirty: true },
    }));
  }

  function patchNew(idx: number, patch: Partial<DraftRow>) {
    setNewRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch, dirty: true } : r)));
  }

  async function save(r: DraftRow, isNew: boolean, idx?: number) {
    if (!r.display_name.trim()) {
      return toast({ title: "Nombre requerido", variant: "destructive" });
    }
    if (!r.phone || !isValidPhoneNumber(r.phone)) {
      return toast({ title: "Teléfono inválido", description: "Selecciona el país y escribe el número completo.", variant: "destructive" });
    }
    const normalized = r.phone;
    try {
      const result = await upsert.mutateAsync({
        id: r.id,
        display_name: r.display_name.trim(),
        phone_e164: normalized,
        enabled: r.enabled,
        web_enabled: r.web_enabled,
        user_id: r.user_id,
        permission_level: r.level,
      });
      if (isNew && idx !== undefined) {
        setNewRows((rs) => rs.filter((_, i) => i !== idx));
      } else if (r.id) {
        setEdits((e) => {
          const { [r.id!]: _, ...rest } = e;
          return rest;
        });
      }
      toast({ title: "Acceso guardado" });

      // Enviar invitación automática solo en creación
      if (result?.created && result.id) {
        const { data: inv, error: invErr } = await supabase.functions.invoke("whatsapp-team-invite", {
          body: { access_id: result.id },
        });
        if (invErr) {
          toast({
            title: "Acceso agregado, pero no se envió la invitación",
            description: invErr.message ?? "Revisa que el canal Equipo esté conectado.",
            variant: "destructive",
          });
        } else if (inv?.skipped) {
          toast({
            title: "Acceso agregado",
            description: "Conecta el canal Equipo (Walix Bot) para enviar la invitación por WhatsApp.",
          });
        } else if (inv?.ok) {
          toast({
            title: "Invitación enviada por WhatsApp ✉️",
            description: `Mensaje entregado a ${r.display_name.trim()}.`,
          });
        }
      }
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "No se pudo guardar", variant: "destructive" });
    }
  }

  async function handleDelete(id: string) {
    try {
      await remove.mutateAsync(id);
      setEdits((e) => {
        const { [id]: _, ...rest } = e;
        return rest;
      });
      toast({ title: "Acceso eliminado" });
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "No se pudo eliminar", variant: "destructive" });
    }
  }

  function addRow() {
    setNewRows((rs) => [
      ...rs,
      { display_name: "", phone: "", level: "write_light", enabled: true, web_enabled: true, user_id: null, dirty: true },
    ]);
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Accesos al Copiloto</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Define quién puede usar el Copiloto por <strong>WhatsApp</strong> (teléfono autorizado ante el número de Walix)
            y quién puede usarlo <strong>en la web</strong> (requiere vincular un usuario del CRM).
          </p>
        </div>
        <Button size="sm" onClick={addRow}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Agregar persona
        </Button>
      </div>

      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-lg">
          No hay personas autorizadas. Agrega la primera con el botón de arriba.
        </p>
      )}

      <div className="space-y-2">
        {rows.map((r, idx) => {
          const isNew = !r.id;
          const existing = !isNew ? accessData?.find((a) => a.id === r.id) : undefined;
          const newIdx = isNew ? newRows.indexOf(r) : -1;
          return (
            <div key={r.id ?? `new-${idx}`} className="p-3 rounded-lg border border-border space-y-3">
              <div className="grid gap-2 md:grid-cols-[1.2fr_1.3fr_1.2fr_1.2fr] items-start">
              <Input
                value={r.display_name}
                onChange={(e) =>
                  isNew
                    ? patchNew(newIdx, { display_name: e.target.value })
                    : existing && patchExisting(r.id!, existing, { display_name: e.target.value })
                }
                placeholder="Nombre de la persona"
              />
              <div className="space-y-1">
                <PhoneInput
                  value={r.phone}
                  onChange={(v) =>
                    isNew
                      ? patchNew(newIdx, { phone: v })
                      : existing && patchExisting(r.id!, existing, { phone: v })
                  }
                  invalid={!!r.phone && !isValidPhoneNumber(r.phone)}
                />
                {r.phone ? (
                  isValidPhoneNumber(r.phone) ? (
                    <p className="text-[11px] text-success flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Número válido
                    </p>
                  ) : (
                    <p className="text-[11px] text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> Número incompleto o inválido
                    </p>
                  )
                ) : null}
              </div>
              <Select
                value={r.level}
                onValueChange={(v) =>
                  isNew
                    ? patchNew(newIdx, { level: v as PermLevel })
                    : existing && patchExisting(r.id!, existing, { level: v as PermLevel })
                }
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">Solo lectura</SelectItem>
                  <SelectItem value="write_light">Escritura ligera (notas/tareas)</SelectItem>
                  <SelectItem value="write_strong">Escritura fuerte (con confirmación)</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={r.user_id ?? "none"}
                onValueChange={(v) => {
                  const uid = v === "none" ? null : v;
                  isNew
                    ? patchNew(newIdx, { user_id: uid })
                    : existing && patchExisting(r.id!, existing, { user_id: uid });
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Usuario del CRM (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin usuario del CRM</SelectItem>
                  {tenantUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id={`wa-${r.id ?? idx}`}
                    checked={r.enabled}
                    onCheckedChange={(v) =>
                      isNew
                        ? patchNew(newIdx, { enabled: v })
                        : existing && patchExisting(r.id!, existing, { enabled: v })
                    }
                  />
                  <Label htmlFor={`wa-${r.id ?? idx}`} className="text-xs">Copiloto por WhatsApp</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id={`web-${r.id ?? idx}`}
                    checked={r.web_enabled}
                    disabled={!r.user_id}
                    onCheckedChange={(v) =>
                      isNew
                        ? patchNew(newIdx, { web_enabled: v })
                        : existing && patchExisting(r.id!, existing, { web_enabled: v })
                    }
                  />
                  <Label htmlFor={`web-${r.id ?? idx}`} className="text-xs">
                    Copiloto en la web
                    {!r.user_id && <span className="text-muted-foreground"> · vincula un usuario</span>}
                  </Label>
                </div>
                <div className="flex items-center gap-2 ml-auto">
              <Button
                size="sm"
                variant={r.dirty ? "default" : "outline"}
                onClick={() => save(r, isNew, isNew ? newIdx : undefined)}
                disabled={!r.dirty || upsert.isPending}
              >
                <Save className="h-3.5 w-3.5 mr-1" /> Guardar
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  if (isNew) setNewRows((rs) => rs.filter((_, i) => i !== newIdx));
                  else if (r.id) handleDelete(r.id);
                }}
                disabled={remove.isPending}
                aria-label="Eliminar"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}