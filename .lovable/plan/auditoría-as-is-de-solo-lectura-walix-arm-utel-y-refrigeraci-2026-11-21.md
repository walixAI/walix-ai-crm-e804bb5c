# Auditoría AS-IS de solo lectura — Walix ARM (Utel y Refrigeración)

## Qué haré
Haré una auditoría técnica y funcional **sin modificar nada**: no cambiaré código, configuración, datos, permisos ni webhooks, y no enviaré mensajes ni haré llamadas o despliegues. Solo leeré el código y consultaré el esquema y conteos agregados (COUNT, fechas mín./máx., porcentaje de campos vacíos), filtrados por empresa. No mostraré datos personales, secretos, conversaciones, audios ni documentos.

## Acceso disponible (se declara en 00)
- Código del repositorio y funciones del servidor: lectura completa.
- Esquema de la base, políticas de acceso, triggers y funciones: lectura.
- Datos de producción: solo consultas agregadas de lectura (preview y producción usan la misma base).
- Logs existentes del backend: solo lectura, con fecha.
- Sin acceso: consolas de Meta, Google Ads, Twilio ni Blueprint v1.2 / Arquitectura v3.1 (no se subieron). Todo eso se marcará `NO_VERIFICABLE`.

## Entregables (en Archivos, carpeta `Walix_ARM_Auditoria/`)
1. `00_Audit_Scope_and_Access.md`
2. `01_Global_Technical_Inventory.md`: rutas, módulos, tablas por dominio, funciones SQL, funciones del servidor, tareas programadas y almacenamiento.
3. `02_Tenant_Utel_ASIS.md`: flujo real en diagrama Mermaid (Meta/Google → registro de leads → WhatsApp → agente → asesor), atribución, deduplicación, handoff y KPI.
4. `03_Tenant_Refrigeracion_ASIS.md`: cartera, recurrencias, gastos, rentabilidad, metas, run rate, comisiones (si no existen, se dirá) y telefonía Twilio.
5. `04_Data_Inventory_and_Quality.md`: conteos por empresa, huérfanos, nulos e identificadores externos.
6. `05_Integrations_and_Channel_Inventory.md`
7. `06_Parity_Gap_and_Migration_Readiness.md`: estrategia de copia inicial + cambios y de corte de webhooks, más el plan de respaldo. Solo se propone, no se ejecuta.
8. `07_Evidence_Register_and_Open_Questions.md`: cada hallazgo con su ID, estado de evidencia, fuente y fecha.
9. `08_Capability_Traceability.csv`: sin el Blueprint, solo incluiré las capacidades que menciona el prompt y no inventaré los IDs CAP-001 a CAP-056.
10. `09_Executive_Summary.md`

Al final te daré un resumen corto en el chat y un ZIP con los 10 archivos.

## Detalles técnicos
- Varios exploradores de solo lectura trabajarán en paralelo: inventario global, Utel, Refrigeración e integraciones y seguridad.
- SQL: consultas de lectura en `information_schema`, `pg_policies`, `pg_proc`, `cron.job` y `storage.buckets` (solo metadatos), además de `count(*)` / `min` / `max` agrupados por `tenant_id`, con límites de tiempo de ejecución.
- Etiquetas de evidencia: CONFIRMADO_CODIGO / _CONFIG / _DATOS / _RUNTIME, PARCIAL, NO_ENCONTRADO, NO_VERIFICABLE, DEPRECADO.
- Los documentos se generan en /tmp y se copian a /mnt/documents. El proyecto no se toca.
