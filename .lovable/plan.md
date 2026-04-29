
# Polish final Walix.ai — Análisis y plan

## Sugerencias de mejora al prompt original

Antes de ejecutar, te marco lo que conviene **ajustar, omitir o reordenar** según el estado real del código:

### Lo que ya está hecho (no tocar / reusar)
- **BottomNav móvil** ya existe (`src/components/layout/BottomNav.tsx`) con 5 tabs. Solo cambiar "Reportes" → "Más" con menú adicional.
- **EmptyState** ya existe (`src/components/walix/EmptyState.tsx`). No hace falta crear desde cero — solo usarlo donde falte e incrementar la ilustración.
- **Skeletons** completos (`Skeletons.tsx`: KPI, Kanban, Table, Conversation, Message, etc.). Ya cubre el punto 3.
- **Toast system** ya con sonner + shadcn toaster montados en `App.tsx`. Solo estandarizar uso.
- **Animaciones base** (`fade-in`, `scale-in`, `slide-in-right`, `pulse-glow`) ya en `tailwind.config.ts`.
- **Meta tags OG / Twitter / favicon** ya configurados en `index.html`.

### Lo que conviene **omitir o reescribir**
- **Framer Motion**: añade ~50KB y duplica lo que ya hacen las clases Tailwind (`animate-fade-in`, `animate-scale-in`, stagger con `style={{ animationDelay }}`). **Recomendado: NO instalar**, usar las utilidades existentes.
- **react-virtual**: el dataset actual es mock con <100 contactos. Posponer hasta tener datos reales (>500 filas). **Omitir del MVP**.
- **react-hot-toast**: ya hay `sonner` + `toaster`. No agregar una tercera librería.
- **Next/Image**: el proyecto es Vite, no Next. Usar `loading="lazy"` nativo en `<img>`.
- **PWA / manifest.json**: según las reglas del entorno, los service workers rompen el preview en iframe. **Posponer** o limitar a manifest mínimo sin SW (solo "Add to Home Screen").
- **Vercel/Netlify rewrites**: el deploy es en Lovable, que ya hace SPA fallback automático. **No aplica**.
- **Variables de entorno**: `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` ya están en `.env` autogenerado. **No tocar**.
- **Dominio app.walix.ai**: configuración manual del usuario en Project Settings → Domains. No es código.

### Lo que SÍ falta y aporta valor real
1. Mobile responsive en Pipeline Kanban, WhatsApp 3-paneles y tablas
2. Empty states aplicados en cada vista vacía (no existe el patrón unificado)
3. Confirm dialog antes de eliminar (hoy se elimina directo en varias vistas)
4. ErrorBoundary global
5. Lazy-load de rutas pesadas (Reports, Pipeline, Marketplace)
6. `React.memo` en `DealCard`, `KpiCard`, filas de contactos
7. `aria-label` en botones-icono (sidebar collapsed, bell, AI drawer toggle)

---

## Plan de ejecución (priorizado)

### Fase 1 — Mobile responsive (alto impacto)
- **Pipeline mobile**: scroll horizontal con `snap-x snap-mandatory`, columnas `w-[85vw]` en `<md`, indicador de columna activa.
- **WhatsApp mobile**: tabs `Lista | Chat | Perfil` controladas por estado; en `≥md` mantener 3 paneles.
- **BottomNav**: cambiar "Reportes" por **"Más"** (icon `MoreHorizontal`) que abre Sheet con: Reportes, AI Inbox, Automatizaciones, Marketplace, Configuración.
- **Modales en mobile**: usar `Sheet side="bottom"` para `NewDealDialog`, `ContactFormDialog`, `QuickTaskDialog` cuando `useIsMobile()`.
- **Tablas (Reports, Settings/Team)**: wrap con `overflow-x-auto` + min-width.

### Fase 2 — Feedback y empty states
- Aplicar `EmptyState` en: Contactos, Pipeline, WhatsApp (sin conversaciones), Reportes, Automations.
- Mejorar componente `EmptyState` con prop `illustration?: ReactNode` para SVGs ligeros (sin librerías).
- Crear `<ConfirmDialog>` reusable (basado en `AlertDialog`) y aplicar en: eliminar contacto, eliminar deal, deactivate module, eliminar automation.
- Estandarizar toasts con helpers: `toastSuccess`, `toastError`, `toastWarning` en `src/lib/toast.ts`.

### Fase 3 — Robustez
- `ErrorBoundary` componente en `src/components/walix/ErrorBoundary.tsx` envolviendo `<Outlet />` en `AppLayout` y rutas top-level.
- Pantalla de error: ícono + "Algo salió mal" + botón "Recargar" + "Volver al dashboard".

### Fase 4 — Performance
- `React.lazy()` en `App.tsx` para: Reports, Pipeline, Marketplace, SuperAdmin, Platform, Automations. Wrap con `<Suspense>` y skeleton.
- `React.memo` en: `DealCard`, `KpiCard`, fila de contactos en `Contacts.tsx`.

### Fase 5 — Accesibilidad mínima
- `aria-label` en todos los icon-buttons (sidebar collapsed, NotificationsBell, AI drawer trigger, close buttons).
- `role="status" aria-live="polite"` en badges de notificación.
- Verificar focus trap en Dialog (Radix lo trae) — solo confirmar.

### Fase 6 — Pre-deploy housekeeping
- Verificar que el favicon `public/favicon.ico` existe; si no, mantener el actual.
- Confirmar `lang="es-MX"` y meta description (✅ ya está).
- **NO** añadir PWA/SW (rompe preview).

---

## Detalles técnicos

**Archivos a crear:**
- `src/components/walix/ErrorBoundary.tsx`
- `src/components/walix/ConfirmDialog.tsx`
- `src/lib/toast.ts` (helpers)
- `src/components/pipeline/MobileKanban.tsx` (wrapper con snap)
- `src/components/whatsapp/MobileTabs.tsx` (tabs Lista/Chat/Perfil)
- `src/components/walix/empty/` SVGs inline (contacts, pipeline, whatsapp, reports, automations)

**Archivos a editar:**
- `src/App.tsx` — lazy + Suspense + ErrorBoundary
- `src/components/layout/BottomNav.tsx` — "Más" con Sheet
- `src/pages/app/Pipeline.tsx`, `Whatsapp.tsx`, `Contacts.tsx`, `Reports.tsx`, `Automations.tsx`
- `src/components/walix/EmptyState.tsx` — prop `illustration`
- `src/components/pipeline/DealCard.tsx`, `walix/KpiCard.tsx` — React.memo
- Componentes con icon-buttons sin `aria-label`

**Sin nuevas dependencias.** Todo se hace con lo ya instalado (Tailwind anim, Radix, sonner, lucide).

---

## Lo que NO se incluirá (y por qué)

| Item del prompt | Razón |
|---|---|
| Framer Motion | Tailwind animations cubren el 100% pedido sin payload extra |
| react-virtual | Dataset mock pequeño; agregar cuando haya >500 filas reales |
| react-hot-toast | sonner ya está integrado |
| Next/Image | Stack es Vite; usar `loading="lazy"` |
| PWA + service worker | Rompe el preview en iframe (regla del entorno); además requiere config delicada |
| Vercel/Netlify rewrites | Deploy en Lovable maneja SPA fallback nativo |
| Configurar `.env` y dominio | Acciones manuales del usuario en UI de Lovable |

¿Apruebas para ejecutar las 6 fases?
