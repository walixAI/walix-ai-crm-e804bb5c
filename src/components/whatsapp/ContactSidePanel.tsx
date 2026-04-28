import { Link } from "react-router-dom";
import { ExternalLink, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useContactDeals } from "@/lib/queries/contacts";
import type { ConversationItem } from "@/lib/queries/whatsapp";

function fmt(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
}

interface Props {
  conv: ConversationItem;
  notesDraft: string;
  onNotesChange: (v: string) => void;
  onSaveNotes: () => void;
}

export function ContactSidePanel({ conv, notesDraft, onNotesChange, onSaveNotes }: Props) {
  const { data: deals } = useContactDeals(conv.contactId);

  return (
    <aside className="w-[320px] shrink-0 border-l border-border bg-card hidden lg:flex flex-col h-full">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {/* Contact card */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Contacto</h3>
            <div className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-full text-white text-xs font-semibold flex items-center justify-center"
                  style={{ background: conv.avatarColor }}
                >
                  {conv.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{conv.contactName}</p>
                  {conv.contactCompany && (
                    <p className="text-xs text-muted-foreground truncate">{conv.contactCompany}</p>
                  )}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">{conv.contactPhone}</div>
              <div className="text-xs">
                Estado: <span className="font-medium">{conv.contactStatus}</span>
              </div>
              <Button asChild variant="outline" size="sm" className="w-full h-8 text-xs">
                <Link to={`/contacts/${conv.contactId}`}>
                  <ExternalLink className="h-3 w-3 mr-1.5" />
                  Ver perfil completo
                </Link>
              </Button>
            </div>
          </section>

          {/* Deals */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Deals vinculados
            </h3>
            <div className="space-y-2">
              {(deals ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">Sin deals aún</p>
              )}
              {(deals ?? []).map((d) => (
                <div key={d.id} className="border border-border rounded-lg p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium truncate">{d.name}</p>
                    <span className="text-xs font-semibold text-primary">{fmt(d.amount)}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{d.stage}</p>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full h-8 text-xs">
                <Plus className="h-3 w-3 mr-1" />
                Vincular o crear deal
              </Button>
            </div>
          </section>

          {/* Notes */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Notas rápidas</h3>
            <Textarea
              value={notesDraft}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="Agrega una nota interna…"
              rows={4}
              className="text-xs"
            />
            <Button onClick={onSaveNotes} variant="outline" size="sm" className="w-full h-8 text-xs mt-2">
              Guardar nota
            </Button>
          </section>
        </div>
      </ScrollArea>
    </aside>
  );
}
