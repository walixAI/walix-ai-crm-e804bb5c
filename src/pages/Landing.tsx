import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  ArrowRight, Check, Moon, Sun, MessageCircle, Sparkles, Zap, KanbanSquare,
  BarChart3, Bot, Clock, ShieldCheck, Users, ChevronDown, Star, PlayCircle,
  CheckCheck, Phone, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/walix/Logo";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

/* ---------- Header ---------- */
function Header() {
  const { theme, toggle } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all",
        scrolled
          ? "border-b border-border/60 bg-background/80 backdrop-blur-xl"
          : "bg-transparent",
      )}
    >
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" aria-label="Walix.ai inicio"><Logo /></Link>
        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <a href="#producto" className="hover:text-foreground transition-colors">Producto</a>
          <a href="#como-funciona" className="hover:text-foreground transition-colors">Cómo funciona</a>
          <a href="#precios" className="hover:text-foreground transition-colors">Precios</a>
          <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            aria-label="Cambiar tema"
            className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card hover:bg-accent/10 transition-colors"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/login">Entrar</Link>
          </Button>
          <Button asChild size="sm" className="bg-gradient-brand hover:opacity-90 shadow-glow">
            <Link to="/login">Empieza gratis</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

/* ---------- WhatsApp-like mock ---------- */
function ChatMock() {
  return (
    <div className="relative mx-auto w-full max-w-[360px]">
      {/* glow */}
      <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-gradient-brand opacity-20 blur-3xl" />
      <div className="rounded-[2.25rem] border border-border bg-card p-2 shadow-card-hover">
        <div className="rounded-[1.85rem] overflow-hidden border border-border/80 bg-background">
          {/* header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-gradient-hero text-primary-foreground">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-sm font-semibold">MR</div>
            <div className="flex-1 leading-tight">
              <div className="text-sm font-semibold">María Rodríguez</div>
              <div className="text-[11px] text-white/70 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> en línea
              </div>
            </div>
            <Phone className="h-4 w-4 opacity-80" />
          </div>
          {/* messages */}
          <div className="space-y-2.5 px-3 py-4 bg-muted/30 min-h-[300px]">
            <Bubble side="them">Hola, ¿siguen vendiendo el paquete de 50 piezas?</Bubble>
            <Bubble side="them">¿Hacen factura?</Bubble>
            <Bubble side="me">¡Hola María! Sí, $4,200 con factura incluida. ¿Te lo aparto?</Bubble>
            <Bubble side="them">Sí porfa. ¿CDMX llega mañana?</Bubble>
            {/* AI suggestion */}
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3 mt-3">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-primary mb-1.5">
                <Sparkles className="h-3 w-3" /> Walix IA sugiere responder
              </div>
              <p className="text-xs text-foreground leading-relaxed">
                "Sí, llega mañana antes de las 7pm. ¿Te paso link de pago o prefieres
                transferencia? Apenas confirmes, separo tu pedido 🙌"
              </p>
              <div className="mt-2 flex gap-1.5">
                <button className="flex-1 rounded-md bg-primary text-primary-foreground text-[11px] font-medium py-1.5">Enviar</button>
                <button className="rounded-md border border-border text-[11px] py-1.5 px-2">Editar</button>
              </div>
            </div>
          </div>
          {/* input */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-t border-border bg-card">
            <div className="flex-1 rounded-full bg-muted px-3 py-2 text-xs text-muted-foreground">Escribe un mensaje…</div>
            <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-brand">
              <MessageCircle className="h-4 w-4 text-primary-foreground" />
            </div>
          </div>
        </div>
      </div>
      {/* floating pipeline card */}
      <div className="hidden sm:block absolute -left-12 top-16 w-[200px] rounded-2xl border border-border bg-card p-3 shadow-card-hover animate-fade-in">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-2">
          <span className="font-semibold text-foreground">Pipeline · hoy</span>
          <KanbanSquare className="h-3.5 w-3.5" />
        </div>
        <Row name="María R." stage="Negociación" amount="$4,200" tone="success" />
        <Row name="Carlos M." stage="Cotización" amount="$8,900" tone="info" />
        <Row name="Pedro L." stage="Cierre" amount="$2,400" tone="warning" />
      </div>
      {/* floating KPI */}
      <div className="hidden sm:flex absolute -right-10 bottom-12 items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-card-hover animate-fade-in">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-success/15 text-success">
          <Zap className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Cierres hoy</div>
          <div className="text-lg font-bold">+47%</div>
        </div>
      </div>
    </div>
  );
}

function Bubble({ side, children }: { side: "me" | "them"; children: React.ReactNode }) {
  const me = side === "me";
  return (
    <div className={cn("flex", me ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-sm",
          me
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-card text-foreground rounded-bl-sm border border-border",
        )}
      >
        {children}
        {me && (
          <div className="mt-0.5 flex justify-end">
            <CheckCheck className="h-3 w-3 opacity-80" />
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ name, stage, amount, tone }: { name: string; stage: string; amount: string; tone: "success" | "info" | "warning" }) {
  const dot = tone === "success" ? "bg-success" : tone === "info" ? "bg-info" : "bg-warning";
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
        <div className="min-w-0">
          <div className="text-xs font-medium truncate">{name}</div>
          <div className="text-[10px] text-muted-foreground">{stage}</div>
        </div>
      </div>
      <span className="text-xs font-semibold tabular-nums">{amount}</span>
    </div>
  );
}

/* ---------- Hero ---------- */
function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* bg orbs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-[-20%] left-[10%] h-[500px] w-[500px] rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute bottom-[-10%] right-[5%] h-[420px] w-[420px] rounded-full bg-accent/15 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,hsl(var(--border))_1px,transparent_0)] [background-size:32px_32px] opacity-40 dark:opacity-20" />
      </div>

      <div className="container pt-16 pb-24 lg:pt-24 lg:pb-32">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          <div className="max-w-xl animate-fade-in">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground mb-6">
              <span className="grid h-4 w-4 place-items-center rounded-full bg-gradient-brand">
                <Sparkles className="h-2.5 w-2.5 text-primary-foreground" />
              </span>
              CRM con IA hecho para PyMEs mexicanas
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
              Si sabes usar <span className="text-gradient-brand">WhatsApp</span>,
              <br className="hidden sm:block" /> sabes usar Walix.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              El CRM que vive donde ya están tus clientes. Mismo WhatsApp, el doble de
              cierres. Sin manuales, sin esperas: en 5 minutos estás cerrando leads.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="bg-gradient-brand hover:opacity-90 shadow-glow text-base h-12 px-6">
                <Link to="/login">Empieza gratis <ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
              <Button variant="outline" size="lg" className="h-12 px-6 text-base">
                <PlayCircle className="mr-2 h-4 w-4" /> Ver demo de 90s
              </Button>
            </div>
            <div className="mt-6 flex items-center gap-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-success" /> 14 días gratis</span>
              <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-success" /> Sin tarjeta</span>
              <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-success" /> Setup en 5 min</span>
            </div>
          </div>
          <div className="relative">
            <ChatMock />
          </div>
        </div>

        {/* Logos / proof */}
        <div className="mt-20 lg:mt-28 border-t border-border pt-10">
          <p className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground mb-6">
            Más de 1,200 equipos de venta ya cierran con Walix
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 opacity-70">
            {["Tortillería La Joya", "Distribuidora Norte", "Boutique Marisol", "Refacciones MX", "Grupo Rivera", "Café del Centro"].map((n) => (
              <span key={n} className="text-sm font-semibold text-muted-foreground tracking-tight">{n}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Problem / Solution ---------- */
function ProblemSolution() {
  const pain = [
    "40 mensajes sin responder al cerrar el día",
    "Leads perdidos en cuatro celulares distintos",
    "Cero idea de qué prometiste hace dos semanas",
    "Vendedor se va y se lleva los clientes",
  ];
  const win = [
    "IA contesta primero, tú solo cierras",
    "Bandeja única para todo el equipo",
    "Historial completo del cliente, siempre",
    "Conversaciones tuyas, no de tu vendedor",
  ];
  return (
    <section className="container py-20 lg:py-28">
      <div className="grid lg:grid-cols-2 gap-6 lg:gap-10">
        <div className="rounded-3xl border border-border bg-card p-8 lg:p-10">
          <div className="text-xs font-semibold uppercase tracking-wider text-danger mb-4">Antes de Walix</div>
          <h3 className="text-2xl lg:text-3xl font-bold tracking-tight mb-6">
            Vendes mucho. Pero pierdes más.
          </h3>
          <ul className="space-y-3">
            {pain.map((p) => (
              <li key={p} className="flex items-start gap-3 text-muted-foreground">
                <span className="mt-1 grid h-5 w-5 place-items-center rounded-full bg-danger/10 text-danger text-xs">×</span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5 p-8 lg:p-10 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gradient-brand opacity-20 blur-2xl" />
          <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-4">Con Walix</div>
          <h3 className="text-2xl lg:text-3xl font-bold tracking-tight mb-6">
            Mismo WhatsApp. El doble de cierres.
          </h3>
          <ul className="space-y-3">
            {win.map((p) => (
              <li key={p} className="flex items-start gap-3 text-foreground">
                <span className="mt-0.5 grid h-5 w-5 place-items-center rounded-full bg-success/15 text-success">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ---------- Features ---------- */
function Features() {
  const items = [
    { icon: Bot, title: "IA que vende contigo", desc: "Sugiere respuestas, califica leads y agenda seguimientos automáticamente. Tú apruebas, ella ejecuta." },
    { icon: MessageCircle, title: "Bandeja unificada de WhatsApp", desc: "Todos los chats del equipo en un solo lugar. Asigna, transfiere y nunca pierdas un cliente otra vez." },
    { icon: KanbanSquare, title: "Pipeline drag-and-drop", desc: "Arrastra deals entre etapas. Mira en segundos qué cierra esta semana y qué necesita un empujón." },
    { icon: BarChart3, title: "Reportes en tiempo real", desc: "Cuánto vendió cada agente, qué etapa frena tu pipeline, qué producto pega más. Sin Excel." },
    { icon: Zap, title: "Automatizaciones sin código", desc: "Si un lead deja de responder 24h, Walix lo recuerda. Si pide cotización, le manda PDF al instante." },
    { icon: ShieldCheck, title: "Datos tuyos, no del vendedor", desc: "Si un agente se va, los clientes se quedan. Cumplimiento y respaldos de nivel empresarial." },
  ];
  return (
    <section id="producto" className="container py-20 lg:py-28">
      <div className="max-w-2xl mb-14">
        <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">Producto</div>
        <h2 className="text-3xl lg:text-5xl font-bold tracking-tight">
          Todo lo que un equipo de ventas necesita.
          <span className="text-muted-foreground"> Nada que no use.</span>
        </h2>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="group rounded-2xl border border-border bg-card p-6 hover:border-primary/40 hover:shadow-card-hover transition-all"
          >
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-brand text-primary-foreground mb-5 shadow-glow">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-lg mb-2">{title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- How it works ---------- */
function HowItWorks() {
  const steps = [
    { n: "01", title: "Conecta tu WhatsApp", desc: "Escanea un QR. Listo. Sin migrar contactos, sin cambiar de número." },
    { n: "02", title: "La IA aprende tu negocio", desc: "Lee tus últimos chats y aprende cómo vendes, qué dices y a qué precio." },
    { n: "03", title: "Cierra más, en menos tiempo", desc: "Responde más rápido, da seguimiento solo y nunca olvida un lead." },
  ];
  return (
    <section id="como-funciona" className="relative py-20 lg:py-28">
      <div className="absolute inset-0 -z-10 bg-gradient-soft dark:bg-card/30" />
      <div className="container">
        <div className="max-w-2xl mb-14">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">Cómo funciona</div>
          <h2 className="text-3xl lg:text-5xl font-bold tracking-tight">
            En 5 minutos, no en 30 días.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Sin onboarding eterno. Sin "transformación digital". Pegas, conectas, vendes.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 relative">
          {steps.map((s, i) => (
            <div key={s.n} className="relative rounded-2xl border border-border bg-card p-7">
              <div className="text-5xl font-bold text-gradient-brand mb-4">{s.n}</div>
              <h3 className="text-xl font-semibold mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              {i < steps.length - 1 && (
                <ArrowRight className="hidden md:block absolute top-1/2 -right-5 -translate-y-1/2 h-5 w-5 text-muted-foreground/40" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Stats / Testimonials ---------- */
function Testimonials() {
  const stats = [
    { v: "2.3×", l: "más cierres en 30 días" },
    { v: "<3min", l: "tiempo medio de respuesta" },
    { v: "1,200+", l: "equipos PyME activos" },
    { v: "98%", l: "de adopción al día 1" },
  ];
  const quotes = [
    {
      q: "Pasamos de 8 a 19 ventas semanales con el mismo equipo. La IA contesta lo aburrido y nosotros cerramos.",
      n: "Luis Hernández", r: "Distribuidora Norte · 12 vendedores",
    },
    {
      q: "Por fin sé qué prometió cada vendedor. Y si alguien renuncia, el cliente se queda conmigo, no con él.",
      n: "Marisol Vega", r: "Boutique Marisol · CDMX",
    },
    {
      q: "Lo conecté en domingo. El lunes ya estaba cerrando con plantillas que escribió Walix por mí.",
      n: "Roberto Pineda", r: "Refacciones MX · Monterrey",
    },
  ];
  return (
    <section className="container py-20 lg:py-28">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px rounded-3xl overflow-hidden border border-border bg-border mb-16">
        {stats.map((s) => (
          <div key={s.l} className="bg-card p-6 lg:p-8 text-center">
            <div className="text-3xl lg:text-4xl font-bold text-gradient-brand">{s.v}</div>
            <div className="mt-2 text-xs lg:text-sm text-muted-foreground">{s.l}</div>
          </div>
        ))}
      </div>
      <div className="grid md:grid-cols-3 gap-5">
        {quotes.map((q) => (
          <figure key={q.n} className="rounded-2xl border border-border bg-card p-6 flex flex-col">
            <div className="flex gap-0.5 mb-4 text-warning">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-current" />
              ))}
            </div>
            <blockquote className="text-sm leading-relaxed text-foreground flex-1">"{q.q}"</blockquote>
            <figcaption className="mt-5 pt-4 border-t border-border">
              <div className="text-sm font-semibold">{q.n}</div>
              <div className="text-xs text-muted-foreground">{q.r}</div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/* ---------- Pricing ---------- */
function Pricing() {
  const tiers = [
    {
      name: "Starter", price: "$499", per: "/mes",
      desc: "Para el dueño que vende solo.",
      features: ["1 número de WhatsApp", "1 usuario", "Pipeline + contactos", "100 sugerencias IA / mes"],
      cta: "Empezar gratis", highlight: false,
    },
    {
      name: "Growth", price: "$1,499", per: "/mes",
      desc: "Para equipos que ya cierran en serio.",
      features: ["3 números WhatsApp", "Hasta 8 usuarios", "Automatizaciones ilimitadas", "IA ilimitada", "Reportes avanzados"],
      cta: "Probar 14 días", highlight: true,
    },
    {
      name: "Scale", price: "Custom", per: "",
      desc: "Para PyMEs en expansión nacional.",
      features: ["Números ilimitados", "Usuarios ilimitados", "Roles y permisos", "Soporte dedicado", "SLA 99.9%"],
      cta: "Hablar con ventas", highlight: false,
    },
  ];
  return (
    <section id="precios" className="container py-20 lg:py-28">
      <div className="max-w-2xl mx-auto text-center mb-14">
        <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">Precios</div>
        <h2 className="text-3xl lg:text-5xl font-bold tracking-tight">
          Paga menos que un vendedor junior.
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Y vende como si tuvieras tres.
        </p>
      </div>
      <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
        {tiers.map((t) => (
          <div
            key={t.name}
            className={cn(
              "relative rounded-2xl border bg-card p-7 flex flex-col",
              t.highlight ? "border-primary shadow-glow" : "border-border",
            )}
          >
            {t.highlight && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-brand text-primary-foreground text-[11px] font-semibold px-3 py-1">
                Más popular
              </span>
            )}
            <div className="mb-1 text-sm font-semibold">{t.name}</div>
            <div className="text-xs text-muted-foreground mb-5">{t.desc}</div>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-bold tracking-tight">{t.price}</span>
              <span className="text-sm text-muted-foreground">{t.per}</span>
            </div>
            <ul className="space-y-2.5 mb-7 flex-1">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Button asChild className={cn(t.highlight ? "bg-gradient-brand hover:opacity-90 shadow-glow" : "", "w-full")} variant={t.highlight ? "default" : "outline"}>
              <Link to="/login">{t.cta}</Link>
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- FAQ ---------- */
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 py-5 text-left"
      >
        <span className="font-medium">{q}</span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <p className="pb-5 text-sm text-muted-foreground leading-relaxed">{a}</p>}
    </div>
  );
}

function FAQ() {
  const faqs = [
    { q: "¿Necesito cambiar mi número de WhatsApp?", a: "No. Walix se conecta a tu WhatsApp Business actual o a la API oficial. Tus clientes te siguen escribiendo al mismo número de siempre." },
    { q: "¿Qué pasa con mis chats anteriores?", a: "Walix importa tu historial reciente para que la IA aprenda cómo vendes. Nada se pierde." },
    { q: "¿La IA contesta sola sin que yo apruebe?", a: "Tú decides. Por defecto la IA sugiere y tú apruebas con un clic. También puedes activar respuestas automáticas para preguntas frecuentes." },
    { q: "¿Funciona si tengo varios vendedores?", a: "Sí, fue diseñado para eso. Bandeja unificada, asignación de chats por vendedor, reportes individuales y por equipo." },
    { q: "¿Mis datos están seguros?", a: "Cifrado end-to-end, respaldos diarios, servidores en México y cumplimiento con LFPDPPP. Los chats son tuyos, no del vendedor." },
    { q: "¿Puedo cancelar cuando quiera?", a: "Sí, sin penalizaciones ni contratos largos. Cancelas con un clic y exportas todos tus datos." },
  ];
  return (
    <section id="faq" className="container py-20 lg:py-28">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">Preguntas frecuentes</div>
          <h2 className="text-3xl lg:text-5xl font-bold tracking-tight">
            Lo que todos preguntan antes de probarlo.
          </h2>
        </div>
        <div>
          {faqs.map((f) => <FAQItem key={f.q} {...f} />)}
        </div>
      </div>
    </section>
  );
}

/* ---------- Final CTA ---------- */
function FinalCTA() {
  return (
    <section className="container pb-20 lg:pb-28">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-hero p-10 lg:p-16 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--accent)/0.3),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,hsl(var(--primary-glow)/0.3),transparent_50%)]" />
        <div className="relative">
          <h2 className="text-3xl lg:text-5xl font-bold tracking-tight text-primary-foreground max-w-2xl mx-auto">
            Tu próximo cierre te está escribiendo ahora.
          </h2>
          <p className="mt-5 text-lg text-primary-foreground/80 max-w-xl mx-auto">
            Empieza gratis. En 5 minutos estás respondiendo más rápido que nunca.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="bg-background text-foreground hover:bg-background/90 h-12 px-6 text-base">
              <Link to="/login">Empieza gratis <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base bg-transparent border-white/30 text-primary-foreground hover:bg-white/10 hover:text-primary-foreground">
              <a href="#producto">Ver producto</a>
            </Button>
          </div>
          <div className="mt-6 text-xs text-primary-foreground/70">
            14 días gratis · Sin tarjeta · Cancela cuando quieras
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Footer ---------- */
function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="container py-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <div>
          <Logo />
          <p className="mt-4 text-sm text-muted-foreground max-w-xs">
            El CRM con WhatsApp + IA hecho para PyMEs mexicanas.
          </p>
        </div>
        <FCol title="Producto" links={["Funciones", "Precios", "Integraciones", "Novedades"]} />
        <FCol title="Empresa" links={["Sobre nosotros", "Blog", "Clientes", "Contacto"]} />
        <FCol title="Legal" links={["Términos", "Privacidad", "Aviso LFPDPPP", "Seguridad"]} />
      </div>
      <div className="border-t border-border">
        <div className="container py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Walix.ai · Hecho en México 🇲🇽</span>
          <span>Si sabes usar WhatsApp, sabes usar Walix.</span>
        </div>
      </div>
    </footer>
  );
}

function FCol({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <div className="text-sm font-semibold mb-3">{title}</div>
      <ul className="space-y-2 text-sm text-muted-foreground">
        {links.map((l) => (
          <li key={l}><a href="#" className="hover:text-foreground transition-colors">{l}</a></li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Page ---------- */
export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main>
        <Hero />
        <ProblemSolution />
        <Features />
        <HowItWorks />
        <Testimonials />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}