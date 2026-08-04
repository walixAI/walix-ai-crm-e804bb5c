import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/lib/queries/tenant";
import {
  useAutomations, useToggleAutomation, useDeleteAutomation, useDuplicateAutomation,
  type Automation,
} from "@/lib/queries/automations";
import { AutomationCard } from "@/components/automations/AutomationCard";
import { AutomationTemplateGallery } from "@/components/automations/AutomationTemplateGallery";
import { AutomationBuilderSheet } from "@/components/automations/AutomationBuilderSheet";
import { AutomationAiDraftDialog } from "@/components/automations/AutomationAiDraftDialog";
import { AutomationHistoryDrawer } from "@/components/automations/AutomationHistoryDrawer";
import { AutomationDryRunDialog } from "@/components/automations/AutomationDryRunDialog";
import { PlanLimitBanner, usePlanLimits } from "@/components/automations/PlanLimitBanner";
import { EmptyState } from "@/components/walix/EmptyState";
import { EmptyIllustration } from "@/components/walix/empty/EmptyIllustration";
import { ConfirmDialog } from "@/components/walix/ConfirmDialog";
import { RecurrenceList } from "@/components/automations/recurrence/RecurrenceList";
import { RecurrenceBuilderSheet } from "@/components/automations/recurrence/RecurrenceBuilderSheet";
import type { AutomationTemplate } from "@/lib/automations/templates";
import type { AutomationDraft } from "@/services/automations";
import type { RecurrenceDefinition } from "@/lib/queries/recurrence";

type Tab = "active" | "paused" | "drafts" | "all" | "recurrence";

