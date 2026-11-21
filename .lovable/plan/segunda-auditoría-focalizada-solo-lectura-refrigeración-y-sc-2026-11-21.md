# Segunda auditoría focalizada (solo lectura): Refrigeración y SCALA/Utel

## Qué haré
Haré una segunda revisión **sin modificar nada** en Walix: no cambiaré código, configuración ni datos, y no enviaré mensajes, llamadas ni webhooks. Solo leeré el código y las migraciones, y consultaré la base de datos con SELECT de catálogo o con conteos y agregados por empresa. No mostraré datos personales, teléfonos, audios, transcripciones, contenido de documentos ni secretos. Volveré a revisar cada dato desde su fuente, sin reutilizar los resultados de la primera auditoría como si ya estuvieran comprobados.

## Prioridades, en este orden
1. **Fórmulas y procesos automáticos de Refrigeración.** Para cada función revisaré su texto completo, qué la dispara, qué lee y escribe, el filtro por empresa, si puede duplicar registros, el manejo de fechas y zona horaria, y el de moneda e IVA: recurrencias, generación de gastos, avance de etapas, sincronización de nombre y monto, run rate, rentabilidad, asignación de metas y comisiones.
2. **Tareas programadas.** Buscaré en el código y las migraciones las programaciones encontradas. Separaré lo que aparece en el código de lo que está activo; lo activo queda NO_VERIFICABLE sin permiso. Incluiré una lista de lo que debe revisar un administrador.
3. **Conciliación de totales.** Recalcularé los conteos con la fecha de corte en UTC y en hora de México. Haré desgloses por mes y estado, revisaré las relaciones entre servicio, recurrencia, gasto, tarea y llamada, y buscaré registros huérfanos, campos vacíos y duplicados (solo tasas). También revisaré si cada tabla tiene fecha de actualización o borrado lógico para la copia por cambios.
4. **Telefonía y canales.** Llamadas por dirección, estado y mes, y cuántas tienen grabación, transcripción o resumen (solo si existe o no). WhatsApp: último mensaje, estados y transferencias a humano. Meta: verificación de firma e identificador del lead. Google Ads: campos con los que se atribuye la visita. Correo: canales configurados.
5. **Identidad SCALA/Utel.** Revisaré evidencia de configuración, como el nombre del agente, programas, etiquetas y dominio, sin identidades personales. Si solo hay memoria, quedará pendiente de confirmación humana.
6. **Seguridad y corte.** Políticas de acceso de las tablas críticas, metadatos de los 3 espacios de archivos, evidencia de que preview y producción usan la misma base, y una propuesta de copia, cambios, corte y reversión. Solo se propone, no se ejecuta.

## Entregables
Un ZIP en Archivos con:
- `A0_Scope_and_Index.md`: fecha en UTC y en hora de México, commit, fuentes y lo que no se pudo examinar.
- `A1_SQL_Functions_and_Trigger_Dependencies.md`
- `A2_Tenant_Semantics_and_Reconciliation.md`: cada dato con su consulta SELECT legible.
- `A3_Channels_Runtime_and_External_Blockers.md`
- `A4_Migration_CDC_RLS_Storage_Readiness.md`
- `A5_Evidence_and_Open_Decisions.md`: tabla con id, tenant, afirmación, estado, fuente, fecha, confianza, validación faltante y responsable.

## Detalles técnicos
- Fuentes: catálogo de la base (`pg_proc`, `pg_trigger`, `pg_policies`, `information_schema`, `storage.buckets`/`storage.objects` solo conteos y tamaños), `supabase/migrations`, `supabase/functions` y `src/`.
- No se intentará elevar permisos. Si el esquema cron no se puede leer, se registrará y se buscarán las referencias a `cron.schedule` en migraciones y código.
- Consultas con `statement_timeout` y filtradas por `tenant_id`, sin exportar filas.
- Los textos de las funciones se publican sin valores secretos.
