import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Logo } from "@/components/walix/Logo";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  Sparkles,
  Star,
  ShieldCheck,
  MessageCircle,
  Zap,
  Crown,
  Building2,
  HelpCircle,
  Globe,
  CreditCard,
  Bot,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

type PlanKey = "pyme" | "growth" | "enterprise";

interface Plan {
  key: PlanKey;
  name: string;
  tagline: string;
  monthly: number;
  annual: number; // por mes pagando anual
  badge?: string;
  highlight?: boolean;
  cta: string;
  ctaTo: string;
  ctaVariant?: "default" | "outline";
  features: string[];
  icon: typeof Sparkles;
}

const PLANS: Plan[] = [
  {
    key: "pyme",
    name: "PyME",
    tagline: "Lo que el 70% del mercado necesita",
    monthly: 899,
    annual: 719,
    badge: "⭐ Recomendado",
    highlight: true,
    cta: "Empezar 14 días gratis",
    ctaTo: "/login?mode=signup&plan=pyme",
    icon: Star,
    features: [
      "5 usuarios",
      "Contactos ilimitados",
      "2 pipelines",
      "100 créditos WhatsApp / mes",
      "1,000 créditos de IA / mes",
      "Motor Walix IA · Estándar",
      "3 automatizaciones activas",
      "Clip + Mercado Libre",
      "Soporte prioritario + onboarding 48h",
    ],
  },
  {
    key: "growth",
    name: "Growth",
    tagline: "Para equipos que escalan",
    monthly: 1499,
    annual: 1199,
    cta: "Empezar 14 días gratis",
    ctaTo: "/login?mode=signup&plan=growth",
    icon: Zap,
    features: [
      "15 usuarios",
      "Todo lo de PyME",
      "150 créditos WhatsApp / mes",
      "4,000 créditos de IA / mes",
      "Motor Walix IA · Avanzado",
      "Automatizaciones ilimitadas",
      "Soporte dedicado + CSM",
    ],
  },
  {
    key: "enterprise",
    name: "Enterprise",
    tagline: "Para operaciones complejas",
    monthly: 2500,
    annual: 2000,
    cta: "Contactar ventas",
    ctaTo: "mailto:ventas@walix.ai?subject=Plan%20Enterprise",
    ctaVariant: "outline",
    icon: Crown,
    features: [
      "Usuarios ilimitados",
      "Todo lo de Growth",
      "250 créditos WhatsApp / mes",
      "10,000 créditos de IA / mes",
      "Motor Walix IA · Premium",
      "Todas las integraciones + API propia",
      "Soporte 24/7 + SLA",
    ],
  },
];

const DIFFERENTIATORS = [
  { icon: Globe, text: "Precio en MXN (no USD)" },
  { icon: MessageCircle, text: "WhatsApp API incluida (no add-on)" },
  { icon: Bot, text: "IA incluida en todos los planes" },
  { icon: Sparkles, text: "14 días de prueba gratis" },
  { icon: ShieldCheck, text: "Onboarding gratuito 48h" },
  { icon: CreditCard, text: "Sin costos ocultos" },
];

const COMPARISON_ROWS: { feature: string; values: Record<PlanKey, string | boolean> }[] = [
  { feature: "Usuarios incluidos", values: { pyme: "5", growth: "15", enterprise: "Ilimitados" } },
  { feature: "Contactos", values: { pyme: "Ilimitados", growth: "Ilimitados", enterprise: "Ilimitados" } },
  { feature: "Pipelines", values: { pyme: "2", growth: "5", enterprise: "Ilimitados" } },
  { feature: "Créditos WhatsApp / mes", values: { pyme: "100", growth: "150", enterprise: "250" } },
  { feature: "Créditos de IA / mes", values: { pyme: "1,000", growth: "4,000", enterprise: "10,000" } },
  { feature: "Motor de IA incluido", values: { pyme: "Estándar", growth: "Avanzado", enterprise: "Premium" } },
  { feature: "Motores alternos (OpenAI / Claude)", values: { pyme: false, growth: "OpenAI", enterprise: "OpenAI + Claude" } },
  { feature: "IA - Sugerencias", values: { pyme: true, growth: true, enterprise: true } },
  { feature: "IA - Scoring de leads", values: { pyme: true, growth: true, enterprise: true } },
  { feature: "IA - Resúmenes y propuestas", values: { pyme: false, growth: true, enterprise: true } },
  { feature: "Automatizaciones activas", values: { pyme: "3", growth: "Ilimitadas", enterprise: "Ilimitadas" } },
  { feature: "Integraciones (Clip, ML)", values: { pyme: true, growth: true, enterprise: true } },
  { feature: "API propia", values: { pyme: false, growth: false, enterprise: true } },
  { feature: "Soporte", values: { pyme: "Prioritario", growth: "Dedicado + CSM", enterprise: "24/7 + SLA" } },
  { feature: "Onboarding asistido", values: { pyme: "48h", growth: "Premium", enterprise: "White glove" } },
];

