/* Landing page only. Depends on site.js having run. */
(function () {
  /* Back-to-top appears past the fold. The handbook drives the same button
     from its reading-progress loop instead. */
  var top = document.getElementById('backToTop');
  function syncBackToTop() { top.classList.toggle('is-visible', window.scrollY > 600); }
  window.addEventListener('scroll', syncBackToTop, { passive: true });
  syncBackToTop();

  var btn = document.querySelector('[data-copy]');
  if (btn) {
    btn.addEventListener('click', function () {
      var text = btn.closest('.code-block').querySelector('code').innerText;
      var label = btn.querySelector('span');
      function done() { label.textContent = 'Copied'; setTimeout(function () { label.textContent = 'Copy'; }, 1600); }
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done);
      } else {
        var ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch (e) {}
        document.body.removeChild(ta);
      }
    });
  }
})();
