# Vista de Desempeño de oportunidades activas

Hoy el Pipeline tiene dos vistas: Kanban y Lista. La lista muestra datos (monto, etapa, probabilidad, días, cierre) pero no dice *cómo va* cada oportunidad. Se agrega una tercera vista, **Desempeño**, con el estado de salud de todas las oportunidades activas en un solo lugar.

## Qué se agrega

**1. Nueva vista "Desempeño" en Pipeline**
Un tercer botón junto a Kanban / Lista. Reutiliza los mismos filtros (vendedor, pipeline, búsqueda) que ya existen.

**2. Franja resumen arriba**
- Oportunidades activas y monto total
- Ponderado por probabilidad (forecast)
- Cuántas están En riesgo, Estancadas y Vencidas
- Días promedio en etapa

**3. Tabla de desempeño**
Una fila por oportunidad activa, ordenable, con:
- Oportunidad / contacto / vendedor
- Monto y probabilidad
- Etapa + mini-stepper de avance (paso 3 de 6), reutilizando el `StageStepper` ya creado para la ficha de contacto
- Días en la etapa actual y días desde la última actividad del contacto
- Semáforo de salud usando la lógica ya existente (`computeDealHealth`): Hot, Cold, Stale, Overdue
- Fecha estimada de cierre, marcada en rojo si ya pasó

**4. Selector de periodo y dos lentes**

Arriba de la tabla, un selector de periodo (mes actual por defecto, con opción de otro mes o rango) y dos lentes que cambian qué oportunidades entran:

- **Activadas en el periodo**: oportunidades creadas dentro del mes/periodo seleccionado, sin importar cuándo cierren (este mes o en el futuro). Responde "¿qué generamos este mes?".
- **Activas en el periodo** (por defecto): todas las oportunidades abiertas que estuvieron vivas durante el periodo, sin importar si se crearon este mes o antes, y sin importar cuándo cierren. Responde "¿qué tenemos en juego?".

El resumen de arriba se recalcula según la lente y el periodo elegidos, con una línea de texto que indica exactamente qué se está midiendo.

**5. Agrupadores rápidos**
Chips sobre el conjunto ya filtrado: Todas · En riesgo · Estancadas (+14 días) · Vencidas · Cierran en el periodo.

**6. Exportar CSV**
Mismo patrón que la vista Lista, incluyendo columnas de salud, la lente y el periodo aplicados.

Al hacer clic en una fila se abre el `DealDrawer` existente, igual que hoy.

## Sobre el periodo

La vista Desempeño siempre trabaja sobre un periodo (mes actual por defecto); las métricas de salud se calculan al día de hoy. Para análisis histórico más profundo (funnel, cierres, actividad y desempeño por vendedor de un periodo pasado) sigue estando **Reportes** (`/reportes`).

## Detalles técnicos

- Nuevo componente `src/components/pipeline/DealsPerformanceView.tsx`.
- `src/pages/app/Pipeline.tsx`: se amplía el estado `view` a `"kanban" | "list" | "performance"` y se pasa el mismo arreglo `filtered` ya calculado.
- `PipelineHeader.tsx`: tercer botón en el selector de vista.
- Salud por deal con `computeDealHealth` de `src/lib/dealHealth.ts` (ya usa la última actividad del contacto, que Pipeline ya carga en `contactLastActivityAt`).
- Stepper de etapa con el componente `StageStepper` y las `stages` del pipeline activo.
- Lentes calculadas sobre el arreglo `filtered` que Pipeline ya tiene:
  - Activadas: `createdAt` dentro del rango del periodo.
  - Activas: deal abierto (no ganado ni perdido) con `createdAt <= fin del periodo`; los ganados/perdidos dentro del periodo se muestran aparte para no inflar el pipeline abierto.
- Periodo y lente en estado local, persistidos en `usePipelinePrefs` junto con `view`.
- Sin cambios en base de datos: `deals` ya expone `createdAt`, `updatedAt`, `expectedCloseDate`, `isWon` e `isLost`.
