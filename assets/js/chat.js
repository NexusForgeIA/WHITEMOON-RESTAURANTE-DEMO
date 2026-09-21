/* ==========================================================================
   La Brasa · widget de reservas (DEMO)
   Conversación guionizada en JS. No hay IA real, ni red, ni backend:
   las respuestas son fijas y el estado vive en memoria.
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

  var DIAS  = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var DOWS  = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];   /* el calendario empieza en lunes */
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
               'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  var CERRADO = 1;   /* getDay() del lunes: el restaurante descansa */

  /* Backend real: la reserva se guarda de verdad. El guion sigue siendo fijo. */
  var API   = 'https://mlaqtniujnvfxcvcourm.supabase.co/functions/v1/reservas-mt';
  var TOKEN = 'demo-restaurante';
  var ESPERA = 12000;

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Estado de la reserva en curso — en memoria, se pierde al recargar */
  function reservaVacia() {
    return {
      dia: '', fechaIso: '',        /* la de texto es para leer; la ISO, para el backend */
      personas: '', numPersonas: 0,
      turno: '', turnoClave: '', hora: '',
      nombre: '', telefono: ''
    };
  }

  var reserva = reservaVacia();
  var paso = 0;
  var timers = [];

  /* --- utilidades ------------------------------------------------------- */

  function claveIso(d) {
    var mes = d.getMonth() + 1;
    var dia = d.getDate();
    return d.getFullYear() + '-' + (mes < 10 ? '0' : '') + mes + '-' + (dia < 10 ? '0' : '') + dia;
  }

  function hoySinHora() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /* "viernes 25 de septiembre" — con año solo si no es el actual */
  function etiquetaFecha(d) {
    var txt = DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()];
    return d.getFullYear() === new Date().getFullYear() ? txt : txt + ' de ' + d.getFullYear();
  }

  function scrollLog() {
    log.scrollTop = log.scrollHeight;
  }

  function burbuja(texto, quien) {
    var p = document.createElement('p');
    p.className = 'msg msg--' + quien;
    p.textContent = texto;
    log.appendChild(p);
    scrollLog();
    return p;
  }

  function escribiendo() {
    var d = document.createElement('div');
    d.className = 'typing';
    d.setAttribute('aria-hidden', 'true');
    d.innerHTML = '<span></span><span></span><span></span>';
    log.appendChild(d);
    scrollLog();
    return d;
  }

  /* Responde el asistente tras una pausa corta, como si estuviera escribiendo */
  function bot(textos, despues) {
    var lista = [].concat(textos);
    var punto = reducedMotion ? 120 : 520;
    var t = escribiendo();

    timers.push(setTimeout(function () {
      t.remove();
      lista.forEach(function (txt) { burbuja(txt, 'bot'); });
      if (despues) timers.push(setTimeout(despues, reducedMotion ? 60 : 240));
    }, punto));
  }

  function limpiarTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  /* --- controles del pie ------------------------------------------------ */

  /* Deja el pie en blanco: quita chips, calendario y formulario */
  function vaciarPie() {
    chips.innerHTML = '';
    chips.classList.remove('chips--cal');
    form.hidden = true;
  }

  function pintarChips(opciones) {
    vaciarPie();
    opciones.forEach(function (op) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = op.texto;
      b.addEventListener('click', function () {
        burbuja(op.texto, 'user');
        vaciarPie();
        op.accion(op);
      });
      chips.appendChild(b);
    });
    scrollLog();
  }

  function pedirTexto(placeholder, etiqueta, onValor) {
    vaciarPie();
    form.hidden = false;
    input.value = '';
    input.placeholder = placeholder;
    input.setAttribute('aria-label', etiqueta);
    input.inputMode = etiqueta === 'Teléfono' ? 'tel' : 'text';
    if (!reducedMotion) input.focus();

    form.onsubmit = function (e) {
      e.preventDefault();
      var valor = input.value.trim();
      if (!valor) return;
      burbuja(valor, 'user');
      form.hidden = true;
      input.value = '';
      onValor(valor);
    };
  }

  function botonReiniciar() {
    vaciarPie();
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'chat__restart';
    b.textContent = 'Hacer otra reserva';
    b.addEventListener('click', arrancar);
    chips.appendChild(b);
  }

  /* --- guion ------------------------------------------------------------ */

  function arrancar() {
    limpiarTimers();
    log.innerHTML = '';
    reserva = reservaVacia();
    paso = 0;

    bot(
      ['Buenas, soy el asistente de La Brasa. Cojo reservas a cualquier hora.',
       '¿Te busco mesa?'],
      function () {
        pintarChips([
          { texto: 'Sí, quiero reservar', accion: preguntarDia },
          { texto: '¿Qué horario tenéis?', accion: responderHorario }
        ]);
      }
    );
  }

  function responderHorario() {
    bot(
      ['Comidas de 13:00 a 16:00 y cenas de 20:00 a 23:30. Los lunes cerramos.',
       '¿Te reservo mesa?'],
      function () {
        pintarChips([
          { texto: 'Sí, vamos', accion: preguntarDia },
          { texto: 'Ahora no, gracias', accion: despedir }
        ]);
      }
    );
  }

  function despedir() {
    bot(['Sin problema. Aquí estoy cuando quieras.'], botonReiniciar);
  }

  function preguntarDia() {
    paso = 1;
    bot(['¿Qué día quieres venir? Los lunes cerramos.'], pintarCalendario);
  }

  /* --- calendario -------------------------------------------------------- */

  /* Mini-calendario mensual. Se puede elegir cualquier día futuro que no sea
     lunes; lo pasado y los lunes quedan deshabilitados. */
  function pintarCalendario() {
    vaciarPie();
    chips.classList.add('chips--cal');

    var hoy = hoySinHora();
    var visible = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    var cal = document.createElement('div');
    cal.className = 'cal';
    cal.setAttribute('role', 'group');
    cal.setAttribute('aria-label', 'Elegir la fecha de la reserva');

    var cabecera = document.createElement('div');
    cabecera.className = 'cal__head';

    var anterior = botonMes('anterior', 'M9.5 3L5 8l4.5 5');
    var titulo   = document.createElement('p');
    var siguiente = botonMes('siguiente', 'M6.5 3L11 8l-4.5 5');

    titulo.className = 'cal__title';
    titulo.setAttribute('aria-live', 'polite');

    cabecera.appendChild(anterior);
    cabecera.appendChild(titulo);
    cabecera.appendChild(siguiente);
    cal.appendChild(cabecera);

    var semana = document.createElement('div');
    semana.className = 'cal__dows';
    semana.setAttribute('aria-hidden', 'true');
    DOWS.forEach(function (d) {
      var s = document.createElement('span');
      s.textContent = d;
      semana.appendChild(s);
    });
    cal.appendChild(semana);

    var rejilla = document.createElement('div');
    rejilla.className = 'cal__grid';
    cal.appendChild(rejilla);

    var nota = document.createElement('p');
    nota.className = 'cal__note';
    nota.textContent = 'En gris, los días que no se pueden reservar.';
    cal.appendChild(nota);

    anterior.addEventListener('click', function () { moverMes(-1); });
    siguiente.addEventListener('click', function () { moverMes(1); });

    function moverMes(paso) {
      visible = new Date(visible.getFullYear(), visible.getMonth() + paso, 1);
      pintarMes();
    }

    function pintarMes() {
      titulo.textContent = MESES[visible.getMonth()] + ' ' + visible.getFullYear();

      /* Nunca se retrocede por debajo del mes en curso */
      anterior.disabled = visible.getFullYear() === hoy.getFullYear() &&
                          visible.getMonth() === hoy.getMonth();

      rejilla.innerHTML = '';

      /* Los huecos previos alinean el 1 con su día de la semana (lunes primero) */
      var primero = new Date(visible.getFullYear(), visible.getMonth(), 1);
      var hueco = (primero.getDay() + 6) % 7;
      var total = new Date(visible.getFullYear(), visible.getMonth() + 1, 0).getDate();
      var i;

      for (i = 0; i < hueco; i++) {
        var vacio = document.createElement('span');
        vacio.className = 'cal__blank';
        vacio.setAttribute('aria-hidden', 'true');
        rejilla.appendChild(vacio);
      }

      for (i = 1; i <= total; i++) {
        rejilla.appendChild(celdaDia(new Date(visible.getFullYear(), visible.getMonth(), i), hoy));
      }
    }

    pintarMes();
    chips.appendChild(cal);
    scrollLog();
  }

  function botonMes(sentido, trazo) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'cal__nav';
    b.setAttribute('aria-label', 'Mes ' + sentido);
    b.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
                  '<path d="' + trazo + '" stroke="currentColor" stroke-width="1.6" ' +
                  'stroke-linecap="round" stroke-linejoin="round"/></svg>';
    return b;
  }

  function celdaDia(fecha, hoy) {
    var b = document.createElement('button');
    var pasado = fecha < hoy;
    var lunes  = fecha.getDay() === CERRADO;

    b.type = 'button';
    b.className = 'cal__day';
    b.textContent = fecha.getDate();

    if (pasado || lunes) {
      b.disabled = true;
      b.setAttribute('aria-label', etiquetaFecha(fecha) + (lunes ? ', cerrado' : ', ya pasó'));
      return b;
    }

    if (fecha.getTime() === hoy.getTime()) b.classList.add('is-hoy');
    b.setAttribute('aria-label', etiquetaFecha(fecha));
    b.addEventListener('click', function () { elegirDia(fecha); });
    return b;
  }

  function elegirDia(fecha) {
    reserva.dia = etiquetaFecha(fecha);
    reserva.fechaIso = claveIso(fecha);
    burbuja(reserva.dia, 'user');
    vaciarPie();

    /* Si venimos de un turno completo ya sabemos quién es: no repreguntamos */
    if (reserva.nombre && reserva.telefono) preguntarTurno();
    else preguntarPersonas();
  }

  function preguntarPersonas() {
    paso = 2;
    bot(['Perfecto. ¿Cuántos sois?'], function () {
      pintarChips([
        { texto: '2', accion: elegirPersonas },
        { texto: '3', accion: elegirPersonas },
        { texto: '4', accion: elegirPersonas },
        { texto: '5', accion: elegirPersonas },
        { texto: '6', accion: elegirPersonas },
        { texto: 'Más de 6', accion: function () {
            pedirTexto('Ej.: 9', 'Número de personas', function (valor) {
              var n = parseInt(valor.replace(/\D/g, ''), 10);
              if (!n || n < 1) {
                bot(['No me cuadra ese número. Dime cuántos sois, en cifra.'], function () {
                  pedirTexto('Ej.: 9', 'Número de personas', function (v2) {
                    reserva.numPersonas = parseInt(v2.replace(/\D/g, ''), 10) || 8;
                    reserva.personas = reserva.numPersonas + ' personas';
                    avisoGrupo();
                  });
                });
                return;
              }
              reserva.numPersonas = n;
              reserva.personas = n + ' personas';
              if (n > 10) { avisoGrupoGrande(n); return; }
              avisoGrupo();
            });
          }
        }
      ]);
    });
  }

  function elegirPersonas(op) {
    reserva.numPersonas = parseInt(op.texto, 10);
    reserva.personas = op.texto + (op.texto === '1' ? ' persona' : ' personas');
    preguntarTurno();
  }

  function avisoGrupo() {
    bot(['Anotado. Para grupos juntamos mesas en la sala de abajo.'], preguntarTurno);
  }

  function avisoGrupoGrande(n) {
    bot([
      'Para ' + n + ' personas montamos mesa larga, pero eso lo cierra el jefe de sala.',
      'Sigo con la reserva y te llaman para confirmar el montaje.'
    ], preguntarTurno);
  }

  function preguntarTurno() {
    paso = 3;
    bot(['¿Comida o cena?'], function () {
      pintarChips([
        { texto: 'Comida · 13:30', accion: elegirTurno },
        { texto: 'Comida · 14:30', accion: elegirTurno },
        { texto: 'Cena · 20:30',   accion: elegirTurno },
        { texto: 'Cena · 21:30',   accion: elegirTurno }
      ]);
    });
  }

  function elegirTurno(op) {
    var partes = op.texto.split(' · ');
    reserva.turno = partes[0];
    reserva.turnoClave = partes[0].toLowerCase();
    reserva.hora  = partes[1];
    paso = 4;

    /* Antes de pedir datos preguntamos al restaurante si queda sitio de verdad */
    var t = escribiendo();
    pedirDisponibilidad(function (datos) {
      t.remove();

      if (datos && datos.disponibles !== null && datos.disponibles !== undefined &&
          datos.disponibles < reserva.numPersonas) {
        turnoCompleto(datos.disponibles);
        return;
      }

      /* Si ya tenemos nombre y teléfono (venimos de un turno lleno), al grano */
      if (reserva.nombre && reserva.telefono) {
        bot(['Ahí sí queda sitio. Te la registro.'], enviarReserva);
        return;
      }

      bot(['Hay hueco. ¿A nombre de quién la pongo?'], function () {
        pedirTexto('Tu nombre', 'Nombre', function (valor) {
          if (valor.length < 2) {
            bot(['Se me ha quedado corto. Dime tu nombre, por favor.'], preguntarNombreOtraVez);
            return;
          }
          reserva.nombre = valor;
          preguntarTelefono();
        });
      });
    });
  }

  /* Ese turno no da para el grupo: se ofrece salida, no se corta la charla */
  function turnoCompleto(disponibles) {
    var cuantas = (typeof disponibles === 'number')
      ? (disponibles > 0 ? ' Solo quedan ' + disponibles + ' plazas.' : ' No queda ni una plaza.')
      : '';

    bot([
      'Justo ese turno lo tenemos completo.' + cuantas,
      '¿Probamos con otro turno o con otro día?'
    ], function () {
      pintarChips([
        { texto: 'Otro turno', accion: preguntarTurno },
        { texto: 'Otro día',   accion: preguntarDia }
      ]);
    });
  }

  function preguntarNombreOtraVez() {
    pedirTexto('Tu nombre', 'Nombre', function (valor) {
      reserva.nombre = valor || 'Sin nombre';
      preguntarTelefono();
    });
  }

  function preguntarTelefono() {
    paso = 5;
    bot(['Gracias, ' + reserva.nombre.split(' ')[0] + '. ¿Un teléfono por si hay cualquier cambio?'], function () {
      pedirTexto('600 00 00 00', 'Teléfono', validarTelefono);
    });
  }

  function validarTelefono(valor) {
    var digitos = valor.replace(/\D/g, '');
    if (digitos.length < 9) {
      bot(['Ese número se queda corto. Necesito nueve cifras.'], function () {
        pedirTexto('600 00 00 00', 'Teléfono', function (v2) {
          reserva.telefono = v2;
          confirmar();
        });
      });
      return;
    }
    reserva.telefono = valor;
    confirmar();
  }

  function confirmar() {
    paso = 6;
    bot(['Un segundo, que la registro…'], enviarReserva);
  }

  function enviarReserva() {
    var t = escribiendo();

    crearReserva(function (res) {
      t.remove();

      if (res && res.ok) { reservaGuardada(res); return; }
      if (res && res.motivo === 'sin_aforo') { turnoCompleto(res.disponibles); return; }

      noSeHaPodido();
    });
  }

  function noSeHaPodido() {
    bot([
      'No he podido registrarla, inténtalo en un momento.',
      'Si tienes prisa, llámanos al 910 00 00 00 y la cogemos por teléfono.'
    ], function () {
      pintarChips([
        { texto: 'Probar otra vez', accion: enviarReserva },
        { texto: 'Lo dejo por ahora', accion: despedir }
      ]);
    });
  }

  function reservaGuardada(res) {
    var confirmada = res.estado === 'confirmada';

    bot([confirmada ? '¡Reserva confirmada!' : '¡Reserva registrada!'], function () {
      var card = document.createElement('div');
      card.className = 'msg msg--bot msg--card';
      card.innerHTML =
        '<b class="js-titulo"></b>' +
        '<dl>' +
          '<dt>Día</dt><dd class="js-dia"></dd>' +
          '<dt>Turno</dt><dd class="js-turno"></dd>' +
          '<dt>Personas</dt><dd class="js-personas"></dd>' +
          '<dt>A nombre de</dt><dd class="js-nombre"></dd>' +
          '<dt>Teléfono</dt><dd class="js-tel"></dd>' +
        '</dl>';
      card.querySelector('.js-titulo').textContent   =
        (confirmada ? 'Mesa reservada' : 'Reserva registrada') + ' · La Brasa';
      card.querySelector('.js-dia').textContent      = reserva.dia;
      card.querySelector('.js-turno').textContent    = reserva.turno + ' · ' + reserva.hora;
      card.querySelector('.js-personas').textContent = reserva.personas;
      card.querySelector('.js-nombre').textContent   = reserva.nombre;
      card.querySelector('.js-tel').textContent      = reserva.telefono;
      log.appendChild(card);
      scrollLog();

      bot([
        confirmada
          ? 'Te confirmo la reserva: ya la tienen en el panel del restaurante.'
          : 'Queda registrada y el restaurante te confirma enseguida.',
        'Si te surge algo, llámanos y la movemos.'
      ], botonReiniciar);
    });
  }

  /* --- backend --------------------------------------------------------------
     Dos llamadas y nada más: mirar si queda sitio y crear la reserva. Si la red
     falla, el guion lo dice y no canta un éxito que no ha pasado.
     -------------------------------------------------------------------- */

  function llamar(cuerpo, cuando) {
    var contestado = false;

    var responder = function (datos) {
      if (contestado) return;
      contestado = true;
      cuando(datos);
    };

    var reloj = setTimeout(function () { responder(null); }, ESPERA);

    fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo)
    })
      .then(function (r) { return r.json(); })
      .then(function (datos) { clearTimeout(reloj); responder(datos); })
      .catch(function () { clearTimeout(reloj); responder(null); });
  }

  /* Si no se puede preguntar, seguimos: ya lo dirá el alta */
  function pedirDisponibilidad(cuando) {
    llamar({
      token: TOKEN,
      action: 'disponibilidad',
      fecha: reserva.fechaIso,
      turno: reserva.turnoClave
    }, cuando);
  }

  function crearReserva(cuando) {
    llamar({
      token: TOKEN,
      action: 'crear_reserva',
      fecha: reserva.fechaIso,
      turno: reserva.turnoClave,
      hora: reserva.hora,
      personas: reserva.numPersonas,
      nombre: reserva.nombre,
      telefono: reserva.telefono,
      origen: 'chatbot'
    }, cuando);
  }

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
