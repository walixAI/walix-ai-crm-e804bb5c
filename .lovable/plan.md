## Marketplace de Módulos — /marketplace

### Decisiones tomadas (aplicando sugerencias)

- **Persistencia real**: tabla `tenant_modules` con RLS para activar/desactivar.
- **Lucide icons** en lugar de emojis, manteniendo paleta por categoría.
- **Tabs** = estado · **Chips** = categoría (filtros independientes).
- **Sin "Fase 1"** en cards (ruido); se omite del UI.
- **Plan gating** real: botón disabled + CTA "Upgrade" a `/pricing` si plan insuficiente.
- **Sin cobro real**: activación es flag; banner indica "Facturación se habilitará próximamente".

---

### 1. Base de datos (migración)

Tabla `tenant_modules`:
- `module_id` (text, ej: `mod-01`)
- `tenant_id`, `activated_by`, `activated_at`
- `monthly_price_mxn` (numeric, snapshot al activar)
- `pricing_model` (text: `per_instance` | `per_execution` | `per_minute` | `per_volume` | `per_domain` | `per_vertical` | `per_automation`)
- `status` (text: `active` | `paused`)
- Unique `(tenant_id, module_id)`
- RLS: tenant lee/escribe los suyos; platform ve todo.

### 2. Catálogo estático

`src/lib/marketplace/catalog.ts` con los 8 módulos + 2 "próximamente" (Pagos, Envíos):

```text
id | name | category | icon (Lucide) | bg | priceLabel | minPlan | model | status
```

Categorías: Movilidad · IA Avanzada · Integraciones · Analytics · Voz · Industria · API.

Precios sugeridos arriba (App $199, Agentes $0.50/exec, Voz $1.20/min, Analytics $499, Google $99, Verticales $299, API $999, Zapier $0).

### 3. Páginas/componentes nuevos

```text
src/pages/app/Marketplace.tsx          ← reemplaza el Stub en App.tsx
src/lib/marketplace/catalog.ts         ← módulos + tipos + helpers
src/lib/queries/marketplace.ts         ← useActiveModules, useActivateModule, useDeactivateModule
src/components/marketplace/
  ├─ MarketplaceHeader.tsx            ← título + tabs estado
  ├─ CategoryChips.tsx                ← filtro categoría
  ├─ ModuleCard.tsx                   ← card 64px icon, badge estado, precio, plan req, CTA
  ├─ ModuleActivationDialog.tsx       ← modal de activación
  └─ ActiveModulesList.tsx            ← tab Activos con total mensual
```

### 4. Lógica clave

- **Estado por módulo**: cruza catálogo con `tenant_modules` → `active` | `available` | `coming_soon` | `plan_locked`.
- **Plan gating**: lee `tenants.plan` (vía `useTenant`); si `minPlan > currentPlan` → estado visual "Requiere PyME/Growth/Enterprise" + botón "Upgrade" → `/pricing`.
- **Activación**: insert en `tenant_modules` + toast + invalidate queries + audit_log.
- **Desactivar/Gestionar**: modal con info + botón "Desactivar módulo" (delete row).
- **Total mensual**: suma `monthly_price_mxn` de módulos `per_instance`/`per_domain`/`per_vertical` (precios fijos); los `per_use`/`per_execution` muestran "Variable según uso".

### 5. Filtros y layout

- Tabs (top): `Todos` · `Activos` · `Disponibles` · `Próximamente`.
- Chips (debajo): `Todas` + 7 categorías. Multi-select desactivado, single chip activo.
- Grid: `grid-cols-1 lg:grid-cols-2` (2 cols desktop ≥1024px).
- Empty state cuando un filtro no devuelve módulos.

### 6. Modal de activación

- Header: ícono coloreado + nombre + categoría.
- Sección "Incluye": 4-6 bullets por módulo (los pongo en el catálogo).
- Sección "Requisitos": plan mínimo (badge), notas técnicas si aplica.
- Footer: precio destacado + botón `Activar módulo — $X MXN/mes` + nota gris "El cobro se activará cuando conectemos facturación. Por ahora la activación es sin costo durante beta."
- Botón "Cancelar" secundario.

### 7. Routing

`App.tsx`: reemplazar `<Stub icon={Store} ...>` por `<Marketplace />` en la ruta `/marketplace`.

---

### Notas técnicas

- Sin nuevas dependencias.
- Iconos: `Smartphone, Bot, Mic, BarChart3, Link2, Building2, Code2, Zap, CreditCard, Truck` de lucide-react.
- Colores de fondo por categoría usando tokens semánticos extendidos (ej: `bg-success/10`, `bg-info/10`, `bg-primary/10`, etc.) para respetar dark mode.
- `useActiveModules` con React Query keyed por tenant_id.
- Audit log en cada activación/desactivación.

### Lo que NO se hace en esta iteración

- Cobro real (Stripe) — requiere flujo separado.
- Configuración interna de cada módulo (cada uno tendrá su propia pantalla "Gestionar" después).
- Realtime sync entre tabs.
