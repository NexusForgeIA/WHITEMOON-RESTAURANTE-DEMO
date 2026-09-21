# WHITEMOON-RESTAURANTE-DEMO

Demo visual de **reservas de restaurante con IA + panel del dueño en el móvil**.
Pensada para enseñar en hostelería. Solo frontend: HTML/CSS/JS puro, sin frameworks,
sin backend y con datos de mentira.

## Páginas

| Página | Qué es |
|---|---|
| `index.html` | Web del restaurante (comensal) con el widget de chat de reservas abajo a la derecha. |
| `reserva.html` | Página de reserva suelta: solo el chat, a pantalla completa. Es lo que abre el QR. |
| `panel.html` | Panel del dueño, mobile-first: reservas del día por turnos + mesas + cuadro de mando, generador de mensaje para el cliente y su enlace de reservas con QR, descargable en PNG y como cartel imprimible. |

## Qué es de mentira

- **Restaurante La Brasa** es un negocio ficticio. Dirección, teléfono, carta y
  reservas son datos de ejemplo. Ambas páginas van con `noindex`.
- El chat **no lleva IA**: es un guion fijo en `assets/js/chat.js`. No hay llamadas
  de red, ni Supabase, ni edge functions, ni tokens.
- El panel guarda el estado en variables JS. Al recargar vuelven los datos demo.
  No se usa `localStorage`.
- Los teléfonos (`600 00 00 0X`) y los correos (`@example.com`) de las reservas
  son inventados. El generador de mensaje no envía nada: copia el texto o abre
  wa.me / el cliente de correo para que decida el encargado.
- La carta no lleva precios.

## Estructura

```
index.html
reserva.html
panel.html
assets/
  css/base.css     tokens compartidos (color, tipografía, espaciado, motion)
  css/site.css     web del comensal + widget de chat + página de reserva
  css/panel.css    panel del dueño
  js/chat.js       conversación guionizada de reserva (widget y página)
  js/panel.js      estado en memoria, cuadro de mando, reservas y mesas
  js/qr.js         generador de QR propio, sin dependencias
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

Dark premium WhiteMoon (`--bg: #08080d`) con acento de brasa (`--ember: #ffab2e`),
tipografía Sora y sin fotos de stock. Responsive; el panel está pensado primero
para móvil, con barra de pestañas inferior.

## Ver en local

Cualquier servidor estático vale, o abrir los ficheros directamente en el navegador:

```bash
python -m http.server 8000
```

## Publicado

GitHub Pages desde la rama `main`.

---

Demo de [WhiteMoon Agencia IA](https://whitemoon.es).
