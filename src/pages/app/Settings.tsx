import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTenantId } from "@/lib/queries/tenant";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GeneralTab } from "@/components/settings/general/GeneralTab";
import { TeamTab } from "@/components/settings/team/TeamTab";
import { PipelineSettingsTab } from "@/components/settings/pipeline/PipelineTab";
import { ContactsSettingsTab } from "@/components/settings/contacts/ContactsSettingsTab";
import { WhatsappSettingsTab } from "@/components/settings/whatsapp/WhatsappTab";
import { ModulesTab } from "@/components/settings/modules/ModulesTab";
import { BillingTab } from "@/components/settings/billing/BillingTab";
import { ActivityTab } from "@/components/settings/activity/ActivityTab";
import { AgentsTab } from "@/components/settings/agents/AgentsTab";
import { MyAIProfileTab } from "@/components/settings/me/MyAIProfileTab";
import { GoalsTab } from "@/components/settings/goals/GoalsTab";
import { ExpenseCategoriesTab } from "@/components/settings/expenses/ExpenseCategoriesTab";
import { CopilotCapabilitiesTab } from "@/components/settings/copilot/CopilotCapabilitiesTab";
import { WidgetsTab } from "@/components/settings/widgets/WidgetsTab";
import { OutcomesTab } from "@/components/settings/outcomes/OutcomesTab";
import { ImportTab } from "@/components/settings/import/ImportTab";
import { LoadingSpinner } from "@/components/walix/LoadingSpinner";
import { usePermissions } from "@/hooks/usePermissions";
import { SETTINGS_TAB_PERMISSIONS } from "@/constants/permissions";

const ALL_TABS = [
  { id: "general", label: "General" },
  { id: "team", label: "Equipo" },
  { id: "pipeline", label: "Pipeline" },
  { id: "contacts", label: "Contactos" },
  { id: "outcomes", label: "Seguimiento" },
  { id: "goals", label: "Metas" },
  { id: "expenses", label: "Gastos" },
  { id: "widgets", label: "Tarjetas" },
  { id: "import", label: "Importar" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "modules", label: "Módulos" },
  { id: "agents", label: "Agentes IA" },
  { id: "copilot", label: "Copiloto" },
  { id: "me", label: "Mi Perfil IA" },
  { id: "billing", label: "Facturación" },
  { id: "activity", label: "Actividad" },
];

export default function Settings() {
  const { data: tenantId, isLoading } = useTenantId();
  const { can } = usePermissions();
  const TABS = ALL_TABS.filter((t) => can(SETTINGS_TAB_PERMISSIONS[t.id] ?? "settings.read"));
  const [params, setParams] = useSearchParams();
  const initial = params.get("tab") ?? "general";
  const [tab, setTab] = useState(
    TABS.some((t) => t.id === initial) ? initial : TABS[0]?.id ?? "me"
  );

  useEffect(() => {
    const p = params.get("tab");
    if (p && p !== tab && TABS.some((t) => t.id === p)) setTab(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const visible = (id: string) => TABS.some((t) => t.id === id);

  function changeTab(v: string) {
    setTab(v);
    const next = new URLSearchParams(params);
    next.set("tab", v);
    setParams(next, { replace: true });
  }

  if (isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <LoadingSpinner label="Cargando configuración..." />
      </div>
    );
  }

  if (!tenantId) {
    return (
      <div className="max-w-md mx-auto py-24 text-center">
        <h2 className="text-xl font-semibold">Sin instancia asignada</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Tu cuenta no está asociada a ninguna empresa. Contacta a soporte.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Personaliza tu instancia, gestiona el equipo y los integraciones.
        </p>
      </header>

      <Tabs value={tab} onValueChange={changeTab} className="space-y-6">
        <TabsList className="bg-card border border-border h-auto p-1 flex flex-wrap gap-1 w-full justify-start">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {visible("general") && <TabsContent value="general"><GeneralTab tenantId={tenantId} /></TabsContent>}
        {visible("team") && <TabsContent value="team"><TeamTab tenantId={tenantId} /></TabsContent>}
        {visible("pipeline") && <TabsContent value="pipeline"><PipelineSettingsTab tenantId={tenantId} /></TabsContent>}
        {visible("contacts") && <TabsContent value="contacts"><ContactsSettingsTab /></TabsContent>}
        {visible("outcomes") && <TabsContent value="outcomes"><OutcomesTab /></TabsContent>}
        {visible("goals") && <TabsContent value="goals"><GoalsTab /></TabsContent>}
        {visible("expenses") && <TabsContent value="expenses"><ExpenseCategoriesTab /></TabsContent>}
        {visible("widgets") && <TabsContent value="widgets"><WidgetsTab /></TabsContent>}
        {visible("import") && <TabsContent value="import"><ImportTab /></TabsContent>}
        {visible("whatsapp") && <TabsContent value="whatsapp"><WhatsappSettingsTab tenantId={tenantId} /></TabsContent>}
        {visible("modules") && <TabsContent value="modules"><ModulesTab /></TabsContent>}
        {visible("agents") && <TabsContent value="agents"><AgentsTab tenantId={tenantId} /></TabsContent>}
        {visible("copilot") && <TabsContent value="copilot"><CopilotCapabilitiesTab /></TabsContent>}
        {visible("me") && <TabsContent value="me"><MyAIProfileTab /></TabsContent>}
        {visible("billing") && <TabsContent value="billing"><BillingTab tenantId={tenantId} /></TabsContent>}
        {visible("activity") && <TabsContent value="activity"><ActivityTab tenantId={tenantId} /></TabsContent>}
      </Tabs>
    </div>
  );
}