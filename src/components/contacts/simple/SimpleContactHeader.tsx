import { Link } from "react-router-dom";
import { ArrowLeft, MessageCircle, Phone, HelpCircle, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useSetSimpleMode } from "@/lib/queries/miDia";
import type { ContactRow } from "@/lib/queries/contacts";

interface Props {
  contact: ContactRow;
  onWhatsApp: () => void;
  onHelp: () => void;
}

export function SimpleContactHeader({ contact, onWhatsApp, onHelp }: Props) {
  const setMode = useSetSimpleMode();
  const callPhone = () => window.open(`tel:${contact.phone.replace(/[^0-9+]/g, "")}`);

  return (
    <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
      <div className="max-w-4xl mx-auto px-6 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="-ml-2 shrink-0">
            <Link to="/mi-dia"><ArrowLeft className="mr-1 h-4 w-4" /> Mi Día</Link>
          </Button>
          <Avatar className="h-11 w-11 shrink-0 ml-1">
            <AvatarFallback style={{ background: contact.avatarColor, color: "white" }} className="text-base font-bold">
              {contact.name[0]}{contact.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate leading-tight">
              {contact.name} {contact.lastName}
            </h1>
            <p className="text-sm text-muted-foreground truncate">
              {contact.company ? `${contact.company} · ` : ""}{contact.phone || "Sin teléfono"}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" onClick={onHelp} title="¿Cómo uso esta pantalla?">
              <HelpCircle className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" title="Modo estándar"
              onClick={async () => { await setMode.mutateAsync(false); window.location.href = `/contacts/${contact.id}`; }}>
              <Settings2 className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button size="lg" onClick={onWhatsApp}
            className="h-12 text-base bg-success hover:bg-success/90 text-success-foreground">
            <MessageCircle className="mr-2 h-5 w-5" /> WhatsApp
          </Button>
          <Button size="lg" variant="outline" onClick={callPhone} className="h-12 text-base"
            disabled={!contact.phone}>
            <Phone className="mr-2 h-5 w-5" /> Llamar
          </Button>
        </div>
      </div>
    </header>
  );
}