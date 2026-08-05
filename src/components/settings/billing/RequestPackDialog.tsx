import { useState } from "react";
import { z } from "zod";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Send } from "lucide-react";

const schema = z.object({
  nombre: z.string().trim().min(1, "Escribe tu nombre").max(100),
  email: z.string().trim().email("Correo inválido").max(255),
  telefono: z.string().trim().max(30).optional().or(z.literal("")),
  cantidad: z.string().trim().max(20).optional().or(z.literal("")),
  mensaje: z.string().trim().max(1000).optional().or(z.literal("")),
});

export function RequestPackDialog({
  open, onOpenChange, packLabel, tipo, tenantId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  packLabel: string;
  tipo: string;
  tenantId?: string;
}) {
  const { session } = useAuth();
  const [form, setForm] = useState({
    nombre: (session?.user?.user_metadata as any)?.full_name ?? "",
    email: session?.user?.email ?? "",
    telefono: "",
    cantidad: "1",
    mensaje: "",
  });
  const [sending, setSending] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? "Revisa los datos");
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "credit-pack-request",
          templateData: { ...parsed.data, paquete: packLabel, tipo, tenant_id: tenantId ?? "" },
        },
      });
      if (error) throw error;
      toast.success("Solicitud enviada", { description: "El equipo de Walix te contactará muy pronto." });
      onOpenChange(false);
    } catch (err) {
      console.error("credit-pack-request failed:", err);
      toast.error("No pudimos enviar la solicitud. Intenta de nuevo.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Solicitar a Walix</DialogTitle>
          <DialogDescription>
            Paquete: <span className="font-medium text-foreground">{packLabel}</span> · {tipo}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="rp-nombre">Nombre *</Label>
            <Input id="rp-nombre" value={form.nombre} onChange={(e) => set("nombre")(e.target.value)} maxLength={100} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="rp-email">Correo *</Label>
            <Input id="rp-email" type="email" value={form.email} onChange={(e) => set("email")(e.target.value)} maxLength={255} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="rp-tel">Teléfono</Label>
              <Input id="rp-tel" value={form.telefono} onChange={(e) => set("telefono")(e.target.value)} maxLength={30} placeholder="55 1234 5678" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rp-cant">Cantidad de paquetes</Label>
              <Input id="rp-cant" value={form.cantidad} onChange={(e) => set("cantidad")(e.target.value)} maxLength={20} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="rp-msg">Comentarios</Label>
            <Textarea id="rp-msg" rows={3} value={form.mensaje} onChange={(e) => set("mensaje")(e.target.value)} maxLength={1000} placeholder="¿Para cuándo lo necesitas?" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={sending} className="w-full">
              <Send className="h-4 w-4 mr-2" />
              {sending ? "Enviando..." : "Enviar solicitud"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
