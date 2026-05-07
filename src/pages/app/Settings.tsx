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
import { LoadingSpinner } from "@/components/walix/LoadingSpinner";

const TABS = [
  { id: "general", label: "General" },
  { id: "team", label: "Equipo" },
  { id: "pipeline", label: "Pipeline" },
  { id: "contacts", label: "Contactos" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "modules", label: "Módulos" },
  { id: "agents", label: "Agentes IA" },
  { id: "me", label: "Mi Perfil IA" },
  { id: "billing", label: "Facturación" },
  { id: "activity", label: "Actividad" },
];

export default function Settings() {
  const { data: tenantId, isLoading } = useTenantId();
  const [params, setParams] = useSearchParams();
  const initial = params.get("tab") ?? "general";
  const [tab, setTab] = useState(TABS.some((t) => t.id === initial) ? initial : "general");

  useEffect(() => {
    const p = params.get("tab");
    if (p && p !== tab && TABS.some((t) => t.id === p)) setTab(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

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

        <TabsContent value="general"><GeneralTab tenantId={tenantId} /></TabsContent>
        <TabsContent value="team"><TeamTab tenantId={tenantId} /></TabsContent>
        <TabsContent value="pipeline"><PipelineSettingsTab tenantId={tenantId} /></TabsContent>
        <TabsContent value="contacts"><ContactsSettingsTab /></TabsContent>
        <TabsContent value="whatsapp"><WhatsappSettingsTab tenantId={tenantId} /></TabsContent>
        <TabsContent value="modules"><ModulesTab /></TabsContent>
        <TabsContent value="agents"><AgentsTab tenantId={tenantId} /></TabsContent>
        <TabsContent value="me"><MyAIProfileTab /></TabsContent>
        <TabsContent value="billing"><BillingTab tenantId={tenantId} /></TabsContent>
        <TabsContent value="activity"><ActivityTab tenantId={tenantId} /></TabsContent>
      </Tabs>
    </div>
  );
}