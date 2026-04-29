import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { WBadge } from "@/components/walix/Badge";
import { iconByName } from "@/lib/automations/icons";
import { describeAutomation, timeAgo } from "@/lib/automations/format";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Copy, Trash2, History, FlaskConical } from "lucide-react";
import type { Automation } from "@/lib/queries/automations";

interface Props {
  automation: Automation;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onHistory: () => void;
  onDryRun: () => void;
  disabledToggleReason?: string;
}

export function AutomationCard({
  automation, onToggle, onEdit, onDuplicate, onDelete, onHistory, onDryRun, disabledToggleReason,
}: Props) {
  const Icon = iconByName(automation.icon);
  const [confirming, setConfirming] = useState(false);

  const status = automation.isDraft
    ? { label: "Borrador", variant: "neutral" as const }
    : automation.errorCount > 0 && automation.lastError
    ? { label: "Error", variant: "danger" as const }
    : automation.enabled
    ? { label: "Activa", variant: "success" as const }
    : { label: "Pausada", variant: "neutral" as const };

  const summary = describeAutomation(automation.triggerType, automation.triggerConfig, automation.conditions, automation.actions);

  const handleToggleClick = (next: boolean) => {
    if (!next && automation.runCount > 50) {
      setConfirming(true);
      return;
    }
    onToggle(next);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card hover:shadow-card-hover transition-all flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center shrink-0">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold truncate">{automation.name}</h3>
            {automation.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{automation.description}</p>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover">
            <DropdownMenuItem onClick={onEdit}><Pencil className="h-4 w-4 mr-2" /> Editar</DropdownMenuItem>
            <DropdownMenuItem onClick={onDryRun}><FlaskConical className="h-4 w-4 mr-2" /> Probar (simulación)</DropdownMenuItem>
            <DropdownMenuItem onClick={onHistory}><History className="h-4 w-4 mr-2" /> Ver historial</DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}><Copy className="h-4 w-4 mr-2" /> Duplicar</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-danger focus:text-danger">
              <Trash2 className="h-4 w-4 mr-2" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <p className="text-xs text-muted-foreground italic line-clamp-2">{summary}</p>

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
        <div className="flex items-center gap-2">
          <WBadge variant={status.variant}>{status.label}</WBadge>
          <span className="text-[11px] text-muted-foreground">
            {automation.runCount} ejecuciones · {timeAgo(automation.lastRunAt)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {disabledToggleReason ? (
            <span className="text-[11px] text-warning" title={disabledToggleReason}>{disabledToggleReason}</span>
          ) : null}
          <Switch
            checked={automation.enabled}
            disabled={!!disabledToggleReason && !automation.enabled}
            onCheckedChange={handleToggleClick}
            aria-label="Activar automatización"
          />
        </div>
      </div>

      {confirming && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs">
          <p className="text-foreground font-medium">¿Pausar esta automatización?</p>
          <p className="text-muted-foreground mt-1">Ya tiene {automation.runCount} ejecuciones. No se ejecutará hasta que la reactives.</p>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>Cancelar</Button>
            <Button variant="destructive" size="sm" onClick={() => { setConfirming(false); onToggle(false); }}>Pausar</Button>
          </div>
        </div>
      )}
    </div>
  );
}