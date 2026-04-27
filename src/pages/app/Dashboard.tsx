import { KpiCard } from "@/components/walix/KpiCard";
import { WBadge } from "@/components/walix/Badge";
import { kpis, pipelineByStage, weeklyMessages, topAgents, recentConversations, aiSuggestions } from "@/mock";
import {
  Wallet, MessageSquare, Target, Clock, Sparkles, ArrowRight, TrendingUp
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area
} from "recharts";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";

const icons = [Wallet, MessageSquare, Target, Clock];

export default function Dashboard() {
  const { user } = useAuth();
  const name = (user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "ahí").split(" ")[0];

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Greeting + AI hero */}
      <div className="rounded-2xl bg-gradient-hero text-primary-foreground p-6 md:p-8 relative overflow-hidden shadow-glow">
        <div className="absolute -top-12 -right-12 h-48 w-48 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute -bottom-16 -left-8 h-48 w-48 rounded-full bg-primary-glow/30 blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-end gap-6 justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-white/15 backdrop-blur mb-3">
              <Sparkles className="h-3 w-3" /> Resumen IA · hoy
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">¡Hola, {name}! 👋</h1>
            <p className="mt-2 text-primary-foreground/80 max-w-xl text-sm md:text-base">
              Tienes <strong className="text-white">47 conversaciones sin responder</strong> y
              <strong className="text-white"> $156k en cotizaciones</strong> esperando seguimiento.
              La IA priorizó <strong className="text-white">8 leads calientes</strong> para ti.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {aiSuggestions.slice(0, 2).map((s) => (
              <button key={s} className="text-xs font-medium px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur border border-white/15 transition-colors">
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k, i) => (
          <KpiCard key={k.label} {...(k as any)} icon={icons[i]} accent={i === 0} />
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Mensajes esta semana</h3>
              <p className="text-xs text-muted-foreground">Entrantes vs salientes</p>
            </div>
            <WBadge variant="success"><TrendingUp className="h-3 w-3" /> +18%</WBadge>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyMessages} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} />
                <Area type="monotone" dataKey="in" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#gIn)" />
                <Area type="monotone" dataKey="out" stroke="hsl(var(--accent))" strokeWidth={2} fill="url(#gOut)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Pipeline por etapa</h3>
            <a href="/pipeline" className="text-xs text-primary font-medium inline-flex items-center gap-1 hover:gap-1.5 transition-all">
              Ver kanban <ArrowRight className="h-3 w-3" />
            </a>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineByStage} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="stage" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={80} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Conversaciones recientes</h3>
              <p className="text-xs text-muted-foreground">Bandeja WhatsApp · últimas 24h</p>
            </div>
            <a href="/whatsapp" className="text-xs text-primary font-medium">Ver todas</a>
          </div>
          <div className="space-y-1">
            {recentConversations.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/60 transition-colors cursor-pointer">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-accent-soft text-accent text-xs font-semibold">
                    {c.name.split(" ").map(s => s[0]).slice(0, 2).join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0">{c.time}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{c.last}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <WBadge variant={c.tag === "Cerrando" ? "success" : c.tag === "Cotizando" ? "info" : "neutral"}>
                    {c.tag}
                  </WBadge>
                  {c.unread > 0 && (
                    <span className="text-[10px] font-bold h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground grid place-items-center">
                      {c.unread}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Top vendedores</h3>
              <p className="text-xs text-muted-foreground">Este mes</p>
            </div>
            <WBadge variant="brand">{topAgents.length}</WBadge>
          </div>
          <div className="space-y-3">
            {topAgents.map((a, i) => (
              <div key={a.name} className="flex items-center gap-3">
                <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-gradient-brand text-primary-foreground text-xs font-semibold">
                    {a.avatar}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate">{a.name}</p>
                    <span className="text-sm font-semibold tabular-nums">${(a.revenue/1000).toFixed(1)}k</span>
                  </div>
                  <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-brand rounded-full"
                      style={{ width: `${(a.revenue / topAgents[0].revenue) * 100}%` }} />
                  </div>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums w-16 text-right">{a.deals} cierres</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}