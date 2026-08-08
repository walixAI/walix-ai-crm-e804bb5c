// Catálogo de capacidades nativas del Copiloto y su estado por tenant.
// El tenant puede encender/apagar cada primitiva desde Ajustes → Copiloto.
// Se guarda como filas en `copilot_capabilities` con kind='native' y
// recipe_json.native_tool = <id de la capacidad>.

// Herramientas que nunca se pueden desactivar (tutor, deshacer, confirmación).
export const ALWAYS_ON_TOOLS = new Set<string>([
  "get_help_topic",
  "guia_walix",
  "deshacer_ultimo",
  "accion_sensible",
  "bulk_preview",
  "bulk_confirm",
  "bulk_apply",
  "bulk_undo",
  "bulk_cancel",
  "bulk_list",
]);

// Alias del canal WhatsApp → id de capacidad nativa (nombre de la tool web).
export const WA_TOOL_ALIASES: Record<string, string> = {
  buscar_contacto: "search_contacts",
  crear_contacto: "create_contact",
  registrar_nota: "add_note",
  crear_tarea: "create_task",
  crear_oportunidad: "create_deal",
  estatus_pipeline: "get_pipeline_status",
  listar_oportunidades: "get_my_deals",
  listar_tareas: "get_my_tasks",
  resumen_dia: "get_my_tasks",
  mantenimientos_programados: "get_scheduled_services",
  listar_actividades: "get_activities",
};

export function capabilityIdForTool(toolName: string): string {
  return WA_TOOL_ALIASES[toolName] ?? toolName;
}

/** Devuelve los ids de capacidades nativas desactivadas por el tenant. */
export async function getDisabledNativeTools(sb: any, tenantId: string): Promise<Set<string>> {
  try {
    const { data, error } = await sb
      .from("copilot_capabilities")
      .select("recipe_json, is_active")
      .eq("tenant_id", tenantId)
      .eq("kind", "native")
      .eq("is_active", false);
    if (error) throw error;
    const out = new Set<string>();
    for (const row of data ?? []) {
      const id = (row as any)?.recipe_json?.native_tool;
      if (typeof id === "string" && !ALWAYS_ON_TOOLS.has(id)) out.add(id);
    }
    return out;
  } catch (e) {
    console.warn("[native-caps] no se pudo leer configuración, se usan todas:", e);
    return new Set<string>();
  }
}

/** Filtra un arreglo de tools (formato OpenAI) según las capacidades apagadas. */
export function filterTools<T extends { function?: { name?: string } }>(
  tools: T[],
  disabled: Set<string>,
): T[] {
  if (disabled.size === 0) return tools;
  return tools.filter((t) => {
    const name = t?.function?.name ?? "";
    if (ALWAYS_ON_TOOLS.has(name)) return true;
    return !disabled.has(capabilityIdForTool(name));
  });
}
