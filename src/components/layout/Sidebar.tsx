import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Users, KanbanSquare, MessageCircle, BarChart3,
  Zap, Settings, Shield, Store, ChevronLeft, ChevronRight, Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/walix/Logo";
import { WBadge } from "@/components/walix/Badge";
import { useAiInboxCount } from "@/pages/app/AiInbox";

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUiStore();
  const { roles } = useAuth();
  const isAdmin = roles.includes("tenant_admin") || roles.includes("super_admin");
  const isSuperAdmin = roles.includes("super_admin");
  const aiCount = useAiInboxCount();

  const items = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/ai-inbox", label: "AI Inbox", icon: Sparkles, badge: aiCount > 0 ? aiCount : undefined, accent: true },
    { to: "/contacts", label: "Contactos", icon: Users },
    { to: "/pipeline", label: "Pipeline", icon: KanbanSquare },
    { to: "/whatsapp", label: "WhatsApp", icon: MessageCircle, badge: 12 },
    { to: "/reports", label: "Reportes", icon: BarChart3 },
    { to: "/automations", label: "Automatizaciones", icon: Zap },
  ];

  const adminItems = [
    ...(isAdmin ? [{ to: "/settings", label: "Configuración", icon: Settings }] : []),
    ...(isSuperAdmin ? [{ to: "/admin", label: "SuperAdmin", icon: Shield }] : []),
    { to: "/marketplace", label: "Marketplace", icon: Store },
  ];

  return (
    <aside className={cn(
      "hidden md:flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 sticky top-0 h-screen",
      sidebarCollapsed ? "w-16" : "w-60"
    )}>
      <div className={cn("h-16 flex items-center border-b border-sidebar-border", sidebarCollapsed ? "justify-center" : "px-5")}>
        <Logo collapsed={sidebarCollapsed} />
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {items.map((item) => (
          <NavItem key={item.to} {...item} collapsed={sidebarCollapsed} />
        ))}

        {adminItems.length > 0 && (
          <>
            <div className={cn("mt-6 mb-2 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold", sidebarCollapsed && "text-center px-0")}>
              {sidebarCollapsed ? "•••" : "Admin"}
            </div>
            {adminItems.map((item) => (
              <NavItem key={item.to} {...item} collapsed={sidebarCollapsed} />
            ))}
          </>
        )}
      </nav>

      <button
        onClick={toggleSidebar}
        className={cn(
          "h-10 mx-2 mb-3 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors",
          sidebarCollapsed ? "" : "gap-2 text-sm"
        )}
      >
        {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /> Colapsar</>}
      </button>
    </aside>
  );
}

function NavItem({ to, label, icon: Icon, badge, collapsed, accent }: any) {
  return (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      className={({ isActive }) => cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
        collapsed && "justify-center px-0",
        isActive
          ? "bg-primary text-primary-foreground shadow-glow"
          : accent
            ? "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon className={cn("h-[18px] w-[18px] shrink-0", accent && "text-accent")} />
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {!collapsed && badge && <WBadge variant="brand">{badge}</WBadge>}
      {collapsed && badge && (
        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-accent animate-pulse-glow" />
      )}
    </NavLink>
  );
}