# Mejoras UX/CRUD — Sección Contactos

## Objetivos
1. Convertir el listado en una pantalla **operativa** (acciones masivas funcionales, vista Kanban por status).
2. Convertir el detalle en la **pantalla diaria del vendedor**: centro = acciones + IA, laterales compactos con info editable, oportunidades y métricas claras.
3. Que **toda acción visible funcione** (editar, reasignar, etiquetar, eliminar, cambiar status, editar empresa, agregar etiqueta).

---

## A. Listado de Contactos (`/contacts`)

### A1. Barra de acciones masivas re-ubicada y funcional
- Mover la barra flotante (`bottom-20 fixed`) a un **bloque inline entre la barra de búsqueda y la tabla**, visible solo cuando `selected.size > 0`. Animación slide-down.
- Acciones funcionales con confirmación:
  - **Reasignar**: popover con `useTenantUsers`, `update contacts.owner_id` (bulk).
  - **Etiquetar**: popover con `useContactTags` + crear nueva, append a `contacts.tags`.
  - **Cambiar status**: popover con los 6 status, update bulk.
  - **Exportar**: CSV de los seleccionados.
  - **Eliminar**: `ConfirmDialog` + delete bulk.
  - **WA masivo**: dialog con plantilla (`message_templates`) + envío por `whatsapp-send`.
- Mantener "X seleccionados" + "Limpiar selección".

### A2. Vista Kanban por status
- Añadir tercer botón al toggle de vista (`list | kanban | cards`). Renombrar el actual "canvas" → "cards".
- Componente `ContactsKanban`: 6 columnas (`Nuevo`, `Contactado`, `Calificado`, `En negociación`, `Cliente`, `Inactivo`).
- Tarjetas compactas: avatar, nombre, empresa, teléfono (WA), vendedor, última actividad relativa, etiquetas.
- **Drag & drop** (reusar `@dnd-kit` ya presente en pipeline) para mover contacto entre columnas → `update contacts.status` con optimistic update + toast.
- Filtros existentes (búsqueda, etiquetas, vendedor, fuente, fecha) aplican igual.

### A3. Acciones por fila funcionales
- Dropdown "..." de cada fila: **Ver detalle** (link), **Reasignar** (mismo popover), **Etiquetar**, **Cambiar status**, **Eliminar** (confirm).

---

## B. Detalle del Contacto (`/contacts/:id`)

### B1. Header — aprovechar el centro vacío
Reorganizar `ContactHeader` en 3 zonas:
- **Izq**: avatar grande + nombre + status badge + cargo/empresa + etiquetas (debajo del nombre).
- **Centro**: mini-KPIs inline (los actuales `ContactStatsBar` se fusionan aquí): Pipeline · Probabilidad · Última conv. · Cliente desde. Quitar el `ContactStatsBar` separado.
- **Der**: botones de acción primarios: **WhatsApp** (verde), **Llamar**, **Editar**, "..." (Reasignar / Cambiar status / Agregar a campaña / Eliminar).

### B2. Acciones del header funcionales
- **Editar** → abre `ContactFormDialog` ya existente en modo edición.
- **Reasignar vendedor** → popover con `useTenantUsers` + update `owner_id`.
- **Cambiar status** → popover con los 6 status + update.
- **Agregar a campaña** → dialog stub (placeholder claro "Próximamente" si no existe módulo).
- **Eliminar contacto** → `ConfirmDialog` + delete + redirect a `/contacts`.

### B3. Panel lateral izquierdo — rediseñado
Reemplazar las 3 secciones actuales (Contacto / Empresa / CRM) por **2 tarjetas editables** con edición inline (click en valor → input → blur/Enter guarda):

**Tarjeta 1: "Información del contacto"** (renombra "CRM")
- Email, Teléfono(s) (clic = WhatsApp), Fuente de prospección, Asignado a (con avatar).
- Cada campo editable inline con icono lápiz on hover.

**Tarjeta 2: "Empresa"**
- Empresa, Cargo. Editable inline. Botón "Editar" header de la tarjeta abre `ContactFormDialog` con foco en sección empresa.

Eliminar la duplicación de "nombre del prospecto" del side panel — el nombre ya está en el header. (El requerimiento de "concentrar info relevante" se cumple en el header con KPIs).

