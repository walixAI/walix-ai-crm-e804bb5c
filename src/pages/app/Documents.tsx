import { useMemo, useRef, useState } from "react";
import { FolderOpen, FolderPlus, Upload, Trash2, Pencil, ExternalLink, Bot, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toastError, toastSuccess } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { DocIcon } from "@/components/documents/DocumentPicker";
import {
  useDocCategories, useDocuments, useSaveCategory, useDeleteCategory, useUploadDocuments, useUpdateDocument, useDeleteDocument,
  openDocument, formatBytes, DOC_ACCEPT, shortDocumentTitle, type TenantDocument,
} from "@/lib/queries/documents";

export default function Documents() {
  const { data: cats = [], isLoading } = useDocCategories();
  const { data: docs = [] } = useDocuments();
  const saveCat = useSaveCategory();
  const delCat = useDeleteCategory();
  const upload = useUploadDocuments();
  const updDoc = useUpdateDocument();
  const delDoc = useDeleteDocument();
  const [selected, setSelected] = useState<string | null>(null);
  const [newCat, setNewCat] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [editing, setEditing] = useState<TenantDocument | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const active = cats.find((c) => c.id === selected) ?? cats[0] ?? null;
  const activeDocs = useMemo(() => docs.filter((d) => d.category_id === active?.id), [docs, active?.id]);

  const run = async (p: Promise<unknown>, ok?: string) => {
    try { await p; if (ok) toastSuccess(ok); } catch (e) { toastError("No se pudo completar", (e as Error).message); }
  };

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><FolderOpen className="h-6 w-6 text-primary" /> Documentos</h1>
        <p className="text-sm text-muted-foreground">Organiza folletos, temarios y listas de precios por categoría y decide quién puede enviarlos.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-border bg-card p-3 space-y-2 h-fit">
          <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); if (!newCat.trim()) return; run(saveCat.mutateAsync({ name: newCat }), "Categoría creada").then(() => setNewCat("")); }}>
            <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Nueva categoría" className="h-8 text-sm" />
            <Button size="icon" className="h-8 w-8 shrink-0" type="submit" disabled={saveCat.isPending} title="Crear categoría"><FolderPlus className="h-4 w-4" /></Button>
          </form>
          {isLoading && <p className="text-xs text-muted-foreground p-2">Cargando…</p>}
          {!isLoading && cats.length === 0 && <p className="text-xs text-muted-foreground p-2">Crea tu primera categoría para empezar a subir archivos.</p>}
          {cats.map((c) => {
            const n = docs.filter((d) => d.category_id === c.id).length;
            return (
              <button key={c.id} onClick={() => setSelected(c.id)}
                className={cn("w-full text-left rounded-lg px-3 py-2 text-sm flex items-center gap-2 hover:bg-muted/60", active?.id === c.id && "bg-primary/10 text-primary")}>
                <FolderOpen className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{c.name}</span>
                {c.advisor_can_attach && <UserRound className="h-3.5 w-3.5" aria-label="Asesores" />}
                {c.agent_can_send && <Bot className="h-3.5 w-3.5" aria-label="Agente IA" />}
                <span className="text-xs text-muted-foreground">{n}</span>
              </button>
            );
          })}
        </aside>

        {active ? (
          <section className="min-w-0 rounded-xl border border-border bg-card p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <h2 className="text-lg font-semibold">{active.name}</h2>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setRenaming({ id: active.id, name: active.name })}><Pencil className="h-4 w-4" /> Renombrar</Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => {
                  if (!confirm(`¿Eliminar la categoría «${active.name}» y sus ${activeDocs.length} archivos?`)) return;
                  run(delCat.mutateAsync({ id: active.id, paths: activeDocs.map((d) => d.storage_path) }), "Categoría eliminada").then(() => setSelected(null));
                }}><Trash2 className="h-4 w-4" /> Eliminar</Button>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer">
                <Switch checked={active.advisor_can_attach} onCheckedChange={(v) => run(saveCat.mutateAsync({ id: active.id, advisor_can_attach: v }))} />
                <span className="text-sm"><span className="font-medium block">Asesores pueden adjuntarlos</span><span className="text-xs text-muted-foreground">En conversaciones de WhatsApp y Email.</span></span>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer">
                <Switch checked={active.agent_can_send} onCheckedChange={(v) => run(saveCat.mutateAsync({ id: active.id, agent_can_send: v }))} />
                <span className="text-sm"><span className="font-medium block">El Agente de Ventas puede enviarlos</span><span className="text-xs text-muted-foreground">Usa la descripción para saber cuándo enviar cada archivo.</span></span>
              </label>
            </div>

            <div>
              <input ref={fileRef} type="file" multiple accept={DOC_ACCEPT} className="hidden" onChange={(e) => {
                const files = Array.from(e.target.files ?? []); e.target.value = "";
                if (files.length) run(upload.mutateAsync({ categoryId: active.id, files }), files.length === 1 ? "Archivo subido" : `${files.length} archivos subidos`);
              }} />
              <Button onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
                <Upload className="h-4 w-4" /> {upload.isPending ? "Subiendo…" : "Subir archivos"}
              </Button>
              <span className="text-xs text-muted-foreground ml-3">PDF, JPG, PNG o Excel · máximo 20 MB por archivo</span>
            </div>

            {activeDocs.length === 0 ? (
              <p className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-6 text-center">Esta categoría aún no tiene archivos.</p>
            ) : (
              <ul className="divide-y divide-border">
                {activeDocs.map((d) => (
                  <li key={d.id} className="py-2.5 flex items-center gap-3">
                    <DocIcon mime={d.mime_type} className="h-5 w-5 text-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate" title={d.name}>{shortDocumentTitle(d.name)}</div>
                      <div className="text-xs text-muted-foreground truncate">{formatBytes(d.size_bytes)}{d.description ? ` · ${d.description}` : ""}</div>
                    </div>
                    <Button variant="ghost" size="icon" title="Ver" onClick={() => run(openDocument(d))}><ExternalLink className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" title="Editar" onClick={() => setEditing(d)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" title="Eliminar" className="text-destructive" onClick={() => {
                      if (confirm(`¿Eliminar «${d.name}»?`)) run(delDoc.mutateAsync(d), "Archivo eliminado");
                    }}><Trash2 className="h-4 w-4" /></Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>

      <Dialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Renombrar categoría</DialogTitle></DialogHeader>
          <Input value={renaming?.name ?? ""} onChange={(e) => setRenaming((r) => r && { ...r, name: e.target.value })} autoFocus />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenaming(null)}>Cancelar</Button>
            <Button disabled={!renaming?.name.trim()} onClick={() => renaming && run(saveCat.mutateAsync({ id: renaming.id, name: renaming.name.trim() }), "Categoría actualizada").then(() => setRenaming(null))}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditDocDialog doc={editing} cats={cats} onClose={() => setEditing(null)}
        onSave={(patch) => editing && run(updDoc.mutateAsync({ id: editing.id, ...patch }), "Archivo actualizado").then(() => setEditing(null))} />
    </div>
  );
}

function EditDocDialog({ doc, cats, onClose, onSave }: {
  doc: TenantDocument | null; cats: { id: string; name: string }[]; onClose: () => void;
  onSave: (p: { name: string; description: string | null; category_id: string }) => void;
}) {
  const [name, setName] = useState(""); const [desc, setDesc] = useState(""); const [cat, setCat] = useState("");
  const [lastId, setLastId] = useState<string | null>(null);
  if (doc && doc.id !== lastId) { setLastId(doc.id); setName(shortDocumentTitle(doc.name)); setDesc(doc.description ?? ""); setCat(doc.category_id); }
  return (
    <Dialog open={!!doc} onOpenChange={(o) => { if (!o) { setLastId(null); onClose(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Editar archivo</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="doc-name">Nombre</Label><Input id="doc-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="doc-desc">¿Cuándo usarlo?</Label>
            <Textarea id="doc-desc" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ej. Temario de la Licenciatura en Administración; enviarlo cuando pidan el plan de estudios." /></div>
          <div className="space-y-1.5"><Label>Categoría</Label>
            <Select value={cat} onValueChange={setCat}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { setLastId(null); onClose(); }}>Cancelar</Button>
          <Button disabled={!name.trim()} onClick={() => { setLastId(null); onSave({ name: name.trim(), description: desc.trim() || null, category_id: cat }); }}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
