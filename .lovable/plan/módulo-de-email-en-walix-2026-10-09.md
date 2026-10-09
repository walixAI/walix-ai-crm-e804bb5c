# Módulo de Email en Walix

## Qué obtiene cada tenant

**1. Configuración → Email (solo dueño/admin)**
- El tenant elige la forma de enviar del asesor:
  - **Cuenta propia**: cada asesor conecta su correo.
  - **Cuentas genéricas**: el admin conecta una o varias (ventas@, admisiones@) y decide qué asesores usan cada una.
  - **Mixto**: cuenta propia si existe y, si no, la genérica.
- Proveedores para las cuentas de envío y lectura:
  - **Gmail / Google Workspace**: conexión con un clic.
  - **Outlook / Microsoft 365**: conexión con un clic.
  - **IMAP/SMTP**: cualquier otro proveedor (Zoho, GoDaddy, Hostinger, cPanel, Yahoo, etc.) con servidor, usuario y contraseña de aplicación. Hay un botón «Probar conexión».
- Proveedores para envío masivo, cada uno con la clave y el dominio del tenant: **Brevo, SendGrid, Mailchimp Transactional (Mandrill), Amazon SES, Mailgun** y SMTP genérico. Se pueden registrar varios y marcar uno como predeterminado.
- Firma por asesor y por cuenta genérica.

**2. Bandeja de Email (nuevo menú, junto a WhatsApp)**
- Hilos de ida y vuelta: Walix lee el buzón cada pocos minutos y liga cada correo al contacto por su dirección. También lo liga a su oportunidad y a su asesor.
- **Asesor**: ve solo los correos de sus leads. **Dueño, admin y gerente**: ven todo, con filtros por asesor, cuenta y estado.
- Puede redactar, responder, reenviar y adjuntar archivos. También puede usar plantillas con variables ({{nombre}}, {{empresa}}…) y pedir a la IA «Sugerir respuesta».
- Los correos que no corresponden a ningún contacto se ignoran. Así no se cuela el correo personal del asesor.

**3. Email dentro del contacto y la oportunidad**
- Una pestaña «Email» muestra el historial y tiene un botón para escribir. Cada envío y cada respuesta quedan como actividad en la línea de tiempo y cuentan para avanzar etapa, igual que WhatsApp.

**4. Envío masivo (Campañas → Email)**
- El usuario elige el segmento con los mismos filtros de las campañas de WhatsApp: origen, etapa, etiqueta, asesor, ciclo de vida. Luego elige la plantilla y el proveedor masivo, y puede mandarlo ya o programarlo.
- Antes de enviar ve cuántos destinatarios hay, cuántos se excluyen y el costo estimado.
- Lleva enlace de baja obligatorio y una lista de bajas por tenant que se respeta siempre. Los rebotes y quejas se excluyen solos.
- Métricas por envío: enviados, entregados, abiertos, clics, rebotes y bajas, según lo que reporte cada proveedor.
- Sin proveedor masivo configurado, el envío masivo queda bloqueado. Gmail y Outlook bloquean las cuentas que mandan volumen.

**5. Plantillas de email**: editor con asunto, cuerpo, variables y vista previa, por tenant.

## Lo que necesito de ti después
- Para el botón de Google y Microsoft: registrar una vez la aplicación de Walix en Google Cloud y en Microsoft Azure. Te guío paso a paso cuando llegue esa parte.
- Las claves de Brevo, SendGrid y los demás las pone cada tenant en su configuración, no tú.

## Orden de entrega
1. Base de datos, permisos, configuración del tenant, cuentas IMAP/SMTP, plantillas, bandeja y envío individual.
2. Google y Microsoft con un clic, más la lectura automática del buzón.
3. Proveedores masivos, envío masivo, bajas, rebotes y métricas.

## Detalles técnicos
- Tablas nuevas, todas con `tenant_id`, RLS por `get_user_tenant(auth.uid())` y GRANTs:
  - `email_settings` (modo por tenant)
  - `email_accounts` (personal/genérica, proveedor, credencial cifrada, dueño, asesores permitidos)
  - `email_providers` (masivos, clave cifrada)
  - `email_threads` y `email_messages` (contact_id, deal_id, owner_id, account_id, message-id/in-reply-to para hilar)
  - `email_templates`
  - `email_campaigns` y `email_campaign_recipients`
  - `email_suppressions`
- Visibilidad por RLS: el asesor ve los hilos donde `owner_id = auth.uid()` o el contacto es suyo. `tenant_owner`, `tenant_admin` y `sales_manager` ven todo el tenant.
- Credenciales cifradas con AES-GCM dentro de las funciones del backend; nunca llegan al navegador.
- Gmail y Outlook usan conectores por usuario (`google_mail` y `microsoft_outlook`) con la clave guardada cifrada por usuario. Las cuentas genéricas usan el mismo flujo, conectado por el admin.
- IMAP/SMTP: función de envío por SMTP y lectura IMAP cada 5 minutos, que trae solo lo nuevo desde el último UID.
- Masivo: un adaptador por proveedor (API HTTP de Brevo, SendGrid, Mandrill, SES v2, Mailgun y SMTP). Envío en lotes desde una cola con pg_cron, y webhooks por proveedor para entregas, rebotes y aperturas.
- No se usa el correo integrado de Lovable para el envío masivo: no permite correo de marketing.
