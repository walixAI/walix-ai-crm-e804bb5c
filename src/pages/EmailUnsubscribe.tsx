import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export default function EmailUnsubscribe() {
  const [p] = useSearchParams();
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const email = p.get("e") ?? "";
  async function confirm() {
    setState("busy");
    const { data, error } = await supabase.functions.invoke("email-public", { body: { t: p.get("t"), e: email, s: p.get("s") } });
    setState(error || data?.error ? "error" : "done");
  }
  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center space-y-4">
        {state === "done" ? (
          <><h1 className="text-xl font-semibold">Listo</h1><p className="text-sm text-muted-foreground">{email} ya no recibirá estos correos.</p></>
        ) : state === "error" ? (
          <><h1 className="text-xl font-semibold">Enlace no válido</h1><p className="text-sm text-muted-foreground">El enlace está incompleto o expiró.</p></>
        ) : (
          <><h1 className="text-xl font-semibold">Darse de baja</h1><p className="text-sm text-muted-foreground">¿Quieres dejar de recibir correos en {email}?</p>
            <Button onClick={confirm} disabled={state === "busy"}>{state === "busy" ? "Procesando…" : "Confirmar baja"}</Button></>
        )}
      </div>
    </div>
  );
}
