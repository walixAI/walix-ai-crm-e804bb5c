# Análisis Etapa → Resultado → Tipificación en Reportes

## Objetivo
Que el Gerente y el analista de Marketing puedan agrupar los leads por **Etapa → Resultado → Tipificación** (últimas e históricas) y cruzar por **campaña, programa, modalidad y fechas**, para responder: dónde se atoran los leads, por qué, y qué dice el mercado de cada programa/universidad/campaña. Ejemplo objetivo: «qué campaña genera menos inscritos porque la gente no puede pagar o no es perfil».

## Lo que ya existe (verificado)
- Cada seguimiento guarda en `activities.metadata`: `outcome_id`, `result` (etiqueta del resultado), `blocker_*`, `loss_reason_*`, con `deal_id` y `contact_id`.
- `contact_attribution` ya guarda campaña de origen: `utm_campaign`, `ad_campaign_name`, `meta_campaign_id`, `meta_form_name`, etc.
- `activity_outcomes` define los 6 resultados por etapa de cada pipeline.
- Reportes (`src/pages/app/Reports.tsx`) ya tiene embudo, conversiones por etapa y motivos de pérdida, pero **sin drill-down Etapa → Resultado → Tipificación ni cruce por campaña**.
- **La tipificación no existe como dato estructurado**: hoy solo queda en el texto libre del comentario.

## Decisión sobre la tipificación (lo mejor para los 3 roles)
**Catálogo fijo por resultado + sugerencia de IA:**
- **Asesor:** al registrar un seguimiento, después de elegir el resultado ve una lista corta de tipificaciones de ese resultado y elige una (un clic, sin escribir). La IA la preselecciona según la conversación, y el asesor la confirma o cambia.
- **Analista de MKT:** datos limpios y comparables para cruzar por campaña.
- **Gerente:** catálogo editable por tenant en Configuración, sin depender de programación.

## Cambios

### 1. Catálogo de tipificaciones (base de datos)
- Nueva tabla `outcome_typifications`: `tenant_id`, `outcome_id` (opcional; si es nulo aplica a todos los resultados del pipeline), `label`, `sentiment` (positiva / neutra / negativa), `position`, `is_active`.
- RLS por tenant con `get_user_tenant(auth.uid())` + GRANTs; edición solo no-vendedores, lectura para todos los miembros.
- Semilla inicial para SCALA (y plantilla para nuevos tenants), p. ej. para «No interesado»: *No puede pagar, No es perfil, Eligió otra universidad, Mala atención, Sin respuesta real*; para «Contacto efectivo»: *Pide información, Pide beca/descuento, Compara con otra escuela, Listo para inscribirse*.

### 2. Captura en el seguimiento
- En `LogFollowUpDialog`, paso 3: selector de tipificación filtrado por el resultado elegido, con preselección sugerida por IA (lee últimos mensajes de la conversación vía la función de copiloto existente; si no hay certeza, no preselecciona nada).
- Guardar en `activities.metadata`: `typification_id`, `typification_label`, `typification_sentiment`.
- Editable al editar la actividad.

### 3. Vista «Análisis del embudo» dentro de Reportes
Nueva sección en `src/pages/app/Reports.tsx` (componente `FunnelDrilldownCard`):
- **Tabla agrupada de 3 niveles:** Etapa → Resultado → Tipificación, con conteos, % del nivel padre y barra de proporción; expandible/colapsable.
- **Conmutador Última / Histórica:** «Última» usa el seguimiento más reciente de cada oportunidad (foto actual); «Histórica» cuenta todos los seguimientos del periodo.
- **Filtros:** rango de fechas, campaña (de `contact_attribution`: utm_campaign / nombre de anuncio Meta), programa (nombre de la oportunidad), modalidad, asesor.
- **Semáforo por tipificación:** positiva / neutra / negativa, para ver de un vistazo qué pesa más en cada resultado.
- **Vista cruzada «Campaña × Motivo»:** tabla de campañas contra tipificaciones negativas (No puede pagar, No es perfil, etc.) con % de inscritos por campaña — responde directo el ejemplo del usuario.
- Exportar a Excel de ambas tablas.

### 4. Consultas
- `src/lib/queries/funnelDrilldown.ts`: una consulta a `activities` (metadata->outcome/typification) unida a `deals` (etapa, programa) y `contact_attribution` (campaña), agregada en cliente con caché de React Query; respeta RLS existente (vendedores solo ven lo suyo; el análisis es para supervisores/admin).

## Experiencia de uso (UX)
- **Asesor:** la tipificación es un clic extra dentro del mismo diálogo de seguimiento que ya usa; la IA la preselecciona y él solo confirma. Cero texto libre obligatorio, cero pantallas nuevas.
- **Analista/Gerente:** la tabla de 3 niveles se expande con un clic (como una tabla dinámica de Excel), con barras de proporción y semáforo de colores — se lee sin exportar nada.
- **Filtros persistentes** en la parte superior (fechas, campaña, programa, asesor), mismos patrones que el resto de Reportes.
- **Accesible:** tokens semánticos del tema (modo claro/oscuro), sin colores hardcodeados, contraste AA, navegable con teclado.
- **Sin curva de aprendizaje:** usa los mismos componentes y patrones visuales que ya conocen en Walix.

## Notas técnicas
- Sin cambios en triggers ni en avance de etapas; la tipificación es informativa, no mueve la oportunidad.
- Actividades históricas sin tipificación aparecen como «Sin tipificar» — el análisis mejora conforme los asesores la usen.
- Toda la UI en español (es-MX); tokens semánticos del tema, sin colores hardcodeados.
- AGENTS.md: agregar regla «tipificación estructurada por resultado vive en outcome_typifications y activities.metadata».

## Verificación
- Build sin errores; prueba con datos de SCALA: registrar seguimiento con tipificación, verla en el drill-down y en el cruce por campaña; exportar Excel.
