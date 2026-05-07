
# Copiloto Drawer — UI conversacional con tool use

Reemplaza el `AiDrawer` y el AiPromptBar del TopBar por un **`CopilotDrawer`** lateral persistente que conversa con `runCopilot` (Gemini 2.5 Pro vía AI Gateway, ya implementado), muestra acciones ejecutadas en tiempo real, gestiona la confirmación de WhatsApp y soporta entrada por voz.

**Decisiones confirmadas:**
- ⌘K → CopilotDrawer · ⌘J → CommandPalette
- AiDrawer viejo y `aiDrawer.ts` se eliminan; `Dashboard`, `TopBar`, `CommandPalette` se migran
- Badge dice **"Walix Copiloto"** sin nombre de modelo (chip neutral "Beta" opcional)

---

## 1. Tokens

`src/index.css` + `tailwind.config.ts`: agregar token `success` si falta (`--success: 142 70% 45%; --success-foreground: 0 0% 100%`). Todo lo nuevo usa tokens semánticos (`primary`, `success`, `muted`, etc.) — cero `bg-indigo-500` o `bg-green-50` directos.

## 2. Sugerencias contextuales

`src/lib/constants/copilotSuggestions.ts`: mapa `route → string[3]`. Hook `useContextSuggestions(pathname, entity)` devuelve los chips a mostrar bajo el composer.

| Ruta | Sugerencias |
|---|---|
| `/dashboard` | "¿Cuánto vale mi pipeline?" · "¿Qué deals cierran esta semana?" · "Resume conversaciones sin responder" |
| `/contacts/:id` | "¿Cuándo fue el último contacto?" · "Crea tarea de seguimiento mañana" · "Redacta WhatsApp de seguimiento" |
| `/pipeline` | "¿Qué oportunidades están en riesgo?" · "Top 5 deals por monto" · "Mueve {deal} a Negociación" |
| `/whatsapp` | "Resume esta conversación" · "Sugiere respuesta" · "Crea deal con este contacto" |
| default | "Top 5 leads más calientes" · "¿Quién es mi contacto más activo?" · "¿Qué necesito hacer hoy?" |

## 3. Store: `src/store/copilot.ts`

```ts
type CopilotMessage =
  | { id; role: 'user'; text; at }
  | { id; role: 'assistant'; text; toolsUsed: ToolUse[]; pendingWhatsapp?: PendingWa | null; at }

state {
  open, status: 'idle'|'thinking'|'executing',
  messages: CopilotMessage[],
  conversationKey: string,        // 'global' | `deal:UUID` | `contact:UUID` | `convo:UUID`
  hasLoadedHistory: Record<conversationKey, boolean>,
  proactiveCount: number,         // badge en TopBar
}

actions:
  openDrawer(), closeDrawer(),
  setContext({ conversationKey })  // llamado por AppLayout en cambio de ruta
  loadHistoryForCurrentKey()       // SELECT últimos 20 ai_conversation_history (user_id + session_id)
  send(text)                        // push user, status='thinking'→'executing'→'idle', llama runCopilot, append assistant
  newConversation()                 // limpia messages locales, rota conversationKey con sufijo `:${ts}`
  confirmWhatsapp(msgId, draft)    // resuelve conversation_id desde contact_id, invoca whatsapp-send
  cancelWhatsapp(msgId), editWhatsapp(msgId, newDraft)
  refreshProactiveCount()
```

Sin streaming real (runCopilot devuelve todo al final): durante `executing` mostramos un placeholder card "🔧 Ejecutando…" en el último slot; al recibir respuesta se reemplaza con los `toolsUsed[]` reales en orden + texto final.

## 4. Componente `src/components/walix/CopilotDrawer.tsx`

