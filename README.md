# WHITEMOON-RESTAURANTE-DEMO

Demo visual de **reservas de restaurante + panel del dueño en el móvil**.
Pensada para enseñar en hostelería. Solo frontend: HTML/CSS/JS puro, sin frameworks,
sin backend y con datos de mentira.

## Páginas

| Página | Qué es |
|---|---|
| `index.html` | Web del restaurante (comensal) con el widget de chat de reservas abajo a la derecha. |
| `reserva.html` | Página de reserva suelta: solo el chat, a pantalla completa. Es lo que abre el QR. |
| `panel.html` | No se enlaza desde la web pública: se abre por URL directa y va con `noindex`. Panel del dueño, mobile-first: reservas del día por turnos + mesas + cuadro de mando, generador de mensaje para el cliente y su enlace de reservas con QR, descargable en PNG y como cartel imprimible. |

## Qué es de mentira

- **Restaurante WhiteMoon** es un negocio ficticio. Dirección, teléfono, carta y
  reservas son datos de ejemplo. Ambas páginas van con `noindex`.
- El chat **no conversa ni lleva IA**: `assets/js/chat.js` es un reservador
  guiado por pasos (día, turno, hora, zona, personas y datos). Solo se escriben
  el nombre y el teléfono. Al confirmar llama a `crear_reserva` de la edge
  function `reservas-mt`, así que la reserva se guarda de verdad.
- El panel ya no inventa nada: lee y escribe contra la edge function
  `reservas-mt` (reservas, mesas y configuración del tenant `demo-restaurante`).
  Pide una clave al entrar, que se guarda en `sessionStorage`; en la demo es
  `demo`. En un cliente real eso sería login de Supabase Auth en dominio propio.
- El generador de mensaje no envía nada por su cuenta: copia el texto o abre
  wa.me / el cliente de correo para que decida el encargado.
- La carta no lleva precios.
- Aforo: cada turno tiene su tope de comensales. Si una zona de `reservas_config.zonas`
  es un objeto con `aforo` > 0 (`{"nombre":"Barra","aforo":8}`), además tiene tope
  propio por turno; en texto (`"Barra"`) o sin aforo, solo cuenta el del turno.

## Estructura

```
index.html
reserva.html
panel.html
assets/
  css/base.css     tokens compartidos (tipografía, espaciado, motion) y la
                   paleta oscura del panel
  css/site.css     web del comensal + widget de chat + página de reserva.
                   Redefine en :root los tokens de color (brasa) y las esquinas
  css/panel.css    panel del dueño
  img/             fotos de ambiente (WebP + JPG) y la og:image
  js/chat.js       conversación guionizada de reserva (widget y página)
  js/panel.js      estado en memoria, cuadro de mando, reservas y mesas
  js/qr.js         generador de QR propio, sin dependencias
  js/site.js       solo presentación: flechas de carrusel y entrada al hacer scroll
supabase/
  functions/reservas-mt/index.ts   edge function multi-tenant de reservas (todas las
                                   sedes). Se despliega a mano, no desde Pages
  sql/                             cambios de config pendientes de aplicar
```

`reserva.html` reutiliza `chat.js`: el mismo guion y el mismo calendario que el
widget del index, pero con `data-modo="pagina"` en el contenedor, que arranca la
conversación sola y quita el botón flotante y el de cerrar.

`qr.js` es un codificador de QR mínimo escrito para la demo (modo byte, nivel de
corrección M, versiones 1 a 6). No usa CDN: el QR se pinta aunque el móvil no
tenga cobertura.

El PNG se rasteriza en el navegador a 1024 px y el cartel imprimible es una
sección oculta que solo aparece en `@media print`; el PDF lo hace el propio
navegador con «Guardar como PDF». Los dos salen en negro sobre blanco, que es
lo que los lectores de QR leen sin quejarse.

## Diseño

Web pública (`index.html`, `reserva.html`) con maqueta editorial de asador:
hero a sangre, titulares grandes en serif display, secciones amplias con foto
grande y carruseles, esquinas casi rectas (≤ 4px) y mucho aire.

- **Paleta brasa**, en el `:root` de `site.css`: fondo `#08080d`, capas `#0e0e16`
  y `#111118`, ámbar `#ffab2e` para CTA y acentos, ascua `#d9531e` solo para
  detalles (líneas, puntos), texto `#f0f0f5` y secundario `#8888a0`. `site.css`
  reapunta los tokens de `base.css`, así que el panel no cambia.
- **Tipografía**: Fraunces (display, 300/600 e itálica) para titulares y Sora
  para el cuerpo, autohospedadas en `assets/fonts/` (woff2 variables, latin y
  latin-ext) con `font-display: swap`; la home precarga las tres de latin.
- **Panel** (`panel.html`): sigue con su propio look oscuro; no carga `site.css`.

Todo el texto cumple AA sobre sus fondos (el mínimo es el gris secundario sobre
la tarjeta del chat: 4,98:1). El ascua no se usa como color de texto.

Las fotos son de [Unsplash](https://unsplash.com) (licencia libre, sin
personas), autoalojadas en `assets/img/` en WebP con respaldo JPG vía
`<picture>`, y con una variante pequeña (`-600`, el hero `-900`) vía
`srcset`/`sizes` para móvil. Llevan `width`/`height` y `aspect-ratio` para que no
haya saltos de maquetación. La `og:image` es un JPG de 1200×630.

Responsive probado a 900, 600 y 375 px sin scroll horizontal. El reservador
(`chat.js`) no cambia: solo su CSS.

## Ver en local

Cualquier servidor estático vale, o abrir los ficheros directamente en el navegador:

```bash
python -m http.server 8000
```

## Publicado

GitHub Pages desde la rama `main`.

---

Demo de [WhiteMoon Agencia IA](https://whitemoon.es).
