import { Bell, Sparkles, Menu, LogOut, User as UserIcon, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { tenant } from "@/mock";
import { useEffect, useRef, useState } from "react";
import { useAiDrawer } from "@/store/aiDrawer";
import { QUICK_AI_PROMPTS } from "@/mock/ai";

export function TopBar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const ask = useAiDrawer((s) => s.ask);
  const [focused, setFocused] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focused) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [focused]);

  const initials = (user?.user_metadata?.full_name ?? user?.email ?? "U")
    .split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const submitPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    ask(prompt);
    setPrompt("");
    setFocused(false);
  };

  const pickSuggestion = (p: string) => {
    ask(p);
    setPrompt("");
    setFocused(false);
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-card/80 backdrop-blur border-b border-border flex items-center gap-3 px-4 md:px-6">
      <Button variant="ghost" size="icon" className="md:hidden">
        <Menu className="h-5 w-5" />
      </Button>

      <div className="hidden lg:flex items-center gap-2 pr-3 border-r border-border">
        <div className="h-8 w-8 rounded-lg bg-gradient-brand grid place-items-center text-primary-foreground text-xs font-bold">
          {tenant.name[0]}
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">{tenant.name}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Plan {tenant.plan}</div>
        </div>
      </div>

      <form onSubmit={submitPrompt} className="flex-1 max-w-2xl" ref={wrapRef as any}>
        <div className={`relative group transition-all duration-200 ${focused ? "scale-[1.01]" : ""}`}>
          <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-accent" />
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder="Pregunta a tu IA... ej: ¿Cuáles son mis deals más calientes?"
            className={`pl-9 pr-20 h-10 bg-background border-border focus-visible:ring-primary rounded-xl transition-shadow ${focused ? "shadow-glow" : ""}`}
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
            </div>
          )}
        </div>
      </form>

      <Button variant="ghost" size="icon" className="relative">
        <Bell className="h-5 w-5" />
        <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-danger" />
      </Button>

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
          <DropdownMenuItem><UserIcon className="h-4 w-4 mr-2" /> Perfil</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut} className="text-danger focus:text-danger">
            <LogOut className="h-4 w-4 mr-2" /> Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}