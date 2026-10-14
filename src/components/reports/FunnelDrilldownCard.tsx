import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  useFunnelDrilldown, buildDrilldown, buildCampaignMotivos,
  type DrilldownFilters, type DrillNode,
} from "@/lib/queries/funnelDrilldown";

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

const SENTIMENT_DOT: Record<string, string> = {
  positive: "bg-success",
  negative: "bg-destructive",
  neutral: "bg-muted-foreground",
};

function Bar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-muted">
      <div className="h-1.5 rounded-full bg-primary" style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

function NodeRow({
  node, depth, parentCount, total, expanded, onToggle,
}: {
  node: DrillNode; depth: number; parentCount: number; total: number;
  expanded: Set<string>; onToggle: (k: string) => void;
}) {
  const hasKids = node.children.length > 0;
  const isOpen = expanded.has(node.key + depth);
  const pct = parentCount > 0 ? (node.count / parentCount) * 100 : 0;
  return (
    <>
      <button
        type="button"
        onClick={() => hasKids && onToggle(node.key + depth)}
        className={cn(
          "grid w-full grid-cols-[1fr_64px_72px_120px] items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/50",
          depth === 0 && "font-medium",
        )}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        <span className="flex items-center gap-1.5 truncate">
          {hasKids ? (
            isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <span className="w-3.5" />
          )}
          {node.sentiment && <span className={cn("h-2 w-2 shrink-0 rounded-full", SENTIMENT_DOT[node.sentiment])} />}
          <span className="truncate">{node.label}</span>
        </span>
        <span className="text-right tabular-nums">{node.count}</span>
        <span className="text-right tabular-nums text-muted-foreground">{pct.toFixed(1)}%</span>
        <Bar pct={total > 0 ? (node.count / total) * 100 : 0} />
      </button>
      {isOpen &&
        node.children.map((c) => (
          <NodeRow
            key={c.key}
            node={c}
            depth={depth + 1}
            parentCount={node.count}
            total={total}
            expanded={expanded}
            onToggle={onToggle}
          />
        ))}
    </>
  );
}

export function FunnelDrilldownCard() {
  const [days, setDays] = useState("30");
  const [mode, setMode] = useState<"latest" | "all">("latest");
  const [campaign, setCampaign] = useState<string | null>(null);
  const [program, setProgram] = useState<string | null>(null);
  const [advisorId, setAdvisorId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filters: DrilldownFilters = useMemo(
    () => ({
      from: days === "all" ? null : isoDaysAgo(Number(days)),
      to: null,
      campaign,
      program,
      advisorId,
      mode,
    }),
    [days, campaign, program, advisorId, mode],
  );

  const { data: rows = [], isLoading } = useFunnelDrilldown(filters);
  const tree = useMemo(() => buildDrilldown(rows), [rows]);
  const campaigns = useMemo(() => buildCampaignMotivos(rows), [rows]);

  const campaignOptions = useMemo(() => [...new Set(rows.map((r) => r.campaign))].sort(), [rows]);
  const programOptions = useMemo(() => [...new Set(rows.map((r) => r.program))].sort(), [rows]);
  const advisorOptions = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => r.advisorId && m.set(r.advisorId, r.advisorName));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const allMotivos = useMemo(() => {
    const s = new Set<string>();
    campaigns.forEach((c) => c.motivos.forEach((_, k) => s.add(k)));
    return [...s].sort();
  }, [campaigns]);

  const total = rows.length;

  function toggle(k: string) {
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  function exportCsv() {
    const header = "Etapa,Resultado,Tipificación,Leads,% de la etapa\n";
    const lines: string[] = [];
    for (const s of tree) {
      for (const o of s.children) {
        for (const t of o.children) {
          lines.push(
            [s.label, o.label, t.label, t.count, ((t.count / Math.max(1, s.count)) * 100).toFixed(1) + "%"]
              .map((v) => `"${String(v).replace(/"/g, '""')}"`)
              .join(","),
          );
        }
      }
    }
    const blob = new Blob(["﻿" + header + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analisis-embudo-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>Análisis del embudo</CardTitle>
              <CardDescription>Leads agrupados por etapa, resultado y tipificación.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}>
              <Download className="mr-1.5 h-4 w-4" /> Exportar
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 días</SelectItem>
                <SelectItem value="30">Últimos 30 días</SelectItem>
                <SelectItem value="90">Últimos 90 días</SelectItem>
                <SelectItem value="all">Todo el historial</SelectItem>
              </SelectContent>
            </Select>
            <Select value={campaign ?? "all"} onValueChange={(v) => setCampaign(v === "all" ? null : v)}>
              <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Campaña" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Campaña: Todas</SelectItem>
                {campaignOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={program ?? "all"} onValueChange={(v) => setProgram(v === "all" ? null : v)}>
              <SelectTrigger className="h-9 w-[190px]"><SelectValue placeholder="Programa" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Programa: Todos</SelectItem>
                {programOptions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={advisorId ?? "all"} onValueChange={(v) => setAdvisorId(v === "all" ? null : v)}>
              <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Asesor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Asesor: Todos</SelectItem>
                {advisorOptions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex rounded-md border border-border">
              {(["latest", "all"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    "px-3 py-1.5 text-sm",
                    mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  {m === "latest" ? "Última" : "Histórica"}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
          ) : !tree.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay seguimientos con resultado en este periodo.
            </p>
          ) : (
            <div className="space-y-0.5">
              <div className="grid grid-cols-[1fr_64px_72px_120px] gap-2 px-2 pb-1 text-xs font-medium text-muted-foreground">
                <span>Etapa / Resultado / Tipificación</span>
                <span className="text-right">Leads</span>
                <span className="text-right">% etapa</span>
                <span>Proporción</span>
              </div>
              {tree.map((s) => (
                <NodeRow
                  key={s.key}
                  node={s}
                  depth={0}
                  parentCount={total}
                  total={total}
                  expanded={expanded}
                  onToggle={toggle}
                />
              ))}
              <div className="grid grid-cols-[1fr_64px_72px_120px] gap-2 border-t border-border px-2 pt-2 text-sm font-medium">
                <span>Total de seguimientos</span>
                <span className="text-right tabular-nums">{total}</span>
                <span />
                <span />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Campaña × Motivo de no cierre</CardTitle>
          <CardDescription>
            Tipificaciones negativas por campaña de origen y cuántos leads terminaron inscritos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!campaigns.length ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Sin datos de campañas en este periodo.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Campaña</th>
                    <th className="py-2 pr-3 text-right font-medium">Leads</th>
                    {allMotivos.map((m) => (
                      <th key={m} className="py-2 pr-3 text-right font-medium">{m}</th>
                    ))}
                    <th className="py-2 text-right font-medium">Inscritos</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.campaign} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-3 font-medium">{c.campaign}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{c.total}</td>
                      {allMotivos.map((m) => {
                        const v = c.motivos.get(m) ?? 0;
                        const max = Math.max(1, ...campaigns.map((x) => x.motivos.get(m) ?? 0));
                        return (
                          <td key={m} className="py-2 pr-3 text-right tabular-nums">
                            <span
                              className={cn(
                                "inline-block min-w-7 rounded px-1.5 py-0.5",
                                v > 0 && v === max ? "bg-destructive/20 text-destructive" : "text-muted-foreground",
                              )}
                            >
                              {v}
                            </span>
                          </td>
                        );
                      })}
                      <td className="py-2 text-right tabular-nums">
                        <span className="inline-block min-w-7 rounded bg-success/20 px-1.5 py-0.5 text-success">
                          {c.won}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
