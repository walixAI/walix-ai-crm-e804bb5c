import { useState } from "react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/walix/Logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PackageRequestForm } from "@/components/walix/PackageRequestForm";
import {
  Sparkles,
  Star,
  ShieldCheck,
  MessageCircle,
  Zap,
  Crown,
  HelpCircle,
  Globe,
  CreditCard,
  Bot,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Pack {
  key: string;
  name: string;
  tagline: string;
  desc: string;
  badge?: string;
  highlight?: boolean;
  icon: typeof Sparkles;
}

const PACKS: Pack[] = [
  {
    key: "pyme",
    name: "PyME",
    tagline: "Lo que el 70% del mercado necesita",
    desc: "Para negocios que quieren ordenar sus ventas y atender WhatsApp desde un solo lugar.",
    badge: "⭐ Recomendado",
    highlight: true,
    icon: Star,
  },
  {
    key: "growth",
    name: "Growth",
    tagline: "Para equipos que escalan",
    desc: "Para equipos comerciales con varios asesores, automatizaciones e IA en el día a día.",
    icon: Zap,
  },
  {
    key: "enterprise",
    name: "Enterprise",
    tagline: "Para operaciones complejas",
    desc: "Para operaciones con múltiples equipos, números de WhatsApp e integraciones a la medida.",
    icon: Crown,
  },
];

const DIFFERENTIATORS = [
  { icon: Globe, text: "Hecho en México, en español" },
  { icon: MessageCircle, text: "WhatsApp API incluida (no add-on)" },
  { icon: Bot, text: "IA incluida en todos los paquetes" },
  { icon: Sparkles, text: "Prueba guiada con tu equipo" },
  { icon: ShieldCheck, text: "Onboarding asistido" },
  { icon: CreditCard, text: "Sin costos ocultos" },
];

const FAQ = [
  {
    q: "¿Cómo sé qué paquete me conviene?",
    a: "Déjanos tus datos en el formulario y un asesor revisa contigo tu operación: cuántas personas venden, cuánto WhatsApp usas y qué quieres automatizar. Con eso armamos la propuesta.",
  },
  {
    q: "¿Qué incluye Walix.ai?",
    a: "CRM con contactos y pipeline, inbox de WhatsApp Business, Copiloto con IA, automatizaciones, reportes y control de gastos y cobranza.",
  },
  {
    q: "¿Puedo usar mi propio número de WhatsApp Business?",
    a: "Sí. Cada empresa conecta su propio número de WhatsApp Business y conserva su historial y su marca.",
  },
  {
    q: "¿Mis datos están seguros?",
    a: "Sí. Encriptación en tránsito y en reposo, aislamiento por empresa a nivel base de datos y respaldos diarios.",
  },
  {
    q: "¿Hay contratos forzosos?",
    a: "No. Trabajamos con planes flexibles; lo definimos junto contigo en la propuesta.",
  },
  {
    q: "¿Qué incluye el onboarding?",
    a: "Una sesión 1:1 para configurar tu pipeline, conectar WhatsApp, importar tus contactos y dejar lista tu primera automatización.",
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
  const [selected, setSelected] = useState<string | undefined>();

  const scrollToForm = (name: string) => {
    setSelected(name);
    document.getElementById("solicitud")?.scrollIntoView({ behavior: "smooth" });
  };

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
            <Button size="sm" className="bg-gradient-brand text-primary-foreground" onClick={() => scrollToForm("Aún no lo sé")}>
              Solicitar información
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 md:px-6 pt-12 md:pt-20 pb-8 text-center">
        <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/15 mb-4">
          🇲🇽 Hecho en México
        </Badge>
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
          Paquetes{" "}
          <span className="bg-gradient-brand bg-clip-text text-transparent">a la medida</span>
        </h1>
        <p className="mt-4 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
          WhatsApp API + IA + CRM en un solo lugar. Cuéntanos de tu operación y te enviamos la propuesta ideal para tu empresa.
        </p>
      </section>

      {/* Packs grid */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch max-w-5xl mx-auto">
          {PACKS.map((pack) => {
            const Icon = pack.icon;
            return (
              <div
                key={pack.key}
                className={cn(
                  "relative rounded-2xl border bg-card p-6 flex flex-col",
                  pack.highlight
                    ? "border-primary border-2 shadow-glow lg:scale-[1.03] lg:-translate-y-1 z-10"
                    : "border-border shadow-card"
                )}
              >
                {pack.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-gradient-brand text-primary-foreground border-0 shadow-glow">
                      {pack.badge}
                    </Badge>
                  </div>
                )}

                <div className="flex items-center gap-2 mb-1">
                  <div className={cn(
                    "h-9 w-9 rounded-lg grid place-items-center",
                    pack.highlight ? "bg-gradient-brand text-primary-foreground" : "bg-muted text-foreground"
                  )}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-bold">{pack.name}</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-4">{pack.tagline}</p>
                <p className="text-sm text-muted-foreground flex-1">{pack.desc}</p>

                <Button
                  variant={pack.highlight ? "default" : "outline"}
                  className={cn(
                    "w-full mt-6",
                    pack.highlight && "bg-gradient-brand text-primary-foreground hover:opacity-90 shadow-glow"
                  )}
                  onClick={() => scrollToForm(pack.name)}
                >
                  Solicitar información
                </Button>
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
      </section>

      {/* Formulario */}
      <section id="solicitud" className="max-w-3xl mx-auto px-4 md:px-6 pb-16 scroll-mt-20">
        <div className="text-center mb-6">
          <h2 className="text-2xl md:text-3xl font-bold">Cuéntanos qué necesitas</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Respondemos con una propuesta personalizada para tu empresa.
          </p>
        </div>
        <PackageRequestForm key={selected} defaultPaquete={selected} />
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
            <a href="mailto:hola@walix.app" className="hover:text-foreground">Contacto</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
