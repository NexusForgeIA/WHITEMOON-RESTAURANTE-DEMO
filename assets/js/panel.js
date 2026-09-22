/* ==========================================================================
   Restaurante WhiteMoon · panel del dueño

   Los datos son reales: reservas, mesas y configuración salen de la edge
   function reservas-mt y las escrituras vuelven allí. Lo único de demo que
   queda es el acceso, con una clave sencilla guardada en sessionStorage.
   ========================================================================== */

(function () {
  'use strict';

  /* --- backend --------------------------------------------------------------
     El panel ya no inventa nada: lee y escribe contra la edge function.
     -------------------------------------------------------------------- */

  var API   = 'https://mlaqtniujnvfxcvcourm.supabase.co/functions/v1/reservas-mt';
  var CLAVE_GUARDADA = 'wm-reservas-clave';
  var SEDE_GUARDADA  = 'wm-reservas-sede';

  /* Marca con varias sedes. Vacío = un solo restaurante: el panel se comporta
     exactamente igual que antes, sin selector y con TOKEN fijo. Con valor, las
     sedes las da el servidor en panel_sedes y TOKEN pasa a ser la sede activa. */
  var GRUPO = 'labrasa-demo';

  /* Deja de ser constante en modo marca: lo reescribe la sede elegida */
  var TOKEN = 'demo-restaurante';

  /* La clave del panel vive en sessionStorage. En github.io el almacenamiento
     es del origen entero (lo comparten todos los repos del usuario), pero aquí
     es dato de demo y la clave no es un secreto. En un cliente de verdad esto
     va con login de Supabase Auth y dominio propio. */
  var panelKey = '';

  try {
    panelKey = window.sessionStorage.getItem(CLAVE_GUARDADA) || '';
  } catch (e) { panelKey = ''; }

  /* Datos del día que se está mirando, tal y como los manda el servidor */
  var reservas = [];
  var mesas = [];
  var config = {};

  /* Sedes de la marca. En modo sede única se queda vacío */
  var sedes = [];

  function api(action, extra) {
    var cuerpo = { token: TOKEN, panel_key: panelKey, action: action };

    for (var k in extra) {
      if (Object.prototype.hasOwnProperty.call(extra, k)) cuerpo[k] = extra[k];
    }

    return fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo)
    }).then(function (r) {
      if (r.status === 401) {
        cerrarSesion('La clave ya no vale. Entra otra vez.');
        return { error: 'no_autorizado', http: 401 };
      }
      return r.json().catch(function () { return { error: 'respuesta_ilegible' }; });
    }).catch(function (e) {
      /* fetch solo rechaza por red; cualquier otra cosa es un fallo nuestro y
         no conviene disfrazarlo de "sin conexión" */
      if (e instanceof TypeError) return { error: 'sin_red' };
      if (window.console) window.console.error('panel:', action, e);
      return { error: 'fallo_cliente' };
    });
  }

  /* Toda escritura pasa por aquí: avisa del resultado y recarga el día */
  function escribir(action, extra, mensajeOk) {
    return api(action, extra).then(function (res) {
      if (res && res.ok) {
        if (mensajeOk) aviso(mensajeOk);
        return cargarDia(diaSel).then(function () { return res; });
      }
      if (res && res.error === 'sin_red') aviso('Sin conexión: no se ha guardado');
      else if (res && res.error !== 'no_autorizado') aviso('No se ha podido guardar');
      return res;
    });
  }

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

  var filtro = 'todo';
  var diaSel = claveDia(diaDesplazado(0));
  var editando = null;   /* id de la mesa que se está editando */

  var ESTADOS = {
    pendiente:  'Pendiente',
    confirmada: 'Confirmada',
    sentada:    'Sentada',
    completada: 'Completada',
    no_show:    'No vino',
    cancelada:  'Cancelada'
  };

  /* Ni las canceladas ni las que no vinieron cuentan para el cuadro de mando */
  var NO_CUENTAN = { cancelada: true, no_show: true };

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

  /* El servidor ya manda solo las del día pedido */
  function reservasDelDia() {
    return reservas;
  }

  function activas() {
    return reservas.filter(function (r) { return !NO_CUENTAN[r.estado]; });
  }

  /* Sin lista, mira todas las reservas: es lo que necesita la vista de Mesas */
  function mesasOcupadas(lista) {
    var ids = {};
    (lista || reservas).forEach(function (r) {
      if (r.estado === 'sentada' && r.mesa_id) ids[r.mesa_id] = true;
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
    var card = el('article', 'res' + (NO_CUENTAN[r.estado] ? ' is-cancelada' : ''));

    var top = el('div', 'res__top');
    top.appendChild(el('span', 'res__hora', r.hora));

    var who = el('div', 'res__who');
    who.appendChild(el('p', 'res__nombre', r.cliente_nombre || 'Sin nombre'));

    var mesa = mesaPorId(r.mesa_id);

    /* Sin mesa asignada todavía, se enseña la zona que pidió el cliente */
    var sitio = mesa ? mesa.nombre + ' (' + mesa.zona + ')'
              : (r.zona_preferida ? r.zona_preferida + ' (pedida)' : 'Sin mesa asignada');

    var meta = r.personas + (r.personas === 1 ? ' persona' : ' personas') +
               ' · ' + sitio + ' · ' + (r.origen || 'panel');
    who.appendChild(el('p', 'res__meta', meta));

    if (r.notas) who.appendChild(el('p', 'res__nota', r.notas));
    top.appendChild(who);

    top.appendChild(el('span', 'badge badge--' + r.estado, ESTADOS[r.estado] || r.estado));
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
      b.setAttribute('aria-label', a.texto + ' la reserva de ' + r.cliente_nombre);
      if (r.estado === a.estado) {
        b.disabled = true;
      } else {
        b.addEventListener('click', function () { cambiarEstado(r.id, a.estado); });
      }
      acciones.appendChild(b);
    });
    card.appendChild(acciones);

    /* Una reserva cancelada no necesita que le escribamos */
    if (!NO_CUENTAN[r.estado]) {
      var msg = el('button', 'res__msg');
      msg.type = 'button';
      msg.setAttribute('aria-label', 'Escribir a ' + r.cliente_nombre);
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
    var pax = lista.reduce(function (t, r) { return NO_CUENTAN[r.estado] ? t : t + r.personas; }, 0);
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

    escribir('panel_estado', { id: id, estado: estado },
             r.cliente_nombre + ' · ' + ESTADOS[estado].toLowerCase());
  }

  /* --- pintado: mesas ----------------------------------------------------- */

  var ICONO_MENSAJE = '<path d="M13.5 9.5a1.5 1.5 0 01-1.5 1.5H6l-3 2.5V4a1.5 1.5 0 011.5-1.5h7A1.5 1.5 0 0113.5 4v5.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>';
  var ICONO_EDITAR  = '<path d="M11.1 2.4l2.5 2.5L6 12.5l-3.2.7.7-3.2 7.6-7.6z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>';
  var ICONO_BORRAR  = '<path d="M3 4.5h10M6.5 4.5V3h3v1.5M5 4.5l.6 8.2h4.8L11 4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>';

  /* El servidor identifica las mesas por uuid; en el cuadradito va su número */
  function numeroMesa(m) {
    var cifras = (m.nombre || '').match(/\d+/);
    return cifras ? cifras[0] : (m.nombre || '?').slice(0, 2);
  }

  function filaMesa(m, ocupadas) {
    var fila = el('div', 'mesa' + (ocupadas[m.id] ? ' is-ocupada' : ''));

    fila.appendChild(el('span', 'mesa__id', numeroMesa(m)));

    var info = el('div', 'mesa__info');
    info.appendChild(el('p', 'mesa__zona', m.nombre + ' · ' + m.zona));
    info.appendChild(el('p', 'mesa__cap',
      m.capacidad + (m.capacidad === 1 ? ' comensal' : ' comensales') +
      ' · ' + (ocupadas[m.id] ? 'ocupada' : 'libre')));
    fila.appendChild(info);

    var tools = el('div', 'mesa__tools');

    var edit = el('button', 'icon-btn');
    edit.type = 'button';
    edit.setAttribute('aria-label', 'Editar la ' + m.nombre);
    edit.appendChild(svg(ICONO_EDITAR, 16));
    edit.addEventListener('click', function () {
      editando = editando === m.id ? null : m.id;
      pintarMesas();
    });
    tools.appendChild(edit);

    var del = el('button', 'icon-btn icon-btn--no');
    del.type = 'button';
    del.setAttribute('aria-label', 'Eliminar la ' + m.nombre);
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
    zonas(m.zona).forEach(function (z) {
      var o = el('option', null, z);
      if (z === m.zona) o.selected = true;
      sz.appendChild(o);
    });
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
    ic.value = String(m.capacidad);
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
      if (!cap || cap < 1 || cap > 20) {
        aviso('La capacidad tiene que estar entre 1 y 20');
        return;
      }
      editando = null;
      /* Se reenvían activa y orden: si no van, el servidor los deja vacíos y la
         mesa se descoloca en la lista */
      escribir('panel_mesa_guardar',
        { id: m.id, nombre: m.nombre, zona: sz.value, capacidad: cap,
          activa: m.activa !== false, orden: m.orden },
        m.nombre + ' actualizada');
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
    var m = mesaPorId(id);
    if (editando === id) editando = null;
    escribir('panel_mesa_borrar', { id: id }, (m ? m.nombre : 'Mesa') + ' eliminada');
  }

  /* Las zonas las manda config; se añade la propia por si no está en la lista */
  function zonas(actual) {
    var lista = (config.zonas && config.zonas.length)
      ? config.zonas.slice()
      : ['Interior', 'Ventana', 'Terraza', 'Barra'];

    if (actual && lista.indexOf(actual) === -1) lista.push(actual);
    return lista;
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

    var nombre = 'Mesa ' + (siguienteNumeroMesa());
    abrirAlta(false);
    escribir('panel_mesa_guardar',
      { nombre: nombre, zona: $('#addZona').value, capacidad: cap, activa: true,
        orden: mesas.length + 1 },
      nombre + ' añadida en ' + $('#addZona').value);
  });

  /* Numera la mesa nueva a partir de las que ya hay */
  function siguienteNumeroMesa() {
    var alto = 0;
    mesas.forEach(function (m) {
      var n = parseInt(numeroMesa(m), 10);
      if (n > alto) alto = n;
    });
    return alto + 1;
  }

  /* El desplegable de zonas del alta se rellena con lo que diga config */
  function pintarZonasAlta() {
    var sel = $('#addZona');
    var elegida = sel.value;

    sel.innerHTML = '';
    zonas('').forEach(function (z) {
      var o = el('option', null, z);
      if (z === elegida) o.selected = true;
      sel.appendChild(o);
    });
  }

  /* --- alta manual de reserva ----------------------------------------------
     La que coge el restaurante por teléfono o en la puerta. Va al día que se
     esté mirando.
     -------------------------------------------------------------------- */

  var altaToggle = $('#altaToggle');
  var altaForm   = $('#altaForm');

  function abrirAltaReserva(abrir) {
    altaForm.hidden = !abrir;
    altaToggle.setAttribute('aria-expanded', String(abrir));
    if (abrir) $('#altaTurno').focus();
  }

  altaToggle.addEventListener('click', function () {
    abrirAltaReserva(altaForm.hidden);
  });

  $('#altaCancelar').addEventListener('click', function () {
    abrirAltaReserva(false);
    altaToggle.focus();
  });

  /* La hora por defecto sigue al turno elegido */
  $('#altaTurno').addEventListener('change', function () {
    $('#altaHora').value = this.value === 'cena' ? '20:30' : '13:30';
  });

  altaForm.addEventListener('submit', function (e) {
    e.preventDefault();

    var nombre   = $('#altaNombre').value.trim();
    var personas = parseInt($('#altaPersonas').value, 10);
    var hora     = $('#altaHora').value;

    if (!nombre) { aviso('Ponle un nombre a la reserva'); return; }
    if (!personas || personas < 1) { aviso('¿Cuántas personas son?'); return; }
    if (!hora) { aviso('Falta la hora'); return; }

    abrirAltaReserva(false);

    escribir('panel_alta', {
      fecha: diaSel,
      turno: $('#altaTurno').value,
      hora: hora,
      personas: personas,
      nombre: nombre,
      telefono: $('#altaTelefono').value.trim(),
      origen: 'panel'
    }, nombre + ' · reserva añadida').then(function (res) {
      if (res && res.ok) {
        $('#altaNombre').value = '';
        $('#altaTelefono').value = '';
        $('#altaPersonas').value = '2';
      } else if (res && res.motivo === 'sin_aforo') {
        aviso('Ese turno está completo');
      }
    });
  });

  /* --- mensaje al cliente --------------------------------------------------
     Genera el texto con los datos de la reserva y lo deja listo para copiar,
     mandar por WhatsApp (wa.me, el enlace público de toda la vida) o por
     correo. Nunca envía nada por su cuenta: abre la app y el encargado decide.
     -------------------------------------------------------------------- */

  var PLANTILLAS = {
    confirmacion: function (r) {
      return 'Hola ' + r.cliente_nombre + ', tu reserva en Restaurante WhiteMoon para ' +
             r.personas + ' personas el ' + fechaMensaje(r) + ' a las ' + r.hora +
             ' está confirmada. ¡Te esperamos! Si necesitas cambiar algo, ' +
             'responde a este mensaje.';
    },
    recordatorio: function (r) {
      return 'Hola ' + r.cliente_nombre + ', te recordamos tu reserva en Restaurante WhiteMoon el ' +
             fechaMensaje(r) + ' a las ' + r.hora + ' para ' + r.personas +
             ' personas. Si no pudieras venir, avísanos por favor. ¡Gracias!';
    }
  };

  var COLETILLA_GRUPO = 'Al ser un grupo grande, confírmanos por favor un día antes.';
  var ASUNTO = 'Tu reserva en Restaurante WhiteMoon';

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
    var mesa = mesaPorId(r.mesa_id);

    if (mesa) texto += ' Te guardamos la ' + mesa.nombre + ' (' + mesa.zona + ').';
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

    hojaSub.textContent = r.cliente_nombre + ' · ' + r.personas +
      (r.personas === 1 ? ' persona' : ' personas') + ' · ' + r.hora;

    Array.prototype.forEach.call(plantillas, function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.tpl === plantillaActual));
    });

    refrescarTexto();

    btnWa.disabled = !telefonoWa(r.cliente_telefono);
    btnMail.disabled = !r.cliente_email;
    btnMail.title = r.cliente_email
      ? 'Escribir a ' + r.cliente_email
      : 'Esta reserva no tiene correo';

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
    var url = 'https://wa.me/' + telefonoWa(reservaActual.cliente_telefono) +
              '?text=' + encodeURIComponent(hojaTexto.value);
    window.open(url, '_blank', 'noopener');
  });

  btnMail.addEventListener('click', function () {
    if (!reservaActual || !reservaActual.cliente_email) return;
    window.location.href = 'mailto:' + encodeURIComponent(reservaActual.cliente_email) +
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

    /* Sin sesión todavía no se pide nada: ya lo hará al entrar */
    if (panelKey) cargarDia(clave);
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

  /* --- sedes de la marca ----------------------------------------------------
     Solo en modo marca (GRUPO con valor). La sede activa es TOKEN, así que no
     hay que tocar api(): toda lectura y toda escritura van ya a la sede que
     esté elegida.
     -------------------------------------------------------------------- */

  var sedeSel = $('#sedeSel');

  function esSedeConocida(tenant) {
    for (var i = 0; i < sedes.length; i++) if (sedes[i].tenant === tenant) return true;
    return false;
  }

  function guardarSede(tenant) {
    try { window.sessionStorage.setItem(SEDE_GUARDADA, tenant); } catch (e) {}
  }

  /* La sede de la última vez si sigue en la lista; si no, la primera */
  function sedeInicial() {
    var guardada = '';
    try { guardada = window.sessionStorage.getItem(SEDE_GUARDADA) || ''; } catch (e) {}
    return esSedeConocida(guardada) ? guardada : sedes[0].tenant;
  }

  /* Con una sola sede el selector sobra: no hay nada que elegir */
  function pintarSedes() {
    sedeSel.innerHTML = '';

    sedes.forEach(function (s) {
      var o = el('option', null, s.ciudad || s.tenant);
      o.value = s.tenant;
      if (s.tenant === TOKEN) o.selected = true;
      sedeSel.appendChild(o);
    });

    sedeSel.hidden = sedes.length < 2;
  }

  function cambiarSede(tenant) {
    if (!tenant || tenant === TOKEN) return;

    TOKEN = tenant;
    guardarSede(tenant);
    cargarDia(diaSel);
  }

  sedeSel.addEventListener('change', function () { cambiarSede(sedeSel.value); });

  /* --- carga del día --------------------------------------------------------
     Una llamada por día: el servidor devuelve reservas, mesas y config.
     -------------------------------------------------------------------- */

  var cargando = false;

  /* Respuesta de panel_listar → estado y pintado */
  function volcar(res) {
    reservas = res.reservas || [];
    mesas    = res.mesas || [];
    config   = res.config || {};

    pintarZonasAlta();
    pintar();
  }

  function cargarDia(fecha) {
    if (cargando) return Promise.resolve();
    cargando = true;

    listaReservas.setAttribute('aria-busy', 'true');

    return api('panel_listar', { fecha: fecha }).then(function (res) {
      cargando = false;
      listaReservas.removeAttribute('aria-busy');

      if (!res || !res.ok) {
        if (res && res.error === 'sin_red') aviso('Sin conexión con el restaurante');
        else if (res && res.error !== 'no_autorizado') aviso('No se han podido cargar las reservas');
        return res;
      }

      volcar(res);
      return res;
    });
  }

  /* --- acceso al panel ------------------------------------------------------
     Demo: una clave sencilla que se guarda en sessionStorage. Ver el comentario
     de arriba sobre por qué aquí vale y en un cliente real no.
     -------------------------------------------------------------------- */

  var acceso      = $('#acceso');
  var accesoForm  = $('#accesoForm');
  var accesoClave = $('#accesoClave');
  var accesoError = $('#accesoError');

  function pedirClave(motivo) {
    acceso.hidden = false;
    accesoError.textContent = motivo || '';
    accesoClave.value = '';
    accesoClave.focus();
  }

  function cerrarSesion(motivo) {
    panelKey = '';
    try { window.sessionStorage.removeItem(CLAVE_GUARDADA); } catch (e) {}
    pedirClave(motivo);
  }

  /* Clave buena: se guarda y se quita el acceso de en medio */
  function sesionAbierta(clave) {
    try { window.sessionStorage.setItem(CLAVE_GUARDADA, clave); } catch (e) {}

    acceso.hidden = true;
    accesoError.textContent = '';
  }

  function accesoFallido(res) {
    panelKey = '';
    if (res && res.error === 'sin_red') accesoError.textContent = 'Sin conexión. Inténtalo otra vez.';
    else accesoError.textContent = 'Clave incorrecta.';
    return false;
  }

  /* Modo marca: primero las sedes de la marca, después el día de la sede
     activa. Son dos llamadas porque panel_sedes no sabe qué día se mira. */
  function entrarMarca(clave) {
    return api('panel_sedes', { grupo: GRUPO }).then(function (res) {
      if (!res || !res.ok) return accesoFallido(res);

      if (!res.sedes || !res.sedes.length) {
        /* La clave vale, pero sin sedes no hay panel que enseñar */
        panelKey = '';
        accesoError.textContent = 'Esta marca no tiene sedes configuradas.';
        return false;
      }

      sedes = res.sedes;
      TOKEN = sedeInicial();
      guardarSede(TOKEN);
      pintarSedes();

      sesionAbierta(clave);
      return cargarDia(diaSel).then(function () { return true; });
    });
  }

  function entrar(clave) {
    panelKey = clave;

    if (GRUPO) return entrarMarca(clave);

    return api('panel_listar', { fecha: diaSel }).then(function (res) {
      if (res && res.ok) {
        sesionAbierta(clave);
        volcar(res);
        return true;
      }

      return accesoFallido(res);
    });
  }

  accesoForm.addEventListener('submit', function (e) {
    e.preventDefault();

    var clave = accesoClave.value.trim();
    if (!clave) return;

    accesoError.textContent = 'Comprobando…';
    entrar(clave);
  });

  /* --- arranque del panel ---------------------------------------------------- */

  $('#hoyFecha').textContent = fechaDeHoy();
  pintarEnlace();
  irADia(diaSel);

  if (panelKey) entrar(panelKey);
  else pedirClave('');
})();
