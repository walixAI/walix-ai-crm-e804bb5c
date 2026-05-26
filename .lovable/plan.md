## Plan: Crear favicon para Walix.ai

Generar un favicon a juego con el logo actual (gradiente índigo→cian con el ícono Sparkles) y conectarlo en `index.html`.

### Pasos

1. **Generar el ícono** con `imagegen--generate_image` (premium, fondo transparente, 512×512):
   - Prompt: cuadrado redondeado con gradiente diagonal de índigo (`#5b6cf7`) a cian (`#0bc7e0`), un símbolo Sparkles blanco centrado, estilo limpio tipo app icon, sin texto.
   - Output: `public/favicon.png`

2. **Eliminar `public/favicon.ico`** para evitar que el navegador lo sirva por defecto sobre el nuevo PNG.

3. **Actualizar `index.html`**:
   - Reemplazar `<link rel="icon" type="image/x-icon" href="/favicon.ico">` por:
     ```html
     <link rel="icon" type="image/png" href="/favicon.png" />
     <link rel="apple-touch-icon" href="/favicon.png" />
     ```

### Notas
- Si prefieres usar tu propio logo en lugar del generado, súbelo y lo uso tal cual.
- El favicon nuevo se verá en `s1.walix.app` tras republicar.
