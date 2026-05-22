import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { relativeTime } from "@/lib/format/relativeTime";

interface WebhookLogRow {
  id: string;
  received_at: string;
  phone_number_id: string | null;
  matched_channel_id: string | null;
  kind: "verify" | "message" | "status" | "unknown";
  payload: unknown;
  note: string | null;
}

export function WebhookDiagnosticsPanel({ tenantId }: { tenantId: string }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: rows = [], refetch, isFetching } = useQuery({
    queryKey: ["wa-webhook-log", tenantId],
    enabled: open,
    refetchInterval: open ? 5000 : false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_webhook_log")
        .select("*")
        .order("received_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as WebhookLogRow[];
    },
  });

  const lastHit = rows[0]?.received_at;
  const recent = lastHit && Date.now() - new Date(lastHit).getTime() < 5 * 60_000;

  return (
    <Card className="p-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <h3 className="text-sm font-semibold">Diagnóstico del webhook</h3>
          {open && (recent
            ? <span className="inline-flex items-center gap-1 text-xs text-success"><CheckCircle2 className="h-3 w-3" /> hits recientes</span>
            : <span className="inline-flex items-center gap-1 text-xs text-warning"><AlertTriangle className="h-3 w-3" /> sin hits recientes</span>
          )}
        </div>
        {open && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); refetch(); }}
            disabled={isFetching}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${isFetching ? "animate-spin" : ""}`} /> Refrescar
          </Button>
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {!recent && (
            <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-xs space-y-1">
              <p className="font-medium text-warning flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Meta no ha llamado al webhook en los últimos 5 minutos.
              </p>
              <p className="text-muted-foreground">Revisa en Meta App Dashboard:</p>
              <ol className="list-decimal pl-5 text-muted-foreground space-y-0.5">
                <li>WhatsApp → Configuration → sección Webhook → fila <span className="font-mono">messages</span> debe estar <b>Subscribed</b>.</li>
                <li>WhatsApp → API Setup → selecciona tu número → debe aparecer <b>Subscribed</b> a esta app.</li>
                <li>Si usas número de prueba, el remitente debe estar en la lista "To" (Allowed recipients).</li>
              </ol>
            </div>
          )}

          {rows.length === 0 && (
            <p className="text-xs text-muted-foreground py-4 text-center">
              Sin registros aún. Envía un WhatsApp al número conectado y aparecerá aquí.
            </p>
          )}

          <div className="space-y-1.5">
            {rows.map((r) => (
              <div key={r.id} className="rounded-md border border-border text-xs">
                <button
                  className="w-full flex items-center gap-2 p-2 text-left hover:bg-muted/40"
                  onClick={() => setExpanded((id) => id === r.id ? null : r.id)}
                >
                  <span className={
                    r.kind === "message" ? "px-1.5 py-0.5 rounded bg-success/15 text-success font-medium" :
                    r.kind === "status" ? "px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium" :
                    r.kind === "verify" ? "px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium" :
                    "px-1.5 py-0.5 rounded bg-warning/15 text-warning font-medium"
                  }>{r.kind}</span>
                  <span className="text-muted-foreground">{relativeTime(r.received_at)}</span>
                  {r.phone_number_id && <span className="font-mono text-muted-foreground">PNID {r.phone_number_id}</span>}
                  {!r.matched_channel_id && r.kind !== "verify" && (
                    <span className="text-warning">sin match</span>
                  )}
                  <span className="ml-auto text-muted-foreground truncate max-w-xs">{r.note}</span>
                </button>
                {expanded === r.id && (
                  <pre className="p-2 border-t border-border bg-muted/30 overflow-x-auto text-[10px] leading-relaxed max-h-64">
                    {JSON.stringify(r.payload, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}