export default function Automations() {
  const { toast } = useToast();
  const { data: automations = [], isLoading } = useAutomations();
  const toggle = useToggleAutomation();
  const del = useDeleteAutomation();
  const dup = useDuplicateAutomation();

  const [tab, setTab] = useState<Tab>("active");
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [editing, setEditing] = useState<Automation | null>(null);
  const [prefill, setPrefill] = useState<Partial<AutomationDraft> | null>(null);
  const [historyFor, setHistoryFor] = useState<Automation | null>(null);
  const [dryFor, setDryFor] = useState<Automation | null>(null);
  const [deleteFor, setDeleteFor] = useState<Automation | null>(null);
  const [recurrenceOpen, setRecurrenceOpen] = useState(false);
  const [editingRecurrence, setEditingRecurrence] = useState<RecurrenceDefinition | null>(null);
  const { data: tenant } = useTenant();
  const tenantPlan = tenant?.plan ?? "starter";

  const activeCount = automations.filter((a) => a.enabled && !a.isDraft).length;
  const limits = usePlanLimits(tenantPlan, activeCount);

  const counts = useMemo(() => ({
    active: automations.filter((a) => a.enabled && !a.isDraft).length,
    paused: automations.filter((a) => !a.enabled && !a.isDraft).length,
    drafts: automations.filter((a) => a.isDraft).length,
    all: automations.length,
  }), [automations]);

  const filtered = useMemo(() => {
    if (tab === "active") return automations.filter((a) => a.enabled && !a.isDraft);
    if (tab === "paused") return automations.filter((a) => !a.enabled && !a.isDraft);
    if (tab === "drafts") return automations.filter((a) => a.isDraft);
    return automations;
  }, [automations, tab]);

  const openBuilderFromTemplate = (t: AutomationTemplate) => {
    setEditing(null);
    setPrefill({
      name: t.name,
      description: t.description,
      triggerType: t.triggerType,
      triggerConfig: t.triggerConfig,
      conditions: t.conditions,
      actions: t.actions,
    });
    setGalleryOpen(false);
    setBuilderOpen(true);
  };

  const openBuilderScratch = () => {
    setEditing(null);
    setPrefill(null);
    setGalleryOpen(false);
    setBuilderOpen(true);
  };

  const openBuilderFromDraft = (d: AutomationDraft) => {
    setEditing(null);
    setPrefill(d);
    setBuilderOpen(true);
  };

  const handleToggle = async (a: Automation, next: boolean) => {
    if (next && limits.atLimit && !a.enabled) {
      toast({
        title: "Límite del plan alcanzado",
        description: `Plan ${limits.label}: máximo ${limits.max} automatizaciones activas. Mejora tu plan para más.`,
        variant: "destructive",
      });
      return;
    }
    try {
      await toggle.mutateAsync({ id: a.id, enabled: next });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "", variant: "destructive" });
    }
  };

  return (
    <div className="max-w-[1400px] space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Automatizaciones</h1>
          <p className="text-sm text-muted-foreground mt-1">Pon tu CRM en piloto automático.</p>
        </div>
        <div className="flex items-center gap-2">
          <PlanLimitBanner plan={tenant.plan} active={activeCount} />
          <Button onClick={() => setGalleryOpen(true)} disabled={limits.locked}>
            <Plus className="h-4 w-4 mr-1.5" /> Nueva automatización
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="active">Activas ({counts.active})</TabsTrigger>
          <TabsTrigger value="paused">Pausadas ({counts.paused})</TabsTrigger>
          <TabsTrigger value="drafts">Borradores ({counts.drafts})</TabsTrigger>
          <TabsTrigger value="all">Todas ({counts.all})</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          illustration={<EmptyIllustration variant="automations" />}
          title={tab === "active" ? "No tienes automatizaciones activas" : "Nada por aquí"}
          description="Crea tu primera automatización en segundos desde una plantilla lista o describiéndola con IA."
          action={!limits.locked ? { label: "Crear automatización", onClick: () => setGalleryOpen(true) } : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((a) => (
            <AutomationCard
              key={a.id}
              automation={a}
              onToggle={(next) => handleToggle(a, next)}
              onEdit={() => { setEditing(a); setPrefill(null); setBuilderOpen(true); }}
              onDuplicate={async () => {
                try { await dup.mutateAsync(a); toast({ title: "Duplicada" }); }
                catch (e: any) { toast({ title: "Error", description: e?.message ?? "", variant: "destructive" }); }
              }}
              onDelete={async () => {
                setDeleteFor(a);
              }}
              onHistory={() => setHistoryFor(a)}
              onDryRun={() => setDryFor(a)}
              disabledToggleReason={limits.atLimit && !a.enabled ? "Límite alcanzado" : undefined}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteFor}
        onOpenChange={(v) => !v && setDeleteFor(null)}
        title={`¿Eliminar "${deleteFor?.name ?? ""}"?`}
        description="Esta acción no se puede deshacer. La automatización dejará de ejecutarse inmediatamente."
        confirmLabel="Eliminar"
        destructive
        onConfirm={async () => {
          if (!deleteFor) return;
          try {
            await del.mutateAsync(deleteFor.id);
            toast({ title: "Automatización eliminada" });
          } catch (e: any) {
            toast({ title: "Error", description: e?.message ?? "", variant: "destructive" });
          } finally {
            setDeleteFor(null);
          }
        }}
      />

      <AutomationTemplateGallery
        open={galleryOpen} onOpenChange={setGalleryOpen}
        onSelect={openBuilderFromTemplate}
        onScratch={openBuilderScratch}
        onAi={() => { setGalleryOpen(false); setAiOpen(true); }}
      />
      <AutomationAiDraftDialog
        open={aiOpen} onOpenChange={setAiOpen}
        onDraftReady={openBuilderFromDraft}
      />
      <AutomationBuilderSheet
        open={builderOpen}
        onOpenChange={(v) => { setBuilderOpen(v); if (!v) { setEditing(null); setPrefill(null); } }}
        editing={editing}
        prefill={prefill}
        forceDraft={limits.atLimit && !editing?.enabled}
      />
      <AutomationHistoryDrawer
        open={!!historyFor}
        onOpenChange={(v) => !v && setHistoryFor(null)}
        automation={historyFor}
      />
      {dryFor && (
        <AutomationDryRunDialog
          open={!!dryFor}
          onOpenChange={(v) => !v && setDryFor(null)}
          triggerType={dryFor.triggerType}
          triggerConfig={dryFor.triggerConfig}
          conditions={dryFor.conditions}
        />
      )}
    </div>
  );
}
