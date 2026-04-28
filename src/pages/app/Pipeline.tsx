import { useMemo, useState } from "react";
import { LoadingSpinner } from "@/components/walix/LoadingSpinner";
import { PipelineHeader } from "@/components/pipeline/PipelineHeader";
import { KanbanBoard } from "@/components/pipeline/KanbanBoard";
import { DealsListView } from "@/components/pipeline/DealsListView";
import { NewDealDialog } from "@/components/pipeline/NewDealDialog";
import { DealDrawer } from "@/components/pipeline/DealDrawer";
import { emptyFilters, type PipelineFiltersValue } from "@/components/pipeline/PipelineFilters";
import {
  useStages, useDeals, useDealTasksMap, useUnreadByContactMap, useContactsLite,
  type PipelineDeal, type PipelineStage,
} from "@/lib/queries/pipeline";

export default function Pipeline() {
  const { data: stages = [], isLoading: stagesLoading } = useStages();
  const { data: deals = [], isLoading: dealsLoading } = useDeals();
  const { data: tasksByDeal = new Map() } = useDealTasksMap();
  const { data: unreadByContact = new Map() } = useUnreadByContactMap();
  const { data: contacts = [] } = useContactsLite();

  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [filters, setFilters] = useState<PipelineFiltersValue>(emptyFilters);
  const [newDealOpen, setNewDealOpen] = useState(false);
  const [newDealStage, setNewDealStage] = useState<string | null>(null);
  const [openDeal, setOpenDeal] = useState<PipelineDeal | null>(null);

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

  const filtered = useMemo(() => {
    return deals.filter(d => {
      if (filters.ownerName !== "all" && d.ownerName !== filters.ownerName) return false;
      if (filters.amountMin && d.amount < Number(filters.amountMin)) return false;
      if (filters.amountMax && d.amount > Number(filters.amountMax)) return false;
      if (filters.closeBefore && d.expectedCloseDate && new Date(d.expectedCloseDate) > filters.closeBefore) return false;
      if (filters.source !== "all" && d.source !== filters.source) return false;
      if (filters.tag && !d.name.toLowerCase().includes(filters.tag.toLowerCase()) && !(d.notes ?? "").toLowerCase().includes(filters.tag.toLowerCase())) return false;
      return true;
    });
  }, [deals, filters]);

  const activeDeals = filtered.filter(d => !d.isWon && !d.isLost);
  const totalAmount = activeDeals.reduce((s, d) => s + d.amount, 0);

  function openNewDeal(stage?: PipelineStage) {
    setNewDealStage(stage?.id ?? null);
    setNewDealOpen(true);
  }

  if (stagesLoading || dealsLoading) {
    return (
      <div className="grid place-items-center h-64">
        <LoadingSpinner />
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
        onNew={() => openNewDeal()}
        totalAmount={totalAmount}
        activeCount={activeDeals.length}
      />

      {view === "kanban" ? (
        <KanbanBoard
          stages={stages}
          deals={filtered}
          contactName={contactName}
          contactColor={contactColor}
          tasksByDeal={tasksByDeal}
          unreadByContact={unreadByContact}
          onOpenDeal={setOpenDeal}
          onAddDeal={openNewDeal}
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
      />
    </div>
  );
}
