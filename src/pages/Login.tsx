import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/walix/Logo";
import {
  Loader2,
  Check,
  X,
  LogIn,
  Sparkles,
  MessageCircle,
  Bot,
  Zap,
  ShieldCheck,
  ArrowRight,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ForgotPasswordDialog } from "@/components/auth/ForgotPasswordDialog";

const emailSchema = z
  .string()
  .trim()
  .min(1, "Ingresa tu correo electrónico")
  .max(255, "El correo es demasiado largo")
  .email("Correo electrónico inválido");

const BLOCKED_EMAIL_DOMAINS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "test.com",
  "test.test",
  "localhost",
]);

function validateEmail(email: string): string | null {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return parsed.error.issues[0].message;
  const domain = parsed.data.split("@")[1]?.toLowerCase();
  if (domain && BLOCKED_EMAIL_DOMAINS.has(domain)) {
    return "Usa un correo real (no se permiten dominios de prueba como example.com)";
  }
  return null;
}

interface PasswordChecks {
  length: boolean;
  letter: boolean;
  number: boolean;
  symbol: boolean;
}

function evaluatePassword(pw: string): PasswordChecks {
  return {
    length: pw.length >= 10,
    letter: /[a-zA-Z]/.test(pw),
    number: /\d/.test(pw),
    symbol: /[^a-zA-Z0-9]/.test(pw),
  };
}

function passwordValid(checks: PasswordChecks): boolean {
  return checks.length && checks.letter && checks.number && checks.symbol;
}

function translateAuthError(err: any): { title: string; description: string } {
  const code = err?.code || err?.error_code;
  const msg = (err?.message || "").toLowerCase();

  if (code === "weak_password" || msg.includes("weak") || msg.includes("pwned")) {
    return {
      title: "Contraseña insegura",
      description:
        "Esta contraseña aparece en filtraciones públicas. Elige una más única (mezcla letras, números y símbolos).",
    };
  }
  if (code === "email_address_invalid" || (msg.includes("email") && msg.includes("invalid"))) {
    return {
      title: "Correo no válido",
      description: "El proveedor rechazó este correo. Usa un dominio real (no example.com, test.com, etc.).",
    };
  }
  if (code === "user_already_exists" || msg.includes("already registered") || msg.includes("already been registered")) {
    return {
      title: "Esta cuenta ya existe",
      description: "Ya hay un usuario con ese correo. Intenta iniciar sesión.",
    };
  }
  if (code === "invalid_credentials" || msg.includes("invalid login")) {
    return {
      title: "Credenciales incorrectas",
      description: "El correo o la contraseña no coinciden. Revísalos e intenta de nuevo.",
    };
  }
  if (code === "email_not_confirmed" || msg.includes("not confirmed")) {
    return {
      title: "Correo sin confirmar",
      description: "Revisa tu bandeja de entrada y confirma tu cuenta antes de iniciar sesión.",
    };
  }
  if (code === "over_email_send_rate_limit" || msg.includes("rate limit") || msg.includes("too many")) {
    return {
      title: "Demasiados intentos",
      description: "Espera unos minutos antes de volver a intentar.",
    };
  }
  if (code === "signup_disabled" || msg.includes("signups not allowed")) {
    return {
      title: "Registros deshabilitados",
      description: "El registro está temporalmente cerrado. Contacta al administrador.",
    };
  }
  return {
    title: "No pudimos completar la acción",
    description: err?.message || "Inténtalo de nuevo en unos segundos.",
  };
}

async function waitForAuthContext(timeoutMs = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { user, contextLoading } = useAuthStore.getState();
    if (user && !contextLoading) return;
    await new Promise((r) => setTimeout(r, 100));
  }
}

async function resolveHomeRoute(): Promise<string> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "/dashboard";
    const { data: profile } = await supabase
      .from("profiles")
      .select("ui_prefs, onboarded")
      .eq("id", user.id)
      .maybeSingle();
    if (profile && (profile as any).onboarded === false) return "/onboarding";
    const mode = (profile as any)?.ui_prefs?.mode;
    return mode === "simple" ? "/mi-dia" : "/dashboard";
  } catch {
    return "/dashboard";
  }
}

function RequirementRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-xs">
      {ok ? (
        <Check className="h-3.5 w-3.5 text-success" aria-hidden />
      ) : (
        <X className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      )}
      <span className={ok ? "text-success" : "text-muted-foreground"}>{label}</span>
    </li>
  );
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [showPasswordHints, setShowPasswordHints] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [forgotOpen, setForgotOpen] = useState(false);
  const navigate = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    if (params.get("mode") === "signup") setMode("signup");
  }, [params]);

  const pwChecks = useMemo(() => evaluatePassword(password), [password]);
  const pwOk = passwordValid(pwChecks);

  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const showMismatch = confirmPassword.length > 0 && !passwordsMatch;

  const canSubmit =
    mode === "login"
      ? email.trim().length > 0 && password.length > 0
      : !emailError && email.trim().length > 0 && pwOk && passwordsMatch;

  const handleEmailBlur = () => {
    if (!email) return;
    setEmailError(validateEmail(email));
  };

  const switchMode = (next: "login" | "signup") => {
    if (next === mode) return;
    setMode(next);
    setEmailError(null);
    setShowPasswordHints(false);
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "signup") {
      const emailErr = validateEmail(email);
      if (emailErr) {
        setEmailError(emailErr);
        toast.error("Revisa tu correo", { description: emailErr });
        return;
      }
      if (!pwOk) {
        setShowPasswordHints(true);
        toast.error("Contraseña insegura", {
          description: "Cumple los 4 requisitos antes de continuar.",
        });
        return;
      }
      if (!passwordsMatch) {
        toast.error("Las contraseñas no coinciden", {
          description: "Revisa el campo de confirmación.",
        });
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/onboarding` },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("¡Cuenta creada!", {
            description: "Revisa tu correo para confirmar tu cuenta antes de continuar.",
          });
          setMode("login");
          return;
        }
        toast.success("¡Cuenta creada!", { description: "Vamos a configurar tu CRM" });
        await waitForAuthContext(3000);
        const pendingInvite = localStorage.getItem("walix_pending_invite");
        if (pendingInvite) {
          navigate(`/invitacion?token=${pendingInvite}`, { replace: true });
          return;
        }
        navigate("/onboarding");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        await waitForAuthContext(3000);
        const pending = localStorage.getItem("walix_pending_invite");
        if (pending) {
          navigate(`/invitacion?token=${pending}`, { replace: true });
          return;
        }
        const home = await resolveHomeRoute();
        navigate(home, { replace: true });
      }
    } catch (err: any) {
      const t = translateAuthError(err);
      toast.error(t.title, { description: t.description });
    } finally {
      setLoading(false);
    }
  };

  const isSignup = mode === "signup";

  const leftPanel = isSignup
    ? {
        eyebrow: "Empieza gratis",
        title: "Tu CRM con IA, listo en 2 minutos",
        subtitle:
          "Crea tu cuenta y configura tu CRM con WhatsApp e Inteligencia Artificial.",
        bullets: [
          { icon: MessageCircle, text: "WhatsApp + CRM en un solo lugar" },
          { icon: Bot, text: "IA que prioriza y responde por ti" },
          { icon: Zap, text: "Sin tarjeta · prueba 14 días" },
        ],
      }
    : {
        eyebrow: "Bienvenido de vuelta",
        title: "Continúa donde lo dejaste",
        subtitle: "Tus conversaciones, oportunidades y automatizaciones te esperan.",
        bullets: [
          { icon: MessageCircle, text: "Tus conversaciones siguen vivas" },
          { icon: Zap, text: "Tus pipelines y tareas, al día" },
          { icon: Bot, text: "IA lista para asistirte" },
        ],
      };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-gradient-soft">
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute top-1/4 -left-20 w-[28rem] h-[28rem] rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-0 -right-20 w-[28rem] h-[28rem] rounded-full bg-accent/20 blur-3xl" />
      </div>

      <div className="relative w-full max-w-[1040px] grid md:grid-cols-2 bg-card rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
        {/* Panel izquierdo: branding */}
        <aside className="hidden md:flex relative flex-col justify-between p-10 text-primary-foreground bg-gradient-hero overflow-hidden">
          <div className="absolute inset-0 opacity-40 pointer-events-none">
            <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-accent/40 blur-3xl" />
            <div className="absolute bottom-10 right-10 w-72 h-72 rounded-full bg-primary-glow/40 blur-3xl" />
          </div>

          <div className="relative">
            <Logo />
          </div>

          <div key={mode} className="relative animate-fade-in space-y-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur text-xs font-medium border border-white/15">
              {isSignup ? <Sparkles className="h-3.5 w-3.5" /> : <LogIn className="h-3.5 w-3.5" />}
              {leftPanel.eyebrow}
            </span>
            <h1 className="text-3xl font-bold tracking-tight leading-tight">
              {leftPanel.title}
            </h1>
            <p className="text-sm text-primary-foreground/80 leading-relaxed">
              {leftPanel.subtitle}
            </p>

            <ul className="space-y-3 pt-2">
              {leftPanel.bullets.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-sm">
                  <span className="grid place-items-center h-8 w-8 rounded-lg bg-white/10 border border-white/15">
                    <Icon className="h-4 w-4" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative flex items-center gap-2 text-[11px] text-primary-foreground/70">
            <ShieldCheck className="h-3.5 w-3.5" />
            Hecho en México 🇲🇽 · Datos cifrados
          </div>
        </aside>

        {/* Panel derecho: formulario */}
        <section className="relative p-6 sm:p-10">
          {/* Mini-header en móvil */}
          <div className="flex md:hidden items-center justify-between mb-6">
            <Logo />
            <span
              className={cn(
                "text-[11px] font-semibold px-2.5 py-1 rounded-full",
                isSignup
                  ? "bg-accent/15 text-accent"
                  : "bg-secondary text-secondary-foreground",
              )}
            >
              {isSignup ? "Crear cuenta · Gratis" : "Iniciar sesión"}
            </span>
          </div>

          {/* Tabs */}
          <div
            role="tablist"
            aria-label="Modo de acceso"
            className="relative grid grid-cols-2 p-1 rounded-xl bg-muted mb-6"
          >
            <button
              type="button"
              role="tab"
              aria-selected={!isSignup}
              onClick={() => switchMode("login")}
              className={cn(
                "relative z-10 flex items-center justify-center gap-2 h-10 rounded-lg text-sm font-semibold transition-all",
                !isSignup
                  ? "bg-gradient-brand text-primary-foreground shadow-glow"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <LogIn className="h-4 w-4" />
              Iniciar sesión
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isSignup}
              onClick={() => switchMode("signup")}
              className={cn(
                "relative z-10 flex items-center justify-center gap-2 h-10 rounded-lg text-sm font-semibold transition-all",
                isSignup
                  ? "bg-gradient-brand text-primary-foreground shadow-glow"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Sparkles className="h-4 w-4" />
              Crear cuenta
            </button>
          </div>

          {/* Header dinámico */}
          <div key={`head-${mode}`} className="mb-6 animate-fade-in">
            <h2 className="text-2xl font-bold tracking-tight">
              {isSignup ? "Crea tu cuenta" : "Inicia sesión"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {isSignup
                ? "Empieza gratis. Sin tarjeta de crédito."
                : "Accede a tu workspace de Walix.ai."}
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(null);
              }}
              onBlur={handleEmailBlur}
              placeholder="tu@empresa.mx"
              aria-invalid={!!emailError}
              aria-describedby={emailError ? "email-error" : undefined}
              className={cn("h-11", emailError && "border-destructive focus-visible:ring-destructive")}
            />
            {emailError && (
              <p id="email-error" className="text-xs text-destructive mt-1">
                {emailError}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Contraseña</Label>
              {!isSignup && (
                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  className="text-[11px] text-primary font-medium hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              )}
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete={isSignup ? "new-password" : "current-password"}
                required
                minLength={isSignup ? 10 : 1}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => isSignup && setShowPasswordHints(true)}
                placeholder="••••••••"
                className="h-11 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={showPassword}
                className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                tabIndex={0}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {isSignup && (showPasswordHints || password.length > 0) && (
              <ul
                className="mt-2 space-y-1 rounded-md bg-muted/40 p-3 animate-fade-in"
                aria-live="polite"
              >
                <RequirementRow ok={pwChecks.length} label="Al menos 10 caracteres" />
                <RequirementRow ok={pwChecks.letter} label="Incluye letras" />
                <RequirementRow ok={pwChecks.number} label="Incluye números" />
                <RequirementRow ok={pwChecks.symbol} label="Incluye un símbolo (! @ # $ …)" />
                <li className="text-[11px] text-muted-foreground pt-1">
                  Evita contraseñas comunes; serán rechazadas automáticamente.
                </li>
              </ul>
            )}
          </div>

          {isSignup && (
            <div className="space-y-1.5 animate-fade-in">
              <Label htmlFor="confirm-password">Confirmar contraseña</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite tu contraseña"
                  aria-invalid={showMismatch}
                  aria-describedby={showMismatch ? "confirm-error" : undefined}
                  className={cn(
                    "h-11 pr-10",
                    showMismatch && "border-destructive focus-visible:ring-destructive",
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-pressed={showConfirmPassword}
                  className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  tabIndex={0}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {showMismatch && (
                <p id="confirm-error" className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <X className="h-3.5 w-3.5" /> Las contraseñas no coinciden
                </p>
              )}
              {passwordsMatch && (
                <p className="text-xs text-success mt-1 flex items-center gap-1">
                  <Check className="h-3.5 w-3.5" /> Las contraseñas coinciden
                </p>
              )}
            </div>
          )}

            <Button
              type="submit"
              disabled={loading || !canSubmit}
              className="w-full h-11 bg-gradient-brand hover:opacity-90 text-primary-foreground font-semibold shadow-glow"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : isSignup ? (
                <Sparkles className="h-4 w-4 mr-2" />
              ) : (
                <LogIn className="h-4 w-4 mr-2" />
              )}
              {isSignup ? "Crear cuenta gratis" : "Entrar"}
            </Button>

            {isSignup && (
              <p className="text-[11px] text-center text-muted-foreground">
                Al crear tu cuenta aceptas los Términos y la Política de Privacidad.
              </p>
            )}
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {isSignup ? (
              <>
                ¿Ya tienes cuenta?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="inline-flex items-center gap-0.5 text-primary font-medium hover:underline"
                >
                  Inicia sesión <ArrowRight className="h-3 w-3" />
                </button>
              </>
            ) : (
              <>
                ¿Primera vez en Walix?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className="inline-flex items-center gap-0.5 text-primary font-medium hover:underline"
                >
                  Empieza gratis <ArrowRight className="h-3 w-3" />
                </button>
              </>
            )}
          </div>
        </section>
      </div>

      <ForgotPasswordDialog open={forgotOpen} onOpenChange={setForgotOpen} defaultEmail={email} />
    </div>
  );
}
