import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, Download, FileText, StickyNote, CheckCircle2, MoveRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { relativeTime } from "@/lib/format/relativeTime";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { useTenantUsers } from "@/lib/queries/tenantUsers";
import {
  useActivityReport, buildActivityCSV, downloadCsvFile, activityTypeLabel,
  type ActivityScope,
} from "@/lib/queries/activityReport";
import { toast } from "sonner";

const activityIcon: Record<string, { icon: typeof MoveRight; color: string }> = {
  deal: { icon: MoveRight, color: "text-primary bg-primary/10" },
  wa_sent: { icon: FileText, color: "text-accent bg-accent/10" },
  wa_received: { icon: FileText, color: "text-success bg-success/10" },
  note: { icon: StickyNote, color: "text-warning bg-warning/10" },
  task: { icon: CheckCircle2, color: "text-success bg-success/10" },
};

type Preset = "7d" | "30d" | "month" | "prev_month" | "custom";

function isoDay(d: Date) { return d.toISOString().slice(0, 10); }

function rangeFor(preset: Preset, customFrom: string, customTo: string) {
  const now = new Date();
  if (preset === "custom") return { from: customFrom, to: customTo };
  if (preset === "month") {
    return { from: isoDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: isoDay(now) };
  }
  if (preset === "prev_month") {
    return {
      from: isoDay(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: isoDay(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
  }
  const days = preset === "7d" ? 7 : 30;
  return { from: isoDay(new Date(Date.now() - days * 86400000)), to: isoDay(now) };
}

export function ActivityReportCard() {
  const { isTenantAdmin, isManager, isPlatform } = usePermissions();
  const canSeeTeam = isTenantAdmin || isManager || isPlatform;
  const { data: users = [] } = useTenantUsers();

  const [preset, setPreset] = useState<Preset>("7d");
  const [customFrom, setCustomFrom] = useState(isoDay(new Date(Date.now() - 30 * 86400000)));
  const [customTo, setCustomTo] = useState(isoDay(new Date()));
  const [scope, setScope] = useState<ActivityScope>(canSeeTeam ? "tenant" : "mine");
  const [userFilter, setUserFilter] = useState<string>("all");

  const { from, to } = rangeFor(preset, customFrom, customTo);
  const fromIso = `${from}T00:00:00.000Z`;
  const toIso = `${to}T23:59:59.999Z`;

  const { data: rows = [], isLoading } = useActivityReport({
    from: fromIso,
    to: toIso,
    scope: canSeeTeam ? scope : "mine",
    userIds: canSeeTeam && scope === "tenant" && userFilter !== "all" ? [userFilter] : undefined,
  });

  const recent = useMemo(() => rows.slice(0, 10), [rows]);

  const handleDownload = () => {
    if (!rows.length) {
      toast.error("No hay actividades en el periodo seleccionado.");
      return;
    }
    downloadCsvFile(`walix-actividades-${from}_a_${to}.csv`, buildActivityCSV(rows));
    toast.success(`${rows.length} actividades exportadas.`);
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-card">
      <div className="flex flex-col gap-3 p-5 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">Actividad Reciente</h3>
            <p className="text-xs text-muted-foreground">
              {isLoading ? "Cargando…" : `${rows.length} actividades del ${from} al ${to}`}
            </p>
          </div>
          <Button size="sm" variant="outline" className="gap-2" onClick={handleDownload}>
            <Download className="h-4 w-4" /> CSV
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
            <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 días</SelectItem>
              <SelectItem value="30d">Últimos 30 días</SelectItem>
              <SelectItem value="month">Mes actual</SelectItem>
              <SelectItem value="prev_month">Mes anterior</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>

          {preset === "custom" && (
            <>
              <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-8 w-[150px] text-xs" />
              <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-8 w-[150px] text-xs" />
            </>
          )}

          {canSeeTeam && (
            <>
              <Select value={scope} onValueChange={(v) => setScope(v as ActivityScope)}>
                <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tenant">Todo el equipo</SelectItem>
                  <SelectItem value="mine">Solo mías</SelectItem>
                </SelectContent>
              </Select>
              {scope === "tenant" && (
                <Select value={userFilter} onValueChange={setUserFilter}>
                  <SelectTrigger className="h-8 w-[180px] text-xs">
                    <Users className="h-3.5 w-3.5 mr-1" /><SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los usuarios</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </>
          )}
        </div>
      </div>

      <div className="divide-y divide-border">
        {recent.map((a) => {
          const meta = activityIcon[a.type] ?? activityIcon.note;
          const ActIcon = meta.icon;
          return (
            <div key={a.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50 transition-colors">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-gradient-brand text-primary-foreground text-xs font-semibold">
                  {a.contactName ? a.contactName.split(" ").map((s) => s[0]).slice(0, 2).join("") : "•"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 text-sm">
                <p className="truncate">
                  <span className="text-muted-foreground">{a.description}</span>
                  {a.contactName && <> · <span className="font-medium text-foreground">{a.contactName}</span></>}
                </p>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                  <Clock className="h-3 w-3" /> {relativeTime(a.occurredAt)}
                  <span>· {activityTypeLabel(a.type)}</span>
                  <span>· {a.userName}</span>
                </div>
              </div>
              <div className={cn("h-7 w-7 grid place-items-center rounded-lg shrink-0", meta.color)}>
                <ActIcon className="h-3.5 w-3.5" />
              </div>
            </div>
          );
        })}
        {!isLoading && rows.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">Sin actividad en el periodo.</div>
        )}
      </div>
      {rows.length > recent.length && (
        <div className="p-3 text-center border-t border-border">
          <span className="text-xs text-muted-foreground">
            Mostrando 10 de {rows.length}. Descarga el CSV para ver todas.
          </span>
        </div>
      )}
      <div className="sr-only"><Link to="/tasks">Tareas</Link></div>
    </div>
  );
}
