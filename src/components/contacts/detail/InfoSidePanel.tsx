import { useState } from "react";
import { ChevronDown, Phone, Mail, Building2, User, Target, UserCircle2 } from "lucide-react";
import type { ContactRow } from "@/lib/queries/contacts";
import { cn } from "@/lib/utils";
import { AiContextPanel } from "@/components/walix/AiContextPanel";

interface Props { contact: ContactRow }

interface Section {
  key: string;
  title: string;
  rows: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; mono?: boolean }[];
}

export function InfoSidePanel({ contact }: Props) {
  const sections: Section[] = [
    {
      key: "contact", title: "Contacto",
      rows: [
        { icon: Phone, label: "Teléfono", value: contact.phone, mono: true },
        { icon: Phone, label: "Tel. alterno", value: contact.phoneAlt ?? "—", mono: true },
        { icon: Mail, label: "Email", value: contact.email ?? "—" },
        { icon: MapPin, label: "Dirección", value: contact.address ?? "—" },
        { icon: StickyNote, label: "Observaciones", value: contact.notes ?? "—" },
      ],
    },
    {
      key: "company", title: "Empresa",
      rows: [
        { icon: Building2, label: "Empresa", value: contact.company ?? "—" },
        { icon: User, label: "Cargo", value: contact.position ?? "—" },
      ],
    },
    {
      key: "crm", title: "CRM",
      rows: [
        { icon: Target, label: "Fuente", value: contact.source },
        { icon: UserCircle2, label: "Vendedor", value: contact.ownerName },
      ],
    },
  ];

  const [open, setOpen] = useState<Record<string, boolean>>({ contact: true, company: true, crm: true });

  return (
    <div className="space-y-2">
      <AiContextPanel entityType="contact" entityId={contact.id} />
      {sections.map(s => (
        <div key={s.key} className="rounded-xl border border-border bg-card overflow-hidden shadow-card">
          <button
            onClick={() => setOpen(o => ({ ...o, [s.key]: !o[s.key] }))}
            className="w-full px-4 py-2.5 border-b border-border flex items-center justify-between text-[11px] font-semibold text-muted-foreground uppercase tracking-wide hover:bg-muted/30 transition-colors"
            style={{ borderBottomWidth: open[s.key] ? 1 : 0 }}
          >
            <span>{s.title}</span>
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !open[s.key] && "-rotate-90")} />
          </button>
          {open[s.key] && (
            <div className="px-4 py-3 space-y-2.5">
              {s.rows.map(r => (
                <div key={r.label} className="flex items-center gap-2 text-sm group">
                  <r.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className={cn("text-xs truncate flex-1", r.mono && "font-mono")} title={r.value}>{r.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}