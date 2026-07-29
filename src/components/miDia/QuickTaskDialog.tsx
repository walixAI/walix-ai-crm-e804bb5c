import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, User, Briefcase, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuickCreateTask } from "@/lib/queries/miDia";
import { useContactsLite, useDeals, useStages, useCreateDeal } from "@/lib/queries/pipeline";
import { useCreateContact } from "@/lib/queries/contacts";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

type Target =
  | { type: "contact"; id: string; label: string }
  | { type: "deal"; id: string; label: string; contactId: string | null }
  | { type: "new"; label: string };

export function QuickTaskDialog({ open, onOpenChange }: Props) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("otro");
  const [due, setDue] = useState("");
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<Target | null>(null);
  const [newPhone, setNewPhone] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const create = useQuickCreateTask();
  const { data: contacts = [] } = useContactsLite();
  const { data: deals = [] } = useDeals();
  const { data: stages = [] } = useStages();
  const createContact = useCreateContact();
  const createDeal = useCreateDeal();

  const q = search.trim().toLowerCase();
  const contactMatches = useMemo(
    () =>
      (q
        ? contacts.filter((c) => `${c.name} ${c.lastName ?? ""}`.toLowerCase().includes(q))
        : contacts
      ).slice(0, 5),
    [contacts, q],
  );
  const dealMatches = useMemo(
    () =>
      (q ? deals.filter((d) => d.name.toLowerCase().includes(q)) : deals.slice(0, 3)).slice(0, 5),
    [deals, q],
  );

  function reset() {
    setTitle(""); setDue(""); setKind("otro");
    setSearch(""); setTarget(null); setNewPhone(""); setNewAmount("");
  }

  async function submit() {
    if (!title.trim()) { toast.error("Escribe qué hay que hacer"); return; }
    setSaving(true);
    try {
      let contactId: string | null = null;
      let dealId: string | null = null;

      if (target?.type === "contact") {
        contactId = target.id;
      } else if (target?.type === "deal") {
        dealId = target.id;
        contactId = target.contactId;
      } else if (target?.type === "new") {
        const name = target.label.trim();
        if (!name) throw new Error("Escribe el nombre del nuevo cliente");
        contactId = await createContact.mutateAsync({
          name,
          phone: newPhone.trim() || null,
          source: "Manual" as any,
        });
        const stageId = stages[0]?.id;
        if (stageId) {
          const deal = await createDeal.mutateAsync({
            name,
            amount: Number(newAmount || 0),
            probability: 50,
            stageId,
            contactId,
            expectedCloseDate: null,
            source: "Manual",
            notes: null,
          });
          dealId = (deal as any)?.id ?? null;
        }
      }

      await create.mutateAsync({
        title: title.trim(),
        taskKind: kind,
        dueAt: due ? new Date(due).toISOString() : new Date().toISOString(),
        contactId,
        dealId,
      });
      toast.success("Tarea registrada");
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo registrar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl">Registrar</DialogTitle>
          <DialogDescription>
            Elige un cliente u oportunidad que ya existe, o crea uno nuevo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-base">¿Para quién es?</Label>
            {target ? (
              <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 p-3">
                {target.type === "deal" ? <Briefcase className="h-4 w-4 text-primary" /> : <User className="h-4 w-4 text-primary" />}
                <span className="text-base truncate flex-1">
                  {target.label}
                  {target.type === "new" && <span className="text-xs text-muted-foreground ml-2">(nuevo)</span>}
                </span>
                <Button variant="ghost" size="icon" onClick={() => setTarget(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar cliente u oportunidad…"
                    className="pl-9 h-12 text-base"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto rounded-xl border border-border divide-y divide-border">
                  {contactMatches.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="w-full flex items-center gap-2 p-3 text-left hover:bg-muted/60"
                      onClick={() => setTarget({ type: "contact", id: c.id, label: `${c.name} ${c.lastName ?? ""}`.trim() })}
                    >
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{c.name} {c.lastName ?? ""}</span>
                    </button>
                  ))}
                  {dealMatches.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className="w-full flex items-center gap-2 p-3 text-left hover:bg-muted/60"
                      onClick={() => setTarget({ type: "deal", id: d.id, label: d.name, contactId: d.contactId ?? null })}
                    >
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{d.name}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 p-3 text-left hover:bg-muted/60 text-primary"
                    onClick={() => setTarget({ type: "new", label: search.trim() || "Nuevo cliente" })}
                  >
                    <Plus className="h-4 w-4" />
                    <span className="truncate">
                      Crear nuevo{search.trim() ? `: “${search.trim()}”` : " cliente / oportunidad"}
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>

          {target?.type === "new" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={target.label}
                  onChange={(e) => setTarget({ type: "new", label: e.target.value })}
                  placeholder="Ej. Don Luis"
                />
              </div>
              <div className="space-y-2">
                <Label>Teléfono (opcional)</Label>
                <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="5512345678" />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Monto estimado (opcional)</Label>
                <Input type="number" inputMode="numeric" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} placeholder="0" />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-base">¿Qué hay que hacer?</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej. Cobrar a Don Luis" className="text-lg h-12" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="otro">General</SelectItem>
                  <SelectItem value="cotizacion">Cotizar</SelectItem>
                  <SelectItem value="cobro">Cobrar</SelectItem>
                  <SelectItem value="servicio">Servicio</SelectItem>
                  <SelectItem value="seguimiento">Seguimiento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cuándo</Label>
              <Input type="datetime-local" value={due} onChange={e => setDue(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="lg" onClick={submit} disabled={saving || create.isPending}>
            {saving || create.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}