import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { Loader2, Sparkles } from "lucide-react";

interface Row {
  user_id: string | null;
  actor_label: string | null;
  surface: string;
  total_tokens: number | null;
  iterations: number | null;
}

/** Desglose del consumo de IA del mes en curso.
 *  Cada usuario ve el suyo; admin/dueño del tenant ven el de todo el equipo (lo define RLS). */
export function AiUsageBreakdown({ tenantId }: { tenantId: string }) {
  const { isTenantAdmin } = usePermissions();

  const { data, isLoading } = useQuery({
    queryKey: ["ai-usage-breakdown", tenantId],
    staleTime: 60_000,
    queryFn: async () => {
      const now = new Date();
      const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
      const { data: rows, error } = await supabase
        .from("ai_usage_log")
        .select("user_id, actor_label, surface, total_tokens, iterations")
        .eq("tenant_id", tenantId)
        .gte("created_at", since)
        .limit(5000);
      if (error) throw error;

      const ids = [...new Set((rows ?? []).map((r) => r.user_id).filter(Boolean))] as string[];
      const names: Record<string, string> = {};
      if (ids.length) {
        const { data: profiles } = await supabase
          .from("profiles").select("id, full_name").in("id", ids);
        for (const p of profiles ?? []) names[p.id] = p.full_name ?? "Usuario";
      }

      const map = new Map<string, { name: string; tokens: number; runs: number; web: number; wa: number }>();
      for (const r of (rows ?? []) as Row[]) {
        const key = r.user_id ?? (r.actor_label ? `wa:${r.actor_label}` : "sistema");
        const entry = map.get(key) ?? {
          name: r.user_id
            ? names[r.user_id] ?? "Usuario"
            : r.actor_label
              ? `${r.actor_label} (WhatsApp)`
              : "Automatizaciones / agentes",
          tokens: 0, runs: 0, web: 0, wa: 0,
        };
        entry.tokens += r.total_tokens ?? 0;
        entry.runs += r.iterations ?? 1;
        if (r.surface === "whatsapp") entry.wa += r.iterations ?? 1;
        else entry.web += r.iterations ?? 1;
        map.set(key, entry);
      }
      return [...map.values()].sort((a, b) => b.tokens - a.tokens);
    },
  });

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">
          {isTenantAdmin ? "Consumo de IA por usuario" : "Mi consumo de IA"}
        </h3>
        <span className="text-xs text-muted-foreground ml-auto">Mes en curso</span>
      </div>

      {isLoading ? (
        <div className="py-6 text-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 mx-auto mb-2 animate-spin" /> Cargando consumo...
        </div>
      ) : !data?.length ? (
        <p className="text-sm text-muted-foreground">Aún no hay consumo de IA registrado este mes.</p>
      ) : (
        <div className="divide-y divide-border">
          {data.map((u) => (
            <div key={u.name} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{u.name}</p>
                <p className="text-xs text-muted-foreground">
                  {u.web} en la app · {u.wa} por WhatsApp
                </p>
              </div>
              <Badge variant="secondary">{u.runs.toLocaleString("es-MX")} interacciones</Badge>
              <span className="text-xs text-muted-foreground w-24 text-right">
                {u.tokens.toLocaleString("es-MX")} tokens
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
