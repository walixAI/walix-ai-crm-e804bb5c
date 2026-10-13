import type { ActivityRow } from "@/lib/queries/contacts";
import { summarizeWaActivity } from "@/lib/activities/waSummary";

export function LatestActivity({ activity }: { activity: ActivityRow[] }) {
  const latest = activity.filter(a => a.type !== "task")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  return (
    <section className="border-b border-border pb-4 space-y-2">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase">Última actividad registrada</h3>
      {latest ? <>
        <p className="text-sm whitespace-pre-wrap break-words">{summarizeWaActivity(latest.description, latest.metadata) ?? latest.description}</p>
        <p className="text-xs text-muted-foreground">{new Date(latest.createdAt).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })} · {latest.agent}</p>
      </> : <p className="text-sm text-muted-foreground">Sin actividades registradas.</p>}
    </section>
  );
}