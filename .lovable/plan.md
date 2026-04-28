# Plan: Mejoras del módulo Pipeline

Implementación dividida en **5 fases incrementales**. Cada fase es desplegable por sí sola y aporta valor visible. Puedes aprobar todo el plan y ejecutarlo de corrido, o cortar en cualquier fase.

---

## Fase 1 — Inteligencia visual y forecast (impacto inmediato)

**Objetivo:** que de un vistazo sepas qué deals están sanos, en riesgo y cuánto vas a cerrar realmente.

### 1.1 Indicadores de salud en `DealCard`
Reemplazar el badge actual de "días en etapa" por un sistema de señales:
- 🔥 **Hot** — actividad WhatsApp en últimas 24h
- 💤 **Cold** — sin actividad en >7 días
- ⚠️ **Stale** — >14 días en la misma etapa (por `updatedAt` del deal vs último cambio de stage)
- 📅 **Overdue** — `expected_close_date` ya pasó y sigue activo

Pequeñas píldoras de color en la esquina inferior izquierda de la card. Tooltip con el detalle al hacer hover.

### 1.2 Forecast ponderado en `PipelineHeader`
Reemplazar la barra actual por 3 KPIs en línea:
- **Pipeline total**: Σ(amount) — lo que hay
- **Pipeline ponderado**: Σ(amount × probability/100) — lo esperado
- **Cierre este mes**: Σ de deals con `expected_close_date` en el mes actual
- Indicador ▲/▼ vs mes anterior (calculado de `created_at` y `updated_at`)

### 1.3 WIP limits por columna
En `KanbanColumn`, si una etapa supera un umbral (configurable por etapa, default 10), mostrar borde superior naranja + badge "Cuello de botella" en el header de la columna.

**Datos:** No requiere cambios de schema. Todo se calcula en cliente con queries existentes (`useDeals`, `useUnreadByContactMap`).

---

## Fase 2 — Acciones rápidas y captura de datos (productividad)

### 2.1 Quick actions en hover sobre `DealCard`
Botones flotantes que aparecen al hacer hover (esquina superior derecha):
- 💬 WhatsApp — navega a `/inbox` con el contacto
- ✅ Marcar ganado — mueve a stage `is_won`
- ❌ Marcar perdido — abre modal de razón (ver 2.2)
- 📅 Nueva tarea — modal mínimo

Implementado con `stopPropagation` para no abrir el drawer.

### 2.2 Modal de razón de pérdida
Cuando un deal se mueve a "Cerrado Perdido" (drag o quick action):
- Modal obligatorio con select: Precio · Timing · Competencia · No responde · Otro
- Textarea opcional de comentario
- Se guarda en columnas nuevas del deal: `lost_reason`, `lost_comment`

**Schema:** migración añade dos columnas a `deals`.

### 2.3 Multi-selección en Kanban
- Checkbox que aparece en hover de la card
- Barra flotante inferior con acciones masivas: "Mover a etapa…", "Reasignar vendedor…", "Eliminar"
- Estado local en `Pipeline.tsx` (set de IDs seleccionados)

### 2.4 Búsqueda global en header
Input en `PipelineHeader` que filtra por `name`, `notes` y nombre de contacto. Combinable con los filtros estructurados existentes.

### 2.5 Persistencia de vista y filtros
Guardar en `localStorage` por usuario:
- View activa (kanban/lista)
- Filtros aplicados
- Pipeline seleccionado

Hook `usePipelinePrefs()` con sync bidireccional.

---

## Fase 3 — Múltiples pipelines y trazabilidad (arquitectura)

### 3.1 Tabla `pipelines` y soporte multi-pipeline
**Schema:**
```text
pipelines
  id uuid PK
  tenant_id uuid
  name text
  is_default boolean
  position int
  created_at timestamptz

pipeline_stages
  + pipeline_id uuid (FK lógico)
```

- Migrar las stages actuales a un pipeline default por tenant
- UI de gestión: dropdown del header se vuelve funcional, opción "Gestionar pipelines" abre dialog para crear/renombrar/reordenar pipelines y sus etapas
- Casos de uso: "Ventas B2B", "Renovaciones", "Soporte Premium"

### 3.2 Historial de cambios de etapa
**Schema:**
```text
deal_stage_history
  id uuid PK
  tenant_id uuid
  deal_id uuid
  from_stage_id uuid
  to_stage_id uuid
  changed_by uuid
  changed_at timestamptz
```

- Trigger en `deals` que inserta automáticamente al cambiar `stage_id`
- Habilita: tiempo real en etapa (no en el deal completo), velocidad del pipeline, tasas de conversión
- Mejora el badge de "días en etapa" para que use el cambio real, no `updatedAt`

