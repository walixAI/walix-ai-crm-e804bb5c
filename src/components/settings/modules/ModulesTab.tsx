import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { WBadge } from "@/components/walix/Badge";
import { Sparkles, Zap, MessageCircle, BarChart3, Store, Bot } from "lucide-react";

const MODULES = [
  { id: "ai", name: "IA conversacional", desc: "Resúmenes, sugerencias y respuestas asistidas.", icon: Sparkles, on: true, planLock: false },
  { id: "automations", name: "Automatizaciones", desc: "Triggers y acciones sin código.", icon: Zap, on: true, planLock: false },
  { id: "whatsapp", name: "WhatsApp Business", desc: "Bandeja unificada multiagente.", icon: MessageCircle, on: true, planLock: false },
  { id: "reports", name: "Reportes avanzados", desc: "Embudo, conversiones y heatmaps.", icon: BarChart3, on: true, planLock: false },
  { id: "marketplace", name: "Marketplace", desc: "Pagos, envíos e integraciones verticales.", icon: Store, on: false, planLock: true },
  { id: "ai-agent", name: "Agente IA 24/7", desc: "Responde leads automáticamente fuera de horario.", icon: Bot, on: false, planLock: true },
];

export function ModulesTab() {
  return (
    <div className="space-y-4">
      <Card className="p-5 bg-muted/30 border-dashed">
        <p className="text-sm text-muted-foreground">
          Activa o pausa módulos de tu instancia. La configuración detallada de cada módulo se gestiona dentro del propio módulo.
        </p>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {MODULES.map((m) => (
          <Card key={m.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center">
                  <m.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{m.name}</h3>
                    {m.planLock && <WBadge variant="warning">Plan Growth+</WBadge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{m.desc}</p>
                </div>
              </div>
              <Switch defaultChecked={m.on} disabled={m.planLock} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}