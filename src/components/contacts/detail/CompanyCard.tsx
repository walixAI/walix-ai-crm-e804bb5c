import { useState } from "react";
import { Building2, User, Pencil, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useUpdateContact, type ContactRow } from "@/lib/queries/contacts";
import { toast } from "sonner";

interface Props { contact: ContactRow }

export function CompanyCard({ contact }: Props) {
  const update = useUpdateContact();
  const [editing, setEditing] = useState<"company" | "position" | null>(null);
  const [val, setVal] = useState("");

  const start = (f: "company" | "position", current: string) => { setEditing(f); setVal(current ?? ""); };
  const save = (patch: any) =>
    update.mutate(
      { id: contact.id, patch },
      { onSuccess: () => { toast.success("Actualizado"); setEditing(null); } },
    );

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-card">
      <div className="px-4 py-2.5 border-b border-border">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Empresa</span>
      </div>
      <div className="px-4 py-3 space-y-3 text-sm">
        <Row icon={Building2} label="Empresa">
          {editing === "company" ? (
            <Editor value={val} setValue={setVal} onSave={() => save({ company: val.trim() || null })} onCancel={() => setEditing(null)} />
          ) : (
            <button onClick={() => start("company", contact.company ?? "")} className="group flex-1 text-left flex items-center gap-1 truncate">
              <span className="truncate">{contact.company ?? "—"}</span>
              <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
            </button>
          )}
        </Row>
        <Row icon={User} label="Cargo">
          {editing === "position" ? (
            <Editor value={val} setValue={setVal} onSave={() => save({ position: val.trim() || null })} onCancel={() => setEditing(null)} />
          ) : (
            <button onClick={() => start("position", contact.position ?? "")} className="group flex-1 text-left flex items-center gap-1 truncate">
              <span className="truncate">{contact.position ?? "—"}</span>
              <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
            </button>
          )}
        </Row>
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, children }: any) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground w-16 shrink-0">{label}</span>
      {children}
    </div>
  );
}

function Editor({ value, setValue, onSave, onCancel }: any) {
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