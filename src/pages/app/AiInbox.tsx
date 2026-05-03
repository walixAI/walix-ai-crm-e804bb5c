import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles, Inbox, Flame, Snowflake, MessageSquareWarning, UserPlus,
  ArrowRight, Loader2, AlertTriangle, RefreshCw, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { fetchAiInbox, AI_MODEL_LABEL, type AiInboxItem, type AiInboxCategory } from "@/services/ai";
import { AiInboxSkeleton } from "@/components/walix/Skeletons";

const TABS: { id: "all" | AiInboxCategory; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "messages", label: "Mensajes" },
  { id: "oportunidades", label: "Oportunidades" },
  { id: "pipeline", label: "Pipeline" },
];

const TYPE_ICON: Record<AiInboxItem["type"], any> = {
  hot_deal: Flame,
  cold_deal: Snowflake,
  unread_message: MessageSquareWarning,
  missing_followup: MessageSquareWarning,
  stale_lead: UserPlus,
};

const SEVERITY_RING: Record<AiInboxItem["severity"], string> = {
  high: "border-danger/40 bg-danger/5",
  medium: "border-warning/40 bg-warning/5",
  low: "border-border bg-card",
};
const SEVERITY_DOT: Record<AiInboxItem["severity"], string> = {
  high: "bg-danger",
  medium: "bg-warning",
  low: "bg-muted-foreground",
};
const SEVERITY_LABEL: Record<AiInboxItem["severity"], string> = {
  high: "Urgente", medium: "Atención", low: "Info",
};

const STORAGE_KEY = "walix.aiInbox.dismissed.v1";
function loadDismissed(): string[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); } catch { return []; }
}
function saveDismissed(ids: string[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(-200))); } catch { /* ignore */ }
}

export default function AiInbox() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"all" | AiInboxCategory>("all");
  const [items, setItems] = useState<AiInboxItem[]>([]);
  const [counts, setCounts] = useState({ total: 0, deals: 0, messages: 0, pipeline: 0 });
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"live" | "fallback">("live");
  const [dismissed, setDismissed] = useState<string[]>(loadDismissed);

  const load = async () => {
    setLoading(true);
    const res = await fetchAiInbox();
    setItems(res.suggestions);
    setCounts(res.counts);
    setSource(res.source);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const visible = useMemo(() => {
    const f = items.filter((i) => !dismissed.includes(i.id));
    return tab === "all" ? f : f.filter((i) => i.category === tab);
  }, [items, dismissed, tab]);

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    saveDismissed(next);
  };

  const runAction = (a: AiInboxItem["action"]) => {
    if (a.type === "open_deal") navigate(`/pipeline?dealId=${a.id}`);
    else if (a.type === "open_conversation") navigate(`/whatsapp?conversationId=${a.id}`);
    else if (a.type === "open_contact") navigate(`/contacts/${a.id}`);
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="px-6 py-5 border-b border-border bg-card/30">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-brand grid place-items-center text-primary-foreground shadow-glow">
              <Inbox className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold flex items-center gap-2">
                AI Inbox
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wide">
                  <Sparkles className="inline h-2.5 w-2.5 mr-1" />
                  {AI_MODEL_LABEL}
                </span>
              </h1>
              <p className="text-sm text-muted-foreground">
                Sugerencias proactivas que tu IA detectó. Tú decides qué hacer.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5 mr-2", loading && "animate-spin")} />
            Actualizar
          </Button>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {TABS.map((t) => {
            const n = t.id === "all" ? counts.total : counts[t.id];
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "text-xs font-medium px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5",
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-glow"
                    : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-primary/30"
                )}
              >
                {t.label}
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full",
                  active ? "bg-primary-foreground/20" : "bg-muted"
                )}>{n}</span>
              </button>
            );
          })}
        </div>
      </header>

      {source === "fallback" && (
        <div className="mx-6 mt-4 flex items-start gap-2 rounded-lg bg-warning/10 border border-warning/30 px-3 py-2 text-xs text-warning-foreground/90">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-warning" />
          <span>El servicio de IA no respondió. Cuando esté disponible verás aquí tus sugerencias.</span>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-6 max-w-4xl mx-auto">
          {loading && <AiInboxSkeleton rows={5} />}

          {!loading && visible.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-14 w-14 rounded-full bg-success/10 grid place-items-center mb-3">
                <CheckCircle2 className="h-7 w-7 text-success" />
              </div>
              <h3 className="font-semibold text-lg">Todo bajo control</h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-1">
                {tab === "all"
                  ? "No hay sugerencias pendientes. Tu equipo está al día con todos los leads y oportunidades."
                  : "No hay sugerencias en esta categoría ahora mismo."}
              </p>
            </div>
          )}

          <div className="space-y-2">
            {visible.map((it) => {
              const Icon = TYPE_ICON[it.type] ?? Sparkles;
              return (
                <div
                  key={it.id}
                  className={cn(
                    "rounded-xl border p-4 flex items-start gap-3 group transition-all hover:shadow-md",
                    SEVERITY_RING[it.severity]
                  )}
                >
                  <div className="h-9 w-9 rounded-lg bg-card border border-border grid place-items-center shrink-0">
                    <Icon className="h-4 w-4 text-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("h-1.5 w-1.5 rounded-full", SEVERITY_DOT[it.severity])} />
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {SEVERITY_LABEL[it.severity]}
                      </span>
                      <span className="font-semibold text-sm truncate">{it.title}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{it.description}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" onClick={() => runAction(it.action)} className="h-8">
                      {it.action.label}
                      <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      className="h-8 px-2 text-muted-foreground"
                      onClick={() => dismiss(it.id)}
                      title="Descartar"
                    >
                      ✕
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

/** Hook reusable para mostrar el contador en el sidebar. */
export function useAiInboxCount() {
  const [count, setCount] = useState<number>(0);
  useEffect(() => {
    let mounted = true;
    const dismissed = loadDismissed();
    fetchAiInbox().then((r) => {
      if (!mounted) return;
      setCount(r.suggestions.filter((s) => !dismissed.includes(s.id)).length);
    });
    const t = setInterval(() => {
      fetchAiInbox().then((r) => {
        if (!mounted) return;
        const dis = loadDismissed();
        setCount(r.suggestions.filter((s) => !dis.includes(s.id)).length);
      });
    }, 60_000);
    return () => { mounted = false; clearInterval(t); };
  }, []);
  return count;
}