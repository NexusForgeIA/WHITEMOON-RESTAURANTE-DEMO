/* ==========================================================================
   La Brasa · chat de reservas

   Conversación libre contra el agente de IA (edge function restaurante-chat).
   El front solo conversa: preguntar lo que falta, mirar el aforo y crear la
   reserva lo hace el backend. Aquí ya no hay guion ni pasos.
   ========================================================================== */

(function () {
  'use strict';

  var fab     = document.getElementById('chatFab');
  var panel   = document.getElementById('chat');
  var log     = document.getElementById('chatLog');
  var chips   = document.getElementById('chatChips');
  var form    = document.getElementById('chatForm');
  var input   = document.getElementById('chatInput');
  var closeBt = document.getElementById('chatClose');

  if (!panel || !log) return;

  /* En reserva.html el chat ES la página: ni botón flotante ni cerrar */
  var modoPagina = panel.getAttribute('data-modo') === 'pagina';

  var API    = 'https://mlaqtniujnvfxcvcourm.supabase.co/functions/v1/restaurante-chat';
  var TOKEN  = 'demo-restaurante';
  var ESPERA = 45000;          /* el agente se toma su tiempo en contestar */

  var SALUDO = 'Buenas, soy el asistente de La Brasa. Dime qué día quieres ' +
               'venir y para cuántos, y te busco mesa.';

  var DIAS  = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
               'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* La conversación entera: es lo que se le manda al agente en cada turno */
  var messages = [];
  var enviando = false;
  var ultimoEnvio = '';

  /* --- utilidades ------------------------------------------------------- */

  function el(tag, clase, texto) {
    var n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto !== undefined && texto !== null) n.textContent = texto;
    return n;
  }

  function scrollLog() {
    log.scrollTop = log.scrollHeight;
  }

  /* El agente contesta en markdown ligero: **esto** se pone en negrita y los
     saltos de línea los respeta el CSS. Nada de innerHTML con texto de fuera. */
  function conNegritas(nodo, texto) {
    String(texto).split(/\*\*(.+?)\*\*/g).forEach(function (trozo, i) {
      if (!trozo) return;
      if (i % 2 === 1) nodo.appendChild(el('strong', null, trozo));
      else nodo.appendChild(document.createTextNode(trozo));
    });
  }

  function burbuja(texto, quien) {
    var p = el('p', 'msg msg--' + quien);
    conNegritas(p, texto);
    log.appendChild(p);
    scrollLog();
    return p;
  }

  function escribiendo() {
    var d = el('div', 'typing');
    d.setAttribute('aria-hidden', 'true');
    d.innerHTML = '<span></span><span></span><span></span>';
    log.appendChild(d);
    scrollLog();
    return d;
  }

  /* Mensaje del propio front (saludo, avisos), con su pausa corta */
  function local(texto, despues) {
    var t = escribiendo();

    setTimeout(function () {
      t.remove();
      burbuja(texto, 'bot');
      if (despues) despues();
    }, reducedMotion ? 80 : 420);
  }

  function vaciarPie() {
    chips.innerHTML = '';
  }

  function pintarChips(opciones) {
    vaciarPie();

    opciones.forEach(function (op) {
      var b = el('button', 'chip', op.texto);
      b.type = 'button';
      b.addEventListener('click', function () {
        vaciarPie();
        op.accion();
      });
      chips.appendChild(b);
    });

    scrollLog();
  }

  /* --- tarjeta de reserva ---------------------------------------------------
     El texto de la confirmación lo escribe el agente; esta tarjeta solo ordena
     los datos que vienen con él.
     -------------------------------------------------------------------- */

  function fechaBonita(iso) {
    var trozos = String(iso).split('-');
    if (trozos.length !== 3) return iso;

    var d = new Date(Number(trozos[0]), Number(trozos[1]) - 1, Number(trozos[2]));
    if (isNaN(d.getTime())) return iso;

    return DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()];
  }

  function tarjetaReserva(r) {
    var card = el('div', 'msg msg--bot msg--card');
    card.appendChild(el('b', null, 'Reserva registrada · La Brasa'));

    var dl = el('dl');

    function fila(etiqueta, valor) {
      if (!valor && valor !== 0) return;
      dl.appendChild(el('dt', null, etiqueta));
      dl.appendChild(el('dd', null, valor));
    }

    fila('Día', r.fecha ? fechaBonita(r.fecha) : '');
    fila('Turno', [r.turno, r.hora].filter(Boolean).join(' · '));
    fila('Personas', r.personas ? r.personas + (r.personas === 1 ? ' persona' : ' personas') : '');
    fila('A nombre de', r.nombre);
    fila('Teléfono', r.telefono);

    card.appendChild(dl);
    log.appendChild(card);
    scrollLog();
  }

  /* --- conversación con el agente ------------------------------------------- */

  function hablar() {
    return new Promise(function (resolve) {
      var contestado = false;

      var responder = function (datos) {
        if (contestado) return;
        contestado = true;
        resolve(datos);
      };

      var reloj = setTimeout(function () { responder({ error: 'tardanza' }); }, ESPERA);

      fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: TOKEN, messages: messages })
      })
        .then(function (r) {
          if (!r.ok) return { error: 'http_' + r.status };
          return r.json().catch(function () { return { error: 'respuesta_ilegible' }; });
        })
        .then(function (datos) { clearTimeout(reloj); responder(datos); })
        .catch(function () { clearTimeout(reloj); responder({ error: 'sin_red' }); });
    });
  }

  /* repetir = se reintenta lo último: ni se repinta la burbuja ni se duplica */
  function enviar(texto, repetir) {
    if (enviando) return;

    enviando = true;
    ultimoEnvio = texto;
    vaciarPie();

    if (!repetir) burbuja(texto, 'user');
    messages.push({ role: 'user', content: texto });

    var t = escribiendo();

    hablar().then(function (res) {
      t.remove();
      enviando = false;

      if (!res || res.error || typeof res.text !== 'string') {
        noHaPodido();
        return;
      }

      messages.push({ role: 'assistant', content: res.text });
      burbuja(res.text, 'bot');

      if (res.reserva) tarjetaReserva(res.reserva);
      if (!reducedMotion) input.focus();
    });
  }

  /* Se cae la red o el agente: se dice claro y se deja reintentar lo último */
  function noHaPodido() {
    /* Ese turno del usuario no llegó a contestarse: fuera del historial, que
       si no el agente lo daría por respondido al reintentar */
    if (messages.length && messages[messages.length - 1].role === 'user') messages.pop();

    local('Ahora mismo no puedo, inténtalo en un momento.', function () {
      pintarChips([
        { texto: 'Reintentar', accion: function () { enviar(ultimoEnvio, true); } }
      ]);
    });
  }

  /* --- arranque de la conversación ------------------------------------------ */

  function arrancar() {
    messages = [];
    log.innerHTML = '';
    vaciarPie();

    form.hidden = false;
    input.value = '';

    /* El saludo lo pone el front: el agente necesita al menos un mensaje */
    messages.push({ role: 'assistant', content: SALUDO });
    local(SALUDO);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var texto = input.value.trim();
    if (!texto || enviando) return;

    input.value = '';
    enviar(texto);
  });

  /* --- abrir / cerrar --------------------------------------------------- */

  function abrir() {
    panel.hidden = false;
    fab.hidden = true;
    requestAnimationFrame(function () { panel.classList.add('is-open'); });
    if (log.children.length === 0) arrancar();
    closeBt.focus();
    document.addEventListener('keydown', escuchaEsc);
  }

  function cerrar() {
    panel.classList.remove('is-open');
    document.removeEventListener('keydown', escuchaEsc);

    var ocultar = function () {
      panel.hidden = true;
      fab.hidden = false;
      fab.focus();
    };

    if (reducedMotion) ocultar();
    else setTimeout(ocultar, 200);
  }

  function escuchaEsc(e) {
    if (e.key === 'Escape') { e.preventDefault(); cerrar(); }
  }

  if (modoPagina) {
    panel.hidden = false;
    panel.classList.add('is-open');
    arrancar();
  } else {
    Array.prototype.forEach.call(document.querySelectorAll('[data-open-chat]'), function (b) {
      b.addEventListener('click', abrir);
    });
    closeBt.addEventListener('click', cerrar);
  }
})();
