---
name: terminology-deal-oportunidad
description: El usuario llama "Oportunidad" a los deals. Internamente la tabla sigue siendo `deals`.
type: preference
---
En toda la UI y en los mensajes de la IA visibles al usuario, "deal" se debe llamar "Oportunidad" (plural "Oportunidades").

No renombrar: tabla `deals`, columnas (`deal_id`, `stage_id`), nombres de tools de IA (`propose_update_deal_stage`, etc.), tokens de citation `[deal:UUID|Nombre]`. Son contratos internos.

**Why:** El usuario lo solicitó explícitamente y prefiere terminología en español de negocios.
**How to apply:** Al editar prompts de system, descripciones de tools visibles, labels UI, EmptyStates, banners y toasts.