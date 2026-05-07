## Resumen
Conectar la memoria persistente de IA (`ai_proactive_suggestions` + `ai_entity_context`) a la UI: nuevo briefing matutino, panel de sugerencias proactivas, panel lateral con contexto real en Contactos/Deals e indicadores de urgencia en cards/listas.

---

## Recomendaciones guardadas (del prompt anterior, pendientes de aplicar después)
1. Configurar Database Webhook en Cloud → Database → Webhooks: tabla `ai_memory_events`, evento `INSERT`, target `ai-context-updater`. (No automatizable desde código; requiere acción del usuario en el panel).
2. Agregar `logEvent('contact', id, 'note_added', …)` donde se crean notas/actividades del contacto.
3. Normalizar WhatsApp para que `logEvent` registre también `entity_type='contact'` (resolviendo `contact_id` desde la conversación), de modo que el resumen del contacto incluya actividad de WhatsApp.

(Estos puntos quedan registrados; se aplicarán en un prompt posterior.)

---

## Cambios de este prompt

### 1. Nuevo componente `MorningBriefing` (widget arriba del Dashboard)
Archivo nuevo: `src/components/walix/MorningBriefing.tsx`.

- Fondo `bg-gradient-to-br from-indigo-900 to-indigo-800`, texto blanco, `rounded-xl p-6`.
- Saludo: `"Buenos días, {nombre}. Esto es lo más importante de hoy:"`.
- Lista las 3 sugerencias con mayor `priority` desde `useProactiveSuggestions()`.
- Pie: `+ Ver N sugerencias más →` (scroll/anchor al panel `ProactiveBriefing`).
- Botón X: guarda `walix.morningBriefing.dismissed = YYYY-MM-DD` en `localStorage` y no vuelve a mostrarse hasta el siguiente día.
- No se renderiza si no hay sugerencias o si ya fue cerrado hoy.

Integración: insertar al inicio del JSX en `src/pages/app/Dashboard.tsx` (antes del bloque "Risk alert").

### 2. Nuevo componente `ProactiveBriefing` (reemplaza el panel "Sugerencias del día")
Archivo nuevo: `src/components/walix/ProactiveBriefing.tsx`.

- Header: `✨ Tu briefing de hoy` + texto `Actualizado hace X min` (calculado del `created_at` más reciente).
- Sub-badge: `Gemini 2.5 Flash · N eventos procesados` (N = sugerencias activas; se usa Gemini porque Lovable AI Gateway no expone Claude — sustitución coherente con el contexto manager ya implementado).
- Renderiza máx 5 sugerencias activas (ya filtradas por `getProactiveSuggestions`).
- Cada card:
  - Icono según `action_type`: 💬 `send_whatsapp`, 📊 `move_deal`, 📋 `create_task`, 🔔 `schedule_followup`, ⚠️ fallback.
  - `suggestion_text` (clamp 2 líneas).
  - Chip clickable de la entidad (`entity_type` + `entity_id`) que navega a `/contacts/:id`, `/pipeline?dealId=:id` o `/whatsapp?conversationId=:id`.
  - Barra de urgencia con color: verde `priority<4`, amarillo `4–7`, rojo `>7` (mapeo desde `priority` 0–10).
  - Botón primario según `action_type` (texto/icono variable).
  - Botón X que llama `dismiss(id)`.
- Al pulsar acción: llamar `actOn(id)` + navegar/abrir el destino + `toast.success("Acción registrada")`.

Reemplaza el bloque actual `AI Insights` (líneas 240–280 de `Dashboard.tsx`).

### 3. Nuevo `AiContextPanel` (panel lateral de contexto)
Archivo nuevo: `src/components/walix/AiContextPanel.tsx`.

Props: `entityType: 'contact'|'deal'`, `entityId: string`.
Usa `useEntityContext(entityType, entityId)` y `useProactiveSuggestions()` filtrando por entidad.

Secciones:
- **Lo que sé**: `context_summary` en 2–3 frases + chips de `key_facts` (máx 5) + indicador de sentimiento (😊/😐/😟 según `sentiment`).
- **Urgencia**: barra horizontal con `urgency_score` (0–100), color semántico (verde<30, amarillo 30–70, rojo>70), label numérico.
- **Siguiente paso sugerido**: render de la sugerencia proactiva activa más prioritaria para esa entidad (si existe), con su botón de acción.
- Botón **Actualizar contexto**: dispara `aiMemory.logEvent(entityType, entityId, 'manual_refresh', {})` (lo cual fuerza el trigger de actualización del contexto vía el webhook cuando esté configurado) + invalida la query.
- Estado vacío: "Aún no hay contexto suficiente — la IA aprende con cada interacción."

Integración:
- En `src/components/contacts/detail/InfoSidePanel.tsx`: agregar `<AiContextPanel entityType="contact" entityId={contact.id} />` arriba del contenido existente.
- En `src/components/pipeline/DealDrawer.tsx`: agregar dentro del panel lateral existente.

### 4. Indicadores de urgencia
Archivo nuevo: `src/hooks/useEntityUrgency.ts` — wrapper que devuelve `{ urgencyScore, sentiment }` desde `useEntityContext` (más conveniente y evita refetch agresivo: usa `staleTime: 60_000`).

- **`DealCard.tsx`**: si `urgencyScore > 75`, mostrar punto rojo parpadeante (`h-2 w-2 rounded-full bg-destructive animate-pulse`) en la esquina superior derecha de la card.
- **Lista de Contactos** (`ContactsKanban.tsx` y/o vista lista en `Contacts.tsx`): añadir punto coloreado al lado de "Última actividad":
  - verde `<30`, amarillo `30–70`, rojo `>70`.
- Si no hay contexto cargado, no renderizar el indicador.

### 5. Ajustes finales
- `useProactiveSuggestions` ya tiene `refetchInterval: 60_000` y `staleTime: 30_000` — confirma alineación con la sugerencia (60s).
- Sin nuevas tablas ni migraciones.
- Sin nuevas Edge Functions ni secretos.

---

## Detalles técnicos
- Mapeo `priority` (0–10) → urgencia: low <4, mid 4–7, high >7. El `urgency_score` (0–100) en `ai_entity_context` se mapea directamente para los indicadores en cards.
- Navegación entidad:
  - `contact` → `/contacts/{id}`
  - `deal` → `/pipeline?dealId={id}`
  - `conversation` → `/whatsapp?conversationId={id}`
- Toast: `sonner` (ya en uso global).
- Modelo en badges: usar `Gemini 2.5 Flash` (lo que realmente corre en `ai-context-updater`), no Claude.
- LocalStorage key del briefing: `walix.morningBriefing.dismissed` con valor `YYYY-MM-DD`.

## Archivos
**Nuevos**
- `src/components/walix/MorningBriefing.tsx`
- `src/components/walix/ProactiveBriefing.tsx`
- `src/components/walix/AiContextPanel.tsx`
- `src/hooks/useEntityUrgency.ts`

**Editados**
- `src/pages/app/Dashboard.tsx` (insertar `MorningBriefing`, reemplazar bloque "AI Insights" por `ProactiveBriefing`).
- `src/components/contacts/detail/InfoSidePanel.tsx` (montar `AiContextPanel`).
- `src/components/pipeline/DealDrawer.tsx` (montar `AiContextPanel`).
- `src/components/pipeline/DealCard.tsx` (punto de urgencia).
- `src/components/contacts/ContactsKanban.tsx` y `src/pages/app/Contacts.tsx` (indicador de urgencia en última actividad).
