import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantId } from "@/lib/queries/tenant";

export type Surface = "dashboard" | "mi_dia";

export interface DashboardWidget {
  id: string;
  tenant_id: string | null;
  key: string;
  name: string;
  description: string | null;
  surface: "dashboard" | "mi_dia" | "both";
  kind: "native" | "custom_metric";
  native_key: string | null;
  config: Record<string, unknown>;
  min_role: "user" | "admin" | "owner";
  is_active: boolean;
  is_mandatory: boolean;
  default_position: number;
}

export interface LayoutItem {
  key: string;         // widget.key
  position: number;
  hidden?: boolean;
}

export interface DashboardLayout {
  id: string;
  tenant_id: string;
  scope: string;       // 'tenant_default' | 'role:<role>' | 'user:<uuid>'
  surface: Surface;
  items: LayoutItem[];
}

export function useWidgetsCatalog(surface: Surface) {
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["dashboard-widgets", surface, tenantId],
    enabled: !!tenantId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dashboard_widgets" as any)
        .select("*")
        .in("surface", [surface, "both"])
        .eq("is_active", true);
      if (error) throw error;
      return (data ?? []) as unknown as DashboardWidget[];
    },
  });
}

export function useDashboardLayouts(surface: Surface) {
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["dashboard-layouts", surface, tenantId],
    enabled: !!tenantId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dashboard_layouts" as any)
        .select("*")
        .eq("surface", surface);
      if (error) throw error;
      return (data ?? []) as unknown as DashboardLayout[];
    },
  });
}

export interface ResolvedWidget {
  widget: DashboardWidget;
  position: number;
  hidden: boolean;
}

/**
 * Cascada: user:<uid> → role:<role> → tenant_default → catálogo default_position.
 * Devuelve todos los widgets con su posición y visibilidad efectiva.
 */
export function useResolvedLayout(surface: Surface) {
  const { user, roles } = useAuth();
  const catalog = useWidgetsCatalog(surface);
  const layouts = useDashboardLayouts(surface);

  return useMemo(() => {
    const widgets = catalog.data ?? [];
    const all = layouts.data ?? [];
    const uid = user?.id ?? "";

    const userScope = `user:${uid}`;
    const userLayout = all.find((l) => l.scope === userScope);
    const roleLayout =
      roles.map((r) => all.find((l) => l.scope === `role:${r}`)).find(Boolean) ?? null;
    const tenantLayout = all.find((l) => l.scope === "tenant_default") ?? null;

    const map = new Map<string, ResolvedWidget>();
    for (const w of widgets) {
      map.set(w.key, { widget: w, position: w.default_position, hidden: false });
    }
    const apply = (layout: DashboardLayout | null) => {
      if (!layout) return;
      for (const item of layout.items ?? []) {
        const cur = map.get(item.key);
        if (!cur) continue;
        map.set(item.key, {
          widget: cur.widget,
          position: item.position,
          hidden: !!item.hidden,
        });
      }
    };
    apply(tenantLayout);
    apply(roleLayout);
    apply(userLayout);

    const list = Array.from(map.values()).sort((a, b) => a.position - b.position);
    return {
      isLoading: catalog.isLoading || layouts.isLoading,
      widgets: list,
      byKey: (k: string) => map.get(k),
      isVisible: (k: string) => {
        const r = map.get(k);
        return !!r && !r.hidden;
      },
      hasUserOverride: !!userLayout,
      tenantLayout,
      roleLayout,
      userLayout,
    };
  }, [catalog.data, catalog.isLoading, layouts.data, layouts.isLoading, roles, user?.id]);
}

export function useSaveLayout(surface: Surface) {
  const qc = useQueryClient();
  const { data: tenantId } = useTenantId();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ scope, items }: { scope: string; items: LayoutItem[] }) => {
      if (!tenantId) throw new Error("Sin tenant");
      const { error } = await supabase
        .from("dashboard_layouts" as any)
        .upsert(
          { tenant_id: tenantId, scope, surface, items, updated_by: user?.id ?? null } as any,
          { onConflict: "tenant_id,scope,surface" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard-layouts", surface] });
    },
  });
}

export function useResetUserLayout(surface: Surface) {
  const qc = useQueryClient();
  const { data: tenantId } = useTenantId();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async () => {
      if (!tenantId || !user?.id) throw new Error("Sin sesión");
      const { error } = await supabase
        .from("dashboard_layouts" as any)
        .delete()
        .eq("tenant_id", tenantId)
        .eq("surface", surface)
        .eq("scope", `user:${user.id}`);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard-layouts", surface] });
    },
  });
}

export function useToggleWidgetMandatory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ widgetKey, isMandatory }: { widgetKey: string; isMandatory: boolean }) => {
      // Only makes sense for native widgets — we override via tenant-scoped rows if needed later.
      // For Fase 1 we let admins set mandatory only on custom widgets they created.
      const { error } = await supabase
        .from("dashboard_widgets" as any)
        .update({ is_mandatory: isMandatory } as any)
        .eq("key", widgetKey);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dashboard-widgets"] }),
  });
}