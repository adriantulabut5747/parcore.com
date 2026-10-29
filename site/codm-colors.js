/* COLOR CODES (/call-of-duty-mobile/color-codes, Oct 29 2026). NOTHING HERE IS CONFIRMED FOR CODM YET:
   the three formats are the ones other games use (Adrian tests them in game, then the page drops the
   ones that fail). The format tab lives in the address (?format=hex), so a link opens on it.
   caret = older Call of Duty on PC (MW2): ^ + one digit, ten colours, the digit list below.
   hex   = Free Fire / PUBG Mobile style [RRGGBB] in front of the name.
   tag   = Unity rich-text <color=#RRGGBB>…</color> (CODM runs on Unity). */
(function () {
  const COLORS = [
    { name: 'Red', hex: 'FF0000', caret: 1 }, { name: 'Green', hex: '00FF00', caret: 2 },
    { name: 'Yellow', hex: 'FFFF00', caret: 3 }, { name: 'Dark Blue', hex: '0000FF', caret: 4 },
    { name: 'Light Blue', hex: '00FFFF', caret: 5 }, { name: 'Pink', hex: 'FF00FF', caret: 6 },
    { name: 'White', hex: 'FFFFFF', caret: 7 }, { name: 'Sky Blue', hex: '87CEEB', caret: 8 },
    { name: 'Dark Red', hex: '8B0000', caret: 9 }, { name: 'Black', hex: '000000', caret: 0 },
    { name: 'Orange', hex: 'FF8000' }, { name: 'Gold', hex: 'FFD700' }, { name: 'Lime', hex: '7FFF00' },
    { name: 'Mint', hex: '3EB489' }, { name: 'Teal', hex: '008080' }, { name: 'Purple', hex: '8000FF' },
    { name: 'Violet', hex: 'EE82EE' }, { name: 'Hot Pink', hex: 'FF69B4' }, { name: 'Crimson', hex: 'DC143C' },
    { name: 'Silver', hex: 'C0C0C0' }
  ];
  const FORMATS = {
    caret: {
      code: (c, n) => '^' + c.caret + n,
      only: c => c.caret !== undefined,
      note: 'Older Call of Duty games on PC used ^ plus one digit, ten colours only. In those games the colour showed in menus and friend lists, not in matches.'
    },
    hex: {
      code: (c, n) => '[' + c.hex + ']' + n,
      only: () => true,
      note: 'The bracket style Free Fire and PUBG Mobile use: any colour as six hex digits in front of the name.'
    },
    tag: {
      code: (c, n) => '<color=#' + c.hex + '>' + n + '</color>',
      only: () => true,
      note: 'Unity\'s rich-text tag (CODM runs on Unity). It is long, so it eats into the name\'s length limit.'
    }
  };
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  let format = 'hex', color = COLORS[0];
  const name = () => $('ccName').value.trim() || 'YourName';

  function copy(text, done) {
    const finish = () => done && done();
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(finish, finish);
    else {
      const ta = Object.assign(document.createElement('textarea'), { value: text });
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      ta.remove(); finish();
    }
  }

  function render() {
    const f = FORMATS[format];
    if (!f.only(color)) color = COLORS.find(f.only);
    document.querySelectorAll('#ccFormats [data-format]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.format === format)));
    $('ccSwatches').innerHTML = COLORS.filter(f.only).map(c =>
      `<button type="button" class="cc-sw" style="--c:#${c.hex}" data-hex="${c.hex}" aria-pressed="${c.hex === color.hex}" title="${c.name}" aria-label="${c.name}"></button>`).join('');
    $('ccCustom').hidden = format === 'caret';
    $('ccPick').value = '#' + color.hex.toLowerCase();
    $('ccPlate').style.setProperty('--c', '#' + color.hex);
    $('ccPlate').querySelector('b').textContent = name();
    $('ccCode').textContent = f.code(color, name());
    $('ccNote').textContent = f.note;
    $('ccList').innerHTML = COLORS.filter(f.only).map(c =>
      `<button type="button" class="cc-item" style="--c:#${c.hex}" data-code="${esc(f.code(c, name()))}"><i></i><span><b>${c.name}</b><code>${esc(f.code(c, name()))}</code></span></button>`).join('');
  }

  $('ccFormats').addEventListener('click', e => {
    const b = e.target.closest('[data-format]');
    if (!b) return;
    format = b.dataset.format;
    const u = new URL(location.href);
    if (format === 'hex') u.searchParams.delete('format'); else u.searchParams.set('format', format);
    history.replaceState(null, '', u.pathname + u.search + u.hash);
    render();
  });
  $('ccSwatches').addEventListener('click', e => {
    const b = e.target.closest('[data-hex]');
    if (b) { color = COLORS.find(c => c.hex === b.dataset.hex); render(); }
  });
  $('ccPick').addEventListener('input', e => {
    color = { name: 'Custom', hex: e.target.value.slice(1).toUpperCase() };
    render();
  });
  $('ccName').addEventListener('input', render);
  $('ccCopy').addEventListener('click', () => {
    const b = $('ccCopy');
    copy($('ccCode').textContent, () => { b.lastChild.textContent = 'Copied'; setTimeout(() => (b.lastChild.textContent = 'Copy'), 1400); });
  });
  $('ccList').addEventListener('click', e => {
    const b = e.target.closest('[data-code]');
    if (!b) return;
    copy(b.dataset.code, () => {
      const code = b.querySelector('code'), was = code.textContent;
      b.classList.add('is-copied'); code.textContent = 'Copied';
      setTimeout(() => { b.classList.remove('is-copied'); code.textContent = was; }, 1200);
    });
  });

  const start = new URLSearchParams(location.search).get('format');
  if (FORMATS[start]) format = start;
  render();
})();
