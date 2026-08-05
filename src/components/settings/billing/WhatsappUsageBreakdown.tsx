import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MessageCircle } from "lucide-react";

/** Desglose de créditos de WhatsApp del mes, atribuidos al usuario que atendió la conversación. */
export function WhatsappUsageBreakdown({ tenantId }: { tenantId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["wa-usage-breakdown", tenantId],
    staleTime: 60_000,
    queryFn: async () => {
      const now = new Date();
      const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

      const { data: billing, error } = await supabase
        .from("whatsapp_conversation_billing")
        .select("conversation_id, category, credits_charged, created_at")
        .eq("tenant_id", tenantId)
        .gte("created_at", since)
        .limit(5000);
      if (error) throw error;
      if (!billing?.length) return [];

      const convIds = [...new Set(billing.map((b) => b.conversation_id).filter(Boolean))] as string[];

      // Quién envió mensajes salientes en esas conversaciones este mes
      const owner: Record<string, string> = {};
      if (convIds.length) {
        const { data: msgs } = await supabase
          .from("messages")
          .select("conversation_id, sent_by_user_id, created_at")
          .in("conversation_id", convIds)
          .eq("direction", "outbound")
          .gte("created_at", since)
          .order("created_at", { ascending: true })
          .limit(5000);
        for (const m of msgs ?? []) {
          if (m.sent_by_user_id && m.conversation_id && !owner[m.conversation_id]) {
            owner[m.conversation_id] = m.sent_by_user_id;
          }
        }
      }

      const ids = [...new Set(Object.values(owner))];
      const names: Record<string, string> = {};
      if (ids.length) {
        const { data: profiles } = await supabase
          .from("profiles").select("id, full_name").in("id", ids);
        for (const p of profiles ?? []) names[p.id] = p.full_name ?? "Usuario";
      }

      const map = new Map<string, { name: string; credits: number; convs: number }>();
      for (const b of billing) {
        const uid = b.conversation_id ? owner[b.conversation_id] : undefined;
        const key = uid ?? "automatico";
        const entry = map.get(key) ?? {
          name: uid ? names[uid] ?? "Usuario" : "Automático / entrantes",
          credits: 0, convs: 0,
        };
        entry.credits += Number(b.credits_charged ?? 0);
        entry.convs += 1;
        map.set(key, entry);
      }
      return [...map.values()].sort((a, b) => b.credits - a.credits);
    },
  });

  const total = (data ?? []).reduce((s, u) => s + u.credits, 0);

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Créditos de WhatsApp por usuario</h3>
        <span className="text-xs text-muted-foreground ml-auto">Mes en curso</span>
      </div>

      {isLoading ? (
        <div className="py-6 text-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 mx-auto mb-2 animate-spin" /> Cargando consumo...
        </div>
      ) : !data?.length ? (
        <p className="text-sm text-muted-foreground">Aún no hay conversaciones cobradas este mes.</p>
      ) : (
        <>
          <div className="divide-y divide-border">
            {data.map((u) => (
              <div key={u.name} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{u.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {u.convs.toLocaleString("es-MX")} conversaciones cobradas
                  </p>
                </div>
                <Badge variant="secondary">
                  {u.credits.toLocaleString("es-MX", { maximumFractionDigits: 2 })} créditos
                </Badge>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Total del mes: {total.toLocaleString("es-MX", { maximumFractionDigits: 2 })} créditos
          </p>
        </>
      )}
    </Card>
  );
}
