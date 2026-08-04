# Plan: qué hacer si la importación de Excel sale mal

## Objetivo
Definir un protocolo seguro para cargar los datos históricos de Refrigeración González y Rodríguez (y cualquier tenant futuro) de forma que, si el Excel tiene errores, se pueda detectar, contener y deshacer sin dejar la base de datos mezclada.

## Estado actual confirmado
- Ya existe el **Importador Universal** (`/settings?tab=import`) con 4 tipos: contactos, productos, oportunidades y actividades.
- Cada importe crea un **lote** (`import_batches`) y guarda cada fila (`import_rows`) con su estado: `pending`, `imported`, `error`, `skipped`.
- Existe el botón **Deshacer** en el historial que invoca `import-revert`: elimina los registros creados por ese lote y lo marca como `reverted`.
- El motor detecta duplicados de contactos por teléfono normalizado y los salta (`skipped`) en lugar de crear repetidos.

## Protocolo de importación segura

### 1. Preparar el Excel antes de subirlo
- Guardar una copia de respaldo del archivo original.
- Elegir un nombre descriptivo por hoja, por ejemplo:
  - `contactos.csv`
  - `oportunidades_refacciones.csv`
  - `actividades_diarias.csv`
  - `mantenimientos_programados.csv`
- Limpiar encabezados: una sola fila de títulos, sin celdas vacías arriba, sin columnas ocultas.
- Normalizar teléfonos en el Excel a 10 dígitos mexicanos (el sistema agrega el prefijo `52`).
- Revisar que cada contacto tenga **nombre y teléfono o email**; las filas sin datos de contacto se descartan.

### 2. Importar en fases, nunca todo de golpe
```text
Fase 1 → Contactos (base de todo)
Fase 2 → Productos (si aplica)
Fase 3 → Oportunidades / Deals (se vinculan por teléfono)
Fase 4 → Actividades históricas (se vinculan por teléfono)
Fase 5 → Servicios recurrentes (mantenimientos y filtros)
```

Cada fase genera su propio lote. Si una fase falla, las anteriores quedan intactas y se pueden revertir por separado.

### 3. Usar la vista previa y una prueba piloto
- Subir primero un archivo de **10 a 20 filas** de muestra.
- Revisar en la pantalla de preview:
  - Cuántos se importarán.
  - Cuántos están duplicados.
  - Cuántos tienen error.
- Si la muestra se ve bien, subir el archivo completo.

### 4. Revisar el resultado inmediatamente
Después de confirmar cada importe, revisar en **Historial**:
- Filas importadas (verde).
- Filas con error (rojo): se puede hacer clic para ver el mensaje de error.
- Filas omitidas (ámbar): normalmente duplicados.

Si hay errores, **no seguir con la siguiente fase** hasta corregir el Excel.

### 5. Si algo sale mal: opciones de recuperación

#### Opción A: el lote completo está mal
- Ir a `/settings?tab=import` → pestaña **Historial**.
- Buscar el lote y presionar **Deshacer**.
- `import-revert` borra los contactos, deals, actividades o productos creados por ese lote.
- El lote queda marcado como `Revertido` y no se puede deshacer otra vez.

#### Opción B: solo algunas filas fallaron
- Descargar o anotar los errores del historial.
- Corregir esas filas en el Excel.
- Volver a subir el archivo. Los contactos ya existentes se saltan como duplicados, y solo se importan los faltantes.

#### Opción C: ya se hicieron seguimientos o ventas sobre los datos importados
- **No usar "Deshacer"** porque borraría contactos que ya tienes actividad real.
- Se hará una limpieza selectiva:
  - Buscar duplicados por teléfono u nombre.
  - Fusionar el contacto correcto y eliminar el sobrante.
  - Reasignar deals/actividades al contacto correcto.
- Esta limpieza se hará con un asistente de "Fusión de duplicados" que construiremos si se necesita.

### 6. Consideraciones especiales para Refrigeración G&R
- Las hojas **Mantenimientos cada 6 meses** y **Filtros** no son importes directos: son **servicios recurrentes** que se generan a partir de los contactos ya cargados.
- Si los contactos se importan mal, los servicios recurrentes también quedarán mal. Por eso la Fase 1 (contactos) debe quedar validada antes de crear recurrencias.
- Las **Actividades diarias** son históricas: se importan como actividades vinculadas al teléfono. Si un teléfono no coincide con ningún contacto, esa fila marcará error.

### 7. Checklist antes de cada importe
- [ ] Tengo una copia del Excel original.
- [ ] Los teléfonos están en formato limpio (10 dígitos).
- [ ] No hay filas en blanco al inicio ni entre los datos.
- [ ] Ya revisé la muestra piloto.
- [ ] Sé qué fase estoy importando y las anteriores ya están correctas.
- [ ] Tengo tiempo de revisar el historial antes de importar la siguiente fase.

## Entregables de este plan
1. Documento de mapeo de columnas por hoja del Excel de Refrigeración G&R.
2. Archivos CSV limpios y listos para subir (contactos, oportunidades, actividades).
3. Configuración de servicios recurrentes para mantenimientos y filtros.
4. Reporte final de importación: cuántos registros se crearon, omitidos y con error.

## Próximo paso
Aprobar este protocolo y subir el Excel para comenzar con la Fase 1 (contactos) de muestra.
