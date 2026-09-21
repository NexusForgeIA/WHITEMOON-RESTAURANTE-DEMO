/* ==========================================================================
   La Brasa · panel del dueño (DEMO)
   Todo el estado vive en estas variables. No hay backend ni almacenamiento:
   al recargar la página vuelven los datos de ejemplo.
   ========================================================================== */

(function () {
  'use strict';

  /* --- datos de ejemplo -------------------------------------------------- */

  var mesas = [
    { id: 1, zona: 'Ventana',        cap: 2 },
    { id: 2, zona: 'Ventana',        cap: 2 },
    { id: 3, zona: 'Sala',           cap: 4 },
    { id: 4, zona: 'Sala',           cap: 4 },
    { id: 5, zona: 'Sala',           cap: 6 },
    { id: 6, zona: 'Terraza',        cap: 4 },
    { id: 7, zona: 'Sala de abajo',  cap: 8 },
    { id: 8, zona: 'Barra',          cap: 3 }
  ];

  var reservas = [
    { id: 101, nombre: 'Marta Ferrer',    personas: 2, hora: '13:30', turno: 'comida', mesa: 1,    estado: 'confirmada', origen: 'Asistente IA', nota: '', tel: '600 00 00 01', email: 'marta@example.com' },
    { id: 102, nombre: 'Grupo Álvarez',   personas: 6, hora: '13:30', turno: 'comida', mesa: 5,    estado: 'sentada',    origen: 'Teléfono',     nota: 'Comida de empresa, facturan a nombre de la gestoría', tel: '600 00 00 02', email: 'reservas@example.com' },
    { id: 103, nombre: 'Luis Sanmartín',  personas: 4, hora: '14:30', turno: 'comida', mesa: 3,    estado: 'confirmada', origen: 'Asistente IA', nota: 'Una trona', tel: '600 00 00 03', email: '' },
    { id: 104, nombre: 'Claudia Rey',     personas: 2, hora: '14:30', turno: 'comida', mesa: null, estado: 'pendiente',  origen: 'Asistente IA', nota: '', tel: '600 00 00 04', email: 'claudia@example.com' },
    { id: 105, nombre: 'Familia Otero',   personas: 8, hora: '20:30', turno: 'cena',   mesa: 7,    estado: 'confirmada', origen: 'Teléfono',     nota: 'Cumpleaños, traen tarta', tel: '600 00 00 05', email: '' },
    { id: 106, nombre: 'Íñigo Pardo',     personas: 3, hora: '20:30', turno: 'cena',   mesa: 8,    estado: 'pendiente',  origen: 'Asistente IA', nota: '', tel: '600 00 00 06', email: 'inigo@example.com' },
    { id: 107, nombre: 'Nuria Casas',     personas: 2, hora: '21:00', turno: 'cena',   mesa: 2,    estado: 'confirmada', origen: 'Asistente IA', nota: 'Sin gluten', tel: '600 00 00 07', email: '' },
    { id: 108, nombre: 'Pablo Duarte',    personas: 4, hora: '21:30', turno: 'cena',   mesa: 4,    estado: 'pendiente',  origen: 'Asistente IA', nota: '', tel: '600 00 00 08', email: 'pablo@example.com' },
    { id: 109, nombre: 'Rosa Iglesias',   personas: 4, hora: '21:30', turno: 'cena',   mesa: 6,    estado: 'cancelada',  origen: 'Teléfono',     nota: 'Avisa de que le ha surgido un viaje', tel: '600 00 00 09', email: '' }
  ];

  /* Los días se calculan en carga y relativos a hoy, para que la demo siempre
     tenga reservas en el día de hoy, mañana y un par de días sueltos. */
  var REPARTO_DIAS = { 101: 0, 102: 0, 103: 0, 105: 0, 109: 0, 104: 1, 106: 1, 107: 2, 108: 6 };

  function diaDesplazado(saltos) {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + saltos);
    return d;
  }

  function claveDia(d) {
    var mes = d.getMonth() + 1;
    var dia = d.getDate();
    return d.getFullYear() + '-' + (mes < 10 ? '0' : '') + mes + '-' + (dia < 10 ? '0' : '') + dia;
  }

  function diaDesdeClave(clave) {
    var trozos = clave.split('-');
    return new Date(Number(trozos[0]), Number(trozos[1]) - 1, Number(trozos[2]));
  }

  reservas.forEach(function (r) {
    r.fecha = claveDia(diaDesplazado(REPARTO_DIAS[r.id] || 0));
  });

  var filtro = 'todo';
  var diaSel = claveDia(diaDesplazado(0));
  var editando = null;   /* id de la mesa que se está editando */
  var proximoIdMesa = 9;

  var ESTADOS = {
    pendiente:  'Pendiente',
    confirmada: 'Confirmada',
    sentada:    'Sentada',
    cancelada:  'Cancelada'
  };

  /* --- atajos del DOM ---------------------------------------------------- */

  var $ = function (sel) { return document.querySelector(sel); };

  var listaReservas = $('#listaReservas');
  var listaMesas    = $('#listaMesas');
  var toastEl       = $('#toast');
  var toastTimer    = null;

  /* Crea un elemento con clase, texto y atributos. textContent siempre,
     nunca innerHTML con datos que escribe el usuario. */
  function el(tag, clase, texto) {
    var n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto !== undefined && texto !== null) n.textContent = texto;
    return n;
  }

  function svg(markup, tam) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('width', tam);
    s.setAttribute('height', tam);
    s.setAttribute('viewBox', '0 0 16 16');
    s.setAttribute('fill', 'none');
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = markup;
    return s;
  }

  function aviso(texto) {
    toastEl.textContent = texto;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2600);
  }

  /* --- cálculos ---------------------------------------------------------- */

  function reservasDelDia() {
    return reservas.filter(function (r) { return r.fecha === diaSel; });
  }

  function activas() {
    return reservasDelDia().filter(function (r) { return r.estado !== 'cancelada'; });
  }

  /* Sin lista, mira todas las reservas: es lo que necesita la vista de Mesas */
  function mesasOcupadas(lista) {
    var ids = {};
    (lista || reservas).forEach(function (r) {
      if (r.estado === 'sentada' && r.mesa) ids[r.mesa] = true;
    });
    return ids;
  }

  function mesaPorId(id) {
    for (var i = 0; i < mesas.length; i++) if (mesas[i].id === id) return mesas[i];
    return null;
  }

  /* --- pintado: cuadro de mando ------------------------------------------ */

  function pintarKpis() {
    var act = activas();
    var comensales = act.reduce(function (t, r) { return t + r.personas; }, 0);
    var ocupadas = Object.keys(mesasOcupadas(reservasDelDia())).length;

    $('#kpiReservas').textContent   = act.length;
    $('#kpiComensales').textContent = comensales;
    $('#kpiMesas').textContent      = Math.max(mesas.length - ocupadas, 0);
  }

  /* --- pintado: reservas -------------------------------------------------- */

  function tarjetaReserva(r) {
    var card = el('article', 'res' + (r.estado === 'cancelada' ? ' is-cancelada' : ''));

    var top = el('div', 'res__top');
    top.appendChild(el('span', 'res__hora', r.hora));

    var who = el('div', 'res__who');
    who.appendChild(el('p', 'res__nombre', r.nombre));

    var mesa = mesaPorId(r.mesa);
    var meta = r.personas + (r.personas === 1 ? ' persona' : ' personas') +
               ' · ' + (mesa ? 'Mesa ' + mesa.id + ' (' + mesa.zona + ')' : 'Sin mesa asignada') +
               ' · ' + r.origen;
    who.appendChild(el('p', 'res__meta', meta));

    if (r.nota) who.appendChild(el('p', 'res__nota', r.nota));
    top.appendChild(who);

    top.appendChild(el('span', 'badge badge--' + r.estado, ESTADOS[r.estado]));
    card.appendChild(top);

    var acciones = el('div', 'res__acciones');
    [
      { estado: 'confirmada', texto: 'Confirmar', clase: 'act--ok' },
      { estado: 'sentada',    texto: 'Sentado',   clase: 'act--sent' },
      { estado: 'cancelada',  texto: 'Cancelar',  clase: 'act--no' }
    ].forEach(function (a) {
      var b = el('button', 'act ' + a.clase, a.texto);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(r.estado === a.estado));
      b.setAttribute('aria-label', a.texto + ' la reserva de ' + r.nombre);
      if (r.estado === a.estado) {
        b.disabled = true;
      } else {
        b.addEventListener('click', function () { cambiarEstado(r.id, a.estado); });
      }
      acciones.appendChild(b);
    });
    card.appendChild(acciones);

    /* Una reserva cancelada no necesita que le escribamos */
    if (r.estado !== 'cancelada') {
      var msg = el('button', 'res__msg');
      msg.type = 'button';
      msg.setAttribute('aria-label', 'Escribir a ' + r.nombre);
      msg.appendChild(svg(ICONO_MENSAJE, 15));
      msg.appendChild(el('span', null, 'Mensaje'));
      msg.addEventListener('click', function () { abrirMensaje(r); });
      card.appendChild(msg);
    }

    return card;
  }

  function bloqueTurno(titulo, lista) {
    var frag = document.createDocumentFragment();

    var h = el('div', 'turno-h');
    h.appendChild(el('h2', null, titulo));
    var pax = lista.reduce(function (t, r) { return r.estado === 'cancelada' ? t : t + r.personas; }, 0);
    h.appendChild(el('span', null,
      lista.length + (lista.length === 1 ? ' reserva · ' : ' reservas · ') +
      pax + (pax === 1 ? ' comensal' : ' comensales')));
    frag.appendChild(h);

    if (!lista.length) {
      frag.appendChild(el('p', 'vacio', 'Ninguna reserva en este turno.'));
      return frag;
    }

    lista
      .slice()
      .sort(function (a, b) { return a.hora.localeCompare(b.hora); })
      .forEach(function (r) { frag.appendChild(tarjetaReserva(r)); });

    return frag;
  }

  function pintarReservas() {
    listaReservas.innerHTML = '';

    var delDia = reservasDelDia();

    if (!delDia.length) {
      listaReservas.appendChild(el('p', 'vacio', 'Ninguna reserva este día.'));
      return;
    }

    var comida = delDia.filter(function (r) { return r.turno === 'comida'; });
    var cena   = delDia.filter(function (r) { return r.turno === 'cena'; });

    if (filtro !== 'cena')   listaReservas.appendChild(bloqueTurno('Turno de comida', comida));
    if (filtro !== 'comida') listaReservas.appendChild(bloqueTurno('Turno de cena', cena));
  }

  function cambiarEstado(id, estado) {
    var r = null;
    reservas.forEach(function (x) { if (x.id === id) r = x; });
    if (!r) return;

    r.estado = estado;
    pintar();
    aviso(r.nombre + ' · ' + ESTADOS[estado].toLowerCase());
  }

  /* --- pintado: mesas ----------------------------------------------------- */

  var ICONO_MENSAJE = '<path d="M13.5 9.5a1.5 1.5 0 01-1.5 1.5H6l-3 2.5V4a1.5 1.5 0 011.5-1.5h7A1.5 1.5 0 0113.5 4v5.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>';
  var ICONO_EDITAR  = '<path d="M11.1 2.4l2.5 2.5L6 12.5l-3.2.7.7-3.2 7.6-7.6z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>';
  var ICONO_BORRAR  = '<path d="M3 4.5h10M6.5 4.5V3h3v1.5M5 4.5l.6 8.2h4.8L11 4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>';

  function filaMesa(m, ocupadas) {
    var fila = el('div', 'mesa' + (ocupadas[m.id] ? ' is-ocupada' : ''));

    fila.appendChild(el('span', 'mesa__id', String(m.id)));

    var info = el('div', 'mesa__info');
    info.appendChild(el('p', 'mesa__zona', m.zona));
    info.appendChild(el('p', 'mesa__cap',
      m.cap + (m.cap === 1 ? ' comensal' : ' comensales') + ' · ' + (ocupadas[m.id] ? 'ocupada' : 'libre')));
    fila.appendChild(info);

    var tools = el('div', 'mesa__tools');

    var edit = el('button', 'icon-btn');
    edit.type = 'button';
    edit.setAttribute('aria-label', 'Editar la mesa ' + m.id);
    edit.appendChild(svg(ICONO_EDITAR, 16));
    edit.addEventListener('click', function () {
      editando = editando === m.id ? null : m.id;
      pintarMesas();
    });
    tools.appendChild(edit);

    var del = el('button', 'icon-btn icon-btn--no');
    del.type = 'button';
    del.setAttribute('aria-label', 'Eliminar la mesa ' + m.id);
    del.appendChild(svg(ICONO_BORRAR, 16));
    del.addEventListener('click', function () { borrarMesa(m.id); });
    tools.appendChild(del);

    fila.appendChild(tools);
    return fila;
  }

  function formEdicion(m) {
    var form = el('form', 'mesa-form is-inline');

    var grid = el('div', 'mesa-form__grid');

    var fz = el('div', 'field');
    var lz = el('label', null, 'Zona');
    lz.setAttribute('for', 'editZona');
    var sz = el('select');
    sz.id = 'editZona';
    ['Sala', 'Ventana', 'Terraza', 'Sala de abajo', 'Barra'].forEach(function (z) {
      var o = el('option', null, z);
      if (z === m.zona) o.selected = true;
      sz.appendChild(o);
    });
    if (['Sala', 'Ventana', 'Terraza', 'Sala de abajo', 'Barra'].indexOf(m.zona) === -1) {
      var propia = el('option', null, m.zona);
      propia.selected = true;
      sz.appendChild(propia);
    }
    fz.appendChild(lz);
    fz.appendChild(sz);

    var fc = el('div', 'field');
    var lc = el('label', null, 'Capacidad');
    lc.setAttribute('for', 'editCap');
    var ic = el('input');
    ic.id = 'editCap';
    ic.type = 'number';
    ic.min = '1';
    ic.max = '20';
    ic.value = String(m.cap);
    ic.inputMode = 'numeric';
    fc.appendChild(lc);
    fc.appendChild(ic);

    grid.appendChild(fz);
    grid.appendChild(fc);
    form.appendChild(grid);

    var row = el('div', 'mesa-form__row');
    var guardar = el('button', 'btn btn--ember', 'Guardar');
    guardar.type = 'submit';
    var cancelar = el('button', 'btn btn--ghost', 'Cancelar');
    cancelar.type = 'button';
    cancelar.addEventListener('click', function () { editando = null; pintarMesas(); });
    row.appendChild(guardar);
    row.appendChild(cancelar);
    form.appendChild(row);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var cap = parseInt(ic.value, 10);
      m.zona = sz.value;
      m.cap = (cap > 0 && cap <= 20) ? cap : m.cap;
      editando = null;
      pintar();
      aviso('Mesa ' + m.id + ' actualizada');
    });

    return form;
  }

  function pintarMesas() {
    listaMesas.innerHTML = '';
    var ocupadas = mesasOcupadas();

    mesas.forEach(function (m) {
      listaMesas.appendChild(filaMesa(m, ocupadas));
      if (editando === m.id) listaMesas.appendChild(formEdicion(m));
    });

    if (!mesas.length) {
      listaMesas.appendChild(el('p', 'vacio', 'No hay mesas dadas de alta.'));
    }
  }

  function borrarMesa(id) {
    var sueltas = 0;
    reservas.forEach(function (r) {
      if (r.mesa === id) { r.mesa = null; sueltas++; }
    });
    mesas = mesas.filter(function (m) { return m.id !== id; });
    if (editando === id) editando = null;

    pintar();
    aviso(sueltas
      ? 'Mesa ' + id + ' eliminada · ' + sueltas + ' reserva(s) sin mesa'
      : 'Mesa ' + id + ' eliminada');
  }

  /* --- alta de mesa -------------------------------------------------------- */

  var addToggle = $('#addToggle');
  var addForm   = $('#addForm');

  function abrirAlta(abrir) {
    addForm.hidden = !abrir;
    addToggle.setAttribute('aria-expanded', String(abrir));
    if (abrir) $('#addZona').focus();
  }

  addToggle.addEventListener('click', function () {
    abrirAlta(addForm.hidden);
  });

  $('#addCancel').addEventListener('click', function () {
    abrirAlta(false);
    addToggle.focus();
  });

  addForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var cap = parseInt($('#addCap').value, 10);
    if (!cap || cap < 1 || cap > 20) {
      aviso('La capacidad tiene que estar entre 1 y 20');
      return;
    }
    mesas.push({ id: proximoIdMesa, zona: $('#addZona').value, cap: cap });
    aviso('Mesa ' + proximoIdMesa + ' añadida en ' + $('#addZona').value);
    proximoIdMesa++;
    abrirAlta(false);
    pintar();
  });

  /* --- mensaje al cliente --------------------------------------------------
     Genera el texto con los datos de la reserva y lo deja listo para copiar,
     mandar por WhatsApp (wa.me, el enlace público de toda la vida) o por
     correo. Nunca envía nada por su cuenta: abre la app y el encargado decide.
     -------------------------------------------------------------------- */

  var PLANTILLAS = {
    confirmacion: function (r) {
      return 'Hola ' + r.nombre + ', tu reserva en Restaurante La Brasa para ' +
             r.personas + ' personas el ' + fechaMensaje(r) + ' a las ' + r.hora +
             ' está confirmada. ¡Te esperamos! Si necesitas cambiar algo, ' +
             'responde a este mensaje.';
    },
    recordatorio: function (r) {
      return 'Hola ' + r.nombre + ', te recordamos tu reserva en La Brasa el ' +
             fechaMensaje(r) + ' a las ' + r.hora + ' para ' + r.personas +
             ' personas. Si no pudieras venir, avísanos por favor. ¡Gracias!';
    }
  };

  var COLETILLA_GRUPO = 'Al ser un grupo grande, confírmanos por favor un día antes.';
  var ASUNTO = 'Tu reserva en Restaurante La Brasa';

  var hoja       = $('#sheet');
  var hojaFondo  = $('#sheetBack');
  var hojaSub    = $('#sheetSub');
  var hojaTexto  = $('#sheetTexto');
  var btnCopiar  = $('#btnCopiar');
  var btnWa      = $('#btnWa');
  var btnMail    = $('#btnMail');
  var plantillas = document.querySelectorAll('#plantillas button');

  var reservaActual = null;
  var plantillaActual = 'confirmacion';
  var devolverFoco = null;
  var copiarTimer = null;
  var abiertaEn = 0;

  var MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
                      'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var DIAS_LARGOS  = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

  /* La fecha del mensaje es la de esa reserva, no la de hoy */
  function fechaMensaje(r) {
    var d = r && r.fecha ? diaDesdeClave(r.fecha) : new Date();
    return DIAS_LARGOS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES_LARGOS[d.getMonth()];
  }

  function componerMensaje(r, tipo) {
    var texto = PLANTILLAS[tipo](r);
    var mesa = mesaPorId(r.mesa);

    if (mesa) texto += ' Te guardamos la mesa ' + mesa.id + ' (' + mesa.zona + ').';
    if (r.personas > 6) texto += '\n\n' + COLETILLA_GRUPO;

    return texto;
  }

  /* wa.me quiere el número sin símbolos y con prefijo de país */
  function telefonoWa(tel) {
    var digitos = (tel || '').replace(/\D/g, '');
    if (!digitos) return '';
    return digitos.length === 9 ? '34' + digitos : digitos;
  }

  function abrirMensaje(r) {
    reservaActual = r;
    plantillaActual = 'confirmacion';
    devolverFoco = document.activeElement;

    hojaSub.textContent = r.nombre + ' · ' + r.personas +
      (r.personas === 1 ? ' persona' : ' personas') + ' · ' + r.hora;

    Array.prototype.forEach.call(plantillas, function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.tpl === plantillaActual));
    });

    refrescarTexto();

    btnWa.disabled = !telefonoWa(r.tel);
    btnMail.disabled = !r.email;
    btnMail.title = r.email ? 'Escribir a ' + r.email : 'Esta reserva no tiene correo';

    /* La entrada la anima el CSS al quitar [hidden]: nada que temporizar */
    hojaFondo.hidden = false;
    hoja.hidden = false;
    abiertaEn = Date.now();

    document.addEventListener('keydown', teclasHoja);
    plantillas[0].focus();
  }

  function cerrarMensaje() {
    document.removeEventListener('keydown', teclasHoja);
    hoja.hidden = true;
    hojaFondo.hidden = true;
    reservaActual = null;
    if (devolverFoco && devolverFoco.focus) devolverFoco.focus();
  }

  /* Esc cierra y el tabulador no se escapa de la hoja */
  function teclasHoja(e) {
    if (e.key === 'Escape') { e.preventDefault(); cerrarMensaje(); return; }
    if (e.key !== 'Tab') return;

    var focos = hoja.querySelectorAll('button:not(:disabled), textarea, [href]');
    if (!focos.length) return;

    var primero = focos[0];
    var ultimo = focos[focos.length - 1];

    if (e.shiftKey && document.activeElement === primero) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primero.focus();
    }
  }

  function refrescarTexto() {
    if (reservaActual) hojaTexto.value = componerMensaje(reservaActual, plantillaActual);
  }

  Array.prototype.forEach.call(plantillas, function (b) {
    b.addEventListener('click', function () {
      plantillaActual = b.dataset.tpl;
      Array.prototype.forEach.call(plantillas, function (o) {
        o.setAttribute('aria-pressed', String(o === b));
      });
      refrescarTexto();
    });
  });

  $('#sheetClose').addEventListener('click', cerrarMensaje);

  /* El fondo cierra, pero no en los primeros milisegundos: el mismo toque que
     abre la hoja llega al fondo recién puesto (el "click fantasma" del móvil)
     y la cerraría de inmediato. */
  hojaFondo.addEventListener('click', function () {
    if (Date.now() - abiertaEn < 350) return;
    cerrarMensaje();
  });

  btnCopiar.addEventListener('click', function () {
    copiarTexto(hojaTexto.value, btnCopiar, 'Mensaje copiado');
  });

  btnWa.addEventListener('click', function () {
    if (!reservaActual) return;
    var url = 'https://wa.me/' + telefonoWa(reservaActual.tel) +
              '?text=' + encodeURIComponent(hojaTexto.value);
    window.open(url, '_blank', 'noopener');
  });

  btnMail.addEventListener('click', function () {
    if (!reservaActual || !reservaActual.email) return;
    window.location.href = 'mailto:' + encodeURIComponent(reservaActual.email) +
      '?subject=' + encodeURIComponent(ASUNTO) +
      '&body=' + encodeURIComponent(hojaTexto.value);
  });

  /* --- enlace de reservas + QR ---------------------------------------------
     La URL se saca de dónde está el panel, así que el QR apunta siempre al
     sitio donde esté publicado (GitHub Pages, un dominio propio o localhost).
     -------------------------------------------------------------------- */

  function urlDeReservas() {
    return new URL('reserva.html', window.location.href).href;
  }

  function pintarEnlace() {
    var url = urlDeReservas();
    var lienzo = $('#qrLienzo');

    $('#urlReserva').textContent = url.replace(/^https?:\/\//, '');

    lienzo.innerHTML = '';
    try {
      lienzo.appendChild(window.QRDemo.svg(url, {
        etiqueta: 'Código QR de la página de reservas'
      }));
    } catch (e) {
      lienzo.appendChild(el('p', 'qr__fallo', 'No se ha podido pintar el QR. El enlace de abajo sigue valiendo.'));
    }

    /* El cartel imprimible lleva su propio QR: en negro puro sobre blanco,
       que es lo que se lee bien en papel. */
    var cartelQr = $('#cartelQr');
    cartelQr.innerHTML = '';
    try {
      cartelQr.appendChild(window.QRDemo.svg(url, {
        oscuro: '#000000',
        claro: '#ffffff',
        etiqueta: 'Código QR para reservar mesa'
      }));
    } catch (e) { /* si el QR falla, el cartel sale con la URL a secas */ }

    $('#cartelUrl').textContent = url.replace(/^https?:\/\//, '');

    $('#btnCopiarUrl').addEventListener('click', function () {
      copiarTexto(url, $('#btnCopiarUrl'), 'Enlace copiado');
    });

    $('#btnPng').addEventListener('click', function () { descargarPng(url); });

    $('#btnCartel').addEventListener('click', function () {
      /* El aviso va antes: window.print() bloquea hasta que se cierre */
      aviso('Elige «Guardar como PDF» en el diálogo');
      setTimeout(function () { window.print(); }, 60);
    });
  }

  /* --- descarga del QR en PNG ----------------------------------------------
     Se rasteriza el SVG del QR sobre un lienzo de 1024 px, siempre negro sobre
     blanco: un QR claro sobre fondo oscuro muchos lectores no lo cogen.
     -------------------------------------------------------------------- */

  var LADO_PNG = 1024;

  function descargarPng(url) {
    var svgEl;

    try {
      svgEl = window.QRDemo.svg(url, { oscuro: '#000000', claro: '#ffffff' });
    } catch (e) {
      aviso('No se ha podido generar el QR');
      return;
    }

    svgEl.setAttribute('width', LADO_PNG);
    svgEl.setAttribute('height', LADO_PNG);

    var blob = new Blob([new XMLSerializer().serializeToString(svgEl)],
                        { type: 'image/svg+xml;charset=utf-8' });
    var fuente = URL.createObjectURL(blob);
    var img = new Image();

    img.onload = function () {
      URL.revokeObjectURL(fuente);
      guardarLienzo(lienzoBlanco(function (cx) {
        cx.drawImage(img, 0, 0, LADO_PNG, LADO_PNG);
      }));
    };

    /* Si el navegador no rasteriza el SVG, pintamos los módulos a mano */
    img.onerror = function () {
      URL.revokeObjectURL(fuente);
      guardarLienzo(lienzoDesdeMatriz(url));
    };

    img.src = fuente;
  }

  function lienzoBlanco(pintar) {
    var cv = document.createElement('canvas');
    cv.width = LADO_PNG;
    cv.height = LADO_PNG;

    var cx = cv.getContext('2d');
    cx.fillStyle = '#ffffff';
    cx.fillRect(0, 0, LADO_PNG, LADO_PNG);
    pintar(cx);

    return cv;
  }

  function lienzoDesdeMatriz(url) {
    var mod = window.QRDemo.matriz(url);
    var margen = 4;
    var total = mod.length + margen * 2;
    var paso = LADO_PNG / total;

    return lienzoBlanco(function (cx) {
      cx.fillStyle = '#000000';
      for (var f = 0; f < mod.length; f++) {
        for (var c = 0; c < mod.length; c++) {
          if (mod[f][c]) {
            cx.fillRect(Math.round((c + margen) * paso), Math.round((f + margen) * paso),
                        Math.ceil(paso), Math.ceil(paso));
          }
        }
      }
    });
  }

  function guardarLienzo(cv) {
    cv.toBlob(function (png) {
      if (!png) { aviso('No se ha podido crear el PNG'); return; }

      var enlace = document.createElement('a');
      enlace.href = URL.createObjectURL(png);
      enlace.download = 'qr-reservas.png';
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();

      setTimeout(function () { URL.revokeObjectURL(enlace.href); }, 1000);
      aviso('QR descargado');
    }, 'image/png');
  }

  /* --- portapapeles --------------------------------------------------------- */

  function copiarTexto(texto, boton, mensaje) {
    var etiqueta = boton.textContent;

    var hecho = function () {
      boton.textContent = 'Copiado';
      aviso(mensaje);
      clearTimeout(copiarTimer);
      copiarTimer = setTimeout(function () { boton.textContent = etiqueta; }, 2000);
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(texto).then(hecho, function () { copiaManual(texto, hecho); });
    } else {
      copiaManual(texto, hecho);
    }
  }

  /* Reserva para contextos sin portapapeles (file://, navegadores viejos) */
  function copiaManual(texto, hecho) {
    var area = document.createElement('textarea');
    area.value = texto;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();

    try {
      if (document.execCommand('copy')) { hecho(); return; }
      aviso('Copia el texto a mano, por favor');
    } catch (e) {
      aviso('Copia el texto a mano, por favor');
    } finally {
      area.remove();
    }
  }

  /* --- selector de día ------------------------------------------------------
     Cambia el día que enseña el cuadro de reservas. Sigue todo en memoria.
     -------------------------------------------------------------------- */

  var DIAS_CORTOS  = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  var MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul',
                      'ago', 'sep', 'oct', 'nov', 'dic'];

  var etiquetaDia = $('#diaEtiqueta');
  var entradaDia  = $('#diaInput');

  function diaBonito(clave) {
    var d = diaDesdeClave(clave);
    var corto = DIAS_CORTOS[d.getDay()] + ' ' + d.getDate() + ' ' + MESES_CORTOS[d.getMonth()];
    return clave === claveDia(diaDesplazado(0)) ? 'Hoy · ' + corto : corto;
  }

  function irADia(clave) {
    diaSel = clave;
    entradaDia.value = clave;
    etiquetaDia.textContent = diaBonito(clave);

    Array.prototype.forEach.call(document.querySelectorAll('.dias__chip'), function (b) {
      b.setAttribute('aria-pressed', String(clave === claveDia(diaDesplazado(Number(b.dataset.salto)))));
    });

    pintarKpis();
    pintarReservas();
  }

  function moverDia(saltos) {
    var d = diaDesdeClave(diaSel);
    d.setDate(d.getDate() + saltos);
    irADia(claveDia(d));
  }

  $('#diaAnterior').addEventListener('click', function () { moverDia(-1); });
  $('#diaSiguiente').addEventListener('click', function () { moverDia(1); });

  Array.prototype.forEach.call(document.querySelectorAll('.dias__chip'), function (b) {
    b.addEventListener('click', function () {
      irADia(claveDia(diaDesplazado(Number(b.dataset.salto))));
    });
  });

  entradaDia.addEventListener('change', function () {
    if (entradaDia.value) irADia(entradaDia.value);
    else irADia(diaSel);                    /* si lo vacían, se queda donde estaba */
  });

  /* --- filtros y navegación ------------------------------------------------ */

  Array.prototype.forEach.call(document.querySelectorAll('#filtros button'), function (b) {
    b.addEventListener('click', function () {
      filtro = b.dataset.turno;
      Array.prototype.forEach.call(document.querySelectorAll('#filtros button'), function (o) {
        o.setAttribute('aria-pressed', String(o === b));
      });
      pintarReservas();
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll('.tabbar a[data-view]'), function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var destino = a.dataset.view;
      Array.prototype.forEach.call(document.querySelectorAll('.view'), function (v) {
        v.hidden = v.id !== destino;
      });
      Array.prototype.forEach.call(document.querySelectorAll('.tabbar a'), function (o) {
        if (o === a) o.setAttribute('aria-current', 'page');
        else o.removeAttribute('aria-current');
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  /* --- arranque ------------------------------------------------------------ */

  function fechaDeHoy() {
    var dias  = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    var meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
                 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    var d = new Date();
    return dias[d.getDay()] + ' ' + d.getDate() + ' ' + meses[d.getMonth()];
  }

  function pintar() {
    pintarKpis();
    pintarReservas();
    pintarMesas();
  }

  $('#hoyFecha').textContent = fechaDeHoy();
  pintarEnlace();
  irADia(diaSel);
  pintar();
})();
