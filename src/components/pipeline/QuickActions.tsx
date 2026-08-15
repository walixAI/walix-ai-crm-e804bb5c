import { useState } from "react";
import { CheckCircle2, MessageSquare, Plus, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  useUpdateDeal, type PipelineDeal, type PipelineStage,
} from "@/lib/queries/pipeline";
import { WonDateDialog } from "./WonDateDialog";

interface Props {
  deal: PipelineDeal;
  stages: PipelineStage[];
  onRequestLost: (deal: PipelineDeal) => void;
  onNewTask: (deal: PipelineDeal) => void;
}

export function QuickActions({ deal, stages, onRequestLost, onNewTask }: Props) {
  const navigate = useNavigate();
  const update = useUpdateDeal();
  const [wonOpen, setWonOpen] = useState(false);

  if (deal.isWon || deal.isLost) return null;

  const wonStage = stages.find((s) => s.isWon);

  function markWon(e: React.MouseEvent) {
    e.stopPropagation();
    if (!wonStage) return toast.error("Falta etapa de ganado");
    setWonOpen(true);
  }

  return (
    <TooltipProvider delayDuration={150}>
      <WonDateDialog deal={deal} stage={wonStage ?? null} open={wonOpen} onOpenChange={setWonOpen} />
      <div
        className={cn(
          "absolute top-2 right-2 z-10 flex items-center gap-0.5 rounded-md bg-card border border-border shadow-sm p-0.5",
          "opacity-0 group-hover:opacity-100 transition-opacity",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <Action
          label="WhatsApp"
          icon={<MessageSquare className="h-3.5 w-3.5" />}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/inbox${deal.contactId ? `?contact=${deal.contactId}` : ""}`);
          }}
          className="text-success"
        />
        <Action
          label="Marcar ganado"
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          onClick={markWon}
          className="text-success"
        />
        <Action
          label="Marcar perdido"
          icon={<XCircle className="h-3.5 w-3.5" />}
          onClick={(e) => {
            e.stopPropagation();
            onRequestLost(deal);
          }}
          className="text-danger"
        />
        <Action
          label="Nueva tarea"
          icon={<Plus className="h-3.5 w-3.5" />}
          onClick={(e) => {
            e.stopPropagation();
            onNewTask(deal);
          }}
          className="text-primary"
        />
      </div>
    </TooltipProvider>
  );
}

function Action({
  label, icon, onClick, className,
}: { label: string; icon: React.ReactNode; onClick: (e: React.MouseEvent) => void; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className={cn("h-6 w-6 grid place-items-center rounded hover:bg-muted", className)}
          aria-label={label}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">{label}</TooltipContent>
    </Tooltip>
  );
}