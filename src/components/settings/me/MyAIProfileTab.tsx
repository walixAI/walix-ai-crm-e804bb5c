import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, Sparkles, Clock, Target, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getMyAIProfile,
  updateMyAIProfile,
  countMyDealsClosed,
  getTeamCloseRate,
  getMyTimezone,
  updateMyTimezone,
  type AIUserProfile,
} from "@/services/userProfile";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const COMMON_TIMEZONES = [
  "America/Mexico_City",
  "America/Tijuana",
  "America/Monterrey",
  "America/Cancun",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
  "America/Buenos_Aires",
  "America/Caracas",
  "America/La_Paz",
  "America/Montevideo",
  "America/Asuncion",
  "America/Guatemala",
  "America/Costa_Rica",
  "America/Panama",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/Madrid",
  "Atlantic/Canary",
];

const STYLE_LABELS: Record<string, string> = {
  formal: "Formal y profesional",
  casual: "Casual y directo",
  muy_casual: "Muy casual",
};

const LENGTH_LABELS: Record<string, string> = {
  short: "Mensajes cortos (< 3 líneas)",
  medium: "Mensajes medianos",
  long: "Mensajes detallados",
};

const DAY_LABELS: Record<string, string> = {
  monday: "lunes", tuesday: "martes", wednesday: "miércoles",
  thursday: "jueves", friday: "viernes", saturday: "sábado", sunday: "domingo",
};

