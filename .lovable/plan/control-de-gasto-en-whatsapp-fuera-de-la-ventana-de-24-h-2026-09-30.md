# Control de gasto en WhatsApp fuera de la ventana de 24 h

## Idea central
Dentro de las 24 h después de que el lead escribe, el asesor manda los mensajes que quiera y no cuestan nada. Fuera de esa ventana, Meta solo acepta plantillas aprobadas y cobra cada una. Ahí es donde se va el dinero, así que los límites aplican solo a esas plantillas. Cada lead siempre tiene derecho a recibir al menos un mensaje, pero nadie puede mandarle plantillas sin control.

## Qué ve el asesor
- **Ventana abierta:** el chat funciona igual que hoy, sin límites.
- **Ventana cerrada:** la caja de texto cambia a "Elegir plantilla". Ahí ve cuánto cuesta y cuántos intentos le quedan con ese lead, por ejemplo "Intento 1 de 3 · se cobrará".
- **Límite alcanzado:** el botón se bloquea y sale el motivo, por ejemplo "Ya mandaste 3 plantillas sin respuesta. Próximo intento disponible el lunes". El asesor puede tocar "Pedir autorización" y su gerente la aprueba con un clic.
- **El lead contesta:** todos los contadores de ese lead vuelven a cero y se abre otra vez la ventana gratis.

## Reglas por empresa (Configuración → WhatsApp → "Control de gasto")
Estos son los valores iniciales. Cada empresa puede cambiarlos:
1. **Por lead:** máximo 1 plantilla cada 24 h y 3 plantillas en total mientras el lead no conteste.
2. **Por asesor:** máximo 30 plantillas pagadas al día.
3. **Por empresa:** tope mensual en créditos. Al llegar al 80% se avisa a los administradores. Al 100% solo los administradores pueden mandar plantillas.
4. **El bot cuenta:** si el lead ya recibió sus 4 mensajes del bot, esos intentos cuentan dentro de su límite. Así el asesor y el bot no le escriben los dos al mismo tiempo.
5. **Excepciones:** los gerentes y administradores pueden saltarse el límite de un lead, y queda registrado quién lo hizo.

## Reporte
Aparece una tarjeta nueva en Reportes: "Gasto de WhatsApp". Muestra el gasto por asesor, las plantillas enviadas sin respuesta, el porcentaje de leads que contestaron después de una plantilla y cuánto cuesta cada respuesta conseguida. Así se ve quién gasta sin resultado.

## Corrección incluida
Hoy el crédito se descuenta antes de saber si Meta aceptó el mensaje. Hay que revisar ese paso. Si Meta rechaza el mensaje, el crédito debe devolverse.

## Detalles técnicos
- Añadir configuración `wa_spend_policy jsonb` en tenants, con los límites de arriba y sus valores iniciales.
- Nueva función de base de datos `wa_can_send_template(tenant, contact, user)` que devuelve `{allowed, reason, attempt, max, next_at}`. Cuenta los mensajes salientes de tipo plantilla, del asesor y del bot, que se enviaron desde el último mensaje entrante del lead.
- `whatsapp-send`: si la ventana está cerrada, rechaza el texto libre con un aviso claro, sin cobrar. Añadir el modo plantilla con validación de la política antes de llamar a `wa_charge_conversation`. Si Meta falla, devolver el crédito.
- `wa-campaign-worker`: consultar la misma función antes de mandar cada paso.
- Solicitudes de autorización: reutilizar `notifications` con una acción para aprobar. La aprobación da una excepción de un solo uso guardada en la metadata del contacto.
- Composer y ChatHeader: usar `getServiceWindow` para cambiar de modo y mostrar el contador de intentos.