```text
┌─ Sheet side="right" w-[480px] modal={false} ──────────────────┐
│ Header (gradient sutil primary→accent /5)                      │
│  ╭──╮  Walix Copiloto    [Beta]                  [+] [X]       │
│  │✨│  ● Listo / Pensando… / Ejecutando…                       │
│  ╰──╯                                                          │
├────────────────────────────────────────────────────────────────┤
│ ScrollArea flex-1                                              │
│  ▸ UserBubble (derecha, bg-primary/10, rounded-2xl)            │
│  ▸ AssistantBubble (izq, avatar sparkles + bg-card border)     │
│      · markdown (bold, listas, code inline + bloques, citas)   │
│      · ToolCards renderizadas inline en orden de ejecución     │
│      · WhatsappConfirmCard si pendingWhatsapp                  │
│  ▸ ToolRunningCard (skeleton con shimmer) durante 'executing'  │
├────────────────────────────────────────────────────────────────┤
│ Suggestion chips (3, según ruta)                               │
│ Composer: textarea autogrow + 🎙️ + → (Enter envía)             │
└────────────────────────────────────────────────────────────────┘
```

**Avatar animado:** círculo `bg-gradient-to-br from-primary to-accent` con `<Sparkles>`. En `thinking`: `animate-pulse` + halo absoluto `ring-2 ring-primary/40 animate-ping`.

**Persistencia abierto:** `Sheet modal={false}` → resto de la app sigue interactiva, no se cierra al navegar.

