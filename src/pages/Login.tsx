import { useEffect, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/walix/Logo";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const navigate = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    if (params.get("mode") === "signup") setMode("signup");
  }, [params]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
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
        navigate("/onboarding");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/dashboard");
      }
    } catch (err: any) {
      toast.error("Error", { description: err.message });
    } finally { setLoading(false); }
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

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input id="email" type="email" autoComplete="email" required
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@empresa.mx" className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required minLength={8}
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" className="h-11" />
          </div>

          <Button type="submit" disabled={loading} className="w-full h-11 bg-gradient-brand hover:opacity-90 text-primary-foreground font-semibold shadow-glow">
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