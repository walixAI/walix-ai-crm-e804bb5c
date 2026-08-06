import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Building2, Mail, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type Invite = {
  valid: boolean;
  reason?: string;
  email?: string;
  role?: string;
  tenant_name?: string;
  has_account?: boolean;
};

const REASONS: Record<string, string> = {
  not_found: "El enlace de invitación no es válido o ya no existe.",
  already_accepted: "Esta invitación ya fue aceptada. Inicia sesión con tu correo.",
  expired: "Esta invitación expiró. Pide a tu administrador que te la reenvíe.",
};

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setInvite({ valid: false, reason: "not_found" });
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.rpc("get_invitation_public", { _token: token as any });
      if (cancelled) return;
      if (error) {
        setInvite({ valid: false, reason: "not_found" });
      } else {
        setInvite(data as unknown as Invite);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("invitation-signup", {
        body: { token, password, full_name: fullName.trim() || undefined },
      });
      const res = data as any;
      if (fnError || res?.error) throw new Error(res?.error ?? fnError?.message ?? "No se pudo crear tu cuenta.");

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: invite!.email!,
        password,
      });
      if (signInError) throw signInError;

      localStorage.removeItem("walix_pending_invite");
      setDone(true);
      toast.success(`¡Bienvenido a ${invite?.tenant_name ?? "Walix"}!`);
      setTimeout(() => navigate("/dashboard", { replace: true }), 900);
    } catch (err: any) {
      setError(err?.message ?? "No se pudo completar el registro.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen grid place-items-center p-6 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-xl">Invitación a Walix.ai</CardTitle>
          {invite?.tenant_name && (
            <CardDescription className="flex items-center justify-center gap-2">
              <Building2 className="h-4 w-4" />
              {invite.tenant_name}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && (
            <p className="text-muted-foreground flex items-center justify-center gap-2 py-6">
              <Loader2 className="h-4 w-4 animate-spin" /> Validando tu invitación…
            </p>
          )}

          {!loading && invite && !invite.valid && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-destructive">{REASONS[invite.reason ?? ""] ?? "No se pudo validar la invitación."}</p>
              <Button className="w-full" onClick={() => navigate("/login")}>
                Ir a iniciar sesión
              </Button>
            </div>
          )}

          {!loading && invite?.valid && done && (
            <p className="text-muted-foreground flex items-center justify-center gap-2 py-6">
              <CheckCircle2 className="h-4 w-4 text-primary" /> Listo, entrando a tu CRM…
            </p>
          )}

          {!loading && invite?.valid && !done && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="rounded-md border bg-muted/40 p-3 text-sm flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate">{invite.email}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Fuiste invitado a <strong>{invite.tenant_name}</strong>. Crea tu contraseña para entrar.
              </p>

              <div className="space-y-2">
                <Label htmlFor="fullName">Tu nombre</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nombre y apellido"
                  autoComplete="name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm">Confirmar contraseña</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repite tu contraseña"
                  autoComplete="new-password"
                  required
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear mi acceso y entrar
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
