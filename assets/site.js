/* ------------------------------------------------------------------------------------------------
   EVN ALPHA MicroPython - the documentation site's renderer.

   It owns the URL contract documented at the top of index.html:
       #/api/<slug>  #/api-<part>/<slug>  #/blocks/<slug>  #/calibration/<slug>  #/getting-started
       #/<guide>/<slug> (the guides split from Getting started: programs, board-view, data-logger, main-py,
       bluetooth, commands, board, troubleshooting; #/getting-started/<slug> of the one-page era is forwarded
       by assets/getting-started-moved.json)
       #/changelog  #/downloads  and the home page.
   The API reference is an index (docs/API.md, route `api`) and five parts (docs/API_<PART>.md, route
   `api-<part>`). A link of the one-page era, #/api/<slug> for a heading that now lives in a part, is
   forwarded to its part by assets/api-moved.json (old slug -> "<route>/<new slug>", written when the
   page was split; tools/check.py checks that every target still exists).
   Every path it fetches is relative, so the site works at any root.
   ------------------------------------------------------------------------------------------------ */
(function () {
  'use strict';

  /* The "Use it in the browser" card on the home page. Set to false until /ide/ is published. */
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
    'main-py':         { file: 'docs/MAIN_PY.md',         title: 'A program that starts from the user button', part: 'getting-started' },
    'bluetooth':       { file: 'docs/BLUETOOTH.md',       title: 'Working without the USB cable', part: 'getting-started' },
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
  var ORDER = ['getting-started', 'programs', 'board-view', 'data-logger', 'main-py', 'bluetooth', 'commands', 'board',
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

  /* "#/api/motor" -> { doc: 'api', slug: 'motor' }; anything unknown is the home page. */
  function parseRoute() {
    var h = location.hash.replace(/^#\/?/, '');
    if (PAGE && location.hash.charAt(1) !== '/') { h = PAGE + '/' + location.hash.slice(1); }
    if (!h) { return { doc: 'home', slug: '' }; }
    var m = /^([a-z\-]+)\/?(.*)$/.exec(h);
    if (!m) { return { doc: 'home', slug: '' }; }
    var doc = m[1], slug = slugify(decodeURIComponent(m[2] || ''));
    if (doc === 'downloads') { return { doc: 'home', slug: 'downloads' }; }
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

  /* doc: a route of DOCS, 'downloads' (the home page's Downloads section) or 'home'. No nav entry is the home
     page, so on it nothing is lit. */
  function markCurrentNav(doc) {
    if (DOCS[doc] && DOCS[doc].part) { doc = DOCS[doc].part; }      // a part of the API reference lights "API"
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
  function stopSpy() { reading = null; if (spy) { spy(); spy = null; } }

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
      var crumb = el('p', 'crumb', 'Documentation');
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

  /* ---- the home page ------------------------------------------------------------------------------ */

  /* The cards under the hero: kicker, title, text, the section it opens, and a screenshot (path relative
     to the site root, its size and alt text) or null. "Read more" opens the section the card is about. */
  var FEATURES = [
    ['Blocks', 'Blocks that write Python',
     'Snap blocks together for the motors, the robot, the sensors and the displays, and see the MicroPython ' +
     'they make beside them. When you are ready, export the program and carry on in Python.',
     '#/blocks/', null],
    ['Python', 'Python that knows the robot',
     'The editor completes every motor, sensor and drive-base command as you type, with its units and its ' +
     'help text, so you rarely need to look anything up.',
     '#/api/', null],
    ['Live', 'Your robot, live in the editor',
     'Motor angles and speeds, the battery, every sensor plugged in, a chart of any numeric reading, and a prompt ' +
     'that runs a line of Python on the board, over USB or Bluetooth.',
     '#/getting-started/3b-the-live-console-the-command-line-and-the-console-view',
     ['assets/images/home-board-console.jpg', 292, 833,
      'The EVN ALPHA Board panel: the board live, its firmware and battery, the sensors on its I2C ports, and below ' +
      'it the console with a chart of the distance sensor and a prompt for Python.']],
    ['Data', 'Record and chart what the robot did',
     'Log motor angles, sensor readings and the battery while a program runs, then zoom through the ' +
     'charts and the statistics, or open the file in a spreadsheet.',
     '#/getting-started/3c-recording-data-the-data-logger',
     ['assets/images/home-data-viewer.jpg', 1400, 900,
      'The data logger in VS Code: charts of a motor’s angle and speed, an IMU heading and the battery ' +
      'voltage over seven seconds, with a table of statistics under them.']]
  ];

  /* The peripherals on the home page, in plain words, each linked to its section of the API reference:
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

  function renderHome(slug) {
    document.title = slug === 'downloads' ? SITE + ' · Downloads' : SITE;
    markCurrentNav(slug === 'downloads' ? 'downloads' : 'home');
    var built = current && current.doc === 'home' && document.getElementById('downloads');
    current = { doc: 'home', slug: slug || '' };
    if (built) {                                     /* already on the home page: only move */
      if (slug === 'downloads') { built.scrollIntoView(); window.scrollBy(0, -8); }
      else { window.scrollTo(0, 0); }
      return;
    }
    stopSpy();
    main.textContent = '';

    /* --- hero --- */
    var hero = el('section', 'hero');
    var hw = el('div', 'wrap');
    var grid = el('div', 'hero-grid');

    var left = el('div');
    var eyebrow = el('p', 'eyebrow', 'Early access · user testing · ');   // the space before the link (site review N1)
    eyebrow.appendChild(reportLink('report-link'));        // where a tester reports (SITE-09)
    left.appendChild(eyebrow);
    var markRow = el('div', 'hero-mark');
    var glyph = el('span', 'glyph');
    glyph.setAttribute('aria-hidden', 'true');
    glyph.appendChild(frag(document.querySelector('.brand .mark svg').outerHTML));
    markRow.appendChild(glyph);
    var titleBox = el('div');
    var h1 = el('h1', null, 'EVN ALPHA');
    h1.appendChild(el('span', 'sub', 'MicroPython'));
    titleBox.appendChild(h1);
    markRow.appendChild(titleBox);
    left.appendChild(markRow);

    /* One sentence of value, three proof points, the software itself beside them, and two ways to
       start. "Download the extension" stays on #/downloads, where the install steps are: it is never rewritten
       to the bare .vsix. */
    left.appendChild(el('p', 'pitch',
      'Program your EVN ALPHA robot in blocks or Python, from VS Code or your browser.'));
    var proof = el('ul', 'proof');
    ['Blocks that write real MicroPython, side by side with the code.',
     'Your robot live in the editor: motors, battery, sensors and a Python prompt.',
     'Plug in a sensor or a display and the board finds it by name.'].forEach(function (t) {
      proof.appendChild(el('li', null, t));
    });
    left.appendChild(proof);

    var actions = el('div', 'actions');
    var b1 = el('a', 'btn btn-primary', 'Get started');
    b1.href = '#/getting-started';
    actions.appendChild(b1);
    if (SHOW_IDE) {
      var bIde = el('a', 'btn btn-ghost', 'Try it in your browser');
      bIde.href = 'ide/';
      bIde.target = '_blank';
      bIde.rel = 'noopener';
      actions.appendChild(bIde);
    }
    var b2 = el('a', 'btn btn-ghost', 'Download the extension');
    b2.href = '#/downloads';
    actions.appendChild(b2);
    left.appendChild(actions);
    left.appendChild(el('p', 'meta',
      'Free and MIT licensed. Works with VS Code 1.106 or newer on Windows, macOS and Linux.'));
    grid.appendChild(left);

    var fig = el('figure', 'hero-photo hero-shot');
    var img = el('img');
    img.src = 'docs/images/blocks-editor.png';           // published with the documents (npm run docs:shots)
    img.width = 1044;
    img.height = 833;
    img.alt = 'The EVN ALPHA block editor in VS Code: a program of motor blocks on the left, the categories ' +
              '(Motors, Robot, Sensing, Timing, Board) beside it, and the MicroPython the blocks make on the right.';
    fig.appendChild(img);
    fig.appendChild(el('figcaption', null,
      'The block editor: your blocks on the left, the Python they make on the right. Run on board sends it to the robot.'));
    grid.appendChild(fig);

    hw.appendChild(grid);
    hero.appendChild(hw);
    main.appendChild(hero);

    /* --- what it gives you --- */
    var f = section('What the extension gives you');
    var cards = el('div', 'cards');
    FEATURES.forEach(function (c) {
      var a = el('a', 'card');
      a.href = c[3];
      if (c[4]) {
        var shot = el('img', 'card-shot');
        shot.src = c[4][0];
        shot.width = c[4][1];
        shot.height = c[4][2];
        shot.loading = 'lazy';
        shot.alt = c[4][3];
        a.appendChild(shot);
      }
      a.appendChild(el('span', 'kicker', c[0]));
      a.appendChild(el('h3', null, c[1]));
      a.appendChild(el('p', null, c[2]));
      a.appendChild(el('span', 'more', 'Read more →'));
      cards.appendChild(a);
    });
    f.body.appendChild(cards);
    main.appendChild(f.node);

    /* --- downloads --- */
    var d = section('Downloads');
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
      note.appendChild(document.createTextNode(' once.'));
      dlBox.appendChild(note);

      if (ext.version) { b2.textContent = 'Download the extension ' + ext.version; }   // the link stays on the install steps
    }).catch(function (e) {
      dlBox.textContent = '';
      var p = el('p', 'notice', 'The download list (latest.json) could not be read (' + e.message +
        '). The files are in the public repository: ');
      var a1 = el('a', null, 'the VSIX');
      a1.href = REPO + '/tree/main/vsix';
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
      go.href = 'ide/';
      go.target = '_blank';
      go.rel = 'noopener';
      card.appendChild(txt);
      card.appendChild(go);
      i.body.appendChild(card);
      main.appendChild(i.node);
    }

    /* --- the board --- */
    var hb = section('The EVN ALPHA controller');
    var bfig = el('figure', 'hero-photo board-photo');
    var bimg = el('img');
    bimg.src = 'assets/images/evn-alpha-board.jpg';
    bimg.width = 1600;
    bimg.height = 800;
    bimg.loading = 'lazy';
    bimg.alt = 'Two EVN ALPHA controllers on a white desk: the front one shows its four RJ12 motor ports ' +
               'in a LEGO-compatible white housing, the one behind it shows the green circuit board through ' +
               'its clear cover.';
    bfig.appendChild(bimg);
    bfig.appendChild(el('figcaption', null,
      'Four ports for LEGO MINDSTORMS EV3 and NXT motors, four servo ports, sixteen sensor ports, two serial ' +
      'ports, and rechargeable 18650 cells charged over USB-C.'));
    hb.body.appendChild(bfig);
    main.appendChild(hb.node);

    /* --- the peripherals: plain names, what each is for, every one linked to its section --- */
    var p = section('Plug-and-play sensors and displays');
    p.body.appendChild(el('p', 'gallery-intro',
      'Plug a sensor or a display into any of the sixteen sensor ports and the board finds it by itself: it shows up by name in the Board ' +
      'panel, has blocks of its own and a section in the API reference. Servos and LED strips plug into the four ' +
      'servo ports and the Bluetooth module into a serial port; you name their port in the program, as nothing is ' +
      'read back from them. Each one below opens its section.'));
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
    p.body.appendChild(gal);
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
    p.body.appendChild(el('h3', 'periph-h', 'Every EVN module'));
    p.body.appendChild(periphList(PERIPHERALS, 'Every EVN module'));
    p.body.appendChild(el('h3', 'periph-h', 'Kit you may already own'));
    p.body.appendChild(el('p', 'gallery-intro',
      'These work the same way, though EVN does not sell them (the extended peripherals).'));
    p.body.appendChild(periphList(EXTENDED, 'Kit you may already own'));
    main.appendChild(p.node);

    /* --- the story --- */
    var st = section('The story');
    var sg = el('div', 'story-grid');

    var prose = el('div', 'story-prose');
    prose.appendChild(el('p', null,
      'LEGO® MINDSTORMS® was discontinued in 2022. The material for learning with it thinned ' +
      'out, and serious robotics hardware stayed expensive. EVN is the answer to that: an affordable, ' +
      'open platform — the natural evolution of LEGO MINDSTORMS, and a basecamp for students who ' +
      'want to get serious about robotics.'));
    prose.appendChild(el('p', null,
      'EVN is a joint project of Kenneth Chow and Heng Teng Yi, mentor and mentee, in Singapore: ' +
      'Kenneth as the Strategic Lead, Teng Yi as the Technical Lead. Kenneth founded the Centre of ' +
      'Robotics Excellence in 2014; the EVN ALPHA was first developed there at the end of 2018. Teng Yi ' +
      'came to it with four years of international competitive robotics behind him, including wins in ' +
      'five RoboCup sub-leagues, and wrote and maintains the EVN Arduino library.'));
    prose.appendChild(el('p', null,
      'The board exists because of its backers. The Kickstarter campaign “EVN: The Natural Evolution ' +
      'of the LEGO® MINDSTORMS® System” ran from 22 December 2023 to 20 February 2024 and ' +
      'was funded by 71 backers pledging S$13,053 against a S$8,888 goal. Without them EVN would not exist.'));
    var ks = el('a', 'btn btn-primary', 'The story on Kickstarter');
    ks.href = 'https://www.kickstarter.com/projects/thenaturalevolution/evn-the-natural-evolution-of-the-lego-mindstorms-system';
    ks.target = '_blank';
    ks.rel = 'noopener';
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
        var box = el('div', 'person');
        box.appendChild(el('p', 'who', person[0]));
        box.appendChild(el('p', 'what', person[1]));
        person[2].forEach(function (l) {
          var a = el('a', 'credit-link', l[0]);
          a.href = l[1];
          a.target = '_blank';
          a.rel = 'noopener';
          box.appendChild(a);
        });
        credit.appendChild(box);
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

    /* --- documentation --- */
    var docs = section('Documentation');
    var list = el('div', 'doc-list');
    ORDER.filter(function (name) { return !DOCS[name].part; }).forEach(function (name, n) {
      var a = el('a', 'doc-row');
      a.href = '#/' + name + (SECTIONED[name] ? '/' : '');
      a.appendChild(el('span', 'n', '0' + (n + 1)));
      var t = el('span', 't');
      t.appendChild(el('strong', null, DOCS[name].title));
      t.appendChild(el('span', null, DOCS[name].blurb));
      a.appendChild(t);
      var go2 = el('span', 'go', '→');
      go2.setAttribute('aria-hidden', 'true');
      a.appendChild(go2);
      list.appendChild(a);
    });
    docs.body.appendChild(list);
    main.appendChild(docs.node);

    if (slug === 'downloads') {
      var anchor = document.getElementById('downloads');
      if (anchor) { anchor.scrollIntoView(); window.scrollBy(0, -8); return; }
    }
    window.scrollTo(0, 0);
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
  window.EVNSite = { DOCS: DOCS, ORDER: ORDER, slugify: slugify, suggestUrl: suggestUrl, suggestLink: suggestLink, pageUrl: pageUrl,
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
    if (r.doc === 'home') { renderHome(r.slug); } else { renderDoc(r); }
    if (firstRoute) { firstRoute = false; return; }   // a page load announces itself
    var info = r.doc === 'home' ? { title: SITE } : (DOCS[r.doc] || { title: SITE });
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
