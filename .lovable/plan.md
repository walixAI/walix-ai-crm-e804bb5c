## Objetivo

Que el contacto entrante por WhatsApp matchee con el contacto correcto del CRM sin importar si el número está guardado con o sin el prefijo móvil de su país (MX "1", AR "9", BR "9"), y que el envío salga siempre en el formato que Meta espera.

## Estrategia

Crear una utilidad única de normalización compartida (lado servidor en edge functions, y un espejo en el cliente para validación al guardar contactos). La utilidad produce dos valores:

- `e164` — formato canónico para guardar y mostrar (sin prefijo móvil legado): `+525517278186`
- `wa_id` — formato que Meta usa internamente para `wa_id` y para envío (con prefijo móvil donde aplica): `5215517278186`

Guardamos **siempre el `e164` canónico** en `contacts.phone`. Al recibir o enviar, convertimos contra `wa_id`.

## Reglas de normalización

```text
MX (+52): si después de "52" hay 11 dígitos que empiezan en "1" → quitar ese "1"
          al enviar a móvil → reinsertar "1" tras "52"
AR (+54): si después de "54" hay "9" + 10 dígitos → quitar el "9" para canónico
          al enviar a móvil → reinsertar "9" tras "54"
BR (+55): líneas móviles llevan "9" delante del número local de 8 dígitos.
          Mantener tal cual (ya forma parte del número local).
Resto:    sin transformación.
```

## Cambios

1. **`supabase/functions/_shared/phone.ts`** (nuevo): exporta `toE164(input)` y `toWaId(e164)`. Sin dependencias externas.
2. **`src/lib/phone.ts`** (nuevo): mismo código portado al cliente, usado en formularios de contacto al crear/editar para guardar siempre en formato canónico.
3. **`supabase/functions/whatsapp-webhook/index.ts`**:
   - Al recibir un mensaje, calcular `const canonical = toE164(from)` y buscar contacto por `phone IN (canonical, "+"+from)` para cubrir contactos viejos que quedaron mal guardados.
   - Al crear contacto nuevo, guardar `phone: canonical`.
4. **`supabase/functions/whatsapp-send/index.ts`**:
   - Antes de llamar a Meta, `to: toWaId(contact.phone)`.
5. **Migración de datos** (opcional, recomendada): script SQL idempotente que normaliza `contacts.phone` existentes y fusiona duplicados detectados (por ejemplo "Erick Zendejas" + "Erick Zendejas 2"). Esto se ejecuta como migración revisable.

## Plan de prueba

1. Enviar mensaje desde **+52 55 1727 8186** (Erick) → debe seguir matcheando con el contacto existente, sin crear duplicado.
2. Desde la ficha de **Toño Torres**, mandar un WhatsApp → verificar en `whatsapp-send` logs que el `to` enviado a Meta lleva el "1" tras el "52" y que Meta responde OK.
3. Toño responde → debe matchear con su contacto, no crear uno nuevo.
4. Limpiar el contacto "Erick Zendejas 2" duplicado (vía migración o manualmente).

## Detalles técnicos

- La utilidad es pura (sin red, sin DB), testeable. Agregar tests unitarios mínimos en `src/lib/phone.test.ts` cubriendo MX con/sin 1, AR con/sin 9, BR, US, y entradas con espacios/guiones/paréntesis.
- No tocamos `contacts_ai_create` aún (usa su propio parser); queda fuera del alcance hasta validar lo anterior.

¿Procedo con la implementación tal cual, o quieres que omita la migración de datos existentes y solo arregle el flujo a futuro?