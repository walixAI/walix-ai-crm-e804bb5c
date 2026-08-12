import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PipelineHeader } from "@/components/pipeline/PipelineHeader";
import { KanbanSkeleton, TableSkeleton } from "@/components/walix/Skeletons";
import { KanbanBoard } from "@/components/pipeline/KanbanBoard";
import { DealsListView } from "@/components/pipeline/DealsListView";
import { DealsPerformanceView, currentMonthKey } from "@/components/pipeline/DealsPerformanceView";
import { NewDealDialog } from "@/components/pipeline/NewDealDialog";
import { DealDrawer } from "@/components/pipeline/DealDrawer";
import { type PipelineFiltersValue } from "@/components/pipeline/PipelineFilters";
import { LostReasonDialog } from "@/components/pipeline/LostReasonDialog";
import { QuickTaskDialog } from "@/components/pipeline/QuickTaskDialog";
import { BulkActionsBar } from "@/components/pipeline/BulkActionsBar";
import { PipelineManagerDialog } from "@/components/pipeline/PipelineManagerDialog";
import { AiInsightsPanel } from "@/components/pipeline/AiInsightsPanel";
import { useAiSuggestionsByDeal } from "@/lib/queries/pipelineAi";
import { AiAlertBanner } from "@/components/walix/AiAlertBanner";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/walix/EmptyState";
import { EmptyIllustration } from "@/components/walix/empty/EmptyIllustration";
import { usePipelinePrefs } from "@/lib/usePipelinePrefs";
import {
  useStages, useDeals, useDealTasksMap, useUnreadByContactMap, useContactsLite, usePipelines,
  type PipelineDeal, type PipelineStage,
} from "@/lib/queries/pipeline";

function parseCalendarDate(value: string) {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!dateOnly) return new Date(value);
  return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
}

