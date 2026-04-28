## Refactor UX del módulo de Contactos

Aplicamos los cambios validados en el wireframe (opción "Detalle de contacto"), con el ajuste de layout solicitado: **3 columnas con central protagonista**.

---

### 1. Detalle de contacto (`/contacts/:id`)

**Layout nuevo (desktop ≥1024px):**

```text
┌──────────────────────────────────────────────────────────────┐
│ Header compacto: avatar + nombre + status + WhatsApp + ⋯    │
├──────────────────────────────────────────────────────────────┤
│ Tags strip (chips de colores por familia)                    │
├──────────────────────────────────────────────────────────────┤
│ Stats bar: Pipeline · Probabilidad · Última conv · Cliente   │
├──────────┬──────────────────────────────────────┬────────────┤
│ INFO     │ MAIN (tabs)                          │ DEALS      │
│ 256px    │ flex-1  ← protagonista               │ 256px      │
│          │                                      │            │
│ Contacto │ [Resumen][Conversaciones][Deals]     │ Deals      │
│ Empresa  │ [Actividad][Notas]                   │ activos    │
│ CRM      │                                      │            │
│          │ Contenido del tab seleccionado       │ + tareas   │
└──────────┴──────────────────────────────────────┴────────────┘
                                              FAB IA flotante ✨
```

- **Panel izquierdo (256px)** — `InfoSidePanel.tsx`: 3 secciones colapsables (Contacto / Empresa / CRM), edición inline.
- **Panel central (flex-1, protagonista)** — Tabs con `Resumen` por defecto, que muestra: sugerencia IA destacada arriba + últimos eventos (timeline corto). Aquí vive todo el contenido principal.
- **Panel derecho (256px, mismo ancho que el izquierdo)** — `DealsSidePanel.tsx`: lista compacta de deals activos con barra de progreso + bloque "Próximas tareas" debajo.
- **Tablet (768–1023px)**: panel derecho colapsa debajo del central. Izquierdo se mantiene.
- **Mobile (<768px)**: ambos paneles se vuelven sheets accesibles con botones "Info" y "Deals" sobre los tabs.
- **AI Panel** → FAB flotante (`AiFloatingPanel.tsx`) que expande a card 360px abajo-derecha.

**Tags por familia (color-coded):**
- 🔥 Temperatura: rojo (caliente), ámbar (tibio), azul (frío)
- ⏱ Ciclo: verde (cliente), índigo (prospecto), gris (perdido)
- ⭐ Especiales: ámbar (vip), morado (referido)

---

### 2. Lista de contactos (`/contacts`) — referencia rápida

Aunque tu selección fue el detalle, mantenemos los cambios ya planeados para la lista (toolbar unificada + chips de filtros activos + tabla compacta de 6 columnas). Si quieres que también te muestre wireframe para validar, lo hago antes de tocar la lista.

---

### Detalles técnicos

**Archivos nuevos:**
- `src/components/contacts/detail/ContactHeader.tsx` — header compacto + tags strip
- `src/components/contacts/detail/ContactStatsBar.tsx`
- `src/components/contacts/detail/InfoSidePanel.tsx` — 256px, secciones colapsables (Collapsible de shadcn)
- `src/components/contacts/detail/DealsSidePanel.tsx` — 256px, deals + tareas
- `src/components/contacts/detail/SummaryTab.tsx` — tab default
- `src/components/contacts/detail/AiFloatingPanel.tsx` — FAB + Popover/Card
- `src/components/contacts/detail/tabs/{ConversationsTab,DealsTab,ActivityTab,NotesTab}.tsx`

**Archivos modificados:**
- `src/pages/app/ContactDetail.tsx` — orquesta el nuevo layout grid `[256px_1fr_256px]`
- `src/mock/contacts.ts` — añade `tagFamily` (temperature/cycle/special) y helpers de stats por contacto

**Stack reutilizado:** Tailwind grid responsive, `Collapsible`, `Sheet` (mobile), `Popover` (FAB IA), `Tabs`, mock data existente. Sin nuevas dependencias.

**Sin cambios en backend** — todo es frontend sobre los mocks actuales.

---

### Pregunta antes de implementar

¿Avanzo solo con el **detalle de contacto** (lo que validaste con wireframe) o incluyo también el refactor de la **lista** en el mismo paso?