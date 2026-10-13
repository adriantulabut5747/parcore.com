/* Minecraft text components (Oct 13 2026): the editor, the preview runs and every
   output syntax, shared by the Tellraw, Book and Sign tools on /minecraft/tools/.
   A component: { type: text|selector|score|keybind, text, selector, name, objective,
   key, color: 'red' | '#rrggbb' | '', bold, italic, underlined, strikethrough,
   obfuscated, click: { action, value }, hover }
   Syntax by version (field names checked against the 26.3 game files):
     snbt   1.21.5+     {text:"Hi",color:"red",click_event:{action:"run_command",command:"/say"},
                        hover_event:{action:"show_text",value:"Tip"}}
     json   1.16-1.21.4 {"text":"Hi","clickEvent":{"action":"run_command","value":"/say"},
                        "hoverEvent":{"action":"show_text","contents":"Tip"}}
     json13 1.13-1.15   hoverEvent "value" instead of "contents", no hex colours
   Needs mc-font.js. Styles: TEXT EDITOR block in mc-home.css (.txe-*). */
var McText = (function () {
  var F = McFont;
  var NAMES = ['black', 'dark_blue', 'dark_green', 'dark_aqua', 'dark_red', 'dark_purple', 'gold', 'gray', 'dark_gray', 'blue', 'green', 'aqua', 'red', 'light_purple', 'yellow', 'white'];
  var STY = [['bold', 'B'], ['italic', 'I'], ['underlined', 'U'], ['strikethrough', 'S'], ['obfuscated', '?']];
  var CLICKS = { run_command: 'Run a command', suggest_command: 'Put a command in chat', open_url: 'Open a link', copy_to_clipboard: 'Copy text', change_page: 'Turn to page' };
  var KEYS = { 'key.jump': 'Space', 'key.sneak': 'Shift', 'key.sprint': 'Ctrl', 'key.inventory': 'E', 'key.attack': 'Left click', 'key.use': 'Right click', 'key.drop': 'Q', 'key.chat': 'T', 'key.forward': 'W', 'key.back': 'S', 'key.left': 'A', 'key.right': 'D', 'key.swapOffhand': 'F', 'key.playerlist': 'Tab' };

  function blank(type) { return { type: type || 'text', text: '', selector: '@p', name: '@s', objective: '', key: 'key.jump', color: '', bold: false, italic: false, underlined: false, strikethrough: false, obfuscated: false, click: null, hover: '' }; }
  function hexOf(c, fallback) {
    if (!c) return fallback || 'ffffff';
    if (c[0] === '#') return c.slice(1).toLowerCase();
    return F.NAMED[c] || fallback || 'ffffff';
  }
  // what the component shows in game (selectors and scores get a stand-in)
  function shown(c) {
    if (c.type === 'selector') return c.selector === '@a' ? 'Steve, Alex' : 'Steve';
    if (c.type === 'score') return '42';
    if (c.type === 'keybind') return KEYS[c.key] || c.key;
    return c.text;
  }
  function runs(list, base) {
    return list.map(function (c) {
      return { text: shown(c), color: hexOf(c.color, base), bold: c.bold, italic: c.italic, underlined: c.underlined || (c.click && c.click.action === 'open_url' && false), strikethrough: c.strikethrough, obfuscated: c.obfuscated, comp: c };
    });
  }
  function nearestName(hex) {
    var n = parseInt(hex, 16), best = 'white', bd = Infinity;
    NAMES.forEach(function (k) {
      var m = parseInt(F.NAMED[k], 16), d = Math.pow((n >> 16 & 255) - (m >> 16 & 255), 2) + Math.pow((n >> 8 & 255) - (m >> 8 & 255), 2) + Math.pow((n & 255) - (m & 255), 2);
      if (d < bd) { bd = d; best = k; }
    });
    return best;
  }
  function q(s) { return JSON.stringify(String(s)); }
  function slash(cmd) { cmd = String(cmd || '').trim(); return cmd && cmd[0] !== '/' ? '/' + cmd : cmd; }

  // ---- 1.21.5+ SNBT ----
  function snbtOne(c) {
    var o = [];
    if (c.type === 'selector') o.push('selector:' + q(c.selector || '@p'));
    else if (c.type === 'score') o.push('score:{name:' + q(c.name || '@s') + ',objective:' + q(c.objective || 'x') + '}');
    else if (c.type === 'keybind') o.push('keybind:' + q(c.key));
    else o.push('text:' + q(c.text));
    if (c.color) o.push('color:' + q(c.color));
    STY.forEach(function (s) { if (c[s[0]]) o.push(s[0] + ':true'); });
    if (c.click && c.click.value !== '') {
      var a = c.click.action, v = c.click.value;
      if (a === 'open_url') o.push('click_event:{action:"open_url",url:' + q(v) + '}');
      else if (a === 'change_page') o.push('click_event:{action:"change_page",page:' + (parseInt(v, 10) || 1) + '}');
      else if (a === 'copy_to_clipboard') o.push('click_event:{action:"copy_to_clipboard",value:' + q(v) + '}');
      else o.push('click_event:{action:"' + a + '",command:' + q(v) + '}');
    }
    if (c.hover) o.push('hover_event:{action:"show_text",value:' + q(c.hover) + '}');
    // a plain unstyled text component can be just the string
    if (o.length === 1 && c.type === 'text') return q(c.text);
    return '{' + o.join(',') + '}';
  }
  function snbt(list) {
    if (!list.length) return '""';
    if (list.length === 1) return snbtOne(list[0]);
    return '[""' + list.map(function (c) { return ',' + snbtOne(c); }).join('') + ']';
  }
  // ---- JSON (1.13-1.21.4) ----
  function jsonOne(c, old) {
    var o = {};
    if (c.type === 'selector') o.selector = c.selector || '@p';
    else if (c.type === 'score') o.score = { name: c.name || '@s', objective: c.objective || 'x' };
    else if (c.type === 'keybind') o.keybind = c.key;
    else o.text = c.text;
    if (c.color) o.color = old && c.color[0] === '#' ? nearestName(c.color.slice(1)) : c.color;
    STY.forEach(function (s) { if (c[s[0]]) o[s[0]] = true; });
    if (c.click && c.click.value !== '') {
      var v = c.click.value;
      if (c.click.action === 'run_command' || c.click.action === 'suggest_command') v = slash(v);
      o.clickEvent = { action: c.click.action, value: String(v) };
    }
    if (c.hover) o.hoverEvent = old ? { action: 'show_text', value: c.hover } : { action: 'show_text', contents: c.hover };
    return o;
  }
  function json(list, old) {
    if (!list.length) return '""';
    if (list.length === 1) return JSON.stringify(jsonOne(list[0], old));
    return JSON.stringify([''].concat(list.map(function (c) { return jsonOne(c, old); })));
  }
  // ---- Bedrock rawtext: colours as § codes, no clicks or hovers ----
  function codeOf(c) {
    if (!c.color) return '';
    var name = c.color[0] === '#' ? nearestName(c.color.slice(1)) : c.color;
    var k = Object.keys(F.CODES).filter(function (x) { return F.CODES[x][0] === name; })[0];
    return k ? '§' + k : '';
  }
  function legacy(list, mark) {
    mark = mark || '§';
    return list.map(function (c) {
      var s = codeOf(c).replace('§', mark);
      if (c.bold) s += mark + 'l';
      if (c.italic) s += mark + 'o';
      if (c.underlined) s += mark + 'n';
      if (c.strikethrough) s += mark + 'm';
      if (c.obfuscated) s += mark + 'k';
      return (s || (c.color ? '' : '')) + (c.type === 'text' ? c.text : shown(c)) + (s ? mark + 'r' : '');
    }).join('');
  }
  function rawtext(list) {
    var out = [];
    list.forEach(function (c) {
      var pre = codeOf(c) + (c.bold ? '§l' : '') + (c.italic ? '§o' : '') + (c.obfuscated ? '§k' : '');
      if (pre) out.push({ text: pre });
      if (c.type === 'selector') out.push({ selector: c.selector || '@p' });
      else if (c.type === 'score') out.push({ score: { name: c.name || '@s', objective: c.objective || 'x' } });
      else out.push({ text: c.type === 'keybind' ? shown(c) : c.text });
      if (pre) out.push({ text: '§r' });
    });
    return JSON.stringify({ rawtext: out });
  }

  // ---- the editor ----
  // McText.editor(el, { types, clicks: [actions] | false, hover: bool, onChange, maxLen })
  function editor(el, opts) {
    opts = opts || {};
    var types = opts.types || ['text', 'selector', 'score', 'keybind'];
    var list = opts.value || [blank('text')], at = 0;
    var api = {};
    function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    var TYPE_N = { text: 'Text', selector: 'Player name', score: 'Score', keybind: 'Key name' };
    el.classList.add('txe');
    el.innerHTML =
      '<div class="txe-list" role="listbox" aria-label="Text parts"></div>' +
      '<div class="txe-add">' + types.map(function (t) { return '<button type="button" class="pt-link" data-add="' + t + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>' + TYPE_N[t] + '</button>'; }).join('') + '</div>' +
      '<div class="txe-edit"></div>';
    var listEl = el.querySelector('.txe-list'), editEl = el.querySelector('.txe-edit');
    function changed(redrawEdit) { drawList(); if (redrawEdit) drawEdit(); if (opts.onChange) opts.onChange(list); }
    function drawList() {
      listEl.innerHTML = list.map(function (c, i) {
        var label = c.type === 'text' ? (c.text ? c.text.replace(/\n/g, '↵ ') : 'Empty text') : TYPE_N[c.type] + ': ' + (c.type === 'selector' ? c.selector : c.type === 'score' ? c.objective || '?' : c.key);
        return '<div class="txe-item' + (i === at ? ' is-on' : '') + '" role="option" aria-selected="' + (i === at) + '">' +
          '<button type="button" class="txe-pick" data-at="' + i + '"><i style="background:#' + hexOf(c.color, opts.base || 'ffffff') + '"></i><span' + (c.bold ? ' class="b"' : '') + '>' + esc(label.slice(0, 40)) + '</span>' +
          (c.click ? '<em>click</em>' : '') + (c.hover ? '<em>hover</em>' : '') + '</button>' +
          '<button type="button" class="txe-x" data-del="' + i + '" aria-label="Remove this part"' + (list.length < 2 ? ' disabled' : '') + '><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>';
      }).join('');
    }
    function drawEdit() {
      var c = list[at];
      if (!c) { editEl.innerHTML = ''; return; }
      var body = '';
      if (c.type === 'text') body += '<label class="pt-lbl">Text</label><textarea class="pt-input txe-text" rows="2" data-f="text" spellcheck="false"' + (opts.maxLen ? ' maxlength="' + opts.maxLen + '"' : '') + '>' + esc(c.text) + '</textarea>';
      if (c.type === 'selector') body += '<label class="pt-lbl">Who</label><select class="pt-input" data-f="selector">' + ['@p', '@a', '@s', '@r', '@e[type=minecraft:zombie,limit=1,sort=nearest]'].map(function (v) { return '<option' + (v === c.selector ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select>';
      if (c.type === 'score') body += '<div class="txe-two"><div><label class="pt-lbl">Whose score</label><input class="pt-input" data-f="name" value="' + esc(c.name) + '" spellcheck="false"></div><div><label class="pt-lbl">Objective</label><input class="pt-input" data-f="objective" value="' + esc(c.objective) + '" placeholder="kills" spellcheck="false"></div></div>';
      if (c.type === 'keybind') body += '<label class="pt-lbl">Key</label><select class="pt-input" data-f="key">' + Object.keys(KEYS).map(function (k) { return '<option value="' + k + '"' + (k === c.key ? ' selected' : '') + '>' + KEYS[k] + ' (' + k + ')</option>'; }).join('') + '</select><p class="crd-hint">Each player sees their own key.</p>';
      body += '<label class="pt-lbl">Colour</label><div class="txe-colors"><button type="button" class="pt-sw pt-sw--none" data-color="" aria-pressed="' + !c.color + '" aria-label="Default colour">Aa</button>' +
        NAMES.map(function (n) { return '<button type="button" class="pt-sw" data-color="' + n + '" aria-pressed="' + (c.color === n) + '" title="' + n.replace('_', ' ') + '" aria-label="' + n.replace('_', ' ') + '" style="background:#' + F.NAMED[n] + '"></button>'; }).join('') +
        '<label class="txe-hex' + (c.color && c.color[0] === '#' ? ' is-on' : '') + '" title="Any colour (1.16+)"><input type="color" data-f="hex" value="' + (c.color && c.color[0] === '#' ? c.color : '#ff8800') + '" aria-label="Any colour"><span>Hex</span></label></div>';
      body += '<div class="txe-styles" role="group" aria-label="Style">' + STY.map(function (s) {
        return '<button type="button" data-style="' + s[0] + '" aria-pressed="' + !!c[s[0]] + '" title="' + s[0] + '" class="txe-st txe-st--' + s[0] + '">' + (s[0] === 'obfuscated' ? 'Magic' : s[1]) + '</button>';
      }).join('') + '</div>';
      if (opts.clicks !== false) {
        var acts = opts.clicks || Object.keys(CLICKS);
        body += '<div class="txe-two"><div><label class="pt-lbl">When clicked</label><select class="pt-input" data-f="clickAction"><option value="">Nothing</option>' +
          acts.map(function (a) { return '<option value="' + a + '"' + (c.click && c.click.action === a ? ' selected' : '') + '>' + CLICKS[a] + '</option>'; }).join('') + '</select></div>' +
          '<div' + (c.click ? '' : ' hidden') + '><label class="pt-lbl">' + (c.click && c.click.action === 'open_url' ? 'Link' : c.click && c.click.action === 'change_page' ? 'Page' : c.click && c.click.action === 'copy_to_clipboard' ? 'Text to copy' : 'Command') + '</label><input class="pt-input" data-f="clickValue" value="' + esc(c.click ? c.click.value : '') + '" placeholder="' + (c.click && c.click.action === 'open_url' ? 'https://' : c.click && c.click.action === 'change_page' ? '2' : '/say hi') + '" spellcheck="false"></div></div>';
      }
      if (opts.hover !== false) body += '<label class="pt-lbl">Text on hover <span class="pt-opt">optional</span></label><input class="pt-input" data-f="hover" value="' + esc(c.hover) + '" placeholder="Shown when the mouse is over it" spellcheck="false">';
      editEl.innerHTML = body;
    }
    listEl.addEventListener('click', function (e) {
      var d = e.target.closest('[data-del]'), p = e.target.closest('[data-at]');
      if (d) { list.splice(+d.getAttribute('data-del'), 1); at = Math.min(at, list.length - 1); changed(true); return; }
      if (p) { at = +p.getAttribute('data-at'); drawList(); drawEdit(); }
    });
    el.querySelector('.txe-add').addEventListener('click', function (e) {
      var b = e.target.closest('[data-add]');
      if (!b) return;
      var c = blank(b.getAttribute('data-add'));
      if (list[at]) { c.color = list[at].color; }
      list.splice(at + 1, 0, c); at++;
      changed(true);
      var t = editEl.querySelector('.txe-text'); if (t) t.focus();
    });
    editEl.addEventListener('input', function (e) {
      var f = e.target.getAttribute('data-f'), c = list[at];
      if (!f || !c) return;
      if (f === 'hex') { c.color = e.target.value; changed(true); return; }
      if (f === 'clickAction') { c.click = e.target.value ? { action: e.target.value, value: c.click ? c.click.value : '' } : null; changed(true); return; }
      if (f === 'clickValue') { if (c.click) c.click.value = e.target.value; changed(false); return; }
      c[f] = e.target.value;
      changed(false);
    });
    editEl.addEventListener('change', function (e) { if (e.target.tagName === 'SELECT' && e.target.getAttribute('data-f') !== 'clickAction') changed(true); });
    editEl.addEventListener('click', function (e) {
      var col = e.target.closest('[data-color]'), st = e.target.closest('[data-style]'), c = list[at];
      if (col) { c.color = col.getAttribute('data-color'); changed(true); }
      if (st) { var k = st.getAttribute('data-style'); c[k] = !c[k]; changed(true); }
    });
    api.get = function () { return list; };
    api.set = function (v) { list = v.length ? v : [blank('text')]; at = 0; changed(true); };
    api.select = function (c) { var i = list.indexOf(c); if (i > -1) { at = i; drawList(); drawEdit(); } };
    drawList(); drawEdit();
    return api;
  }
  return { blank: blank, runs: runs, snbt: snbt, json: json, rawtext: rawtext, legacy: legacy, hexOf: hexOf, nearestName: nearestName, editor: editor, NAMES: NAMES, KEYS: KEYS, slash: slash, q: q };
})();
