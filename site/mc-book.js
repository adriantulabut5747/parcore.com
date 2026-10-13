/* Book editor (Oct 13 2026), /minecraft/tools/book. A written book with pages of
   text components (mc-text.js), drawn on the game's book texture (gui/book.png)
   with the game's font (mc-font.js), as BookViewScreen lays it out: the book 192
   px wide, text at 36,30 wrapped at 114 px, 14 lines a page, black, no shadow,
   "Page 1 of 3" right-aligned to x 148. "Turn to page" links turn the preview.
   Outputs: 1.21.5+ (SNBT pages), 1.20.5-1.21.4 (JSON string pages), 1.13-1.20.4 (NBT),
   and Bedrock text to paste into a Book and Quill.
   Copy: mc-home.js. Styles: BOOK block in mc-home.css (.bk-*). */
(function () {
  var host = document.getElementById('bkEditor');
  if (!host) return;
  var $ = function (id) { return document.getElementById(id); };
  // redraw when the column's width changes (height follows the canvas, so ignore it)
  function watch(el, fn) {
    var w = 0;
    new ResizeObserver(function () { var nw = el.clientWidth; if (nw !== w) { w = nw; requestAnimationFrame(fn); } }).observe(el);
  }
  var F = McFont, T = McText;
  var LINES = 14, WRAP = 114, PAGE_CHARS = 1023;
  function t(text, extra) { var o = T.blank('text'); o.text = text; for (var k in extra) o[k] = extra[k]; return o; }
  var s = {
    ver: 2, at: 0, view: 0, mouse: null, hits: [],
    pages: [
      [t('The Parchrome\nGuide\n\n', { color: 'dark_purple', bold: true }), t('Welcome, traveller. This book holds the rules of the server.\n\n', {}), t('Read the rules', { color: 'blue', underlined: true, click: { action: 'change_page', value: '2' }, hover: 'Turn to page 2' })],
      [t('Rules\n\n', { bold: true }), t('1. Be kind in chat.\n2. No griefing.\n3. Have fun.\n\n', {}), t('Back to the start', { color: 'dark_green', click: { action: 'change_page', value: '1' } })]
    ]
  };
  var ed = T.editor(host, { value: s.pages[0], clicks: ['run_command', 'open_url', 'change_page', 'copy_to_clipboard'], onChange: function (list) { s.pages[s.at] = list; render(); }, base: '000000' });
  var book = new Image(); book.src = '/minecrafticons/gui/book.png'; book.onload = draw;
  var fwd = new Image(); fwd.src = '/minecrafticons/gui/page_forward.png'; fwd.onload = draw;
  var back = new Image(); back.src = '/minecrafticons/gui/page_backward.png'; back.onload = draw;

  function plain(list) { return list.map(function (c) { return c.type === 'text' ? c.text : '?'; }).join(''); }
  // ---- preview ----
  var cv = $('bkCanvas');
  function draw() {
    var W = cv.parentNode.clientWidth, g = W >= 384 ? 2 : 1, bw = 192 * g, bh = 192 * g, dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = bw * dpr; cv.height = bh * dpr; cv.style.width = bw + 'px'; cv.style.height = bh + 'px';
    var x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.imageSmoothingEnabled = false;
    x.clearRect(0, 0, bw, bh);
    if (book.naturalWidth) x.drawImage(book, 0, 0, 192, 192, 0, 0, bw, bh);
    var page = s.pages[s.view] || [];
    var label = [{ text: 'Page ' + (s.view + 1) + ' of ' + s.pages.length, color: '000000' }];
    F.draw(x, label, (148 - F.width(label)) * g, 18 * g, { scale: g, shadow: false });
    var lines = F.wrap(T.runs(page, '000000'), WRAP);
    s.hits = [];
    lines.slice(0, LINES).forEach(function (ln, i) {
      var cx = 36 * g, y = (30 + i * 9) * g;
      ln.forEach(function (r) {
        var w = F.width([r]) * g;
        F.draw(x, [r], cx, y, { scale: g, shadow: false });
        if (r.comp) s.hits.push({ x: cx, y: y - g, w: w, h: 9 * g, c: r.comp });
        cx += w;
      });
    });
    if (s.view < s.pages.length - 1 && fwd.naturalWidth) x.drawImage(fwd, 116 * g, 159 * g, 23 * g, 13 * g);
    if (s.view > 0 && back.naturalWidth) x.drawImage(back, 43 * g, 159 * g, 23 * g, 13 * g);
    if (s.mouse) {
      var hit = hitAt(s.mouse);
      cv.style.cursor = hit && (hit.c.click || hit.c.hover) || overArrow(s.mouse, g) ? 'pointer' : 'default';
      if (hit && hit.c.hover) {
        var tr = F.parse(hit.c.hover), tw = F.width(tr) * g, tx = Math.min(bw - tw - 8 * g, s.mouse[0] + 10), ty = Math.max(4, s.mouse[1] - 14 * g);
        x.fillStyle = 'rgba(16,0,16,0.94)'; x.fillRect(tx - 3 * g, ty - 3 * g, tw + 6 * g, 14 * g);
        x.strokeStyle = '#25015b'; x.lineWidth = g; x.strokeRect(tx - 2.5 * g, ty - 2.5 * g, tw + 5 * g, 13 * g);
        F.draw(x, tr, tx, ty, { scale: g });
      }
    }
    s.g = g;
    var over = lines.length > LINES;
    $('bkPageInfo').innerHTML = 'Page ' + (s.view + 1) + ' of ' + s.pages.length + ' · ' + Math.min(lines.length, 99) + ' / ' + LINES + ' lines' + (over ? ' <em class="is-over">runs past the page</em>' : '');
  }
  function hitAt(m) { return s.hits.filter(function (h) { return m[0] >= h.x && m[0] <= h.x + h.w && m[1] >= h.y && m[1] <= h.y + h.h; })[0]; }
  function overArrow(m, g) {
    if (m[1] < 159 * g || m[1] > 172 * g) return 0;
    if (m[0] >= 116 * g && m[0] <= 139 * g && s.view < s.pages.length - 1) return 1;
    if (m[0] >= 43 * g && m[0] <= 66 * g && s.view > 0) return -1;
    return 0;
  }
  cv.addEventListener('mousemove', function (e) { var r = cv.getBoundingClientRect(); s.mouse = [e.clientX - r.left, e.clientY - r.top]; draw(); });
  cv.addEventListener('mouseleave', function () { s.mouse = null; draw(); });
  cv.addEventListener('click', function (e) {
    var r = cv.getBoundingClientRect(), m = [e.clientX - r.left, e.clientY - r.top], a = overArrow(m, s.g || 1), hit = hitAt(m);
    if (a) { s.view += a; draw(); return; }
    if (hit && hit.c.click && hit.c.click.action === 'change_page') {
      var p = Math.max(1, Math.min(s.pages.length, parseInt(hit.c.click.value, 10) || 1));
      s.view = p - 1; draw(); return;
    }
    if (hit) { goto(s.view); ed.select(hit.c); }
  });

  // ---- commands ----
  function pagesOut() {
    if (s.ver === 2) return '[' + s.pages.map(function (p) { return T.snbt(p); }).join(',') + ']';
    var sq = function (v) { return "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"; };
    return '[' + s.pages.map(function (p) { return sq(T.json(p, false)); }).join(',') + ']';
  }
  function command() {
    var title = $('bkTitle').value || 'Book', author = $('bkAuthor').value || 'Parchrome', gen = +$('bkGen').value, tgt = $('bkTarget').value;
    if (s.ver === 3) return s.pages.map(function (p, i) { return '--- Page ' + (i + 1) + ' ---\n' + T.legacy(p); }).join('\n');
    var parts = ['title:' + T.q(title), 'author:' + T.q(author)];
    if (gen) parts.push('generation:' + gen);
    parts.push('pages:' + pagesOut());
    if (s.ver === 0) return '/give ' + tgt + ' minecraft:written_book{' + parts.join(',') + '}';
    return '/give ' + tgt + ' minecraft:written_book[written_book_content={' + parts.join(',') + '}]';
  }
  function drawTabs() {
    $('bkPages').innerHTML = s.pages.map(function (p, i) {
      return '<button type="button" data-page="' + i + '" aria-pressed="' + (i === s.at) + '">' + (i + 1) + '</button>';
    }).join('') + (s.pages.length < 100 ? '<button type="button" class="fwk-add" data-page="add" aria-label="Add a page"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Page</button>' : '');
    $('bkDel').hidden = s.pages.length < 2;
  }
  function goto(i) {
    s.at = i; s.view = i;
    ed.set(s.pages[i].length ? s.pages[i] : [T.blank('text')]);
    drawTabs();
  }
  function render() {
    var out = command();
    $('bkCmd').textContent = out;
    $('bkCopy').setAttribute('data-copy', out);
    $('bkMeta').innerHTML = s.ver === 3 ? s.pages.length + ' pages of text' : out.length + ' characters' + (out.length > 32500 ? ' <span class="mch-term-flags"><em class="is-block">Too long for one command</em></span>' : out.length > 256 ? ' <span class="mch-term-flags"><em class="is-block">Command block only</em></span>' : '');
    $('bkSend').hidden = s.ver === 3;
    $('bkMetaFields').hidden = s.ver === 3;
    var chars = plain(s.pages[s.at]).length;
    $('bkChars').textContent = chars + ' / ' + PAGE_CHARS + ' characters on this page';
    $('bkChars').classList.toggle('is-over', chars > PAGE_CHARS);
    var notes = [];
    var bad = [];
    s.pages.forEach(function (p) { p.forEach(function (c) { if (c.click && c.click.action === 'change_page' && (+c.click.value > s.pages.length || +c.click.value < 1)) bad.push(c.click.value); }); });
    if (bad.length) notes.push('A link turns to page ' + bad[0] + ', which this book doesn\'t have.');
    if ($('bkTitle').value.length > 15) notes.push('A title over 15 letters only comes from commands. Signing a book by hand allows 15 (32 from 1.20.5 in commands).');
    if (s.ver === 3) notes.push('Bedrock /give can\'t fill a book. Copy each page into a Book and Quill, then sign it.');
    notes.push('Click events in books: run a command, open a link, turn to a page or copy text. Putting a command in chat does not work in books.');
    $('bkNotes').innerHTML = notes.map(function (n) { return '<li>' + n + '</li>'; }).join('');
    drawTabs();
    draw();
  }
  $('bkPages').addEventListener('click', function (e) {
    var b = e.target.closest('[data-page]');
    if (!b) return;
    var v = b.getAttribute('data-page');
    if (v === 'add') { s.pages.splice(s.at + 1, 0, [T.blank('text')]); goto(s.at + 1); }
    else goto(+v);
    render();
  });
  $('bkDel').addEventListener('click', function () { if (s.pages.length < 2) return; s.pages.splice(s.at, 1); goto(Math.max(0, s.at - 1)); render(); });
  $('bkVer').addEventListener('click', function (e) {
    var b = e.target.closest('[data-ver]');
    if (!b) return;
    s.ver = +b.getAttribute('data-ver');
    this.querySelectorAll('[data-ver]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    render();
  });
  ['bkTitle', 'bkAuthor', 'bkGen', 'bkTarget'].forEach(function (id) { $(id).addEventListener('input', render); });
  if ('ResizeObserver' in window) watch(cv.parentNode, draw);
  F.load(render);
})();
