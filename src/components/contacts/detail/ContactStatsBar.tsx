import { ContactStats } from "@/mock/contacts";

interface Props { stats: ContactStats }

export function ContactStatsBar({ stats }: Props) {
  const items = [
    { label: "Pipeline", value: `$${stats.pipelineValue.toLocaleString("es-MX")}`, accent: "text-foreground" },
    { label: "Probabilidad", value: `${stats.probability}%`, accent: "text-primary" },
    { label: "Última conv.", value: stats.lastContactRelative, accent: "text-foreground" },
    { label: "Cliente desde", value: stats.customerSince, accent: "text-foreground" },
  ];
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-3 flex items-center gap-6 text-sm overflow-x-auto shadow-card">
      {items.map((it, idx) => (
        <div key={it.label} className="flex items-center gap-6 shrink-0">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{it.label}</div>
            <div className={`font-bold text-base ${it.accent}`}>{it.value}</div>
          </div>
          {idx < items.length - 1 && <div className="h-8 w-px bg-border" />}
        </div>
      ))}
    </div>
  );
}