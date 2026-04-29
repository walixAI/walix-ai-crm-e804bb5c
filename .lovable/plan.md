## Módulo de Reportes & Analytics — `/reports` (versión final aprobada)

Decisiones confirmadas:
- **Resumen ejecutivo IA**: reutiliza el edge function `dashboard-ai-widgets` (ya desplegado, mismo modelo/citas).
- **Export PDF**: con **jsPDF + jspdf-autotable** (control programático, portada, tablas, captura de gráficas vía html2canvas).

---

### Estructura del módulo

```text
/reports
├── Header sticky: Título · Período · Vendedores (multi) · Exportar PDF/CSV
├── Resumen ejecutivo IA (consume dashboard-ai-widgets, con citas clickeables)
├── KPI Hero Row (4 tarjetas con delta vs período anterior)
├── §1 Embudo de ventas (SVG custom, gradiente indigo, drill-down)
├── §2 Rendimiento por vendedor (tabla ordenable + bar chart + drawer)
├── §3 Fuentes de leads (PieChart + leyenda + insight IA con CTA)
├── §4 Deals perdidos (bar horizontal + insight IA con CTA)
├── §5 Heatmap actividad equipo (grid 7×N con totales en bordes)
├── §6 Conversiones por etapa (mini-funnel inverso + tabla)
└── Footer: "Última actualización · hace Xm" + botón Refrescar
```

### Mejoras UX incluidas (del plan anterior)

KPI hero row · comparativa MoM automática · drill-down universal (click → módulo filtrado) · insights IA con CTA real · multi-select de vendedores · sticky toolbar · empty states honestos · totales en bordes del heatmap · mini-funnel inverso para conversiones · responsive con scroll horizontal en tablas/heatmap.

### Archivos a crear

**Página y componentes**
- `src/pages/app/Reports.tsx`
- `src/components/reports/ReportsHeader.tsx` (sticky, filtros + export)
- `src/components/reports/PeriodPicker.tsx` (presets + custom range, persistencia localStorage)
- `src/components/reports/SellerMultiSelect.tsx` (chips multi-select)
- `src/components/reports/KpiHeroRow.tsx` (4 KPIs con delta MoM)
- `src/components/reports/ExecutiveSummaryAI.tsx` → **reutiliza `fetchDashboardAiWidgets()` de `src/services/ai.ts`** y renderiza solo el bloque `executiveSummary` con su `renderCitations` (extraer helper compartido). Loading/error como en `DashboardAiSection`.
- `src/components/reports/SalesFunnelChart.tsx` (SVG trapezoides + gradient indigo + tooltip)
- `src/components/reports/SellerPerformanceTable.tsx` (ordenable, badge 🏆 Top, drawer)
- `src/components/reports/SellerDetailDrawer.tsx`
- `src/components/reports/LeadSourcesPie.tsx` (recharts PieChart)
- `src/components/reports/LostDealsChart.tsx` (recharts BarChart horizontal)
- `src/components/reports/TeamActivityHeatmap.tsx`
- `src/components/reports/StageConversionsSection.tsx`
- `src/components/reports/InsightCard.tsx` (wrapper estándar para insights IA + CTA)

**Compartido (refactor mínimo)**
- `src/lib/ai/citations.tsx` — extraer `renderCitations` y `formatMXN` desde `DashboardAiSection.tsx` para reutilizar en Reports sin duplicar.

**Datos mock**
- `src/mock/reports.ts` — embudo 7 etapas (Lead → Contactado → Calificado → Demo → Propuesta → Negociación → Cierre), 4 vendedores (María López, Carlos Ruiz, Ana Torres, Diego Pérez — coinciden con `mock/dashboard.ts`), 5 fuentes de leads, 4 razones de pérdida, heatmap 7d × 4 sellers, conversiones, deltas MoM.

**Utilidades**
- `src/lib/reports/format.ts` (`formatMXN`, `formatPct`, `formatDelta`)
- `src/lib/reports/filters.ts` (hook `useReportFilters` con persistencia localStorage)
- `src/lib/reports/exportCsv.ts` (Blob + descarga nativa, sin libs)
- `src/lib/reports/exportPdf.ts` — **jsPDF + jspdf-autotable**:
  - Portada: logo Walix, título, período activo, vendedores filtrados, generado por, fecha
  - Sección por bloque del reporte usando `autoTable` para tablas (vendedores, conversiones)
  - Gráficas (funnel, pie, bar, heatmap) capturadas con `html2canvas` desde refs y embebidas como PNG
  - Numeración de página y footer con marca
  - Nombre archivo: `walix-reporte-{YYYY-MM-DD}.pdf`

**Routing**
- `src/App.tsx` — reemplazar `<Stub>` de `/reports` por `<Reports />`

### Dependencias a añadir

- `jspdf` (~150KB, MIT)
- `jspdf-autotable` (plugin para tablas)
- `html2canvas` (para capturar gráficas SVG/DOM como imagen y embeber en el PDF)

### Detalles técnicos clave

- **Reutilización IA**: `ExecutiveSummaryAI` invoca el mismo endpoint que el dashboard. No se modifica el edge function; solo se consume el campo `executiveSummary` (ya existe en la respuesta). Si el período seleccionado en Reports difiere del "esta semana" actual del edge, en v1 se muestra el resumen tal cual con un disclaimer "Resumen de la semana en curso" (extender el edge para aceptar `period` queda anotado para v2).
- **Funnel SVG**: trapezoides con `<path>`, `<linearGradient id="funnelGrad">` indigo-300 → indigo-700, hover con `<Popover>` shadcn que incluye botón "Ver deals de esta etapa" → `navigate('/pipeline?stage=...')`.
- **Heatmap**: clases Tailwind enumeradas estáticamente para que el purge no las elimine (`bg-success/10`, `/30`, `/60`, `/90`).
- **Export PDF**: capturar refs con `useRef` por sección; `html2canvas(node, { scale: 2, backgroundColor: '#ffffff' })` para nitidez; insertar con `doc.addImage`. Tablas con `autoTable` (más limpias que captura).
- **Drill-down**: `useNavigate()` con query params; los módulos destino ya soportan filtros (verificado en Pipeline/Contacts).
- **Sin backend de reportes**: data desde `mock/reports.ts`; estructura preparada para swap a `useQuery` real en v2.

### Fuera de alcance (v1)

- Conexión real a datos del CRM para los 6 bloques (mock estructurado para swap).
- Extender `dashboard-ai-widgets` para aceptar período arbitrario.
- Programación de envío de reporte por email.