export default function Pipeline() {
  const { data: pipelines = [], isLoading: pipelinesLoading } = usePipelines();
  const [prefs, setPrefs] = usePipelinePrefs();

  // Resolve active pipeline (prefer prefs, fall back to default)
  const activePipeline =
    pipelines.find((p) => p.id === prefs.pipelineId) ??
    pipelines.find((p) => p.isDefault) ??
    pipelines[0] ??
    null;

  useEffect(() => {
    if (activePipeline && prefs.pipelineId !== activePipeline.id) {
      setPrefs({ ...prefs, pipelineId: activePipeline.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePipeline?.id]);

  const { data: stages = [], isLoading: stagesLoading } = useStages(activePipeline?.id);
  const { data: deals = [], isLoading: dealsLoading } = useDeals();
  const { data: tasksByDeal = new Map() } = useDealTasksMap();
  const { data: unreadByContact = new Map() } = useUnreadByContactMap();
  const { data: contacts = [] } = useContactsLite();
  const { data: aiSuggestionsByDeal = new Map() } = useAiSuggestionsByDeal();

  // Hydrate filters from prefs (Date is serialized as ISO)
  const filters: PipelineFiltersValue = useMemo(() => ({
    ownerName: prefs.filters.ownerName,
    amountMin: prefs.filters.amountMin,
    amountMax: prefs.filters.amountMax,
    closeBefore: prefs.filters.closeBefore ? new Date(prefs.filters.closeBefore) : undefined,
    source: prefs.filters.source,
    tag: prefs.filters.tag,
  }), [prefs.filters]);

  const setFilters = (v: PipelineFiltersValue) =>
    setPrefs({
      ...prefs,
      filters: {
        ownerName: v.ownerName,
        amountMin: v.amountMin,
        amountMax: v.amountMax,
        closeBefore: v.closeBefore ? v.closeBefore.toISOString() : null,
        source: v.source,
        tag: v.tag,
      },
    });

  const view = prefs.view;
  const setView = (v: "kanban" | "list" | "performance") => setPrefs({ ...prefs, view: v });
  const search = prefs.search;
  const setSearch = (v: string) => setPrefs({ ...prefs, search: v });

  const [newDealOpen, setNewDealOpen] = useState(false);
  const [newDealStage, setNewDealStage] = useState<string | null>(null);
  const [openDeal, setOpenDeal] = useState<PipelineDeal | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lostDeal, setLostDeal] = useState<PipelineDeal | null>(null);
  const [taskDeal, setTaskDeal] = useState<PipelineDeal | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  // Mantenimientos/recurrencias del mes en curso

  // Deep-link: /pipeline?dealId=<uuid> opens the deal drawer (from Dashboard widgets).
  const [searchParams, setSearchParams] = useSearchParams();
  const deepDealId = searchParams.get("dealId");
  useEffect(() => {
    if (!deepDealId || deals.length === 0) return;
    const d = deals.find((x) => x.id === deepDealId);
    if (d) {
      setOpenDeal(d);
      const next = new URLSearchParams(searchParams);
      next.delete("dealId");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepDealId, deals.length]);

  const lostStage = stages.find((s) => s.isLost) ?? null;

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const contactById = useMemo(() => {
    const m = new Map(contacts.map(c => [c.id, c]));
    return m;
  }, [contacts]);

  const contactName = (id: string | null) => {
    if (!id) return undefined;
    const c = contactById.get(id);
    return c ? `${c.name}${c.lastName ? " " + c.lastName : ""}` : undefined;
  };
  const contactColor = (id: string | null) => (id ? contactById.get(id)?.avatarColor ?? null : null);
  const contactLastActivityAt = (id: string | null) => (id ? contactById.get(id)?.lastActivityAt ?? null : null);

  const contactLastActivityById = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const c of contacts) m.set(c.id, c.lastActivityAt);
    return m;
  }, [contacts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const stageIds = new Set(stages.map(s => s.id));
    return deals.filter(d => {
      // Only deals belonging to current pipeline's stages
      if (d.stageId && !stageIds.has(d.stageId)) return false;
      if (filters.ownerName !== "all" && d.ownerName !== filters.ownerName) return false;
      if (filters.amountMin && d.amount < Number(filters.amountMin)) return false;
      if (filters.amountMax && d.amount > Number(filters.amountMax)) return false;
      if (filters.closeBefore && d.expectedCloseDate && parseCalendarDate(d.expectedCloseDate) > filters.closeBefore) return false;
      if (filters.source !== "all" && d.source !== filters.source) return false;
      if (filters.tag && !d.name.toLowerCase().includes(filters.tag.toLowerCase()) && !(d.notes ?? "").toLowerCase().includes(filters.tag.toLowerCase())) return false;
      if (q) {
        const c = d.contactId ? contactById.get(d.contactId) : undefined;
        const digits = q.replace(/\D+/g, "");
        const hay = [
          d.name, d.notes ?? "", d.ownerName ?? "",
          c ? `${c.name} ${c.lastName ?? ""}` : "",
          c?.email ?? "", c?.address ?? "", c?.company ?? "",
          c?.phone ?? "", c?.phoneAlt ?? "",
        ].join(" ").toLowerCase();
        const phoneHay = `${c?.phone ?? ""} ${c?.phoneAlt ?? ""}`.replace(/\D+/g, "");
        const matches = hay.includes(q) || (digits.length >= 3 && phoneHay.includes(digits));
        if (!matches) return false;
      }
      return true;
    });
  }, [deals, filters, search, contactById, stages]);

  const activeDeals = filtered.filter(d => !d.isWon && !d.isLost);
  const totalAmount = activeDeals.reduce((s, d) => s + d.amount, 0);
  const weightedAmount = activeDeals.reduce((s, d) => s + (d.amount * d.probability) / 100, 0);

  // Stale deals (>10 días sin actividad reciente del contacto / sin updates)
  const staleDeals = useMemo(() => {
    const now = Date.now();
    return activeDeals.filter((d) => {
      const lastContact = d.contactId ? contactLastActivityById.get(d.contactId) : null;
      const ref = lastContact ?? d.updatedAt;
      return (now - new Date(ref).getTime()) / 86_400_000 > 10;
    });
  }, [activeDeals, contactLastActivityById]);
  const staleAmount = staleDeals.reduce((s, d) => s + d.amount, 0);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const closingThisMonth = activeDeals
    .filter(d => d.expectedCloseDate && parseCalendarDate(d.expectedCloseDate) >= startOfMonth && parseCalendarDate(d.expectedCloseDate) < endOfMonth)
    .reduce((s, d) => s + d.amount, 0);

  const closingPrevMonth = filtered
    .filter(d => d.expectedCloseDate && parseCalendarDate(d.expectedCloseDate) >= startOfPrevMonth && parseCalendarDate(d.expectedCloseDate) < startOfMonth)
    .reduce((s, d) => s + d.amount, 0);

  const closingDeltaPct =
    closingPrevMonth > 0 ? ((closingThisMonth - closingPrevMonth) / closingPrevMonth) * 100 : null;

  function openNewDeal(stage?: PipelineStage) {
    setNewDealStage(stage?.id ?? null);
    setNewDealOpen(true);
  }

  if (stagesLoading || dealsLoading || pipelinesLoading) {
    return (
      <div className="space-y-4 max-w-full">
        {prefs.view === "kanban"
          ? <KanbanSkeleton columns={5} cardsPerColumn={3} />
          : <TableSkeleton rows={8} columns={6} />}
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-full">
      <PipelineHeader
        view={view}
        onView={setView}
        filters={filters}
        onFilters={setFilters}
        search={search}
        onSearch={setSearch}
        onNew={() => openNewDeal()}
        onOpenAi={() => setAiOpen(true)}
        pipelines={pipelines}
        activePipeline={activePipeline}
        onSelectPipeline={(id) => setPrefs({ ...prefs, pipelineId: id })}
        onManagePipelines={() => setManagerOpen(true)}
        totalAmount={totalAmount}
        weightedAmount={weightedAmount}
        closingThisMonth={closingThisMonth}
        closingDeltaPct={closingDeltaPct}
        activeCount={activeDeals.length}
      />

      {staleDeals.length > 0 && (
        <AiAlertBanner
          variant="warning"
          icon={<Clock className="h-4 w-4" />}
          title={`${staleDeals.length} oportunidad${staleDeals.length === 1 ? "" : "es"} sin actividad hace más de 10 días`}
          description={`Suman ${new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(staleAmount)} en pipeline. Revísalos antes de que se enfríen.`}
          actionLabel="Ver insights IA"
          onAction={() => setAiOpen(true)}
        />
      )}

      {deals.length === 0 ? (
        <EmptyState
          illustration={<EmptyIllustration variant="pipeline" />}
          title="Crea tu primera oportunidad y empieza a cerrar"
          description="Organiza tus oportunidades en etapas y arrastra para mover entre columnas."
          action={{ label: "+ Nueva Oportunidad", onClick: () => openNewDeal() }}
        />
      ) : view === "kanban" ? (
        <KanbanBoard
          stages={stages}
          deals={filtered}
          contactName={contactName}
          contactColor={contactColor}
          contactLastActivityAt={contactLastActivityAt}
          tasksByDeal={tasksByDeal}
          unreadByContact={unreadByContact}
          aiSuggestionsByDeal={aiSuggestionsByDeal}
          onOpenDeal={setOpenDeal}
          onAddDeal={openNewDeal}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onRequestLost={setLostDeal}
          onNewTask={setTaskDeal}
        />
      ) : view === "performance" ? (
        <DealsPerformanceView
          deals={filtered}
          stages={stages.filter((s) => !s.isWon && !s.isLost)}
          allStages={stages}
          contactName={contactName}
          contactLastActivityById={contactLastActivityById}
          onOpenDeal={setOpenDeal}
          lens={prefs.perfLens}
          onLens={(v) => setPrefs({ ...prefs, perfLens: v })}
          periodMonth={prefs.perfMonth ?? currentMonthKey()}
          onPeriodMonth={(v) => setPrefs({ ...prefs, perfMonth: v })}
        />
      ) : (
        <DealsListView deals={filtered} contactName={contactName} onOpenDeal={setOpenDeal} />
      )}

      <NewDealDialog
        open={newDealOpen}
        onOpenChange={setNewDealOpen}
        stages={stages}
        defaultStageId={newDealStage}
      />

      <DealDrawer
        deal={openDeal}
        stages={stages}
        open={!!openDeal}
        onClose={() => setOpenDeal(null)}
        contactName={openDeal ? contactName(openDeal.contactId) : undefined}
        contactLastActivityAt={openDeal ? contactLastActivityAt(openDeal.contactId) : null}
      />

      <LostReasonDialog
        open={!!lostDeal}
        deal={lostDeal}
        lostStage={lostStage}
        onClose={() => setLostDeal(null)}
      />

      <QuickTaskDialog
        open={!!taskDeal}
        deal={taskDeal}
        onClose={() => setTaskDeal(null)}
      />

      <BulkActionsBar
        selectedIds={Array.from(selectedIds)}
        stages={stages}
        onClear={() => setSelectedIds(new Set())}
      />

      <PipelineManagerDialog
        open={managerOpen}
        onClose={() => setManagerOpen(false)}
        onSelect={(id) => setPrefs({ ...prefs, pipelineId: id })}
      />

      <AiInsightsPanel
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        deals={filtered}
        contactLastActivityById={contactLastActivityById}
      />
    </div>
  );
}
