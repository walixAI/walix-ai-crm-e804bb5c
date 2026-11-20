# Tipificaciones: intentos de llamada y llamadas efectivas

## Regla que queda

**El intento lo decide Walix; la conversación la decide el asesor.**

- **Intento que no conectó** (sin respuesta, ocupado, buzón, falló): queda con el resultado automático y la duración. El asesor **no tipifica**: solo programa el reintento o marca el contacto como no válido.
- **Llamada efectiva** (contestó, con duración): una sola entrada con resultado automático + duración + resumen de la IA + tipificación del asesor. Es la única que mueve la oportunidad.

## Cambios

### 1. Historial del contacto: distinguir intento de llamada efectiva
Cada entrada de llamada muestra una etiqueta clara: **Intento** o **Llamada efectiva**, calculada con el estado y la duración reales que reporta el proveedor. Las llamadas que ya existen se reclasifican solas al abrirlas, sin borrar nada.

### 2. Marcador: preguntar solo lo que aplica
- Si la llamada **no conectó**: el marcador muestra "Intento registrado: sin respuesta / ocupado / buzón / falló" y ofrece **Programar reintento** o **Cerrar**. Ya no pide tipificar una conversación que no ocurrió, y no muestra el bloque de transcripción (no hubo conversación).
- Si la llamada **conectó**: se mantiene **Tipificar y registrar seguimiento**, y la tipificación fina pasa a ser obligatoria cuando el resultado elegido tenga opciones configuradas.

### 3. Catálogo de resultados: separar hechos de conversación
- Se marca qué resultados son **hechos de conexión** (los que ya reporta el proveedor, como «No contestó») y dejan de aparecer en la lista que elige el asesor: Walix ya lo registró solo.
- Los resultados propios de llamada («Contacto efectivo - avanza», «sigue igual», «Lead no válido», «no interesado») dejan de mezclarse con seguimientos de WhatsApp o correo.
- El resultado automático de cada llamada queda enlazado al catálogo, para que el análisis del embudo cuente intentos y efectivas con las mismas opciones.

### 4. Tipificaciones finas para Refrigeración
Se crean las opciones de "qué dijo el lead" para los resultados de llamada de Refrigeración (hoy no tiene ninguna), por ejemplo:
- **Avanza:** Pide información · Acepta reunión · Pide cotización
- **Sigue igual:** Sin decisión aún · Pide tiempo para decidir · Hablar en otra fecha
- **No interesado:** No tiene presupuesto · Ya tiene proveedor · No es la persona indicada
- **Lead no válido:** Número equivocado · No conoce a la persona · Empresa ya no opera

Son etiquetas mías: se pueden editar, agregar o quitar en **Configuración → Seguimiento**.

### 5. Indicadores de llamada
En la pantalla **Llamadas** aparece un resumen con: **intentos**, **llamadas efectivas**, **tasa de conexión** e **intentos hasta conectar**.

## Qué se ve distinto en pantalla

| Antes | Después |
|---|---|
| Toda llamada, contestada o no, empujaba a "Tipificar y registrar seguimiento" | Un intento no conectado solo pide el reintento |
| «No contestó» aparecía para que lo eligiera el asesor | Lo registra Walix solo; el asesor no lo ve en su lista |
| Las 52 opciones de Refrigeración servían para cualquier seguimiento | Las de llamada aparecen solo en llamadas |
| Refrigeración no tenía tipificaciones finas | Tiene opciones de "qué dijo el lead" por resultado |
| Sin medida de conexión | Intentos, efectivas y tasa de conexión a la vista |

## Pruebas

- Un intento sin respuesta / ocupado / fallido se marca como **Intento** y una llamada de 43 segundos como **Llamada efectiva**.
- «No contestó» y demás hechos de conexión no aparecen en la lista del asesor; los resultados de llamada no aparecen en seguimientos de WhatsApp.
- El marcador de un intento no conecta do no ofrece tipificar y sí ofrece programar el reintento.
- El registro de seguimiento de un intento guarda el siguiente paso sin exigir resultado.
- Después de la migración, se verifica en la base de datos que los hechos de conexión quedaron marcados y enlazados.

## Lo que no se toca

- No se borra ninguna actividad ni ningún resultado existente: «No contestó» se oculta del asesor, no se elimina.
- No se cambian los permisos de llamadas, el audio del marcador ni el análisis con IA.
- Las tipificaciones finas se crean solo para Refrigeración; otras empresas se hacen por separado si lo pides.

## Detalles técnicos

- **Migración** (drizzle/migrations, siguiente número): `ALTER TABLE public.activity_outcomes ADD COLUMN is_connection_result boolean NOT NULL DEFAULT false`; marcar los hechos de conexión por etiqueta; enlazado del resultado automático.
- **Trigger** `trg_call_to_activity`: agrega `is_effective` (estado conectado con duración > 0) y `outcome_id` del hecho de conexión equivalente al estado del proveedor.
- **`filterOutcomes()`**: oculta `is_connection_result` al asesor y trata `llamada_saliente` / `llamada_entrante` como una sola familia de llamada.
- **`consolidateCallActivities()`**: propaga `is_effective` y la etiqueta de intento/efectiva.
- **`CallButton.tsx`** y **`LogFollowUpDialog.tsx`**: modo intento (solo siguiente paso) frente a modo efectiva (resultado + tipificación obligatoria si hay opciones).
- **`call-analyzer`**: la IA deja de sugerir hechos de conexión.
- **Siembra**: inserciones en `outcome_typifications` para los resultados de llamada de Refrigeración.
- **Pruebas**: `consolidateCalls.test.ts`, filtro de resultados, marcador en modo intento/efectiva y lectura de la base de datos después de la migración.