### B4. Etiquetas funcionales
- En `ContactHeader`, el chip "+ etiqueta" abre **popover con `useContactTags`** (lista + buscador + "Crear nueva"). Toggle en `contacts.tags` array, optimistic.
- Cada etiqueta existente: hover muestra "x" para quitar.

### B5. Panel lateral derecho
- Renombrar `DealsSidePanel` título → **"Oportunidades"** (en vez de "Deals activos").
- Botón "+" del header abre `NewDealDialog` pre-llenado con `contact_id`.
- Cada tarjeta clickable → `DealDrawer`.
- "Próximas tareas" mostrar tareas reales del contacto (`useContactTasks`), no hardcoded. "+" abre `QuickTaskDialog`.

### B6. Centro = pantalla operativa del vendedor
La tab "Resumen" se convierte en **vista por defecto operativa** y se enriquece:

```text
┌─────────────────────────────────────────┐
│ [IA] Próximo paso sugerido + CTA único  │  ← ya existe, mantener arriba
├─────────────────────────────────────────┤
│ Quick actions (1 click cada una):       │
│ [WA] [Llamar] [Nota] [Tarea] [Reunión] │  ← nuevo
│      [Mover etapa] [Ganada] [Perdida]   │
├─────────────────────────────────────────┤
│ Alertas detectadas (badges)             │  ← nuevo (sin respuesta 3d, etc.)
├─────────────────────────────────────────┤
│ Composer compacto (nota / WA rápido)    │  ← reusar ActivityComposer
├─────────────────────────────────────────┤
│ Últimos eventos timeline (5)            │  ← ya existe
└─────────────────────────────────────────┘
```

- **Quick actions**: barra horizontal de botones que disparan dialogs ya existentes (`QuickTaskDialog`, composer de nota, abrir WA, etc.) sin cambiar de tab.
- **Alertas**: derivadas de `useContactSuggestions` con `kind=alert` o de reglas locales (sin respuesta >3d, deal sin actividad >7d, tarea vencida).
- Mover composer de actividad de la tab "Actividad" a Resumen también (mantener en ambas).

---

## C. Cambios técnicos

### Archivos a crear
- `src/components/contacts/ContactsKanban.tsx`
- `src/components/contacts/BulkActionsInline.tsx`
- `src/components/contacts/detail/ContactInfoCard.tsx` (editable inline, reemplaza `InfoSidePanel`)
- `src/components/contacts/detail/CompanyCard.tsx`
- `src/components/contacts/detail/QuickActionsBar.tsx`
- `src/components/contacts/detail/AlertsStrip.tsx`
- `src/components/contacts/detail/TagsPopover.tsx`
- `src/components/contacts/detail/ChangeStatusPopover.tsx`
- `src/components/contacts/detail/ReassignPopover.tsx`

### Archivos a modificar
- `src/pages/app/Contacts.tsx` — toggle 3 vistas, mover bulk bar inline, dropdown por fila funcional.
- `src/pages/app/ContactDetail.tsx` — quitar `ContactStatsBar` separado, swap side panels.
- `src/components/contacts/detail/ContactHeader.tsx` — KPIs inline + acciones funcionales + popover etiquetas.
- `src/components/contacts/detail/DealsSidePanel.tsx` — rename a "Oportunidades", tareas reales, "+" funcional.
- `src/components/contacts/detail/SummaryTab.tsx` — agregar `QuickActionsBar` y `AlertsStrip` arriba.
- `src/lib/queries/contacts.ts` — añadir mutations: `useUpdateContact`, `useDeleteContact`, `useBulkUpdateContacts`, `useBulkDeleteContacts`, `useUpdateContactStatus` (drag kanban).

### Base de datos
No se requieren migraciones. Todo opera sobre columnas existentes de `contacts` (`status`, `owner_id`, `tags`, `email`, `phone`, `company`, `position`).

---

## D. Orden de implementación
1. Mutations CRUD (`useUpdateContact`, bulk, delete).
2. Bulk actions inline funcionales (A1, A3).
3. Vista Kanban con drag & drop (A2).
4. Header rediseñado + acciones funcionales + etiquetas popover (B1, B2, B4).
5. Side panels nuevos editables (B3) + rename Oportunidades (B5).
6. Quick actions + alertas en Resumen (B6).

Cada paso entrega valor independiente y deja la pantalla siempre funcional.
