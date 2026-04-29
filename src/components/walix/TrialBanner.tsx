import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/lib/queries/tenant";
import { Sparkles, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export function TrialBanner() {
  const { data: tenantId } = useTenantId();
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    setDismissed(sessionStorage.getItem("walix.trial.dismissed"));
  }, []);

  const { data } = useQuery({
    queryKey: ["tenant-trial", tenantId],
    enabled: !!tenantId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("tenants")
        .select("plan, trial_ends_at")
        .eq("id", tenantId!)
        .maybeSingle();
      return data as { plan: string; trial_ends_at: string | null } | null;
    },
  });

  if (!data || !data.trial_ends_at) return null;
  if (data.plan === "starter") return null; // sin trial activo
  if (dismissed === data.trial_ends_at) return null;

  const ends = new Date(data.trial_ends_at);
  const now = new Date();
  const msLeft = ends.getTime() - now.getTime();
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

  // Solo mostramos si quedan ≤ 7 días o ya expiró
  if (daysLeft > 7) return null;

  const expired = msLeft <= 0;
  const Icon = expired ? AlertTriangle : Sparkles;

  const dismiss = () => {
    sessionStorage.setItem("walix.trial.dismissed", data.trial_ends_at!);
    setDismissed(data.trial_ends_at);
  };

  return (
    <div
      className={
        "px-4 md:px-6 py-2.5 flex items-center justify-between gap-3 text-sm border-b " +
        (expired
          ? "bg-destructive/10 border-destructive/30 text-destructive"
          : daysLeft <= 3
          ? "bg-warning/10 border-warning/30 text-warning"
          : "bg-primary/10 border-primary/30 text-primary")
      }
    >
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate font-medium">
          {expired
            ? `Tu prueba terminó. Tu cuenta se moverá al plan Starter pronto.`
            : daysLeft === 1
            ? `Última oportunidad: tu prueba termina hoy.`
            : `Te quedan ${daysLeft} días de prueba en plan ${data.plan.toUpperCase()}.`}
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button asChild size="sm" variant={expired ? "destructive" : "default"} className="h-7 text-xs">
          <Link to="/pricing">{expired ? "Reactivar" : "Elegir plan"}</Link>
        </Button>
        <button onClick={dismiss} className="p-1 rounded hover:bg-foreground/10" aria-label="Cerrar">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}