/* ==========================================================================
   Restaurante WhiteMoon · detalles de la web pública

   Solo presentación: flechas de los carruseles y la entrada suave de los
   bloques al hacer scroll. El reservador vive entero en chat.js.
   ========================================================================== */

(function () {
  'use strict';

  /* Flechas: desplazan el carrusel casi un ancho de pantalla */
  Array.prototype.forEach.call(document.querySelectorAll('[data-carrusel]'), function (b) {
    var pista = document.getElementById('carrusel-' + b.getAttribute('data-carrusel'));
    if (!pista) return;
    b.addEventListener('click', function () {
      var dir = Number(b.getAttribute('data-dir')) || 1;
      pista.scrollBy({ left: dir * pista.clientWidth * 0.8, behavior: 'smooth' });
    });
  });

  /* Entrada al hacer scroll. Sin IntersectionObserver, todo visible. */
  var bloques = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    Array.prototype.forEach.call(bloques, function (el) { el.classList.add('is-in'); });
    return;
  }
  var io = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  Array.prototype.forEach.call(bloques, function (el) { io.observe(el); });
})();
