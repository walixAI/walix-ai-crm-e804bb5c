import { useMemo, useState, type ReactNode } from "react";
import { FileText, Image as ImageIcon, FileSpreadsheet, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useDocCategories, useDocuments, shortDocumentTitle, type TenantDocument } from "@/lib/queries/documents";
import { usePermissions } from "@/hooks/usePermissions";

export function DocIcon({ mime, className = "h-4 w-4" }: { mime: string; className?: string }) {
  if (mime.startsWith("image/")) return <ImageIcon className={className} />;
  if (mime.includes("sheet") || mime.includes("excel") || mime === "text/csv") return <FileSpreadsheet className={className} />;
  return <FileText className={className} />;
}

/** Library picker shared by WhatsApp and Email: only categories enabled for advisors (managers see all). */
export function DocumentPicker({ onPick, trigger }: { onPick: (d: TenantDocument) => void | Promise<void>; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const { data: cats = [] } = useDocCategories();
  const { data: docs = [] } = useDocuments();
  const { canAccess } = usePermissions();
  const manager = canAccess("/documentos");
  const groups = useMemo(() => {
    const s = q.trim().toLowerCase();
    return cats.filter((c) => c.advisor_can_attach || manager).map((c) => ({
      cat: c,
      docs: docs.filter((d) => d.category_id === c.id && (!s || d.name.toLowerCase().includes(s) || (d.description ?? "").toLowerCase().includes(s))),
    })).filter((g) => g.docs.length);
  }, [cats, docs, q, manager]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] p-0">
        <div className="p-2 border-b border-border relative">
          <Search className="h-3.5 w-3.5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar documento…" className="h-8 pl-7 text-sm" />
        </div>
        <div className="max-h-72 overflow-y-auto">
          {groups.length === 0 && <p className="text-xs text-muted-foreground p-4 text-center">No hay documentos disponibles para adjuntar.</p>}
          {groups.map((g) => (
            <div key={g.cat.id}>
              <div className="px-3 pt-2 pb-1 truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground" title={g.cat.name}>{g.cat.name}</div>
              {g.docs.map((d) => (
                <button key={d.id} type="button" className="w-full text-left px-3 py-2 hover:bg-muted/60 flex items-start gap-2"
                  onClick={async () => { setOpen(false); await onPick(d); }}>
                  <DocIcon mime={d.mime_type} className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm truncate" title={d.name}>{shortDocumentTitle(d.name)}</span>
                    {d.description && <span className="block text-[11px] text-muted-foreground truncate">{d.description}</span>}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
