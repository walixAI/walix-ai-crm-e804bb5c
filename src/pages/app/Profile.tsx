import { useEffect, useState } from "react";
import { toast } from "sonner";
import { User as UserIcon, Briefcase, Globe2, Bell, Shield, Users, Save, KeyRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useMyProfile, useUpdateMyProfile, useMyProfileStats } from "@/lib/queries/profile";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { TenantSwitcher } from "@/components/layout/TenantSwitcher";
import { supabase } from "@/integrations/supabase/client";

function fmtMXN(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
}

export default function ProfilePage() {
  const { user } = useAuth();
  const { roles, primaryRole } = usePermissions();
  const { data: profile, isLoading } = useMyProfile();
  const { data: stats } = useMyProfileStats();
  const update = useUpdateMyProfile();

  const [form, setForm] = useState<any>({});
  useEffect(() => { if (profile) setForm(profile); }, [profile]);

  const initials = (form.full_name ?? user?.email ?? "U").split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();

  const save = async () => {
    try {
      await update.mutateAsync({
        full_name: form.full_name,
        phone: form.phone,
        job_title: form.job_title,
        timezone: form.timezone,
        locale: form.locale,
        signature: form.signature,
        wa_greeting: form.wa_greeting,
        reminder_hour: Number(form.reminder_hour ?? 8),
        notification_prefs: form.notification_prefs ?? {},
      });
      toast.success("Perfil actualizado");
    } catch (e: any) { toast.error(e.message ?? "Error"); }
  };

  const sendReset = async () => {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email);
    if (error) toast.error(error.message); else toast.success("Te enviamos un enlace para cambiar tu contraseña.");
  };

  const np = form.notification_prefs ?? {};
  const togglePref = (k: string, v: boolean) =>
    setForm({ ...form, notification_prefs: { ...np, [k]: v } });

  if (isLoading) return <div className="p-6">Cargando…</div>;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Mi perfil</h1>
          <p className="text-sm text-muted-foreground">Información personal, preferencias y seguridad.</p>
        </div>
        <Button onClick={save} disabled={update.isPending}>
          <Save className="h-4 w-4" /> Guardar cambios
        </Button>
      </header>

      {/* Identidad */}
      <Section title="Identidad" icon={UserIcon}>
        <div className="flex items-center gap-4 mb-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="bg-gradient-brand text-primary-foreground text-lg font-semibold">{initials}</AvatarFallback>
          </Avatar>
          <div className="text-sm">
            <div className="font-medium">{form.full_name ?? user?.email}</div>
            <div className="text-muted-foreground">{user?.email}</div>
            <div className="text-xs text-muted-foreground mt-1">Rol: <span className="capitalize">{primaryRole ?? roles[0] ?? "—"}</span></div>
          </div>
        </div>
        <Grid>
          <Field label="Nombre completo"><Input value={form.full_name ?? ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
          <Field label="Teléfono"><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Puesto / cargo"><Input value={form.job_title ?? ""} onChange={(e) => setForm({ ...form, job_title: e.target.value })} /></Field>
          <Field label="Zona horaria"><Input value={form.timezone ?? ""} onChange={(e) => setForm({ ...form, timezone: e.target.value })} /></Field>
          <Field label="Idioma">
            <select className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
              value={form.locale ?? "es-MX"} onChange={(e) => setForm({ ...form, locale: e.target.value })}>
              <option value="es-MX">Español (México)</option>
              <option value="en-US">English (US)</option>
              <option value="pt-BR">Português (Brasil)</option>
            </select>
          </Field>
        </Grid>
      </Section>

      {/* Actividad */}
      <Section title="Actividad (últimos 30 días)" icon={Briefcase}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Stat label="Contactos creados" value={stats?.contactsCreated ?? 0} />
          <Stat label="Oportunidades ganadas" value={stats?.dealsWon ?? 0} />
          <Stat label="Oportunidades perdidas" value={stats?.dealsLost ?? 0} />
          <Stat label="Monto cerrado" value={fmtMXN(stats?.amountClosed ?? 0)} />
          <Stat label="Tareas completadas" value={stats?.tasksCompleted ?? 0} />
          <Stat label="Llamadas registradas" value={stats?.callsLogged ?? 0} />
          <Stat label="Notas registradas" value={stats?.notesLogged ?? 0} />
          <Stat label="Miembro desde" value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString("es-MX", { month: "short", year: "numeric" }) : "—"} />
        </div>
      </Section>

      {/* Preferencias */}
      <Section title="Preferencias y notificaciones" icon={Bell}>
        <Grid>
          <Field label="Hora del recordatorio diario IA">
            <Input type="number" min={0} max={23}
              value={form.reminder_hour ?? 8}
              onChange={(e) => setForm({ ...form, reminder_hour: Number(e.target.value) })} />
          </Field>
        </Grid>
        <div className="space-y-2 mt-3">
          {[
            ["task_reminders", "Recordatorios de tareas"],
            ["deal_updates", "Cambios en mis oportunidades"],
            ["mentions", "Menciones del equipo"],
            ["ai_suggestions", "Sugerencias proactivas de la IA"],
          ].map(([k, label]) => (
            <div key={k} className="flex items-center justify-between border border-border rounded-lg px-3 py-2">
              <span className="text-sm">{label}</span>
              <Switch checked={np[k] !== false} onCheckedChange={(v) => togglePref(k, v)} />
            </div>
          ))}
        </div>
        <Grid>
          <Field label="Firma para emails">
            <Textarea rows={3} value={form.signature ?? ""} onChange={(e) => setForm({ ...form, signature: e.target.value })} />
          </Field>
          <Field label="Saludo por defecto en WhatsApp">
            <Textarea rows={3} value={form.wa_greeting ?? ""} onChange={(e) => setForm({ ...form, wa_greeting: e.target.value })} />
          </Field>
        </Grid>
      </Section>

      {/* Seguridad */}
      <Section title="Seguridad" icon={Shield}>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={sendReset}><KeyRound className="h-4 w-4" /> Cambiar contraseña</Button>
          <Button variant="outline" disabled>2FA (próximamente)</Button>
          <Button variant="outline" onClick={async () => { await supabase.auth.signOut({ scope: "others" } as any); toast.success("Sesiones en otros dispositivos cerradas"); }}>
            Cerrar otras sesiones
          </Button>
        </div>
      </Section>

      {/* Equipo */}
      <Section title="Equipo y acceso" icon={Users}>
        <div className="flex items-center gap-3 mb-3">
          <Globe2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">Tenant activo:</span>
          <TenantSwitcher />
        </div>
        <div className="text-xs text-muted-foreground mb-1">Permisos efectivos</div>
        <div className="flex flex-wrap gap-1">
          {roles.length === 0 && <span className="text-sm text-muted-foreground">Sin roles asignados.</span>}
          {roles.map((r) => (
            <span key={r} className="text-xs px-2 py-0.5 rounded-full bg-muted border border-border">{r}</span>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, icon: Icon, children }: any) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-card p-5">
      <h2 className="font-semibold mb-3 flex items-center gap-2"><Icon className="h-4 w-4 text-primary" /> {title}</h2>
      {children}
    </section>
  );
}
function Grid({ children }: any) { return <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>; }
function Field({ label, children }: any) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-[10px] uppercase text-muted-foreground tracking-wide">{label}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
    </div>
  );
}