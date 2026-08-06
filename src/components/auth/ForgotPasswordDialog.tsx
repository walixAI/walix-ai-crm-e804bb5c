import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, MailCheck, Send } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEmail?: string;
}

export function ForgotPasswordDialog({ open, onOpenChange, defaultEmail = "" }: Props) {
  const [email, setEmail] = useState(defaultEmail);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail(defaultEmail);
      setSent(false);
    }
  }, [open, defaultEmail]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!clean || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) {
      toast.error("Correo inválido", { description: "Escribe un correo electrónico válido." });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(clean, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err: any) {
      const msg = (err?.message || "").toLowerCase();
      if (msg.includes("rate") || msg.includes("too many")) {
        toast.error("Demasiados intentos", {
          description: "Espera unos minutos antes de solicitar otro enlace.",
        });
      } else {
        // No revelamos si el correo existe o no
        setSent(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{sent ? "Revisa tu correo" : "Recuperar contraseña"}</DialogTitle>
          <DialogDescription>
            {sent
              ? "Si la cuenta existe, te enviamos un enlace para crear una contraseña nueva. El enlace es de un solo uso."
              : "Te enviaremos un enlace para crear una contraseña nueva."}
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-4">
            <MailCheck className="h-5 w-5 text-success shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Enviado a <span className="font-medium text-foreground">{email.trim().toLowerCase()}</span>.
              Revisa también la carpeta de spam. Si no llega en unos minutos, vuelve a intentarlo.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="recovery-email">Correo electrónico</Label>
              <Input
                id="recovery-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@empresa.mx"
                className="h-11"
                required
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="bg-gradient-brand text-primary-foreground">
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Enviar enlace
              </Button>
            </DialogFooter>
          </form>
        )}

        {sent && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setSent(false)}>
              Usar otro correo
            </Button>
            <Button onClick={() => onOpenChange(false)} className="bg-gradient-brand text-primary-foreground">
              Entendido
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}