### 3.3 Razón de pérdida obligatoria refinada
Si Fase 2.2 ya está, aprovechar para mostrar analytics básicos de razones en el header del pipeline cuando hay deals perdidos en el periodo.

---

## Fase 4 — Capa de IA (diferenciador Walix)

Todo via **Lovable AI Gateway** (ya tenemos `LOVABLE_API_KEY`), modelo `google/gemini-2.5-flash` por costo/latencia.

### 4.1 Edge function `pipeline-ai-analyze`
Recibe el pipeline del tenant, devuelve:
- 3 deals en riesgo con razón
- Top deal recomendado para empujar
- Comparativa de conversión vs periodo anterior
- Resumen ejecutivo de 2-3 líneas

Botón **"Análisis IA"** en el header que abre un panel lateral con esta info.

### 4.2 Edge function `deal-ai-suggest-stage`
Disparada cuando llegan mensajes nuevos del contacto. Analiza últimos 10 mensajes y, si detecta intención de avance, inserta una `ai_suggestion` con `kind='stage_advance'` y `cta` para mover.

UI: toast en el pipeline + ícono ✨ en la card que abre la sugerencia.

### 4.3 Auto-cálculo de probabilidad
Al abrir el `DealDrawer`, botón "Sugerir probabilidad con IA" en el campo correspondiente. Llama edge function que combina:
- Sentimiento de últimos mensajes
- Días en etapa vs promedio histórico (de `deal_stage_history`)
- Cantidad/cadencia de actividades

Devuelve número 0-100 con explicación. Usuario decide si lo aplica.

---

## Fase 5 — Pulido y deleite

### 5.1 Realtime con Supabase
Suscripción a `postgres_changes` en `deals` filtrada por tenant. Si dos vendedores tienen el pipeline abierto, ven cambios en vivo. Optimistic updates ya existentes siguen funcionando.

### 5.2 Vista agrupada alternativa
Toggle adicional en header: agrupar columnas por **Vendedor** o **Mes de cierre** en lugar de por etapa. Reutiliza el componente `KanbanColumn` con groupKey configurable.

### 5.3 Modo compacto/expandido
Toggle visual que cambia altura y densidad de info en `DealCard` (compacto: solo nombre + monto; expandido: todo). Persistido en `usePipelinePrefs`.

### 5.4 Animación de victoria
Confeti (lib `canvas-confetti`) cuando un deal entra en columna `is_won`. Toast: *"🎉 ¡Deal ganado! +$X al pipeline cerrado este mes"*.

### 5.5 Sparkline en header de columna
Gráfica mini de 7 días (cantidad de deals en esa etapa por día, sacado de `deal_stage_history` de Fase 3). Indica si la etapa crece o se vacía.

### 5.6 Optimización
Si hay >150 deals visibles, virtualizar columnas con `@tanstack/react-virtual`. Solo se activa cuando se necesita.

---

## Resumen de cambios técnicos

### Schema (migraciones)
- Fase 2: `deals.lost_reason`, `deals.lost_comment`
- Fase 3: tabla `pipelines`, columna `pipeline_stages.pipeline_id`, tabla `deal_stage_history` + trigger

### Nuevos componentes
- `pipeline/HealthBadges.tsx`, `pipeline/ForecastKpis.tsx`
- `pipeline/QuickActions.tsx`, `pipeline/LostReasonDialog.tsx`, `pipeline/BulkActionsBar.tsx`
- `pipeline/PipelineManagerDialog.tsx`
- `pipeline/AiAnalysisPanel.tsx`

### Nuevas queries / hooks
- `usePipelinePrefs()` (localStorage)
- `useDealHealth(deal)` (calcula señales)
- `useStageHistory(dealId)` 
- `usePipelineForecast()` (KPIs ponderados)

### Edge functions
- `pipeline-ai-analyze`, `deal-ai-suggest-stage`, `deal-ai-suggest-probability`

### Dependencias nuevas
- `canvas-confetti` (Fase 5.4)
- `@tanstack/react-virtual` (Fase 5.6, condicional)

---

## Mi recomendación

**Empezar por Fase 1 + Fase 2** en una sola pasada. Son las que más mueven la aguja para el usuario final, no requieren IA y solo una mini-migración.

Después decides si vas a Fase 3 (arquitectura) o saltas directo a Fase 4 (IA, el diferenciador comercial de Walix).

¿Apruebas el plan completo, o prefieres que arranque solo con Fase 1 + 2 y vamos viendo?
