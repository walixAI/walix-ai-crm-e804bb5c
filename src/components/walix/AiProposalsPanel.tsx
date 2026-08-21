import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Sparkles, ChevronDown, Wrench, Clock, Phone, CalendarClock, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  useAiProposals, useAcceptProposal, useRejectProposal, useMarkProposalsSeen,
  type AiProposal,
} from "@/lib/queries/aiProposals";

const STORAGE_KEY = "walix.aiProposals.open";

function iconFor(p: AiProposal) {
  switch (p.payload.icon) {
    case "wrench": return Wrench;
    case "phone": return Phone;
    case "calendar": return CalendarClock;
    case "clock":
    default: return Clock;
  }
}

interface Props {
  /** "panel" = barra colapsable (Mi Día). "list" = siempre desplegado (pestaña de Tareas). */
  variant?: "panel" | "list";
}

export function AiProposalsPanel({ variant = "panel" }: Props) {
  const { data: proposals = [], isLoading } = useAiProposals();
  const accept = useAcceptProposal();
  const reject = useRejectProposal();
  const markSeen = useMarkProposalsSeen();
  const [params] = useSearchParams();

  const forceOpen = params.get("proposals") === "open";
  const [open, setOpen] = useState<boolean>(() => {
    if (variant === "list") return true;
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
  });

  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  const unseenIds = useMemo(
    () => proposals.filter((p) => p.isNew).map((p) => p.id),
    [proposals],
  );
  const hasNew = unseenIds.length > 0;

  useEffect(() => {
    if (open && unseenIds.length) markSeen.mutate(unseenIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, unseenIds.join(",")]);

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (variant === "panel") {
      try { localStorage.setItem(STORAGE_KEY, v ? "1" : "0"); } catch { /* noop */ }
    }
  };

  if (isLoading || proposals.length === 0) {
    if (variant === "list" && !isLoading) {
      return (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Sparkles className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No hay propuestas de Walix IA por revisar.</p>
        </div>
      );
    }
    return null;
  }

  const rows = (
    <div className="divide-y divide-border/70">
      {proposals.map((p) => {
        const Icon = iconFor(p);
        return (
          <div key={p.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <div className="h-9 w-9 shrink-0 rounded-lg bg-primary/10 grid place-items-center">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{p.text}</div>
              {p.payload.subtitle && (
                <div className="text-xs text-muted-foreground truncate">{p.payload.subtitle}</div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                disabled={accept.isPending}
                onClick={() =>
                  accept.mutate(p, {
                    onSuccess: () => toast.success("Tarea creada"),
                    onError: (e: any) => toast.error(e?.message ?? "No se pudo crear la tarea"),
                  })
                }
              >
                <Check className="h-4 w-4 mr-1" /> Aceptar
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={reject.isPending}
                onClick={() =>
                  reject.mutate(p.id, {
                    onSuccess: () => toast("Propuesta descartada"),
                    onError: (e: any) => toast.error(e?.message ?? "Error"),
                  })
                }
              >
                <X className="h-4 w-4 mr-1" /> Rechazar
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );

  if (variant === "list") {
    return <div className="rounded-xl border border-border bg-card p-4 shadow-card">{rows}</div>;
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={handleOpenChange}
      className={cn(
        "rounded-xl border border-border border-l-4 border-l-primary bg-primary/5 dark:bg-primary/10 shadow-card",
        forceOpen && "ring-2 ring-primary/40",
      )}
    >
      <CollapsibleTrigger className="w-full flex items-center gap-3 px-4 py-3 text-left">
        <Sparkles className="h-4 w-4 text-primary shrink-0" />
        <span className="font-semibold text-sm">Propuestas de Walix IA</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
          {hasNew && <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />}
          {hasNew ? `${unseenIds.length} nuevas` : proposals.length}
        </span>
        <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          {open ? "Ocultar" : "Ver"}
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4">{rows}</CollapsibleContent>
    </Collapsible>
  );
}
