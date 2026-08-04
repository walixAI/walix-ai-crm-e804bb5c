# WhatsApp por tenant: configuración y créditos

## Estado actual (verificado)

- Cada tenant ya tiene su propia configuración en `whatsapp_channels` (canal `clients` y canal `team`), con su `phone_number_id`, `business_account_id`, `access_token` y `verify_token` propios. La UI vive en Ajustes → WhatsApp.
- El consumo de **IA** sí se descuenta: `ai-copilot` escribe en `tenant_credit_balances.ai_used` aplicando el `credit_factor` del modelo del tenant.
- El consumo de **WhatsApp NO se descuenta**: la función `whatsapp-send` no toca créditos. Los paquetes de `credit_packs` y los créditos incluidos del plan no están conectados al envío real.
- `tenant_credit_balances` guarda `whatsapp_included / whatsapp_purchased / whatsapp_used` por periodo mensual, pero no hay proceso que cree el periodo ni cargue los incluidos del plan.

## Qué se va a construir

### 1. Ciclo mensual de créditos
Función de base de datos `ensure_credit_period(tenant_id)` que crea la fila del mes actual y carga los créditos incluidos según el plan del tenant (WhatsApp e IA). Se llama al inicio de cada envío y de cada uso de IA, y desde un cron diario. Los créditos comprados no vencen al cambiar de mes; los incluidos se reinician.

### 2. Cobro real por mensaje de WhatsApp
En `whatsapp-send`, antes de llamar a Meta:
- Determinar si el mensaje es **cobrable**: solo consume crédito cuando se abre conversación fuera de la ventana de 24 h (plantilla / primer mensaje). Las respuestas dentro de la ventana de servicio no consumen crédito, igual que la política de Meta.
- Verificar saldo (`incluidos + comprados − usados`). Sin saldo no se envía y se devuelve un error claro que la UI muestra como "Sin créditos de WhatsApp".
- Al éxito, incrementar `whatsapp_used` y registrar el consumo asociado al mensaje.

### 3. Registro de consumo auditable
Nueva tabla `credit_ledger` (tenant, tipo whatsapp/ia, cantidad, motivo, referencia, usuario, fecha) para poder explicar cualquier cargo. Alimentada por envío de WhatsApp, por IA y por compra de paquetes.

### 4. Compra de paquetes conectada
Al comprar un paquete desde Facturación se suma a `whatsapp_purchased` o `ai_purchased` del periodo y se registra en el ledger. Por ahora el alta la confirma la plataforma (sin pasarela de pago), igual que hoy.

### 5. UI
- **Facturación**: la tarjeta de créditos muestra incluidos, comprados, usados y disponibles, con barra de avance y aviso al 80 % y 100 %.
- **Inbox de WhatsApp**: cuando el mensaje va a ser cobrable, el aviso actual de "se cobrará" incluye cuántos créditos quedan; con saldo cero se bloquea el envío con enlace a comprar paquete.
- **Ajustes → WhatsApp**: resumen del consumo del mes del canal, junto al estado de conexión.
- **Panel de plataforma**: columna de consumo de WhatsApp e IA por tenant, para ver quién se está quedando sin créditos.

## Notas técnicas

- Todo el cálculo de saldo y descuento ocurre en el servidor (edge functions con service role); el cliente solo lee. Nunca se descuenta desde el navegador.
- Nuevas tablas con RLS por `get_user_tenant(auth.uid())` y GRANTs correspondientes; el ledger es de solo lectura para el tenant y escritura solo por service role.
- La detección de ventana de 24 h reutiliza `serviceWindow.ts` / `last_inbound_at` ya existentes.
- El descuento es transaccional para evitar doble cobro en envíos simultáneos.