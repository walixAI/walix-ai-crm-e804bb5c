# Revisión de periodos completos

## Regla
Las fechas seleccionadas incluyen completos el día inicial y el final. Los filtros con horas explícitas conservan su instante. Las columnas de fecha sin hora conservan fechas sin hora.

## Cobertura leída y resultado

| Lugar | Código leído | Resultado |
| --- | --- | --- |
| Llamadas: historial, resumen, entrantes no atendidas y CSV | Calls.tsx, queries/reports.ts | Comparten límites inclusivos corregidos; sin nuevas escrituras. |
| Llamadas: estados, resumen, bitácora y CSV | AgentStatusTab.tsx, agentStatusReport.ts | Comparten límites corregidos; los estados se intersectan con el rango. Equipo en vivo permanece independiente del filtro histórico. |
| Calendario de Llamadas y Reportes | PeriodPicker.tsx | Primera fecha no aplica un rango previo accidentalmente; segunda fecha aplica el nuevo rango. Prueba de reemplazo del 1 al 23 aprobada. |
| Reportes: indicadores, embudo, vendedores, fuentes, pérdidas y conversiones | Reports.tsx, queries/reports.ts, consumidores de ReportsContext, StageConversionsSection.tsx | Usan el conjunto de datos del periodo corregido; lectura de oportunidades abiertas y cierres conserva reglas existentes. |
| Reportes: PDF y CSV | ReportsHeader.tsx | Exportan los mismos datos filtrados; no recalculan límites independientes. |
| Reportes: actividad del equipo y Excel | TeamActivityHeatmap.tsx, queries/teamActivity.ts | Actividades, llamadas y movimientos de etapa aplican ambas fechas completas; pruebas de los tres orígenes aprobadas. |
| Reportes: recorrido de leads y CSV | LeadJourneyReport.tsx | Tiene ventanas propias de 7/30/90/365 días, no un periodo personalizado; no afectado por el límite del día final elegido. |
| Reportes: seguimientos del embudo y CSV | FunnelDrilldownCard.tsx, queries/funnelDrilldown.ts | Usa un instante relativo inicial y no tiene fecha final personalizada; no afectado. |
| Reportes: por qué no avanzan | StalledDealsCard.tsx | Diagnóstico vigente, sin selector personalizado; no afectado. |
| Reportes: impacto del Copiloto | CopilotImpactCard.tsx | Lectura global de impacto sin selector personalizado; no afectado por este problema. |
| Tablero: valor por etapa | ChartFilters.tsx, Dashboard.tsx, queries/dashboard.ts | Corregidos inicio/final completos de fechas personalizadas. |
| Tablero: ventas cerradas por día | Mismos archivos | Corregidos final completo y agrupación del cierre de noche en el día de México correspondiente, sin mover la fecha guardada de cierres. |
| Tablero: actividad reciente y CSV | ActivityReportCard.tsx, queries/activityReport.ts | Corregida interpretación de ambos días completos en México; prueba del selector real y consulta aprobada. |
| Oportunidades: Kanban, lista, desempeño y filtros secundarios | PeriodFiltersBar.tsx, DealsPerformanceView.tsx, Pipeline.tsx | Ya usa inicio inclusivo y día siguiente exclusivo en la zona local; sin cambios. Cuatro pruebas existentes aprobadas. |
| Mi día / tarjetas de ritmo de ventas | queries/runRate.ts y referencias a useRunRate | Corregido el último milisegundo del mes sin cambiar zona horaria ni metas. |
| Gastos: lectura mensual y rentabilidad | queries/expenses.ts | Fechas de gastos ya inclusivas; rentabilidad corregida para incluir último milisegundo mensual. Ningún gasto/pago modificado. |
| Facturación: historial y lectura mensual de consumo para recibo | queries/invoices.ts | Mes con inicio inclusivo y siguiente mes exclusivo; sin cambios a facturas o consumo. |
| Servicios mensuales: agenda y tarjetas de recurrencias | queries/monthlyServices.ts y consumidores | Columnas DATE con inicio del mes inclusivo y siguiente mes exclusivo; sin cambios. |
| Copiloto: consultas de actividades por fechas | ai-copilot/index.ts | Corregidos ambos límites de fechas explícitas con inicio inclusivo y siguiente día exclusivo. Desplegado, sin ejecutar una consulta de IA con costo. |
| Copiloto: vista previa de cambios masivos en actividades/tareas/oportunidades | _shared/bulk-edit.ts | Corregidos días de columnas timestamp y mantenidos filtros DATE sin hora. Solo afecta nuevas selecciones; operaciones previas usan target_ids guardados. No se ejecutó ningún cambio masivo. |
| Comandos de WhatsApp: listar actividades | whatsapp-ai-command/index.ts | Periodos relativos predeterminados, sin fechas personalizadas; no afectado. |
| Procesos de correo / WhatsApp / campañas de llamadas / notificaciones | email-worker, wa-campaign-worker, call-campaign-worker, notifications-digest | Comparan instantes programados con ahora, no fechas finales de un periodo elegido; sin cambios ni ejecuciones. |
| Proceso de recurrencias | automations-run/index.ts | Columna DATE y horizonte inclusivo, no periodo personalizado; sin cambios ni ejecución. |
| Funciones de base de datos | Catálogo pg_proc de public para argumentos date/timestamp y filtros date_from/date_to; definición de deal_auto_name | No hay funciones con límites de periodo personalizado. La función con argumento timestamp nombra oportunidades por mes, no filtra registros; sin cambios. |
| Formularios de seguimiento, fechas de oportunidad, gastos y suscripciones | Localización de input[type=date] | Son fechas individuales para guardar/programar, no filtros de periodos; no modificados. |

## Evidencia y límites
- 24 pruebas aprobadas en nueve archivos: límites compartidos, consultas de tablero, selector de actividad, tres fuentes de actividad del equipo, calendario, resumen de estados y filtros de oportunidades.
- Última compilación: sin errores.
- Primera corrección: lectura real del 1 al 23 devuelve 21 estados de dos asesores, excluyendo QA.
- No se modificó ningún registro, pago, envío, reembolso, cierre, permiso, configuración ni ejemplo.
- No se pudo comprobar la pantalla con la sesión del solicitante: no hay sesión disponible para su cuenta; esta limitación se conserva.
- Despliegue del Copiloto verificado como despliegue, no como conversación autenticada ni consulta real con consumo de IA.