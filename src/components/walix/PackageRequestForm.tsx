import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, Send } from "lucide-react";

const schema = z.object({
  nombre: z.string().trim().min(1, "Escribe tu nombre").max(100),
  empresa: z.string().trim().max(120).optional().or(z.literal("")),
  email: z.string().trim().email("Correo inválido").max(255),
  telefono: z.string().trim().max(30).optional().or(z.literal("")),
  paquete: z.string().trim().min(1, "Elige un paquete"),
  mensaje: z.string().trim().max(1000).optional().or(z.literal("")),
});

const PAQUETES = ["PyME", "Growth", "Enterprise", "Aún no lo sé"];

export function PackageRequestForm({ defaultPaquete }: { defaultPaquete?: string }) {
  const [form, setForm] = useState({
    nombre: "",
    empresa: "",
    email: "",
    telefono: "",
    paquete: defaultPaquete ?? "",
    mensaje: "",
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

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
          templateName: "package-request",
          templateData: parsed.data,
        },
      });
      if (error) throw error;
      setSent(true);
      toast.success("¡Solicitud enviada! Te contactamos muy pronto.");
    } catch (err) {
      console.error("package-request failed:", err);
      toast.error("No pudimos enviar la solicitud. Intenta de nuevo.");
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <CheckCircle2 className="h-10 w-10 text-success mx-auto mb-3" />
        <h3 className="text-lg font-semibold">¡Gracias! Recibimos tu solicitud</h3>
        <p className="text-sm text-muted-foreground mt-2">
          Un asesor de Walix.ai te contactará para armar el paquete ideal para tu empresa.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-6 md:p-8 grid gap-4 md:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="pr-nombre">Nombre *</Label>
        <Input id="pr-nombre" value={form.nombre} onChange={(e) => set("nombre")(e.target.value)} maxLength={100} placeholder="Tu nombre" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="pr-empresa">Empresa</Label>
        <Input id="pr-empresa" value={form.empresa} onChange={(e) => set("empresa")(e.target.value)} maxLength={120} placeholder="Nombre de tu empresa" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="pr-email">Correo *</Label>
        <Input id="pr-email" type="email" value={form.email} onChange={(e) => set("email")(e.target.value)} maxLength={255} placeholder="tu@empresa.com" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="pr-tel">Teléfono / WhatsApp</Label>
        <Input id="pr-tel" value={form.telefono} onChange={(e) => set("telefono")(e.target.value)} maxLength={30} placeholder="55 1234 5678" />
      </div>
      <div className="grid gap-2 md:col-span-2">
        <Label>Paquete de interés *</Label>
        <Select value={form.paquete} onValueChange={set("paquete")}>
          <SelectTrigger><SelectValue placeholder="Elige un paquete" /></SelectTrigger>
          <SelectContent>
            {PAQUETES.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2 md:col-span-2">
        <Label htmlFor="pr-msg">¿Qué necesitas resolver?</Label>
        <Textarea id="pr-msg" value={form.mensaje} onChange={(e) => set("mensaje")(e.target.value)} maxLength={1000} rows={4} placeholder="Cuéntanos brevemente sobre tu operación" />
      </div>
      <div className="md:col-span-2">
        <Button type="submit" disabled={sending} className="w-full bg-gradient-brand text-primary-foreground hover:opacity-90">
          <Send className="h-4 w-4 mr-2" />
          {sending ? "Enviando..." : "Solicitar información"}
        </Button>
        <p className="text-[11px] text-muted-foreground mt-2 text-center">
          Tus datos se envían a nuestro equipo comercial. Sin compromiso.
        </p>
      </div>
    </form>
  );
}