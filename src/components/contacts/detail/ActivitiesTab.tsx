import { useState } from "react";
import { Plus, Phone, Users, Mail, FileText, ListChecks, CheckSquare } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useContactActivity } from "@/lib/queries/contacts";
import { ActivityItem } from "./ActivityItem";
import { LogActivityDialog, type LogKind } from "./dialogs/LogActivityDialog";
import { TasksTab } from "./TasksTab";

interface Props { contactId: string }

const FILTERS: { id: string; label: string; icon: any; types?: string[]; cta?: LogKind }[] = [
  { id: "all",      label: "Todas",     icon: ListChecks },
  { id: "notes",    label: "Notas",     icon: FileText, types: ["note"], cta: "note" },
  { id: "calls",    label: "Llamadas",  icon: Phone,    types: ["call"], cta: "call" },
  { id: "meetings", label: "Reuniones", icon: Users,    types: ["meeting"], cta: "meeting" },
  { id: "emails",   label: "Emails",    icon: Mail,     types: ["email"], cta: "email" },
  { id: "tasks",    label: "Tareas",    icon: CheckSquare },
];

export function ActivitiesTab({ contactId }: Props) {
  const [tab, setTab] = useState("all");
  const [logOpen, setLogOpen] = useState(false);
  const [logKind, setLogKind] = useState<LogKind>("note");
  const { data: activity = [] } = useContactActivity(contactId);

  function openLog(kind: LogKind) { setLogKind(kind); setLogOpen(true); }

  const current = FILTERS.find((f) => f.id === tab)!;
  const filtered = current.types
    ? activity.filter((a) => current.types!.includes(a.type))
    : activity;

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
            {current.cta && tab !== "all" && (
              <Button size="sm" onClick={() => openLog(current.cta!)}>
                <Plus className="h-4 w-4" /> Nueva {current.label.slice(0, -1).toLowerCase()}
              </Button>
            )}
          </div>
        </div>

        {FILTERS.filter((f) => f.id !== "tasks").map((f) => (
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

        <TabsContent value="tasks" className="mt-4">
          <TasksTab contactId={contactId} />
        </TabsContent>
      </Tabs>

      <LogActivityDialog open={logOpen} onOpenChange={setLogOpen} contactId={contactId} kind={logKind} />
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