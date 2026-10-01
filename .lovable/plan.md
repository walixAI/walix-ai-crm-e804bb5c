# PDF de paquetes y créditos de Walix

## Objetivo
Entregar un PDF descargable con los paquetes de Walix ya definidos, para compartir o imprimir.

## Contenido del documento (1-2 páginas, estilo azul Walix, en español)
- **Planes mensuales** (tabla comparativa):
  - PyME: $899/mes ($719 anual), 5 usuarios, 2 pipelines, 100 créditos WA, 1,000 créditos IA, motor Walix IA · Estándar
  - Growth: $1,499/mes ($1,199 anual), 15 usuarios, 5 pipelines, 150 WA, 4,000 IA, Walix IA · Avanzado
  - Enterprise: $2,500/mes ($2,000 anual), usuarios y pipelines ilimitados, 250 WA, 10,000 IA, Walix IA · Premium
- **Cómo funcionan los créditos**: crédito WA = 1 plantilla fuera de la ventana de 24 h; crédito IA = 1 acción del Copiloto/agente × factor del motor; saldos se reinician el día 1 de cada mes; prueba de 14 días, sin plan gratuito.
- **Paquetes adicionales de WhatsApp**: 100/$249, 300/$649, 600/$1,149, 1,000/$1,749 (con precio por mensaje).
- **Paquetes adicionales de IA**: 5,000/$299, 15,000/$749, 30,000/$1,299, 50,000/$1,899 (con precio por 1,000 créditos).
- Nota al pie: precios sujetos a cambio; los cargos de Meta por plantillas son adicionales y los factura Meta.

## Estado
- Ya se generó una primera versión en `/mnt/documents/Walix-Paquetes-y-Creditos.pdf`.
- Problema encontrado en la revisión visual: la tabla de paquetes de IA se corta entre la página 1 y la 2.

## Pasos restantes
1. Ajustar el script de generación (`/tmp/walixpdf/make.py`): repetir encabezados de tabla, reducir márgenes y espaciado para que la tabla de IA no se divida.
2. Regenerar el PDF y volver a revisar visualmente todas las páginas.
3. Entregar el archivo final como descarga.

## Detalles técnicos
- Generación con reportlab (Python), fuente DejaVu Sans registrada para acentos.
- Datos tomados de `src/lib/plans.ts` (PLAN_PRICING, WHATSAPP_PACKS, AI_PACKS) — fuente única de verdad.
- Sin cambios en el código de la app; solo se genera un documento en Files.
