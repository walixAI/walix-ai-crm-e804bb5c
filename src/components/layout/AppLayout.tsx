import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { AiDrawer } from "@/components/walix/AiDrawer";
import { CommandPalette } from "@/components/walix/CommandPalette";
import { OnboardingTour, useAutoOnboardingTour, resetTour } from "@/components/walix/OnboardingTour";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useTenantId } from "@/lib/queries/tenant";
import { fetchTenant } from "@/services/tenant";
import { applyBrandPrimary, removeBrandPrimary } from "@/lib/branding";
import { TrialBanner } from "@/components/walix/TrialBanner";

export function AppLayout() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const tour = useAutoOnboardingTour();
  const { user } = useAuth();
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
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
        <main className="flex-1 px-4 md:px-6 py-6 pb-24 md:pb-6 animate-fade-in">
          <Outlet />
        </main>
      </div>
      <BottomNav />
      <AiDrawer />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <OnboardingTour open={tour.open} onClose={tour.close} />
    </div>
  );
}