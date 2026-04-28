import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sellers, allTags } from "@/mock/contacts";
import { MessageCircle, Save, X } from "lucide-react";
import { toast } from "sonner";

export function ContactFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [name, setName] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  const handleSave = (openWA: boolean) => {
    if (!name.trim()) { toast.error("El nombre es obligatorio"); return; }
    toast.success(openWA ? "Contacto guardado, abriendo WhatsApp..." : "Contacto guardado");
    onOpenChange(false);
    setName(""); setTags([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuevo contacto</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="col-span-2 sm:col-span-1">
            <Label>Nombre *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lucía" autoFocus />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label>Apellidos</Label>
            <Input placeholder="Hernández" />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label>Teléfono</Label>
            <div className="flex gap-2">
              <div className="h-10 px-3 rounded-md border border-input bg-muted/50 flex items-center text-sm font-medium">🇲🇽 +52</div>
              <Input className="flex-1" placeholder="55 1234 5678" />
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label>Email</Label>
            <Input type="email" placeholder="lucia@mail.mx" />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label>Empresa</Label>
            <Input placeholder="Tacos El Güero" />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label>Cargo</Label>
            <Input placeholder="Gerente de compras" />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label>Vendedor asignado</Label>
            <Select>
              <SelectTrigger><SelectValue placeholder="Selecciona vendedor" /></SelectTrigger>
              <SelectContent>
                {sellers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Etiquetas</Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {allTags.map(t => {
                const active = tags.includes(t);
                return (
                  <button key={t} type="button" onClick={() => setTags(active ? tags.filter(x => x !== t) : [...tags, t])}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"}`}>
                    #{t}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}><X className="h-4 w-4" /> Cancelar</Button>
          <Button variant="secondary" onClick={() => handleSave(false)}><Save className="h-4 w-4" /> Solo guardar</Button>
          <Button onClick={() => handleSave(true)} className="bg-success hover:bg-success/90 text-success-foreground"><MessageCircle className="h-4 w-4" /> Guardar y abrir WhatsApp</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
