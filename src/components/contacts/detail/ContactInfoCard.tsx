import { Mail, Phone, Target, UserCircle2, Pencil, PhoneCall, MapPin, StickyNote, Tag } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useUpdateContact, type ContactRow } from "@/lib/queries/contacts";
import { useTenantUsers } from "@/lib/queries/tenantUsers";
import { useContactSources } from "@/lib/queries/contactSources";
import { useContactCustomFieldDefs } from "@/lib/queries/contactCustomFields";
import { EditFieldPopover } from "./EditFieldPopover";
import { toast } from "sonner";
import { blockWhatsappAction, useWhatsappChatEnabled, WHATSAPP_DISABLED_REASON } from "@/lib/whatsapp/featureFlags";

interface Props { contact: ContactRow }

export function ContactInfoCard({ contact }: Props) {
  const WHATSAPP_CHAT_ENABLED = useWhatsappChatEnabled();
  const update = useUpdateContact();
  const { data: users = [] } = useTenantUsers();
  const { data: sources = [] } = useContactSources();
  const { data: customDefs = [] } = useContactCustomFieldDefs();
  const navigate = useNavigate();

  const save = (patch: any) =>
    update.mutate(
      { id: contact.id, patch },
      { onSuccess: () => { toast.success("Actualizado"); } },
    );

  const openWA = () => { if (blockWhatsappAction(contact.phone)) return; navigate(`/whatsapp?contactId=${contact.id}`); };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-card">
      <div className="px-4 py-2.5 border-b border-border">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          Información del contacto
        </span>
      </div>
      <div className="px-4 py-3 space-y-3 text-sm">
        {/* Email */}
        <Row icon={Mail} label="Email">
          <EditFieldPopover
            label="Email"
            value={contact.email ?? ""}
            type="email"
            placeholder="lucia@mail.mx"
            onSave={(v) => save({ email: v || null })}
            trigger={
              <button className="group flex-1 text-left flex items-center gap-1 truncate">
                <span className="truncate">{contact.email ?? "—"}</span>
                <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
              </button>
            }
          />
        </Row>

        {/* Phone */}
        <Row icon={Phone} label="Teléfono">
          <div className="flex-1 flex items-center gap-2">
            <button onClick={openWA} className="font-mono text-xs hover:text-success truncate">
              {contact.phone || "—"}
            </button>
            <EditFieldPopover
              label="Teléfono"
              value={contact.phone ?? ""}
              type="tel"
              prefix="🇲🇽 +52"
              placeholder="55 1234 5678"
              onSave={(v) => save({ phone: v || null })}
              trigger={
                <button className="text-muted-foreground hover:text-foreground">
                  <Pencil className="h-3 w-3" />
                </button>
              }
            />
          </div>
        </Row>

        {/* Source */}
        {/* Phone alt */}
        <Row icon={PhoneCall} label="Tel. alt">
          <EditFieldPopover
            label="Teléfono alterno"
            value={contact.phoneAlt ?? ""}
            type="tel"
            prefix="🇲🇽 +52"
            placeholder="55 8765 4321"
            onSave={(v) => save({ phone_alt: v || null })}
            trigger={
              <button className="group flex-1 text-left flex items-center gap-1 truncate">
                <span className="truncate font-mono text-xs">{contact.phoneAlt ?? "—"}</span>
                <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
              </button>
            }
          />
        </Row>

        {/* Address */}
        <Row icon={MapPin} label="Dirección">
          <EditFieldPopover
            label="Dirección"
            value={contact.address ?? ""}
            placeholder="Av. Palmas 170, CDMX"
            onSave={(v) => save({ address: v || null })}
            trigger={
              <button className="group flex-1 text-left flex items-center gap-1 truncate">
                <span className="truncate">{contact.address ?? "—"}</span>
                <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
              </button>
            }
          />
        </Row>

        {/* Notes */}
        <Row icon={StickyNote} label="Observ.">
          <EditFieldPopover
            label="Observaciones"
            value={contact.notes ?? ""}
            placeholder="Comentarios del contacto"
            onSave={(v) => save({ notes: v || null })}
            trigger={
              <button className="group flex-1 text-left flex items-center gap-1 truncate">
                <span className="truncate">{contact.notes ?? "—"}</span>
                <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
              </button>
            }
          />
        </Row>

        <Row icon={Target} label="Fuente">
          <Select
            value={contact.sourceId ?? ""}
            onValueChange={(v) => {
              save({ source_id: v || null });
            }}
          >
            <SelectTrigger className="h-7 text-xs flex-1 border-0 bg-transparent shadow-none px-1 hover:bg-muted/50">
              <SelectValue placeholder={
                sources.find((s) => s.id === contact.sourceId)?.name ?? contact.source ?? "Sin fuente"
              } />
            </SelectTrigger>
            <SelectContent>
              {sources.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Row>

        {/* Owner */}
        <Row icon={UserCircle2} label="Asignado a">
          <Select
            value={contact.ownerId ?? ""}
            onValueChange={(v) => save({ owner_id: v || null })}
          >
            <SelectTrigger className="h-7 text-xs flex-1 border-0 bg-transparent shadow-none px-1 hover:bg-muted/50">
              <SelectValue placeholder="Sin asignar" />
            </SelectTrigger>
            <SelectContent>
              {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Row>

        {/* Campos personalizados del tenant */}
        {customDefs.map((f) => {
          const val = contact.customFields?.[f.key];
          const str = val == null || val === "" ? "" : String(val);
          return (
            <Row key={f.id} icon={Tag} label={f.label}>
              <EditFieldPopover
                label={f.label}
                value={str}
                placeholder={f.placeholder ?? ""}
                onSave={(v) =>
                  save({
                    custom_fields: { ...(contact.customFields ?? {}), [f.key]: v || null },
                  })
                }
                trigger={
                  <button className="group flex-1 text-left flex items-center gap-1 truncate">
                    <span className="truncate">{str || "—"}</span>
                    <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </button>
                }
              />
            </Row>
          );
        })}
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground w-16 shrink-0 truncate" title={label}>{label}</span>
      {children}
    </div>
  );
}