import { useEffect, useState } from "react";
import { Plus, Search, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  useMessageTemplates, useCreateTemplate, useUpdateTemplate, useDeleteTemplate,
  type MessageTemplate,
} from "@/lib/queries/whatsapp";

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  tenantId: string | null;
  onUse: (t: MessageTemplate) => void;
}

export function TemplatesDialog({ open, onOpenChange, tenantId, onUse }: Props) {
  const { data: templates = [] } = useMessageTemplates();
  const create = useCreateTemplate();
  const update = useUpdateTemplate();
  const remove = useDeleteTemplate();

  const [q, setQ] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");

  useEffect(() => {
    if (!open) {
      setQ(""); setEditingId(null); setCreating(false);
      setName(""); setContent(""); setCategory("");
    }
  }, [open]);

  const filtered = templates.filter(
    (t) => t.name.toLowerCase().includes(q.toLowerCase()) || t.content.toLowerCase().includes(q.toLowerCase()),
  );

  function startEdit(t: MessageTemplate) {
    setEditingId(t.id);
    setCreating(false);
    setName(t.name); setContent(t.content); setCategory(t.category ?? "");
  }
  function startCreate() {
    setCreating(true);
    setEditingId(null);
    setName(""); setContent(""); setCategory("");
  }
  function cancelForm() {
    setEditingId(null); setCreating(false);
    setName(""); setContent(""); setCategory("");
  }

  async function save() {
    if (!name.trim() || !content.trim()) {
      toast.error("Nombre y contenido son obligatorios");
      return;
    }
    try {
      if (creating) {
        if (!tenantId) { toast.error("Sin tenant"); return; }
        await create.mutateAsync({ tenantId, name: name.trim(), content: content.trim(), category: category.trim() || null });
        toast.success("Plantilla creada");
      } else if (editingId) {
        await update.mutateAsync({ id: editingId, patch: { name: name.trim(), content: content.trim(), category: category.trim() || null } });
        toast.success("Plantilla actualizada");
      }
      cancelForm();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar");
    }
  }

  async function onDelete(id: string) {
    if (!confirm("¿Eliminar esta plantilla?")) return;
    try {
      await remove.mutateAsync(id);
      toast.success("Plantilla eliminada");
      if (editingId === id) cancelForm();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo eliminar");
    }
  }

  const showForm = creating || editingId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Respuestas rápidas</DialogTitle>
          <DialogDescription>
            Inserta una plantilla con <code className="px-1 bg-muted rounded">/</code> en el composer. Variables disponibles:{" "}
            <code className="px-1 bg-muted rounded">{"{nombre}"}</code>{" "}
            <code className="px-1 bg-muted rounded">{"{empresa}"}</code>{" "}
            <code className="px-1 bg-muted rounded">{"{vendedor}"}</code>{" "}
            <code className="px-1 bg-muted rounded">{"{monto}"}</code>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-h-[360px]">
          {/* List */}
          <div className="flex flex-col">
            <div className="flex gap-2 mb-2">
              <div className="relative flex-1">
                <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar plantilla…" className="pl-9 h-9" />
              </div>
              <Button size="sm" onClick={startCreate}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Nueva
              </Button>
            </div>

            <ScrollArea className="flex-1 border border-border rounded-lg">
              {filtered.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground text-center">Sin plantillas</div>
              )}
              <ul className="divide-y divide-border">
                {filtered.map((t) => (
                  <li
                    key={t.id}
                    className={cn(
                      "p-3 hover:bg-muted/40 transition cursor-pointer",
                      editingId === t.id && "bg-primary/5",
                    )}
                    onClick={() => startEdit(t)}
                  >
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm flex-1 truncate">{t.name}</p>
                      <Button
                        variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        onClick={(e) => { e.stopPropagation(); onUse(t); }}
                        title="Usar"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); onDelete(t.id); }}
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.content}</p>
                    {t.category && (
                      <span className="inline-block mt-1.5 text-[10px] bg-muted text-muted-foreground rounded px-1.5 py-0.5">
                        {t.category}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>

          {/* Form / preview */}
          <div className="border border-border rounded-lg p-3 flex flex-col">
            {!showForm && (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground text-center px-4">
                Selecciona una plantilla para editarla, o crea una nueva.
              </div>
            )}
            {showForm && (
              <div className="flex flex-col gap-3 flex-1">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Nombre</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 mt-1" placeholder="Ej. Bienvenida" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Categoría</label>
                  <Input value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 mt-1" placeholder="Opcional (saludo, propuesta…)" />
                </div>
                <div className="flex-1 flex flex-col">
                  <label className="text-xs font-medium text-muted-foreground">Contenido</label>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="mt-1 flex-1 min-h-[140px]"
                    placeholder="Hola {nombre}, soy {vendedor} de {empresa}…"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={save} disabled={create.isPending || update.isPending} className="flex-1">
                    {creating ? "Crear" : "Guardar"}
                  </Button>
                  <Button variant="outline" onClick={cancelForm}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
