// Habilidad del Copiloto: cambios masivos (contactos, oportunidades, tareas).
// Solo el DUEÑO del Tenant (tenant_owner) o plataforma pueden usarla.
// Flujo obligatorio: preview → confirm (código) → apply(código) → undo.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";

export type BulkEntity = "contacts" | "deals" | "tasks" | "activities";

const TABLE: Record<BulkEntity, string> = {
  contacts: "contacts",
  deals: "deals",
  tasks: "tasks",
  activities: "activities",
};

const LABEL: Record<BulkEntity, string> = {
  contacts: "contactos",
  deals: "oportunidades",
  tasks: "tareas",
  activities: "actividades",
};

/** Campos que se pueden modificar de forma masiva (whitelist estricta). */
const EDITABLE: Record<BulkEntity, string[]> = {
  contacts: ["status", "owner_id", "source", "lifecycle", "company"],
  deals: [
    "amount", "cost_amount", "probability", "stage_id", "stage_name", "owner_id",
    "expected_close_date", "deal_type", "service_type", "payment_status",
    "is_won", "is_lost", "notes", "won_at",
  ],
  tasks: ["assignee_id", "due_at", "completed", "task_kind", "title"],
};

/** Entidades que además admiten borrado masivo (con respaldo y reversión). */
const DELETABLE: BulkEntity[] = ["activities", "tasks", "deals"];

/** Columnas completas para respaldo/restauración al borrar. */
const RESTORE_FIELDS: Partial<Record<BulkEntity, string>> = {
  activities: "id, tenant_id, contact_id, deal_id, agent_id, type, description, occurred_at, metadata, created_at",
  tasks: "id, tenant_id, contact_id, deal_id, assignee_id, title, due_at, completed, task_kind, created_at, updated_at",
  deals: "*",
};

/** Campos que se devuelven en la vista previa. */
const PREVIEW_FIELDS: Record<BulkEntity, string> = {
  contacts: "id, name, status, owner_id, source, company",
  deals: "id, name, amount, stage_name, owner_id, is_won, is_lost, expected_close_date",
  tasks: "id, title, due_at, completed, assignee_id, task_kind",
  activities: "id, type, description, occurred_at, agent_id, contact_id, deal_id",
};

export const MAX_BULK_ROWS = 1000;

export async function isTenantOwner(sb: SupabaseClient, userId: string, tenantId: string) {
  const [{ data: roles }, { data: t }] = await Promise.all([
    sb.from("user_roles").select("role").eq("user_id", userId),
    sb.from("tenants").select("bulk_edit_enabled, bulk_edit_allow_admins").eq("id", tenantId).maybeSingle(),
  ]);
  const list = (roles ?? []).map((r: any) => r.role);
  const isPlatform = list.some((r: string) => ["platform_owner", "super_admin", "platform_staff"].includes(r));
  if (isPlatform) return true;
  // El tenant puede apagar por completo la capacidad.
  if (t && t.bulk_edit_enabled === false) return false;
  if (list.includes("tenant_owner")) return true;
  if (t?.bulk_edit_allow_admins && list.includes("tenant_admin")) return true;
  return false;
}

/** Configuración del tenant para la capacidad de cambios masivos. */
export async function getBulkConfig(sb: SupabaseClient, tenantId: string) {
  const { data } = await sb
    .from("tenants")
    .select("bulk_edit_enabled, bulk_edit_allow_admins, bulk_edit_delete_enabled, bulk_edit_entities")
    .eq("id", tenantId)
    .maybeSingle();
  return {
    enabled: data?.bulk_edit_enabled !== false,
    allowAdmins: !!data?.bulk_edit_allow_admins,
    deleteEnabled: data?.bulk_edit_delete_enabled !== false,
    entities: (data?.bulk_edit_entities ?? ["contacts", "deals", "tasks", "activities"]) as BulkEntity[],
  };
}

