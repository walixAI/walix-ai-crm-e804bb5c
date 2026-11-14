# Auditoría de arquitectura AS-IS de Walix (solo lectura)

## Objetivo
Entregar el documento "WALIX — Auditoría de Arquitectura Actual (AS-IS)" siguiendo exactamente la estructura del archivo subido (secciones 1–10, 11 capas, 20 apartados finales y apéndice de evidencias), sin modificar código, base de datos, configuración ni datos de clientes.

## Alcance de la revisión (solo lectura)
1. Repositorio: estructura, dependencias, configuración de compilación, rutas y pantallas, contextos y estado.
2. Backend: tablas, migraciones, políticas de acceso por empresa, funciones del servidor, buckets de archivos, agendas automáticas (consultas de solo lectura al esquema, sin leer datos personales).
3. Canales: WhatsApp (Meta y Twilio), correo, chat web, telefonía; flujo entrante y saliente con archivos reales.
4. IA: agente de ventas compartido, proveedores y modelos, memoria y resúmenes de prospectos, registro de consumo, RAG/base de conocimiento (confirmar si existe).
5. Seguridad y gobierno: autenticación, roles por empresa, manejo de secretos (solo nombres, nunca valores), hallazgos de seguridad vigentes.
6. Pruebas, observabilidad, despliegue y documentación existente (AGENTS.md, roadmap).

Cada hallazgo se clasifica como CONFIRMADO, PARCIAL, NO ENCONTRADO, NO VERIFICABLE o DEPRECADO / SIN USO, con ruta de archivo, función o migración como evidencia. Código existente no se presentará como evidencia de operación en producción.

## Entregable
- `/mnt/documents/Walix_Auditoria_Arquitectura_AS-IS.md` (y versión Word .docx para compartir).
- Incluye: diagramas en texto, inventario de pantallas, tabla de stack, flujos end-to-end, matriz de madurez, deuda técnica y riesgos priorizados, capacidades reutilizables para el futuro Walix Relationship Engine, y apéndice de evidencias.

## Restricciones
- Sin cambios al proyecto, sin migraciones, sin despliegues, sin envíos de mensajes.
- Sin exponer secretos, tokens ni datos personales.
- Los pendientes ya acordados (propuesta del chat público, demos apagadas) se reportan como están.

## Detalles técnicos
- La investigación se divide en subagentes paralelos por bloques de capas (frontend; canales; IA/agentes; datos/seguridad; infraestructura), luego se consolida.
- Consultas al backend limitadas a `information_schema`, `pg_policies`, catálogo de funciones y lista de agendas.
