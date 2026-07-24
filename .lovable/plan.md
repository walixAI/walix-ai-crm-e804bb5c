## Flujo del "Copilot Builder" — crear capacidades por prompt

El admin abre **Configuración → Copiloto → botón "+ Nueva capacidad"**. Se despliega un chat lateral con Walix Builder (un asistente separado, con permisos solo de leer el catálogo y escribir en `copilot_capabilities`). No es el mismo Copiloto que usan los vendedores.

### Ejemplo real completo — paso a paso

**Admin escribe:**
> "Quiero que cuando le pida al Copiloto 'registra la venta de un refri X a Juan', me cree el deal como ganado, agregue una nota con el modelo y me programe una tarea de instalación en 3 días."

**Walix Builder responde con un análisis visual:**

```
Voy a componer esta capacidad con 3 acciones que ya tengo:

┌─ Paso 1 ─────────────────────────────────
│ Crear deal (create_deal)
│   • Contacto: el que menciones ("Juan")
│   • Monto: el que digas
│   • Estado: Ganado
├─ Paso 2 ─────────────────────────────────
│ Agregar nota (add_note)
│   • Contenido: el modelo del refri
│   • Vinculada al deal recién creado
├─ Paso 3 ─────────────────────────────────
│ Crear tarea (create_task)
│   • Título: "Instalación de <modelo>"
│   • Fecha: hoy + 3 días
│   • Asignada al mismo vendedor
└──────────────────────────────────────────

¿Está bien así o quieres ajustar algún paso?
```

**Admin:** "Sí, y agrega que también mande el mensaje de agradecimiento por WhatsApp."

**Walix:** "Perfecto, agrego un paso 4 con `prepare_whatsapp_message` — un borrador de agradecimiento personalizado. ¿Envío el mensaje automático o solo dejo el borrador para que el vendedor lo revise antes?"

**Admin:** "Solo el borrador."

Walix ajusta el diagrama y pasa a las preguntas de seguridad.

### Preguntas de seguridad guiadas (una por una)

Walix las hace conversacionalmente, no como un formulario:

1. **"¿Quién puede usar esta capacidad?"**  
   Opciones-chips: Todos / Solo vendedores / Solo gerentes / Escoger usuarios específicos.

2. **"¿Desde dónde? ¿La app o también WhatsApp?"**  
   Web / WhatsApp / Ambos.

3. **"¿Quieres que el Copiloto pida confirmación antes de ejecutar?"**  
   Recomendado sí para escrituras. Walix sugiere el default según el riesgo detectado.

4. **"¿Algún límite de uso?"**  
   Sin límite / Máximo N veces por día por usuario.

5. **"¿Nombre corto para esta capacidad?"**  
   Sugerencia autogenerada: "Registrar venta con instalación". El admin puede editarlo.

6. **"Dame 2-3 frases de ejemplo con las que un vendedor la dispararía."**  
   Se usan para reforzar el system prompt y para mostrar en la lista de "cómo se usa".

### Preview y prueba antes de activar

Después de las preguntas, Walix muestra:

```
Resumen de la nueva capacidad
─────────────────────────────
Nombre: Registrar venta con instalación
Acciones: 4 pasos encadenados
Quién puede: Vendedores y Gerentes
Canal: Web + WhatsApp
Confirmación: Sí, antes de ejecutar
Límite: Sin límite
Frases de disparo:
  • "registra la venta de X a Y"
  • "cerré venta de un refri X con Y"
  • "vendí un refri modelo Z a Y"

[ Probar ahora (dry run) ]   [ Activar ]   [ Guardar borrador ]
```

**"Probar ahora"** ejecuta la receta en modo simulación contra datos reales, pero **sin persistir nada**: muestra el deal que se hubiera creado, la nota, la tarea y el borrador de WhatsApp. El admin ve el resultado real antes de activar.

Si algo no le gusta, dice: *"Cambia el paso 3, mejor a 5 días"* → Walix ajusta y vuelve a mostrar el preview.

### Casos donde Walix pide más info

