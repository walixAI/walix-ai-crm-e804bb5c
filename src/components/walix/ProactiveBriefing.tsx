import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Sparkles, MessageCircle, BarChart3, ClipboardList, Bell, AlertTriangle, X, ArrowRight,
} from "lucide-react";
import { useProactiveSuggestions } from "@/hooks/useAiMemory";
import { relativeTime } from "@/lib/format/relativeTime";
import { cn } from "@/lib/utils";
import type { ProactiveSuggestion } from "@/services/aiMemory";

function actionMeta(actionType: string | null) {
  switch (actionType) {
    case "send_whatsapp":
      return { Icon: MessageCircle, label: "💬 Abrir chat", color: "text-success" };
    case "move_deal":
      return { Icon: BarChart3, label: "📊 Mover deal", color: "text-primary" };
    case "create_task":
      return { Icon: ClipboardList, label: "📋 Crear tarea", color: "text-warning" };
    case "schedule_followup":
      return { Icon: Bell, label: "🔔 Recordarme", color: "text-accent" };
    default:
      return { Icon: AlertTriangle, label: "Ver detalle", color: "text-muted-foreground" };
  }
}

function urgencyColor(priority: number) {
  if (priority >= 8) return "bg-destructive";
  if (priority >= 4) return "bg-warning";
  return "bg-success";
}

function entityHref(s: ProactiveSuggestion): string | null {
  if (!s.entity_id) return null;
  switch (s.entity_type) {
    case "contact": return `/contacts/${s.entity_id}`;
    case "deal": return `/pipeline?dealId=${s.entity_id}`;
    case "conversation": return `/whatsapp?conversationId=${s.entity_id}`;
    default: return null;
  }
}

export function ProactiveBriefing() {
  const navigate = useNavigate();
  const { data: suggestions = [], actOn, dismiss } = useProactiveSuggestions();
  const top = suggestions.slice(0, 5);

  const lastUpdate = top[0]?.created_at;

  return (
    <div
      id="proactive-briefing"
      className="rounded-xl border border-border border-l-4 border-l-primary bg-primary/5 dark:bg-primary/10 p-5 shadow-card flex flex-col"
    >
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-primary" />
          Tu briefing de hoy
        </h3>
        {lastUpdate && (
          <span className="text-[10px] text-muted-foreground">
            Actualizado {relativeTime(lastUpdate)}
          </span>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground mb-4">
        Gemini 2.5 Flash · {suggestions.length} sugerencia{suggestions.length === 1 ? "" : "s"} activa{suggestions.length === 1 ? "" : "s"}
      </p>

      <div className="space-y-3 flex-1">
        {top.map((s) => {
          const meta = actionMeta(s.action_type);
          const href = entityHref(s);
          const handleAction = () => {
            actOn(s.id);
            toast.success("Acción registrada");
            if (href) navigate(href);
          };
          return (
            <div
              key={s.id}
              className="rounded-lg bg-card border border-border p-3 hover:border-primary/40 transition-colors relative"
            >
              <button
                onClick={() => dismiss(s.id)}
                className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                aria-label="Descartar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <div className="flex items-start gap-2 mb-2 pr-5">
                <meta.Icon className={cn("h-4 w-4 shrink-0 mt-0.5", meta.color)} />
                <p className="text-sm leading-snug text-foreground line-clamp-2 flex-1">
                  {s.suggestion_text}
                </p>
              </div>
              <div className="h-1 w-full rounded-full bg-muted mb-2 overflow-hidden">
                <div
                  className={cn("h-full transition-all", urgencyColor(s.priority))}
                  style={{ width: `${Math.min(100, s.priority * 10)}%` }}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                {href ? (
                  <button
                    onClick={() => navigate(href)}
                    className="text-[11px] text-muted-foreground hover:text-primary truncate"
                  >
                    Ver {s.entity_type}
                  </button>
                ) : <span />}
                <button
                  onClick={handleAction}
                  className="text-xs font-semibold text-primary inline-flex items-center gap-1 hover:gap-1.5 transition-all"
                >
                  {meta.label} <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}
        {top.length === 0 && (
          <div className="text-xs text-muted-foreground italic">
            Sin sugerencias activas. La IA está observando…
          </div>
        )}
      </div>
    </div>
  );
}