import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard, Users, KanbanSquare, MessageCircle, BarChart3,
  Zap, Settings, Inbox, Sparkles, UserPlus, Search,
} from "lucide-react";
import { useAiDrawer } from "@/store/aiDrawer";
import { supabase } from "@/integrations/supabase/client";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

interface SearchHit {
  type: "contact" | "deal" | "conversation";
  id: string;
  title: string;
  subtitle?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const NAV = [
  { to: "/dashboard", label: "Ir al Dashboard", icon: LayoutDashboard, kw: "inicio home" },
  { to: "/ai-inbox", label: "Ir al AI Inbox", icon: Inbox, kw: "sugerencias" },
  { to: "/contacts", label: "Ir a Contactos", icon: Users, kw: "leads" },
  { to: "/pipeline", label: "Ir al Pipeline", icon: KanbanSquare, kw: "oportunidades oportunidades kanban" },
  { to: "/whatsapp", label: "Ir a WhatsApp", icon: MessageCircle, kw: "chat mensajes" },
  { to: "/reports", label: "Ir a Reportes", icon: BarChart3, kw: "analytics métricas" },
  { to: "/automations", label: "Ir a Automatizaciones", icon: Zap, kw: "workflows" },
  { to: "/settings", label: "Ir a Configuración", icon: Settings, kw: "ajustes" },
];

export function CommandPalette({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const askAi = useAiDrawer((s) => s.ask);
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 200);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);

  // Reset on close
  useEffect(() => {
    if (!open) { setQuery(""); setHits([]); }
  }, [open]);

  // Search across entities (RLS-scoped)
  useEffect(() => {
    const q = debounced.trim();
    if (!q || q.length < 2) { setHits([]); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const like = `%${q}%`;
        const [contactsR, dealsR, convosR] = await Promise.all([
          supabase.from("contacts")
            .select("id, name, company, phone")
            .or(`name.ilike.${like},company.ilike.${like},phone.ilike.${like}`)
            .limit(5),
          supabase.from("deals")
            .select("id, name, stage_name, amount")
            .ilike("name", like).limit(5),
          supabase.from("conversations")
            .select("id, contact_id, preview")
            .ilike("preview", like).limit(5),
        ]);
        if (cancelled) return;
        const contactIds = (convosR.data ?? []).map((c: any) => c.contact_id).filter(Boolean);
        const contactMap = new Map<string, any>();
        if (contactIds.length) {
          const { data: cs } = await supabase
            .from("contacts").select("id, name").in("id", contactIds);
          (cs ?? []).forEach((c: any) => contactMap.set(c.id, c));
        }
        const out: SearchHit[] = [
          ...(contactsR.data ?? []).map((c: any) => ({
            type: "contact" as const, id: c.id, title: c.name,
            subtitle: c.company ?? c.phone ?? "",
          })),
          ...(dealsR.data ?? []).map((d: any) => ({
            type: "deal" as const, id: d.id, title: d.name,
            subtitle: `${d.stage_name ?? "—"} · $${Number(d.amount ?? 0).toLocaleString("es-MX")}`,
          })),
          ...(convosR.data ?? []).map((c: any) => ({
            type: "conversation" as const, id: c.id,
            title: contactMap.get(c.contact_id)?.name ?? "Conversación",
            subtitle: (c.preview ?? "").slice(0, 70),
          })),
        ];
        setHits(out);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [debounced]);

  const go = (path: string) => { navigate(path); onOpenChange(false); };

  const askAiNow = () => {
    if (!query.trim()) return;
    askAi(query.trim());
    onOpenChange(false);
  };

  const showAiOption = query.trim().length > 2;

  const grouped = useMemo(() => ({
    contacts: hits.filter((h) => h.type === "contact"),
    deals:    hits.filter((h) => h.type === "deal"),
    convos:   hits.filter((h) => h.type === "conversation"),
  }), [hits]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Busca contactos, oportunidades, mensajes o pregunta a la IA…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {!loading && query.length >= 2 && hits.length === 0 && !showAiOption && (
          <CommandEmpty>Sin resultados.</CommandEmpty>
        )}

        {showAiOption && (
          <>
            <CommandGroup heading="Inteligencia artificial">
              <CommandItem onSelect={askAiNow} className="gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                <div className="flex-1">
                  <div className="text-sm">Preguntar a Walix IA</div>
                  <div className="text-xs text-muted-foreground truncate">"{query.trim()}"</div>
                </div>
                <kbd className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">↵</kbd>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {grouped.contacts.length > 0 && (
          <CommandGroup heading="Contactos">
            {grouped.contacts.map((h) => (
              <CommandItem key={h.id} onSelect={() => go(`/contacts/${h.id}`)} className="gap-2">
                <Users className="h-4 w-4 text-primary" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{h.title}</div>
                  {h.subtitle && <div className="text-xs text-muted-foreground truncate">{h.subtitle}</div>}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {grouped.deals.length > 0 && (
          <CommandGroup heading="Oportunidades">
            {grouped.deals.map((h) => (
              <CommandItem key={h.id} onSelect={() => go(`/pipeline?dealId=${h.id}`)} className="gap-2">
                <KanbanSquare className="h-4 w-4 text-primary" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{h.title}</div>
                  {h.subtitle && <div className="text-xs text-muted-foreground truncate">{h.subtitle}</div>}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {grouped.convos.length > 0 && (
          <CommandGroup heading="Conversaciones">
            {grouped.convos.map((h) => (
              <CommandItem key={h.id} onSelect={() => go(`/whatsapp?conversationId=${h.id}`)} className="gap-2">
                <MessageCircle className="h-4 w-4 text-primary" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{h.title}</div>
                  {h.subtitle && <div className="text-xs text-muted-foreground truncate">{h.subtitle}</div>}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {(hits.length > 0 || showAiOption) && <CommandSeparator />}

        <CommandGroup heading="Navegación">
          {NAV.map((n) => (
            <CommandItem key={n.to} onSelect={() => go(n.to)} keywords={[n.kw]} className="gap-2">
              <n.icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{n.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Acciones rápidas">
          <CommandItem onSelect={() => go("/contacts?new=1")} className="gap-2">
            <UserPlus className="h-4 w-4 text-success" />
            <span className="text-sm">Crear nuevo contacto</span>
          </CommandItem>
          <CommandItem onSelect={() => go("/ai-inbox")} className="gap-2">
            <Inbox className="h-4 w-4 text-accent" />
            <span className="text-sm">Ver sugerencias de la IA</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}