export function MyAIProfileTab() {
  const { toast } = useToast();
  const [profile, setProfile] = useState<AIUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [instructions, setInstructions] = useState("");
  const [saving, setSaving] = useState(false);
  const [dealsAnalyzed, setDealsAnalyzed] = useState(0);
  const [teamCloseRate, setTeamCloseRate] = useState(0);
  const [timezone, setTimezone] = useState<string>("America/Mexico_City");

  async function reload() {
    setLoading(true);
    try {
      const p = await getMyAIProfile();
      setProfile(p);
      setInstructions(p?.custom_instructions ?? "");
      const [n, t] = await Promise.all([
        countMyDealsClosed(),
        p?.tenant_id ? getTeamCloseRate(p.tenant_id) : Promise.resolve(0),
      ]);
      setDealsAnalyzed(n);
      setTeamCloseRate(t);
      try { setTimezone(await getMyTimezone()); } catch { /* noop */ }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void reload(); }, []);

  async function saveInstructions() {
    setSaving(true);
    try {
      await updateMyAIProfile({ custom_instructions: instructions });
      toast({ title: "Instrucciones guardadas", description: "El copiloto las usará a partir de tu próximo mensaje." });
      await reload();
    } catch (e: any) {
      toast({ title: "No se pudo guardar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function toggle(field: keyof AIUserProfile, value: boolean) {
    if (!profile) return;
    setProfile({ ...profile, [field]: value });
    try {
      await updateMyAIProfile({ [field]: value } as any);
    } catch (e: any) {
      toast({ title: "No se pudo actualizar", description: e.message, variant: "destructive" });
      await reload();
    }
  }

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (!profile) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No se encontró tu perfil IA. Contacta a soporte.
        </CardContent>
      </Card>
    );
  }

  const enoughData = dealsAnalyzed >= 10;
  const myRatePct = Math.round(profile.close_rate * 100);
  const teamRatePct = Math.round(teamCloseRate * 100);
  const hour = profile.best_close_hour;

  return (
    <div className="space-y-6">
      {/* Sección 1 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Cómo me conoce el copiloto
          </CardTitle>
          <CardDescription>
            Tu perfil IA se construye automáticamente con cada deal y mensaje. Entre más usas Walix, mejor te conoce.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!enoughData && (
            <div className="rounded-md border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              <Sparkles className="inline h-4 w-4 mr-2 text-primary" />
              Recopilando datos… llevamos {dealsAnalyzed} deal{dealsAnalyzed === 1 ? "" : "s"} analizado{dealsAnalyzed === 1 ? "" : "s"}. Necesitamos al menos 10 para mostrar insights confiables.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InsightRow icon={<Sparkles className="h-4 w-4" />} label="Estilo de comunicación detectado">
              <Badge variant="secondary">{STYLE_LABELS[profile.communication_style] ?? profile.communication_style}</Badge>
            </InsightRow>
            <InsightRow icon={<Sparkles className="h-4 w-4" />} label="Longitud preferida de mensajes">
              <Badge variant="secondary">{LENGTH_LABELS[profile.preferred_message_length] ?? profile.preferred_message_length}</Badge>
            </InsightRow>
            <InsightRow icon={<Clock className="h-4 w-4" />} label="Mi hora de más actividad">
              <span className="text-sm font-medium">
                {hour != null ? `${hour}:00 - ${(hour + 2) % 24}:00` : "Aún sin datos"}
              </span>
            </InsightRow>
            <InsightRow icon={<Target className="h-4 w-4" />} label="Mejor día de cierre">
              <span className="text-sm font-medium capitalize">
                {profile.best_close_day ? DAY_LABELS[profile.best_close_day] ?? profile.best_close_day : "Aún sin datos"}
              </span>
            </InsightRow>
            <InsightRow icon={<TrendingUp className="h-4 w-4" />} label="Mi tasa de cierre">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{myRatePct}%</span>
                {enoughData && (
                  <span className={`text-xs ${myRatePct >= teamRatePct ? "text-emerald-500" : "text-amber-500"}`}>
                    {myRatePct >= teamRatePct ? "↑" : "↓"} promedio equipo: {teamRatePct}%
                  </span>
                )}
              </div>
            </InsightRow>
            <InsightRow icon={<Target className="h-4 w-4" />} label="Etapa donde mejor convierto">
              <span className="text-sm font-medium">{profile.top_performing_stage ?? "Aún sin datos"}</span>
            </InsightRow>
          </div>

          {(profile.strengths.length > 0 || profile.improvement_areas.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <Label className="text-xs text-muted-foreground">Mis fortalezas</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {profile.strengths.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                  {profile.strengths.map((s) => (
                    <Badge key={s} className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 border-0">{s}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Áreas de mejora</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {profile.improvement_areas.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                  {profile.improvement_areas.map((s) => (
                    <Badge key={s} className="bg-amber-500/15 text-amber-600 hover:bg-amber-500/20 border-0">{s}</Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground pt-2 border-t border-border">
            Basado en el análisis de tus últimos {dealsAnalyzed} deal{dealsAnalyzed === 1 ? "" : "s"}.
          </p>
        </CardContent>
      </Card>

      {/* Sección 2 */}
      <Card>
        <CardHeader>
          <CardTitle>Instrucciones personales para el copiloto</CardTitle>
          <CardDescription>
            Cuéntale al copiloto cómo trabajas. Estas instrucciones se inyectan en cada respuesta y borrador.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Ej: Siempre tuteo a los clientes. Prefiero mensajes cortos. No mandes mensajes de más de 3 líneas. Mi industria es inmobiliaria de lujo."
            className="min-h-[140px]"
            maxLength={2000}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{instructions.length}/2000</span>
            <Button onClick={saveInstructions} disabled={saving || instructions === profile.custom_instructions}>
              {saving ? "Guardando…" : "Guardar mis instrucciones"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sección 3 */}
      <Card>
        <CardHeader>
          <CardTitle>Notificaciones inteligentes</CardTitle>
          <CardDescription>Personaliza cómo y cuándo el copiloto te interrumpe.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow
            label="Notificarme solo en mis horas de trabajo (8am–7pm)"
            checked={profile.notify_only_work_hours}
            onChange={(v) => toggle("notify_only_work_hours", v)}
          />
          <ToggleRow
            label="Resumir notificaciones en un digest a las 9am en vez de notificaciones individuales"
            checked={profile.notify_digest_9am}
            onChange={(v) => toggle("notify_digest_9am", v)}
          />
          <ToggleRow
            label="El copiloto puede crear tareas para mí automáticamente"
            checked={profile.allow_auto_tasks}
            onChange={(v) => toggle("allow_auto_tasks", v)}
          />
          <ToggleRow
            label="Recibir reporte de coaching semanal del Agente Coach"
            checked={profile.weekly_coaching_report}
            onChange={(v) => toggle("weekly_coaching_report", v)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function InsightRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border bg-card/50 p-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <div className="text-right">{children}</div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Label className="text-sm">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}