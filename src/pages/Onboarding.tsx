import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/walix/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Sparkles,
  MessageCircle,
  UserPlus,
  PartyPopper,
  Loader2,
  Check,
  RefreshCw,
  Plus,
  Trash2,
  ArrowRight,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  INDUSTRIES,
  TEAM_SIZES,
  SALES_CHANNELS,
  COUNTRIES,
  DEFAULT_COUNTRY_CODE,
  getCountryByCode,
  getCountryByCurrency,
} from "@/lib/constants/onboarding";

const STEP_TITLES = [
  { icon: Building2, title: "Tu negocio" },
  { icon: Sparkles, title: "Configura con IA" },
  { icon: MessageCircle, title: "WhatsApp" },
  { icon: UserPlus, title: "Tu equipo" },
  { icon: PartyPopper, title: "Listo" },
];

interface AISetupStage {
  name: string;
  color: string;
  is_won?: boolean;
  is_lost?: boolean;
}
interface AISetupResponse {
  pipeline_name: string;
  rationale: string;
  stages: AISetupStage[];
  fallback?: boolean;
  error?: string;
}

const AI_PHASE_MESSAGES: Record<"thinking" | "applying", string[]> = {
  thinking: [
    "Analizando tu industria…",
    "Diseñando tu pipeline ideal…",
    "Eligiendo etapas y colores…",
  ],
  applying: [
    "Creando etapas en tu pipeline…",
    "Sembrando etiquetas personalizadas…",
    "Generando plantillas de WhatsApp…",
    "Casi listo…",
  ],
};

function normalizeMxPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("52") && digits.length >= 12) return `+${digits}`;
  if (digits.length === 10) return `+52${digits}`;
  if (digits.startsWith("1") && digits.length === 11) return `+${digits}`;
  return `+${digits}`;
}

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0); // 0..4
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantLoading, setTenantLoading] = useState(true);

  // Step 0
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [countryCode, setCountryCode] = useState<string>(DEFAULT_COUNTRY_CODE);
  const [industry, setIndustry] = useState<string>("");
  const [industryOther, setIndustryOther] = useState("");
  const [teamSize, setTeamSize] = useState<string>(TEAM_SIZES[0]);
  const [salesChannel, setSalesChannel] = useState<string>(SALES_CHANNELS[0]);
  const [savingProfile, setSavingProfile] = useState(false);

  // Step 1 IA
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMsgIndex, setAiMsgIndex] = useState(0);
  const [aiPhase, setAiPhase] = useState<"thinking" | "applying">("thinking");
  const [aiResult, setAiResult] = useState<AISetupResponse | null>(null);
  const [applying, setApplying] = useState(false);
  const [seedStats, setSeedStats] = useState<{ tags: number; templates: number } | null>(
    null
  );

  // Step 2 WhatsApp
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);

  // Step 3 invites
  const [invites, setInvites] = useState<
    { email: string; role: "tenant_admin" | "sales_rep" | "org_member" }[]
  >([{ email: "", role: "sales_rep" }]);

  const [finishing, setFinishing] = useState(false);

  // Cargar tenant + datos previos
  useEffect(() => {
    if (!user) return;
    setTenantLoading(true);
    supabase
      .from("profiles")
      .select("tenant_id, onboarded, full_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.tenant_id) {
          setTenantId(data.tenant_id);
          // Pre-cargar full_name si ya estaba
          if (data.full_name && data.full_name !== user.email) {
            setFullName(data.full_name);
          }
          // Cargar tenant para pre-llenar
          supabase
            .from("tenants")
            .select("name, industry, team_size, sales_channel, whatsapp_phone, currency")
            .eq("id", data.tenant_id)
            .maybeSingle()
            .then(({ data: t }) => {
              if (t) {
                if (t.name && t.name !== "Mi empresa") setCompanyName(t.name);
                if (t.industry) setIndustry(t.industry);
                if (t.team_size) setTeamSize(t.team_size);
                if (t.sales_channel) setSalesChannel(t.sales_channel);
                if (t.whatsapp_phone) setWhatsappPhone(t.whatsapp_phone);
                if (t.currency) setCountryCode(getCountryByCurrency(t.currency).code);
              }
            });
        }
        if (data?.onboarded) navigate("/dashboard", { replace: true });
        setTenantLoading(false);
      });
  }, [user, navigate]);

  // Animación de mensajes durante loading IA / aplicando
  useEffect(() => {
    if (!aiLoading && !applying) return;
    setAiMsgIndex(0);
    const id = setInterval(() => {
      setAiMsgIndex((i) => (i + 1) % AI_PHASE_MESSAGES[aiPhase].length);
    }, 1100);
    return () => clearInterval(id);
  }, [aiLoading, applying, aiPhase]);

  const effectiveIndustry =
    industry === "Otro" ? industryOther.trim() || "Otro" : industry || "Otro";

  const canContinueStep0 =
    fullName.trim().length > 1 &&
    companyName.trim().length > 1 &&
    !!industry &&
    (industry !== "Otro" || industryOther.trim().length > 1);

  // ---- Persistir perfil + tenant al salir del paso 0 ----
  const saveStep0AndContinue = async () => {
    if (!user || !tenantId) return;
    setSavingProfile(true);
    try {
      const { error: pErr } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim() })
        .eq("id", user.id);
      if (pErr) throw pErr;

      const { error: tErr } = await supabase
        .from("tenants")
        .update({
          name: companyName.trim(),
          industry: effectiveIndustry,
          team_size: teamSize,
          sales_channel: salesChannel,
        })
        .eq("id", tenantId);
      if (tErr) throw tErr;

      setStep(1);
    } catch (e: any) {
      toast.error(e?.message ?? "No pudimos guardar tus datos");
    } finally {
      setSavingProfile(false);
    }
  };

  // ---- IA ----
  const runAi = async () => {
    setAiLoading(true);
    setAiResult(null);
    setAiMsgIndex(0);
    try {
      const start = Date.now();
      const { data, error } = await supabase.functions.invoke("ai-onboarding-setup", {
        body: {
          industry: effectiveIndustry,
          team_size: teamSize,
          sales_channel: salesChannel,
        },
      });
      const elapsed = Date.now() - start;
      if (elapsed < 2500) await new Promise((r) => setTimeout(r, 2500 - elapsed));
      if (error) throw error;
      const res = data as AISetupResponse;
      setAiResult(res);
      if (res.fallback) toast.info("Usamos un pipeline base (la IA tardó en responder).");
    } catch (e: any) {
      toast.error(e?.message ?? "No pudimos generar la sugerencia");
    } finally {
      setAiLoading(false);
    }
  };

  const applyAi = async () => {
    if (!aiResult || !tenantId) return;
    setApplying(true);
    try {
      // Pipeline default
      const { data: pipelines } = await supabase
        .from("pipelines")
        .select("id, is_default")
        .eq("tenant_id", tenantId)
        .order("position", { ascending: true });

      let pipelineId = pipelines?.find((p) => p.is_default)?.id ?? pipelines?.[0]?.id;
      if (!pipelineId) {
        const { data: created, error } = await supabase
          .from("pipelines")
          .insert({
            tenant_id: tenantId,
            name: aiResult.pipeline_name,
            is_default: true,
            position: 0,
          })
          .select("id")
          .single();
        if (error) throw error;
        pipelineId = created.id;
      } else {
        await supabase
          .from("pipelines")
          .update({ name: aiResult.pipeline_name })
          .eq("id", pipelineId);
      }

      await supabase.from("pipeline_stages").delete().eq("pipeline_id", pipelineId);
      const rows = aiResult.stages.map((s, i) => ({
        tenant_id: tenantId,
        pipeline_id: pipelineId,
        name: s.name,
        color: s.color,
        position: i,
        is_won: !!s.is_won,
        is_lost: !!s.is_lost,
      }));
      const { error: sErr } = await supabase.from("pipeline_stages").insert(rows);
      if (sErr) throw sErr;

      // Sembrar tags + plantillas + automatización demo (no bloqueante en error)
      try {
        await supabase.functions.invoke("onboarding-seed", {
          body: { tenant_id: tenantId, industry: effectiveIndustry },
        });
      } catch (seedErr) {
        console.warn("onboarding-seed falló, continuando", seedErr);
      }

      toast.success(`Pipeline configurado con ${rows.length} etapas`);
      setStep(2);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo aplicar");
    } finally {
      setApplying(false);
    }
  };

  // ---- WhatsApp ----
  const saveWhatsappAndContinue = async () => {
    if (!tenantId) return;
    setSavingPhone(true);
    try {
      const normalized = whatsappPhone.trim() ? normalizeMxPhone(whatsappPhone) : null;
      await supabase
        .from("tenants")
        .update({ whatsapp_phone: normalized })
        .eq("id", tenantId);
      setStep(3);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar el teléfono");
    } finally {
      setSavingPhone(false);
    }
  };

  // ---- Invites ----
  const addInvite = () =>
    setInvites((arr) => (arr.length >= 3 ? arr : [...arr, { email: "", role: "sales_rep" }]));
  const removeInvite = (i: number) =>
    setInvites((arr) => arr.filter((_, idx) => idx !== i));

  const sendInvitesAndFinish = async () => {
    if (!user || !tenantId) return;
    setFinishing(true);
    try {
      const valid = invites.filter((i) => i.email.includes("@"));
      if (valid.length > 0) {
        const results = await Promise.allSettled(
          valid.map((i) =>
            supabase.functions.invoke("send-invitation", {
              body: {
                tenant_id: tenantId,
                email: i.email.toLowerCase().trim(),
                role: i.role,
              },
            })
          )
        );
        const failed = results.filter((r) => r.status === "rejected").length;
        if (failed > 0) {
          toast.warning(
            `${valid.length - failed} de ${valid.length} invitaciones enviadas`
          );
        } else {
          toast.success(`${valid.length} invitación(es) enviada(s)`);
        }
      }
      await supabase.from("profiles").update({ onboarded: true }).eq("id", user.id);
      setStep(4);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudieron enviar las invitaciones");
    } finally {
      setFinishing(false);
    }
  };

  const skipInvites = async () => {
    if (!user) return;
    setFinishing(true);
    try {
      await supabase.from("profiles").update({ onboarded: true }).eq("id", user.id);
      setStep(4);
    } finally {
      setFinishing(false);
    }
  };

  const progress = ((step + 1) / STEP_TITLES.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-soft flex flex-col">
      <header className="h-16 px-6 flex items-center justify-between border-b border-border bg-card">
        <Logo />
        <span className="text-xs text-muted-foreground">
          Paso {step + 1} de {STEP_TITLES.length}
        </span>
      </header>

      <div className="h-1 bg-muted">
        <div
          className="h-full bg-gradient-brand transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <main className="flex-1 grid place-items-center p-4 md:p-6">
        <div className="w-full max-w-2xl">
          {/* Stepper */}
          <div className="hidden md:flex items-center justify-center gap-1.5 mb-6">
            {STEP_TITLES.map((s, i) => {
              const Icon = s.icon;
              const active = i === step;
              const done = i < step;
              return (
                <div key={i} className="flex items-center gap-1.5">
                  <div
                    className={cn(
                      "h-8 w-8 rounded-full grid place-items-center text-xs font-bold transition-all",
                      done && "bg-primary text-primary-foreground",
                      active && "bg-gradient-brand text-primary-foreground shadow-glow scale-110",
                      !done && !active && "bg-muted text-muted-foreground"
                    )}
                  >
                    {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  {i < STEP_TITLES.length - 1 && (
                    <div
                      className={cn(
                        "h-0.5 w-8 transition-colors",
                        i < step ? "bg-primary" : "bg-border"
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className="bg-card rounded-2xl border border-border shadow-card p-6 md:p-8 animate-fade-in">
            {/* STEP 0 — Identidad + Negocio */}
            {step === 0 && (
              <div className="space-y-5">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">
                    Cuéntanos de ti y tu negocio
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Lo usaremos para personalizar tu CRM en segundos.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName">Tu nombre completo</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="fullName"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Ej. Juan Pérez"
                        className="h-11 pl-9"
                        maxLength={80}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="companyName">Nombre de tu empresa</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="companyName"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Ej. Acme S.A."
                        className="h-11 pl-9"
                        maxLength={80}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>¿A qué se dedica tu negocio?</Label>
                  <Select value={industry} onValueChange={setIndustry}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Elige tu industria" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDUSTRIES.map((i) => (
                        <SelectItem key={i} value={i}>
                          {i}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {industry === "Otro" && (
                    <Input
                      placeholder="Describe tu giro (ej. catering, fotografía…)"
                      value={industryOther}
                      onChange={(e) => setIndustryOther(e.target.value)}
                      className="h-11 mt-2"
                      maxLength={80}
                    />
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>¿Cuántas personas hay en tu equipo de ventas?</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {TEAM_SIZES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setTeamSize(s)}
                        className={cn(
                          "h-11 rounded-lg border text-sm font-medium transition-all",
                          teamSize === s
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-primary/40"
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>¿Cómo cierras más ventas hoy?</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {SALES_CHANNELS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSalesChannel(s)}
                        className={cn(
                          "h-11 rounded-lg border text-sm font-medium transition-all",
                          salesChannel === s
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-primary/40"
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 1 — IA */}
            {step === 1 && (
              <div className="space-y-5 text-center">
                <div className="h-14 w-14 mx-auto rounded-2xl bg-gradient-brand grid place-items-center shadow-glow">
                  <Sparkles className="h-7 w-7 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">
                    ✨ Configura tu CRM en 10 segundos con IA
                  </h1>
                  <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                    Basado en tu industria{" "}
                    <span className="font-semibold text-foreground">
                      ({effectiveIndustry})
                    </span>
                    , la IA configurará tu pipeline, etiquetas y plantillas.
                  </p>
                </div>

                {!aiResult && !aiLoading && (
                  <Button
                    onClick={runAi}
                    size="lg"
                    disabled={tenantLoading || !tenantId}
                    className="bg-gradient-brand text-primary-foreground shadow-glow"
                  >
                    {tenantLoading && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    🚀 Configurar con IA
                  </Button>
                )}

                {(aiLoading || applying) && (
                  <div className="py-6 space-y-4">
                    <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
                    <div className="text-sm font-medium animate-pulse">
                      {AI_PHASE_MESSAGES[aiPhase][aiMsgIndex]}
                    </div>
                  </div>
                )}

                {aiResult && (
                  <div className="text-left space-y-3 animate-fade-in">
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                      <div className="text-xs uppercase tracking-wide font-semibold text-primary mb-2">
                        {aiResult.pipeline_name}
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        {aiResult.rationale}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {aiResult.stages.map((s, i) => (
                          <div
                            key={i}
                            className="px-3 py-1.5 rounded-full bg-card border border-border text-xs flex items-center gap-1.5"
                          >
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ background: s.color }}
                            />
                            <span className="font-medium">{s.name}</span>
                            {s.is_won && <span className="text-success">✓</span>}
                            {s.is_lost && <span className="text-destructive">✕</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <Button variant="ghost" size="sm" onClick={runAi}>
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Regenerar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 2 — WhatsApp */}
            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">Tu WhatsApp comercial</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Guarda el número que usas para vender. Más adelante podrás conectarlo
                    para recibir mensajes en Walix.ai.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="wa">Número de WhatsApp</Label>
                  <Input
                    id="wa"
                    type="tel"
                    placeholder="55 1234 5678"
                    value={whatsappPhone}
                    onChange={(e) => setWhatsappPhone(e.target.value)}
                    className="h-11"
                    maxLength={20}
                  />
                  <p className="text-xs text-muted-foreground">
                    10 dígitos para México. Se guardará como{" "}
                    {whatsappPhone ? (
                      <span className="font-mono text-foreground">
                        {normalizeMxPhone(whatsappPhone) ?? whatsappPhone}
                      </span>
                    ) : (
                      <span className="font-mono">+52…</span>
                    )}
                  </p>
                </div>

                <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                  💡 La conexión real del chat (escanear QR o API oficial) la haces desde{" "}
                  <span className="font-mono text-foreground">Configuración → WhatsApp</span>{" "}
                  cuando estés listo.
                </div>
              </div>
            )}

            {/* STEP 3 — Invitar equipo */}
            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">Invita a tu equipo</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Hasta 3 personas. Recibirán un correo para unirse a{" "}
                    <span className="font-semibold text-foreground">
                      {companyName || "tu empresa"}
                    </span>
                    .
                  </p>
                </div>

                <div className="space-y-2">
                  {invites.map((inv, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="correo@empresa.com"
                        value={inv.email}
                        onChange={(e) => {
                          const arr = [...invites];
                          arr[i].email = e.target.value;
                          setInvites(arr);
                        }}
                        className="h-10 flex-1"
                      />
                      <Select
                        value={inv.role}
                        onValueChange={(v) => {
                          const arr = [...invites];
                          arr[i].role = v as any;
                          setInvites(arr);
                        }}
                      >
                        <SelectTrigger className="h-10 w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tenant_admin">Administrador</SelectItem>
                          <SelectItem value="sales_rep">Vendedor</SelectItem>
                          <SelectItem value="org_member">Solo ver</SelectItem>
                        </SelectContent>
                      </Select>
                      {invites.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeInvite(i)}
                          className="h-10 w-10"
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {invites.length < 3 && (
                  <Button variant="outline" size="sm" onClick={addInvite}>
                    <Plus className="h-4 w-4 mr-1.5" /> Agregar otra
                  </Button>
                )}
              </div>
            )}

            {/* STEP 4 — Listo */}
            {step === 4 && (
              <div className="text-center py-6 space-y-5">
                <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-brand grid place-items-center shadow-glow animate-pulse">
                  <PartyPopper className="h-8 w-8 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">
                    🎉 ¡Tu CRM está listo!
                  </h1>
                  <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                    Configuramos tu pipeline para{" "}
                    <span className="font-semibold text-foreground">
                      {effectiveIndustry}
                    </span>
                    . El siguiente paso: crear tu primer contacto usando IA.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3 text-left max-w-md mx-auto">
                  {[
                    {
                      label: "Pipeline",
                      value: aiResult?.stages.length
                        ? `${aiResult.stages.length} etapas`
                        : "Listo",
                    },
                    { label: "Industria", value: effectiveIndustry },
                    { label: "Equipo", value: teamSize },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="rounded-lg border border-border bg-muted/30 p-3"
                    >
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {s.label}
                      </div>
                      <div className="text-sm font-semibold mt-0.5 truncate">
                        {s.value}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
                  <Button
                    size="lg"
                    className="bg-gradient-brand text-primary-foreground shadow-glow"
                    onClick={() => navigate("/contacts?firstRun=1")}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Crear mi primer contacto
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => navigate("/dashboard")}
                  >
                    Ir al Dashboard <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Footer botones */}
            {step < 4 && (
              <div className="mt-8 flex items-center justify-between gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  disabled={step === 0}
                >
                  Atrás
                </Button>

                <div className="flex gap-2">
                  {/* Step 0 */}
                  {step === 0 && (
                    <Button
                      onClick={saveStep0AndContinue}
                      disabled={!canContinueStep0 || savingProfile || tenantLoading}
                      className="bg-gradient-brand text-primary-foreground"
                    >
                      {savingProfile && (
                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      )}
                      Continuar <ArrowRight className="h-4 w-4 ml-1.5" />
                    </Button>
                  )}

                  {/* Step 1 IA */}
                  {step === 1 && aiResult && !aiLoading && (
                    <>
                      <Button variant="outline" onClick={() => setStep(2)}>
                        Personalizar luego
                      </Button>
                      <Button
                        onClick={applyAi}
                        disabled={applying}
                        className="bg-gradient-brand text-primary-foreground"
                      >
                        {applying ? (
                          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4 mr-1.5" />
                        )}
                        Confirmar etapas
                      </Button>
                    </>
                  )}
                  {step === 1 && !aiResult && !aiLoading && (
                    <Button variant="ghost" onClick={() => setStep(2)}>
                      Omitir
                    </Button>
                  )}

                  {/* Step 2 WhatsApp */}
                  {step === 2 && (
                    <Button
                      onClick={saveWhatsappAndContinue}
                      disabled={savingPhone}
                      className="bg-gradient-brand text-primary-foreground"
                    >
                      {savingPhone && (
                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      )}
                      Continuar <ArrowRight className="h-4 w-4 ml-1.5" />
                    </Button>
                  )}

                  {/* Step 3 invites */}
                  {step === 3 && (
                    <>
                      <Button variant="ghost" onClick={skipInvites} disabled={finishing}>
                        Omitir
                      </Button>
                      <Button
                        onClick={sendInvitesAndFinish}
                        disabled={finishing}
                        className="bg-gradient-brand text-primary-foreground"
                      >
                        {finishing && (
                          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                        )}
                        Enviar invitaciones
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}