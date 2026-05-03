import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface TourStep {
  /** CSS selector of the element to highlight. If null → centered modal. */
  target: string | null;
  title: string;
  description: string;
  /** Preferred placement. Auto-flips if no space. */
  placement?: "right" | "bottom" | "left" | "top" | "center";
}

const STEPS: TourStep[] = [
  {
    target: null,
    placement: "center",
    title: "Bienvenido a Walix.ai 👋",
    description:
      "Te llevo en un tour rápido (menos de 1 minuto) por las funciones que más vas a usar. Puedes saltar cuando quieras.",
  },
  {
    target: '[data-tour="nav-dashboard"]',
    placement: "right",
    title: "Dashboard",
    description:
      "Tu vista de mando: KPIs en vivo, salud del pipeline, oportunidades a cerrar y un resumen ejecutivo generado por IA cada día.",
  },
  {
    target: '[data-tour="nav-ai-inbox"]',
    placement: "right",
    title: "AI Inbox",
    description:
      "Tu IA analiza tu CRM y te entrega sugerencias accionables: leads calientes, oportunidades en riesgo, mensajes sin responder. Todo en un solo lugar.",
  },
  {
    target: '[data-tour="nav-pipeline"]',
    placement: "right",
    title: "Pipeline",
    description:
      "Tablero Kanban con drag & drop, scoring IA por oportunidad e insights de oportunidades estancadas. La IA te dice qué oportunidad mover y qué hacer.",
  },
  {
    target: '[data-tour="nav-whatsapp"]',
    placement: "right",
    title: "WhatsApp integrado",
    description:
      "Conversaciones reales con tus contactos. La IA te sugiere respuestas, resume hilos y te ayuda a no perder oportunidades.",
  },
  {
    target: '[data-tour="ai-prompt"]',
    placement: "bottom",
    title: "Pregunta a tu IA",
    description:
      'Pregunta lo que quieras: "¿Cuáles son mis oportunidades más calientes?", "Dame el resumen del día". Atajo: ⌘K para abrir el buscador rápido.',
  },
  {
    target: null,
    placement: "center",
    title: "¡Listo para vender más! 🚀",
    description:
      "Eso es todo. Recuerda: la IA no decide por ti, te ayuda a decidir mejor. Si quieres revisar el tour de nuevo, está en tu menú de perfil.",
  },
];

const TOUR_KEY_PREFIX = "walix.tour.completed.v1.";

function tourKey(userId: string | undefined) {
  return `${TOUR_KEY_PREFIX}${userId ?? "anon"}`;
}

export function hasCompletedTour(userId: string | undefined) {
  try {
    return localStorage.getItem(tourKey(userId)) === "1";
  } catch {
    return true; // fail-safe: don't pester user if storage broken
  }
}

export function markTourCompleted(userId: string | undefined) {
  try { localStorage.setItem(tourKey(userId), "1"); } catch { /* ignore */ }
}

export function resetTour(userId: string | undefined) {
  try { localStorage.removeItem(tourKey(userId)); } catch { /* ignore */ }
}

interface Rect { top: number; left: number; width: number; height: number; }

export function OnboardingTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const step = STEPS[stepIndex];

  // Reset when reopened
  useEffect(() => {
    if (open) setStepIndex(0);
  }, [open]);

  // Position spotlight on current step's target
  useLayoutEffect(() => {
    if (!open) return;
    if (!step.target) { setRect(null); return; }
    const update = () => {
      const el = document.querySelector(step.target!) as HTMLElement | null;
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      // make sure target is visible
      el.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const t = setInterval(update, 400); // re-sync in case of layout shift
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      clearInterval(t);
    };
  }, [open, step.target]);

  if (!open) return null;

  const isLast = stepIndex === STEPS.length - 1;
  const isFirst = stepIndex === 0;

  const handleNext = () => {
    if (isLast) {
      onClose();
    } else {
      setStepIndex((i) => i + 1);
    }
  };
  const handlePrev = () => setStepIndex((i) => Math.max(0, i - 1));

  // Compute tooltip position
  const tooltipStyle: React.CSSProperties = (() => {
    const PAD = 12;
    const W = 340;
    if (!rect || step.placement === "center") {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: W,
      };
    }
    const placement = step.placement ?? "right";
    if (placement === "right") {
      return {
        top: Math.max(16, rect.top + rect.height / 2 - 80),
        left: Math.min(window.innerWidth - W - 16, rect.left + rect.width + PAD),
        width: W,
      };
    }
    if (placement === "bottom") {
      return {
        top: rect.top + rect.height + PAD,
        left: Math.max(16, Math.min(window.innerWidth - W - 16, rect.left + rect.width / 2 - W / 2)),
        width: W,
      };
    }
    if (placement === "left") {
      return {
        top: Math.max(16, rect.top + rect.height / 2 - 80),
        left: Math.max(16, rect.left - W - PAD),
        width: W,
      };
    }
    return {
      top: Math.max(16, rect.top - 16 - 160),
      left: Math.max(16, Math.min(window.innerWidth - W - 16, rect.left + rect.width / 2 - W / 2)),
      width: W,
    };
  })();

  return createPortal(
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Tour de bienvenida"
    >
      {/* Spotlight overlay using SVG mask for a clean cutout */}
      <svg className="absolute inset-0 w-full h-full pointer-events-auto" onClick={onClose}>
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.left - 6}
                y={rect.top - 6}
                width={rect.width + 12}
                height={rect.height + 12}
                rx={12}
                ry={12}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(2, 6, 23, 0.72)" mask="url(#tour-mask)" />
        {rect && (
          <rect
            x={rect.left - 6}
            y={rect.top - 6}
            width={rect.width + 12}
            height={rect.height + 12}
            rx={12}
            ry={12}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            className="animate-pulse"
          />
        )}
      </svg>

      {/* Tooltip card */}
      <div
        className={cn(
          "absolute rounded-xl border border-border bg-card shadow-2xl p-5 animate-in fade-in slide-in-from-bottom-2",
        )}
        style={tooltipStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-brand grid place-items-center text-primary-foreground shadow-glow">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {stepIndex + 1} de {STEPS.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors -mt-1 -mr-1 p-1"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h3 className="font-semibold text-base text-foreground">{step.title}</h3>
        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{step.description}</p>

        {/* Progress bar */}
        <div className="mt-4 h-1 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-gradient-brand transition-all duration-300"
            style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground">
            Saltar tour
          </Button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button variant="outline" size="sm" onClick={handlePrev} className="gap-1">
                <ArrowLeft className="h-3.5 w-3.5" /> Atrás
              </Button>
            )}
            <Button size="sm" onClick={handleNext} className="bg-gradient-brand hover:opacity-90 text-primary-foreground gap-1.5">
              {isLast ? (<><Check className="h-3.5 w-3.5" /> Empezar</>) : (<>Siguiente <ArrowRight className="h-3.5 w-3.5" /></>)}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Hook to auto-launch the tour on first login. */
export function useAutoOnboardingTour() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (hasCompletedTour(user.id)) return;
    // Wait a beat so the layout (sidebar) is mounted before we try to spotlight elements.
    const t = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(t);
  }, [user?.id]);

  const close = useMemo(() => () => {
    setOpen(false);
    markTourCompleted(user?.id);
  }, [user?.id]);

  const start = () => setOpen(true);

  return { open, close, start };
}