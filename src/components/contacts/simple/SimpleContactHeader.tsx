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
      <div className="max-w-4xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="lg" asChild className="text-base -ml-3">
            <Link to="/mi-dia"><ArrowLeft className="mr-2 h-5 w-5" /> Mi Día</Link>
          </Button>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={onHelp} title="¿Cómo uso esta pantalla?">
              <HelpCircle className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" title="Modo estándar"
              onClick={async () => { await setMode.mutateAsync(false); window.location.href = `/contacts/${contact.id}`; }}>
              <Settings2 className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <Avatar className="h-20 w-20 shrink-0">
            <AvatarFallback style={{ background: contact.avatarColor, color: "white" }} className="text-2xl font-bold">
              {contact.name[0]}{contact.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight truncate">
              {contact.name} {contact.lastName}
            </h1>
            {contact.company && (
              <p className="text-lg text-muted-foreground truncate mt-1">{contact.company}</p>
            )}
            <p className="text-base text-muted-foreground mt-1">{contact.phone || "Sin teléfono"}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button size="lg" onClick={onWhatsApp}
            className="h-14 text-base bg-success hover:bg-success/90 text-success-foreground">
            <MessageCircle className="mr-2 h-5 w-5" /> WhatsApp
          </Button>
          <Button size="lg" variant="outline" onClick={callPhone} className="h-14 text-base"
            disabled={!contact.phone}>
            <Phone className="mr-2 h-5 w-5" /> Llamar
          </Button>
        </div>
      </div>
    </header>
  );
}