import { useState } from "react";
import { Building2, User, Pencil, X, Plus, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useUpdateContact, type ContactRow } from "@/lib/queries/contacts";
import { useCompanies, useCreateCompany, type Company } from "@/lib/queries/companies";
import { toast } from "sonner";

interface Props { contact: ContactRow }

export function CompanyCard({ contact }: Props) {
  const update = useUpdateContact();
  const [editingPos, setEditingPos] = useState(false);
  const [posVal, setPosVal] = useState("");

  const linkCompany = (c: Company | null) =>
    update.mutate(
      { id: contact.id, patch: { company_id: c?.id ?? null, company: c?.name ?? null } },
      { onSuccess: () => toast.success("Empresa actualizada") },
    );

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-card">
      <div className="px-4 py-2.5 border-b border-border">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Empresa</span>
      </div>
      <div className="px-4 py-3 space-y-3 text-sm">
        <Row icon={Building2} label="Empresa">
          <div className="flex-1 flex items-center gap-2">
            <span className="truncate flex-1">{contact.company ?? "—"}</span>
            <CompanyPicker
              currentId={contact.companyId}
              onPick={linkCompany}
              trigger={
                <button className="text-muted-foreground hover:text-foreground">
                  <Pencil className="h-3 w-3" />
                </button>
              }
            />
            {contact.companyId && (
              <button onClick={() => linkCompany(null)} className="text-muted-foreground hover:text-destructive" title="Desvincular">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </Row>
        <Row icon={User} label="Cargo">
          {editingPos ? (
            <div className="flex items-center gap-1 flex-1">
              <Input
                autoFocus
                value={posVal}
                onChange={(e) => setPosVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    update.mutate(
                      { id: contact.id, patch: { position: posVal.trim() || null } },
                      { onSuccess: () => { toast.success("Actualizado"); setEditingPos(false); } },
                    );
                  }
                  if (e.key === "Escape") setEditingPos(false);
                }}
                className="h-7 text-xs"
              />
              <button
                onClick={() => {
                  update.mutate(
                    { id: contact.id, patch: { position: posVal.trim() || null } },
                    { onSuccess: () => { toast.success("Actualizado"); setEditingPos(false); } },
                  );
                }}
                className="text-success hover:bg-success/10 p-1 rounded"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setEditingPos(false)} className="text-muted-foreground p-1 rounded"><X className="h-3.5 w-3.5" /></button>
            </div>
          ) : (
            <button
              onClick={() => { setPosVal(contact.position ?? ""); setEditingPos(true); }}
              className="group flex-1 text-left flex items-center gap-1 truncate"
            >
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

function CompanyPicker({
  currentId, onPick, trigger,
}: {
  currentId: string | null;
  onPick: (c: Company | null) => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const { data: companies = [] } = useCompanies(search);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-2">
          <Input
            autoFocus
            placeholder="Buscar empresa…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
          />
          <div className="max-h-56 overflow-auto mt-2 space-y-0.5">
            {companies.map((c) => (
              <button
                key={c.id}
                onClick={() => { onPick(c); setOpen(false); }}
                className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted flex items-center justify-between"
              >
                <span className="truncate">{c.name}</span>
                {currentId === c.id && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            ))}
            {companies.length === 0 && (
              <div className="text-xs text-muted-foreground px-2 py-2">Sin resultados</div>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="w-full mt-2 justify-start"
            onClick={() => { setCreating(true); setOpen(false); }}
          >
            <Plus className="h-3.5 w-3.5" /> Crear "{search || "nueva empresa"}"
          </Button>
        </PopoverContent>
      </Popover>
      <CompanyQuickCreateDialog
        open={creating}
        onOpenChange={setCreating}
        defaultName={search}
        onCreated={(c) => { onPick(c); setCreating(false); setSearch(""); }}
      />
    </>
  );
}

function CompanyQuickCreateDialog({
  open, onOpenChange, defaultName, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultName: string;
  onCreated: (c: Company) => void;
}) {
  const [name, setName] = useState(defaultName);
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [size, setSize] = useState("");
  const create = useCreateCompany();

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (v) setName(defaultName); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nueva empresa</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nombre *</Label><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
          <div><Label>Sitio web</Label><Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Industria</Label><Input value={industry} onChange={(e) => setIndustry(e.target.value)} /></div>
            <div><Label>Tamaño</Label><Input value={size} onChange={(e) => setSize(e.target.value)} placeholder="1-10, 11-50…" /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!name.trim() || create.isPending}
            onClick={async () => {
              try {
                const c = await create.mutateAsync({
                  name: name.trim(),
                  website: website.trim() || null,
                  industry: industry.trim() || null,
                  size: size.trim() || null,
                });
                toast.success("Empresa creada");
                onCreated(c);
              } catch (e: any) { toast.error(e?.message ?? "Error"); }
            }}
          >
            Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}