import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/walix/Logo";
import { Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  const [emailError, setEmailError] = useState<string | null>(null);
  const [showPasswordHints, setShowPasswordHints] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const navigate = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    if (params.get("mode") === "signup") setMode("signup");
  }, [params]);

  const pwChecks = useMemo(() => evaluatePassword(password), [password]);
  const pwOk = passwordValid(pwChecks);

  const canSubmit =
    mode === "login"
      ? email.trim().length > 0 && password.length > 0
      : !emailError && email.trim().length > 0 && pwOk;

  const handleEmailBlur = () => {
    if (!email) return;
    setEmailError(validateEmail(email));
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
        navigate("/onboarding");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        await waitForAuthContext(3000);
        navigate("/dashboard");
      }
    } catch (err: any) {
      const t = translateAuthError(err);
      toast.error(t.title, { description: t.description });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-gradient-hero">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-accent/30 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-primary-glow/40 blur-3xl" />
      </div>

      <div className="relative w-full max-w-[480px] bg-card rounded-2xl shadow-2xl p-8 md:p-10 animate-fade-in">
        <div className="flex flex-col items-center text-center mb-8">
          <Logo />
          <p className="mt-3 text-sm text-muted-foreground">
            Tu CRM con WhatsApp + IA incluidos
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
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={mode === "signup" ? 10 : 1}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => mode === "signup" && setShowPasswordHints(true)}
              placeholder="••••••••"
              className="h-11"
            />
            {mode === "signup" && (showPasswordHints || password.length > 0) && (
              <ul className="mt-2 space-y-1 rounded-md bg-muted/40 p-3" aria-live="polite">
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

          <Button
            type="submit"
            disabled={loading || !canSubmit}
            className="w-full h-11 bg-gradient-brand hover:opacity-90 text-primary-foreground font-semibold shadow-glow"
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {mode === "signup" ? "Crear cuenta" : "Entrar"}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "login" ? (
            <>¿Primera vez?{" "}
              <button onClick={() => setMode("signup")} className="text-primary font-medium hover:underline">
                Empieza gratis
              </button>
            </>
          ) : (
            <>¿Ya tienes cuenta?{" "}
              <button onClick={() => setMode("login")} className="text-primary font-medium hover:underline">
                Inicia sesión
              </button>
            </>
          )}
        </div>

        <div className="mt-6 pt-6 border-t border-border text-[11px] text-center text-muted-foreground">
          Hecho en México 🇲🇽 · CRM + WhatsApp + IA
        </div>
      </div>
    </div>
  );
}
