# Pipeline: lente y periodo por defecto

## Recomendación

Las tres opciones resuelven preguntas distintas, por eso conviene tener las tres disponibles pero con propósitos claros:

- **Todo lo activo** (lente "Activas" + periodo "Todo") → **Vista de trabajo del asesor.** El asesor debe ver siempre toda oportunidad abierta, sin importar en qué mes entró o cuándo se espera cerrar. Hoy un lead que entró el 29 de septiembre desaparece del Pipeline el 1 de octubre con "Este mes" — eso es el problema real que viste.
- **Este mes / Mes anterior / 90 días / Año** → **Vista de gestión.** Sirven para medir (creadas, cerradas, pronóstico). Pertenecen a Desempeño, donde la fecha es el eje del análisis.
- **Todo el tiempo** (lente "Todas del periodo" + periodo "Todo") → **Vista de historial/auditoría.** Incluye ganadas y perdidas; no es vista de trabajo.

**Decisión propuesta:** por defecto, Kanban y Lista abren en **"Activas · Todo"** (todo lo activo). Desempeño mantiene **"Este mes"** como su vista natural. Cuando el usuario elige otro lente o periodo, se guarda y se respeta como hoy (preferencias por empresa).

## Cambios

1. **Nuevo periodo "Todo"** (`PERIOD_PRESETS` en `DealsPerformanceView.tsx`): opción "Todo" al final de la lista (Este mes, Mes anterior, 90 días, Todo el año, Todo, Personalizado).
2. **`parsePeriod` soporta "todo"**: límites amplios (sin inicio ni fin prácticos); etiqueta "Todo".
3. **Filtro de lente con "Todo"**: en `filterPeriodSet`, con periodo "todo" las activas siempre pasan (sin depender de fecha de cierre esperada ni de `created_at`).
4. **Default por vista** en `Pipeline.tsx`:
   - Kanban/Lista: `prefs.perfMonth ?? "todo"`.
   - Desempeño: `prefs.perfMonth ?? currentMonthKey()` (se mantiene).
   - Ambos comparten la misma preferencia una vez que el usuario elige.
5. **Contadores con "Todo"**: el chip "Cierran en el periodo" se renombra a "Cierran este mes" y se calcula con los límites del mes actual (independiente del periodo) cuando el periodo es "Todo". "Vencidas", "Estancadas +14d", "En riesgo" funcionan igual.
6. **Encabezado del Pipeline**: "Cierre este mes" se calcula con los límites del mes actual aunque el periodo sea "Todo", para que la cifra siga teniendo sentido.
7. **Textos**: pie de página y mensaje vacío con variante para "Todo" (p. ej. "Todas las oportunidades abiertas de la empresa").

## Detalles técnicos

- Archivos: `src/components/pipeline/DealsPerformanceView.tsx` (presets, `parsePeriod`, `filterPeriodSet`), `src/pages/app/Pipeline.tsx` (default por vista, encabezado, caption), `src/components/pipeline/DealChips.tsx` (chip de cierre), `src/components/pipeline/PeriodFiltersBar.tsx` (preset en el select).
- `usePipelinePrefs` no cambia: `perfMonth: null` ya significa "sin elegir"; el default se resuelve al leerlo.
- No se migra ninguna preferencia guardada: quien ya eligió "Este mes" lo sigue viendo; el nuevo default aplica solo a quien no ha tocado el periodo (incluye todas las empresas nuevas).
- Sin cambios de base de datos ni de permisos.

## Qué no cambia

- Los reportes (Recorrido de leads, CSV, Desempeño) siguen siendo periodos cerrados; no se agregan rangos abiertos ahí.
- El asesor sigue pudiendo elegir cualquier lente/periodo; solo cambia el punto de partida.
