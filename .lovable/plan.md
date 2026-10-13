# Módulo «Documentos» para todos los tenants

## Qué verá cada usuario

**Propietario / Admin del tenant**
- Nueva sección **Documentos** en el menú lateral.
- Crear, renombrar y eliminar **Categorías** (carpetas).
- En cada categoría, un interruptor: **«Los asesores pueden adjuntar estos documentos en WhatsApp y Email»** (apagado por defecto).
- Subir archivos PDF, JPG, PNG y Excel (.xlsx, .xls, .csv), de hasta 20 MB cada uno. Se pueden ver, descargar, renombrar, mover de categoría y eliminar.

**Vendedor / Asesor**
- En el menú no aparece la administración de Documentos.
- En WhatsApp y en el redactor de Email aparece un botón **«Adjuntar documento»**. Abre una lista con solo las categorías habilitadas y sus archivos, con búsqueda.
- Al elegir un archivo:
  - en WhatsApp se envía como documento o imagen al contacto;
  - en Email se agrega como adjunto.
- El envío queda en la Actividad del lead: «Documento enviado: nombre (asesor)».

## Reglas
- Cada tenant solo ve sus propias categorías y documentos.
- Solo el propietario o un admin pueden subir archivos, editar y decidir qué categorías usan los asesores.
- El asesor no puede subir, borrar ni ver categorías no habilitadas, ni siquiera conociendo el enlace.
- En WhatsApp aplica la ventana de 24 h: si está cerrada, primero hay que enviar una plantilla, igual que hoy.

## Detalles técnicos
- Tablas `document_categories` (tenant_id, name, advisor_can_attach, position) y `documents` (tenant_id, category_id, name, storage_path, mime_type, size_bytes, uploaded_by). Ambas con GRANTs y RLS: escritura solo para tenant_owner/tenant_admin vía `has_tenant_role`. La lectura es para admin/propietario, o para cualquier miembro si la categoría tiene `advisor_can_attach`.
- Bucket privado `tenant-documents`, con rutas `{tenant_id}/{category_id}/{uuid}-{archivo}`. Políticas en storage.objects que reflejan las de la tabla. Validación de tipo MIME y de tamaño.
- Envío por WhatsApp: `whatsapp-send` acepta `document_id`. Valida en el servidor el permiso del asesor sobre la conversación y la categoría, genera un enlace firmado de corta duración y lo envía como media (document/image). En el canal simulado se guarda como mensaje con adjunto.
- Email: `email-api` acepta `document_ids`, valida el permiso y adjunta el archivo leído del bucket en el servidor.
- Frontend: página `/documentos` (solo admin/propietario), componente compartido `DocumentPicker` usado en Composer de WhatsApp y en EmailComposer, y una entrada en navItems y permisos.
- Registrar la decisión de arquitectura en AGENTS.md.

## Puntos a confirmar (si no dices nada, uso lo indicado)
1. ¿El Agente de Ventas (bot) también podrá enviar estos documentos? Propuesta: no por ahora.
2. ¿Límite de 20 MB por archivo? (WhatsApp acepta hasta 100 MB en documentos y 5 MB en imágenes.)
3. ¿El gerente de ventas cuenta como «admin» para administrar Documentos? Propuesta: no; solo propietario y admin.
