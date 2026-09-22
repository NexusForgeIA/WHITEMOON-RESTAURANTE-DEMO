/* ==========================================================================
   Generador de QR mínimo — Restaurante WhiteMoon (DEMO)

   Sin librerías ni CDN: el panel tiene que poder pintar el QR aunque el
   móvil del dueño no tenga cobertura en la barra.

   Alcance a propósito corto, porque solo codificamos una URL:
     · modo byte (ISO-8859-1 / ASCII)
     · corrección de errores nivel M
     · versiones 1 a 6 (hasta 106 caracteres)

   Las versiones 7 en adelante necesitan bloque de información de versión,
   que no hace falta para una URL de este tamaño.
   ========================================================================== */

(function (global) {
  'use strict';

  /* --- aritmética en GF(256), la que usa Reed-Solomon --------------------- */

  var EXP = [];
  var LOG = [];

  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;          /* polinomio primitivo del estándar */
    }
    for (i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();

  function mul(a, b) {
    return (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];
  }

  /* Polinomio generador de grado n */
  function generador(n) {
    var p = [1];
    for (var i = 0; i < n; i++) {
      var r = [];
      for (var k = 0; k <= p.length; k++) r[k] = 0;
      for (k = 0; k < p.length; k++) {
        r[k] ^= p[k];
        r[k + 1] ^= mul(p[k], EXP[i]);
      }
      p = r;
    }
    return p;
  }

  /* Resto de dividir los datos por el generador: son los códigos de control */
  function control(datos, n) {
    var gen = generador(n);
    var res = datos.slice();
    var i, j;

    for (i = 0; i < n; i++) res.push(0);

    for (i = 0; i < datos.length; i++) {
      var coef = res[i];
      if (coef === 0) continue;
      for (j = 0; j < gen.length; j++) res[i + j] ^= mul(gen[j], coef);
    }
    return res.slice(datos.length);
  }

  /* --- tablas del estándar (solo nivel M, versiones 1-6) ------------------ */

  /* version: [códigos totales, control por bloque, nº bloques, datos por bloque] */
  var VERSIONES = {
    1: [26,  10, 1, 16],
    2: [44,  16, 1, 28],
    3: [70,  26, 1, 44],
    4: [100, 18, 2, 32],
    5: [134, 24, 2, 43],
    6: [172, 16, 4, 27]
  };

  /* Centro del único patrón de alineación de cada versión (la 1 no lleva) */
  var ALINEACION = { 2: 18, 3: 22, 4: 26, 5: 30, 6: 34 };



  function versionPara(bytes) {
    for (var v = 1; v <= 6; v++) {
      var datos = VERSIONES[v][2] * VERSIONES[v][3];
      if (bytes <= datos - 2) return v;      /* -2 = modo (4 bits) + longitud (8 bits) */
    }
    return 0;
  }

  /* --- codificación de los datos ------------------------------------------ */

  function bytesDe(texto) {
    var out = [];
    for (var i = 0; i < texto.length; i++) {
      var c = texto.charCodeAt(i);
      if (c > 255) throw new Error('QR: solo se admiten caracteres de un byte');
      out.push(c);
    }
    return out;
  }

  function codificar(texto, version) {
    var datos = bytesDe(texto);
    var info = VERSIONES[version];
    var totalDatos = info[2] * info[3];
    var bits = [];
    var i, j;

    function meter(valor, cuantos) {
      for (var k = cuantos - 1; k >= 0; k--) bits.push((valor >>> k) & 1);
    }

    meter(4, 4);                 /* modo byte */
    meter(datos.length, 8);      /* longitud, 8 bits en versiones 1-9 */
    for (i = 0; i < datos.length; i++) meter(datos[i], 8);

    /* terminador y relleno hasta completar los códigos de datos */
    var hueco = totalDatos * 8 - bits.length;
    meter(0, Math.min(4, hueco));
    while (bits.length % 8 !== 0) bits.push(0);

    var codigos = [];
    for (i = 0; i < bits.length; i += 8) {
      var b = 0;
      for (j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      codigos.push(b);
    }

    var relleno = [0xec, 0x11];
    for (i = 0; codigos.length < totalDatos; i++) codigos.push(relleno[i % 2]);

    /* troceado en bloques + control de errores, e intercalado final */
    var bloques = [];
    var controles = [];
    for (i = 0; i < info[2]; i++) {
      var trozo = codigos.slice(i * info[3], (i + 1) * info[3]);
      bloques.push(trozo);
      controles.push(control(trozo, info[1]));
    }

    var salida = [];
    for (i = 0; i < info[3]; i++) {
      for (j = 0; j < bloques.length; j++) salida.push(bloques[j][i]);
    }
    for (i = 0; i < info[1]; i++) {
      for (j = 0; j < controles.length; j++) salida.push(controles[j][i]);
    }
    return salida;
  }

  /* --- construcción de la matriz ------------------------------------------ */

  function nuevaMatriz(lado, valor) {
    var m = [];
    for (var f = 0; f < lado; f++) {
      m[f] = [];
      for (var c = 0; c < lado; c++) m[f][c] = valor;
    }
    return m;
  }

  function patronesFijos(mod, res, version) {
    var lado = mod.length;
    var f, c;

    function cuadro(f0, c0, alto, ancho, valor) {
      for (var f = f0; f < f0 + alto; f++) {
        for (var c = c0; c < c0 + ancho; c++) {
          if (f < 0 || c < 0 || f >= lado || c >= lado) continue;
          mod[f][c] = valor;
          res[f][c] = true;
        }
      }
    }

    /* Los tres ojos, con su separador blanco alrededor */
    [[0, 0], [0, lado - 7], [lado - 7, 0]].forEach(function (p) {
      cuadro(p[0] - 1, p[1] - 1, 9, 9, false);
      cuadro(p[0], p[1], 7, 7, true);
      cuadro(p[0] + 1, p[1] + 1, 5, 5, false);
      cuadro(p[0] + 2, p[1] + 2, 3, 3, true);
    });

    /* Líneas de sincronismo */
    for (c = 8; c < lado - 8; c++) {
      mod[6][c] = c % 2 === 0;  res[6][c] = true;
      mod[c][6] = c % 2 === 0;  res[c][6] = true;
    }

    /* Patrón de alineación (una sola vez en las versiones 2-6) */
    var centro = ALINEACION[version];
    if (centro) {
      cuadro(centro - 2, centro - 2, 5, 5, true);
      cuadro(centro - 1, centro - 1, 3, 3, false);
      cuadro(centro, centro, 1, 1, true);
    }

    /* Zonas reservadas para el formato + el módulo siempre oscuro */
    for (f = 0; f < 9; f++) { res[8][f] = true; res[f][8] = true; }
    for (f = 0; f < 8; f++) { res[8][lado - 1 - f] = true; res[lado - 1 - f][8] = true; }
    mod[lado - 8][8] = true;
    res[lado - 8][8] = true;
  }

  /* Recorrido en zigzag de abajo a arriba, saltando la columna 6 */
  function colocarDatos(mod, res, codigos) {
    var lado = mod.length;
    var bits = [];
    var i, j;

    for (i = 0; i < codigos.length; i++) {
      for (j = 7; j >= 0; j--) bits.push((codigos[i] >>> j) & 1);
    }

    var idx = 0;
    var dir = -1;
    var fila = lado - 1;

    for (var col = lado - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (;;) {
        for (var d = 0; d < 2; d++) {
          var cc = col - d;
          if (!res[fila][cc]) {
            mod[fila][cc] = idx < bits.length ? bits[idx++] === 1 : false;
          }
        }
        fila += dir;
        if (fila < 0 || fila >= lado) { fila -= dir; dir = -dir; break; }
      }
    }
  }

  var MASCARAS = [
    function (f, c) { return (f + c) % 2 === 0; },
    function (f)    { return f % 2 === 0; },
    function (f, c) { return c % 3 === 0; },
    function (f, c) { return (f + c) % 3 === 0; },
    function (f, c) { return (Math.floor(f / 2) + Math.floor(c / 3)) % 2 === 0; },
    function (f, c) { return (f * c) % 2 + (f * c) % 3 === 0; },
    function (f, c) { return ((f * c) % 2 + (f * c) % 3) % 2 === 0; },
    function (f, c) { return ((f + c) % 2 + (f * c) % 3) % 2 === 0; }
  ];

  function aplicarMascara(mod, res, n) {
    var fn = MASCARAS[n];
    for (var f = 0; f < mod.length; f++) {
      for (var c = 0; c < mod.length; c++) {
        if (!res[f][c] && fn(f, c)) mod[f][c] = !mod[f][c];
      }
    }
  }

  /* Formato: nivel M (00) + máscara, con su BCH y el XOR del estándar */
  function ponerFormato(mod, res, mascara) {
    var datos = mascara;                 /* nivel M = 00 en los dos bits altos */
    var rem = datos;
    var i;

    for (i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    var fmt = ((datos << 10) | rem) ^ 0x5412;

    function bit(n) { return ((fmt >>> n) & 1) === 1; }
    function pon(f, c, v) { mod[f][c] = v; res[f][c] = true; }

    var lado = mod.length;

    /* Primera copia: baja por la columna 8 y sigue por la fila 8 */
    for (i = 0; i <= 5; i++) pon(i, 8, bit(i));
    pon(7, 8, bit(6));
    pon(8, 8, bit(7));
    pon(8, 7, bit(8));
    for (i = 9; i < 15; i++) pon(8, 14 - i, bit(i));

    /* Segunda copia: sube por la columna 8 de abajo y cruza por la fila 8 */
    for (i = 0; i < 8; i++) pon(8, lado - 1 - i, bit(i));
    for (i = 8; i < 15; i++) pon(lado - 15 + i, 8, bit(i));
  }

  /* --- elección de máscara: se queda la que menos penalización saca -------- */

  function penalizacion(mod) {
    var lado = mod.length;
    var total = 0;
    var f, c, i;

    /* 1 · rachas de 5 o más del mismo color */
    function rachas(get) {
      var suma = 0;
      for (var a = 0; a < lado; a++) {
        var run = 1;
        for (var b = 1; b < lado; b++) {
          if (get(a, b) === get(a, b - 1)) {
            run++;
            if (run === 5) suma += 3;
            else if (run > 5) suma += 1;
          } else run = 1;
        }
      }
      return suma;
    }
    total += rachas(function (a, b) { return mod[a][b]; });
    total += rachas(function (a, b) { return mod[b][a]; });

    /* 2 · bloques de 2x2 del mismo color */
    for (f = 0; f < lado - 1; f++) {
      for (c = 0; c < lado - 1; c++) {
        var v = mod[f][c];
        if (v === mod[f][c + 1] && v === mod[f + 1][c] && v === mod[f + 1][c + 1]) total += 3;
      }
    }

    /* 3 · el patrón 1:1:3:1:1 que imita a un ojo */
    var PAT = [true, false, true, true, true, false, true, false, false, false, false];
    function busca(get) {
      var suma = 0;
      for (var a = 0; a < lado; a++) {
        for (var b = 0; b + 11 <= lado; b++) {
          var ok = true, okRev = true;
          for (var k = 0; k < 11; k++) {
            if (get(a, b + k) !== PAT[k]) ok = false;
            if (get(a, b + k) !== PAT[10 - k]) okRev = false;
          }
          if (ok) suma += 40;
          if (okRev) suma += 40;
        }
      }
      return suma;
    }
    total += busca(function (a, b) { return mod[a][b]; });
    total += busca(function (a, b) { return mod[b][a]; });

    /* 4 · desvío respecto al 50 % de módulos oscuros */
    var oscuros = 0;
    for (f = 0; f < lado; f++) for (c = 0; c < lado; c++) if (mod[f][c]) oscuros++;
    var porcentaje = oscuros * 100 / (lado * lado);
    total += Math.floor(Math.abs(porcentaje - 50) / 5) * 10;

    return total;
  }

  /* --- API ----------------------------------------------------------------- */

  /* Devuelve la matriz de booleanos (true = módulo oscuro) */
  function matriz(texto) {
    var version = versionPara(texto.length);
    if (!version) throw new Error('QR: el texto no cabe en las versiones 1-6');

    var codigos = codificar(texto, version);
    var lado = 17 + 4 * version;
    var mejor = null;
    var mejorNota = Infinity;

    for (var m = 0; m < 8; m++) {
      var mod = nuevaMatriz(lado, false);
      var res = nuevaMatriz(lado, false);

      patronesFijos(mod, res, version);
      /* Los bits de resto de las versiones 2-6 quedan a cero solos: el
         recorrido rellena de claro lo que sobra tras los datos. */
      colocarDatos(mod, res, codigos);
      aplicarMascara(mod, res, m);
      ponerFormato(mod, res, m);

      var nota = penalizacion(mod);
      if (nota < mejorNota) { mejorNota = nota; mejor = mod; }
    }

    return mejor;
  }

  /* Devuelve un <svg> ya montado, con su zona de silencio de 4 módulos */
  function svg(texto, opciones) {
    var o = opciones || {};
    var mod = matriz(texto);
    var lado = mod.length;
    var margen = o.margen === undefined ? 4 : o.margen;
    var total = lado + margen * 2;
    var ns = 'http://www.w3.org/2000/svg';

    var el = document.createElementNS(ns, 'svg');
    el.setAttribute('viewBox', '0 0 ' + total + ' ' + total);
    el.setAttribute('width', '100%');
    el.setAttribute('height', '100%');
    el.setAttribute('shape-rendering', 'crispEdges');
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', o.etiqueta || 'Código QR');

    var fondo = document.createElementNS(ns, 'rect');
    fondo.setAttribute('width', total);
    fondo.setAttribute('height', total);
    fondo.setAttribute('fill', o.claro || '#ffffff');
    el.appendChild(fondo);

    var d = '';
    for (var f = 0; f < lado; f++) {
      for (var c = 0; c < lado; c++) {
        if (mod[f][c]) d += 'M' + (c + margen) + ' ' + (f + margen) + 'h1v1h-1z';
      }
    }

    var trazo = document.createElementNS(ns, 'path');
    trazo.setAttribute('d', d);
    trazo.setAttribute('fill', o.oscuro || '#08080d');
    el.appendChild(trazo);

    return el;
  }

  global.QRDemo = { matriz: matriz, svg: svg };
})(window);
