import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ShieldCheck, X, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/lib/queries/tenant";
import { Button } from "@/components/ui/button";

const KIND_LABEL: Record<string, string> = {
  web_domain: "dominio", meta_form: "formulario", meta_ad_account: "cuenta de Meta", google_ads_account: "cuenta de Google Ads",
};

interface Row { id: string; reason: string; rule_kind: string | null; rule_value: string | null; name: string | null; phone: string | null; email: string | null; created_at: string }

export function RejectedLeadsCard() {
  const { data: tenantId } = useTenantId();
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["rejected-leads", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase.from("rejected_leads")
        .select("id, reason, rule_kind, rule_value, name, phone, email, created_at")
        .eq("tenant_id", tenantId!).eq("status", "pending").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const act = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "accept" | "authorize" | "dismiss" }) => {
      const { data, error } = await supabase.functions.invoke("rejected-lead-action", { body: { id, action } });
      if (error || data?.error) throw new Error(data?.error ?? "No se pudo completar la acción");
      return action;
    },
    onSuccess: (a) => {
      toast.success(a === "dismiss" ? "Lead descartado" : a === "authorize" ? "Fuente autorizada y lead aceptado" : "Lead aceptado");
      qc.invalidateQueries({ queryKey: ["rejected-leads", tenantId] });
      qc.invalidateQueries({ queryKey: ["lead-source-rules", tenantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          Leads rechazados {rows.length > 0 && <span className="rounded-full bg-destructive/10 text-destructive px-2 text-xs">{rows.length}</span>}
        </h3>
        <p className="text-xs text-muted-foreground">
          Leads que llegaron con tu llave pero no coinciden con tus fuentes de ingreso. Acéptalos o autoriza su fuente para que los siguientes entren solos.
        </p>
      </div>
      <div className="divide-y divide-border">
        {rows.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No hay leads rechazados.</div>}
        {rows.map((r) => (
          <div key={r.id} className="p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-56">
              <div className="text-sm font-medium">{r.name || r.phone || r.email || "Sin nombre"}</div>
              <div className="text-xs text-muted-foreground">
                {[r.phone, r.email].filter(Boolean).join(" · ")} · {new Date(r.created_at).toLocaleString("es-MX")}
              </div>
              <div className="text-xs text-warning flex items-center gap-1 mt-1"><AlertTriangle className="h-3 w-3" />{r.reason}</div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={act.isPending} onClick={() => act.mutate({ id: r.id, action: "accept" })}>
                <Check className="h-4 w-4" /> Aceptar
              </Button>
              {r.rule_kind && r.rule_value && (
                <Button size="sm" disabled={act.isPending} onClick={() => act.mutate({ id: r.id, action: "authorize" })}>
                  <ShieldCheck className="h-4 w-4" /> Autorizar {KIND_LABEL[r.rule_kind] ?? "fuente"}
                </Button>
              )}
              <Button size="icon" variant="ghost" aria-label="Descartar" disabled={act.isPending} onClick={() => act.mutate({ id: r.id, action: "dismiss" })}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
