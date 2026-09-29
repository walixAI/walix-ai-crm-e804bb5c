import { useEffect, useState } from "react";

export type PipelineLens = "active" | "created" | "won";

export interface PipelinePrefs {
  view: "kanban" | "list" | "performance";
  search: string;
  pipelineId: string | null;
  pipelineLens: PipelineLens;
  perfLens: "created" | "active" | "all";
  perfMonth: string | null; // "YYYY-MM"
  perfFilters: { productIds: string[]; frequency: string; owner: string; stageId: string };
  filters: {
    ownerName: string;
    amountMin: string;
    amountMax: string;
    closeBefore: string | null; // ISO date
    source: string;
    tag: string;
  };
}

const DEFAULT_PREFS: PipelinePrefs = {
  view: "kanban",
  search: "",
  pipelineId: null,
  pipelineLens: "active",
  perfLens: "active",
  perfMonth: null,
  perfFilters: { productIds: [], frequency: "all", owner: "all", stageId: "all" },
  filters: {
    ownerName: "all",
    amountMin: "",
    amountMax: "",
    closeBefore: null,
    source: "all",
    tag: "",
  },
};

const KEY = "walix.pipeline.prefs.v1";

function keyFor(tenantId?: string | null) {
  return tenantId ? `${KEY}.${tenantId}` : KEY;
}

function read(tenantId?: string | null): PipelinePrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    // Preferencias por empresa: filtros de otra empresa (etapas, usuarios) no deben ocultar oportunidades.
    const raw = localStorage.getItem(keyFor(tenantId)) ?? localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PREFS,
      ...parsed,
      filters: { ...DEFAULT_PREFS.filters, ...(parsed?.filters ?? {}) },
      perfFilters: { ...DEFAULT_PREFS.perfFilters, ...(parsed?.perfFilters ?? {}) },
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function usePipelinePrefs(tenantId?: string | null) {
  const [state, setState] = useState<{ tenantId: string | null | undefined; prefs: PipelinePrefs }>(
    () => ({ tenantId, prefs: read(tenantId) }),
  );
  if (state.tenantId !== tenantId) {
    // Cambio de empresa: cargar sus propias preferencias.
    const next = { tenantId, prefs: read(tenantId) };
    setState(next);
  }
  const prefs = state.tenantId === tenantId ? state.prefs : read(tenantId);
  const setPrefs = (p: PipelinePrefs | ((prev: PipelinePrefs) => PipelinePrefs)) =>
    setState((s) => ({ ...s, prefs: typeof p === "function" ? (p as (x: PipelinePrefs) => PipelinePrefs)(s.prefs) : p }));

  useEffect(() => {
    if (!tenantId) return;
    try {
      localStorage.setItem(keyFor(tenantId), JSON.stringify(state.prefs));
    } catch {
      /* storage full / disabled */
    }
  }, [state.prefs, tenantId]);

  return [prefs, setPrefs] as const;
}