function code(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const ACTIVITY_TYPE_ALIASES: Record<string, string> = {
  llamada: "call",
  llamadas: "call",
  llamada_saliente: "call",
  llamada_entrante: "call",
  reunion: "meeting",
  reunión: "meeting",
  reuniones: "meeting",
  correo: "email",
  correos: "email",
  nota: "note",
  notas: "note",
  whatsapp: "wa_sent",
  whatsapp_enviado: "wa_sent",
  whatsapp_recibido: "wa_received",
  manual: "manual",
};

function normalizeActivityType(value: unknown): string {
  const raw = String(value ?? "").trim().toLowerCase();
  return ACTIVITY_TYPE_ALIASES[raw] ?? raw;
}

function inclusiveDateTo(value: unknown): string {
  const raw = String(value ?? "");
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T23:59:59.999Z` : raw;
}

/** Filtros aceptados por entidad. Cualquier otro se rechaza (nunca se ignora en silencio). */
const SUPPORTED_FILTERS: Record<BulkEntity, string[]> = {
  contacts: ["name_contains", "ids", "owner_id", "status", "source"],
  deals: [
    "name_contains", "ids", "owner_id", "contact_id", "contact_ids", "stage_id", "stage_name",
    "deal_type", "service_type", "payment_status", "only_open", "is_won", "is_lost",
    "amount_equals", "date_from", "date_to",
  ],
  tasks: [
    "name_contains", "ids", "owner_id", "contact_id", "contact_ids", "deal_id",
    "completed", "task_kind", "date_from", "date_to",
  ],
  activities: ["name_contains", "ids", "owner_id", "type", "contact_id", "contact_ids", "deal_id", "date_from", "date_to"],
};

/** Sinónimos frecuentes del modelo → filtro real (se traducen, no fallan). */
const FILTER_ALIASES: Record<string, string> = {
  contact: "contact_id",
  contacto: "contacto_nombre_alias", // se resuelve por nombre más abajo
  contact_name: "contacto_nombre_alias",
  contacto_nombre: "contacto_nombre_alias",
  nombre_contacto: "contacto_nombre_alias",
  deal_ids: "ids",
  task_ids: "ids",
  activity_ids: "ids",
  id: "ids",
  user_id: "owner_id",
  assignee_id: "owner_id",
  agent_id: "owner_id",
  created_by: "owner_id",
  from_date: "date_from",
  to_date: "date_to",
  since: "date_from",
  until: "date_to",
  title_contains: "name_contains",
  name: "name_contains",
  search: "name_contains",
  stage: "stage_name",
  open_only: "only_open",
  won: "is_won",
  lost: "is_lost",
};

/**
 * Normaliza filtros: traduce sinónimos y resuelve nombres de contacto a IDs.
 * Así el copiloto no falla por escribir "contact_name" o "deal_ids".
 */
export async function normalizeFilters(
  sb: SupabaseClient, tenantId: string, entity: BulkEntity, raw: Record<string, any>,
): Promise<{ filters: Record<string, any>; error?: string; notes: string[] }> {
  const notes: string[] = [];
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(raw ?? {})) {
    if (v === undefined || v === null || v === "") continue;
    const key = FILTER_ALIASES[k] ?? k;
    if (key !== k) notes.push(`"${k}" se interpretó como "${key === "contacto_nombre_alias" ? "contacto por nombre" : key}"`);
    if (key === "contacto_nombre_alias") {
      if (entity === "contacts") { out.name_contains = String(v); continue; }
      const { data: matches } = await sb.from("contacts")
        .select("id, name").eq("tenant_id", tenantId).ilike("name", `%${String(v)}%`).limit(20);
      if (!matches?.length) return { filters: out, notes, error: `No encontré ningún contacto que coincida con "${v}".` };
      if (matches.length > 1) {
        return {
          filters: out, notes,
          error: `Hay ${matches.length} contactos que coinciden con "${v}": ${
            matches.map((m: any) => `${m.name} (${m.id})`).join(", ")
          }. Pregunta al usuario cuál y usa contact_id.`,
        };
      }
      out.contact_id = matches[0].id;
      continue;
    }
    if ((key === "ids" || key === "contact_ids") && !Array.isArray(v)) { out[key] = [String(v)]; continue; }
    out[key] = v;
  }
  return { filters: out, notes };
}

function unknownFilterKeys(entity: BulkEntity, f: Record<string, any>) {
  const ok = SUPPORTED_FILTERS[entity] ?? [];
  return Object.keys(f ?? {}).filter((k) => k !== "__mode" && !ok.includes(k));
}


/** Aplica filtros soportados a una consulta. */
function applyFilters(q: any, entity: BulkEntity, f: Record<string, any>) {
  if (f.name_contains) {
    const col = entity === "tasks" ? "title" : entity === "activities" ? "description" : "name";
    q = q.ilike(col, `%${String(f.name_contains)}%`);
  }
  if (f.ids && Array.isArray(f.ids) && f.ids.length) q = q.in("id", f.ids);
  if (f.owner_id) {
    const col = entity === "tasks" ? "assignee_id" : entity === "activities" ? "agent_id" : "owner_id";
    q = q.eq(col, f.owner_id);
  }
  // El contacto aplica a todas las entidades que lo referencian.
  if (entity !== "contacts") {
    if (f.contact_id) q = q.eq("contact_id", f.contact_id);
    if (Array.isArray(f.contact_ids) && f.contact_ids.length) q = q.in("contact_id", f.contact_ids);
  }
  if (entity === "activities") {
    if (f.type) q = q.eq("type", normalizeActivityType(f.type));
    if (f.deal_id) q = q.eq("deal_id", f.deal_id);
    if (f.date_from) q = q.gte("occurred_at", f.date_from);
    if (f.date_to) q = q.lte("occurred_at", inclusiveDateTo(f.date_to));
  }
  if (entity === "deals") {
    if (f.stage_id) q = q.eq("stage_id", f.stage_id);
    if (f.stage_name) q = q.ilike("stage_name", `%${f.stage_name}%`);
    if (f.deal_type) q = q.eq("deal_type", f.deal_type);
    if (f.service_type) q = q.ilike("service_type", `%${f.service_type}%`);
    if (f.payment_status) q = q.eq("payment_status", f.payment_status);
    if (f.only_open) q = q.eq("is_won", false).eq("is_lost", false);
    if (f.is_won === true || f.is_won === false) q = q.eq("is_won", f.is_won);
    if (f.is_lost === true || f.is_lost === false) q = q.eq("is_lost", f.is_lost);
    if (f.amount_equals !== undefined) q = q.eq("amount", f.amount_equals);
    if (f.date_from) q = q.gte("expected_close_date", f.date_from);
    if (f.date_to) q = q.lte("expected_close_date", inclusiveDateTo(f.date_to));
  }
  if (entity === "contacts") {
    if (f.status) q = q.eq("status", f.status);
    if (f.source) q = q.eq("source", f.source);
  }
  if (entity === "tasks") {
    if (f.deal_id) q = q.eq("deal_id", f.deal_id);
    if (f.completed === true || f.completed === false) q = q.eq("completed", f.completed);
    if (f.task_kind) q = q.eq("task_kind", f.task_kind);
    if (f.date_from) q = q.gte("due_at", f.date_from);
    if (f.date_to) q = q.lte("due_at", inclusiveDateTo(f.date_to));
  }
  return q;
}


function sanitizeChanges(entity: BulkEntity, changes: Record<string, any>) {
  const allowed = EDITABLE[entity];
  const out: Record<string, any> = {};
  const rejected: string[] = [];
  for (const [k, v] of Object.entries(changes ?? {})) {
    if (!allowed.includes(k)) { rejected.push(k); continue; }
    if (k === "won_at" && v) {
      const raw = String(v);
      const parsed = new Date(raw.length <= 10 ? `${raw}T23:59:00` : raw);
      if (isNaN(parsed.getTime())) { rejected.push(k); continue; }
      const now = new Date();
      out.won_at = (parsed > now ? now : parsed).toISOString();
      // La fecha puede ser del pasado; si queda antes de la creación se ajusta en bulkApply.
      // Cambiar la fecha de ganado implica que la oportunidad está ganada.
      out.is_won = true;
      out.is_lost = false;
      continue;
    }
    out[k] = v;
  }
  return { changes: out, rejected };
}

/** PASO 1 — vista previa: no modifica nada. */
export async function bulkPreview(
  sb: SupabaseClient, tenantId: string, userId: string,
  entity: BulkEntity, filters: Record<string, any>, rawChanges: Record<string, any>,
  mode: "update" | "delete" = "update",
) {
  if (!TABLE[entity]) return { ok: false, error: "Entidad no soportada" };
  if (!(await isTenantOwner(sb, userId, tenantId)))
    return { ok: false, error: "Solo el dueño del Tenant puede hacer cambios masivos." };

  const isDelete = mode === "delete";
  if (isDelete && !DELETABLE.includes(entity))
    return { ok: false, error: `No se permite borrado masivo de ${LABEL[entity]}. Solo: ${DELETABLE.map((e) => LABEL[e]).join(", ")}.` };

  const cfg = await getBulkConfig(sb, tenantId);
  if (!cfg.entities.includes(entity))
    return { ok: false, error: `Tu Tenant tiene desactivados los cambios masivos de ${LABEL[entity]}.` };
  if (isDelete && !cfg.deleteEnabled)
    return { ok: false, error: "Tu Tenant tiene desactivado el borrado masivo. Actívalo en Configuración → Copiloto → Capacidades." };

  const { changes, rejected } = isDelete
    ? { changes: {} as Record<string, any>, rejected: [] as string[] }
    : sanitizeChanges(entity, rawChanges);
  if (!isDelete && !Object.keys(changes).length)
    return { ok: false, error: `Sin campos válidos que cambiar. Permitidos: ${(EDITABLE[entity] ?? []).join(", ")}` };
  if (!filters || !Object.keys(filters).length)
    return { ok: false, error: "Debes indicar al menos un filtro; no se permiten cambios sin filtro." };
  const norm = await normalizeFilters(sb, tenantId, entity, filters);
  if (norm.error) return { ok: false, error: norm.error };
  filters = norm.filters;
  if (!Object.keys(filters).length)
    return { ok: false, error: "Debes indicar al menos un filtro; no se permiten cambios sin filtro." };
  const badKeys = unknownFilterKeys(entity, filters);
  if (badKeys.length)
    return {
      ok: false,
      error: `Filtros no soportados para ${LABEL[entity]}: ${badKeys.join(", ")}. Permitidos: ${SUPPORTED_FILTERS[entity].join(", ")}. No se ejecutó nada.`,
    };

  let q = sb.from(TABLE[entity]).select(PREVIEW_FIELDS[entity]).eq("tenant_id", tenantId);
  q = applyFilters(q, entity, filters).limit(MAX_BULK_ROWS + 1);

  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  const rows = data ?? [];
  if (!rows.length) return { ok: false, error: "Ningún registro coincide con esos filtros." };
  if (rows.length > MAX_BULK_ROWS)
    return { ok: false, error: `Demasiados registros (>${MAX_BULK_ROWS}). Acota los filtros.` };

  const wonRows = entity === "deals" ? rows.filter((r: any) => r.is_won) : [];
  const summary = isDelete
    ? `BORRAR ${rows.length} ${LABEL[entity]}${
      wonRows.length ? ` (¡ojo! ${wonRows.length} están GANADAS y afectan ingresos y metas)` : ""
    } (se guarda respaldo para revertir)`
    : `Cambiar ${rows.length} ${LABEL[entity]}: ${
      Object.entries(changes).map(([k, v]) => `${k} → ${v}`).join(", ")
    }`;

  const { data: op, error: e2 } = await sb.from("bulk_edit_operations").insert({
    tenant_id: tenantId,
    requested_by: userId,
    entity,
    filters: { ...filters, __mode: mode },
    changes,
    target_ids: rows.map((r: any) => r.id),
    matched_count: rows.length,
    confirm_code: code(),
    summary,
    status: "preview",
  }).select("id, confirm_code, matched_count, summary").single();
  if (e2) return { ok: false, error: e2.message };

  return {
    ok: true,
    step: "preview",
    operation_id: op.id,
    matched_count: op.matched_count,
    summary: op.summary,
    rejected_fields: rejected,
    filters_used: filters,
    filter_notes: norm.notes,
    won_count: wonRows.length,
    sample: rows.slice(0, 10),
    next: `Muestra al usuario los filtros interpretados, cuántos registros y la lista de ejemplos${
      wonRows.length ? `, advirtiendo que ${wonRows.length} están GANADAS` : ""
    }. Pídele que confirme y luego llama bulk_confirm.`,
  };
}


async function loadOp(sb: SupabaseClient, tenantId: string, id: string) {
  const { data } = await sb.from("bulk_edit_operations").select("*")
    .eq("id", id).eq("tenant_id", tenantId).maybeSingle();
  return data as any;
}

/** PASO 2 — confirmación intermedia: entrega el código de seguridad. */
export async function bulkConfirm(sb: SupabaseClient, tenantId: string, userId: string, opId: string) {
  if (!(await isTenantOwner(sb, userId, tenantId)))
    return { ok: false, error: "Solo el dueño del Tenant puede confirmar cambios masivos." };
  const op = await loadOp(sb, tenantId, opId);
  if (!op) return { ok: false, error: "Operación no encontrada" };
  if (op.status !== "preview") return { ok: false, error: `La operación está en estado "${op.status}".` };
  if (new Date(op.expires_at) < new Date()) {
    await sb.from("bulk_edit_operations").update({ status: "expired" }).eq("id", opId);
    return { ok: false, error: "La operación expiró. Genera una nueva vista previa." };
  }
  await sb.from("bulk_edit_operations").update({ status: "confirmed" }).eq("id", opId);
  return {
    ok: true,
    step: "confirm",
    operation_id: opId,
    matched_count: op.matched_count,
    summary: op.summary,
    confirm_code: op.confirm_code,
    next: `ÚLTIMO PASO: pide al usuario que escriba el código ${op.confirm_code} para ejecutar. No llames bulk_apply hasta que el usuario escriba ese código.`,
  };
}

/** PASO 3 — ejecución (requiere código). Guarda snapshot para revertir. */
export async function bulkApply(
  sb: SupabaseClient, tenantId: string, userId: string, opId: string, confirmCode: string,
) {
  if (!(await isTenantOwner(sb, userId, tenantId)))
    return { ok: false, error: "Solo el dueño del Tenant puede ejecutar cambios masivos." };
  const op = await loadOp(sb, tenantId, opId);
  if (!op) return { ok: false, error: "Operación no encontrada" };
  if (op.status === "applied") return { ok: false, error: "Esta operación ya fue aplicada." };
  if (op.status !== "confirmed") return { ok: false, error: "Falta el paso de confirmación (bulk_confirm)." };
  if (String(confirmCode ?? "").trim() !== op.confirm_code)
    return { ok: false, error: "Código de confirmación incorrecto. Pídelo de nuevo al usuario." };
  if (new Date(op.expires_at) < new Date()) {
    await sb.from("bulk_edit_operations").update({ status: "expired" }).eq("id", opId);
    return { ok: false, error: "La operación expiró. Genera una nueva vista previa." };
  }

  const entity = op.entity as BulkEntity;
  const table = TABLE[entity];
  const ids: string[] = op.target_ids ?? [];
  const fields = Object.keys(op.changes);
  const isDelete = op.filters?.__mode === "delete";

  if (isDelete) {
    // Respaldo completo de las filas antes de borrarlas (permite revertir).
    const { data: backup, error: eBk } = await sb.from(table)
      .select(RESTORE_FIELDS[entity] ?? "*").in("id", ids).eq("tenant_id", tenantId);
    if (eBk) return { ok: false, error: eBk.message };
    const { data: deleted, error: eDel } = await sb.from(table)
      .delete().in("id", ids).eq("tenant_id", tenantId).select("id");
    if (eDel) return { ok: false, error: eDel.message };
    const delCount = deleted?.length ?? 0;
    // Verificación real: ¿quedó algo sin borrar?
    const { data: leftovers } = await sb.from(table)
      .select("id").in("id", ids).eq("tenant_id", tenantId);
    const remaining = leftovers?.length ?? 0;
    await sb.from("bulk_edit_operations").update({
      status: "applied",
      applied_count: delCount,
      snapshot: backup ?? [],
      applied_at: new Date().toISOString(),
    }).eq("id", opId);
    return {
      ok: true,
      step: "applied",
      operation_id: opId,
      applied_count: delCount,
      remaining_count: remaining,
      summary: op.summary,
      next: remaining > 0
        ? `Se borraron ${delCount} de ${ids.length}; ${remaining} no se pudieron borrar (permisos o dependencias). Avísale al usuario con esos números exactos.`
        : `Borrados ${delCount} registros (verificado en base de datos). Se puede restaurar con "revertir cambio ${opId.slice(0, 8)}" (bulk_undo).`,
    };

  }

  // Snapshot de los valores actuales (para revertir).
  const { data: before, error: eSnap } = await sb.from(table)
    .select(["id", ...fields].join(", ")).in("id", ids);
  if (eSnap) return { ok: false, error: eSnap.message };

  const { data: updated, error: eUpd } = await sb.from(table)
    .update(op.changes).in("id", ids).eq("tenant_id", tenantId).select("id");
  if (eUpd) return { ok: false, error: eUpd.message };

  // Verificación real en base de datos antes de confirmar al usuario.
  const applied = updated?.length ?? 0;

  // Si la fecha de ganado quedó antes de la creación, movemos la creación un día antes.
  let createdAdjusted = 0;
  if (entity === "deals" && op.changes?.won_at) {
    const wonAt = new Date(op.changes.won_at);
    const { data: bad } = await sb.from("deals")
      .select("id").in("id", ids).eq("tenant_id", tenantId).gt("created_at", wonAt.toISOString());
    if (bad?.length) {
      const newCreated = new Date(wonAt.getTime() - 86400000).toISOString();
      await sb.from("deals").update({ created_at: newCreated })
        .in("id", bad.map((r: any) => r.id)).eq("tenant_id", tenantId);
      createdAdjusted = bad.length;
    }
  }

  await sb.from("bulk_edit_operations").update({
    status: "applied",
    applied_count: applied,
    snapshot: before ?? [],
    applied_at: new Date().toISOString(),
  }).eq("id", opId);

  return {
    ok: true,
    step: "applied",
    operation_id: opId,
    applied_count: applied,
    created_at_adjusted: createdAdjusted,
    summary: op.summary,
    warning: createdAdjusted
      ? `En ${createdAdjusted} oportunidad(es) la fecha de ganado era anterior a la de creación; se recorrió la fecha de creación a un día antes. Avísale al usuario.`
      : undefined,
    next: `Listo. Avisa que puede revertirse con "revertir cambio ${opId.slice(0, 8)}" (bulk_undo).`,
  };
}

/** Revertir: restaura los valores previos guardados en el snapshot. */
export async function bulkUndo(sb: SupabaseClient, tenantId: string, userId: string, opId: string) {
  if (!(await isTenantOwner(sb, userId, tenantId)))
    return { ok: false, error: "Solo el dueño del Tenant puede revertir cambios masivos." };
  const op = await loadOp(sb, tenantId, opId);
  if (!op) return { ok: false, error: "Operación no encontrada" };
  if (op.status !== "applied") return { ok: false, error: `No se puede revertir (estado "${op.status}").` };

  const table = TABLE[op.entity as BulkEntity];
  const snapshot: any[] = op.snapshot ?? [];

  if (op.filters?.__mode === "delete") {
    if (!snapshot.length) return { ok: false, error: "No hay respaldo para restaurar." };
    const rows = snapshot.map((r) => ({ ...r, tenant_id: tenantId }));
    const { data, error } = await sb.from(table).upsert(rows, { onConflict: "id" }).select("id");
    if (error) return { ok: false, error: error.message };
    await sb.from("bulk_edit_operations").update({
      status: "reverted", reverted_at: new Date().toISOString(),
    }).eq("id", opId);
    return { ok: true, step: "reverted", operation_id: opId, restored_count: data?.length ?? 0 };
  }

  // Agrupa filas con los mismos valores previos para revertir en pocos updates.
  const groups = new Map<string, { patch: Record<string, any>; ids: string[] }>();
  for (const row of snapshot) {
    const { id, ...prev } = row;
    const key = JSON.stringify(prev);
    if (!groups.has(key)) groups.set(key, { patch: prev, ids: [] });
    groups.get(key)!.ids.push(id);
  }
  let restored = 0;
  for (const g of groups.values()) {
    const { data: rows, error } = await sb.from(table).update(g.patch)
      .in("id", g.ids).eq("tenant_id", tenantId).select("id");
    if (error) return { ok: false, error: error.message, restored };
    restored += rows?.length ?? 0;

  }
  await sb.from("bulk_edit_operations").update({
    status: "reverted", reverted_at: new Date().toISOString(),
  }).eq("id", opId);
  return { ok: true, step: "reverted", operation_id: opId, restored_count: restored };
}

/** Cancela una operación pendiente. */
export async function bulkCancel(sb: SupabaseClient, tenantId: string, opId: string) {
  const op = await loadOp(sb, tenantId, opId);
  if (!op) return { ok: false, error: "Operación no encontrada" };
  if (op.status === "applied") return { ok: false, error: "Ya se aplicó; usa revertir." };
  await sb.from("bulk_edit_operations").update({ status: "cancelled" }).eq("id", opId);
  return { ok: true, step: "cancelled", operation_id: opId };
}

/** Últimas operaciones masivas del tenant (para revertir o auditar). */
export async function bulkList(sb: SupabaseClient, tenantId: string) {
  const { data } = await sb.from("bulk_edit_operations")
    .select("id, entity, summary, status, matched_count, applied_count, created_at, applied_at")
    .eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(10);
  return { ok: true, operations: data ?? [] };
}
