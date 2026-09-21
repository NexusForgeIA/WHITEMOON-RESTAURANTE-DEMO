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

  var DIAS  = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Estado de la reserva en curso — en memoria, se pierde al recargar */
  var reserva = { dia: '', personas: '', turno: '', hora: '', nombre: '', telefono: '' };
  var paso = 0;
  var timers = [];

  /* --- utilidades ------------------------------------------------------- */

  function etiquetaFecha(offset) {
    var d = new Date();
    d.setDate(d.getDate() + offset);
    return {
      corta: DIAS[d.getDay()] + ' ' + d.getDate() + ' ' + MESES[d.getMonth()],
      esLunes: d.getDay() === 1
    };
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

  function pintarChips(opciones) {
    form.hidden = true;
    chips.innerHTML = '';
    opciones.forEach(function (op) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = op.texto;
      b.addEventListener('click', function () {
        burbuja(op.texto, 'user');
        chips.innerHTML = '';
        op.accion(op);
      });
      chips.appendChild(b);
    });
    scrollLog();
  }

  function pedirTexto(placeholder, etiqueta, onValor) {
    chips.innerHTML = '';
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
    chips.innerHTML = '';
    form.hidden = true;
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
    reserva = { dia: '', personas: '', turno: '', hora: '', nombre: '', telefono: '' };
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
    var hoy     = etiquetaFecha(0);
    var manana  = etiquetaFecha(1);
    var pasado  = etiquetaFecha(2);

    bot(['¿Qué día quieres venir?'], function () {
      pintarChips([
        { texto: 'Hoy, ' + hoy.corta,       lunes: hoy.esLunes,    accion: elegirDia },
        { texto: 'Mañana, ' + manana.corta, lunes: manana.esLunes, accion: elegirDia },
        { texto: pasado.corta,              lunes: pasado.esLunes, accion: elegirDia },
        { texto: 'Otro día', accion: function () {
            pedirTexto('Ej.: viernes 12', 'Día de la reserva', function (valor) {
              reserva.dia = valor;
              preguntarPersonas();
            });
          }
        }
      ]);
    });
  }

  function elegirDia(op) {
    if (op.lunes) {
      bot(['Los lunes cerramos por descanso. ¿Lo dejamos para otro día?'], preguntarDia);
      return;
    }
    reserva.dia = op.texto.replace('Hoy, ', 'hoy, ').replace('Mañana, ', 'mañana, ');
    preguntarPersonas();
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
                    reserva.personas = (parseInt(v2.replace(/\D/g, ''), 10) || 8) + ' personas';
                    avisoGrupo();
                  });
                });
                return;
              }
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
    reserva.hora  = partes[1];
    paso = 4;

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
    bot(['¡Reserva confirmada!'], function () {
      var card = document.createElement('div');
      card.className = 'msg msg--bot msg--card';
      card.innerHTML =
        '<b>Mesa reservada · La Brasa</b>' +
        '<dl>' +
          '<dt>Día</dt><dd class="js-dia"></dd>' +
          '<dt>Turno</dt><dd class="js-turno"></dd>' +
          '<dt>Personas</dt><dd class="js-personas"></dd>' +
          '<dt>A nombre de</dt><dd class="js-nombre"></dd>' +
          '<dt>Teléfono</dt><dd class="js-tel"></dd>' +
        '</dl>';
      card.querySelector('.js-dia').textContent      = reserva.dia;
      card.querySelector('.js-turno').textContent    = reserva.turno + ' · ' + reserva.hora;
      card.querySelector('.js-personas').textContent = reserva.personas;
      card.querySelector('.js-nombre').textContent   = reserva.nombre;
      card.querySelector('.js-tel').textContent      = reserva.telefono;
      log.appendChild(card);
      scrollLog();

      bot([
        'Te aparece ya en el panel del restaurante. Si te surge algo, llámanos y la movemos.',
        'Esto es una demo: no se ha enviado ningún dato a ninguna parte.'
      ], botonReiniciar);
    });
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

  Array.prototype.forEach.call(document.querySelectorAll('[data-open-chat]'), function (b) {
    b.addEventListener('click', abrir);
  });
  closeBt.addEventListener('click', cerrar);
})();
