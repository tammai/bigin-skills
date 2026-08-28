/* Handbook only: table of contents, scrollspy, reading progress, drawer.
   Depends on site.js having run (Site.isTyping, theme, back-to-top click). */

/* ============================================================
   BOOKMARKS — build the table of contents from the headings.

   Generated rather than hand-authored on purpose: a TOC typed
   alongside the content is a second list to keep in step, and it
   silently rots the moment a chapter is inserted or renamed.

   The list is FLAT — chapters and sections are siblings, told apart
   by weight in CSS. No numbering, so nothing here has to agree with
   a counter anywhere else.

   Anchor targets: the .chapter element for an <h2>, the <h3>
   itself for a section. An explicit id always wins, so a link
   printed in last year's handout keeps working after a retitle.
============================================================ */
const tocTargets = [];

(function buildToc() {
  const toc = document.getElementById('toc');
  const chapters = Array.from(document.querySelectorAll('#handbook .chapter'));
  if (!toc || !chapters.length) return;

  const used = new Set(
    Array.from(document.querySelectorAll('[id]')).map(el => el.id)
  );

  function slug(text, fallback) {
    let base = text.toLowerCase().trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // strip diacritics
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    if (!base) base = fallback;
    let id = base, n = 2;
    while (used.has(id)) { id = base + '-' + n++; }
    used.add(id);
    return id;
  }

  function ensureId(el, text, fallback) {
    if (!el.id) el.id = slug(text, fallback);
    return el.id;
  }

  function anchorLink(id) {
    const a = document.createElement('a');
    a.className = 'anchor';
    a.href = '#' + id;
    a.setAttribute('aria-label', 'Link to this section');
    a.textContent = '#';
    return a;
  }

  // Read the heading's own text, skipping the '#' anchor just appended.
  function label(heading) {
    return Array.from(heading.childNodes)
      .filter(n => !(n.nodeType === 1 && n.classList.contains('anchor')))
      .map(n => n.textContent).join('').trim();
  }

  function row(id, heading, cls) {
    const a = document.createElement('a');
    a.className = cls;
    a.href = '#' + id;
    a.textContent = label(heading);
    toc.appendChild(a);
    return a;
  }

  chapters.forEach((chapter, ci) => {
    const h2 = chapter.querySelector(':scope > h2');
    if (!h2) return;   // no heading, no bookmark — build.py errors on this

    // The chapter element is the scroll target, so the heading is not
    // flush against the top of the viewport after a jump.
    const cid = chapter.id || ensureId(chapter, h2.textContent, 'chapter-' + (ci + 1));
    h2.appendChild(anchorLink(cid));
    row(cid, h2, 'toc-h2');
    tocTargets.push({ el: chapter, id: cid });

    Array.from(chapter.querySelectorAll(':scope > h3')).forEach((h3, si) => {
      const sid = ensureId(h3, h3.textContent, cid + '-' + (si + 1));
      h3.appendChild(anchorLink(sid));
      row(sid, h3, 'toc-h3');
      tocTargets.push({ el: h3, id: sid });
    });
  });
})();

