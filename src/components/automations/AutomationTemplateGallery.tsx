import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { WBadge } from "@/components/walix/Badge";
import { TEMPLATES, type AutomationTemplate } from "@/lib/automations/templates";
import { iconByName } from "@/lib/automations/icons";
import { Sparkles, Plus, Bot } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (t: AutomationTemplate) => void;
  onScratch: () => void;
  onAi: () => void;
}

export function AutomationTemplateGallery({ open, onOpenChange, onSelect, onScratch, onAi }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-popover">
        <DialogHeader>
          <DialogTitle>Crear nueva automatización</DialogTitle>
          <DialogDescription>
            Empieza desde una plantilla lista, descríbela en lenguaje natural o constrúyela paso a paso.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          <button onClick={onAi} className="text-left rounded-xl border border-primary/30 bg-primary/5 p-4 hover:border-primary/50 transition-all">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-9 w-9 rounded-lg bg-primary/15 grid place-items-center"><Bot className="h-5 w-5 text-primary" /></div>
              <span className="text-sm font-semibold">Crear con IA</span>
              <WBadge variant="brand">Nuevo</WBadge>
            </div>
            <p className="text-xs text-muted-foreground">Describe en una frase lo que quieres automatizar y la IA arma el flujo por ti.</p>
          </button>

          <button onClick={onScratch} className="text-left rounded-xl border border-border bg-card p-4 hover:border-foreground/20 transition-all">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-9 w-9 rounded-lg bg-muted grid place-items-center"><Plus className="h-5 w-5 text-foreground" /></div>
              <span className="text-sm font-semibold">Empezar desde cero</span>
            </div>
            <p className="text-xs text-muted-foreground">Para usuarios avanzados. Configura cada paso manualmente.</p>
          </button>
        </div>

        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Plantillas listas</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TEMPLATES.map((t) => {
              const Icon = iconByName(t.icon);
              return (
                <button key={t.key} onClick={() => onSelect(t)} className="text-left rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-card-hover transition-all">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 grid place-items-center"><Icon className="h-5 w-5 text-primary" /></div>
                      <span className="text-sm font-semibold">{t.name}</span>
                    </div>
                    {t.recommended && <WBadge variant="brand">Recomendada</WBadge>}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3">{t.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