- **Ambigüedad:** *"Cuando digo 'cliente', ¿te refieres al contacto ya existente o creo uno nuevo si no lo encuentra?"*
- **Riesgo detectado:** *"Esta capacidad puede cerrar deals ganados. Recomiendo activar confirmación. ¿Confirmas?"*
- **Primitiva faltante:** *"'Enviar factura CFDI' no está en mis acciones. ¿Quieres que registre esto como solicitud para que el equipo lo agregue, y sigo con el resto de los pasos?"*
- **Alcance de datos:** *"¿Esta capacidad debe poder mover deals de otros vendedores, o solo los propios del usuario?"*

### Casos donde Walix rechaza y explica

- **Cadena muy larga:** *"Esta receta tendría 8 pasos encadenados. Por seguridad limito a 5. ¿Quieres partirla en dos capacidades separadas?"*
- **Acción destructiva:** *"'Eliminar contactos masivamente' es de alto riesgo y no está disponible para configuración por chat. Regístralo como solicitud."*
- **Fuera del negocio:** *"Esto no parece relacionado con tu operación de CRM. ¿Puedes darme más contexto?"*

### Qué pasa técnicamente al presionar "Activar"

1. Se inserta una fila en `copilot_capabilities` con:
   - `kind = 'recipe'`
   - `recipe_json` = definición JSON de los 4 pasos.
   - `scope_type`, `scope_ids`, `channels`, `require_confirmation`, `daily_limit`.
   - `trigger_phrases[]` para reforzar el prompt.
2. Se refresca el catálogo del tenant → aparece inmediatamente en la lista principal.
3. La próxima vez que un vendedor autorizado chatee con el Copiloto, esa receta ya está en las tools disponibles y el modelo la puede llamar.
4. Cada ejecución de la receta queda registrada paso por paso en `copilot_action_log`.

### Editar, duplicar, desactivar

Desde la lista principal, cada capacidad (nativa o receta) tiene menú `⋯`:
- **Editar** → reabre el chat del Builder con el contexto cargado.
- **Duplicar** → crea una copia con otro nombre para adaptar.
- **Desactivar temporalmente** → sin borrarla.
- **Ver historial de uso** → cuándo se usó, quién, resultados.
- **Eliminar** → solo si nadie la ha usado en 30 días, o con confirmación fuerte.

### Estructura técnica

**Edge function nueva:** `copilot-builder`
- System prompt separado: "Eres el arquitecto de capacidades del Copiloto. Solo compones recetas a partir del catálogo de primitivas. No ejecutas acciones del CRM."
- Tools propias: `list_available_primitives`, `validate_recipe`, `save_capability`, `run_dry_run`.
- Usa el mismo AI Gateway que el resto (`google/gemini-3.6-flash`).

**Componente frontend nuevo:** `src/pages/app/settings/copilot/NewCapabilityChat.tsx`
- Chat con AI Elements (`Conversation`, `Message`, `PromptInput`, `Tool` para mostrar la receta compuesta).
- Preview interactivo que renderiza el JSON de la receta como diagrama de pasos.
- Botones "Probar" y "Activar" fuera del composer.

**Motor de ejecución:** en `ai-copilot/index.ts`, si la tool llamada tiene `kind='recipe'`, se corre el orquestador de pasos: valida permisos por paso, ejecuta secuencialmente, corta al primer error, devuelve al modelo un resumen consolidado. Soporta `dry_run=true` para el modo prueba.

### Fuera de alcance de este plan

- Editor visual drag-and-drop (por ahora solo chat).
- Recetas condicionales (`si X entonces Y sino Z`) — solo secuenciales.
- Recetas que llamen a otras recetas (anidamiento) — por seguridad.
- Marketplace de recetas entre tenants.

## Verificación

1. Admin crea la receta "Registrar venta con instalación" por chat → responde 6 preguntas → prueba en dry run → activa.
2. Vendedor autorizado dice "cerré venta de Sub-Zero 36 a Luis por 85000" → Copiloto pide confirmación con el preview → vendedor dice "sí" → se crean deal, nota, tarea y borrador de WhatsApp en cadena.
3. Otro vendedor sin permisos intenta lo mismo → bloqueado con mensaje claro.
4. Admin edita la receta desde el menú `⋯` → cambia el plazo de la tarea → guarda → siguiente ejecución usa el nuevo valor.
5. Admin pide "integrar con QuickBooks" → Walix Builder detecta primitiva faltante, guarda como solicitud, aparece en el panel "Solicitudes pendientes".
6. Auditar `copilot_action_log`: cada paso de la receta queda registrado.
