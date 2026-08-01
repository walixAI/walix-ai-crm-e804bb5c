## 1. Estado actual: cómo ven Admin y usuario las etapas de un Lead/Deal

### Vistas disponibles hoy

| Rol | Dónde ve las etapas | Qué puede hacer |
|-----|---------------------|-----------------|
| **Admin / Tenant Owner / Tenant Admin** | 1. **Pipeline** (`/pipeline`): kanban por etapas de todo el tenant.<br>2. **Configuración → Pipeline** (`/settings?tab=pipeline`): crea pipelines, renombra, elimina y edita etapas (orden, nombre, color).<br>3. **Ficha de contacto → panel derecho "Oportunidades"**: lista los deals del contacto con su etapa actual, monto y probabilidad. | Puede mover deals entre etapas (drag & drop en kanban o selector en el DealDrawer), crear nuevos deals y configurar pipelines/etapas. |
| **Usuario / Vendedor / Gerente de Ventas** | 1. **Pipeline** (`/pipeline`): kanban filtrado por permisos (`own` para vendedor, `team` para gerente).<br>2. **Ficha de contacto → panel derecho "Oportunidades"**: mismo panel, solo ve deals que sus permisos le permiten.<br>3. **DealDrawer**: al hacer clic en un deal se abre un panel con los detalles, incluyendo la etapa actual y el historial de cambios de etapa. | Puede mover sus propios deals entre etapas (si tiene `deals.update.own`) y crear deals. No puede configurar pipelines ni etapas. |

### Cómo funciona el modelo de datos

- **`pipelines`**: conjuntos de etapas (ej. Ventas, Renovaciones, Mantenimientos). Cada tenant puede tener varios pipelines.
- **`pipeline_stages`**: etapas dentro de un pipeline (ej. Nuevo, Contactado, Cotización, Negociación, Cerrado Ganado, Cerrado Perdido). Cada etapa tiene `is_won` / `is_lost`.
- **`deals`**: cada oportunidad apunta a `stage_id` y `stage_name`. El historial de cambios se guarda en `deal_stage_history` gracias al trigger `log_deal_stage_change`.
- **`contacts`**: el contacto tiene un ciclo de vida separado (`prospecto`, `cliente`, `cliente_inactivo`, `inactivo`). Cuando un deal se marca ganado, el trigger `trg_contact_lifecycle_from_deal` promueve al contacto a `cliente`.

### Permisos relevantes (de `src/constants/permissions.ts`)

- `tenant_owner` / `tenant_admin`: `deals.*`, `pipeline.*`, `settings.pipeline`.
- `sales_manager`: `deals.read.team`, `deals.update.team`, `deals.reassign.team`, `pipeline.read`.
- `sales_rep`: `deals.read.own`, `deals.update.own`, `deals.create`, `pipeline.read`.

---

## 2. Propuesta: automatizar el avance de etapas por resultado de actividad + tipificación

### Objetivo

Que el tenant defina, por pipeline y por etapa:

1. **Si la etapa avanza automáticamente** ante ciertos eventos.
2. **Qué evento dispara el avance**: respuesta de WhatsApp, llamada efectiva, email respondido, pago registrado, tarea completada con cierto resultado, etc.
3. **A qué etapa avanza** cuando ocurre el evento.
4. **Si la etapa es manual** (solo el vendedor/admin la mueve).
5. **Plantillas iniciales sugeridas** al crear un pipeline (Ventas, Renovaciones, Mantenimiento, Refacciones).

### Ejemplos de reglas que se podrían configurar

- Si un contacto **responde un mensaje de WhatsApp** y el deal está en "Nuevo", pasa a "Contactado".
- Si se registra un **pago total** en un deal, pasa a "Pagado" / "Cerrado Ganado".
- Si se completa una **visita de mantenimiento** con resultado "Exitoso", avanza a "Servicio completado".
- Las etapas "Cerrado Ganado" y "Cerrado Perdido" pueden ser manuales o automáticas según configuración.

### Alcance del plan

1. **Base de datos**: nueva tabla `pipeline_stage_rules` para guardar las reglas de avance automático por etapa.
2. **Triggers / Edge function**: detectar eventos (mensaje entrante, pago, actividad con resultado) y mover el deal si hay una regla activa.
3. **Configuración UI**: en `Settings → Pipeline`, permitir marcar etapas como automáticas y definir su trigger y etapa destino.
4. **Plantillas**: al crear un pipeline, ofrecer plantillas con etapas y reglas predefinidas para Refrigeración G&R.
5. **Historial**: los cambios automáticos se registran en `deal_stage_history` indicando que fueron por regla (no por usuario).
6. **Permisos**: los cambios automáticos respetan RLS; el sistema usa service_role o security definer para mover deals cuando el evento es del sistema.

### Diagrama de flujo

```text
Evento del sistema (mensaje, pago, actividad)
        |
        v
Buscar deal(s) activo(s) del contacto
        |
        v
¿Hay regla para la etapa actual + tipo de evento?
        |
   Si   v
Mover deal a etapa destino
        |
        v
Registrar en deal_stage_history (automático)
        |
        v
Notificar / actualizar UI
```

### Tablas a crear

- `pipeline_stage_rules`
  - `id`, `tenant_id`, `pipeline_id`, `from_stage_id`
  - `trigger_event` (enum: `whatsapp_reply`, `payment_received`, `activity_completed`, `call_completed`, `email_replied`, `task_completed`)
  - `trigger_filters` (JSONB, ej. `{ activity_type: "call", outcome: "effective" }`)
  - `to_stage_id`
  - `is_active`
  - `created_at`, `updated_at`

### Componentes UI a modificar

- `src/components/settings/pipeline/PipelineTab.tsx`: agregar modo "reglas de automatización" por etapa.
- `src/components/pipeline/KanbanBoard.tsx` / `DealDrawer.tsx`: mostrar icono/badge cuando una etapa tiene reglas automáticas.
- `src/components/contacts/detail/DealsSidePanel.tsx`: mostrar indicador de "etapa automática" y próximo paso sugerido.

### Entregables

1. Migración de base de datos con tabla, grants, RLS y políticas.
2. Trigger o edge function para aplicar reglas ante eventos.
3. Actualización del panel de configuración de pipelines.
4. Plantillas iniciales sugeridas para pipelines comunes.
5. Tests de reglas automáticas y verificación de historial.

---

## 3. Próximo paso sugerido

Si apruebas este plan, comenzaré con la migración de `pipeline_stage_rules` y la configuración UI en `Settings → Pipeline`. Si prefieres solo la explicación actual sin implementar la automatización, rechaza el plan y lo dejamos documentado para más adelante.