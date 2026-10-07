# Agente de SCALA (Utel): qué se puede configurar hoy y qué falta

## 1. ¿Se puede configurar el agente de SCALA con estos archivos?

Sí, en buena parte. El documento de requerimientos de Utel trae casi todo lo necesario:

| Sección de Utel | Dónde va en Walix hoy | ¿Se puede cargar hoy? |
|---|---|---|
| 01 Objetivos | Objetivo predeterminado + mensaje clave | Sí |
| 02 Persona y tono | Identidad, tono, nombre (Arlett) | Sí, pero el límite de 300 caracteres, "sin listas" y "un emoji máximo" no se pueden configurar (hoy van fijos como "3-4 oraciones") |
| 03 Perfilamiento | No hay campo propio | Parcial: hoy el agente pregunta fijo "necesidad, presupuesto, tiempo, decisor" y no guarda los 7 datos en la ficha |
| 04 Base de conocimiento | Conocimiento (texto/FAQ/PDF/web) | Sí, aunque con muchas fichas de licenciatura se corta (lee máx. 40 documentos) |
| 05 Reglas | "Nunca hacer" | Sí |
| 06 Objeciones | Conocimiento tipo FAQ | Sí |
| 07 Handoff | Handoff predeterminado | Parcial (ver faltantes) |
| 08 Conversación tipo | No hay campo | No |

### Contradicciones en el documento de Utel que hay que resolver antes de cargarlo
- El resumen y la sección 05/03 dicen "primero Online, después Híbrida como mejora", pero el objetivo principal y las notas (\*\*) dicen "PRIORIDAD a Híbrida y después Online". Hay que confirmar cuál manda.
- Precio: aparece "Desde $799" como nota sin cerrar.
- Platzi está marcado como "ELIMINAR".
- Falta el enlace del aviso de privacidad y la lista vigente de sedes/horarios confirmada.

## 2. Comparación con el otro bot (documento técnico) y lo que nos falta

Lo que el otro bot tiene y Walix aún no:

1. **Perfilamiento estructurado**: lista de datos a obtener en orden (nombre, edad, ciudad, licenciatura, disponibilidad presencial, sede, horario de llamada), guardados en la ficha del contacto, y saber cuáles faltan.
2. **Calificación automática** después de cada mensaje: estado, puntaje y datos faltantes.
3. **Avance de etapa automático**: perfilamiento completo → etapa "Perfilado"; handoff → "Cita con asesor".
4. **Disparadores de handoff específicos**: molestia/frustración, insistir 2 veces en un tema, "ya hablé con un asesor", beca exacta/revalidación.
5. **Resumen fijo para el asesor** con el formato de Utel (prospecto, interés, sede, horario, origen, dudas, motivador, freno, motivo).
6. **Asignación de asesor por regla** al transferir (opción, sede, turno o carga).
7. **Alerta de SLA** si el asesor no llama a tiempo.
8. **Leads de formulario de Meta**: confirmar datos precargados en lugar de volver a preguntarlos, y mensaje de bienvenida automático.
9. **Búsqueda inteligente en la base de conocimiento** (por similitud) en lugar de leer los primeros 40 documentos; necesario para ~88 documentos de Utel.
10. **Ejemplos de conversación** (correcta/incorrecta) como guía del agente.
11. **Reglas de formato configurables** por agente (máx. caracteres, emojis, sin listas).
12. **Métricas por agente** de Utel: % que responde, % perfilado completo, % con llamada, % que acepta Híbrida, % "Sí" presencial por ciudad.

Lo que Walix ya tiene y el otro bot no (no hace falta copiar): control de gasto fuera de 24 h con plantillas, varios agentes por Pipeline con reparto y cobertura, chat web, tomar/devolver control, consumo por agente. Los riesgos técnicos del otro documento (fuga de tenant, plantillas de clínica, etc.) son de otro sistema y no aplican aquí.

## 3. Propuesta de trabajo

**Paso A — Preparar la pantalla del agente para recibir el documento de Utel** (sin cargar todavía los datos de SCALA): secciones separadas igual que el documento (Objetivos, Persona y tono, Perfilamiento, Conocimiento, Reglas, Objeciones, Handoff, Conversación tipo), para que después se llene una por una.

**Quitar lo que no encaja con los documentos:**
- Perfilamiento fijo "necesidad, presupuesto, tiempo, decisor" (se reemplaza por el configurable).
- Longitud fija "3-4 oraciones" (se reemplaza por reglas de formato del agente).
- Handoff genérico "si no sabes, canaliza" como única regla (pasa a disparadores configurables).
- Lectura de solo los primeros 40 documentos de conocimiento (se reemplaza por búsqueda inteligente).
- El agente nunca debe fingir ser humano: se agrega como regla fija.

**Paso B — Agregar a Walix (en este orden de prioridad):**
1. Sección "Perfilamiento" por agente: datos a obtener en orden, guardados en la ficha, con etapa destino al completar.
2. Handoff ampliado: disparadores específicos, etapa destino, asesor por regla, resumen con formato y alerta SLA.
3. Reglas de formato configurables + ejemplos de conversación.
4. Búsqueda inteligente en conocimiento.
5. Bienvenida y confirmación de datos para leads de formulario.
6. Métricas por agente.

## Detalles técnicos
- Nuevos campos en `sales_agents`: `profiling_fields` (lista ordenada con clave, pregunta, condición), `format_rules`, `examples`, `handoff_triggers`, `handoff_stage_id`, `profiled_stage_id`, `assignment_rule`, `sla_minutes`.
- Tras cada respuesta, una extracción estructurada guarda datos en `contacts.custom_fields` y evalúa faltantes; mueve el deal de etapa.
- Embeddings (`google/gemini-embedding-2`) + pgvector en `sales_agent_knowledge` para recuperar top-k.
- `buildSystemPrompt` deja de tener perfilamiento y longitud fijos.
- Todo con RLS por tenant y GRANTs.
