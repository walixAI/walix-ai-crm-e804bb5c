# Nueva capacidad nativa: Ajustar meta del mes

Hoy el Copiloto solo puede **leer** la meta (`get_monthly_goal`). Vamos a añadir la capacidad de **modificarla** desde el chat, con las mismas reglas de seguridad que ya tiene la pantalla Configuración → Metas.

## Qué hará

Cuando el admin diga cosas como *"ajusta la meta de este mes a 480,000"* o *"pon 500 mil de meta para agosto"*, el Copiloto:

1. Confirmará el mes, el monto total y (opcional) el desglose por tipo (venta / servicio / refacción).
2. Pedirá confirmación explícita antes de guardar ("¿Confirmas ajustar la meta de julio 2026 a $480,000?").
3. Registrará la nueva meta y devolverá el resumen actualizado.

Reglas de negocio (ya vigentes en BD, sólo las respetamos):
- Solo `tenant_owner` / `tenant_admin` / `org_owner` pueden ajustarla (RLS ya lo aplica).
- No se pueden modificar metas de meses pasados (trigger existente `tenant_monthly_goals_no_past` ya lo bloquea).
- Cada cambio queda en el historial (tabla ya guarda cada versión con `created_by` y `created_at`).

## Cambios

**Backend — `supabase/functions/ai-copilot/index.ts`**
- Nueva tool `set_monthly_goal` con parámetros: `year?`, `month?`, `total`, `by_type?` (`{venta, servicio, refaccion}`), `note?`.
- Executor: inserta en `tenant_monthly_goals` usando el cliente con JWT del usuario (RLS filtra a admins). Devuelve error legible si el usuario no es admin o si el mes es pasado.
- System prompt: añadir regla — "para `set_monthly_goal` siempre confirma monto y mes con el usuario antes de ejecutar; nunca la llames en el primer turno".

**Builder — `supabase/functions/copilot-builder/index.ts`**
- Añadir `set_monthly_goal` a `PRIMITIVES` con riesgo `write` para que aparezca como bloque disponible al componer recetas.

**UI — `src/components/settings/copilot/CopilotCapabilitiesTab.tsx`**
- Añadir la nueva primitiva a `NATIVE_CAPABILITIES` con etiqueta "Ajustar meta del mes" y descripción, marcada como `Ejecuta`.

## Detalles técnicos

- Si el usuario no especifica mes/año, se asume el mes en curso.
- `by_type` es opcional; si no se envía, se guarda `{venta:0, servicio:0, refaccion:0}`.
- Errores mapeados:
  - `check_violation` del trigger → *"No se puede modificar la meta de un mes pasado."*
  - RLS/permiso → *"Solo administradores del tenant pueden ajustar la meta."*
- No se requiere migración; la tabla y sus políticas ya existen.

## Fuera de alcance

- UI dedicada para historial de cambios (ya vive en Configuración → Metas).
- Ejecutar el cambio sin confirmación humana.
