import { supabase } from "@/integrations/supabase/client";
import { messageMatchesTask } from "./closure";
import { toast } from "sonner";

/**
 * Al enviar un mensaje de WhatsApp desde Walix, cierra automáticamente las
 * tareas abiertas del contacto vinculado cuyo título haga match con el texto
 * enviado. Se marca `closed_via = 'auto'` para trazabilidad.
 */
export async function autoCloseTasksAfterMessage(input: { conversationId: string; text: string }) {
  const { conversationId, text } = input;
  if (!text.trim()) return;

  const { data: conv } = await supabase
    .from("conversations")
    .select("contact_id")
    .eq("id", conversationId)
    .maybeSingle();
  const contactId = conv?.contact_id;
  if (!contactId) return;

  const { data: contact } = await supabase
    .from("contacts")
    .select("name, last_name")
    .eq("id", contactId)
    .maybeSingle();

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, task_kind, deal_id")
    .eq("contact_id", contactId)
    .eq("completed", false)
    .limit(20);

  if (!tasks?.length) return;

  // Optional: pull deal names for extra context
  const dealIds = Array.from(new Set(tasks.map((t: any) => t.deal_id).filter(Boolean)));
  let dealNameById: Record<string, string> = {};
  if (dealIds.length) {
    const { data: deals } = await supabase.from("deals").select("id, name").in("id", dealIds as string[]);
    dealNameById = Object.fromEntries((deals ?? []).map((d: any) => [d.id, d.name]));
  }

  const contactName = contact ? `${contact.name}${contact.last_name ? " " + contact.last_name : ""}` : null;

  const nowIso = new Date().toISOString();
  const closedTitles: string[] = [];
  for (const t of tasks) {
    const dealName = t.deal_id ? dealNameById[t.deal_id] ?? null : null;
    if (messageMatchesTask(text, { title: t.title, task_kind: t.task_kind }, { contactName, dealName })) {
      const { error } = await supabase
        .from("tasks")
        .update({
          completed: true,
          closed_via: "auto",
          closed_note: `Auto-cerrada por WhatsApp: "${text.slice(0, 140)}"`,
          closed_at: nowIso,
        })
        .eq("id", t.id);
      if (!error) closedTitles.push(t.title);
    }
  }

  if (closedTitles.length) {
    toast.success(
      closedTitles.length === 1
        ? `Cerré "${closedTitles[0]}" porque enviaste WhatsApp`
        : `Cerré ${closedTitles.length} pendientes con el mensaje enviado`,
    );
  }
}