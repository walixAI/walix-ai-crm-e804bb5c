
# Plan: Tenant "Refrigeración González y Rodríguez" + módulo "Mi Día"

Objetivo: dejar operando un tenant con dos flujos (Ventas nuevas y Servicio a clientes actuales) y una pantalla "Mi Día" que reemplaza el dashboard SOLO para la gestora (perfil dueño mantiene dashboard normal). La gestora podrá crear pendientes desde un prompt en Walix o por WhatsApp (emulado por ahora), y Walix generará pendientes automáticamente a partir del historial de cada contacto/negocio.

---

## 1. Configuración del tenant (datos semilla)

Vía insert tool:

- **Tenant** `Refrigeración González y Rodríguez` (MXN · America/Mexico_City · es-MX).
- **Dos pipelines**:
  1. `Ventas Nuevas` (default): Nuevo Lead → Contactado → Cotización enviada → Cotización aceptada → En proceso → Entregado (won) → Perdido (lost).
  2. `Servicio y Mantenimiento`: Orden solicitada → Mantenimiento programado → En proceso → Finalizado → Pendiente de pago → Cobrado (won) → Cancelado (lost).
- **Fuentes**: WhatsApp, Referido, Cliente recurrente, Llamada, Web.
- **Etiquetas**: Sub-Zero, Wolf, Residencial, Comercial, Garantía, Fuera de garantía, VIP.
- **Plantillas WhatsApp**: recordatorio de cobro, confirmación de cita, "técnico en camino", envío de cotización, seguimiento cotización, encuesta post-servicio.
- **Dos usuarios** pre-creados:
  - Dueño (`tenant_owner`), `ui_prefs.mode = "normal"` → ve el Dashboard actual.
  - Gestora (`tenant_admin`), `ui_prefs.mode = "simple"` → aterriza en Mi Día.
  - El dueño tendrá en el sidebar acceso directo a "Mi Día (Gestora)" para ver lo mismo que ella.

---

## 2. Modelo de datos (mínimos añadidos)

Reutilizamos `deals`, `contacts`, `tasks`, `conversations`, `messages`. Añadimos vía migración:

- `deals.deal_type` (`text`: `venta` | `servicio`).
- `deals.service_type` (`text`: `mantenimiento` | `reparación` | `instalación` | `garantía`).
- `deals.equipment_brand`, `deals.equipment_model` (`text`).
- `deals.scheduled_at` (`timestamptz`).
- `deals.amount_paid` (`numeric`), `deals.payment_status` (`text`: `pendiente` | `parcial` | `pagado`).
- `tasks.task_kind` (`text`: `cobro` | `cotizacion` | `servicio` | `seguimiento` | `queja` | `refaccion` | `facturacion` | `devolucion` | `otro`) — permite clasificar pendientes.
- `profiles.ui_prefs` (`jsonb`) — guarda `{ mode: "simple" | "normal", miDiaColumns: CustomColumn[] }`.
- Índices por `(tenant_id, deal_type, stage_id)`, `(tenant_id, scheduled_at)`, `(tenant_id, task_kind, completed)`.
- GRANTs y RLS por `tenant_id`.

Sin tocar auth/storage/otros esquemas protegidos.

---

## 3. Módulo "Mi Día" (ruta `/mi-dia`)

Layout tablero tipo Trello, tarjetas jumbo (texto ≥18px, botones ≥48px), alto contraste, cero menús anidados.

**Columnas fijas (siempre visibles)**
1. **💰 Cobrar hoy** — deals `servicio` con `payment_status ≠ pagado` en etapa "Pendiente de pago" o "Finalizado" + tasks `task_kind=cobro`. Acciones: "Marcar cobrado" / "Recordar por WhatsApp".
2. **📝 Cotizar** — deals en "Orden solicitada" (servicio) o "Contactado" (venta) + tasks `task_kind=cotizacion`. Acción: "Enviar cotización" (plantilla WhatsApp).
3. **🔧 Servicios de hoy** — deals con `scheduled_at` = hoy. Acciones: "Técnico en camino" / "Finalizado" / "Reagendar".
4. **📞 Seguimiento** — deals sin actividad >3 días + tasks `task_kind=seguimiento` vencidas. Acción: "Mandar WhatsApp".

**Columnas personalizadas por prompt**
- Botón "➕ Nueva columna" abre un mini-chat: "¿Qué quieres ver en esta columna?".
- Un edge function (`midia-column-builder`) usa Lovable AI Gateway (Gemini 3 Flash) + `generateText` con `Output.object` para traducir el prompt a un **filtro estructurado** (JSON: `taskKinds[]`, `stageIds[]`, `dueWithinDays`, `paymentStatus[]`, `tagIds[]`, `pipelineId`, `dealType`).
- El JSON se guarda en `profiles.ui_prefs.miDiaColumns` y la UI lo aplica sin más código.
- Ejemplos que debe soportar: "Clientes VIP sin comprar en 3 meses", "Refacciones que debo pedir", "Facturas pendientes de emitir".
- La gestora puede reordenar (drag), renombrar y borrar columnas desde el propio header de la columna.

**Encabezado de Mi Día**
- Saludo grande: "Buenos días, Sra. Rodríguez". Contador: "Hoy tienes 3 cobros, 2 servicios y 4 seguimientos".
- Botón "🔊 Escuchar mi día" opcional (deferred, no bloqueante).

**FAB "+ Nuevo pendiente"** (permanente, esquina inferior derecha)
- Opciones grandes con ícono: Cliente nuevo · Orden de servicio · Cobro · Atención de queja · Reclamación · Compra de refacción · Facturación · Devolución · Otro (prompt libre).
- "Otro (prompt libre)" abre input tipo "Dile a Walix qué recordar…"; edge function `midia-task-parser` extrae `title`, `task_kind`, `due_at`, `contact_id?`, `deal_id?` y crea el `task` (y opcionalmente el `deal`).

