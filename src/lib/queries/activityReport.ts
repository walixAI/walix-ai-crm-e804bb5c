import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/lib/queries/tenant";
import { useTenantUsers, resolveOwner } from "@/lib/queries/tenantUsers";

export type ActivityScope = "tenant" | "mine";

export interface ActivityReportRow {
  id: string;
  occurredAt: string;
  type: string;
  description: string;
  userName: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  contactStage: string;
  dealName: string;
  dealAmount: number | null;
  dealStage: string;
  metadata: string;
}

export function useActivityReport(params: { from: string; to: string; scope: ActivityScope; userIds?: string[] }) {
  const { from, to, scope, userIds } = params;
  const { data: tenantId } = useTenantId();
  const { data: users } = useTenantUsers();
  return useQuery({
    queryKey: ["activity-report", tenantId, from, to, scope, (userIds ?? []).join(","), users?.length ?? 0],
    enabled: !!tenantId,
    queryFn: async (): Promise<ActivityReportRow[]> => {
      let q = supabase
        .from("activities")
        .select("id,occurred_at,type,description,agent_id,metadata,contact_id,deal_id")
        .gte("occurred_at", from)
        .lte("occurred_at", to)
        .order("occurred_at", { ascending: false })
        .limit(5000);
      if (scope === "mine") {
        const { data: auth } = await supabase.auth.getUser();
        if (auth.user?.id) q = q.eq("agent_id", auth.user.id);
      } else if (userIds && userIds.length) {
        q = q.in("agent_id", userIds);
      }
      const { data, error } = await q;
      if (error) throw error;
      const rows = data ?? [];

      const contactIds = Array.from(new Set(rows.map((r: any) => r.contact_id).filter(Boolean)));
      const dealIds = Array.from(new Set(rows.map((r: any) => r.deal_id).filter(Boolean)));

      const [cRes, dRes] = await Promise.all([
        contactIds.length
          ? supabase.from("contacts").select("id,name,last_name,phone,email,status").in("id", contactIds as string[])
          : Promise.resolve({ data: [] as any[] }),
        dealIds.length
          ? supabase.from("deals").select("id,name,amount,stage_name").in("id", dealIds as string[])
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const cById = new Map((cRes.data ?? []).map((c: any) => [c.id, c]));
      const dById = new Map((dRes.data ?? []).map((d: any) => [d.id, d]));

      return rows.map((r: any) => {
        const c = r.contact_id ? cById.get(r.contact_id) : null;
        const d = r.deal_id ? dById.get(r.deal_id) : null;
        return {
          id: r.id,
          occurredAt: r.occurred_at,
          type: r.type,
          description: r.description ?? "",
          userName: resolveOwner(users, r.agent_id).name,
          contactName: c ? `${c.name}${c.last_name ? " " + c.last_name : ""}` : "",
          contactPhone: c?.phone ?? "",
          contactEmail: c?.email ?? "",
          contactStage: c?.status ?? "",
          dealName: d?.name ?? "",
          dealAmount: d ? Number(d.amount ?? 0) : null,
          dealStage: d?.stage_name ?? "",
          metadata: r.metadata && Object.keys(r.metadata).length ? JSON.stringify(r.metadata) : "",
        };
      });
    },
  });
}

const TYPE_LABEL: Record<string, string> = {
  wa_sent: "WhatsApp enviado",
  wa_received: "WhatsApp recibido",
  note: "Nota",
  deal: "Oportunidad",
  task: "Tarea",
  call: "Llamada",
  meeting: "Reunión",
  email: "Email",
  manual: "Manual",
};

export function activityTypeLabel(t: string) {
  return TYPE_LABEL[t] ?? t;
}

function esc(v: string | number | null): string {
  const s = v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildActivityCSV(rows: ActivityReportRow[]): string {
  const header = [
    "Fecha", "Hora", "Usuario", "Tipo de actividad", "Descripción",
    "Contacto", "Teléfono", "Email", "Etapa contacto",
    "Oportunidad", "Monto oportunidad", "Etapa oportunidad", "Detalles",
  ];
  const lines = rows.map((r) => {
    const dt = new Date(r.occurredAt);
    return [
      dt.toLocaleDateString("es-MX"),
      dt.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
      r.userName,
      activityTypeLabel(r.type),
      r.description,
      r.contactName,
      r.contactPhone,
      r.contactEmail,
      r.contactStage,
      r.dealName,
      r.dealAmount ?? "",
      r.dealStage,
      r.metadata,
    ].map(esc).join(",");
  });
  return "\uFEFF" + [header.map(esc).join(","), ...lines].join("\n");
}

export function downloadCsvFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
