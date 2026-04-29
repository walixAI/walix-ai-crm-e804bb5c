import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, KanbanSquare, MessageCircle, MoreHorizontal,
  BarChart3, Sparkles, Zap, Store, Settings as SettingsIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const primary = [
  { to: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { to: "/contacts", label: "Contactos", icon: Users },
  { to: "/whatsapp", label: "WhatsApp", icon: MessageCircle, badge: true },
  { to: "/pipeline", label: "Pipeline", icon: KanbanSquare },
];

const more = [
  { to: "/reports", label: "Reportes", icon: BarChart3 },
  { to: "/ai-inbox", label: "AI Inbox", icon: Sparkles },
  { to: "/automations", label: "Automatizaciones", icon: Zap },
  { to: "/marketplace", label: "Marketplace", icon: Store },
  { to: "/settings", label: "Configuración", icon: SettingsIcon },
];

export function BottomNav() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <nav
      aria-label="Navegación principal"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card border-t border-border h-16 grid grid-cols-5 pb-[env(safe-area-inset-bottom)]"
    >
      {primary.map(({ to, label, icon: Icon, badge }) => (
        <NavLink
          key={to}
          to={to}
          aria-label={label}
          className={({ isActive }) =>
            cn(
              "relative flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
              isActive ? "text-primary" : "text-muted-foreground"
            )
          }
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
          {label}
          {badge && (
            <span
              role="status"
              aria-live="polite"
              className="absolute top-2 right-1/2 translate-x-3 h-2 w-2 rounded-full bg-accent animate-pulse-glow"
            />
          )}
        </NavLink>
      ))}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="Más opciones"
            className="relative flex flex-col items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
            Más
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
          <SheetHeader>
            <SheetTitle>Más opciones</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-3 mt-4">
            {more.map(({ to, label, icon: Icon }) => (
              <button
                key={to}
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate(to);
                }}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card p-4 hover:bg-muted/50 transition-colors animate-fade-in"
                aria-label={label}
              >
                <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
                <span className="text-xs font-medium text-center leading-tight">{label}</span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}