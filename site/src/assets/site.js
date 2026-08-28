/* Shared behavior: theme, the typing guard, back-to-top.
   Page-specific behavior lives in index.js / handbook.js, which both
   assume this file has already run. Classic scripts, no bundler — the
   two exported helpers hang off one `Site` global rather than leaking
   several names. */
window.Site = (function () {
  /* Keyboard shortcuts must not fire while the reader is typing — but a
     keydown's target is not always an Element. On a page with nothing
     focused it can be <body>, and a synthetic event dispatched on
     `document` has no `.matches` at all, so calling it directly throws a
     TypeError that kills the rest of the handler. That is how the
     Escape-to-close path silently stopped working: the throw happened
     before Escape was ever tested. */
  function isTyping(e) {
    var t = e.target;
    return !!(t && typeof t.matches === 'function' &&
              t.matches('input, textarea, select, [contenteditable]'));
  }

  /* localStorage throws outright in some privacy modes, so every access is
     guarded — a reader with storage blocked still gets a working toggle,
     just no memory of it. */
  var KEY = 'bigin-site-theme';
  var LEGACY_KEY = 'workshop-handbook-theme'; // the handbook's key before the two pages merged
  function read() {
    try { return localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY); } catch (e) { return null; }
  }
  function write(v) {
    try { localStorage.setItem(KEY, v); } catch (e) {}
  }

  var root = document.documentElement;
  root.setAttribute('data-theme', read() || 'dark');

  function toggleTheme() {
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    write(next);
  }

  var toggle = document.getElementById('themeToggle');
  if (toggle) toggle.addEventListener('click', toggleTheme);

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isTyping(e)) return;
    if (e.key === 't' || e.key === 'T') { e.preventDefault(); toggleTheme(); }
  });

  /* Each page decides *when* the button appears — the landing page on a
     scroll threshold, the handbook from its own progress loop — so only
     the click is wired here. */
  var backToTop = document.getElementById('backToTop');
  if (backToTop) {
    backToTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  return { isTyping: isTyping, toggleTheme: toggleTheme };
})();
