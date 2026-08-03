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

**4. Agrupadores rápidos**
Chips para filtrar la tabla: Todas · En riesgo · Estancadas (+14 días) · Vencidas · Cierran este mes.

**5. Exportar CSV**
Mismo patrón que la vista Lista, incluyendo las columnas de salud.

Al hacer clic en una fila se abre el `DealDrawer` existente, igual que hoy.

## Sobre el periodo seleccionado

La vista Desempeño se enfoca en **oportunidades activas hoy**, con métricas de salud actuales. Para analizar el pipeline de un periodo histórico o futuro (por ejemplo "¿cuánto pipeline teníamos el 15 de julio?"), se usa la página **Reportes** (`/reportes`), que ya permite filtrar por periodo y vendedor y muestra funnel, cierres, actividad y desempeño por vendedor.

Si el usuario quiere ver oportunidades cuya **fecha estimada de cierre cae dentro del mes/periodo seleccionado**, la vista Desempeño incluirá un filtro rápido "Cierran este mes" y se podrá extender con un selector de rango de fechas de cierre en una siguiente iteración.

## Detalles técnicos

- Nuevo componente `src/components/pipeline/DealsPerformanceView.tsx`.
- `src/pages/app/Pipeline.tsx`: se amplía el estado `view` a `"kanban" | "list" | "performance"` y se pasa el mismo arreglo `filtered` ya calculado.
- `PipelineHeader.tsx`: tercer botón en el selector de vista.
- Salud por deal con `computeDealHealth` de `src/lib/dealHealth.ts` (ya usa la última actividad del contacto, que Pipeline ya carga en `contactLastActivityAt`).
- Stepper de etapa con el componente `StageStepper` y las `stages` del pipeline activo.
- Sin cambios en base de datos ni consultas nuevas: todo se calcula sobre los datos que Pipeline ya trae.
