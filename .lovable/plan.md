# Rediseño atractivo de Login y Signup

Actualmente Login y Signup viven en una sola tarjeta y solo cambia el texto del botón. Voy a rediseñarlo como una pantalla "split" moderna, con un cambio visual claro entre **Iniciar sesión** y **Crear cuenta**.

## Qué se va a cambiar

Solo se modifica `src/pages/Login.tsx`. La lógica de auth, validaciones y traducción de errores se mantiene tal cual (ya funciona y está validada).

## Diseño propuesto

Layout de dos columnas en desktop (≥ md), una sola columna en móvil.

```text
┌──────────────────────────┬───────────────────────────┐
│  Panel izquierdo (brand) │  Panel derecho (form)     │
│  bg-gradient-hero        │  bg-card                  │
│  - Logo Walix.ai         │  Tabs: [Iniciar][Crear]   │
│  - Headline dinámico     │  Título dinámico          │
│  - 3 bullets de valor    │  Email + Password         │
│  - Quote / social proof  │  Checklist (solo signup)  │
│  - Hecho en México 🇲🇽   │  CTA + link cambio modo  │
└──────────────────────────┴───────────────────────────┘
```

### Diferenciación visual entre modos

| Elemento | Login | Signup |
|---|---|---|
| Tabs activas | Pestaña "Iniciar sesión" resaltada con `bg-gradient-brand` | Pestaña "Crear cuenta" resaltada con `bg-gradient-brand` |
| Headline panel izq. | "Bienvenido de vuelta" | "Empieza gratis en 2 minutos" |
| Subcopy panel izq. | "Continúa donde lo dejaste con tu CRM." | "Crea tu cuenta y configura tu CRM con IA." |
| Bullets panel izq. | "Tus conversaciones siguen vivas", "Tus pipelines te esperan", "IA lista para ayudarte" | "WhatsApp + CRM en un solo lugar", "IA que prioriza y responde", "Sin tarjeta, prueba 14 días" |
| Badge superior derecho | "Iniciar sesión" en `secondary` | "Crear cuenta · Gratis" en `accent` |
| CTA | "Entrar" + ícono `LogIn` | "Crear cuenta" + ícono `Sparkles` |
| Color/acento del CTA | Mantiene `bg-gradient-brand` con `shadow-glow` | Mantiene `bg-gradient-brand` con `shadow-glow` + micro-animación pulse en el ícono |
| Texto bajo el CTA | "¿Primera vez? Empieza gratis →" | "¿Ya tienes cuenta? Inicia sesión →" |
| Checklist password | Oculto | Visible con animación `animate-fade-in` |

### Componente Tabs (interno)

Un toggle pill nativo con dos botones, accesible (role="tablist"), que actualiza `mode` y resetea `emailError`/`showPasswordHints` al cambiar:

```text
┌───────────────────────────────────┐
│ ┌───────────┐ ┌─────────────────┐ │
│ │ Iniciar   │ │  Crear cuenta   │ │  <- el activo va con bg-gradient-brand
│ └───────────┘ └─────────────────┘ │     y texto blanco; el inactivo, ghost.
└───────────────────────────────────┘
```

### Detalles visuales

- Panel izquierdo solo visible en `md:` y superior (`hidden md:flex`). En móvil aparece un mini-header con Logo + headline corto.
- Fondo del panel izquierdo: `bg-gradient-hero` con dos blobs blur (`bg-accent/30` y `bg-primary-glow/40`) para mantener la estética actual.
- Panel derecho: `bg-card` con padding generoso, `rounded-r-2xl` (rounded full en móvil).
- Transiciones: al cambiar de tab, el contenido del formulario usa `animate-fade-in` (utility ya existente en `index.css` o equivalente Tailwind).
- Tipografía: títulos `text-2xl md:text-3xl font-bold tracking-tight`.
- Microcopy de seguridad bajo el CTA en signup: "Al crear tu cuenta aceptas los Términos y Privacidad".

## Lógica que NO se toca

- `validateEmail`, `evaluatePassword`, `translateAuthError`, `waitForAuthContext`.
- Llamadas a `supabase.auth.signUp` / `signInWithPassword`.
- Redirects a `/onboarding` y `/dashboard`.
- Lectura de `?mode=signup` desde la URL.

## Detalles técnicos

- Iconos nuevos importados de `lucide-react`: `LogIn`, `Sparkles`, `MessageCircle`, `Bot`, `Zap` (para los bullets).
- Sin dependencias nuevas.
- Sin cambios en `index.css` ni en el design system; se usan tokens existentes (`gradient-hero`, `gradient-brand`, `shadow-glow`, `accent`, `primary-glow`).
- Sin cambios en rutas, store ni hooks.

## Resultado esperado

- Pantalla más atractiva y profesional, alineada al branding Walix.
- Usuario sabe en todo momento si está creando cuenta o iniciando sesión (tabs + badge + headline + bullets + CTA cambian).
- 100% responsive: split en desktop, stack limpio en móvil.