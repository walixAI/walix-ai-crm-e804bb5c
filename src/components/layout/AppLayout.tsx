import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { CopilotDrawer } from "@/components/walix/CopilotDrawer";
import { CommandPalette } from "@/components/walix/CommandPalette";
import { OnboardingTour, useAutoOnboardingTour, resetTour } from "@/components/walix/OnboardingTour";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useTenantId } from "@/lib/queries/tenant";
import { fetchTenant } from "@/services/tenant";
import { applyBrandPrimary, removeBrandPrimary } from "@/lib/branding";
import { TrialBanner } from "@/components/walix/TrialBanner";
import { useCopilot } from "@/store/copilot";
import { deriveConversationKey, deriveEntity } from "@/lib/constants/copilotSuggestions";
import { useCopilotWebAccess } from "@/hooks/useCopilotAccess";

export function AppLayout() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const tour = useAutoOnboardingTour();
  const { user } = useAuth();
  const location = useLocation();
  const { allowed: copilotWebAllowed } = useCopilotWebAccess();
  const openCopilot = useCopilot((s) => s.openDrawer);
  const setCopilotContext = useCopilot((s) => s.setContext);
  const { data: tenantId } = useTenantId();
  const { data: tenant } = useQuery({
    queryKey: ["tenant", tenantId],
    enabled: !!tenantId,
    queryFn: () => fetchTenant(tenantId!),
  });

  useEffect(() => {
    if (tenant?.brand_primary) applyBrandPrimary(tenant.brand_primary);
    return () => removeBrandPrimary();
  }, [tenant?.brand_primary]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === "k") {
        e.preventDefault();
        if (copilotWebAllowed) openCopilot();
      } else if ((e.metaKey || e.ctrlKey) && k === "j") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openCopilot, copilotWebAllowed]);

  // Sync copilot context to current route/entity.
  useEffect(() => {
    setCopilotContext({
      // Historial único por usuario: la sesión siempre es "global".
      conversationKey: "global",
      entity: deriveEntity(location.pathname, location.search),
    });
  }, [location.pathname, location.search, setCopilotContext]);

  // Allow restart via global event (TopBar dispatches it from the avatar menu).
  useEffect(() => {
    const onRestart = () => {
      resetTour(user?.id);
      tour.start();
    };
    window.addEventListener("walix:restart-tour", onRestart);
    return () => window.removeEventListener("walix:restart-tour", onRestart);
  }, [tour, user?.id]);

  return (
    <div className="min-h-screen w-full flex bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <TrialBanner />
        <main className="flex-1 px-4 md:px-6 py-6 pb-24 md:pb-6">
          <Outlet />
        </main>
      </div>
      <BottomNav />
      {copilotWebAllowed && <CopilotDrawer />}
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <OnboardingTour open={tour.open} onClose={tour.close} />
    </div>
  );
}