**Reglas UX**
- Confirmaciones humanas antes de acciones destructivas o de dinero ("¿Marcar cobrado $12,500 de María López?").
- Toda tarjeta: 1 acción primaria grande + máx 2 íconos.
- Deshacer (Undo) 5s tras cualquier cambio de estado.

---

## 4. WhatsApp (emulado por ahora)

Como aún no hay canal real, emulamos el flujo end-to-end para que la migración a Meta sea sólo cambiar el transporte:

- Nueva edge function `whatsapp-sim-inbound` que recibe `{ from, text, media? }` y ejecuta la misma lógica que tendría el webhook real:
  - Si el número no existe → crea `contact`.
  - Si existe → busca deal activo; si no hay, crea un nuevo `deal` (usa IA para clasificar `venta` vs `servicio` y sugerir `equipment_brand`).
  - Crea `conversation` + `message` (`direction=inbound`).
  - Dispara `midia-task-parser` para generar tareas automáticas ("cotizar refrigerador Sub-Zero 736", "agendar mantenimiento").
- Nueva pantalla oculta `/dev/whatsapp-sim` (solo para pruebas) con un formulario para "enviar" mensajes emulados.
- Salidas (`direction=outbound`) se marcan como "enviado (simulado)" en la UI de WhatsApp; no llaman a Meta.
- **Comandos por WhatsApp de la gestora** (emulados): responder "cobrado", "agendar mañana 10", "listo" a un aviso mueve el deal / cierra la tarea vía `whatsapp-ai-command` existente (ya lo tienes).

Cuando conectemos Meta real, solo intercambiamos el transporte en el webhook — la lógica queda igual.

---

## 5. Agentes IA (ya existen, ajustamos prompts)

- **Briefing Matutino**: 3 pendientes top del día para la gestora → aparecen fijados arriba en Mi Día y también se "envían" por WhatsApp simulado a las 8:00am.
- **Guardián de Seguimientos**: crea tasks `seguimiento` cuando cotización >2 días sin respuesta o servicio finalizado >3 días sin cobro.
- **Detector de Riesgo**: crea tasks para clientes VIP sin contacto >60 días.
- **Aprendiz**: aprende horas de mejor respuesta, ticket promedio por marca, tiempo típico de cobro.
- Nuevo agente ligero **Generador de Pendientes** (o extendemos `Guardián`): al detectar nuevo mensaje inbound, historial del contacto, o cambio de etapa, crea `tasks` con `task_kind` correcto para poblar Mi Día automáticamente.

---

## 6. Entregables técnicos

**Migración SQL** (una sola)
- Campos nuevos en `deals`, `tasks`, `profiles` + índices + GRANTs.

**Script insert (datos semilla)**
- Tenant + org, 2 pipelines + etapas, fuentes, etiquetas, plantillas WhatsApp, 2 perfiles (dueño y gestora) con `ui_prefs`, 3-5 contactos de ejemplo y 5-8 deals demo repartidos en ambas pipelines para que la gestora vea Mi Día poblado al primer login.

**Edge functions nuevas**
- `midia-column-builder` (prompt → filtro JSON).
- `midia-task-parser` (prompt/mensaje → task estructurada + posible deal).
- `whatsapp-sim-inbound` (emulador de webhook).

**Frontend**
- `src/pages/app/MiDia.tsx` (nueva pantalla, redirect desde `/` cuando `ui_prefs.mode === "simple"`).
- `src/components/miDia/`: `ColumnaCobrar.tsx`, `ColumnaCotizar.tsx`, `ColumnaServicios.tsx`, `ColumnaSeguimiento.tsx`, `ColumnaPersonalizada.tsx`, `TarjetaJumbo.tsx`, `AccionBoton.tsx`, `NuevoPendienteFAB.tsx`, `NuevaColumnaPromptDialog.tsx`, `EncabezadoMiDia.tsx`.
- `src/lib/queries/miDia.ts` con hooks para las 4+N columnas y mutaciones (marcar cobrado, reagendar, técnico en camino, etc.).
- `src/pages/dev/WhatsappSim.tsx` (oculto en producción).
- Sidebar: entrada "Mi Día (Gestora)" visible al dueño; oculta el resto del menú a la gestora salvo "Mi Día", "Contactos", "WhatsApp" y "Ajustes básicos".
- Router: `/mi-dia` protegida; `RootRedirect` decide entre `/dashboard` y `/mi-dia` según `ui_prefs.mode`.
- Ajuste en `PipelineTab` y `NewDealDialog` para exponer `deal_type` y campos de equipo.

**Diseño**
- Nueva variante `size="jumbo"` en Button y Card en `src/components/ui/` (sin romper existentes).
- Tokens ya existentes (semáforo: success, warning, danger).

---

## 7. Fuera de alcance (explícito)

- CFDI/facturación fiscal — solo entra como tipo de `task`.
- Conexión real a WhatsApp Business API — se hará después; ahora todo emulado.
- Módulo de inventario/refacciones — solo como task `refaccion`.

---

## 8. Orden de implementación sugerido

1. Migración + script semilla.
2. Router + `RootRedirect` + `ui_prefs.mode`.
3. `Mi Día` con las 4 columnas fijas y las mutaciones básicas.
4. FAB + `midia-task-parser`.
5. Columnas personalizadas + `midia-column-builder`.
6. Emulador WhatsApp + generación automática de tareas.
7. Ajuste de prompts de agentes IA.
8. Ajustes de sidebar y accesos del dueño.

Con tu ok arranco por el paso 1.
