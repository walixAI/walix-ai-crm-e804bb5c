# WhatsApp por tenant: números propios, ruteo y cobro por créditos

## Modelo de cobro (decidido)

Walix opera como **Tech Provider**: cada tenant tiene su propio WABA y su propio número, con **el nombre de su empresa** como remitente verificado, pero la línea de crédito de Meta es de Walix. Meta le factura a Walix por **conversación de 24 h** (marketing / utility / authentication / service), y Walix descuenta **créditos** del plan o de los paquetes del tenant.

Consecuencias que el sistema debe reflejar:

- La unidad de cobro NO es el mensaje, es la **conversación de 24 h**. Varios mensajes dentro de la misma ventana consumen 1 crédito, no N.
- Cada categoría cuesta distinto para Walix, así que el crédito se descuenta con un **factor por categoría** (marketing más caro que utility; service dentro de ventana = 0).
- Si el tenant se queda sin créditos, se bloquea abrir conversaciones nuevas con plantilla, pero se permite responder dentro de una ventana ya abierta.

## Números por tenant

```text
Tenant "Refrigeración G&R"
├── Canal clientes (varios, uno predeterminado)
│    ├── +52 55 xxxx  "Refrigeración G&R"     ← default, ventas
│    └── +52 55 yyyy  "Refri G&R Soporte"     ← soporte
└── Copilot / equipo: número global de Walix (recomendado)
```

### Recomendación para el número del Copilot: uno global de Walix

Recomiendo **un solo número Walix Bot compartido**, con número dedicado solo para el Enterprise que lo pida:

- **Seguridad**: el aislamiento no depende del número sino de la tabla de teléfonos autorizados. Un teléfono se resuelve a un único tenant antes de ejecutar cualquier acción, y el Copilot ya opera con ese `tenant_id`. Un número por tenant no agrega aislamiento real; sí agrega más tokens y más WABAs que custodiar, es decir más superficie de fuga de credenciales.
- **Carga**: el límite de Cloud API es de decenas de mensajes por segundo por número, muy por encima del tráfico interno de comandos; el cuello de botella sería el modelo de IA, no WhatsApp.
- **Costo**: cada número dedicado implica otra línea telefónica y conversaciones *service* facturables por tenant. Con uno global el volumen se concentra y el costo marginal lo absorbe Walix.
- **Riesgo a mitigar**: un mismo teléfono dado de alta en dos tenants sería ambiguo. Se bloquea con unicidad global del teléfono autorizado; si alguien realmente opera dos empresas, el bot pregunta y guarda el tenant activo de esa sesión.

## Alcance del trabajo

### 1. Varios números de clientes por tenant
- Quitar la restricción de "un canal por tipo" y agregar predeterminado + etiqueta + orden.
- Ruteo de entrada: resolver tenant y canal por el número que recibió el mensaje, y rechazar lo que no corresponda.
- Ruteo de salida: cada conversación recuerda por cuál número se abrió y responde por el mismo; los mensajes nuevos usan el predeterminado o el que elija el asesor.
- Ajustes: lista de números con estado, etiqueta, marcar predeterminado y el asistente de conexión por número.

### 2. Medición y cobro por conversación
- Registro de conversaciones facturables: tenant, número, contacto, categoría, inicio y fin de la ventana de 24 h, créditos descontados y costo real estimado.
- Al enviar: si hay ventana abierta con ese contacto no se cobra; si no, se abre conversación, se descuenta crédito según categoría y se registra.
- Bloqueo por saldo: sin créditos no se abren conversaciones nuevas; el aviso aparece en el compositor del Inbox junto al indicador de ventana de 24 h que ya existe.
- Los mensajes entrantes que abren ventana *service* también se registran (costo real de Walix), aunque no descuenten crédito al tenant.

### 3. Visibilidad
- Facturación: consumo de WhatsApp del periodo desglosado por categoría y por número, créditos restantes y proyección de fin de mes.
- Panel de plataforma: consumo y costo real por tenant, para vigilar margen.

### 4. Copilot con número global
- Un canal de plataforma (no de tenant) para el bot.
- Unicidad global del teléfono autorizado y resolución explícita del tenant en cada comando.
- Bandera por tenant para usar número dedicado del equipo cuando se justifique.

## Detalle técnico

- `whatsapp_channels`: eliminar `UNIQUE (tenant_id, kind)`; agregar `is_default boolean`, `label text`, `position int`, e índice único parcial de un solo default por tenant y tipo. Permitir un canal de plataforma para el bot global.
- `conversations` gana `channel_id` para fijar el canal de respuesta.
- Nueva tabla `whatsapp_conversation_billing` (tenant, canal, contacto, categoría, `window_start`, `window_expires_at`, `credits_charged`, `provider_cost_mxn`) con RLS por `get_user_tenant(auth.uid())` y GRANTs; lectura para admins del tenant y plataforma.
- Tabla `whatsapp_rate_card` por categoría y país, editable solo por plataforma, para calcular costo real y factor de crédito.
- `whatsapp-send`: resolver canal (explícito → conversación → default), consultar ventana abierta, cobrar o no, y devolver error claro `insufficient_credits`.
- `whatsapp-webhook`: resolver tenant y canal por `phone_number_id`, registrar apertura de ventana en entrantes y conservar el fallback vendedor/cliente actual.
- Los tokens de cada WABA siguen guardándose como secretos referenciados desde el canal, nunca en tablas legibles por el tenant.