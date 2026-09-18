/* ------------------------------------------------------------------------------------------------
   EVN ALPHA MicroPython - the documentation site's renderer.

   It owns the URL contract documented at the top of index.html:
       #/api/<slug>  #/blocks/<slug>  #/getting-started  #/changelog  #/downloads  and the home page.
   Every path it fetches is relative, so the site works at any root.
   ------------------------------------------------------------------------------------------------ */
(function () {
  'use strict';

  /* The "Use it in the browser" card on the home page. Set to false until /ide/ is published. */
  var SHOW_IDE = false;

  /* The documents, by the route name the extension uses. `order` drives the previous/next links. */
  var DOCS = {
    'getting-started': { file: 'docs/GETTING_STARTED.md', title: 'Getting started', nav: 'Getting started',
                         blurb: 'Install the extension, flash the firmware, run the first program.' },
    'api':             { file: 'docs/API.md',             title: 'API reference',  nav: 'API',
                         blurb: 'Every class and function of the evn module, with units and defaults.' },
    'blocks':          { file: 'docs/BLOCKS.md',          title: 'Blocks reference', nav: 'Blocks',
                         blurb: 'The block editor and the MicroPython each block generates.' },
    'changelog':       { file: 'docs/CHANGELOG.md',       title: 'Changelog',      nav: 'Changelog',
                         blurb: 'What changed in every release of the extension and the firmware.' }
  };
  var ORDER = ['getting-started', 'api', 'blocks', 'changelog'];
  var REPO = 'https://github.com/EVNdevs/evndevs.github.io';
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

  /* "#/api/motor" -> { doc: 'api', slug: 'motor' }; anything unknown is the home page. */
  function parseRoute() {
    var h = location.hash.replace(/^#\/?/, '');
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

  function markCurrentNav(doc) {
    var links = nav.querySelectorAll('a[data-doc]');
    for (var i = 0; i < links.length; i++) {
      var on = links[i].getAttribute('data-doc') === doc;
      links[i].className = on ? 'current' : '';
      if (on) { links[i].setAttribute('aria-current', 'page'); } else { links[i].removeAttribute('aria-current'); }
    }
  }

  /* ---- Markdown plumbing ------------------------------------------------------------------------- */

  /* Links inside the Markdown: another document becomes a route; anything else relative resolves
     against docs/; absolute links open in a new tab. */
  function fixLinks(root) {
    var links = root.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i], href = a.getAttribute('href');
      if (!href) { continue; }
      var m = /^(?:\.\.\/)?(?:docs\/)?(API|BLOCKS|GETTING_STARTED|CHANGELOG)\.md(?:#(.*))?$/.exec(href);
      if (m) {
        var doc = m[1] === 'API' ? 'api' : m[1] === 'BLOCKS' ? 'blocks'
                : m[1] === 'CHANGELOG' ? 'changelog' : 'getting-started';
        a.setAttribute('href', '#/' + doc + '/' + (m[2] ? slugify(decodeURIComponent(m[2])) : ''));
        continue;
      }
      if (/^#/.test(href)) { continue; }                       // same-document anchor, fixed below
      if (/^[a-z]+:/i.test(href)) { a.target = '_blank'; a.rel = 'noopener'; continue; }
      a.setAttribute('href', new URL(href, new URL('docs/', location.href)).href);
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

  function addCopyButtons(root) {
    var pres = root.querySelectorAll('pre');
    for (var i = 0; i < pres.length; i++) {
      (function (pre) {
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
        pre.appendChild(btn);
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
    filter.placeholder = 'Filter the contents…';
    filter.setAttribute('aria-label', 'Filter the table of contents');
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
  function stopSpy() { if (spy) { spy(); spy = null; } }

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

  function scrollToSlug(slug) {
    var target = slug ? document.getElementById(slug) : null;
    if (target) { target.scrollIntoView(); window.scrollBy(0, -8); } else { window.scrollTo(0, 0); }
  }

  /* ---- a document -------------------------------------------------------------------------------- */

  function renderDoc(route) {
    var info = DOCS[route.doc];
    document.title = SITE + ' · ' + info.title;
    markCurrentNav(route.doc);

    var sameDoc = current && current.doc === route.doc;
    current = route;
    if (sameDoc) { scrollToSlug(route.slug); return; }

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
      head.appendChild(el('p', 'crumb', 'Documentation'));
      var edit = el('a', 'edit-link');
      edit.href = REPO + '/blob/main/' + info.file;
      edit.target = '_blank';
      edit.rel = 'noopener';
      edit.appendChild(frag('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/>' +
        '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>'));
      edit.appendChild(document.createTextNode('Edit on GitHub'));
      head.appendChild(edit);
      article.appendChild(head);

      var body = el('div', 'doc-body');
      body.innerHTML = DOMPurify.sanitize(marked.parse(md, { gfm: true, breaks: false }));
      article.appendChild(body);

      var hs = assignIds(body);
      fixLinks(body);
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

      scrollToSlug(route.slug);
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
    a.href = '#/' + doc + (doc === 'api' || doc === 'blocks' ? '/' : '');
    a.appendChild(el('span', 'lbl', label));
    a.appendChild(el('span', 'ttl', DOCS[doc].title));
    return a;
  }

  /* ---- the home page ------------------------------------------------------------------------------ */

  var FEATURES = [
    ['Blocks', 'A block editor that writes MicroPython',
     'Scratch-style blocks for the motors, timing, the board and every standard peripheral, with the ' +
     'generated code beside them. Export a blocks program as a .py file and carry on in text.',
     '#/blocks/'],
    ['Python', 'Python with real autocomplete',
     'Type stubs for the whole evn module go into your projects folder, so Pylance completes Motor, ' +
     'run_angle, the sensors and their units, with the documentation in the tooltip.',
     '#/api/'],
    ['Live', 'A board panel and a live console',
     'Motor angles and speeds four times a second, the pack and cell voltages, the peripherals found ' +
     'on the I2C ports, and a prompt that runs a line of Python on the board - over USB or Bluetooth.',
     '#/getting-started']
  ];

  var GALLERY = [
    ['p-colour.jpg',   'Colour',   'TCS34725 · hsv, rgb, lux',
     'Three EVN colour-sensor modules in black printed housings, one showing its TCS34725 board with two white LEDs.'],
    ['p-distance.jpg', 'Distance', 'VL53L0X · mm, profiles',
     'EVN distance-sensor modules in black printed housings, the time-of-flight sensor facing the camera.'],
    ['p-imu.jpg',      'IMU',      'MPU-9250 · accel, gyro, mag',
     'An EVN IMU module standing upright, its blue MPU-9250 breakout labelled VCC, GND, SCL, SDA visible through the housing.'],
    ['p-compass.jpg',  'Compass',  'heading, calibration',
     'EVN compass modules in printed housings, the magnetometer board facing the camera.'],
    ['p-oled.jpg',     'OLED',     '128x64 · text and pixels',
     'An EVN OLED module in a white printed housing, its 128 by 64 display facing the camera between two other modules.'],
    ['p-matrix.jpg',   'Matrix',   '8x8 · pixels and scrolling text',
     'An EVN 8 by 8 LED matrix module in a printed housing, the matrix facing the camera.']
  ];

  function renderHome(slug) {
    document.title = SITE;
    markCurrentNav('home');
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
    left.appendChild(el('p', 'eyebrow', 'Early access · user testing'));
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

    left.appendChild(el('p', 'pitch',
      'MicroPython for the EVN ALPHA robotics controller, and the VS Code extension that runs your ' +
      'programs on it: four EV3/NXT motor ports with a tuned controller, servos, fifteen standard ' +
      'peripherals, Bluetooth, blocks or Python, and the board live in the editor.'));

    var actions = el('div', 'actions');
    var b1 = el('a', 'btn btn-primary', 'Get started');
    b1.href = '#/getting-started';
    var b2 = el('a', 'btn btn-ghost', 'Download the extension');
    b2.href = '#/downloads';
    actions.appendChild(b1);
    actions.appendChild(b2);
    left.appendChild(actions);
    left.appendChild(el('p', 'meta',
      'Free and MIT licensed. Works with VS Code 1.106 or newer on Windows, macOS and Linux.'));
    grid.appendChild(left);

    var fig = el('figure', 'hero-photo');
    var img = el('img');
    img.src = 'assets/images/evn-alpha-board.jpg';
    img.width = 1600;
    img.height = 800;
    img.alt = 'Two EVN ALPHA controllers on a white desk: the front one shows its four RJ12 motor ports ' +
              'in a LEGO-compatible white housing, the one behind it shows the green circuit board through ' +
              'its clear cover.';
    fig.appendChild(img);
    fig.appendChild(el('figcaption',
      null, 'EVN ALPHA: an RP2040 controller with four EV3/NXT motor ports, four servo ports, ' +
            'sixteen I2C and two UART ports, and 18650 cells charged over USB-C.'));
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
        'Only needed without the extension: hold BOOTSEL while you plug the board in and copy the UF2 ' +
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

      if (ext.vsix) {
        b2.href = ext.vsix;
        b2.textContent = 'Download the extension' + (ext.version ? ' ' + ext.version : '');
      }
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
      card.appendChild(txt);
      card.appendChild(go);
      i.body.appendChild(card);
      main.appendChild(i.node);
    }

    /* --- the peripherals --- */
    var p = section('Fifteen standard peripherals, bench-validated');
    p.body.appendChild(el('p', 'gallery-intro',
      'Every EVN module is recognised by its ID register rather than its address, appears by name in ' +
      'the Board panel, has blocks of its own and is covered by the API reference. Six of the fifteen:'));
    var gal = el('div', 'gallery');
    GALLERY.forEach(function (g) {
      var figure = el('figure', 'shot');
      var im = el('img');
      im.src = 'assets/images/' + g[0];
      im.width = 480;
      im.height = 360;
      im.loading = 'lazy';
      im.alt = g[3];
      figure.appendChild(im);
      var cap = el('figcaption');
      cap.appendChild(el('strong', null, g[1]));
      cap.appendChild(document.createTextNode(g[2]));
      figure.appendChild(cap);
      gal.appendChild(figure);
    });
    p.body.appendChild(gal);
    main.appendChild(p.node);

    /* --- documentation --- */
    var docs = section('Documentation');
    var list = el('div', 'doc-list');
    ORDER.forEach(function (name, n) {
      var a = el('a', 'doc-row');
      a.href = '#/' + name + (name === 'api' || name === 'blocks' ? '/' : '');
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

  /* ---- go ----------------------------------------------------------------------------------------- */

  function route() {
    var r = parseRoute();
    if (r.doc === 'home') { renderHome(r.slug); } else { renderDoc(r); }
  }

  setUpTheme();
  setUpMenu();
  window.addEventListener('hashchange', route);
  route();
})();