const FAQ = [
  {
    q: "¿Necesito tarjeta de crédito para empezar?",
    a: "No. Todos los planes incluyen 14 días de prueba gratis sin tarjeta ni cargo.",
  },
  {
    q: "¿Qué pasa cuando termina el trial?",
    a: "Tu cuenta queda en pausa hasta que actives un plan. Conservamos tus contactos y conversaciones; al activar el plan recuperas el acceso completo.",
  },
  {
    q: "¿Qué es un crédito de WhatsApp y uno de IA?",
    a: "Un crédito de WhatsApp equivale a un mensaje de plantilla enviado fuera de la ventana de 24 horas (responder dentro de la ventana no consume créditos). Un crédito de IA equivale a una acción del Copiloto o de un agente IA; los motores más potentes consumen más créditos por acción. Puedes comprar paquetes adicionales cuando los necesites.",
  },
  {
    q: "¿Puedo cancelar cuando quiera?",
    a: "Sí. No hay contratos forzosos ni penalizaciones. Cancelas desde tu panel y mantienes acceso hasta el fin del periodo pagado.",
  },
  {
    q: "¿Mis datos están seguros?",
    a: "Sí. Encriptación en tránsito y en reposo, RLS por tenant, respaldos diarios y servidores en la región LATAM.",
  },
  {
    q: "¿Cobran por agente de WhatsApp como otros?",
    a: "No. Los agentes incluidos en cada plan no tienen costo adicional. WhatsApp API es parte del producto, no un add-on.",
  },
  {
    q: "¿Qué incluye el onboarding 48h?",
    a: "Una sesión 1:1 con nuestro equipo para configurar tu pipeline, conectar WhatsApp, importar tus contactos y dejar lista la primera automatización en menos de 48 horas.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left py-4 hover:text-primary transition-colors"
      >
        <span className="font-medium pr-4">{q}</span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform shrink-0", open && "rotate-180")} />
      </button>
      {open && <p className="text-sm text-muted-foreground pb-4 pr-8 animate-fade-in">{a}</p>}
    </div>
  );
}

