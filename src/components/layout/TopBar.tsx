import { Sparkles, Menu, LogOut, User as UserIcon, HelpCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useCopilot } from "@/store/copilot";
import { useCopilotWebAccess } from "@/hooks/useCopilotAccess";
import { TenantSwitcher } from "@/components/layout/TenantSwitcher";
import { NotificationsBell } from "@/components/notifications/NotificationsBell";
import { AgentsActivityIndicator } from "@/components/agents/AgentsActivityIndicator";

const ROTATING_PLACEHOLDERS = [
  "¿Qué oportunidades están en riesgo?",
  "Mueve Acme a Negociación",
  "Crea tarea: llamar a Pedro mañana 10am",
  "Agrega a María Pérez, tel 5551234567",
  "Resume las conversaciones sin responder",
  "Marca el oportunidad de Acme como ganado",
  "¿Cuánto vale mi pipeline hoy?",
];

export function TopBar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const openCopilot = useCopilot((s) => s.openDrawer);
  const { allowed: copilotWebAllowed } = useCopilotWebAccess();
  const proactiveCount = useCopilot((s) => s.proactiveCount);
  const refreshProactiveCount = useCopilot((s) => s.refreshProactiveCount);
  const [phIndex, setPhIndex] = useState(0);

  // Refresh proactive count on mount + every 60s.
  useEffect(() => {
    void refreshProactiveCount();
    const t = setInterval(() => void refreshProactiveCount(), 60_000);
    return () => clearInterval(t);
  }, [refreshProactiveCount]);

  // Rotating placeholders.
  useEffect(() => {
    const t = setInterval(() => setPhIndex((i) => (i + 1) % ROTATING_PLACEHOLDERS.length), 4000);
    return () => clearInterval(t);
  }, []);

  const initials = (user?.user_metadata?.full_name ?? user?.email ?? "U")
    .split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-card/80 backdrop-blur border-b border-border flex items-center gap-3 px-4 md:px-6">
      <Button variant="ghost" size="icon" className="md:hidden">
        <Menu className="h-5 w-5" />
      </Button>

      <div className="hidden lg:flex items-center gap-2 pr-3 border-r border-border">
        <TenantSwitcher />
      </div>

      <AgentsActivityIndicator />

      <div className="flex-1 max-w-2xl" data-tour="ai-prompt">
        {copilotWebAllowed && (
        <button
          type="button"
          onClick={openCopilot}
          className="relative group w-full text-left transition-all duration-200 hover:scale-[1.01]"
        >
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="absolute left-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gradient-to-br from-primary/15 to-accent/15 border border-primary/20 text-[9px] font-bold uppercase tracking-wide text-primary cursor-help">
                  <Zap className="h-2.5 w-2.5" /> Beta
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                Walix Copiloto puede ejecutar acciones (crear, mover, actualizar) — siempre te pide confirmar.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="pl-[68px] pr-20 h-10 flex items-center bg-background border border-border rounded-xl text-sm text-muted-foreground group-hover:border-primary/40 group-hover:shadow-glow transition-all">
            <Sparkles className="h-3.5 w-3.5 mr-2 text-accent shrink-0" />
            <span className="truncate">
              Pregunta a tu copiloto… <span className="opacity-70">ej: {ROTATING_PLACEHOLDERS[phIndex]}</span>
            </span>
          </div>
          {proactiveCount > 0 && (
            <span className="absolute left-[60px] top-2 h-2 w-2 rounded-full bg-destructive animate-pulse ring-2 ring-background" />
          )}
          <kbd className="hidden md:inline-flex absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">
            ⌘ K
          </kbd>
        </button>
        )}
      </div>

      <div data-tour="notifications">
        <NotificationsBell />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="rounded-full">
            <Avatar className="h-9 w-9 border-2 border-primary/20">
              <AvatarFallback className="bg-gradient-brand text-primary-foreground text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="font-medium">{user?.user_metadata?.full_name ?? "Mi cuenta"}</div>
            <div className="text-xs text-muted-foreground font-normal truncate">{user?.email}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate("/profile")}><UserIcon className="h-4 w-4 mr-2" /> Perfil</DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => window.dispatchEvent(new CustomEvent("walix:restart-tour"))}
          >
            <HelpCircle className="h-4 w-4 mr-2" /> Ver tour de bienvenida
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut} className="text-danger focus:text-danger">
            <LogOut className="h-4 w-4 mr-2" /> Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}