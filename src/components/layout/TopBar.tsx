import { Sparkles, Menu, LogOut, User as UserIcon, Inbox, HelpCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useAiDrawer } from "@/store/aiDrawer";
import { QUICK_AI_PROMPTS } from "@/lib/constants/aiPrompts";
import { TenantSwitcher } from "@/components/layout/TenantSwitcher";
import { NotificationsBell } from "@/components/notifications/NotificationsBell";
import type { AskAiContext } from "@/services/ai";

const ROTATING_PLACEHOLDERS = [
  "¿Qué oportunidades están en riesgo?",
  "Mueve Acme a Negociación",
  "Crea tarea: llamar a Pedro mañana 10am",
  "Agrega a María Pérez, tel 5551234567",
  "Resume las conversaciones sin responder",
  "Marca el oportunidad de Acme como ganado",
  "¿Cuánto vale mi pipeline hoy?",
];

function captureContext(pathname: string, search: string): AskAiContext {
  const ctx: AskAiContext = { route: pathname };
  const params = new URLSearchParams(search);
  // /pipeline?dealId=...
  if (pathname.startsWith("/pipeline")) {
    const dealId = params.get("dealId");
    if (dealId) { ctx.entityType = "deal"; ctx.entityId = dealId; }
  }
  // /contacts/:id
  const contactMatch = pathname.match(/^\/contacts\/([0-9a-f-]{36})/i);
  if (contactMatch) { ctx.entityType = "contact"; ctx.entityId = contactMatch[1]; }
  // /whatsapp?conversationId=...
  if (pathname.startsWith("/whatsapp")) {
    const cid = params.get("conversationId");
    if (cid) { ctx.entityType = "convo"; ctx.entityId = cid; }
  }
  return ctx;
}

export function TopBar() {
  // Intentionally untyped prop is ignored; the palette is opened via the
  // global ⌘K shortcut handled in AppLayout. The kbd hint stays as a visual
  // affordance that focusing the input also triggers IA suggestions.
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [prompt, setPrompt] = useState("");
  const ask = useAiDrawer((s) => s.ask);
  const [focused, setFocused] = useState(false);
  const [phIndex, setPhIndex] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focused) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [focused]);

  // Rotating placeholders, paused when input has text or is focused.
  useEffect(() => {
    if (focused || prompt.trim()) return;
    const t = setInterval(() => setPhIndex((i) => (i + 1) % ROTATING_PLACEHOLDERS.length), 4000);
    return () => clearInterval(t);
  }, [focused, prompt]);

  const initials = (user?.user_metadata?.full_name ?? user?.email ?? "U")
    .split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const submitPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    ask(prompt, captureContext(location.pathname, location.search));
    setPrompt("");
    setFocused(false);
  };

  const pickSuggestion = (p: string) => {
    ask(p, captureContext(location.pathname, location.search));
    setPrompt("");
    setFocused(false);
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-card/80 backdrop-blur border-b border-border flex items-center gap-3 px-4 md:px-6">
      <Button variant="ghost" size="icon" className="md:hidden">
        <Menu className="h-5 w-5" />
      </Button>

      <div className="hidden lg:flex items-center gap-2 pr-3 border-r border-border">
        <TenantSwitcher />
      </div>

      <form onSubmit={submitPrompt} className="flex-1 max-w-2xl" ref={wrapRef as any} data-tour="ai-prompt">
        <div className={`relative group transition-all duration-200 ${focused ? "scale-[1.01]" : ""}`}>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="absolute left-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gradient-to-br from-primary/15 to-accent/15 border border-primary/20 text-[9px] font-bold uppercase tracking-wide text-primary cursor-help">
                  <Zap className="h-2.5 w-2.5" /> Beta
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                Walix.ai puede ejecutar acciones (crear, mover, actualizar) — siempre te pide confirmar.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder={`Pregunta o instruye a tu IA… ej: ${ROTATING_PLACEHOLDERS[phIndex]}`}
            className={`pl-[68px] pr-20 h-10 bg-background border-border focus-visible:ring-primary rounded-xl transition-shadow ${focused ? "shadow-glow" : ""}`}
          />
          <kbd className="hidden md:inline-flex absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">
            ⌘ K
          </kbd>

          {focused && (
            <div className="absolute left-0 right-0 top-12 z-40 rounded-xl border border-border bg-popover shadow-lg p-2 animate-in fade-in slide-in-from-top-1">
              <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                Sugerencias rápidas
              </div>
              <div className="flex flex-wrap gap-1.5 px-1 pb-1">
                {QUICK_AI_PROMPTS.slice(0, 3).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); pickSuggestion(p); }}
                    className="text-xs px-2.5 py-1.5 rounded-full bg-muted hover:bg-primary/10 hover:text-primary border border-transparent hover:border-primary/20 transition-colors"
                  >
                    <Sparkles className="inline h-3 w-3 mr-1 text-accent" />{p}
                  </button>
                ))}
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); navigate("/ai-inbox"); setFocused(false); }}
                  className="text-xs px-2.5 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors"
                >
                  <Inbox className="inline h-3 w-3 mr-1" />Ver AI Inbox
                </button>
              </div>
              <div className="px-2 pt-1 pb-0.5 text-[10px] text-muted-foreground border-t border-border/60 mt-1">
                También puedo crear, mover y actualizar — siempre te pido confirmar.
              </div>
            </div>
          )}
        </div>
      </form>

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