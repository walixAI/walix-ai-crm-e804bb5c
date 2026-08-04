import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MessageCircle, Sparkles, ShoppingCart } from "lucide-react";
import { useCreditBalance } from "@/lib/queries/aiModels";
import { usePlanLimits } from "@/lib/queries/planLimits";
import { WHATSAPP_PACKS, AI_PACKS, formatMXN, type CreditPack } from "@/lib/plans";
import { toast } from "sonner";

export function CreditsCard({ tenantId, plan }: { tenantId: string; plan: string }) {
  const { data: balance } = useCreditBalance(tenantId);
  const { data: limits } = usePlanLimits();
  const limit = limits?.[plan];

  const waIncluded = balance?.whatsapp_included ?? limit?.whatsapp_credits ?? 0;
  const waExtra = balance?.whatsapp_purchased ?? 0;
  const waUsed = balance?.whatsapp_used ?? 0;
  const aiIncluded = balance?.ai_included ?? limit?.ai_credits ?? 0;
  const aiExtra = balance?.ai_purchased ?? 0;
  const aiUsed = Number(balance?.ai_used ?? 0);

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <CreditBlock
        icon={MessageCircle}
        title="Créditos WhatsApp"
        hint="1 crédito = 1 mensaje de plantilla fuera de la ventana de 24 h. Las respuestas dentro de la ventana no consumen créditos."
        used={waUsed}
        included={waIncluded}
        extra={waExtra}
        packs={WHATSAPP_PACKS}
      />
      <CreditBlock
        icon={Sparkles}
        title="Créditos de IA"
        hint="1 crédito = 1 acción del Copiloto o de un agente IA. Los modelos avanzados consumen más créditos por acción."
        used={aiUsed}
        included={aiIncluded}
        extra={aiExtra}
        packs={AI_PACKS}
      />
    </div>
  );
}

function CreditBlock({
  icon: Icon, title, hint, used, included, extra, packs,
}: {
  icon: typeof MessageCircle; title: string; hint: string;
  used: number; included: number; extra: number; packs: CreditPack[];
}) {
  const total = included + extra;
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-primary/10 grid place-items-center">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>

      <div>
        <div className="flex items-end justify-between mb-1.5">
          <span className="text-2xl font-bold">{Math.max(0, total - used).toLocaleString("es-MX")}</span>
          <span className="text-xs text-muted-foreground">
            disponibles de {total.toLocaleString("es-MX")}
          </span>
        </div>
        <Progress value={pct} className="h-2" />
        <p className="text-xs text-muted-foreground mt-1.5">
          {included.toLocaleString("es-MX")} incluidos en el plan
          {extra > 0 ? ` · ${extra.toLocaleString("es-MX")} comprados` : ""}
        </p>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">{hint}</p>

      <div className="space-y-1.5 pt-1 border-t border-border">
        <p className="text-xs font-medium text-muted-foreground pt-2">Paquetes adicionales</p>
        {packs.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-2">
            <span className="text-sm">{p.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{formatMXN(p.price)}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => toast.info("Solicitud enviada", { description: `Soporte Walix activará tu paquete de ${p.label}.` })}
              >
                <ShoppingCart className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
