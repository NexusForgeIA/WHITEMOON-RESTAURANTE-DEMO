/* ==========================================================================
   Restaurante WhiteMoon · reservador guiado

   Un formulario por pasos con pinta de chat: día, turno, hora, zona, personas
   y datos. No hay IA ni conversación: solo se escriben el nombre y el
   teléfono. Al confirmar, la reserva se guarda en reservas-mt.
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

  /* En reserva.html el reservador ES la página: ni botón flotante ni cerrar */
  var modoPagina = panel.getAttribute('data-modo') === 'pagina';

  /* Marca con varios locales bajo una sola web. Vacío = un restaurante y el
     reservador se comporta igual que siempre, sin preguntar el local. */
  var GRUPO = panel.getAttribute('data-grupo') || '';

  var API    = 'https://mlaqtniujnvfxcvcourm.supabase.co/functions/v1/reservas-mt';
  var ESPERA = 15000;

  /* Deja de ser constante en modo marca: lo reescribe la sede elegida */
  var TOKEN = 'demo-restaurante';

  var DIAS  = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var DOWS  = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];   /* el calendario empieza en lunes */
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
               'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  var CERRADO = 1;   /* getDay() del lunes: el restaurante descansa */

  var HORAS = {
    comida: ['13:00', '13:30', '14:00', '14:30', '15:00', '15:30'],
    cena:   ['20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00']
  };

  var ZONAS = ['Mesa', 'Terraza', 'Salón'];
  var TOPE_LISTA = 12;   /* de ahí para arriba, grupo grande */

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var reserva = nueva();
  var enviando = false;
  var timers = [];

  /* Las sedes se piden una vez y se guardan: "empezar de nuevo" no refetchea */
  var sedes = null;
  var sedeActiva = null;

  function nueva() {
    return {
      fechaIso: '', diaTexto: '',
      turno: '', turnoTexto: '', hora: '',
      zona: '',
      personas: 0, personasTexto: '',
      nombre: '', telefono: ''
    };
  }

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

  function burbuja(texto, quien) {
    var p = el('p', 'msg msg--' + quien, texto);
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

  /* Responde el reservador tras una pausa corta, como si escribiera */
  function bot(textos, despues) {
    var lista = [].concat(textos);
    var t = escribiendo();

    timers.push(setTimeout(function () {
      t.remove();
      lista.forEach(function (txt) { burbuja(txt, 'bot'); });
      if (despues) timers.push(setTimeout(despues, reducedMotion ? 60 : 200));
    }, reducedMotion ? 100 : 420));
  }

  function limpiarTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  /* --- controles del pie ------------------------------------------------ */

  function vaciarPie() {
    chips.innerHTML = '';
    chips.classList.remove('chips--cal');
    form.hidden = true;
  }

  function pintarChips(opciones) {
    vaciarPie();

    opciones.forEach(function (op) {
      var b = el('button', 'chip', op.texto);
      b.type = 'button';
      b.addEventListener('click', function () {
        if (op.eco !== false) burbuja(op.texto, 'user');
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

  /* --- fechas ----------------------------------------------------------- */

  function hoySinHora() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function claveIso(d) {
    var mes = d.getMonth() + 1;
    var dia = d.getDate();
    return d.getFullYear() + '-' + (mes < 10 ? '0' : '') + mes + '-' + (dia < 10 ? '0' : '') + dia;
  }

  /* "viernes 25 de septiembre" — con año solo si no es el actual */
  function etiquetaFecha(d) {
    var txt = DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()];
    return d.getFullYear() === new Date().getFullYear() ? txt : txt + ' de ' + d.getFullYear();
  }

  /* --- paso 0: el local ----------------------------------------------------
     Solo en modo marca. Sin sede elegida no se puede reservar: crear_reserva
     necesita el tenant, así que este paso no se puede saltar.
     -------------------------------------------------------------------- */

  function etiquetaSede(s) {
    return s.ciudad || s.restaurante_nombre || s.tenant;
  }

  function pedirSedes(cuando) {
    if (sedes) { cuando(sedes); return; }

    var contestado = false;

    var responder = function (lista) {
      if (contestado) return;
      contestado = true;
      cuando(lista);
    };

    var reloj = setTimeout(function () { responder(null); }, ESPERA);

    fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sedes_publicas', grupo: GRUPO })
    })
      .then(function (r) { return r.json(); })
      .then(function (datos) {
        clearTimeout(reloj);

        if (datos && datos.ok && datos.sedes && datos.sedes.length) {
          sedes = datos.sedes;
          responder(sedes);
          return;
        }

        responder(null);
      })
      .catch(function () { clearTimeout(reloj); responder(null); });
  }

  function pasoSede() {
    if (sedes) { ofrecerSedes(sedes); return; }

    var t = escribiendo();

    pedirSedes(function (lista) {
      t.remove();

      if (!lista) { sedesFallidas(); return; }
      ofrecerSedes(lista);
    });
  }

  /* Con un solo local no hay nada que preguntar */
  function ofrecerSedes(lista) {
    if (lista.length === 1) { elegirSede(lista[0]); return; }

    bot(['¿En qué local quieres reservar?'], function () {
      pintarChips(lista.map(function (s) {
        return {
          texto: etiquetaSede(s),
          accion: function () { elegirSede(s); }
        };
      }));
    });
  }

  function elegirSede(s) {
    TOKEN = s.tenant;
    sedeActiva = s;
    pasoDia();
  }

  function sedesFallidas() {
    bot([
      'No he podido cargar los locales, inténtalo en un momento.',
      'Si tienes prisa, llámanos al 643 199 580 y la cogemos por teléfono.'
    ], function () {
      pintarChips([
        { texto: 'Reintentar', eco: false, accion: pasoSede }
      ]);
    });
  }

  /* --- paso 1: el día ----------------------------------------------------- */

  function pasoDia() {
    bot(['¿Qué día quieres venir? Los lunes cerramos.'], pintarCalendario);
  }

  /* Mini-calendario mensual. Se puede elegir cualquier día futuro que no sea
     lunes; lo pasado y los lunes quedan deshabilitados. */
  function pintarCalendario() {
    vaciarPie();
    chips.classList.add('chips--cal');

    var hoy = hoySinHora();
    var visible = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    var cal = el('div', 'cal');
    cal.setAttribute('role', 'group');
    cal.setAttribute('aria-label', 'Elegir la fecha de la reserva');

    var cabecera = el('div', 'cal__head');
    var anterior = botonMes('anterior', 'M9.5 3L5 8l4.5 5');
    var titulo = el('p', 'cal__title');
    var siguiente = botonMes('siguiente', 'M6.5 3L11 8l-4.5 5');

    titulo.setAttribute('aria-live', 'polite');

    cabecera.appendChild(anterior);
    cabecera.appendChild(titulo);
    cabecera.appendChild(siguiente);
    cal.appendChild(cabecera);

    var semana = el('div', 'cal__dows');
    semana.setAttribute('aria-hidden', 'true');
    DOWS.forEach(function (d) { semana.appendChild(el('span', null, d)); });
    cal.appendChild(semana);

    var rejilla = el('div', 'cal__grid');
    cal.appendChild(rejilla);
    cal.appendChild(el('p', 'cal__note', 'En gris, los días que no se pueden reservar.'));

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
        var vacio = el('span', 'cal__blank');
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
    var b = el('button', 'cal__nav');
    b.type = 'button';
    b.setAttribute('aria-label', 'Mes ' + sentido);
    b.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
                  '<path d="' + trazo + '" stroke="currentColor" stroke-width="1.6" ' +
                  'stroke-linecap="round" stroke-linejoin="round"/></svg>';
    return b;
  }

  function celdaDia(fecha, hoy) {
    var b = el('button', 'cal__day', fecha.getDate());
    var pasado = fecha < hoy;
    var lunes  = fecha.getDay() === CERRADO;

    b.type = 'button';

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
    reserva.diaTexto = etiquetaFecha(fecha);
    reserva.fechaIso = claveIso(fecha);

    burbuja(reserva.diaTexto, 'user');
    vaciarPie();
    pasoTurno();
  }

  /* --- paso 2: turno ------------------------------------------------------ */

  /* Los turnos del local; sin sede, los dos de siempre */
  function turnosDisponibles() {
    if (sedeActiva && sedeActiva.turnos && sedeActiva.turnos.length) return sedeActiva.turnos;
    return [{ nombre: 'comida' }, { nombre: 'cena' }];
  }

  function capitaliza(txt) {
    return txt.charAt(0).toUpperCase() + txt.slice(1);
  }

  function pasoTurno() {
    bot(['¿Comida o cena?'], function () {
      pintarChips(turnosDisponibles().map(function (t) {
        return { texto: capitaliza(t.nombre), accion: elegirTurno };
      }));
    });
  }

  function elegirTurno(op) {
    reserva.turnoTexto = op.texto;
    reserva.turno = op.texto.toLowerCase();
    reserva.hora = '';
    pasoHora();
  }

  /* --- paso 3: hora ------------------------------------------------------- */

  /* El servidor manda el turno como rango (13:00–16:00), no como lista de
     huecos. Se pasa todo a minutos porque "24:00" ni lo da Date ni ordena
     bien como texto, y no se ofrece la hora de cierre. */
  var PASO_HORA = 30;

  function aMinutos(hhmm) {
    var trozos = String(hhmm || '').split(':');
    return Number(trozos[0]) * 60 + Number(trozos[1] || 0);
  }

  function aHora(minutos) {
    var h = Math.floor(minutos / 60) % 24;
    var m = minutos % 60;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  function huecos(turno) {
    var lista = [];
    var fin = aMinutos(turno.hora_fin) - PASO_HORA;

    for (var m = aMinutos(turno.hora_ini); m <= fin; m += PASO_HORA) lista.push(aHora(m));
    return lista;
  }

  function horasDelTurno() {
    var turno = null;

    if (sedeActiva && sedeActiva.turnos) {
      sedeActiva.turnos.forEach(function (t) {
        if (t.nombre === reserva.turno) turno = t;
      });
    }

    if (turno && turno.hora_ini && turno.hora_fin) {
      var propias = huecos(turno);
      if (propias.length) return propias;
    }

    return HORAS[reserva.turno] || [];
  }

  function pasoHora() {
    bot(['¿A qué hora?'], function () {
      pintarChips(horasDelTurno().map(function (h) {
        return { texto: h, accion: elegirHora };
      }));
    });
  }

  function elegirHora(op) {
    reserva.hora = op.texto;
    pasoZona();
  }

  /* --- paso 4: zona ------------------------------------------------------- */

  /* Las zonas del local; sin sede, las de siempre */
  function zonasDisponibles() {
    if (sedeActiva && sedeActiva.zonas && sedeActiva.zonas.length) return sedeActiva.zonas;
    return ZONAS;
  }

  function pasoZona() {
    bot(['¿Dónde prefieres sentarte?'], function () {
      pintarChips(zonasDisponibles().map(function (z) {
        return { texto: z, accion: elegirZona };
      }));
    });
  }

  function elegirZona(op) {
    reserva.zona = op.texto;
    pasoPersonas();
  }

  /* --- paso 5: personas --------------------------------------------------- */

  function pasoPersonas() {
    bot(['¿Cuántos sois?'], function () {
      var opciones = [];

      for (var n = 1; n <= TOPE_LISTA; n++) {
        opciones.push({ texto: String(n), accion: elegirPersonas });
      }

      opciones.push({ texto: '+ de 12', accion: grupoGrande });
      pintarChips(opciones);
    });
  }

  function elegirPersonas(op) {
    reserva.personas = parseInt(op.texto, 10);
    reserva.personasTexto = op.texto + (reserva.personas === 1 ? ' persona' : ' personas');
    pasoNombre();
  }

  function grupoGrande() {
    reserva.personas = TOPE_LISTA + 1;
    reserva.personasTexto = 'Más de 12';

    bot(['Para grupos grandes te contactamos para cuadrar la mesa.'], pasoNombre);
  }

  /* --- paso 6: datos ------------------------------------------------------ */

  function pasoNombre() {
    /* Si venimos de un turno lleno ya sabemos quién es: no se repregunta */
    if (reserva.nombre) { pasoTelefono(); return; }

    bot(['¿A nombre de quién la pongo?'], function () {
      pedirTexto('Tu nombre', 'Nombre', function (valor) {
        if (valor.length < 2) {
          bot(['Se me ha quedado corto. Dime tu nombre, por favor.'], pasoNombre);
          return;
        }
        reserva.nombre = valor;
        pasoTelefono();
      });
    });
  }

  function pasoTelefono() {
    if (reserva.telefono) { pasoResumen(); return; }

    bot(['Gracias, ' + reserva.nombre.split(' ')[0] + '. ¿Un teléfono por si hay cualquier cambio?'], function () {
      pedirTexto('600 00 00 00', 'Teléfono', function (valor) {
        if (valor.replace(/\D/g, '').length < 9) {
          bot(['Ese número se queda corto. Necesito nueve cifras.'], pasoTelefono);
          return;
        }
        reserva.telefono = valor;
        pasoResumen();
      });
    });
  }

  /* --- paso 7: repaso y confirmación --------------------------------------- */

  function tarjeta(titulo, clase) {
    var card = el('div', 'msg msg--bot msg--card' + (clase ? ' ' + clase : ''));
    card.appendChild(el('b', null, titulo));

    var dl = el('dl');

    function fila(etiqueta, valor) {
      if (!valor) return;
      dl.appendChild(el('dt', null, etiqueta));
      dl.appendChild(el('dd', null, valor));
    }

    /* Sin sede no se pinta la fila: fila() se salta los valores vacíos */
    fila('Local', sedeActiva ? etiquetaSede(sedeActiva) : '');
    fila('Día', reserva.diaTexto);
    fila('Turno', reserva.turnoTexto + ' · ' + reserva.hora);
    fila('Zona', reserva.zona);
    fila('Personas', reserva.personasTexto);
    fila('A nombre de', reserva.nombre);

    card.appendChild(dl);
    log.appendChild(card);
    scrollLog();
  }

  function pasoResumen() {
    bot(['Esto es lo que voy a reservar:'], function () {
      tarjeta('Repasa tu reserva');

      pintarChips([
        { texto: 'Confirmar reserva', eco: false, accion: confirmar },
        { texto: 'Empezar de nuevo',  eco: false, accion: arrancar }
      ]);
    });
  }

  /* --- guardar ------------------------------------------------------------- */

  function confirmar() {
    if (enviando) return;
    enviando = true;

    var t = escribiendo();

    crearReserva(function (res) {
      t.remove();
      enviando = false;

      if (res && res.ok) { registrada(); return; }
      if (res && res.motivo === 'sin_aforo') { turnoCompleto(res.disponibles); return; }

      noSeHaPodido();
    });
  }

  function crearReserva(cuando) {
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
      body: JSON.stringify({
        token: TOKEN,
        action: 'crear_reserva',
        fecha: reserva.fechaIso,
        turno: reserva.turno,
        hora: reserva.hora,
        personas: reserva.personas,
        zona_preferida: reserva.zona,
        nombre: reserva.nombre,
        telefono: reserva.telefono,
        origen: 'web'
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (datos) { clearTimeout(reloj); responder(datos); })
      .catch(function () { clearTimeout(reloj); responder(null); });
  }

  /* El estado real es "pendiente": no se dice que esté confirmada */
  function registrada() {
    bot(['¡Reserva registrada! El restaurante te la confirma enseguida.'], function () {
      tarjeta('Reserva registrada · Restaurante WhiteMoon');

      bot(['Si te surge algo, llámanos al 643 199 580 y la movemos.'], function () {
        pintarChips([
          { texto: 'Hacer otra reserva', eco: false, accion: arrancar }
        ]);
      });
    });
  }

  function turnoCompleto(disponibles) {
    var cuantas = (typeof disponibles === 'number')
      ? (disponibles > 0 ? ' Solo quedan ' + disponibles + ' plazas.' : '')
      : '';

    bot([
      'Ese turno está completo.' + cuantas,
      '¿Probamos con otro turno o con otro día?'
    ], function () {
      pintarChips([
        { texto: 'Otro turno', eco: false, accion: pasoTurno },
        { texto: 'Otro día',   eco: false, accion: pasoDia }
      ]);
    });
  }

  function noSeHaPodido() {
    bot([
      'No he podido registrarla, inténtalo en un momento.',
      'Si tienes prisa, llámanos al 643 199 580 y la cogemos por teléfono.'
    ], function () {
      pintarChips([
        { texto: 'Reintentar',        eco: false, accion: confirmar },
        { texto: 'Empezar de nuevo',  eco: false, accion: arrancar }
      ]);
    });
  }

  /* --- arranque ------------------------------------------------------------ */

  function arrancar() {
    limpiarTimers();
    log.innerHTML = '';
    vaciarPie();
    reserva = nueva();
    sedeActiva = null;
    enviando = false;

    bot(['Buenas, soy el asistente de Restaurante WhiteMoon. Te busco mesa en unos toques.'],
        GRUPO ? pasoSede : pasoDia);
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
