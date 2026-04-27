import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/walix/Logo";
import { Check, MessageCircle, Users, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const steps = [
  { icon: Users, title: "Cuéntanos de tu negocio", desc: "Personalizaremos Walix.ai para ti" },
  { icon: MessageCircle, title: "Conecta WhatsApp", desc: "Multi-agente, sin perder tu número" },
  { icon: Zap, title: "Activa tu IA", desc: "Responde, califica y vende automáticamente" },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [bizName, setBizName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const finish = async () => {
    setLoading(true);
    try {
      if (user) {
        await supabase.from("profiles").update({ onboarded: true, full_name: bizName || user.email }).eq("id", user.id);
      }
      toast.success("¡Listo! Bienvenido a Walix.ai");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-soft flex flex-col">
      <header className="h-16 px-6 flex items-center border-b border-border bg-card">
        <Logo />
      </header>
      <main className="flex-1 grid place-items-center p-6">
        <div className="w-full max-w-2xl">
          {/* Stepper */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`h-8 w-8 rounded-full grid place-items-center text-xs font-bold transition-all ${
                  i <= step ? "bg-primary text-primary-foreground shadow-glow" : "bg-muted text-muted-foreground"
                }`}>
                  {i < step ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                {i < steps.length - 1 && <div className={`h-0.5 w-12 ${i < step ? "bg-primary" : "bg-border"}`} />}
              </div>
            ))}
          </div>

          <div className="bg-card rounded-2xl border border-border shadow-card p-8 md:p-10 animate-fade-in">
            <div className="flex items-start gap-4 mb-6">
              <div className="h-12 w-12 rounded-xl bg-gradient-brand grid place-items-center shadow-glow">
                {(() => { const Icon = steps[step].icon; return <Icon className="h-6 w-6 text-primary-foreground" />; })()}
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{steps[step].title}</h1>
                <p className="text-sm text-muted-foreground mt-1">{steps[step].desc}</p>
              </div>
            </div>

            {step === 0 && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="biz">Nombre de tu negocio</Label>
                  <Input id="biz" value={bizName} onChange={(e) => setBizName(e.target.value)}
                    placeholder="Ej. Tacos El Güero" className="h-11" />
                </div>
              </div>
            )}
            {step === 1 && (
              <div className="rounded-xl border border-dashed border-border p-8 text-center bg-muted/30">
                <MessageCircle className="h-12 w-12 mx-auto text-success mb-3" />
                <p className="font-medium">Escanea el QR desde WhatsApp Business</p>
                <p className="text-xs text-muted-foreground mt-1">(simulación · puedes saltarlo)</p>
              </div>
            )}
            {step === 2 && (
              <div className="space-y-3">
                {["Califica leads automáticamente", "Responde fuera de horario", "Detecta intención de compra"].map((f) => (
                  <label key={f} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/40 cursor-pointer transition-colors">
                    <input type="checkbox" defaultChecked className="h-4 w-4 accent-primary" />
                    <span className="text-sm font-medium">{f}</span>
                  </label>
                ))}
              </div>
            )}

            <div className="mt-8 flex justify-between gap-3">
              <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
                Atrás
              </Button>
              {step < steps.length - 1 ? (
                <Button onClick={() => setStep((s) => s + 1)} className="bg-gradient-brand text-primary-foreground">
                  Siguiente
                </Button>
              ) : (
                <Button onClick={finish} disabled={loading} className="bg-gradient-brand text-primary-foreground">
                  {loading ? "Guardando..." : "Entrar a Walix.ai"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}