export default function Pricing() {
  const [annual, setAnnual] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const navigate = useNavigate();

  const formatMXN = (n: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur bg-background/80 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <Logo />
            <span className="hidden md:block text-xs text-muted-foreground border-l border-border pl-3">
              El CRM para PyMEs que venden por WhatsApp
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/login" className="hidden sm:block">
              <Button variant="ghost" size="sm">Iniciar sesión</Button>
            </Link>
            <Link to="/login?mode=signup">
              <Button size="sm" className="bg-gradient-brand text-primary-foreground">
                Empezar gratis
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 md:px-6 pt-12 md:pt-20 pb-8 text-center">
        <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/15 mb-4">
          🇲🇽 Hecho en México · Precios en MXN
        </Badge>
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
          Planes simples,{" "}
          <span className="bg-gradient-brand bg-clip-text text-transparent">sin sorpresas</span>
        </h1>
        <p className="mt-4 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
          WhatsApp API + IA + CRM, todo incluido. Sin add-ons, sin cobros por agente, sin contratos forzosos.
        </p>

        {/* Toggle mensual/anual */}
        <div className="mt-8 inline-flex items-center gap-3 bg-card border border-border rounded-full px-4 py-2 shadow-sm">
          <span className={cn("text-sm font-medium", !annual && "text-foreground", annual && "text-muted-foreground")}>
            Mensual
          </span>
          <Switch checked={annual} onCheckedChange={setAnnual} />
          <span className={cn("text-sm font-medium flex items-center gap-2", annual && "text-foreground", !annual && "text-muted-foreground")}>
            Anual
            <Badge className="bg-success/15 text-success border-success/30 hover:bg-success/20 text-[10px]">−20%</Badge>
          </span>
        </div>
      </section>

      {/* Plans grid */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const price = annual ? plan.annual : plan.monthly;
            const isContact = plan.key === "enterprise";
            return (
              <div
                key={plan.key}
                className={cn(
                  "relative rounded-2xl border bg-card p-6 flex flex-col",
                  plan.highlight
                    ? "border-primary border-2 shadow-glow lg:scale-[1.03] lg:-translate-y-1 z-10"
                    : "border-border shadow-card"
                )}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-gradient-brand text-primary-foreground border-0 shadow-glow">
                      {plan.badge}
                    </Badge>
                  </div>
                )}
                {plan.badge && !plan.highlight && (
                  <Badge variant="secondary" className="self-start mb-2 text-[10px]">
                    {plan.badge}
                  </Badge>
                )}

                <div className="flex items-center gap-2 mb-1">
                  <div className={cn(
                    "h-9 w-9 rounded-lg grid place-items-center",
                    plan.highlight ? "bg-gradient-brand text-primary-foreground" : "bg-muted text-foreground"
                  )}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-5 min-h-[2.5em]">{plan.tagline}</p>

                <div className="mb-5">
                  {price === 0 ? (
                    <div className="text-4xl font-bold tracking-tight">$0</div>
                  ) : (
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-4xl font-bold tracking-tight">{formatMXN(price)}</span>
                        <span className="text-sm text-muted-foreground">/mes</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        + IVA · {annual ? "facturado anualmente" : "facturado mensualmente"}
                      </div>
                      {annual && (
                        <div className="text-[11px] text-success mt-0.5 font-medium">
                          Ahorras {formatMXN((plan.monthly - plan.annual) * 12)} al año
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <Button
                  variant={plan.ctaVariant ?? "default"}
                  className={cn(
                    "w-full mb-5",
                    plan.highlight && "bg-gradient-brand text-primary-foreground hover:opacity-90 shadow-glow"
                  )}
                  onClick={() => {
                    if (isContact) window.location.href = plan.ctaTo;
                    else navigate(plan.ctaTo);
                  }}
                >
                  {plan.cta}
                </Button>

                <ul className="space-y-2.5 text-sm flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className={cn(
                        "h-4 w-4 mt-0.5 shrink-0",
                        plan.highlight ? "text-primary" : "text-success"
                      )} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Diferenciadores */}
        <div className="mt-10 rounded-2xl border border-border bg-muted/30 p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3 text-center">
            ¿Por qué Walix.ai vs HubSpot, Pipedrive o Zoho?
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {DIFFERENTIATORS.map(({ icon: Ic, text }) => (
              <div key={text} className="flex items-center gap-2 text-xs font-medium">
                <div className="h-7 w-7 rounded-md bg-success/15 text-success grid place-items-center shrink-0">
                  <Ic className="h-3.5 w-3.5" />
                </div>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Comparativa */}
        <div className="mt-10 text-center">
          <Button variant="outline" onClick={() => setShowCompare((v) => !v)}>
            {showCompare ? "Ocultar" : "Ver"} comparativa completa
            <ChevronDown className={cn("h-4 w-4 ml-2 transition-transform", showCompare && "rotate-180")} />
          </Button>
        </div>

        {showCompare && (
          <div className="mt-6 rounded-2xl border border-border bg-card overflow-hidden animate-fade-in">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Característica</th>
                    {PLANS.map((p) => (
                      <th key={p.key} className={cn("text-center px-4 py-3 font-semibold", p.highlight && "text-primary")}>
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row) => (
                    <tr key={row.feature} className="border-t border-border">
                      <td className="px-4 py-3 text-muted-foreground">{row.feature}</td>
                      {PLANS.map((p) => {
                        const v = row.values[p.key];
                        return (
                          <td key={p.key} className={cn("text-center px-4 py-3", p.highlight && "bg-primary/5")}>
                            {typeof v === "boolean" ? (
                              v ? <Check className="h-4 w-4 text-success mx-auto" /> : <span className="text-muted-foreground">—</span>
                            ) : (
                              <span className="font-medium">{v}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Banda contacto */}
      <section className="max-w-5xl mx-auto px-4 md:px-6 pb-12">
        <div className="rounded-2xl border border-border bg-gradient-soft p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-brand grid place-items-center shadow-glow">
              <Building2 className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <div className="font-semibold">¿No estás seguro qué plan elegir?</div>
              <div className="text-sm text-muted-foreground">Habla 15 min con un humano y te recomendamos el ideal.</div>
            </div>
          </div>
          <Button variant="outline" asChild>
            <a href="mailto:hola@walix.ai?subject=Quiero%20asesor%C3%ADa">Agendar llamada</a>
          </Button>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 md:px-6 pb-24">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            <HelpCircle className="h-4 w-4" /> Preguntas frecuentes
          </div>
          <h2 className="text-2xl md:text-3xl font-bold mt-2">Lo que más nos preguntan</h2>
        </div>
        <div className="rounded-2xl border border-border bg-card px-6">
          {FAQ.map((item) => (
            <FaqItem key={item.q} {...item} />
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <Logo />
            <span>© {new Date().getFullYear()} Walix.ai · Hecho en México 🇲🇽</span>
          </div>
          <div className="flex gap-4">
            <Link to="/login" className="hover:text-foreground">Iniciar sesión</Link>
            <a href="mailto:hola@walix.ai" className="hover:text-foreground">Contacto</a>
          </div>
        </div>
      </footer>
    </div>
  );
}