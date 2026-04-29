import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, RefreshCw, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  fetchDashboardAiWidgets, AI_MODEL_LABEL, type DashboardAiResponse,
} from "@/services/ai";
import { renderCitations } from "@/lib/ai/citations";

interface Props {
  onSummaryReady?: (plain: string) => void;
}

export function ExecutiveSummaryAI({ onSummaryReady }: Props) {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardAiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const handleCitation = (kind: string, id: string) => {
    if (kind === "deal") navigate(`/pipeline?dealId=${id}`);
    else if (kind === "contact") navigate(`/contacts/${id}`);
    else if (kind === "convo" || kind === "conversation") navigate(`/whatsapp?conversationId=${id}`);
  };

  const load = async () => {
    setLoading(true);
    // includeReport=false: solo necesitamos el executiveSummary (más rápido).
    const res = await fetchDashboardAiWidgets(false);
    setData(res);
    setLoading(false);
    onSummaryReady?.(res.executiveSummary.replace(/\[(deal|contact|conversation|convo):[a-zA-Z0-9-]+\|([^\]]+)\]/g, "$2"));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 grid place-items-center rounded-lg bg-gradient-brand text-primary-foreground shadow-glow">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div>
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Resumen ejecutivo IA
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {data ? `Generado ${new Date(data.generatedAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })} · ${AI_MODEL_LABEL}` : "Generando…"}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="gap-1.5 text-xs">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Regenerar
        </Button>
      </div>

      {loading && !data ? (
        <div className="space-y-2">
          <div className="h-3 rounded bg-muted/60 animate-pulse" />
          <div className="h-3 rounded bg-muted/60 animate-pulse w-11/12" />
          <div className="h-3 rounded bg-muted/60 animate-pulse w-10/12" />
        </div>
      ) : data ? (
        <p className="text-sm leading-relaxed text-foreground">
          {renderCitations(data.executiveSummary, handleCitation)}
        </p>
      ) : null}

      {data?.source === "fallback" && (
        <p className="mt-2 text-[11px] text-muted-foreground italic">Datos de demostración: el servicio IA no respondió.</p>
      )}
    </div>
  );
}