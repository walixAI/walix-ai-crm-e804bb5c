import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "error" | "done">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setState("error");
        setMessage("El enlace de invitación no es válido.");
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        localStorage.setItem("walix_pending_invite", token);
        navigate("/login", { replace: true });
        return;
      }
      const { data, error } = await supabase.rpc("accept_invitation", { _token: token as any });
      if (cancelled) return;
      const res = data as any;
      if (error || (res && res.error)) {
        setState("error");
        setMessage(error?.message ?? res?.error ?? "No se pudo aceptar la invitación.");
        return;
      }
      localStorage.removeItem("walix_pending_invite");
      setState("done");
      toast.success("¡Invitación aceptada!");
      setTimeout(() => navigate("/dashboard", { replace: true }), 1200);
    })();
    return () => { cancelled = true; };
  }, [token, navigate]);

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-xl font-semibold">Invitación a Walix.ai</h1>
        {state === "loading" && (
          <p className="text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Procesando tu invitación…
          </p>
        )}
        {state === "error" && (
          <>
            <p className="text-destructive text-sm">{message}</p>
            <Button onClick={() => navigate("/login")}>Ir a iniciar sesión</Button>
          </>
        )}
        {state === "done" && <p className="text-muted-foreground">Listo, entrando a tu CRM…</p>}
      </div>
    </main>
  );
}
