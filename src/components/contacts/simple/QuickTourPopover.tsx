import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ClipboardList, MessageCircle, Phone } from "lucide-react";

const KEY = "walix.simple.tour.contact.v1";

export function useContactSimpleTour() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setOpen(true);
    } catch { /* noop */ }
  }, []);
  return {
    open,
    show: () => setOpen(true),
    close: () => {
      try { localStorage.setItem(KEY, "1"); } catch { /* noop */ }
      setOpen(false);
    },
  };
}

export function QuickTourDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl">Cómo usar esta pantalla</DialogTitle>
        </DialogHeader>
        <ol className="space-y-4 py-2">
          <TourStep n={1} icon={<Phone className="h-6 w-6" />} title="Contacta al cliente"
            desc="Usa los botones grandes de arriba para enviar WhatsApp o llamar por teléfono." />
          <TourStep n={2} icon={<ClipboardList className="h-6 w-6" />} title="Revisa tus pendientes"
            desc="En el centro verás qué tienes que hacer con este cliente hoy." />
          <TourStep n={3} icon={<MessageCircle className="h-6 w-6" />} title="Marca la tarea como hecha"
            desc="Al terminar, pulsa 'Marcar hecha' y elige si fue por WhatsApp, llamada u otro." />
        </ol>
        <DialogFooter>
          <Button size="lg" onClick={onClose} className="w-full">Entendido</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TourStep({ n, icon, title, desc }: { n: number; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <li className="flex gap-3">
      <div className="h-10 w-10 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0 font-bold">
        {n}
      </div>
      <div>
        <div className="flex items-center gap-2 font-semibold text-base">
          <span className="text-primary">{icon}</span> {title}
        </div>
        <p className="text-sm text-muted-foreground mt-1">{desc}</p>
      </div>
    </li>
  );
}