/* ============================================================
   SCROLLSPY + PROGRESS

   One rAF-throttled scroll handler drives both. "Current" is the
   last target whose top has passed the reading line — which is the
   one an IntersectionObserver gets wrong for a section shorter than
   the viewport, or when several are visible at once.
============================================================ */
(function () {
  const progress = document.getElementById('progress');
  const backToTop = document.getElementById('backToTop');
  const sidebar = document.getElementById('sidebar');
  const links = new Map();
  document.querySelectorAll('#toc a').forEach(a => {
    links.set(decodeURIComponent(a.getAttribute('href').slice(1)), a);
  });

  const READING_LINE = 120;   // px from the top of the viewport
  let current = null;
  let ticking = false;

  function update() {
    ticking = false;
    const root = document.documentElement;
    const max = root.scrollHeight - root.clientHeight;
    const y = window.scrollY || root.scrollTop;

    progress.style.width = (max > 0 ? Math.min(1, y / max) * 100 : 0) + '%';
    backToTop.classList.toggle('is-visible', y > 600);

    if (!tocTargets.length) return;

    // Within 2px of the bottom nothing further can scroll into view, so the
    // last target is what the reader is looking at however short it is.
    let active = tocTargets[0].id;
    if (max > 0 && y >= max - 2) {
      active = tocTargets[tocTargets.length - 1].id;
    } else {
      for (const t of tocTargets) {
        if (t.el.getBoundingClientRect().top <= READING_LINE) active = t.id;
        else break;
      }
    }

    if (active === current) return;
    if (current && links.has(current)) links.get(current).classList.remove('is-current');
    current = active;
    const link = links.get(active);
    if (!link) return;
    link.classList.add('is-current');

    // Keep the highlighted bookmark in view — but only when the sidebar is a
    // real scrolling column, never while it is an open drawer over the text.
    if (window.matchMedia('(min-width: 1081px)').matches) {
      const r = link.getBoundingClientRect(), s = sidebar.getBoundingClientRect();
      if (r.top < s.top + 40 || r.bottom > s.bottom - 40) {
        link.scrollIntoView({ block: 'center', behavior: 'auto' });
      }
    }
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  // Late-loading webfonts reflow the document and move every target.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(update);
  update();

})();

/* ============================================================
   SIDEBAR DRAWER — narrow viewports only
============================================================ */
(function () {
  const shell = document.getElementById('shell');
  const sidebar = document.getElementById('sidebar');
  const scrim = document.getElementById('scrim');
  const open = document.getElementById('menuToggle');
  const close = document.getElementById('closeToc');
  const drawerMQ = window.matchMedia('(max-width: 1080px)');

  function setOpen(isOpen) {
    // Above the breakpoint the sidebar is a static column, not a drawer —
    // but #scrim.is-open is not media-scoped, so opening on desktop (via the
    // C shortcut) would drop a full-page dim over a sidebar that never moved.
    if (isOpen && !drawerMQ.matches) return;
    sidebar.classList.toggle('is-open', isOpen);
    scrim.classList.toggle('is-open', isOpen);
    // Lifts #shell above #backToTop for as long as the drawer is open;
    // see the stacking-context note in the stylesheet.
    shell.classList.toggle('drawer-open', isOpen);
    open.setAttribute('aria-expanded', String(isOpen));
    if (isOpen) close.focus(); else open.focus();
  }

  open.addEventListener('click', () => setOpen(true));
  close.addEventListener('click', () => setOpen(false));
  scrim.addEventListener('click', () => setOpen(false));

  // Following a bookmark on a phone should reveal the text, not the menu.
  sidebar.addEventListener('click', e => {
    if (e.target.closest('#toc a')) setOpen(false);
  });

  document.addEventListener('keydown', e => {
    if (Site.isTyping(e)) return;
    if (e.key === 'Escape' && sidebar.classList.contains('is-open')) setOpen(false);
    if (e.key === 'c' || e.key === 'C') {
      e.preventDefault();
      setOpen(!sidebar.classList.contains('is-open'));
    }
  });

  // Resizing back to desktop must clear drawer state, or #shell keeps the
  // raised z-index and the scrim stays over a sidebar that is no longer one.
  drawerMQ.addEventListener('change', e => {
    if (!e.matches) setOpen(false);
  });
})();

/* ============================================================
   TABS
============================================================ */
(function () {
  document.querySelectorAll('#handbook .tabs').forEach(group => {
    const btns = Array.from(group.querySelectorAll('.tab-btn'));
    const panels = Array.from(group.querySelectorAll('.tab-panel'));
    btns.forEach((btn, i) => {
      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        if (panels[i]) panels[i].classList.add('active');
      });
    });
    // Nothing marked active in the markup? Open the first one, so a tab
    // group never renders as a bare row of buttons over empty space.
    if (btns.length && !btns.some(b => b.classList.contains('active'))) {
      btns[0].classList.add('active');
      if (panels[0]) panels[0].classList.add('active');
    }
  });
})();

/* ============================================================
   COPY BUTTONS — one per code block that has a <pre>
============================================================ */
(function () {
  const ICONS =
    '<svg class="icon-copy" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>' +
    '<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>' +
    '<svg class="icon-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M20 6 9 17l-5-5"/></svg>';

  document.querySelectorAll('#handbook .code-block').forEach(block => {
    const pre = block.querySelector('pre');
    if (!pre || block.querySelector('.copy-btn')) return;

    // A block may already carry a .code-head with a language label; if not,
    // one is created so the button always has somewhere to live.
    let head = block.querySelector('.code-head');
    if (!head) {
      head = document.createElement('div');
      head.className = 'code-head';
      block.insertBefore(head, pre);
    }

    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.type = 'button';
    btn.innerHTML = ICONS + '<span>Copy</span>';
    const labelEl = btn.querySelector('span');

    btn.addEventListener('click', () => {
      const text = pre.innerText;
      const done = () => {
        btn.classList.add('done');
        labelEl.textContent = 'Copied';
        setTimeout(() => { btn.classList.remove('done'); labelEl.textContent = 'Copy'; }, 1400);
      };
      // navigator.clipboard is undefined on file:// in some browsers, which
      // is exactly how a handed-out handbook is opened.
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done, fallback);
      } else {
        fallback();
      }
      function fallback() {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); }
        catch (_) { labelEl.textContent = 'Press ⌘C'; }
        document.body.removeChild(ta);
      }
    });

    head.appendChild(btn);
  });
})();

/* ============================================================
   CHECKLIST ICONS — a real Lucide square / square-check per item,
   picked by whether the <li> carries .done. Injected rather than
   hand-authored so the content stays `<li class="done">…</li>`.
============================================================ */
(function () {
  const SQUARE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect width="18" height="18" x="3" y="3" rx="2"/></svg>';
  const SQUARE_CHECK =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/></svg>';

  document.querySelectorAll('#handbook .list.check li').forEach(li => {
    if (li.querySelector(':scope > .check-icon')) return;
    const icon = document.createElement('span');
    icon.className = 'check-icon';
    icon.innerHTML = li.classList.contains('done') ? SQUARE_CHECK : SQUARE;
    li.prepend(icon);
  });
})();
