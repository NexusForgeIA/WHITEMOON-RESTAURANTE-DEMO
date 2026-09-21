# WHITEMOON-RESTAURANTE-DEMO

Demo visual de **reservas de restaurante con IA + panel del dueño en el móvil**.
Pensada para enseñar en hostelería. Solo frontend: HTML/CSS/JS puro, sin frameworks,
sin backend y con datos de mentira.

## Páginas

| Página | Qué es |
|---|---|
| `index.html` | Web del restaurante (comensal) con el widget de chat de reservas abajo a la derecha. |
| `panel.html` | Panel del dueño, mobile-first: reservas del día por turnos + mesas + cuadro de mando. |

## Qué es de mentira

- **Restaurante La Brasa** es un negocio ficticio. Dirección, teléfono, carta y
  reservas son datos de ejemplo. Ambas páginas van con `noindex`.
- El chat **no lleva IA**: es un guion fijo en `assets/js/chat.js`. No hay llamadas
  de red, ni Supabase, ni edge functions, ni tokens.
- El panel guarda el estado en variables JS. Al recargar vuelven los datos demo.
  No se usa `localStorage`.
- La carta no lleva precios.

## Estructura

```
index.html
panel.html
assets/
  css/base.css     tokens compartidos (color, tipografía, espaciado, motion)
  css/site.css     web del comensal + widget de chat
  css/panel.css    panel del dueño
  js/chat.js       conversación guionizada de reserva
  js/panel.js      estado en memoria, cuadro de mando, reservas y mesas
```

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
