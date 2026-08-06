import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/walix/Logo";
import { evaluatePassword, passwordValid } from "@/lib/auth/password";
import { readRecoveryHash } from "@/lib/auth/recoveryHash";
import { ForgotPasswordDialog } from "@/components/auth/ForgotPasswordDialog";
import { Check, X, Eye, EyeOff, Loader2, KeyRound, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type State = "checking" | "ready" | "invalid";

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

async function resolveHomeRoute(): Promise<string> {
  try {
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

export default function ResetPassword() {
  const navigate = useNavigate();
  const [state, setState] = useState<State>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resendOpen, setResendOpen] = useState(false);
  const hashInfo = useMemo(() => readRecoveryHash(), []);

  const checks = useMemo(() => evaluatePassword(password), [password]);
  const pwOk = passwordValid(checks);
  const match = password.length > 0 && password === confirmPassword;
  const showMismatch = confirmPassword.length > 0 && !match;

  useEffect(() => {
    let cancelled = false;

    if (hashInfo.errorCode) {
      setState("invalid");
      return;
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled && session) setState("ready");
    });

    (async () => {
      // Damos margen a que el cliente procese el hash del enlace
      for (let i = 0; i < 20; i++) {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session) {
          setState("ready");
          return;
        }
        await new Promise((r) => setTimeout(r, 150));
      }
      if (!cancelled) setState("invalid");
    })();

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [hashInfo.errorCode]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwOk) {
      toast.error("Contraseña insegura", { description: "Cumple los 4 requisitos antes de continuar." });
      return;
    }
    if (!match) {
      toast.error("Las contraseñas no coinciden", { description: "Revisa el campo de confirmación." });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Contraseña actualizada", { description: "Ya puedes usar tu nueva contraseña." });
      const home = await resolveHomeRoute();
      navigate(home, { replace: true });
    } catch (err: any) {
      const msg = (err?.message || "").toLowerCase();
      if (msg.includes("weak") || msg.includes("pwned")) {
        toast.error("Contraseña insegura", {
          description: "Esta contraseña aparece en filtraciones públicas. Elige una más única.",
        });
      } else if (msg.includes("session") || msg.includes("jwt")) {
        setState("invalid");
      } else {
        toast.error("No pudimos actualizar tu contraseña", {
          description: err?.message || "Inténtalo de nuevo en unos segundos.",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-gradient-soft">
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute top-1/4 -left-20 w-[28rem] h-[28rem] rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-0 -right-20 w-[28rem] h-[28rem] rounded-full bg-accent/20 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md bg-card rounded-2xl shadow-2xl p-6 sm:p-8 animate-fade-in">
        <div className="mb-6 flex items-center justify-between">
          <Logo />
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground">
            Seguridad
          </span>
        </div>

        {state === "checking" && (
          <div className="py-10 flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Validando tu enlace…</p>
          </div>
        )}

        {state === "invalid" && (
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <h1 className="text-base font-semibold">Este enlace ya venció o fue usado</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Los enlaces de recuperación son de un solo uso y tienen vigencia limitada. Pide uno nuevo
                  y ábrelo desde el mismo dispositivo.
                </p>
              </div>
            </div>
            <Button
              onClick={() => setResendOpen(true)}
              className="w-full h-11 bg-gradient-brand text-primary-foreground font-semibold shadow-glow"
            >
              <KeyRound className="h-4 w-4 mr-2" />
              Enviar nuevo enlace
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => navigate("/login")}>
              Volver a iniciar sesión
            </Button>
          </div>
        )}

        {state === "ready" && (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold tracking-tight">Crea tu nueva contraseña</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Elige una contraseña segura para tu cuenta de Walix.ai.
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="new-password">Nueva contraseña</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-11 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <ul className="mt-2 space-y-1 rounded-md bg-muted/40 p-3" aria-live="polite">
                  <RequirementRow ok={checks.length} label="Al menos 10 caracteres" />
                  <RequirementRow ok={checks.letter} label="Incluye letras" />
                  <RequirementRow ok={checks.number} label="Incluye números" />
                  <RequirementRow ok={checks.symbol} label="Incluye un símbolo (! @ # $ …)" />
                </ul>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-new-password">Confirmar contraseña</Label>
                <div className="relative">
                  <Input
                    id="confirm-new-password"
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite tu contraseña"
                    aria-invalid={showMismatch}
                    className={cn("h-11 pr-10", showMismatch && "border-destructive focus-visible:ring-destructive")}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    aria-label={showConfirm ? "Ocultar contraseña" : "Mostrar contraseña"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {showMismatch && (
                  <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                    <X className="h-3.5 w-3.5" /> Las contraseñas no coinciden
                  </p>
                )}
                {match && (
                  <p className="text-xs text-success mt-1 flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" /> Las contraseñas coinciden
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={saving || !pwOk || !match}
                className="w-full h-11 bg-gradient-brand text-primary-foreground font-semibold shadow-glow"
              >
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <KeyRound className="h-4 w-4 mr-2" />}
                Guardar contraseña
              </Button>
            </form>
          </>
        )}

        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Hecho en México 🇲🇽 · Datos cifrados
        </div>
      </div>

      <ForgotPasswordDialog open={resendOpen} onOpenChange={setResendOpen} />
    </div>
  );
}