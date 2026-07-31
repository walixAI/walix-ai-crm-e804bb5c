## Objetivo
En el Inbox de WhatsApp, hacer que los deals vinculados y el contacto sean clicables y lleven al perfil del contacto.

## Cambios

### 1. `src/components/whatsapp/ContactSidePanel.tsx` — Deals vinculados clicables
- Convertir cada tarjeta de deal en un `Link` a `/contacts/{conv.contactId}?dealId={d.id}` (mismo patrón ya usado desde el Dashboard, para que el detalle del contacto abra fijado el contexto de ese deal).
- Añadir estilos de afordancia: `hover:border-primary/40 hover:bg-muted/40`, cursor pointer y un ícono chevron discreto a la derecha.

### 2. `src/components/whatsapp/ContactSidePanel.tsx` — Clic directo al contacto
- Hacer clicable el bloque de avatar + nombre + empresa de la tarjeta "Contacto" (link a `/contacts/{conv.contactId}`), con hover en el nombre.
- Se conserva el botón "Ver perfil completo" como acción explícita.

### 3. `src/components/whatsapp/ConversationList.tsx` — Acceso rápido al contacto
- En cada fila de la lista, el clic principal sigue abriendo la conversación (comportamiento actual, no se toca).
- Añadir un pequeño botón/ícono de "usuario" que aparece al hacer hover en la fila y navega a `/contacts/{c.contactId}`, con `stopPropagation` para no cambiar de conversación.

Nota: requiere que `ConversationItem` exponga `contactId` en la lista; ya lo expone (se usa en `ChatHeader`).

### 4. `src/components/whatsapp/ChatHeader.tsx`
- Ya tiene el link al contacto en el avatar/nombre; solo se refuerza la afordancia visual (subrayado en hover) para que se note que es clicable.

## Detalles técnicos
- Solo cambios de presentación/navegación con `react-router-dom` (`Link` / `useNavigate`). Sin cambios de datos, queries ni backend.
