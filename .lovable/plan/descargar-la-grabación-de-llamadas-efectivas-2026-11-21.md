# Descargar la grabación de llamadas efectivas

Hoy Refrigeración tiene 11 de 24 llamadas con grabación guardada en Twilio, pero no se pueden descargar desde Walix.

## Dónde aparecerá
1. **Llamadas → Historial**: un ícono de descarga en cada fila que sea llamada efectiva y tenga grabación.
2. **Análisis de la llamada** (el diálogo con transcripción e IA): botón "Descargar audio" junto a la transcripción, y un reproductor para escucharla ahí mismo.
3. **Ficha del contacto → actividad de la llamada**: mismo botón, para que el asesor la encuentre desde el cliente.

El archivo se descarga como MP3 con nombre claro: `llamada_<contacto>_<fecha-hora>.mp3`.

## Quién puede descargar
- Las mismas personas que ya pueden ver esa llamada: el asesor ve las suyas y las de sus contactos; supervisores y administradores ven las de toda la empresa.
- Nunca se muestra el enlace de Twilio ni las credenciales; Walix entrega el audio directamente.
- Cada descarga queda registrada (quién y cuándo) en la bitácora de auditoría.

## Detalles técnicos
- Nueva acción `recording_download` en `telephony-api`: valida sesión, lee la llamada con el cliente del usuario (RLS decide acceso), exige `isEffectiveCall` y `recording_url`, resuelve credenciales cifradas del canal en el servidor, descarga `.mp3` de Twilio con autenticación y lo devuelve con `Content-Disposition: attachment`. Registra en `audit_log`.
- Frontend: helper `downloadCallRecording(callId)` que obtiene el blob con la sesión y dispara la descarga (sin URL externa); componente `CallRecordingButton` reutilizado en Historial, CallAnalysisDialog y timeline del contacto; el reproductor usa un blob URL.
- Pruebas: denegar llamada no efectiva o sin grabación, denegar llamada de otro tenant, nombre de archivo correcto.

## Fuera de alcance
- Descarga masiva en ZIP por periodo (se puede agregar después).
