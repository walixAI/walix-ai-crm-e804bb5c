import { useState } from "react";
import { Mail, Phone, Target, UserCircle2, Pencil, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ALL_SOURCES } from "@/lib/contacts/badges";
import { useUpdateContact, type ContactRow } from "@/lib/queries/contacts";
import { useTenantUsers } from "@/lib/queries/tenantUsers";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props { contact: ContactRow }

type Field = "email" | "phone" | "source" | "owner_id" | null;

export function ContactInfoCard({ contact }: Props) {
  const update = useUpdateContact();
  const { data: users = [] } = useTenantUsers();
  const [editing, setEditing] = useState<Field>(null);
  const [val, setVal] = useState<string>("");

  const start = (f: Field, current: string) => { setEditing(f); setVal(current ?? ""); };
  const cancel = () => setEditing(null);
  const save = (patch: any) =>
    update.mutate(
      { id: contact.id, patch },
      { onSuccess: () => { toast.success("Actualizado"); setEditing(null); } },
    );

  const openWA = () => window.open(`https://wa.me/${contact.phone.replace(/[^0-9]/g, "")}`, "_blank");

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
          {editing === "email" ? (
            <InlineEditor value={val} setValue={setVal} onSave={() => save({ email: val.trim() || null })} onCancel={cancel} />
          ) : (
            <button onClick={() => start("email", contact.email ?? "")} className="group flex-1 text-left flex items-center gap-1 truncate">
              <span className="truncate">{contact.email ?? "—"}</span>
              <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
            </button>
          )}
        </Row>

        {/* Phone */}
        <Row icon={Phone} label="Teléfono">
          {editing === "phone" ? (
            <InlineEditor value={val} setValue={setVal} onSave={() => save({ phone: val.trim() })} onCancel={cancel} />
          ) : (
            <div className="flex-1 flex items-center gap-2">
              <button onClick={openWA} className="font-mono text-xs hover:text-success">{contact.phone}</button>
              <button onClick={() => start("phone", contact.phone)} className="text-muted-foreground hover:text-foreground">
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          )}
        </Row>

        {/* Source */}
        <Row icon={Target} label="Fuente">
          <Select
            value={contact.source}
            onValueChange={(v) => save({ source: v })}
          >
            <SelectTrigger className="h-7 text-xs flex-1 border-0 bg-transparent shadow-none px-1 hover:bg-muted/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALL_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground w-16 shrink-0">{label}</span>
      {children}
    </div>
  );
}

function InlineEditor({
  value, setValue, onSave, onCancel,
}: {
  value: string; setValue: (v: string) => void; onSave: () => void; onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-1 flex-1">
      <Input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
        className="h-7 text-xs"
      />
      <button onClick={onSave} className="text-success hover:bg-success/10 p-1 rounded"><Check className="h-3.5 w-3.5" /></button>
      <button onClick={onCancel} className="text-muted-foreground hover:bg-muted p-1 rounded"><X className="h-3.5 w-3.5" /></button>
    </div>
  );
}