**Markdown:** extiendo el render existente de `AiDrawer` (bold, listas, citas `[deal:...|...]`) para soportar `` `inline` `` y bloques ```` ``` ````. Sin `react-markdown`.

### ToolCard

Mapeo `toolName → { icon, label, summary(result), action? }`:

| Tool | Label | Acción de la card |
|---|---|---|
| `search_contacts` | 🔍 Búsqueda | lista hits, click → `/contacts/:id` |
| `get_contact_context` | 🧠 Contexto | resumen 1 línea, expandible |
| `get_pipeline_status` | 📊 Pipeline | KPIs inline |
| `create_contact` | 👤 Contacto creado | "Ver →" `/contacts/:id` |
| `create_deal` | 💼 Deal creado | "Ver pipeline →" |
| `move_deal_stage` | ➡️ Movido a {stage} | "Ver deal →" |
| `add_note` | 📝 Nota agregada | — |
| `create_task` | ✅ Tarea creada | "Ver tareas →" |
| `prepare_whatsapp_message` | 💬 Mensaje preparado | abre WhatsappConfirmCard |

Estado `running`: spinner + label en gris. Estado `done`: ✅ + bg-success/5 border-success/20. Estado `error`: ✗ + bg-destructive/5.

### WhatsappConfirmCard (regla de oro — visualmente imposible de ignorar)

```
┌─ border-2 border-success bg-success/10 ────────────┐
│ 💬 Enviar mensaje a María García                    │
│ ┌───────────────────────────────────────────────┐  │
│ │ Hola María, te confirmo nuestra reunión del   │  │
│ │ jueves a las 10am. ¿Sigue en pie?             │  │
│ └───────────────────────────────────────────────┘  │
│ [📱 Enviar ahora]  [✏️ Editar]  [✗ Cancelar]        │
└────────────────────────────────────────────────────┘
```
- "Editar" → reemplaza preview por `<Textarea>` editable + "Confirmar".
- "Enviar" → resuelve `conversation_id` desde `contact_id` (busca `conversations` open o crea), invoca edge `whatsapp-send`. Toast éxito/error. Card se transforma en "✅ Enviado a HH:mm".
- "Cancelar" → solo retira la card.

### Composer

- `<Textarea>` autogrow 1–4 líneas (recálculo en `onInput` con `scrollHeight`, cap 96px).
- Atajos: `Enter` envía · `Shift+Enter` salto · `Cmd/Ctrl+Enter` también envía.
- Placeholder rota cada 4s con sugerencias contextuales si está vacío y sin foco.
- Botón 🎙️: ver Voz.

### Voz (Web Speech API)

```ts
const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
```
- Sin soporte (Firefox) → tooltip "Voz no disponible" + botón disabled.
- Con soporte: click inicia `recognition.start()` con `lang='es-MX'`, `interimResults=true`, `continuous=false`. Botón cambia a rojo `animate-pulse` + barra de "escuchando…" arriba del composer. Cada `onresult` actualiza el composer con la transcripción acumulada. Al `onend` (silencio o stop manual) auto-envía si hay texto. Segundo click cancela sin enviar.

### Historial persistente

Al primer `openDrawer()` por `conversationKey`: SELECT `role, content, tool_calls` FROM `ai_conversation_history` WHERE `user_id=auth.uid()` AND `session_id={key}` ORDER BY `created_at DESC` LIMIT 20 → reconstruye en orden cronológico. "Nueva conversación" rota el key con `:${ts}` y limpia la vista (el thread anterior queda intacto en BD).

## 5. TopBar — `src/components/layout/TopBar.tsx`

- El `<Input>` actual se vuelve **trigger visual** (read-only, `onClick` → `openCopilot()`). Mantengo aspecto, kbd hint `⌘K`, ícono Beta.
- Quitar dropdown de sugerencias del Input (ahora viven en el drawer).
- **Badge proactivo:** dot rojo `absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive animate-pulse` sobre el ícono Sparkles del Input cuando `proactiveCount > 0` (lee del store).

## 6. AppLayout — `src/components/layout/AppLayout.tsx`

- Reemplazar `<AiDrawer/>` por `<CopilotDrawer/>` (montado fuera del `<Outlet/>`, persistente).
- Shortcuts: `⌘/Ctrl+K` → `openCopilot()` · `⌘/Ctrl+J` → abrir CommandPalette.
- `useEffect([location])` → `setContext({ conversationKey: deriveKey(pathname, search) })`:
  - `/contacts/:id` → `contact:UUID`
  - `/pipeline?dealId=...` → `deal:UUID`
  - `/whatsapp?conversationId=...` → `convo:UUID`
  - resto → `global`

## 7. Cleanup

- **Borrar:** `src/components/walix/AiDrawer.tsx`, `src/store/aiDrawer.ts`.
- **Migrar a `useCopilot`:**
  - `src/pages/app/Dashboard.tsx` (botones que llamaban `useAiDrawer().ask`).
  - `src/components/walix/CommandPalette.tsx` (item "Preguntar a IA").
  - `src/components/layout/TopBar.tsx`.
- **No tocar:** `services/ai.ts` exports `executeProposal`/`previewProposal` — siguen usados por flujos `ai-execute` independientes (AiContextPanel, etc.).

---

## Riesgos & límites

- **Sin streaming real:** `runCopilot` espera todo el loop antes de responder (5–10s). Mitigación: status `Pensando…`/`Ejecutando…` + skeleton card. Streaming SSE quedaría para una iteración futura.
- **Web Speech API:** solo Chrome/Edge/Safari; Firefox queda sin voz (graceful disable).
- **`whatsapp-send`** requiere `conversation_id`: el botón "Enviar ahora" hace round-trip para resolverlo desde `contact_id` (consulta `conversations` open o la crea).
- **Sheet `modal={false}`** de Radix: verificar que no rompa scroll lock ni focus trap en mobile (en mobile <768px se podría seguir usando `modal={true}`).

## Orden de ejecución

1. Token `success` (si falta).
2. `copilotSuggestions.ts` + hook.
3. `store/copilot.ts`.
4. `CopilotDrawer.tsx` (+ subcomponentes inline).
5. `TopBar.tsx`: trigger read-only + badge proactivo.
6. `AppLayout.tsx`: montar drawer, ⌘K/⌘J, setContext por ruta.
7. Borrar `AiDrawer.tsx` + `aiDrawer.ts`, migrar `Dashboard` y `CommandPalette`.
