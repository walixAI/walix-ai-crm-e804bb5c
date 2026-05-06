## Correcciones sección de Contactos

Cuatro problemas detectados, todos de implementación menor:

### 1. Teléfono sigue siendo requerido en alta de contacto (vía IA)

El formulario manual ya permite crear sin teléfono, pero la edge function `supabase/functions/contacts-ai-create/index.ts` sigue exigiéndolo:
- Línea 120: `required: ["name", "phone"]` en el schema de extracción.
- Líneas 161-164: rechaza si no hay phone con mensaje "Necesito al menos nombre y teléfono."

**Fix:** quitar `phone` de `required`, validar solo `name`, ajustar mensaje a "Necesito al menos el nombre del contacto." y permitir insertar contacto con phone null.

### 2. Datos hardcodeados en listado de Contactos

`src/pages/app/Contacts.tsx` (líneas 472-486) tiene un panel "Próximo paso sugerido" con texto fijo de "María Hernández", "$25,000" y un historial IA inventado.

**Fix:** Reemplazar por contenido real:
- Conectar a `useAiSuggestions` (ya existe en `src/lib/queries/`) filtrando por `kind` relacionado a contactos / próximos pasos.
- Si no hay sugerencias, mostrar EmptyState ("La IA analizará tus contactos y mostrará el siguiente paso aquí").
- El "Historial IA" se elimina o se llena con las últimas N sugerencias dismissed/atendidas reales del tenant.
- Botón "Enviar por WhatsApp" se habilita solo cuando la sugerencia trae un `contact_id`.

### 3. Cambiar terminología "Deal" → "Oportunidad" en la IA

Toda la IA conversacional (`global-ai`, `whatsapp-ai-command`, `pipeline-ai`, `dashboard-ai-widgets`, `ai-execute`) y los componentes UI relacionados (`AiDrawer`, `citations.tsx`, `DealsSidePanel.tsx`) usan "deal/Deal/deals" en los prompts del sistema, descripciones de tools y textos visibles al usuario.

**Fix (solo textos, sin renombrar la tabla `deals` ni los IDs internos):**
- Reemplazar en TODOS los prompts del sistema y `description` de tools de las edge functions: "deal" → "oportunidad", "deals" → "oportunidades", "Deal" → "Oportunidad".
- Mantener intactos: nombres de tablas (`deals`), nombres de tools (`propose_update_deal_stage`, etc.), parámetros (`deal_id`), tipos de citation (`[deal:UUID|...]`) — son contratos internos.
- Actualizar UI visible: `DealsSidePanel.tsx` ya muestra "Oportunidades" (ok). Revisar `citations.tsx` para que el chip renderice "Oportunidad" en vez de "Deal". Revisar `AiDrawer` y banners.
- Agregar regla al system prompt de `global-ai`: "Siempre llama 'oportunidad' a un deal cuando hables con el usuario, nunca uses la palabra 'deal'."

### 4. Falta el Tab "Contactos" en Configuración

El componente `ContactsSettingsTab` y los editores `StagesEditor` / `SourcesEditor` ya existen, pero `src/pages/app/Settings.tsx` nunca los registra en el array `TABS` ni renderiza el `<TabsContent value="contacts">`.

**Fix:** Agregar entrada `{ id: "contacts", label: "Contactos" }` en `TABS` (entre "Pipeline" y "WhatsApp"), importar `ContactsSettingsTab` y agregar el `<TabsContent value="contacts"><ContactsSettingsTab /></TabsContent>`.

### Memoria

Guardar en `mem://preferences/terminology.md`: "El usuario llama a los 'deals' siempre 'Oportunidades' en toda UI y mensajes de IA. Internamente la tabla sigue siendo `deals`."

### Archivos a modificar

- `supabase/functions/contacts-ai-create/index.ts` — quitar phone requerido.
- `src/pages/app/Contacts.tsx` — reemplazar panel hardcodeado por sugerencias reales.
- `src/pages/app/Settings.tsx` — registrar tab Contactos.
- `supabase/functions/global-ai/index.ts`, `whatsapp-ai-command/index.ts`, `pipeline-ai/index.ts`, `dashboard-ai-widgets/index.ts`, `contact-ai-suggest/index.ts`, `ai-execute/index.ts`, `ai-inbox/index.ts`, `ai-onboarding-setup/index.ts`, `whatsapp-ai/index.ts`, `automations-ai-draft/index.ts` — terminología "oportunidad" en prompts/descripciones visibles.
- `src/lib/ai/citations.tsx`, `src/components/walix/AiDrawer.tsx` y banners IA — etiqueta visible "Oportunidad".
- `mem://index.md` + `mem://preferences/terminology.md` — guardar regla.

Sin cambios de schema de base de datos.