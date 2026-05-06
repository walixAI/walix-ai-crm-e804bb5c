import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTenantUsers } from "@/lib/queries/tenantUsers";
import { useContactTags } from "@/lib/queries/contactTags";
import { MessageCircle, Save, X } from "lucide-react";
import { toast } from "sonner";
import { useCreateContact, useUpdateContact, type ContactRow } from "@/lib/queries/contacts";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contact?: ContactRow | null;
}

export function ContactFormDialog({ open, onOpenChange, contact }: Props) {
  const editing = !!contact;
  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [position, setPosition] = useState("");
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const { data: sellers = [] } = useTenantUsers();
  const { data: tagList = [] } = useContactTags();
  const create = useCreateContact();
  const update = useUpdateContact();

  useEffect(() => {
    if (!open) return;
    setName(contact?.name ?? "");
    setLastName(contact?.lastName ?? "");
    setPhone(contact?.phone ?? "");
    setEmail(contact?.email ?? "");
    setCompany(contact?.company ?? "");
    setPosition(contact?.position ?? "");
    setOwnerId(contact?.ownerId ?? null);
    setTags(contact?.tags ?? []);
  }, [open, contact]);

  const handleSave = async (openWA: boolean) => {
    if (!name.trim()) { toast.error("El nombre es obligatorio"); return; }
    const patch = {
      name: name.trim(),
      last_name: lastName.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      company: company.trim() || null,
      position: position.trim() || null,
      owner_id: ownerId,
      tags,
    };
    try {
      if (editing && contact) {
        await update.mutateAsync({ id: contact.id, patch });
        toast.success("Contacto actualizado");
      } else {
        await create.mutateAsync(patch as any);
        toast.success("Contacto creado");
      }
      if (openWA) {
        const clean = phone.replace(/[^0-9]/g, "");
        if (clean) window.open(`https://wa.me/${clean}`, "_blank");
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Error al guardar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar contacto" : "Nuevo contacto"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="col-span-2 sm:col-span-1">
            <Label>Nombre *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lucía" autoFocus />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label>Apellidos</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Hernández" />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label>Teléfono</Label>
            <div className="flex gap-2">
              <div className="h-10 px-3 rounded-md border border-input bg-muted/50 flex items-center text-sm font-medium">🇲🇽 +52</div>
              <Input className="flex-1" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="55 1234 5678" />
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="lucia@mail.mx" />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label>Empresa</Label>
            <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Tacos El Güero" />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label>Cargo</Label>
            <Input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="Gerente de compras" />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label>Vendedor asignado</Label>
            <Select value={ownerId ?? ""} onValueChange={(v) => setOwnerId(v || null)}>
              <SelectTrigger><SelectValue placeholder="Selecciona vendedor" /></SelectTrigger>
              <SelectContent>
                {sellers.length === 0
                  ? <div className="px-2 py-1.5 text-xs text-muted-foreground italic">Sin miembros activos</div>
                  : sellers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Etiquetas</Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {tagList.map(tag => {
                const t = tag.name;
                const active = tags.includes(t);
                return (
                  <button key={t} type="button" onClick={() => setTags(active ? tags.filter(x => x !== t) : [...tags, t])}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"}`}>
                    #{t}
                  </button>
                );
              })}
              {tagList.length === 0 && (
                <span className="text-xs text-muted-foreground italic">Crea etiquetas en Configuración</span>
              )}
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}><X className="h-4 w-4" /> Cancelar</Button>
          <Button variant="secondary" onClick={() => handleSave(false)} disabled={create.isPending || update.isPending}>
            <Save className="h-4 w-4" /> {editing ? "Guardar cambios" : "Solo guardar"}
          </Button>
          {!editing && phone.trim() && (
            <Button onClick={() => handleSave(true)} disabled={create.isPending} className="bg-success hover:bg-success/90 text-success-foreground">
              <MessageCircle className="h-4 w-4" /> Guardar y abrir WhatsApp
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
