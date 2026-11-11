/* ------------------------------------------------------------------------------------------------
   EVN ALPHA MicroPython - the documentation site's renderer.

   It owns the URL contract documented at the top of index.html:
       #/api/<slug>  #/api-<part>/<slug>  #/blocks/<slug>  #/calibration/<slug>  #/getting-started
       #/<guide>/<slug> (the guides split from Getting started: programs, board-view, data-logger, main-py,
       bluetooth, commands, board, troubleshooting; #/getting-started/<slug> of the one-page era is forwarded
       by assets/getting-started-moved.json)
       #/changelog  and the site's own pages (PAGES): #/start (Get started), #/documentation (Docs, every document
       by task), #/downloads (the Downloads page); and the home page (#/, and #/for/<audience> scrolled to that
       audience's section), whose feature cards are assets/features.json.
   The API reference is an index (docs/API.md, route `api`) and five parts (docs/API_<PART>.md, route
   `api-<part>`). A link of the one-page era, #/api/<slug> for a heading that now lives in a part, is
   forwarded to its part by assets/api-moved.json (old slug -> "<route>/<new slug>", written when the
   page was split; tools/check.py checks that every target still exists).
   Every path it fetches is relative, so the site works at any root.
   ------------------------------------------------------------------------------------------------ */
(function () {
  'use strict';

  /* The "Use it in the browser" card on the Downloads page. Set to false until /ide/ is published. */
  var SHOW_IDE = true;

  /* The documents, by the route name the extension uses. `order` drives the previous/next links. */
  var DOCS = {
    'getting-started': { file: 'docs/GETTING_STARTED.md', title: 'Getting started', nav: 'Getting started',
                         blurb: 'Switch the board on, flash the firmware, run the first program.' },
    /* the guides split from Getting started (SITE-15): `part` makes them light "Getting started" and keeps them
       off the home page's list; a link of the one-page era, #/getting-started/<slug>, is forwarded to its
       guide by assets/getting-started-moved.json */
    'programs':        { file: 'docs/PROGRAMS.md',        title: 'Programs: run, stop, ports and units', part: 'getting-started' },
    'board-view':      { file: 'docs/BOARD_VIEW.md',      title: 'The Board view and the live console', part: 'getting-started' },
    'data-logger':     { file: 'docs/DATA_LOGGER.md',     title: 'Recording data', part: 'getting-started' },
    'notebook':        { file: 'docs/NOTEBOOK.md',        title: 'The notebook', part: 'getting-started' },
    'main-py':         { file: 'docs/MAIN_PY.md',         title: 'A program that starts from the user button', part: 'getting-started' },
    'bluetooth':       { file: 'docs/BLUETOOTH.md',       title: 'Working without the USB cable', part: 'getting-started' },
    'simulator':       { file: 'docs/SIMULATOR.md',       title: 'The robot simulator', part: 'getting-started' },
    'commands':        { file: 'docs/COMMANDS.md',        title: 'Commands and updates', part: 'getting-started' },
    'board':           { file: 'docs/BOARD.md',           title: 'The board: buttons, lights and pins', part: 'getting-started' },
    'troubleshooting': { file: 'docs/TROUBLESHOOTING.md', title: 'Troubleshooting', part: 'getting-started' },
    'repl':            { file: 'docs/REPL.md',            title: 'Using the REPL', nav: 'REPL',
                         blurb: 'The board’s Python prompt: opening it, the keys, and motors at the prompt.' },
    'calibration':     { file: 'docs/CALIBRATION.md',     title: 'Calibrating your robot', nav: 'Calibration',
                         blurb: 'Motors, IMU, compass, colour sensors and the VL53L1X: from the Board view, from Python and from blocks.' },
    'api':             { file: 'docs/API.md',             title: 'API reference',  nav: 'API',
                         blurb: 'Every class and function of the evn module, with units and defaults.' },
    /* the API reference's parts: `part` names the index they belong to (nav highlight, crumb, not listed
       on the home page); the extension's src/docsLinks.ts API_PARTS lists the same files */
    'api-robot':       { file: 'docs/API_ROBOT.md',       title: 'The board, the motors, the drive base and the pose', part: 'api' },
    'api-sensors':     { file: 'docs/API_SENSORS.md',     title: 'Standard peripherals: sensors', part: 'api' },
    'api-displays':    { file: 'docs/API_DISPLAYS.md',    title: 'Standard peripherals: displays, lights, servo and Bluetooth', part: 'api' },
    'api-extended':    { file: 'docs/API_EXTENDED.md',    title: 'Extended peripherals', part: 'api' },
    'api-system':      { file: 'docs/API_SYSTEM.md',      title: 'Ports, programs, the data logger and timing', part: 'api' },
    'blocks':          { file: 'docs/BLOCKS.md',          title: 'Blocks reference', nav: 'Blocks',
                         blurb: 'The block editor and the MicroPython each block generates.' },
    'known-limitations': { file: 'docs/KNOWN_LIMITATIONS.md', title: 'Known limitations and help us test', nav: 'Known limitations',
                         blurb: 'What does not work as you might expect yet, what is untested, and how to report a problem.' },
    'changelog':       { file: 'docs/WHATS_NEW.md',       title: 'What’s new',     nav: 'Changelog',
                         blurb: 'The main changes of each release, in a few lines, and the full changelog.' },
    /* the full engineering log, linked from What's new (CHANGELOG.md: the release tools read it) */
    'changelog-full':  { file: 'docs/CHANGELOG.md',       title: 'Full changelog', part: 'changelog' }
  };
  var ORDER = ['getting-started', 'programs', 'board-view', 'data-logger', 'notebook', 'main-py', 'bluetooth', 'simulator', 'commands', 'board',
               'troubleshooting', 'repl', 'calibration', 'api', 'api-robot', 'api-sensors', 'api-displays', 'api-extended',
               'api-system', 'blocks', 'known-limitations', 'changelog', 'changelog-full'];
  /* The documents whose route takes a heading slug (#/api/<slug>): their bare route ends in a slash. */
  var SECTIONED = { api: true, 'api-robot': true, 'api-sensors': true, 'api-displays': true, 'api-extended': true,
                    'api-system': true, blocks: true, calibration: true };
  /* docs/<NAME>.md -> its route, for the links between the documents */
  var BY_FILE = {};
  Object.keys(DOCS).forEach(function (k) { BY_FILE[DOCS[k].file.replace(/^docs\//, '').replace(/\.md$/, '')] = k; });
  var REPO = 'https://github.com/EVNdevs/evndevs.github.io';
  /* Reports and suggestions go to the site repository's issues, each through its issue form (the owner, 2026-10-18,
     SITE-09 / SITE-14: "reports go to GitHub issues on `EVNdevs/evndevs.github.io` with an issue template;
     "Suggest a change" opens one there"). The forms are site/.github/ISSUE_TEMPLATE/<name>.yml here, copied into
     the site repository by scripts/publish_public.py; a query parameter named as a form field's id fills that field.
     The documents themselves are generated (an edit to the site repository's docs/ is overwritten by the next
     publish), so a page offers "Suggest a change", never an edit. scripts/test_site.js checks the template names and
     field ids against the forms. */
  var ISSUES_NEW = REPO + '/issues/new';
  var REPORT_URL = ISSUES_NEW + '?template=report-a-problem.yml';
  var SUGGEST_TEMPLATE = 'suggest-a-change.yml';
  var reading = null;      // the heading the scroll-spy marks current ({ id, h }), for "Suggest a change"
  /* The address of a page (and a heading of it) on this site: the site's root (route pages carry <base href="../">,
     so the base is the root on every page) + #/<route>[/<heading id>]. */
  function pageUrl(doc, slug) {
    var root = new URL('.', document.baseURI).href;
    return root + '#/' + doc + (slug ? '/' + slug : (SECTIONED[doc] ? '/' : ''));
  }
  /* "Suggest a change" for a page: a new issue on the suggest-a-change form, its title "Docs: <page> - <section>"
     and its `page` field the address of the section being read. */
  function suggestUrl(doc, slug, heading) {
    var title = 'Docs: ' + DOCS[doc].title + (heading ? ' - ' + heading : '');
    return ISSUES_NEW + '?template=' + SUGGEST_TEMPLATE + '&title=' + encodeURIComponent(title) +
      '&page=' + encodeURIComponent(pageUrl(doc, slug));
  }
  function suggestLink(doc) {
    var a = el('a', 'edit-link');
    a.href = suggestUrl(doc);
    a.target = '_blank';
    a.rel = 'noopener';
    /* the section is the one being read when the link is used (the scroll-spy's), not the one at render */
    function refresh() {
      var s = reading && document.getElementById(reading.id) === reading.h ? reading : null;
      a.href = suggestUrl(doc, s ? s.id : '', s ? s.h.textContent.trim() : '');
    }
    a.addEventListener('mousedown', refresh);
    a.addEventListener('focus', refresh);
    a.addEventListener('click', refresh);
    a.appendChild(frag('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/>' +
      '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>'));
    a.appendChild(document.createTextNode('Suggest a change'));
    return a;
  }
  /* "Report a problem": a new issue on the report-a-problem form (the footer, the home page, Troubleshooting) */
  function reportLink(cls, text) {
    var a = el('a', cls, text || 'Report a problem');
    a.href = REPORT_URL;
    a.target = '_blank';
    a.rel = 'noopener';
    return a;
  }
  var SITE = 'EVN ALPHA MicroPython';

  var main = document.getElementById('main');
  var nav = document.getElementById('nav');
  var cache = {};          // file -> markdown text
  var latest = null;       // promise for latest.json
  var current = null;      // { doc: <name|'home'>, slug: <string> }
  var spy = null;          // the scroll-spy's teardown

  /* ---- small helpers ---------------------------------------------------------------------------- */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text != null) { n.textContent = text; }
    return n;
  }
  function frag(html) { var t = document.createElement('template'); t.innerHTML = html; return t.content; }

  /* GitHub's heading anchor rule, the same function the extension has (src/docsLinks.ts: slugify). */
  function slugify(text) {
    return String(text).trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-_]/g, '');
  }

  /* A page of its own: scripts/publish_public.py writes <route>/index.html for every route, a copy of
     index.html with <base href="../"> (so every relative path still resolves at the root) and
     <meta name="evn-route" content="<route>">. With no #/ route in the URL that page shows its route; a bare
     "#<slug>" on it is a heading of that route (/calibration/#compass). A #/ route always wins, so the extension's
     links (/#/<route>/<slug>) and every old link work as before. */
  var PAGE = (function () {
    var m = document.querySelector('meta[name="evn-route"]');
    return m ? m.getAttribute('content') || '' : '';
  })();

  /* "#/api/motor" -> { doc: 'api', slug: 'motor' }; "#/start/vs-code" -> { doc: 'start', slug: 'vs-code' } (a page of
     PAGES); "#/for/teachers" -> { doc: 'home', slug: 'teachers' }; anything unknown is the home page. */
  function parseRoute() {
    var h = location.hash.replace(/^#\/?/, '');
    if (PAGE && location.hash.charAt(1) !== '/') { h = PAGE + '/' + location.hash.slice(1); }
    if (!h) { return { doc: 'home', slug: '' }; }
    var m = /^([a-z\-]+)\/?(.*)$/.exec(h);
    if (!m) { return { doc: 'home', slug: '' }; }
    var doc = m[1], slug = slugify(decodeURIComponent(m[2] || ''));
    if (doc === 'for') { return { doc: 'home', slug: slug }; }
    if (PAGES[doc]) { return { doc: doc, slug: slug }; }
    if (!DOCS[doc]) { return { doc: 'home', slug: '' }; }
    return { doc: doc, slug: slug };
  }

  function fetchText(path) {
    if (cache[path]) { return Promise.resolve(cache[path]); }
    return fetch(path, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) { throw new Error(r.status + ' ' + r.statusText + ' for ' + path); }
      return r.text();
    }).then(function (t) { cache[path] = t; return t; });
  }

  function readLatest() {
    if (!latest) {
      latest = fetch('latest.json', { cache: 'no-cache' }).then(function (r) {
        if (!r.ok) { throw new Error(r.status + ' ' + r.statusText); }
        return r.json();
      });
    }
    return latest;
  }

  /* ---- colour scheme ---------------------------------------------------------------------------- */

  var darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function effectiveTheme() {
    var set = document.documentElement.getAttribute('data-theme');
    if (set === 'light' || set === 'dark') { return set; }
    return darkQuery && darkQuery.matches ? 'dark' : 'light';
  }
  function applyHighlightTheme() {
    var dark = effectiveTheme() === 'dark';
    var l = document.getElementById('hl-light'), d = document.getElementById('hl-dark');
    if (l) { l.media = dark ? 'not all' : 'all'; }
    if (d) { d.media = dark ? 'all' : 'not all'; }
  }
  function setUpTheme() {
    var btn = document.getElementById('theme-btn');
    btn.addEventListener('click', function () {
      var next = effectiveTheme() === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('evn-theme', next); } catch (e) { /* storage blocked: this session only */ }
      applyHighlightTheme();
    });
    if (darkQuery && darkQuery.addEventListener) { darkQuery.addEventListener('change', applyHighlightTheme); }
    applyHighlightTheme();
  }

  /* ---- the header ------------------------------------------------------------------------------- */

  function setUpMenu() {
    var btn = document.getElementById('menu-btn');
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') { nav.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
    });
  }

  /* doc: a route of DOCS, a page of PAGES or 'home'. No nav entry is the home page, so on it nothing is lit; every
     document lights "Docs" (the one entry point to them). */
  function markCurrentNav(doc) {
    if (DOCS[doc]) { doc = 'documentation'; }
    var links = nav.querySelectorAll('a[data-doc]');
    for (var i = 0; i < links.length; i++) {
      var on = links[i].getAttribute('data-doc') === doc;
      links[i].className = on ? 'current' : '';
      if (on) { links[i].setAttribute('aria-current', 'page'); } else { links[i].removeAttribute('aria-current'); }
    }
  }

  /* ---- Markdown plumbing ------------------------------------------------------------------------- */

  /* Links inside the Markdown: another document becomes a route; anything else relative resolves
     against docs/; absolute links open in a new tab. Relative images resolve against docs/ too. */
  function fixLinks(root) {
    var links = root.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i], href = a.getAttribute('href');
      if (!href) { continue; }
      var m = /^(?:\.\.\/)?(?:docs\/)?([A-Z_]+)\.md(?:#(.*))?$/.exec(href);
      if (m && BY_FILE[m[1]]) {
        a.setAttribute('href', '#/' + BY_FILE[m[1]] + '/' + (m[2] ? slugify(decodeURIComponent(m[2])) : ''));
        continue;
      }
      if (/^#/.test(href)) { continue; }                       // same-document anchor, fixed below
      if (/^[a-z]+:/i.test(href)) { a.target = '_blank'; a.rel = 'noopener'; continue; }
      a.setAttribute('href', new URL(href, new URL('docs/', document.baseURI)).href);
    }
    // images (docs/images/*.png) are written relative to the document, which lives in docs/
    var imgs = root.querySelectorAll('img[src]');
    for (var j = 0; j < imgs.length; j++) {
      var src = imgs[j].getAttribute('src');
      if (!src || /^[a-z]+:/i.test(src) || src.charAt(0) === '/') { continue; }
      imgs[j].setAttribute('src', new URL(src, new URL('docs/', document.baseURI)).href);   // a page of its own has <base href="../">
      imgs[j].setAttribute('loading', 'lazy');
    }
  }

  /* Same-document anchors ("#measuring") must stay inside the route, not replace it. */
  function fixAnchors(root, doc) {
    var links = root.querySelectorAll('a[href^="#"]');
    for (var i = 0; i < links.length; i++) {
      var f = links[i].getAttribute('href').slice(1);
      if (f.charAt(0) === '/') { continue; }                   // already a route
      links[i].setAttribute('href', '#/' + doc + '/' + slugify(decodeURIComponent(f)));
    }
  }

  function assignIds(root) {
    var seen = {};
    var hs = root.querySelectorAll('h1, h2, h3, h4, h5, h6');
    for (var i = 0; i < hs.length; i++) {
      var id = slugify(hs[i].textContent), base = id, n = 1;
      while (seen[id]) { id = base + '-' + (n++); }             // GitHub numbers duplicates the same way
      seen[id] = true;
      hs[i].id = id;
    }
    return hs;
  }

  /* The documents' Markdown, rendered the one way both the page and the search index use, so a heading gets
     the same id in both (assignIds runs on the result in either case). */
  function renderMarkdown(md) {
    return frag(DOMPurify.sanitize(marked.parse(md, { gfm: true, breaks: false })));
  }

  /* ---- callouts (SITE-29) ---------------------------------------------------------------------------
     The documents' convention (docs/PUBLISHING.md, "Writing the documents"): a blockquote whose first word is a
     bold label is a callout,
         > **Warning:** the motor keeps driving when ...      (also **Note:** and **Tip:**)
     and GitHub's own alert form, `> [!WARNING]` / `> [!NOTE]` / `> [!TIP]` on its own line, is read the same.
     In VS Code's Markdown preview and on GitHub the first form is a quote that starts with the bold word, so the
     source reads right everywhere. Every other blockquote stays a quote. The callout's title is a <p>, never a
     heading: the heading ids (the routes, the search index) are the same with and without callouts. */
  var CALLOUTS = { note: 'Note', tip: 'Tip', warning: 'Warning' };
  function calloutKind(bq) {
    var p = bq.firstElementChild;
    if (!p || p.tagName !== 'P') { return null; }
    var first = p.firstChild;
    while (first && first.nodeType === 3 && !first.nodeValue.trim()) { first = first.nextSibling; }
    if (!first) { return null; }
    if (first.nodeType === 1 && first.tagName === 'STRONG') {
      var m = /^\s*(note|tip|warning)\s*(:\s*\S[\s\S]*)?\s*:?\s*$/i.exec(first.textContent);
      if (!m) { return null; }
      if (m[2]) {
        /* `> **Warning: swapping a motor? Choose it first.** ...`: the label goes, the rest stays the bold lead */
        var t = first.firstChild;
        while (t && t.nodeType !== 3) { t = t.firstChild; }
        if (!t || !/^\s*(note|tip|warning)\s*:\s*/i.test(t.nodeValue)) { return null; }
        t.nodeValue = t.nodeValue.replace(/^\s*(note|tip|warning)\s*:\s*/i, '');
        return m[1].toLowerCase();
      }
      var after = first.nextSibling;
      p.removeChild(first);
      if (after && after.nodeType === 3) { after.nodeValue = after.nodeValue.replace(/^\s*:?\s*/, ''); }
      return m[1].toLowerCase();
    }
    if (first.nodeType === 3) {
      var g = /^\s*\[!(note|tip|warning)\]\s*/i.exec(first.nodeValue);
      if (!g) { return null; }
      first.nodeValue = first.nodeValue.slice(g[0].length);
      return g[1].toLowerCase();
    }
    return null;
  }
  function renderCallouts(root) {
    var qs = root.querySelectorAll('blockquote');
    for (var i = 0; i < qs.length; i++) {
      var bq = qs[i], kind = calloutKind(bq);
      if (!kind) { continue; }
      var box = el('div', 'callout callout-' + kind);
      box.setAttribute('role', 'note');
      box.setAttribute('aria-label', CALLOUTS[kind]);
      box.appendChild(el('p', 'callout-title', CALLOUTS[kind]));
      var p = bq.firstElementChild;
      if (p && !p.textContent.trim() && !p.querySelector('img, code')) { bq.removeChild(p); }
      while (bq.firstChild) { box.appendChild(bq.firstChild); }
      bq.parentNode.replaceChild(box, bq);
    }
  }

  /* ---- tables (SITE-23, SITE-26) ---------------------------------------------------------------------
     Every cell carries its column's header as data-label, so on a phone (site.css, under 700 px) a row
     becomes a card that names each value, instead of a table wider than the screen whose meaning column is
     off to the right. A header cell with no text (the corner of a comparison table) is no header: it becomes
     a plain cell (axe: empty-table-header). */
  function prepareTables(root) {
    var tables = root.querySelectorAll('table');
    for (var i = 0; i < tables.length; i++) {
      var t = tables[i], heads = t.querySelectorAll('thead th'), labels = [];
      for (var j = 0; j < heads.length; j++) {
        var label = heads[j].textContent.trim();
        labels.push(label);
        if (!label) {
          var td = document.createElement('td');
          while (heads[j].firstChild) { td.appendChild(heads[j].firstChild); }
          heads[j].parentNode.replaceChild(td, heads[j]);
        }
      }
      if (!labels.length) { continue; }
      t.classList.add('stack');
      var rows = t.querySelectorAll('tbody tr');
      for (var r = 0; r < rows.length; r++) {
        var cells = rows[r].children;
        for (var c = 0; c < cells.length; c++) {
          if (labels[c]) { cells[c].setAttribute('data-label', labels[c]); }
        }
      }
    }
  }

  /* A scrolling code block or table must be reachable by keyboard (axe: scrollable-region-focusable): one
     whose content is wider than its box takes the focus (tabindex 0) and is named for a screen reader; one
     that fits gives it back. Run after the document is in the page (it measures) and again on a resize. */
  function markScrollers(root) {
    if (!root) { return; }
    var boxes = root.querySelectorAll('pre, table');
    for (var i = 0; i < boxes.length; i++) {
      var b = boxes[i];
      if (b.scrollWidth > b.clientWidth + 1) {
        b.setAttribute('tabindex', '0');
        if (b.tagName === 'PRE' && !b.hasAttribute('aria-label')) { b.setAttribute('aria-label', 'Code, scrolls sideways'); }
      } else if (b.getAttribute('tabindex') === '0') {
        b.removeAttribute('tabindex');
        if (b.getAttribute('aria-label') === 'Code, scrolls sideways') { b.removeAttribute('aria-label'); }
      }
    }
  }

  /* Code blocks (SITE-23): the Copy button sits in a bar above the code, never over it, and a block of one line
     (a signature: "Motor(port, positive_direction=...)") wraps instead of scrolling, so a phone shows all of it. */
  function addCopyButtons(root) {
    var pres = root.querySelectorAll('pre');
    for (var i = 0; i < pres.length; i++) {
      (function (pre) {
        var code0 = pre.querySelector('code');
        if (!/\n/.test((code0 ? code0.textContent : pre.textContent).replace(/\s+$/, ''))) { pre.classList.add('sig'); }
        var box = el('div', 'code-block');
        var bar = el('div', 'code-bar');
        pre.parentNode.insertBefore(box, pre);
        box.appendChild(bar);
        box.appendChild(pre);
        var btn = el('button', 'copy-btn', 'Copy');
        btn.type = 'button';
        btn.setAttribute('aria-label', 'Copy this code');
        btn.addEventListener('click', function () {
          var code = pre.querySelector('code');
          var text = code ? code.textContent : pre.textContent;
          var done = function () {
            btn.textContent = 'Copied';
            btn.classList.add('done');
            setTimeout(function () { btn.textContent = 'Copy'; btn.classList.remove('done'); }, 1600);
          };
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done, function () { fallback(text, done); });
          } else { fallback(text, done); }
        });
        bar.appendChild(btn);
      })(pres[i]);
    }
    function fallback(text, done) {
      var ta = el('textarea');
      ta.value = text;
      ta.setAttribute('readonly', 'readonly');
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { /* nothing more we can do */ }
      document.body.removeChild(ta);
    }
  }

  /* ---- the table of contents and its scroll-spy --------------------------------------------------- */

  function buildToc(hs, doc, title) {
    var aside = el('nav', 'toc');
    aside.setAttribute('aria-label', 'On this page');

    var toggle = el('button', 'toc-toggle', 'On this page');
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', 'true');
    toggle.addEventListener('click', function () {
      var off = aside.classList.toggle('collapsed');
      toggle.setAttribute('aria-expanded', off ? 'false' : 'true');
    });
    aside.appendChild(toggle);

    aside.appendChild(el('p', 'toc-title', title));

    var filter = el('input', 'toc-filter');
    filter.type = 'search';
    filter.placeholder = 'Filter this page’s contents…';   /* every page: the header's Search (SITE-16) */
    filter.setAttribute('aria-label', 'Filter the table of contents of this page');
    aside.appendChild(filter);

    var ul = el('ul');
    var items = [];
    for (var i = 0; i < hs.length; i++) {
      var h = hs[i], level = h.tagName.toLowerCase();
      if (level !== 'h2' && level !== 'h3') { continue; }
      var li = el('li', level);
      var a = el('a', null, h.textContent);
      a.href = '#/' + doc + '/' + h.id;
      a.setAttribute('data-id', h.id);
      li.appendChild(a);
      ul.appendChild(li);
      items.push({ li: li, text: h.textContent.toLowerCase(), id: h.id, h: h });
    }
    aside.appendChild(ul);

    var empty = el('p', 'empty', 'Nothing matches that.');
    empty.hidden = true;
    aside.appendChild(empty);

    filter.addEventListener('input', function () {
      var q = filter.value.trim().toLowerCase(), shown = 0;
      for (var i = 0; i < items.length; i++) {
        var on = !q || items[i].text.indexOf(q) !== -1;
        items[i].li.hidden = !on;
        if (on) { shown++; }
      }
      empty.hidden = shown > 0;
    });

    if (window.innerWidth <= 980) { aside.classList.add('collapsed'); toggle.setAttribute('aria-expanded', 'false'); }
    return { node: aside, items: items };
  }

  function startSpy(toc) {
    stopSpy();
    if (!toc.items.length) { return; }
    var ticking = false, headerH = 90;
    function update() {
      ticking = false;
      var best = toc.items[0];
      for (var i = 0; i < toc.items.length; i++) {
        if (toc.items[i].h.getBoundingClientRect().top - headerH <= 1) { best = toc.items[i]; } else { break; }
      }
      /* at the very bottom the last heading wins, whatever the arithmetic says */
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) {
        best = toc.items[toc.items.length - 1];
      }
      reading = best;
      highlight(toc, best.id);
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    spy = function () {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
    update();
  }
  /* every render that replaces <main> calls this: the scroll-spy's teardown, and the home page's 3D layer stopped */
  function stopSpy() { reading = null; if (spy) { spy(); spy = null; } stopStage(); if (ledTeardown) { ledTeardown(); } if (stillTeardown) { stillTeardown(); } }

  function highlight(toc, id) {
    for (var i = 0; i < toc.items.length; i++) {
      var a = toc.items[i].li.firstChild;
      var on = toc.items[i].id === id;
      if (on !== (a.className === 'current')) { a.className = on ? 'current' : ''; }
      if (on && toc.node.scrollHeight > toc.node.clientHeight + 8) {
        var top = a.offsetTop, view = toc.node.scrollTop, h = toc.node.clientHeight;
        if (top < view + 40 || top > view + h - 40) { toc.node.scrollTop = Math.max(0, top - h / 2); }
      }
    }
  }

  function scrollToSlug(slug, doc) {
    var target = slug ? document.getElementById(slug) : null;
    if (target) { target.scrollIntoView(); window.scrollBy(0, -8); return; }
    window.scrollTo(0, 0);
    if (MOVED_MAPS[doc] && slug) { forwardMoved(slug, doc); }
  }

  /* #/api/<slug> of the one-page API reference (older extension builds, bookmarks): the heading is in a
     part now, so the route is replaced by that part's. #/getting-started/<slug> of the one-page Getting
     started likewise (its guides, SITE-15). An unknown slug stays on the page, at its top. */
  var MOVED_MAPS = { api: 'assets/api-moved.json', 'getting-started': 'assets/getting-started-moved.json' };
  var moved = {};
  function forwardMoved(slug, doc) {
    if (!moved[doc]) {
      moved[doc] = fetch(MOVED_MAPS[doc], { cache: 'no-cache' }).then(function (r) {
        if (!r.ok) { throw new Error(r.status + ' ' + r.statusText); }
        return r.json();
      }).catch(function () { moved[doc] = null; return {}; });
    }
    moved[doc].then(function (map) {
      var to = map[slug];
      // an absolute URL of this page: on a route page (<base href="../">) a bare '#/...' would resolve
      // against the root and leave the page, where the hash route wins anyway
      if (to && current && current.doc === doc && current.slug === slug) { location.replace(location.href.split('#')[0] + '#/' + to); }
    });
  }

  /* ---- a document -------------------------------------------------------------------------------- */

  function renderDoc(route) {
    var info = DOCS[route.doc];
    document.title = SITE + ' · ' + info.title;
    markCurrentNav(route.doc);

    var sameDoc = current && current.doc === route.doc;
    current = route;
    if (sameDoc) { scrollToSlug(route.slug, route.doc); return; }

    stopSpy();
    main.textContent = '';
    var wrap = el('div', 'wrap');
    wrap.style.paddingTop = '48px';
    var loading = el('p', 'notice');
    loading.appendChild(el('span', 'spinner'));
    loading.appendChild(document.createTextNode('Loading ' + info.title + '…'));
    wrap.appendChild(loading);
    main.appendChild(wrap);

    fetchText(info.file).then(function (md) {
      if (current !== route) { return; }
      var layout = el('div', 'layout');
      var article = el('article', 'doc');

      var head = el('div', 'doc-head');
      var crumb = el('p', 'crumb');
      var docsLink = el('a', null, 'Docs');                // the one index of the documents (#/documentation)
      docsLink.href = '#/documentation';
      crumb.appendChild(docsLink);
      if (info.part) {                                  // a part of the API reference: the way back to its index
        crumb.appendChild(document.createTextNode(' / '));
        var up = el('a', null, DOCS[info.part].title);
        up.href = '#/' + info.part + '/';
        crumb.appendChild(up);
      }
      head.appendChild(crumb);
      head.appendChild(suggestLink(route.doc));          // a new issue on the suggest-a-change form (SITE-14)
      article.appendChild(head);

      var body = el('div', 'doc-body');
      // links and image paths are fixed in an inert template, before the images are in the page:
      // an <img> made in the live document starts loading its relative src at once (a 404)
      var content = renderMarkdown(md);
      fixLinks(content);
      renderCallouts(content);
      prepareTables(content);
      body.appendChild(content);
      article.appendChild(body);

      var hs = assignIds(body);
      fixAnchors(body, route.doc);
      var blocks = body.querySelectorAll('pre code');
      for (var i = 0; i < blocks.length; i++) {
        if (!/language-/.test(blocks[i].className)) { blocks[i].className += ' language-python'; }
        try { hljs.highlightElement(blocks[i]); } catch (e) { /* an unknown language: leave it plain */ }
      }
      addCopyButtons(body);
      article.appendChild(pager(route.doc));

      var toc = buildToc(hs, route.doc, info.title);
      layout.appendChild(toc.node);
      layout.appendChild(article);
      main.textContent = '';
      main.appendChild(layout);
      markScrollers(body);

      scrollToSlug(route.slug, route.doc);
      startSpy(toc);
    }).catch(function (e) {
      if (current !== route) { return; }
      main.textContent = '';
      var w = el('div', 'wrap');
      w.style.paddingTop = '48px';
      w.style.paddingBottom = '48px';
      var p = el('p', 'notice', 'The document could not be loaded (' + e.message + '). ');
      var a = el('a', null, 'Read it on GitHub instead.');
      a.href = REPO + '/blob/main/' + info.file;
      p.appendChild(a);
      w.appendChild(p);
      main.appendChild(w);
    });
  }

  function pager(doc) {
    var box = el('nav', 'pager');
    box.setAttribute('aria-label', 'The other documents');
    var i = ORDER.indexOf(doc);
    if (i > 0) { box.appendChild(pagerLink(ORDER[i - 1], 'Previous', 'prev')); }
    if (i >= 0 && i < ORDER.length - 1) { box.appendChild(pagerLink(ORDER[i + 1], 'Next', 'next')); }
    return box;
  }
  function pagerLink(doc, label, cls) {
    var a = el('a', cls);
    a.href = '#/' + doc + (SECTIONED[doc] ? '/' : '');
    a.appendChild(el('span', 'lbl', label));
    a.appendChild(el('span', 'ttl', DOCS[doc].title));
    return a;
  }

  /* ---- the sensors and displays (the Docs page lists them) ------------------------------------------ */

  /* The peripherals on the Docs page, in plain words, each linked to its section of the API reference:
     [name, what it is for, class, route, heading slug]. tools/host_tests/test_site_pages.py checks that every
     slug is a heading of its document and that every class of the API index's tables is here. The BME280 keeps
     the name of its API page ("environment sensor"). Servos and LED strips plug into the servo ports and the
     Bluetooth module into a serial port: the intro below scopes "finds it by itself" to the sensor ports. */
  var PERIPHERALS = [
    ['IMU', 'Which way the robot faces and how it tilts', 'IMU', 'api-sensors', 'imu--gyro-and-accelerometer-mpu-6500'],
    ['Compass', 'A heading from the Earth’s magnetic field', 'Compass', 'api-sensors', 'compass--magnetometer-qmc5883l--hmc5883l'],
    ['Colour sensor', 'Follow a line, sort by colour', 'ColorSensor', 'api-sensors', 'colorsensor--colour-sensor-tcs34725'],
    ['Distance sensor', 'How far away a wall or an object is', 'DistanceSensor', 'api-sensors', 'distancesensor--time-of-flight-distance-sensor-vl53l0x'],
    ['Gesture sensor', 'Hand swipes, nearness and colour', 'GestureSensor', 'api-sensors', 'gesturesensor--gesture-proximity-and-colour-sensor-apds-9960'],
    ['Touch pads', 'Twelve touch keys', 'TouchArray', 'api-sensors', 'toucharray--capacitive-touch-array-mpr121'],
    ['Environment sensor', 'Temperature, air pressure and humidity', 'EnvSensor', 'api-sensors', 'envsensor--temperature-pressure-and-humidity-bme280'],
    ['Analogue inputs', 'Read a potentiometer or any analogue sensor', 'ADC', 'api-sensors', 'adc--analogue-to-digital-converter-ads1115'],
    ['Display', 'Text and pictures on a small screen', 'Display', 'api-displays', 'display--12864-oled-ssd1306--ssd1315'],
    ['LED matrix', 'An 8×8 grid of lights: icons and scrolling text', 'MatrixLED', 'api-displays', 'matrixled--88-led-matrix-ht16k33'],
    ['Number display', 'Four digits: a score, a timer', 'SevenSegmentLED', 'api-displays', 'sevensegmentled--4-digit-seven-segment-display-ht16k33'],
    ['RGB LEDs', 'Coloured lights and LED strips', 'RGBLED', 'api-displays', 'rgbled--rgb-led-module-ws2812b'],
    ['Servo', 'Hobby servos for grabbers and arms', 'Servo', 'api-displays', 'servo--hobby-servo-geekservo-270--continuous-rotation'],
    ['Bluetooth', 'Drive and program the robot without a cable', 'Bluetooth', 'api-displays', 'bluetooth--bluetooth-module-hc-05']
  ];
  var EXTENDED = [
    ['HiTechnic colour sensor', 'The NXT colour sensor you may already own', 'HiTechnicColorSensor', 'api-extended', 'hitechniccolorsensor--hitechnic-nxt-color-sensor-v1--v2'],
    ['HiTechnic compass', 'The NXT compass sensor', 'HiTechnicCompass', 'api-extended', 'hitechniccompass--hitechnic-nxt-compass-sensor'],
    ['HuskyLens', 'An AI camera: faces, colours, lines, tags', 'HuskyLens', 'api-extended', 'huskylens--dfrobot-huskylens-ai-camera'],
    ['Long-range distance', 'Distances up to 4 m', 'VL53L1X', 'api-extended', 'vl53l1x--time-of-flight-distance-sensor-up-to-4-m'],
    ['Light and colour (XYZ)', 'Colour as the eye sees it, and light level', 'TCS3430', 'api-extended', 'tcs3430--xyz-colour-and-ambient-light-sensor']
  ];

  /* The six module photos: [file, name, what for, alt text, class of PERIPHERALS whose section the tile opens]. */
  var GALLERY = [
    ['p-colour.jpg',   'Colour sensor',   'Follow a line, sort by colour',
     'Three EVN colour-sensor modules in black printed housings, one showing its TCS34725 board with two white LEDs.', 'ColorSensor'],
    ['p-distance.jpg', 'Distance sensor', 'How far away a wall is',
     'EVN distance-sensor modules in black printed housings, the time-of-flight sensor facing the camera.', 'DistanceSensor'],
    // MPU-6500 (WHO_AM_I 0x70): what the kit ships and what hal_mpu6500.c
    // accepts; no magnetometer (the Compass module is the separate part).
    // The page said MPU-9250 until 2026-09-19 (owner: "shipped mpu6500").
    ['p-imu.jpg',      'IMU',             'Which way the robot faces',
     'An EVN IMU module standing upright, its blue MPU-6500 breakout labelled VCC, GND, SCL, SDA visible through the housing.', 'IMU'],
    ['p-compass.jpg',  'Compass',         'A heading from the Earth’s field',
     'EVN compass modules in printed housings, the magnetometer board facing the camera.', 'Compass'],
    ['p-oled.jpg',     'Display',         'Text and pictures',
     'An EVN OLED module in a white printed housing, its 128 by 64 display facing the camera between two other modules.', 'Display'],
    ['p-matrix.jpg',   'LED matrix',      'Icons and scrolling text',
     'An EVN 8 by 8 LED matrix module in a printed housing, the matrix facing the camera.', 'MatrixLED']
  ];
  function sectionOf(cls) {
    var all = PERIPHERALS.concat(EXTENDED);
    for (var i = 0; i < all.length; i++) { if (all[i][2] === cls) { return '#/' + all[i][3] + '/' + all[i][4]; } }
    return '#/api/';
  }

  /* ---- the site's own pages: home, Get started, Docs, Downloads ------------------------------------- */

  /* The pages that are not a document of DOCS. Each is a route (#/<route>) and, like a document, a page of its own at
     /<route>/: scripts/publish_public.py site_routes() reads the `page: true` rows here. */
  var PAGES = {
    'start':         { page: true, title: 'Get started' },
    'documentation': { page: true, title: 'Docs' },
    'downloads':     { page: true, title: 'Downloads' }
  };

  /* The home page's feature cards come from assets/features.json (its header says what each status means and the one
     edit that flips the next release's cards to "Available now"). A card is "Available now" when its feature is
     released: status "available", or status "release" with a `release` the file's `released` has reached. */
  var FEATURES_URL = 'assets/features.json';
  var featuresP = null;
  function readFeatures() {
    if (!featuresP) {
      featuresP = fetch(FEATURES_URL, { cache: 'no-cache' }).then(function (r) {
        if (!r.ok) { throw new Error(r.status + ' ' + r.statusText); }
        return r.json();
      });
      featuresP.catch(function () { featuresP = null; });     // a later visit of the home page tries again
    }
    return featuresP;
  }
  /* "0.2.76" >= "0.2.75": dotted numbers compared part by part */
  function versionAtLeast(have, want) {
    var a = String(have || '').split('.'), b = String(want || '').split('.');
    for (var i = 0; i < Math.max(a.length, b.length); i++) {
      var x = parseInt(a[i] || '0', 10), y = parseInt(b[i] || '0', 10);
      if (x !== y) { return x > y; }
    }
    return true;
  }
  function featureStatus(f, released) {
    if (f.status === 'available') { return 'now'; }
    if (f.status === 'release' && f.release && versionAtLeast(released, f.release)) { return 'now'; }
    return 'soon';
  }
  var BADGE = { soon: 'Coming soon' };      // the owner, 2026-11-11: "just note those that are coming soon"
  function external(href) { return /^https?:/i.test(href) || /^ide\//.test(href); }
  function linkTo(a, href) {
    a.href = href;
    if (external(href)) { a.target = '_blank'; a.rel = 'noopener'; }
    return a;
  }

  /* One card: a picture where the repository has one, the status badge, a short headline (a link when the feature is
     available and has a page) and one sentence. The headline's link covers the whole card (.fcard-link::after), so the
     card is one Tab stop and its name is the headline. */
  function featureCard(f, released) {
    var st = featureStatus(f, released);
    var card = el('article', 'fcard fcard-' + st);
    card.setAttribute('data-feature', f.id);
    if (f.image) {
      var img = el('img', 'fcard-img');
      img.src = f.image.src;
      img.width = f.image.width;
      img.height = f.image.height;
      img.loading = 'lazy';
      img.alt = f.image.alt;
      card.appendChild(img);
    }
    var h = el('h3');
    if (f.link && st === 'now') {
      h.appendChild(linkTo(el('a', 'fcard-link', f.title), f.link));
    } else {
      h.textContent = f.title;
    }
    card.appendChild(h);
    if (BADGE[st]) { card.appendChild(el('p', 'badge badge-' + st, BADGE[st])); }
    card.appendChild(el('p', 'fcard-text', f.text));
    return card;
  }

  function renderAudiences(box, data) {
    box.textContent = '';
    (data.audiences || []).forEach(function (au) {
      var s = el('section', 'aud');
      s.id = au.id;
      s.setAttribute('aria-labelledby', au.id + '-h');
      var w = el('div', 'wrap');
      var head = el('div', 'aud-head');
      var h = el('h2', null, au.title);
      h.id = au.id + '-h';
      head.appendChild(h);
      head.appendChild(el('p', 'aud-line', au.line));
      w.appendChild(head);
      var grid = el('div', 'fgrid');
      (data.features || []).filter(function (f) { return f.audience === au.id; })
        .forEach(function (f) { grid.appendChild(featureCard(f, data.released)); });
      w.appendChild(grid);
      s.appendChild(w);
      box.appendChild(s);
    });
  }

  /* A link to a section (#/for/teachers, #/start/board): the focus moves to the section and its heading is said, as
     a route change moves it to <main> and says the page (route() below). A section not built yet (the home page's cards
     still loading) takes the focus when it arrives (pendingFocus). */
  var pendingFocus = null;
  function focusSection(id) {
    var t = document.getElementById(id);
    if (!t) { return false; }
    if (!t.hasAttribute('tabindex')) { t.setAttribute('tabindex', '-1'); }
    try { t.focus({ preventScroll: true }); } catch (e) { t.focus(); }
    var h = t.querySelector('h2, h3');
    announce(h ? h.textContent : document.title);
    return true;
  }

  function scrollToId(id) {
    var t = id ? document.getElementById(id) : null;
    if (t) { t.scrollIntoView(); } else { window.scrollTo(0, 0); }
  }

  /* A page of the site's own: the crumb, its heading and one line under it. */
  function pageHead(title, line) {
    var s = el('section', 'page-head');
    var w = el('div', 'wrap');
    var crumb = el('p', 'crumb');
    var home = el('a', null, 'Home');
    home.href = '#/';
    crumb.appendChild(home);
    crumb.appendChild(document.createTextNode(' / ' + title));
    w.appendChild(crumb);
    w.appendChild(el('h1', null, title));
    if (line) { w.appendChild(el('p', 'lead', line)); }
    s.appendChild(w);
    return { node: s, body: w };
  }

  /* ---- the stage's words and data -------------------------------------------------------------------- */

  /* The photoreal renders (the marketing pipeline's own Cycles stills, docs/session/2026-11-10_site76/data/render_stills.py,
     each from the view of hero3d.js's pose for it, on a transparent ground: stage_still_webp.py). The first screen's board is
     what every visitor sees first, the 3D board fading in over it where it runs; each chapter shows its scene beside its card
     (above it in the stacked layout) with or without WebGL, the 3D layer taking its place at the same angle where it runs
     (hero3d.js marks the chapter has-3d once its scene is in). The owner, 2026-11-10: "The home page looks to be missing the
     renders". */
  var STAGE_STILL = { src: 'assets/images/stage-board.webp', width: 1280, height: 913 };
  var CHAPTER_STILLS = {
    motors: { src: 'assets/images/chapter-motors.webp', width: 1280, height: 892,
      alt: 'The EVN ALPHA board with LEGO MINDSTORMS EV3 and NXT motors and a small gearmotor plugged into its four motor ports.' },
    sensors: { src: 'assets/images/chapter-sensors.webp', width: 1281, height: 1054,
      alt: 'The EVN ALPHA board with a colour sensor, a distance sensor, a gesture sensor and an OLED display showing the EVN logo, cabled to its ports.' },
    code: { src: 'assets/images/chapter-code.webp', width: 1275, height: 845,
      alt: 'The EVN ALPHA board on a USB-C cable to a laptop showing the EVN blocks editor with its Python panel.' },
    technic: { src: 'assets/images/chapter-robot.webp', width: 1224, height: 804,
      alt: 'A two-wheeled competition robot built from LEGO Technic parts around the EVN ALPHA board.' },
    simulator: { src: 'assets/images/chapter-sim.webp', width: 1279, height: 1073,
      alt: 'A laptop running the EVN robot simulator on a WRO RoboMission table.' }
  };

  /* The scroll story: [id, kicker, headline, sentence, [link label, href] or null, a small note or none]. Facts from the board's page
     (docs/BOARD.md), the CHANGELOG and the simulator's page; hero3d.js has one pose per chapter. */
  var CHAPTERS = [
    ['motors', 'Motors', 'Plug in the motors you already have.',
     'Four motor ports that work with LEGO MINDSTORMS EV3 and NXT motors, and the board calibrates each one itself.',
     ['Calibrating your robot', '#/calibration/']],
    ['sensors', 'Sensors and displays', 'Sixteen peripheral ports. Found by name.',
     'Plug in a sensor or a display and it shows up by name, with four servo ports and two serial ports beside them.',
     ['Sensors and displays', '#/documentation/sensors']],
    ['code', 'Code', 'Blocks or Python, live on the robot.',
     'Snap blocks together or type Python with autocomplete, in VS Code or the browser, and watch the robot as it runs.',
     ['Get started', '#/start']],
    /* the owner, 2026-11-11: "04 should be about lego technic compatibility/competition readiness. model is the wro
       drivebase. this is where we state that evn robots have won national championships at WRO and RoboCup and awards
       at the Regional and International level, linking the trophy room" */
    ['technic', 'LEGO Technic', 'Built on LEGO Technic. Proven in competition.',
     'It mounts with Technic pins and beams. EVN robots have won national championships at WRO and RoboCup, and awards at regional and international level.',
     ['Every result, in the trophy room', 'https://edu.coresg.tech/trophy-room/'],
     'LEGO and LEGO Technic are trademarks of the LEGO Group, which does not sponsor or endorse EVN.'],
    ['simulator', 'Simulator', 'Practise without a field.',
     'Run your program on the WRO RoboMission tables and RoboCup Junior Rescue Line fields, with a referee that scores the run.',
     ['The robot simulator', '#/simulator/'],
     'EVN is not affiliated with or endorsed by the World Robot Olympiad Association or the RoboCup Federation.']
  ];


  /* The 3D layer (assets/hero3d.js) loads only where it helps: after the page has loaded and gone idle, with
     IntersectionObserver and WebGL, never under prefers-reduced-motion or Save-Data. It finds the model in
     assets/3d/models.json. Whatever stops it, the photo stays and data-3d on the stage says why. */
  function startStage(stage) {
    if (!('IntersectionObserver' in window) || !window.matchMedia) { return; }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { stage.setAttribute('data-3d', 'still-reduced-motion'); return; }
    var c = navigator.connection;
    if (c && c.saveData) { stage.setAttribute('data-3d', 'still-save-data'); return; }
    var gl = null;
    try { var probe = document.createElement('canvas'); gl = probe.getContext('webgl2') || probe.getContext('webgl'); } catch (e) { gl = null; }
    if (!gl) { stage.setAttribute('data-3d', 'still-no-webgl'); return; }
    var lose = gl.getExtension('WEBGL_lose_context');
    if (lose) { lose.loseContext(); }
    function go() {
      if (!stage.isConnected) { return; }
      stage.setAttribute('data-3d', 'loading');
      fetch('assets/3d/models.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : {}; })
        .catch(function () { return {}; })
        .then(function (models) {
          return import(new URL('assets/hero3d.js', document.baseURI).href).then(function (m) {
            /* ?evn3d=keep (screen captures on a software renderer only): keep the layer even if its first frames are slow */
            if (!stage.isConnected) { return; }
            return m.start(stage, { models: models, keepSlow: /[?&]evn3d=keep\b/.test(location.search) }).then(function (h) {
              if (stage.isConnected) { stageHandle = h; } else { h.stop('left'); }
            });
          });
        })
        .catch(function () { stage.setAttribute('data-3d', 'fallback'); stage.setAttribute('data-3d-why', 'load'); });
    }
    /* and only once the stage is on screen: a visitor who lands at #/for/<x>, far below it, downloads nothing until they
       scroll up to it */
    var idle = window.requestIdleCallback || function (f) { setTimeout(f, 200); };
    function whenSeen() {
      var seen = new IntersectionObserver(function (es) {
        if (!stage.isConnected) { seen.disconnect(); return; }
        if (es[0].isIntersecting) { seen.disconnect(); idle(go); }
      });
      seen.observe(stage);
    }
    if (document.readyState === 'complete') { whenSeen(); } else { window.addEventListener('load', whenSeen, { once: true }); }
  }
  /* the running layer (hero3d.js start()'s handle): stopped, and its GPU memory freed, whenever <main> is replaced */
  var stageHandle = null;
  function stopStage() { if (stageHandle) { stageHandle.stop('left'); stageHandle = null; } }

  /* ---- the page indicator: the EVN RGB LED, its eight WS2812B pixels one per section of the home page ----------
     assets/images/rgb-led-strip.png is the marketing pipeline's own render of the module as it ships (in its printed mount,
     with its headers and the plugged cable, from the docs photo's view: docs/session/2026-11-10_site76/data/
     render_led_strip.py), turned so pixel 0 (the IN end) is at the top; LED_AT is each pixel's centre in that picture,
     measured on the lit render. Every pixel is a link to its section, named beside it on hover and focus; the section in
     view lit EVN gold, the ones before it dim white, the rest dark (owner, 2026-11-10: "the current page be evn gold
     (bright), and previous pages as a single color (dim, maybe white)"; site.css "the page indicator"). */
  var LED_AT = [25.44, 33.86, 42.37, 50.84, 59.32, 67.83, 76.23, 84.81];   // % from the top; every pixel at 55.75 % across
  var LED_SECTIONS = [['stage-top', 'EVN ALPHA'], ['chapter-motors', 'Motors'], ['chapter-sensors', 'Sensors and displays'],
                      ['chapter-code', 'Code'], ['chapter-technic', 'LEGO Technic'], ['chapter-simulator', 'Simulator'],
                      ['audiences', 'Who it is for'], ['story', 'The story']];
  var ledTeardown = null;
  function ledNav() {
    var nav = el('nav', 'led-nav');
    nav.setAttribute('aria-label', 'Sections of this page');
    var img = el('img', 'led-strip');
    img.src = 'assets/images/rgb-led-strip.png';
    img.width = 138;
    img.height = 640;
    img.alt = '';
    img.loading = 'lazy';                                // hidden under 1340 px: a phone never fetches it
    nav.appendChild(img);
    var ol = el('ol');
    var links = LED_SECTIONS.map(function (s, i) {
      var li = el('li');
      li.style.top = LED_AT[i] + '%';
      var a = el('a', 'led');
      a.href = '#/for/' + s[0];
      a.appendChild(el('span', 'led-label', s[1]));
      li.appendChild(a);
      ol.appendChild(li);
      return a;
    });
    nav.appendChild(ol);
    var ticking = false;
    function update() {
      ticking = false;
      var at = -1, line = window.innerHeight * 0.45;
      LED_SECTIONS.forEach(function (s, i) {
        var t = document.getElementById(s[0]);
        if (t && t.getBoundingClientRect().top <= line) { at = i; }
      });
      links.forEach(function (a, i) {
        a.parentNode.className = i < at ? 'on' : i === at ? 'on now' : '';
        if (i === at) { a.setAttribute('aria-current', 'location'); } else { a.removeAttribute('aria-current'); }
      });
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
    if (ledTeardown) { ledTeardown(); }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    ledTeardown = function () { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); ledTeardown = null; };
    requestAnimationFrame(update);
    return nav;
  }

  /* ---- the home page: what EVN does, by audience ---- */

  var AUDIENCE_NAV = [['students', 'Students'], ['teachers', 'Teachers'], ['school-leaders', 'School leaders'],
                      ['competition', 'Competition teams'], ['higher-learning', 'Higher learning'], ['parents', 'Parents']];

  function renderHome(slug) {
    document.title = SITE;
    markCurrentNav('home');
    /* built: the home page is in <main> and its cards are there or on their way; after a failed load it is built again */
    var built = current && current.doc === 'home' && document.getElementById('audiences')
      && !document.querySelector('#audiences .notice-failed');
    current = { doc: 'home', slug: slug || '' };
    if (built) { scrollToId(slug); return; }               /* already on the home page: only move */
    stopSpy();
    main.textContent = '';

    /* --- the stage: the first screen and the scroll story, over the board (3D where it helps, a photo otherwise) ---
       Everything said here is HTML; the visual behind it is decorative (aria-hidden). site.js startStage() decides
       whether assets/hero3d.js loads; without it the photo stays. */
    var stage = el('section', 'stage');
    stage.setAttribute('aria-label', 'EVN ALPHA');
    stage.setAttribute('data-3d', 'still');
    var vis = el('div', 'stage-visual');
    vis.setAttribute('aria-hidden', 'true');
    var still = el('img', 'stage-still');
    stage.style.setProperty('--still-r', (STAGE_STILL.height / STAGE_STILL.width).toFixed(4));
    still.src = STAGE_STILL.src;
    still.width = STAGE_STILL.width;
    still.height = STAGE_STILL.height;
    still.alt = '';
    still.decoding = 'async';
    vis.appendChild(still);
    stage.appendChild(vis);

    var hero = el('div', 'hero stage-hero');
    hero.id = 'stage-top';
    var hw = el('div', 'wrap');
    var left = el('div', 'stage-copy');
    var eyebrow = el('p', 'eyebrow', 'Early\u00a0access\u00a0· user\u00a0testing\u00a0· ');   // wraps only after a dot; the space before the link (site review N1)
    eyebrow.appendChild(reportLink('report-link'));        // where a tester reports (SITE-09)
    left.appendChild(eyebrow);
    var h1 = el('h1', 'stage-title', 'EVN ALPHA');
    h1.appendChild(el('span', 'sub', 'MicroPython'));
    left.appendChild(h1);
    left.appendChild(el('p', 'stage-display', 'The natural evolution of the robot kit.'));
    left.appendChild(el('p', 'pitch',
      'Program your EVN ALPHA robot in blocks or Python, from VS Code or your browser.'));
    var actions = el('div', 'actions');
    var bIde = el('a', 'btn btn-primary', 'Try it in your browser');
    linkTo(bIde, 'ide/');
    actions.appendChild(bIde);
    var bCode = el('a', 'btn btn-ghost', 'Install it in VS Code');
    bCode.href = '#/start/vs-code';
    actions.appendChild(bCode);
    var bSchool = el('a', 'btn btn-ghost', 'EVN for schools');
    bSchool.href = '#/for/school-leaders';
    actions.appendChild(bSchool);
    left.appendChild(actions);
    left.appendChild(el('p', 'meta',
      'Free and MIT licensed. Works with VS Code 1.106 or newer on Windows, macOS and Linux.'));
    hw.appendChild(left);
    /* who it is for: one link to each audience's section */
    var jump = el('nav', 'aud-nav');
    jump.setAttribute('aria-label', 'Who EVN is for');
    jump.appendChild(el('span', 'aud-lead', 'Made for'));   // a quiet line, not a second row of buttons
    var ul = el('ul');
    AUDIENCE_NAV.forEach(function (x) {
      var li = el('li');
      var a = el('a', null, x[1]);
      a.href = '#/for/' + x[0];
      li.appendChild(a);
      ul.appendChild(li);
    });
    jump.appendChild(ul);
    hw.appendChild(jump);
    var cue = el('p', 'stage-cue', 'Scroll to see the board');
    cue.setAttribute('aria-hidden', 'true');
    hw.appendChild(cue);
    hero.appendChild(hw);
    stage.appendChild(hero);

    /* the four chapters the board turns through as they scroll past */
    CHAPTERS.forEach(function (c, n) {
      var ch = el('article', 'chapter');
      ch.id = 'chapter-' + c[0];
      ch.setAttribute('aria-labelledby', ch.id + '-h');
      var cw = el('div', 'wrap');
      var card = el('div', 'chapter-card');
      card.appendChild(el('p', 'chapter-n', '0' + (n + 1) + ' · ' + c[1]));
      var h = el('h2', null, c[2]);
      h.id = ch.id + '-h';
      card.appendChild(h);
      card.appendChild(el('p', 'chapter-text', c[3]));
      if (c[4]) { card.appendChild(linkTo(el('a', 'chapter-link', c[4][0]), c[4][1])); }
      if (c[5]) { card.appendChild(el('p', 'chapter-note', c[5])); }
      cw.appendChild(card);
      var still = CHAPTER_STILLS[c[0]];
      if (still && !still.pending) {                       // pending: its render is not in the repository yet
        var fig = el('figure', 'chapter-fig');
        var im = el('img');
        im.src = still.src;
        im.width = still.width;
        im.height = still.height;
        im.alt = still.alt;
        im.loading = 'lazy';
        im.decoding = 'async';
        fig.appendChild(im);
        cw.appendChild(fig);
        ch.classList.add('has-fig');                       // site.css: the layout with a render
      }
      ch.appendChild(cw);
      stage.appendChild(ch);
    });
    main.appendChild(stage);
    /* the chapters rise in as they arrive; only with IntersectionObserver (else no class, so nothing is hidden) */
    if ('IntersectionObserver' in window) {
      document.documentElement.classList.add('js-reveal');
      var rio = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); rio.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -15% 0px' });
      stage.querySelectorAll('.chapter').forEach(function (ch) { rio.observe(ch); });
    }

    /* --- one section per audience, its cards from assets/features.json --- */
    var box = el('div', 'audiences');
    box.id = 'audiences';
    var w0 = el('div', 'wrap');
    var loading = el('p', 'notice');
    loading.appendChild(el('span', 'spinner'));
    loading.appendChild(document.createTextNode('Loading the features…'));
    w0.appendChild(loading);
    box.appendChild(w0);
    main.appendChild(box);
    /* the cards arrive after the page: a click on an audience link meanwhile (#/for/<x>) keeps this page, so the
       guard is "still this home page", and the scroll and the focus go where the visitor is now (current.slug) */
    readFeatures().then(function (data) {
      if (current.doc !== 'home' || !box.isConnected) { return; }
      renderAudiences(box, data);
      if (current.slug) { scrollToId(current.slug); }
      /* only if the focus is still where the route change put it: a visitor who has moved on (the search) keeps it */
      if (pendingFocus && current.slug === pendingFocus && (document.activeElement === main || document.activeElement === document.body)) {
        focusSection(pendingFocus);
      }
      pendingFocus = null;
    }).catch(function (e) {
      if (current.doc !== 'home' || !box.isConnected) { return; }
      w0.textContent = '';
      var p = el('p', 'notice notice-failed', 'The feature list could not be loaded (' + e.message + '). ');
      var a = el('a', null, 'Every document is on the Docs page.');
      a.href = '#/documentation';
      p.appendChild(a);
      w0.appendChild(p);
    });

    /* --- the story and its credit (every public page credits EVN's two creators) --- */
    var st = section('The story');
    st.node.id = 'story';
    var sg = el('div', 'story-grid');
    var prose = el('div', 'story-prose');
    prose.appendChild(el('p', null,
      'LEGO® MINDSTORMS® was discontinued in 2022. The material for learning with it thinned ' +
      'out, and serious robotics hardware stayed expensive. EVN is the answer to that: an affordable, ' +
      'open platform — the natural evolution of LEGO MINDSTORMS, and a basecamp for students who ' +
      'want to get serious about robotics.'));
    prose.appendChild(el('p', null,
      'The board exists because of its backers: the Kickstarter campaign “EVN: The Natural Evolution ' +
      'of the LEGO® MINDSTORMS® System” was funded by 71 backers. Without them EVN would not exist.'));
    var ks = el('a', 'btn btn-ghost', 'The story on Kickstarter');
    linkTo(ks, 'https://www.kickstarter.com/projects/thenaturalevolution/evn-the-natural-evolution-of-the-lego-mindstorms-system');
    var kw = el('div', 'actions');
    kw.appendChild(ks);
    prose.appendChild(kw);
    sg.appendChild(prose);

    var credit = el('div', 'credit');                 // not an <aside>: a complementary landmark inside <main> fails axe
    credit.appendChild(el('span', 'kicker', 'Created by'));
    [['Kenneth Chow', 'Strategic Lead and mentor. Founded the Centre of Robotics Excellence in 2014.',
      [['linkedin.com/in/kc-robotics', 'https://www.linkedin.com/in/kc-robotics/']]],
     ['Heng Teng Yi', 'Technical Lead and mentee. Author and maintainer of the EVN Arduino library.',
      [['linkedin.com/in/heng-teng-yi', 'https://www.linkedin.com/in/heng-teng-yi/'], ['github.com/HTY2003', 'https://github.com/HTY2003']]]]
      .forEach(function (person) {
        var pb = el('div', 'person');
        pb.appendChild(el('p', 'who', person[0]));
        pb.appendChild(el('p', 'what', person[1]));
        person[2].forEach(function (l) { pb.appendChild(linkTo(el('a', 'credit-link', l[0]), l[1])); });
        credit.appendChild(pb);
      });
    var stats = el('ul', 'stats');
    [['2014', 'the Centre of Robotics Excellence founded'], ['2018', 'the first EVN ALPHA'], ['71', 'Kickstarter backers'], ['S$13,053', 'pledged, of a S$8,888 goal']]
      .forEach(function (s) {
        var li = el('li');
        li.appendChild(el('strong', null, s[0]));
        li.appendChild(el('span', null, s[1]));
        stats.appendChild(li);
      });
    credit.appendChild(stats);
    sg.appendChild(credit);
    st.body.appendChild(sg);
    main.appendChild(st.node);

    main.appendChild(ledNav());
    followStill(stage);
    scrollToId(slug);
    startStage(stage);
  }

  /* The stacked layout (1100 px and under: site.css, hero3d.js STACKED): the board, full size, above the first screen's
     words. Where the words run past the stage (a phone: about 550 px of them under a 300 px board), the board scrolls up
     with them by as much as they overflow, so no word ever passes under it (data/shots.js "the board covers no word"),
     and comes back down over the first chapter's approach. hero3d.js fits the 3D board into the still's box as it moves. */
  var stillTeardown = null;
  function followStill(stage) {
    if (stillTeardown) { stillTeardown(); }
    var still = stage.querySelector('.stage-still'), hero = stage.querySelector('.stage-hero'), vis = stage.querySelector('.stage-visual');
    /* a browser without matchMedia (jsdom, an old one) keeps the wide layout's still where site.css puts it */
    var mq = window.matchMedia ? window.matchMedia('(max-width: 1100px)') : { matches: false }, ticking = false;
    function place() {
      ticking = false;
      if (!mq.matches || !still || !hero || !vis) { stage.style.removeProperty('--still-y'); return; }
      var s = Math.max(0, -stage.getBoundingClientRect().top), over = Math.max(0, hero.offsetHeight - vis.clientHeight);
      var back = vis.clientHeight * 0.4;
      var y = s <= hero.offsetHeight ? Math.min(s, over) : over * Math.max(0, 1 - (s - hero.offsetHeight) / back);
      stage.style.setProperty('--still-y', (-Math.round(y)) + 'px');
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(place); } }
    place();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    stillTeardown = function () { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); stillTeardown = null; };
  }

  /* ---- Get started: three paths, a few numbered steps each, the guides for the detail ---- */

  /* [id, heading, one line, steps, the guides]; a step is text, or [text, link label, href] */
  var PATHS = [
    ['browser', 'In the browser', 'Nothing to install: Chrome or Edge, and a USB cable.', [
      ['Open the browser IDE in Chrome or Edge.', 'Open the browser IDE', 'ide/'],
      ['The board needs the MicroPython firmware on it: a browser cannot put it there.', 'Putting the firmware on',
       '#/getting-started/4-put-the-firmware-on-the-board'],
      'Plug the board in with the USB cable and switch it on, press Choose the board port, pick An EVN ALPHA on USB, then Connect.',
      'Open an example under Examples, put the wheels off the ground and press Run.'],
     [['Programs: run, stop, ports and units', '#/programs/']]],
    ['vs-code', 'In VS Code', 'The extension, with the firmware inside it.', [
      ['Install VS Code 1.106 or newer.', 'code.visualstudio.com', 'https://code.visualstudio.com/'],
      ['Download the extension and install it: Extensions view, the … menu, Install from VSIX.', 'Downloads', '#/downloads'],
      'Run EVN: Install mpremote once.',
      'Plug the board in, switch it on and run EVN: Flash MicroPython firmware.',
      'Open motor_minimal under Examples, plug a motor into port 1 and press Ctrl+F5.'],
     [['Getting started, step by step', '#/getting-started'], ['Troubleshooting', '#/troubleshooting']]],
    ['board', 'With a board', 'Switching the EVN ALPHA on, and its first set-up.', [
      'Insert the two 18650 cells in the order the card shows, minding the + and - marks.',
      'Press ON/OFF: the red LED lights while the board is on.',
      'Connect the USB-C cable to your computer: the green LED lights.',
      ['Calibrate the motors, the IMU and the sensors from the Board view.', 'Calibrating your robot', '#/calibration/']],
     [['Switch the board on', '#/getting-started/2-switch-the-board-on'], ['The board: buttons, lights and pins', '#/board/']]]
  ];

  function renderStart(slug) {
    var head = pageHead('Get started', 'Pick one way in. Each takes a few minutes.');
    main.appendChild(head.node);
    var s = el('section', 'section paths-section');
    var w = el('div', 'wrap');
    var grid = el('div', 'paths');
    PATHS.forEach(function (p) {
      var box = el('section', 'path');
      box.id = p[0];
      box.setAttribute('aria-labelledby', p[0] + '-h');
      var h = el('h2', null, p[1]);
      h.id = p[0] + '-h';
      box.appendChild(h);
      box.appendChild(el('p', 'path-line', p[2]));
      var ol = el('ol', 'steps');
      p[3].forEach(function (step) {
        var li = el('li');
        if (typeof step === 'string') { li.textContent = step; } else {
          li.appendChild(document.createTextNode(step[0] + ' '));
          li.appendChild(linkTo(el('a', null, step[1]), step[2]));
        }
        ol.appendChild(li);
      });
      box.appendChild(ol);
      var more = el('p', 'path-more', 'More: ');
      p[4].forEach(function (g, n) {
        if (n) { more.appendChild(document.createTextNode(' · ')); }
        more.appendChild(linkTo(el('a', null, g[0]), g[1]));
      });
      box.appendChild(more);
      grid.appendChild(box);
    });
    w.appendChild(grid);
    var sim = el('p', 'path-note', 'No board yet? ');
    sim.appendChild(linkTo(el('a', null, 'Run your program in the simulator'), '#/simulator/'));
    sim.appendChild(document.createTextNode('.'));
    w.appendChild(sim);
    s.appendChild(w);
    main.appendChild(s);
    scrollToId(slug);
  }

  /* ---- Docs: one index of the documents, grouped by what you want to do ---- */

  /* [id, heading, entries]; an entry is [route] (the document, its DOCS title), [route, heading slug, label] or
     [https URL, label]. scripts/test_site.js checks that every route of DOCS is here. */
  var DOC_GROUPS = [
    ['start-here', 'Start here', [['getting-started'], ['troubleshooting'], ['known-limitations']]],
    ['program', 'Program the robot', [['programs'], ['blocks'], ['api'], ['api-robot'], ['api-system'], ['repl'], ['main-py']]],
    ['simulator', 'Use the simulator', [['simulator'], ['simulator', 'challenges', 'Challenges'],
      ['simulator', 'wro-robomission', 'WRO RoboMission'], ['simulator', 'the-referee', 'The RoboCup Junior referee'],
      ['simulator', 'configuring-the-robot', 'Configuring the robot']]],
    ['data', 'See and record data', [['board-view'], ['data-logger'], ['notebook']]],
    ['teachers', 'For teachers', [['https://learn.coresg.tech/preview/', 'The lessons: a free preview'],
      ['simulator', 'running-a-challenge', 'Running a challenge'], ['simulator', 'licence', 'The simulator licence']]],
    ['boards', 'The board', [['board'], ['calibration'], ['bluetooth'], ['api-sensors'], ['api-displays'], ['api-extended']]],
    ['updates', 'Updates and changes', [['commands'], ['changelog'], ['changelog-full']]]
  ];

  function docEntryLink(e) {
    var a = el('a', 'doc-row');
    var label, href;
    if (/^https?:/.test(e[0])) { href = e[0]; label = e[1]; }
    else if (e.length > 1) { href = '#/' + e[0] + '/' + e[1]; label = e[2]; }
    else { href = '#/' + e[0] + (SECTIONED[e[0]] ? '/' : ''); label = DOCS[e[0]].title; }
    linkTo(a, href);
    var t = el('span', 't');
    t.appendChild(el('strong', null, label));
    if (e.length === 1 && DOCS[e[0]].blurb) { t.appendChild(el('span', null, DOCS[e[0]].blurb)); }
    a.appendChild(t);
    var go = el('span', 'go', '→');
    go.setAttribute('aria-hidden', 'true');
    a.appendChild(go);
    return a;
  }

  function periphList(rows, label) {
    var ul = el('ul', 'periph-list');
    ul.setAttribute('aria-label', label);
    rows.forEach(function (r) {
      var li = el('li');
      var a = el('a');
      a.href = '#/' + r[3] + '/' + r[4];
      a.appendChild(el('strong', null, r[0]));
      a.appendChild(el('span', null, r[1]));
      a.appendChild(el('code', null, r[2]));
      li.appendChild(a);
      ul.appendChild(li);
    });
    return ul;
  }

  function renderDocsIndex(slug) {
    var head = pageHead('Docs', 'Every guide and reference page, by what you want to do.');
    main.appendChild(head.node);
    var s = el('section', 'section docs-index');
    var w = el('div', 'wrap');
    var toc = el('nav', 'aud-nav');
    toc.setAttribute('aria-label', 'Groups on this page');
    var tul = el('ul');
    DOC_GROUPS.concat([['sensors', 'Sensors and displays']]).forEach(function (g) {
      var li = el('li');
      var a = el('a', null, g[1]);
      a.href = '#/documentation/' + g[0];
      li.appendChild(a);
      tul.appendChild(li);
    });
    toc.appendChild(tul);
    w.appendChild(toc);
    var cols = el('div', 'doc-groups');
    DOC_GROUPS.forEach(function (g) {
      var box = el('section', 'doc-group');
      box.id = g[0];
      box.setAttribute('aria-labelledby', g[0] + '-h');
      var h = el('h2', null, g[1]);
      h.id = g[0] + '-h';
      box.appendChild(h);
      var list = el('div', 'doc-list');
      g[2].forEach(function (e) { list.appendChild(docEntryLink(e)); });
      box.appendChild(list);
      cols.appendChild(box);
    });
    w.appendChild(cols);

    /* the sensors and displays, in plain words, each linked to its section of the API reference (SITE-19) */
    var ps = el('section', 'doc-group doc-group-wide');
    ps.id = 'sensors';
    ps.setAttribute('aria-labelledby', 'sensors-h');
    var ph = el('h2', null, 'Sensors and displays');
    ph.id = 'sensors-h';
    ps.appendChild(ph);
    ps.appendChild(el('p', 'gallery-intro',
      'Plug a sensor or a display into any of the sixteen sensor ports and the board finds it by itself: it shows up by name in the Board ' +
      'panel. Servos and LED strips plug into the servo ports and the Bluetooth module into a serial port.'));
    var gal = el('div', 'gallery');
    GALLERY.forEach(function (g) {
      var figure = el('a', 'shot');
      figure.href = sectionOf(g[4]);
      var im = el('img');
      im.src = 'assets/images/' + g[0];
      im.width = 480;
      im.height = 360;
      im.loading = 'lazy';
      im.alt = g[3];
      figure.appendChild(im);
      var cap = el('span', 'cap');
      cap.appendChild(el('strong', null, g[1]));
      cap.appendChild(document.createTextNode(g[2]));
      figure.appendChild(cap);
      gal.appendChild(figure);
    });
    ps.appendChild(gal);
    ps.appendChild(el('h3', 'periph-h', 'Every EVN module'));
    ps.appendChild(periphList(PERIPHERALS, 'Every EVN module'));
    ps.appendChild(el('h3', 'periph-h', 'Kit you may already own'));
    ps.appendChild(el('p', 'gallery-intro',
      'These work the same way, though EVN does not sell them (the extended peripherals).'));
    ps.appendChild(periphList(EXTENDED, 'Kit you may already own'));
    w.appendChild(ps);
    s.appendChild(w);
    main.appendChild(s);
    scrollToId(slug);
  }

  /* ---- Downloads: the extension and the firmware from latest.json ---- */

  function renderDownloads(slug) {
    var head = pageHead('Downloads', 'The VS Code extension carries the firmware and flashes it for you.');
    main.appendChild(head.node);
    /* --- downloads --- */
    var d = section('The files');
    d.node.id = 'downloads';
    var dlBox = el('div');
    var loading = el('p', 'notice');
    loading.appendChild(el('span', 'spinner'));
    loading.appendChild(document.createTextNode('Reading latest.json…'));
    dlBox.appendChild(loading);
    d.body.appendChild(dlBox);
    main.appendChild(d.node);

    readLatest().then(function (j) {
      dlBox.textContent = '';
      var ext = j.extension || {}, fw = j.firmware || {};
      var g = el('div', 'dl-grid');
      g.appendChild(dlCard('VS Code extension', ext.version,
        'The tooling: the block editor, the Python autocomplete, the Board panel and the live console. ' +
        'It carries the firmware below and flashes it for you.',
        [['Download the VSIX', ext.vsix, true], ['Release notes', '#/changelog', false]]));
      g.appendChild(dlCard('MicroPython firmware', fw.version,
        'Only needed without the extension: with the board switched on, hold BOOTSEL, press and release RESET, let go of BOOTSEL, and copy the UF2 ' +
        'onto the drive that appears.',
        [['Download the UF2', fw.uf2, true], ['Build record', fw.notes, false]]));
      dlBox.appendChild(g);
      var note = el('p', 'dl-note');
      note.appendChild(document.createTextNode('To install the VSIX: VS Code → Extensions view → the '));
      note.appendChild(el('code', null, '…'));
      note.appendChild(document.createTextNode(' menu → '));
      note.appendChild(el('strong', null, 'Install from VSIX…'));
      note.appendChild(document.createTextNode(' → pick the file. Then run '));
      note.appendChild(el('code', null, 'EVN: Install mpremote'));
      note.appendChild(document.createTextNode(' once. '));
      var older = el('a', null, 'Older versions of the extension');   // the versions page (#202): GitHub Releases
      older.href = 'vsix/';
      note.appendChild(older);
      note.appendChild(document.createTextNode('.'));
      dlBox.appendChild(note);
    }).catch(function (e) {
      dlBox.textContent = '';
      var p = el('p', 'notice', 'The download list (latest.json) could not be read (' + e.message +
        '). The files: ');
      var a1 = el('a', null, 'the VSIX (every version)');
      a1.href = 'vsix/';
      var a2 = el('a', null, 'the firmware UF2');
      a2.href = REPO + '/tree/main/firmware';
      p.appendChild(a1);
      p.appendChild(document.createTextNode(' and '));
      p.appendChild(a2);
      p.appendChild(document.createTextNode('.'));
      dlBox.appendChild(p);
    });

    /* --- the browser IDE --- */
    if (SHOW_IDE) {
      var i = section('Use it in the browser');
      var card = el('div', 'ide-card');
      var txt = el('div', 'txt');
      txt.appendChild(el('h3', null, 'No install: the EVN IDE in your browser'));
      txt.appendChild(el('p', null,
        'The same editor, the same blocks and the same board panel, running as a web page. It talks to ' +
        'the board over Web Serial, so it needs a Chromium browser (Chrome or Edge) and a USB cable.'));
      var go = el('a', 'btn btn-primary', 'Open the browser IDE');
      linkTo(go, 'ide/');
      card.appendChild(txt);
      card.appendChild(go);
      i.body.appendChild(card);
      main.appendChild(i.node);
    }
    scrollToId(slug);
  }

  var PAGE_RENDER = { start: renderStart, documentation: renderDocsIndex, downloads: renderDownloads };

  function renderPage(r) {
    var info = PAGES[r.doc];
    document.title = SITE + ' · ' + info.title;
    markCurrentNav(r.doc);
    var same = current && current.doc === r.doc;
    current = r;
    if (same) { scrollToId(r.slug); return; }
    stopSpy();
    main.textContent = '';
    PAGE_RENDER[r.doc](r.slug);
  }

  function section(title) {
    var s = el('section', 'section');
    var w = el('div', 'wrap');
    var h = el('h2', null, title);
    w.appendChild(h);
    s.appendChild(w);
    return { node: s, body: w };
  }

  function dlCard(title, version, note, links) {
    var c = el('div', 'dl-card');
    var h = el('h3', null, title);
    if (version) { h.appendChild(el('span', 'ver', 'v' + version)); }
    c.appendChild(h);
    c.appendChild(el('p', null, note));
    var acts = el('div', 'actions');
    links.forEach(function (l) {
      if (!l[1]) { return; }
      var a = el('a', l[2] ? 'btn btn-primary' : 'btn btn-ghost', l[0]);
      a.href = l[1];
      acts.appendChild(a);
    });
    c.appendChild(acts);
    return c;
  }

  /* ---- site search (SITE-16) -------------------------------------------------------------------------
     Full text, every page, in the browser. The index is built here at the first search, from the pages
     themselves: each document is fetched (the same cache the reader uses), rendered by renderMarkdown and given
     its heading ids by assignIds - the functions the page view uses - and cut into sections at its headings. A
     result is therefore always a route the page view resolves (#/<page>/<heading id>), and the index can never
     be older than the pages it searches (no build step: a publish-time index could drift from the documents).
     The cost, the first time only: ten fetches the reader caches anyway and one render of each (~1 MB of
     Markdown, well under a second). "Filter this page's contents" in the contents column stays: it narrows the
     current page's headings. */
  var index = null;          // promise for [{ doc, id, page, title, text, low }]

  function sectionsOf(doc, root) {
    var out = [], cur = { doc: doc, id: '', page: DOCS[doc].title, title: DOCS[doc].title, parts: [] };
    function flush() {
      var text = cur.parts.join(' ').replace(/\s+/g, ' ').trim();
      if (text || cur.id) {
        out.push({ doc: cur.doc, id: cur.id, page: cur.page, title: cur.title, text: text,
                   low: (cur.title + ' ' + text).toLowerCase() });
      }
    }
    for (var n = root.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 1 && /^H[1-6]$/.test(n.tagName)) {
        flush();
        cur = { doc: doc, id: n.id, page: DOCS[doc].title, title: n.textContent.trim(), parts: [] };
      } else if (n.nodeType === 1 || n.nodeType === 3) {
        cur.parts.push(n.textContent);
      }
    }
    flush();
    return out;
  }

  function indexDoc(doc, md) {
    /* the fragment itself, never moved into the live document: there its <img> would start loading their
       relative src at once, from the wrong place (the page view fixes them first, fixLinks) */
    var box = renderMarkdown(md);
    assignIds(box);
    return sectionsOf(doc, box);
  }

  function buildIndex() {
    if (!index) {
      index = Promise.all(ORDER.map(function (doc) {
        return fetchText(DOCS[doc].file).then(function (md) { return indexDoc(doc, md); },
                                              function () { return null; });
      })).then(function (lists) {
        var all = [], missing = 0;
        lists.forEach(function (l) { if (l) { all = all.concat(l); } else { missing++; } });
        if (missing) { index = null; }           // a page that failed is fetched again at the next search
        return { entries: all, missing: missing };
      });
    }
    return index;
  }

  /* Every word of the query must occur in the section (its heading or its text); a word in the heading weighs
     most, then a whole-phrase match, then how often the words occur. The changelog is the engineering log: its
     sections rank below the manual's. */
  function search(entries, query, limit) {
    var q = String(query).toLowerCase().replace(/\s+/g, ' ').trim();
    if (!q) { return []; }
    var terms = q.split(' ');
    var hits = [];
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i], ok = true, s = 0, tl = e.title.toLowerCase();
      for (var t = 0; t < terms.length && ok; t++) {
        if (e.low.indexOf(terms[t]) === -1) { ok = false; break; }
        if (tl.indexOf(terms[t]) !== -1) { s += 10; }
        var from = 0, k = 0;
        while (k < 5 && (from = e.low.indexOf(terms[t], from)) !== -1) { k++; from += terms[t].length; }
        s += k;
      }
      if (!ok) { continue; }
      if (terms.length > 1 && e.low.indexOf(q) !== -1) { s += 8; }
      if (tl === q) { s += 20; }
      if (e.doc === 'changelog') { s *= 0.3; }
      hits.push({ e: e, s: s, o: ORDER.indexOf(e.doc) });
    }
    hits.sort(function (a, b) { return b.s - a.s || a.o - b.o; });
    return hits.slice(0, limit || 20).map(function (h) { return h.e; });
  }

  /* ~170 characters of a section's text around the first match, the query's words marked. */
  function snippet(text, query) {
    var low = text.toLowerCase(), terms = String(query).toLowerCase().trim().split(/\s+/);
    var at = low.indexOf(terms.join(' '));
    if (at === -1) { at = low.indexOf(terms[0]); }
    if (at === -1) { at = 0; }
    var start = Math.max(0, at - 60), end;
    if (start > 0) {                                   // start on a word, not inside one
      var sp = text.indexOf(' ', start);
      if (sp !== -1 && sp < at) { start = sp + 1; }
    }
    end = Math.min(text.length, start + 170);
    return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
  }
  function markInto(node, text, query) {
    var terms = String(query).toLowerCase().trim().split(/\s+/).filter(Boolean);
    var low = text.toLowerCase(), pos = 0;
    while (pos < text.length) {
      var best = -1, len = 0;
      for (var t = 0; t < terms.length; t++) {
        var j = low.indexOf(terms[t], pos);
        if (j !== -1 && (best === -1 || j < best || (j === best && terms[t].length > len))) { best = j; len = terms[t].length; }
      }
      if (best === -1) { node.appendChild(document.createTextNode(text.slice(pos))); break; }
      if (best > pos) { node.appendChild(document.createTextNode(text.slice(pos, best))); }
      node.appendChild(el('mark', null, text.slice(best, best + len)));
      pos = best + len;
    }
  }
  function routeOf(e) { return '#/' + e.doc + '/' + e.id; }

  function setUpSearch() {
    var header = document.querySelector('.site-header');
    var tools = document.querySelector('.header-tools');
    if (!header || !tools) { return; }

    var btn = el('button', 'icon-btn search-btn');
    btn.type = 'button';
    btn.id = 'search-btn';
    btn.setAttribute('aria-label', 'Search the documentation (shortcut: /)');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'search-panel');
    btn.appendChild(frag('<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/>' +
                         '<path d="M15.5 15.5 21 21"/></svg>'));
    btn.appendChild(el('span', 'search-label', 'Search'));
    var kbd = el('kbd', 'search-key', '/');
    kbd.setAttribute('aria-hidden', 'true');
    btn.appendChild(kbd);
    tools.insertBefore(btn, tools.firstChild);

    var panel = el('div', 'search-panel');
    panel.id = 'search-panel';
    panel.setAttribute('role', 'search');
    panel.hidden = true;
    var inner = el('div', 'wrap');
    var label = el('label', 'visually-hidden', 'Search every page of the documentation');
    label.setAttribute('for', 'search-input');
    var input = el('input', 'search-input');
    input.type = 'search';
    input.id = 'search-input';
    input.placeholder = 'Search every page…  (a function, an error, a word)';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('aria-controls', 'search-results');
    var status = el('p', 'search-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    var list = el('ul', 'search-results');
    list.id = 'search-results';
    inner.appendChild(label);
    inner.appendChild(input);
    inner.appendChild(status);
    inner.appendChild(list);
    panel.appendChild(inner);
    header.appendChild(panel);

    var timer = null;
    function run() {
      var q = input.value;
      list.textContent = '';
      if (!q.trim()) { status.textContent = ''; return; }
      status.textContent = 'Searching…';
      buildIndex().then(function (ix) {
        if (input.value !== q) { return; }
        var found = search(ix.entries, q, 20);
        list.textContent = '';
        found.forEach(function (e) {
          var li = el('li');
          var a = el('a', 'search-hit');
          a.href = routeOf(e);
          var t = el('span', 'hit-title');
          markInto(t, e.title, q);
          a.appendChild(t);
          a.appendChild(el('span', 'hit-page', e.page));
          if (e.text) { var sn = el('span', 'hit-text'); markInto(sn, snippet(e.text, q), q); a.appendChild(sn); }
          li.appendChild(a);
          list.appendChild(li);
        });
        status.textContent = found.length
          ? found.length + (found.length === 20 ? '+' : '') + ' section' + (found.length === 1 ? '' : 's') + ' found' +
            (ix.missing ? ' (' + ix.missing + ' page(s) could not be loaded)' : '')
          : 'Nothing on any page matches “' + q.trim() + '”.';
      });
    }
    function open() {
      panel.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      input.focus();
      input.select();
      buildIndex();
    }
    function close(refocus) {
      if (panel.hidden) { return; }
      panel.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      if (refocus) { btn.focus(); }
    }
    btn.addEventListener('click', function () { if (panel.hidden) { open(); } else { close(true); } });
    input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(run, 120); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); close(true); }
      else if (e.key === 'ArrowDown') { var f = list.querySelector('a'); if (f) { e.preventDefault(); f.focus(); } }
      else if (e.key === 'Enter') {          // the same as a click on the first result: the same URL either way
        var g = list.querySelector('a');
        if (g) { e.preventDefault(); close(false); g.click(); }
      }
    });
    list.addEventListener('keydown', function (e) {
      var links = list.querySelectorAll('a'), i = Array.prototype.indexOf.call(links, document.activeElement);
      if (e.key === 'ArrowDown' && i < links.length - 1) { e.preventDefault(); links[i + 1].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (i > 0) { links[i - 1].focus(); } else { input.focus(); } }
      else if (e.key === 'Escape') { e.preventDefault(); input.focus(); }
    });
    list.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('a')) { close(false); } });
    document.addEventListener('keydown', function (e) {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) { return; }
      var t = e.target, tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) { return; }
      e.preventDefault();
      open();
    });
    document.addEventListener('click', function (e) {
      if (!panel.hidden && !panel.contains(e.target) && !btn.contains(e.target)) { close(false); }
    });
  }

  /* for scripts/test_site.js (jsdom): the functions it checks, nothing the page needs */
  window.EVNSite = { DOCS: DOCS, ORDER: ORDER, PAGES: PAGES, DOC_GROUPS: DOC_GROUPS, PATHS: PATHS,
                     featureStatus: featureStatus, versionAtLeast: versionAtLeast, slugify: slugify, suggestUrl: suggestUrl, suggestLink: suggestLink, pageUrl: pageUrl,
                     REPORT_URL: REPORT_URL, renderMarkdown: renderMarkdown,
                     assignIds: assignIds, renderCallouts: renderCallouts, prepareTables: prepareTables,
                     addCopyButtons: addCopyButtons, markScrollers: markScrollers, indexDoc: indexDoc,
                     buildIndex: buildIndex, search: search, snippet: snippet, routeOf: routeOf };

  /* ---- go ----------------------------------------------------------------------------------------- */

  /* A nav click replaces the whole of <main> and scrolls to the top. A screen reader is told
     nothing by that - and the focus stays on a link that has just been removed from the page - so
     the new document is announced and the focus is moved onto <main>, which carries tabindex="-1"
     for the purpose (that is also what makes the "Skip to the content" link work in browsers that
     will not focus a non-focusable target). */
  function announce(text) {
    var live = document.getElementById('route-status');
    if (!live) {
      live = el('div', 'visually-hidden');
      live.id = 'route-status';
      live.setAttribute('role', 'status');
      live.setAttribute('aria-live', 'polite');
      document.body.appendChild(live);
    }
    live.textContent = text;
  }

  var firstRoute = true;

  function route() {
    var r = parseRoute();
    if (r.doc === 'home') { renderHome(r.slug); } else if (PAGES[r.doc]) { renderPage(r); } else { renderDoc(r); }
    if (firstRoute) { firstRoute = false; return; }   // a page load announces itself
    if ((r.doc === 'home' || PAGES[r.doc]) && r.slug) {   // a section of the home page or of a page: its heading
      if (focusSection(r.slug)) { return; }
      if (r.doc === 'home') { pendingFocus = r.slug; }
    }
    var info = r.doc === 'home' ? { title: SITE } : (PAGES[r.doc] || DOCS[r.doc] || { title: SITE });
    announce(info.title);
    try { main.focus({ preventScroll: true }); } catch (e) { main.focus(); }
  }

  setUpTheme();
  setUpMenu();
  setUpSearch();
  var reMark = false;
  window.addEventListener('resize', function () {
    if (reMark) { return; }
    reMark = true;
    requestAnimationFrame(function () { reMark = false; markScrollers(main.querySelector('.doc-body')); });
  }, { passive: true });
  window.addEventListener('hashchange', route);
  route();
})();
