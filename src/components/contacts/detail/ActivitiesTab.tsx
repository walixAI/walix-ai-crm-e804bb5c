import { useMemo, useState } from "react";
import { Plus, Phone, Users, Mail, FileText, ListChecks, ClipboardCheck } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useContactActivity, type ActivityRow } from "@/lib/queries/contacts";
import { useContactPipelineDeals, useContactStageHistory } from "@/lib/queries/pipeline";
import { ActivityItem } from "./ActivityItem";
import { LogActivityDialog, type LogKind } from "./dialogs/LogActivityDialog";
import { LogFollowUpDialog } from "@/components/activity/LogFollowUpDialog";
interface Props { contactId: string }

const FILTERS: { id: string; label: string; icon: any; types?: string[]; cta?: LogKind }[] = [
  { id: "all",      label: "Todas",     icon: ListChecks },
  { id: "notes",    label: "Notas",     icon: FileText, types: ["note"], cta: "note" },
  { id: "calls",    label: "Llamadas",  icon: Phone,    types: ["call"], cta: "call" },
  { id: "meetings", label: "Reuniones", icon: Users,    types: ["meeting"], cta: "meeting" },
  { id: "emails",   label: "Emails",    icon: Mail,     types: ["email"], cta: "email" },
];

export function ActivitiesTab({ contactId }: Props) {
  const [tab, setTab] = useState("all");
  const [logOpen, setLogOpen] = useState(false);
  const [logKind, setLogKind] = useState<LogKind>("note");
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const { data: activity = [] } = useContactActivity(contactId);
  const { data: deals = [] } = useContactPipelineDeals(contactId);
  const { data: stageHistory = [] } = useContactStageHistory(contactId);

  const merged = useMemo(() => {
    const dealName = new Map(deals.map((d) => [d.id, d.name]));
    const stageRows: ActivityRow[] = stageHistory.map((h) => {
      const auto = !!h.metadata?.automatic;
      const from = h.fromStageName ? `${h.fromStageName} → ` : "";
      return {
        id: `stage-${h.id}`,
        type: "deal",
        description: `${dealName.get(h.dealId) ?? "Oportunidad"}: ${from}${h.toStageName ?? "—"}`,
        timestamp: h.changedAt,
        occurredAt: h.changedAt,
        createdAt: h.changedAt,
        updatedAt: null,
        metadata: { result: auto ? "Avance automático" : "Cambio de etapa" },
        agent: auto ? "Automatización" : "Sistema",
        agentInitials: auto ? "IA" : "•",
        agentId: null,
      };
    });
    return [...activity, ...stageRows].sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );
  }, [activity, stageHistory, deals]);

  function openLog(kind: LogKind) { setLogKind(kind); setLogOpen(true); }

  const current = FILTERS.find((f) => f.id === tab)!;
  const filtered = current.types
    ? merged.filter((a) => current.types!.includes(a.type))
    : merged;

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <TabsList className="bg-card border border-border h-auto p-1 flex flex-wrap">
            {FILTERS.map((f) => (
              <TabsTrigger key={f.id} value={f.id} className="text-xs gap-1">
                <f.icon className="h-3.5 w-3.5" /> {f.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => setFollowUpOpen(true)}>
              <ClipboardCheck className="h-4 w-4" /> Registrar seguimiento
            </Button>
            {current.cta && tab !== "all" && (
              <Button size="sm" onClick={() => openLog(current.cta!)}>
                <Plus className="h-4 w-4" /> Nueva {current.label.slice(0, -1).toLowerCase()}
              </Button>
            )}
          </div>
        </div>

        {FILTERS.map((f) => (
          <TabsContent key={f.id} value={f.id} className="mt-4">
            <div className="rounded-xl border border-border bg-card p-5 shadow-card">
              {filtered.length === 0 ? (
                <EmptyState label={f.label} onCreate={f.cta ? () => openLog(f.cta!) : undefined} />
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />
                  {filtered.map((a) => (
                    <ActivityItem key={a.id} contactId={contactId} activity={a} />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <LogActivityDialog open={logOpen} onOpenChange={setLogOpen} contactId={contactId} kind={logKind} />
      <LogFollowUpDialog
        open={followUpOpen}
        onOpenChange={setFollowUpOpen}
        contactId={contactId}
        allowDealPicker
      />
    </div>
  );
}

function EmptyState({ label, onCreate }: { label: string; onCreate?: () => void }) {
  return (
    <div className="text-center py-10 text-sm text-muted-foreground">
      <p>Aún no hay {label.toLowerCase()}.</p>
      {onCreate && (
        <Button size="sm" variant="outline" className="mt-3" onClick={onCreate}>
          <Plus className="h-4 w-4" /> Registrar
        </Button>
      )}
    </div>
  );
}