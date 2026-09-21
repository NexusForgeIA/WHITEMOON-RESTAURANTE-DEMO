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
    { id: 101, nombre: 'Marta Ferrer',    personas: 2, hora: '13:30', turno: 'comida', mesa: 1,    estado: 'confirmada', origen: 'Asistente IA', nota: '' },
    { id: 102, nombre: 'Grupo Álvarez',   personas: 6, hora: '13:30', turno: 'comida', mesa: 5,    estado: 'sentada',    origen: 'Teléfono',     nota: 'Comida de empresa, facturan a nombre de la gestoría' },
    { id: 103, nombre: 'Luis Sanmartín',  personas: 4, hora: '14:30', turno: 'comida', mesa: 3,    estado: 'confirmada', origen: 'Asistente IA', nota: 'Una trona' },
    { id: 104, nombre: 'Claudia Rey',     personas: 2, hora: '14:30', turno: 'comida', mesa: null, estado: 'pendiente',  origen: 'Asistente IA', nota: '' },
    { id: 105, nombre: 'Familia Otero',   personas: 8, hora: '20:30', turno: 'cena',   mesa: 7,    estado: 'confirmada', origen: 'Teléfono',     nota: 'Cumpleaños, traen tarta' },
    { id: 106, nombre: 'Íñigo Pardo',     personas: 3, hora: '20:30', turno: 'cena',   mesa: 8,    estado: 'pendiente',  origen: 'Asistente IA', nota: '' },
    { id: 107, nombre: 'Nuria Casas',     personas: 2, hora: '21:00', turno: 'cena',   mesa: 2,    estado: 'confirmada', origen: 'Asistente IA', nota: 'Sin gluten' },
    { id: 108, nombre: 'Pablo Duarte',    personas: 4, hora: '21:30', turno: 'cena',   mesa: 4,    estado: 'pendiente',  origen: 'Asistente IA', nota: '' },
    { id: 109, nombre: 'Rosa Iglesias',   personas: 4, hora: '21:30', turno: 'cena',   mesa: 6,    estado: 'cancelada',  origen: 'Teléfono',     nota: 'Avisa de que le ha surgido un viaje' }
  ];

  var filtro = 'todo';
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

  function activas() {
    return reservas.filter(function (r) { return r.estado !== 'cancelada'; });
  }

  function mesasOcupadas() {
    var ids = {};
    reservas.forEach(function (r) {
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
    var ocupadas = Object.keys(mesasOcupadas()).length;

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

    return card;
  }

  function bloqueTurno(titulo, lista) {
    var frag = document.createDocumentFragment();

    var h = el('div', 'turno-h');
    h.appendChild(el('h2', null, titulo));
    var pax = lista.reduce(function (t, r) { return r.estado === 'cancelada' ? t : t + r.personas; }, 0);
    h.appendChild(el('span', null, lista.length + ' reservas · ' + pax + ' comensales'));
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

    var comida = reservas.filter(function (r) { return r.turno === 'comida'; });
    var cena   = reservas.filter(function (r) { return r.turno === 'cena'; });

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
  pintar();
})();
