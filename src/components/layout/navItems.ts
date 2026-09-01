import {
  LayoutDashboard, Users, KanbanSquare, MessageCircle, BarChart3,
  Zap, Settings, Shield, Store, Sparkles, Building2, Globe2, CheckSquare, Bot, Sun, Receipt, Trophy, Megaphone,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useAiInboxCount } from "@/pages/app/AiInbox";
import { usePendingProposalsCount } from "@/lib/queries/aiProposals";
import { useTenantFeatures } from "@/lib/queries/tenantFeatures";

export interface NavItemDef {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  accent?: boolean;
}

/** Single source of truth for the app navigation (sidebar + mobile drawer). */
export function useNavItems(): { items: NavItemDef[]; adminItems: NavItemDef[] } {
  const { roles } = useAuth();
  const { can, canAccess } = usePermissions();
  const { data: features } = useTenantFeatures();
  const featureExpenses = features?.feature_expenses ?? true;
  const featureCampaigns = features?.feature_wa_campaigns ?? false;

  const isAdmin =
    roles.includes("tenant_admin") ||
    roles.includes("tenant_owner") ||
    roles.includes("platform_owner") ||
    roles.includes("platform_staff") ||
    roles.includes("super_admin");
  const isPlatform =
    roles.includes("platform_owner") ||
    roles.includes("platform_staff") ||
    roles.includes("super_admin");
  const isOrgOwner = roles.includes("org_owner");

  const aiCount = useAiInboxCount();
  const { total: proposalsCount } = usePendingProposalsCount();

  const items: NavItemDef[] = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/mi-dia", label: "Mi Día", icon: Sun, accent: true, badge: proposalsCount > 0 ? proposalsCount : undefined },
    { to: "/ai-inbox", label: "AI Inbox", icon: Sparkles, badge: aiCount > 0 ? aiCount : undefined, accent: true },
    { to: "/contacts", label: "Contactos", icon: Users },
    { to: "/pipeline", label: "Pipeline", icon: KanbanSquare },
    { to: "/tasks", label: "Tareas", icon: CheckSquare, badge: proposalsCount > 0 ? proposalsCount : undefined },
    ...(featureExpenses ? [{ to: "/gastos", label: "Gastos", icon: Receipt }] : []),
    ...(isAdmin ? [{ to: "/equipo", label: "Equipo", icon: Trophy }] : []),
    { to: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
    { to: "/reports", label: "Reportes", icon: BarChart3 },
    { to: "/automations", label: "Automatizaciones", icon: Zap },
    ...(featureCampaigns ? [{ to: "/campanas", label: "Campañas WA", icon: Megaphone }] : []),
  ].filter((i) => canAccess(i.to));

  const adminItems: NavItemDef[] = [
    ...(isOrgOwner ? [{ to: "/org", label: "Mi organización", icon: Building2 }] : []),
    ...(can("ai.manage") ? [{ to: "/settings?tab=agents", label: "Agentes IA", icon: Bot }] : []),
    ...(canAccess("/settings") ? [{ to: "/settings", label: "Configuración", icon: Settings }] : []),
    ...(isPlatform ? [{ to: "/platform", label: "Plataforma", icon: Globe2 }] : []),
    ...(isPlatform ? [{ to: "/admin", label: "SuperAdmin", icon: Shield }] : []),
    { to: "/marketplace", label: "Marketplace", icon: Store },
  ];

  return { items, adminItems };
}
