# Importación de datos históricos — Refrigeración González y Rodríguez

Ya procesé las 5 hojas del Excel. Estos son los datos reales listos para cargar.

## Qué se va a importar

| Concepto | Cantidad |
|---|---|
| Contactos únicos (con teléfono) | **1,212** |
| Contactos omitidos (sin teléfono) | 38 |
| Oportunidades (filtros agendados + refacciones) | **695** |
| Actividades históricas | **22,557** |
| Ciclos recurrentes (mantenimiento semestral y filtros) | **282** |

### Deduplicación
Un mismo cliente aparece hasta en 4 hojas. Se unifica en cascada: **teléfono normalizado** (`+52` + 10 dígitos, quitando el "1" legado) y, si no hay teléfono, **nombre normalizado**. Se conserva el nombre más completo y se enriquece con dirección y modelo de la hoja que los tenga.

Ejemplo real ya validado:
```text
Davila  +525537224837  Acuario #36, El Prado Churubusco  G.E.D.
        aparece en: mantenimientos, filtros, refacciones, actividades  ->  1 solo contacto
```

### Origen de cada dato
- **Mantenimientos cada 6 meses** → contacto + dirección + modelo + ciclo semestral + observaciones como nota.
- **Filtros** → contacto + una oportunidad por cada periodo agendado 2026-2029 (los pasados quedan como completados, los futuros como agendados) + ciclo de filtro.
- **Pendientes refacciones** → una oportunidad por pendiente, con la cotización como monto y su fecha; marcada como completada si tiene fecha de realización. Observaciones como nota.
- **Actividades Diarias** → llamadas de salida/entrada, visitas y WhatsApp como actividades fechadas. **No** genera oportunidades, para no inflar el pipeline con 8,000 registros sin monto.
- **Recuperación de Clientes** → intentos de contacto fechados como actividades de llamada.

## Cambios técnicos necesarios

### 1. Migración de base de datos
**Campos genéricos, no exclusivos de este tenant.**

A la tabla de contactos:
- `address` (texto) — dirección. Es útil para cualquier negocio, así que se agrega como campo estándar del CRM.
- `phone_alt` (texto) — segundo teléfono. En el Excel viene como "Teléfono de casa" y lo tienen **72 contactos**. Es un campo universal, no del giro.
- `custom_fields` (JSON) — bolsa de campos personalizados por tenant. Aquí se guarda el modelo del refrigerador como `{"modelo_equipo": "S.Z. 500"}`.
- Índice por tenant y teléfono para deduplicar rápido.

Nueva tabla `contact_custom_fields` (definiciones por tenant, con RLS y GRANTs):
```text
tenant_id | key           | label             | type   | position | is_active
----------+---------------+-------------------+--------+----------+----------
 G&R      | modelo_equipo | Modelo de equipo  | text   | 0        | true
```

Así cualquier tenant puede definir sus propios campos (número de póliza, placas, RFC, talla, etc.) sin tocar la base. Para Refrigeración G&R se crea una sola definición: **Modelo de equipo**.

> Nota: la tabla de **oportunidades** ya trae `equipment_brand`, `equipment_model` y `service_type` de una implementación previa. Son campos de este giro que quedaron en el esquema base. Se aprovechan para las refacciones y filtros, y más adelante conviene migrarlos también a campos personalizados por tenant.

## Datos del Excel que requieren una decisión

### a) Cotizaciones en texto libre — 34 de 353 filas
El resto son números limpios, pero estas traen texto:
```text
$3,800 y $6,800      -> dos precios en una celda
$3,800 C/U           -> precio por pieza, no total
$300 Dólares         -> moneda distinta (USD)
T/P $15000           -> abreviatura del negocio
GARANTIA / CLIENTE TRAE DE USA / Se pidio evaporador   -> sin monto
```
Sin tratarlas, `$3,800 y $6,800` se leería como **$38,006,800**. Propuesta:
- Tomar el **primer monto** de la celda como valor de la oportunidad.
- Guardar el **texto original completo** en las notas de la oportunidad.
- Convertir los montos en dólares a pesos y anotarlo en la nota.
- Las que no tengan monto quedan en $0 con el texto en notas.
- Marcar esas 34 oportunidades con la etiqueta **"Revisar cotización"** para que las validen a mano.

### b) Modelos de equipo sin catálogo — 228 variantes
Hay 1,201 contactos con modelo, pero escrito de muchas formas: `s.z.`, `S.Z.`, `s,z,`, `S.Z. 500`, `mabe d.`, `Whirlpool, Samsung`. Propuesta: **importar el texto tal cual** para no perder información, y dejar la limpieza del catálogo para después con la lista de valores reales a la vista.

### c) Nombres — 482 contactos tienen un solo nombre
Muchos registros son solo apellido (`Davila`, `Tami`). Todo el texto va al campo **Nombre** y **Apellido** queda vacío, para no partir mal los nombres.

### d) Direcciones — solo 222 de 1,212
La dirección solo viene en las hojas de mantenimientos, filtros y recuperación. El resto queda sin dirección y se puede completar con el uso diario.

### e) Periodos "Enero / Julio"
Los periodos de mantenimiento y filtros vienen como nombre de mes, sin día. Se agendan el **día 1 del mes** correspondiente y el técnico ajusta la fecha exacta al confirmar.

### 2. Corregir el importador existente (bug encontrado)
`import-runner` usa columnas que **no existen** en la base:
- contactos: `full_name`, `whatsapp`, `lifecycle`, `created_by` → deben ser `name`, `phone`, `status`.
- oportunidades: `title` → debe ser `name`.
- actividades: `direction`, `notes`, `performed_at`, `owner_id` → deben ser `description`, `occurred_at`, `metadata`.

Tal como está hoy, **cualquier importe desde la UI falla**. Se corrige antes de cargar.

### 3. Carga masiva revertible
Se despliega una función temporal `bulk-seed` protegida por token que:
- Crea un lote de importación por tipo (contactos, oportunidades, actividades).
- Registra cada fila con el identificador del registro creado.
- Deja disponible el botón **Deshacer** en `/settings?tab=import` → Historial.

Se ejecuta por fases, verificando cada una antes de seguir:
```text
Fase 1  Contactos            1,212
Fase 2  Oportunidades          695
Fase 3  Actividades         22,557
Fase 4  Ciclos recurrentes     282
```

La función temporal se elimina al terminar.

### 4. Mostrar los campos nuevos
- **Dirección**: campo estándar en la ficha y el formulario del contacto, para todos los tenants.
- **Segundo teléfono**: campo estándar junto al teléfono principal.
- **Campos personalizados**: la ficha y el formulario del contacto leen las definiciones del tenant y muestran/editan dinámicamente solo los campos que ese tenant haya definido. Si un tenant no define ninguno, no aparece nada extra.
- Un panel en Ajustes para que el administrador cree, renombre, reordene o desactive sus campos personalizados.

## Asignación
Todo queda asignado al **administrador del tenant** (Adriana Ruiz) para no distorsionar las métricas de los vendedores. Se puede reasignar después desde Contactos.

## Si algo sale mal
Cada fase es un lote independiente con botón **Deshacer**. Si la Fase 1 queda mal, se revierte y las siguientes no se ejecutan.

## Próximo paso
Aprobar para ejecutar la migración y la carga por fases.
