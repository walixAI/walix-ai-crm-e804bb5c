## Qué está pasando (verificado en datos)

Consulté las conversaciones reales: las 9 más recientes **no tienen ningún mensaje entrante** (`inbound = 0`) y su último mensaje es saliente. Las que sí tienen entrantes son de mayo (más de 24 h).

Eso explica exactamente lo que ves:
- `needsReply` sólo es `true` cuando el **último** mensaje es entrante → hoy es `false` en casi todas las conversaciones, así que el panel muestra "No hay mensajes pendientes de responder" y no hay pista visual.
- La ventana de 24 h se calcula con el último entrante → como no hay ninguno, sale "No hay mensajes del cliente… Meta te la cobrará".

O sea: la lógica funciona, pero está diseñada para un solo escenario (el cliente acaba de escribir) y deja la conversación sin guía en todos los demás casos.

## Qué haré

Convertir la tarjeta "Qué hacer ahora" y la pista del composer en una guía **siempre útil**, con tres estados en vez de uno:

1. **El cliente escribió y falta responder** (último mensaje entrante)
   - Tarjeta destacada + pasos 1-2-3 + botón "Sugerir respuesta".
   - Pulso y tooltip abierto sobre el botón del composer.

2. **Sin respuesta del cliente / tú fuiste el último en escribir**
   - Tarjeta con tono neutro pero **igual accionable**: "Redacta un seguimiento con IA" y el mismo botón (misma acción, texto distinto).
   - En el composer, pista discreta ("La IA puede redactar el seguimiento") y tooltip al pasar el cursor.

3. **Ventana de 24 h cerrada / sin mensajes del cliente**
   - Además del aviso de costo, ofrecer los dos caminos: "Usar plantilla aprobada" (abre el diálogo de plantillas) y "Redactar con IA" para revisar antes de enviar.

También:
- El tooltip del botón "Sugerir respuesta" pasará a mostrarse **siempre al hover/focus** y quedará abierto automáticamente sólo en el estado 1 (hoy sólo existe en ese caso, y depende de que el hint sea verdadero).
- La tarjeta del panel se mostrará siempre en la parte superior del panel lateral, con icono y color según el estado, sin nunca quedar en un mensaje "no hay nada que hacer".
- Nada cambia en el envío: la IA sigue redactando sólo con clic explícito y el envío sigue siendo manual.

## Detalle técnico

- `src/pages/app/Whatsapp.tsx`: derivar un `guidance` con estados `awaiting_reply | follow_up | needs_template`, a partir de `lastMsg.direction`, existencia de entrantes y `getServiceWindow(activeConv.lastInboundAt)`. Pasarlo a `ContactSidePanel` y `Composer` en lugar del booleano `needsReply`, junto a `onOpenTemplates`.
- `src/components/whatsapp/ContactSidePanel.tsx`: reemplazar el bloque condicional actual por un render por estado (título, copy, pasos, CTA primaria y CTA secundaria de plantillas).
- `src/components/whatsapp/Composer.tsx`: tooltip siempre disponible en hover/focus; `open` controlado sólo en `awaiting_reply`; texto de la pista según estado; pulso limitado a `awaiting_reply`.
- Sin cambios de base de datos ni de edge functions.
