import { useMemo, useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Plus, Upload, Download, LayoutGrid, List, Search, Filter, X,
  MessageCircle, Edit, MoreHorizontal, ChevronUp, ChevronDown, Save,
  ChevronLeft, ChevronRight, Sparkles, KanbanSquare, Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { statusBadgeClass, type LeadStatus, type Source } from "@/lib/contacts/badges";
import { relativeTime } from "@/lib/format/relativeTime";
import { useTenantUsers } from "@/lib/queries/tenantUsers";
import { useContactTags } from "@/lib/queries/contactTags";
import { useContacts } from "@/lib/queries/contacts";
import { useDeleteContact, useUpdateContact } from "@/lib/queries/contacts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ContactFormDialog } from "@/components/contacts/ContactFormDialog";
import { ImportCsvDialog } from "@/components/contacts/ImportCsvDialog";
import { FirstContactAIBanner } from "@/components/contacts/FirstContactAIBanner";
import { BulkActionsInline } from "@/components/contacts/BulkActionsInline";
import { ContactsKanban } from "@/components/contacts/ContactsKanban";
import { ReassignPopover } from "@/components/contacts/ReassignPopover";
import { ChangeStatusPopover } from "@/components/contacts/ChangeStatusPopover";
import { TagsPopover } from "@/components/contacts/TagsPopover";
import { ConfirmDialog } from "@/components/walix/ConfirmDialog";
import { TableSkeleton, ListRowsSkeleton } from "@/components/walix/Skeletons";
import { EmptyState } from "@/components/walix/EmptyState";
import { EmptyIllustration } from "@/components/walix/empty/EmptyIllustration";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const STATUSES: LeadStatus[] = ["Nuevo", "Contactado", "Calificado", "En negociación", "Cliente", "Inactivo"];
const SOURCES: Source[] = ["WhatsApp", "Formulario web", "Referido", "Manual"];
const PAGE_SIZE = 25;

export default function Contacts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const firstRunParam = searchParams.get("firstRun") === "1";
  const [showFirstRun, setShowFirstRun] = useState(firstRunParam);
  const [view, setView] = useState<"list" | "kanban" | "cards">("list");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedSellers, setSelectedSellers] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<Source[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<LeadStatus[]>([]);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<"name" | "company" | "status" | "lastActivity">("lastActivity");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [openNew, setOpenNew] = useState(false);
  const [openImport, setOpenImport] = useState(false);
  const [aiCollapsed, setAiCollapsed] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();

  const { data: allContacts = [], isLoading } = useContacts();
  const { data: sellers = [] } = useTenantUsers();
  const { data: tagList = [] } = useContactTags();

  const { data: aiSuggestionsList = [] } = useQuery({
    queryKey: ["contacts-ai-suggestions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_suggestions")
        .select("id, text, contact_id, created_at")
        .eq("dismissed", false)
        .not("contact_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []).map((s: any) => ({ id: s.id, text: s.text, contactId: s.contact_id }));
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const filtered = useMemo(() => {
    let list = allContacts.filter(c => {
      if (debounced) {
        const q = debounced.toLowerCase();
        if (!`${c.name} ${c.lastName ?? ""} ${c.company ?? ""} ${c.phone} ${c.email ?? ""}`.toLowerCase().includes(q)) return false;
      }
      if (selectedTags.length && !selectedTags.some(t => c.tags.includes(t))) return false;
      if (selectedSellers.length && !selectedSellers.includes(c.ownerId)) return false;
      if (selectedSources.length && !selectedSources.includes(c.source)) return false;
      if (selectedStatuses.length && !selectedStatuses.includes(c.status)) return false;
      if (dateRange.from && new Date(c.createdAt) < dateRange.from) return false;
      if (dateRange.to && new Date(c.createdAt) > dateRange.to) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const va = (a as any)[sortKey] ?? "";
      const vb = (b as any)[sortKey] ?? "";
      return va > vb ? dir : va < vb ? -dir : 0;
    });
    return list;
  }, [allContacts, debounced, selectedTags, selectedSellers, selectedSources, selectedStatuses, dateRange, sortKey, sortDir]);

  useEffect(() => { setPage(1); }, [debounced, selectedTags, selectedSellers, selectedSources, selectedStatuses, dateRange]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allPageSelected = pageItems.length > 0 && pageItems.every(c => selected.has(c.id));

  const togglePageAll = () => {
    const next = new Set(selected);
    if (allPageSelected) pageItems.forEach(c => next.delete(c.id));
    else pageItems.forEach(c => next.add(c.id));
    setSelected(next);
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const sortBy = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const clearFilters = () => {
    setSelectedTags([]); setSelectedSellers([]); setSelectedSources([]);
    setSelectedStatuses([]); setDateRange({}); setSearch("");
  };

  const activeFiltersCount = selectedTags.length + selectedSellers.length + selectedSources.length + selectedStatuses.length + (dateRange.from ? 1 : 0);

  const dismissFirstRun = () => {
    setShowFirstRun(false);
    if (searchParams.has("firstRun")) {
      searchParams.delete("firstRun");
      setSearchParams(searchParams, { replace: true });
    }
  };

  const openWA = (phone: string) => {
    const clean = phone.replace(/[^0-9]/g, "");
    window.open(`https://wa.me/${clean}`, "_blank");
  };

  const exportSelected = () => {
    const ids = Array.from(selected);
    const rows = allContacts.filter((c) => ids.includes(c.id));
    const headers = ["nombre","apellido","telefono","email","empresa","cargo","status","fuente","etiquetas","vendedor"];
    const csv = [headers.join(",")].concat(
      rows.map((c) => [
        c.name, c.lastName ?? "", c.phone, c.email ?? "", c.company ?? "",
        c.position ?? "", c.status, c.source, (c.tags ?? []).join("|"), c.ownerName,
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")),
    ).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `contactos-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} contactos exportados`);
  };

  const rowReassign = (id: string, ownerId: string | null) =>
    updateContact.mutate({ id, patch: { owner_id: ownerId } }, { onSuccess: () => toast.success("Reasignado") });
  const rowStatus = (id: string, status: any) =>
    updateContact.mutate({ id, patch: { status } }, { onSuccess: () => toast.success(`Status: ${status}`) });
  const rowToggleTag = (c: any, tag: string, checked: boolean) => {
    const tags = checked ? Array.from(new Set([...(c.tags ?? []), tag])) : (c.tags ?? []).filter((t: string) => t !== tag);
    updateContact.mutate({ id: c.id, patch: { tags } });
  };

  return (
    <div className="flex gap-6 max-w-[1600px]">
      <div className="flex-1 min-w-0 space-y-4">
        {showFirstRun && allContacts.length === 0 && !isLoading && (
          <FirstContactAIBanner onDismiss={dismissFirstRun} />
        )}
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Contactos</h1>
            <p className="text-sm text-muted-foreground mt-0.5"><span className="font-semibold text-foreground">{filtered.length}</span> contactos</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setOpenImport(true)}><Upload className="h-4 w-4" /> Importar CSV</Button>
            <Button variant="outline" size="sm" onClick={() => toast.success("Exportando CSV...")}><Download className="h-4 w-4" /> Exportar CSV</Button>
            <Button size="sm" onClick={() => setOpenNew(true)}><Plus className="h-4 w-4" /> Nuevo Contacto</Button>
          </div>
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, empresa, teléfono..." className="pl-9" />
          </div>
          <Button variant="outline" size="sm" onClick={() => setFiltersOpen(!filtersOpen)}>
            <Filter className="h-4 w-4" /> Filtros {activeFiltersCount > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">{activeFiltersCount}</span>}
          </Button>
          <div className="ml-auto flex items-center gap-1 p-1 rounded-lg border border-border bg-card">
            <button onClick={() => setView("list")} className={cn("p-1.5 rounded-md transition-colors", view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}><List className="h-4 w-4" /></button>
            <button onClick={() => setView("kanban")} className={cn("p-1.5 rounded-md transition-colors", view === "kanban" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")} title="Kanban por status"><KanbanSquare className="h-4 w-4" /></button>
            <button onClick={() => setView("cards")} className={cn("p-1.5 rounded-md transition-colors", view === "cards" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")} title="Tarjetas"><LayoutGrid className="h-4 w-4" /></button>
          </div>
        </div>

        {/* Advanced filters */}
        <Collapsible open={filtersOpen}>
          <CollapsibleContent className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Tags */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Etiquetas</label>
                  <div className="flex flex-wrap gap-1.5">
                    {tagList.map(tag => {
                      const t = tag.name;
                      const active = selectedTags.includes(t);
                      return (
                        <button key={t} onClick={() => setSelectedTags(active ? selectedTags.filter(x => x !== t) : [...selectedTags, t])}
                          className={cn("px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                            active ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted")}>
                          #{t}
                        </button>
                      );
                    })}
                    {tagList.length === 0 && (
                      <span className="text-xs text-muted-foreground italic">Sin etiquetas configuradas</span>
                    )}
                  </div>
                </div>
                {/* Sellers */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Vendedor asignado</label>
                  <div className="flex flex-wrap gap-1.5">
                    {sellers.map(s => {
                      const active = selectedSellers.includes(s.id);
                      return (
                        <button key={s.id} onClick={() => setSelectedSellers(active ? selectedSellers.filter(x => x !== s.id) : [...selectedSellers, s.id])}
                          className={cn("flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border transition-colors",
                            active ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted")}>
                          <span className="h-5 w-5 rounded-full grid place-items-center text-[10px] font-bold text-white" style={{ background: s.color }}>{s.initials}</span>
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Source */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Fuente</label>
                  <div className="flex flex-wrap gap-1.5">
                    {SOURCES.map(s => {
                      const active = selectedSources.includes(s);
                      return (
                        <button key={s} onClick={() => setSelectedSources(active ? selectedSources.filter(x => x !== s) : [...selectedSources, s])}
                          className={cn("px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                            active ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted")}>
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Status */}
                <div className="lg:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Status del lead</label>
                  <div className="flex flex-wrap gap-1.5">
                    {STATUSES.map(s => {
                      const active = selectedStatuses.includes(s);
                      return (
                        <button key={s} onClick={() => setSelectedStatuses(active ? selectedStatuses.filter(x => x !== s) : [...selectedStatuses, s])}
                          className={cn("px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                            active ? "bg-primary text-primary-foreground border-primary" : cn("bg-card hover:bg-muted", statusBadgeClass[s]))}>
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Date range */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Fecha de creación</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-start font-normal">
                        {dateRange.from ? `${format(dateRange.from, "dd MMM", { locale: es })}${dateRange.to ? ` – ${format(dateRange.to, "dd MMM", { locale: es })}` : ""}` : "Seleccionar rango"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="range" selected={dateRange as any} onSelect={(r: any) => setDateRange(r ?? {})} className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button variant="ghost" size="sm" onClick={clearFilters}><X className="h-4 w-4" /> Limpiar filtros</Button>
                <Button variant="outline" size="sm" onClick={() => toast.success("Vista guardada")}><Save className="h-4 w-4" /> Guardar vista</Button>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Bulk actions inline (entre búsqueda y tabla) */}
        <BulkActionsInline
          selectedIds={Array.from(selected)}
          onClear={() => setSelected(new Set())}
          onExport={exportSelected}
        />

        {/* Content */}
        {isLoading && allContacts.length === 0 ? (
          view === "list"
            ? <TableSkeleton rows={8} columns={7} />
            : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-border bg-card p-5 shadow-card">
                    <ListRowsSkeleton rows={3} className="!divide-y-0" />
                  </div>
                ))}
              </div>
            )
        ) : !isLoading && allContacts.length === 0 ? (
          <EmptyState
            illustration={<EmptyIllustration variant="contacts" />}
            title="¡Empieza agregando tu primer contacto!"
            description="Importa un CSV o crea un contacto manual para empezar a vender por WhatsApp."
            action={{ label: "+ Nuevo Contacto", onClick: () => setOpenNew(true) }}
            secondaryAction={{ label: "Importar CSV", onClick: () => setOpenImport(true) }}
          />
        ) : view === "kanban" ? (
          <ContactsKanban
            contacts={filtered}
            selected={selected}
            onToggleSelect={toggleOne}
            onWhatsApp={openWA}
          />
        ) : view === "list" ? (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3 w-10"><Checkbox checked={allPageSelected} onCheckedChange={togglePageAll} /></th>
                    <SortHead label="Nombre" k="name" sortKey={sortKey} sortDir={sortDir} onSort={sortBy} />
                    <th className="text-left px-3 py-3 font-semibold">Teléfono</th>
                    <SortHead label="Empresa" k="company" sortKey={sortKey} sortDir={sortDir} onSort={sortBy} />
                    <SortHead label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onSort={sortBy} />
                    <th className="text-left px-3 py-3 font-semibold">Vendedor</th>
                    <SortHead label="Última actividad" k="lastActivity" sortKey={sortKey} sortDir={sortDir} onSort={sortBy} />
                    <th className="px-3 py-3 w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map(c => (
                    <tr key={c.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2.5"><Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleOne(c.id)} /></td>
                      <td className="px-3 py-2.5">
                        <Link to={`/contacts/${c.id}`} className="flex items-center gap-2.5 group">
                          <Avatar className="h-8 w-8"><AvatarFallback style={{ background: c.avatarColor, color: "white" }} className="text-xs font-semibold">{c.name[0]}{c.lastName?.[0]}</AvatarFallback></Avatar>
                          <div>
                            <div className="font-medium group-hover:text-primary transition-colors">{c.name} {c.lastName}</div>
                            <div className="text-xs text-muted-foreground">{c.email}</div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-3 py-2.5">
                        <button onClick={() => openWA(c.phone)} className="inline-flex items-center gap-1.5 text-sm hover:text-success transition-colors group">
                          <MessageCircle className="h-3.5 w-3.5 text-success opacity-70 group-hover:opacity-100" />
                          <span className="font-mono text-xs">{c.phone}</span>
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{c.company}</td>
                      <td className="px-3 py-2.5">
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border", statusBadgeClass[c.status])}>{c.status}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="h-6 w-6 rounded-full grid place-items-center text-[10px] font-bold text-white" style={{ background: sellers.find(s => s.id === c.ownerId)?.color }}>{c.ownerInitials}</span>
                          <span className="text-xs">{c.ownerName.split(" ")[0]}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{relativeTime(c.lastActivity)}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-0.5 justify-end">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openWA(c.phone)}><MessageCircle className="h-3.5 w-3.5 text-success" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" asChild><Link to={`/contacts/${c.id}`}><Edit className="h-3.5 w-3.5" /></Link></Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild><Link to={`/contacts/${c.id}`}>Ver detalle</Link></DropdownMenuItem>
                              <ReassignPopover
                                currentOwnerId={c.ownerId}
                                onSelect={(uid) => rowReassign(c.id, uid)}
                                trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Reasignar</DropdownMenuItem>}
                              />
                              <ChangeStatusPopover
                                current={c.status}
                                onSelect={(s) => rowStatus(c.id, s)}
                                trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Cambiar status</DropdownMenuItem>}
                              />
                              <TagsPopover
                                current={c.tags}
                                onToggle={(t, ck) => rowToggleTag(c, t, ck)}
                                trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Etiquetar</DropdownMenuItem>}
                              />
                              <DropdownMenuItem className="text-danger" onSelect={() => setDeleteId(c.id)}>Eliminar</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {pageItems.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-12 text-muted-foreground text-sm">Sin resultados con los filtros actuales</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm">
              <div className="text-muted-foreground text-xs">Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}</div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                <span className="px-3 text-xs font-medium">{page} / {totalPages}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pageItems.map(c => (
              <div key={c.id} className="group relative rounded-xl border border-border bg-card p-5 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all">
                <div className="absolute top-3 right-3"><Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleOne(c.id)} /></div>
                <div className="flex flex-col items-center text-center">
                  <Avatar className="h-16 w-16 mb-3"><AvatarFallback style={{ background: c.avatarColor, color: "white" }} className="text-lg font-semibold">{c.name[0]}{c.lastName?.[0]}</AvatarFallback></Avatar>
                  <div className="font-semibold">{c.name} {c.lastName}</div>
                  <div className="text-xs text-muted-foreground mb-2">{c.company}</div>
                  <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border mb-3", statusBadgeClass[c.status])}>{c.status}</span>
                  <div className="font-mono text-xs text-muted-foreground mb-3">{c.phone}</div>
                  <div className="flex gap-2 w-full">
                    <Button size="sm" className="flex-1 bg-success hover:bg-success/90 text-success-foreground" onClick={() => openWA(c.phone)}><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</Button>
                    <Button size="sm" variant="outline" asChild><Link to={`/contacts/${c.id}`}>Ver detalle</Link></Button>
                  </div>
                </div>
              </div>
            ))}
            {pageItems.length === 0 && <div className="col-span-full text-center py-12 text-muted-foreground text-sm">Sin resultados</div>}
          </div>
        )}
      </div>

      {/* AI side panel */}
      <aside className={cn("hidden xl:block shrink-0 transition-all", aiCollapsed ? "w-12" : "w-80")}>
        <div className="sticky top-4">
          {aiCollapsed ? (
            <button onClick={() => setAiCollapsed(false)} className="h-12 w-12 rounded-xl bg-gradient-brand grid place-items-center shadow-glow text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </button>
          ) : (
            <div className="rounded-xl border border-border bg-card p-5 shadow-card space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-gradient-brand grid place-items-center"><Sparkles className="h-4 w-4 text-primary-foreground" /></div>
                  <h3 className="font-semibold text-sm">Próximo paso sugerido</h3>
                </div>
                <button onClick={() => setAiCollapsed(true)} className="text-muted-foreground hover:text-foreground"><ChevronRight className="h-4 w-4" /></button>
              </div>
              {aiSuggestionsList.length === 0 ? (
                <div className="rounded-lg bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/10 p-3 text-xs text-muted-foreground leading-relaxed">
                  La IA analizará tus contactos y mostrará aquí el siguiente paso sugerido.
                </div>
              ) : (
                <>
                  <div className="rounded-lg bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/10 p-3 text-sm leading-relaxed">
                    {aiSuggestionsList[0].text}
                  </div>
                  {aiSuggestionsList[0].contactId && (
                    <Button asChild className="w-full" size="sm" variant="default">
                      <Link to={`/app/contacts/${aiSuggestionsList[0].contactId}`}>
                        <Send className="h-3.5 w-3.5" /> Abrir contacto
                      </Link>
                    </Button>
                  )}
                  {aiSuggestionsList.length > 1 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Más sugerencias</h4>
                      <div className="space-y-2">
                        {aiSuggestionsList.slice(1, 4).map((s) => (
                          <div key={s.id} className="text-xs p-2 rounded-lg bg-muted/40 hover:bg-muted transition-colors cursor-pointer">{s.text}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </aside>

      <ContactFormDialog open={openNew} onOpenChange={setOpenNew} />
      <ImportCsvDialog open={openImport} onOpenChange={setOpenImport} />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="¿Eliminar este contacto?"
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        loading={deleteContact.isPending}
        onConfirm={() => {
          if (!deleteId) return;
          deleteContact.mutate(deleteId, {
            onSuccess: () => { toast.success("Contacto eliminado"); setDeleteId(null); },
          });
        }}
      />
    </div>
  );
}

function SortHead({ label, k, sortKey, sortDir, onSort }: any) {
  const active = sortKey === k;
  return (
    <th className="text-left px-3 py-3 font-semibold">
      <button onClick={() => onSort(k)} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
        {label}
        {active && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
      </button>
    </th>
  );
}
