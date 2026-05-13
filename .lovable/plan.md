## Diagnóstico

El botón de **Reconectar** sí ejecuta el flujo: carga la configuración `whatsapp-embedded-config` y carga el SDK de Facebook correctamente. El problema visible es que el popup de Meta no aparece en el entorno de Preview (`lovableproject.com`). Este tipo de popup/OAuth de Meta suele fallar o quedar bloqueado en Preview por dominio/cookies/orígenes, aunque el mismo código funcione en la URL publicada (`walix-ai-crm.lovable.app`).

También detecté un segundo problema de UX: el tour de bienvenida puede quedar encima de la pantalla y bloquear la interacción, haciendo parecer que el popup no funciona.

## Plan de implementación

1. **Evitar reconexión desde dominios no válidos para Meta**
   - Detectar si el usuario está en Preview (`lovableproject.com` o `id-preview--...`).
   - En ese caso, no intentar abrir `FB.login` desde Preview.
   - Mostrar un mensaje claro indicando que la reconexión debe hacerse desde la URL publicada: `https://walix-ai-crm.lovable.app/settings?tab=whatsapp`.

2. **Mejorar el manejo del popup bloqueado o silencioso**
   - Añadir timeout/fallback si `FB.login` no devuelve respuesta.
   - Mostrar un error accionable: permitir popups, cerrar bloqueadores, o usar la URL publicada.
   - Mantener `cookie: true`, `response_type: "code"`, `override_default_response_type: true`, `config_id` y `extras.feature = "whatsapp_embedded_signup"`.

3. **Hacer el botón más explícito en Preview**
   - En Preview, cambiar la acción del botón para abrir/copiar la URL publicada en vez de lanzar Meta.
   - Así se evita que el usuario quede “atorado” con un popup que Meta no abrirá correctamente desde ese dominio.

4. **No tocar backend ni configuración OAuth**
   - No cambiar secrets, URL de redirección, Site URL ni lógica de guardado del canal.
   - El backend `whatsapp-embedded-signup` ya está preparado para recibir el `code`, `phone_number_id` y `waba_id` cuando el flujo se complete desde un dominio válido.

## Archivos a modificar

- `src/lib/whatsapp/metaEmbedded.ts`
- `src/components/settings/whatsapp/EmbeddedSignupButton.tsx`

## Validación

- Confirmar en Preview que el botón ya no falla silenciosamente y muestra la acción correcta.
- Confirmar que en dominio publicado el flujo sigue usando el SDK de Facebook y abre Embedded Signup normalmente.