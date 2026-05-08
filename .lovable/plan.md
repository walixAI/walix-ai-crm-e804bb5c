## Manual de Usuario Final — Walix CRM (PDF)

Generar un PDF profesional en español, ~30-40 páginas, listo para descargar desde `/mnt/documents/`.

### Alcance del contenido

1. Portada + índice
2. Introducción a Walix (qué es, para quién)
3. Primeros pasos (registro, login, onboarding, tour guiado)
4. Navegación general (Sidebar, TopBar, Command Palette, notificaciones)
5. Dashboard (KPIs, salud del pipeline, briefing matutino, tareas)
6. Contactos (lista, kanban, importar CSV, etiquetas, fuentes, etapas, detalle de contacto)
7. Oportunidades / Pipeline (kanban, lista, crear, mover, salud, motivos de pérdida, forecast)
8. WhatsApp (conversaciones, plantillas, vincular oportunidad, resumen IA)
9. Tareas (crear, completar, priorizar)
10. Automatizaciones (plantillas, builder, dry run, historial, límites de plan)
11. Reportes (embudo, vendedores, fuentes, conversiones, exportar)
12. IA Copilot (drawer, sugerencias, inbox IA, agentes, memoria)
13. Marketplace de módulos (activar, gestionar)
14. Organización y equipo (tenants, roles, invitaciones)
15. Perfil y seguridad (datos, contraseña, sesiones)
16. Glosario + soporte

Terminología: usar **"Oportunidad"** en vez de "Deal" (regla de proyecto).

### Implementación técnica

- **Generador**: Python + ReportLab (Platypus) en `/tmp/manual.py`.
- **Estilo**: portada con barra de marca color `#4F46E5` (igual al export de Reportes), tipografía Helvetica, secciones con encabezado de barra lateral, tablas con header indigo, callouts ("Tip", "Importante") como tablas con shading suave, footer con paginación.
- **Estructura**: `SimpleDocTemplate` A4, márgenes 2cm, TOC automático con `TableOfContents`, `PageBreak` entre capítulos, `KeepTogether` para callouts.
- **Sin capturas reales** (no hay forma de renderizar la app en headless aquí); usar diagramas de flujo simples dibujados en Canvas/Drawing y wireframes ASCII-art renderizados como bloques `Preformatted` con shading para ilustrar pantallas clave (Dashboard, Pipeline, Inbox WhatsApp).
- **Validación**: ejecutar `pdftoppm -r 100 manual.pdf qa` y revisar visualmente todas las páginas en busca de overflow, texto cortado, tablas mal alineadas o cajas negras. Iterar hasta que pase.
- **Salida**: `/mnt/documents/Manual_Usuario_Walix_CRM.pdf` + tag `<lov-artifact>`.

### Entregable

PDF descargable de ~30-40 páginas, en español, con índice navegable, cubriendo los 10 módulos funcionales actuales del producto.
