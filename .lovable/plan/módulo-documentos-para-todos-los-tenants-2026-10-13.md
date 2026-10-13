# Módulo «Documentos» para todos los tenants

## Qué verá cada usuario

**Administradores de Documentos (propietario, admin, gerente de ventas: cualquier usuario que no sea vendedor)**
- Nueva sección **Documentos** en el menú lateral.
- Crear, renombrar y eliminar **Categorías** (carpetas).
- En cada categoría, dos interruptores (apagados por defecto):
  - **«Los asesores pueden adjuntar estos documentos en WhatsApp y Email»**
  - **«El Agente de Ventas (bot) puede enviar estos documentos»**
- Subir archivos PDF, JPG, PNG y Excel (.xlsx, .xls, .csv), de hasta 20 MB cada uno. Se pueden ver, descargar, renombrar, mover de categoría y eliminar. A cada archivo se le puede poner una descripción breve («cuándo usarlo»), que el bot usa para elegir qué enviar.

**Vendedor**
- La sección Documentos no aparece en su menú.
- En WhatsApp y en el redactor de Email aparece un botón **«Adjuntar documento»**. Muestra solo las categorías habilitadas para asesores, con búsqueda.
- Al elegir un archivo, en WhatsApp se envía como documento o imagen; en Email se agrega como adjunto.

**Agente de Ventas (bot)**
- Puede enviar por WhatsApp (y por chat web, como enlace) los documentos de las categorías habilitadas para el bot. Por ejemplo, cuando el lead pide el temario, el folleto o el plan de estudios.
- Solo envía un documento cuando la conversación lo justifica, como máximo uno por mensaje, y nunca inventa documentos que no existen.

**Para todos**
- Cada envío queda en la Actividad del lead: «Documento enviado: nombre (asesor o Agente IA)».
- En WhatsApp aplica la ventana de 24 h, igual que hoy.

## Reglas
- Cada tenant solo ve sus propias categorías y documentos.
- Los vendedores no pueden subir, editar, borrar ni ver categorías no habilitadas, ni siquiera conociendo el enlace.

## Detalles técnicos
- Tablas `document_categories` (tenant_id, name, advisor_can_attach, agent_can_send, position) y `documents` (tenant_id, category_id, name, description, storage_path, mime_type, size_bytes, uploaded_by), con GRANTs y RLS.
  - Escritura: miembros del tenant que no sean solo vendedores (`NOT is_rep_only`).
  - Lectura: esos mismos usuarios, o cualquier miembro si la categoría tiene `advisor_can_attach`.
- Bucket privado `tenant-documents` (límite de 20 MB), con rutas `{tenant_id}/{category_id}/{uuid}-{archivo}`. Políticas en storage.objects equivalentes a las de las tablas y validación de tipo MIME.
- `whatsapp-send` acepta `document_id`: valida la conversación y la categoría en el servidor, genera un enlace firmado de corta duración y lo envía como media. En el canal simulado se guarda como mensaje con adjunto.
- `email-api` acepta `document_ids` y adjunta los archivos leídos del bucket en el servidor.
- Agente: `_shared/sales-agent.ts` recibe la lista de documentos con `agent_can_send` (nombre y descripción) y una acción `send_document`, ejecutada por whatsapp-webhook y web-chat con un enlace firmado.
- Frontend: página `/documentos`, componente compartido `DocumentPicker` en el Composer de WhatsApp y en EmailComposer, y entradas en navItems y permisos.
- Registrar la decisión en AGENTS.md y la tarea en roadmap.md.
