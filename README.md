# Vibing Lights Studio · demo de IGNIS

Landing de demostración que IGNIS (estudio web) arma para **Vibing Lights Studio** (@vibinglightsec, Quito).
Usa las fotos y los precios del catálogo PDF de Vibing Lights. **No es la tienda oficial**, no procesa pagos y no tiene stock, descuentos ni reseñas.

Qué incluye:

- Intro "lights on" (saltable), hero cinético y marquee con las 7 lámparas.
- Sección pinneada "Así cambia tu cuarto" (scroll-driven).
- **Visor 3D "Prueba la luz"** (Three.js, carga diferida): cuarto low-poly con las lámparas Sunset y Aura, interruptor on/off, slider de ángulo y órbita limitada. Si el dispositivo no tiene WebGL se muestra la foto de la lámpara; con "reducir movimiento" no hay animaciones automáticas.
- Mini selector de vibe, catálogo de 7 lámparas con variantes exactas del PDF y carrito.
- Pedido por WhatsApp (el mensaje se arma con ítems, variantes y total).

## Cómo correrlo

```bash
npm install
npm run dev        # desarrollo
npm run build      # genera dist/
npm run preview    # sirve dist/ en http://127.0.0.1:4173
```

## Dónde poner el número de WhatsApp

Edita **`src/config.js`**:

```js
export const WHATSAPP_NUMBER = ''; // ej. '5939XXXXXXXX' (código de país + número, solo dígitos)
```

Mientras esté vacío, el botón "Enviar por WhatsApp" **copia el mensaje** al portapapeles y muestra un aviso que explica que en la versión real se abre el WhatsApp de la tienda. Con un número, abre `wa.me` con el pedido listo.

## Fotos del catálogo

Las imágenes optimizadas (WebP, sin el texto de nombre/precio que viene quemado en el PDF) ya están en `public/img/`. Para regenerarlas desde el PDF:

```bash
npm run assets -- /ruta/al/catalogo.pdf   # requiere pdfimages (poppler-utils)
```

## Prueba E2E

Con Playwright instalado globalmente (Chromium incluido):

```bash
npm run build
NODE_PATH=$(npm root -g) npm run test:e2e
```

Toma capturas a 390x844 y 1280x800, recorre el flujo (visor, tabs, interruptor, slider, agregar, carrito, mensaje de WhatsApp) y falla si hay errores de consola.

## Notas

- Se publica en GitHub Pages con `.github/workflows/pages.yml` en cada push a `main`. El HTML lleva `<meta name="robots" content="noindex,nofollow">` y `robots.txt` bloquea indexación.
- Este repo no se despliega automáticamente.
- Stack: Vite, JavaScript vanilla, three, gsap (ScrollTrigger) y lenis, con versiones exactas en `package.json`.
