import { Clock, User } from "lucide-react";
import type { ActivityRow } from "@/lib/queries/contacts";
import { summarizeWaActivity } from "@/lib/activities/waSummary";

export function LatestActivity({ activity }: { activity: ActivityRow[] }) {
  const latest = activity.filter(a => a.type !== "task")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-card">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Última actividad registrada</h3>
      {latest ? (
        <div className="space-y-2">
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words line-clamp-4">{summarizeWaActivity(latest.description, latest.metadata) ?? latest.description}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{new Date(latest.createdAt).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</span>
            <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" />{latest.agent || "Sistema"}</span>
          </div>
        </div>
      ) : <p className="text-sm text-muted-foreground">Sin actividades registradas.</p>}
    </section>
  );
}
