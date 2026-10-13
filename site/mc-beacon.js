/* Beacon colour calculator (Oct 13 2026), /minecraft/tools/beacon.
   The beam formula, read from the 26.3 game files (BeaconBlockEntity + ARGB):
   the first glass sets the beam to its colour; every glass above averages the
   beam with its own colour, channel by channel, (a + b) / 2 rounded down. The
   same colour twice in a row changes nothing, so the search skips repeats.
   Glass colours = DyeColor textureDiffuseColor (mc-dyes.js).
   The search tries every order of 1-6 glass (12.2 million stacks at 6) in a
   Web Worker so the page stays responsive; it keeps the closest few by a fast
   RGB distance, then ranks them by CIEDE2000 for the match %.
   Copy buttons: mc-home.js. Styles: BEACON block in mc-home.css (.bcn-*). */
var McBeacon = (function () {
  function avg(a, b) {
    return (((a >> 16 & 255) + (b >> 16 & 255)) >> 1) << 16 | (((a >> 8 & 255) + (b >> 8 & 255)) >> 1) << 8 | (((a & 255) + (b & 255)) >> 1);
  }
  // colours of the beam after each glass, bottom to top
  function beam(cols) {
    var out = [], c = null;
    cols.forEach(function (g, i) {
      if (i === 0) c = g;
      else if (g !== cols[i - 1]) c = avg(c, g);
      out.push(c);
    });
    return out;
  }
  // Every stack of 1..max glass with no colour twice in a row. Returns, per length,
  // the `keep` closest by redmean distance: [{ idx: [glass index...], color }]
  function search(cols, target, max, keep) {
    var best = [];
    for (var n = 0; n <= max; n++) best.push([]);
    var path = [];
    function dist(a, b) {
      var r1 = a >> 16 & 255, r2 = b >> 16 & 255, rm = (r1 + r2) >> 1;
      var dr = r1 - r2, dg = (a >> 8 & 255) - (b >> 8 & 255), db = (a & 255) - (b & 255);
      return (((512 + rm) * dr * dr) >> 8) + 4 * dg * dg + (((767 - rm) * db * db) >> 8);
    }
    function add(n, c) {
      var list = best[n], d = dist(c, target);
      if (list.length >= keep && d >= list[list.length - 1].d) return;
      for (var k = 0; k < list.length; k++) if (list[k].color === c) return; // same colour, shorter stack wins
      list.push({ d: d, color: c, idx: path.slice() });
      list.sort(function (a, b) { return a.d - b.d; });
      if (list.length > keep) list.pop();
    }
    function go(c, last, n) {
      add(n, c);
      if (n === max) return;
      for (var i = 0; i < cols.length; i++) {
        if (i === last) continue;
        path.push(i);
        go(avg(c, cols[i]), i, n + 1);
        path.pop();
      }
    }
    for (var i = 0; i < cols.length; i++) { path.push(i); go(cols[i], i, 1); path.pop(); }
    return best;
  }
  return { avg: avg, beam: beam, search: search };
})();
if (typeof module !== 'undefined') module.exports = McBeacon;

(function () {
  if (typeof document === 'undefined') return;
  var stage = document.getElementById('bcnBeam');
  if (!stage) return;
  var $ = function (id) { return document.getElementById(id); };
  var D = McDyes, COLS = D.LIST.map(function (d) { return d.tex; });
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var s = { target: 0xff007f, max: 6, results: [], pick: null, own: ['red', 'blue'], view: 'auto', cmd: 'place' };

  function glassImg(id) { return '/minecrafticons/blocks/' + id + '_stained_glass.png'; }
  function stackHtml(ids) {
    return ids.map(function (id) { return '<img src="' + glassImg(id) + '" alt="' + D.byId(id).name + '" title="' + D.byId(id).name + '">'; }).join('');
  }

  // ---- search in a worker ----
  var worker = null, job = 0;
  function startSearch() {
    var me = ++job;
    $('bcnResults').setAttribute('aria-busy', 'true');
    $('bcnStatus').textContent = 'Trying every stack of up to ' + s.max + ' glass…';
    var run = function (best) {
      if (me !== job) return;
      s.results = [];
      for (var n = 1; n < best.length; n++) {
        var ranked = best[n].map(function (r) {
          return { ids: r.idx.map(function (i) { return D.LIST[i].id; }), color: r.color, de: D.de(r.color, s.target) };
        }).sort(function (a, b) { return a.de - b.de; });
        if (ranked[0]) s.results.push(ranked[0]);
      }
      // a longer stack only earns a row if it beats every shorter one
      var keep = [], bestDe = Infinity;
      s.results.forEach(function (r) { if (r.de < bestDe - 0.05) { keep.push(r); bestDe = r.de; } });
      s.results = keep;
      $('bcnResults').removeAttribute('aria-busy');
      if (s.view === 'auto') s.pick = keep[keep.length - 1];
      drawResults();
      render();
    };
    if (window.Worker && window.Blob) {
      if (worker) worker.terminate();
      // the worker runs this file's own search code
      var src = 'var avg=' + McBeacon.avg + ';var search=' + McBeacon.search + ';onmessage=function(e){postMessage(search(e.data.cols,e.data.target,e.data.max,24));};';
      worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      worker.onmessage = function (e) { run(e.data); };
      worker.postMessage({ cols: COLS, target: s.target, max: s.max });
    } else setTimeout(function () { run(McBeacon.search(COLS, s.target, s.max, 24)); }, 20);
  }

  function drawResults() {
    var list = s.results;
    $('bcnStatus').textContent = list.length ? 'Best stack for each number of glass. Fewer glass is listed only when it is as close.' : '';
    $('bcnResults').innerHTML = list.map(function (r, i) {
      var on = s.view === 'auto' && s.pick === r;
      return '<li><button type="button" class="bcn-res" data-res="' + i + '" aria-pressed="' + on + '">' +
        '<span class="bcn-res-n">' + r.ids.length + '</span><span class="bcn-res-stack">' + stackHtml(r.ids) + '</span>' +
        '<span class="bcn-res-sw" style="background:' + D.hex(r.color) + '"></span>' +
        '<span class="bcn-res-m"><b>' + D.match(r.color, s.target) + '%</b><small>' + D.hex(r.color) + '</small></span></button></li>';
    }).join('');
  }

  // ---- the beam picture ----
  var ctx = $('bcnCanvas').getContext('2d'), t0 = performance.now(), raf = 0;
  var beamTex = D.img('/minecrafticons/entity/beacon_beam.png'), beaconTex = D.img('/minecrafticons/blocks/beacon.png'), shellTex = D.img('/minecrafticons/blocks/glass.png');
  function shown() { return s.view === 'own' ? s.own : (s.pick ? s.pick.ids : []); }
  function frame(now) {
    var cv = $('bcnCanvas'), W = cv.clientWidth, H = cv.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);
    var ids = shown(), cols = McBeacon.beam(ids.map(function (id) { return D.byId(id).tex; }));
    var B = Math.min(64, Math.floor((H - 40) / (ids.length + 3))), cx = W / 2, bottom = H - 24;
    var bw = Math.max(6, Math.round(B * 0.28)), scroll = reduced ? 0 : ((now - t0) / 1000 * 40) % 32;
    // beam segments: white above the beacon, then each glass's mix, the last one to the sky
    var segs = [{ y0: bottom - B * 2, y1: bottom - B, c: 0xffffff }];
    ids.forEach(function (id, i) {
      var top = i === ids.length - 1 ? 0 : bottom - B * (i + 3);
      segs.push({ y0: top, y1: bottom - B * (i + 2), c: cols[i] });
    });
    if (!ids.length) segs[0].y0 = 0;
    segs.forEach(function (g) {
      var hexc = D.hex(g.c);
      // glow
      var grd = ctx.createLinearGradient(cx - bw * 3, 0, cx + bw * 3, 0);
      grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(0.5, hexc + '55'); grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(cx - bw * 3, g.y0, bw * 6, g.y1 - g.y0);
      // core, the game's beam texture tinted, scrolling upward
      ctx.save();
      ctx.beginPath(); ctx.rect(cx - bw / 2, g.y0, bw, g.y1 - g.y0); ctx.clip();
      ctx.fillStyle = hexc; ctx.fillRect(cx - bw / 2, g.y0, bw, g.y1 - g.y0);
      if (beamTex.complete && beamTex.naturalWidth) {
        ctx.globalCompositeOperation = 'multiply';
        for (var y = g.y1 + 32 - scroll; y > g.y0 - 32; y -= 32) ctx.drawImage(beamTex, cx - bw / 2, y - 32, bw, 32);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(cx - bw / 6, g.y0, bw / 3, g.y1 - g.y0);
      ctx.restore();
    });
    // beacon + glass blocks
    if (beaconTex.complete && beaconTex.naturalWidth) {
      ctx.drawImage(beaconTex, cx - B / 2 + B * 0.19, bottom - B + B * 0.19, B * 0.62, B * 0.62);
      if (shellTex.complete && shellTex.naturalWidth) ctx.drawImage(shellTex, cx - B / 2, bottom - B, B, B);
    }
    ids.forEach(function (id, i) {
      var im = D.img(glassImg(id));
      if (im.complete && im.naturalWidth) ctx.drawImage(im, cx - B / 2, bottom - B * (i + 3), B, B);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
      ctx.strokeRect(cx - B / 2 + 0.5, bottom - B * (i + 3) + 0.5, B - 1, B - 1);
    });
    // labels: the beam after each glass
    ctx.font = '600 11px Sora, sans-serif';
    ctx.textBaseline = 'middle';
    ids.forEach(function (id, i) {
      var y = bottom - B * (i + 3) + B / 2;
      ctx.textAlign = 'left'; ctx.fillStyle = '#a9adb3'; ctx.fillText(D.byId(id).name, cx + B / 2 + 12, y - 7);
      ctx.fillStyle = '#e6e8eb'; ctx.font = '500 11px ' + getComputedStyle(document.body).getPropertyValue('--mch-mono'); ctx.fillText(D.hex(cols[i]), cx + B / 2 + 12, y + 8);
      ctx.font = '600 11px Sora, sans-serif';
    });
    ctx.textAlign = 'right'; ctx.fillStyle = '#80858c'; ctx.fillText('Beacon', cx - B / 2 - 12, bottom - B / 2);
    if (!reduced) raf = requestAnimationFrame(frame);
  }
  function kick() { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
  [beamTex, beaconTex, shellTex].forEach(function (im) { im.addEventListener('load', kick); });
  D.LIST.forEach(function (d) { D.img(glassImg(d.id)).addEventListener('load', kick); });

  function render() {
    var ids = shown(), cols = McBeacon.beam(ids.map(function (id) { return D.byId(id).tex; }));
    var res = cols.length ? cols[cols.length - 1] : null;
    $('bcnTargetSw').style.background = D.hex(s.target);
    $('bcnTargetHex').textContent = D.hex(s.target);
    $('bcnResultSw').style.background = res == null ? 'transparent' : D.hex(res);
    $('bcnResultHex').textContent = res == null ? 'No glass' : D.hex(res);
    $('bcnMatch').textContent = res == null ? '' : D.match(res, s.target) + '% match';
    $('bcnOutK').textContent = s.view === 'own' ? 'Your stack' : 'Closest stack';
    // commands
    var X = $('bcnX').value.trim() || '~', Y = $('bcnY').value.trim() || '~', Z = $('bcnZ').value.trim() || '~';
    // a number = the beacon's Y, so glass starts one above it; "~" = your feet (stand on the beacon)
    function up(y, i) { return /^-?\d+$/.test(y) ? String(+y + i) : '~' + (i - 1 || ''); }
    var lines;
    if (s.cmd === 'place') lines = ids.map(function (id, i) { return '/setblock ' + X + ' ' + up(Y, i + 1) + ' ' + Z + ' minecraft:' + id + '_stained_glass'; });
    else {
      var n = {};
      ids.forEach(function (id) { n[id] = (n[id] || 0) + 1; });
      lines = Object.keys(n).map(function (id) { return '/give @p minecraft:' + id + '_stained_glass ' + n[id]; });
    }
    var out = lines.join('\n');
    $('bcnCmd').textContent = out || 'Pick a stack first.';
    $('bcnCopy').setAttribute('data-copy', out);
    $('bcnCopy').disabled = !out;
    $('bcnPos').hidden = s.cmd !== 'place';
    // your own stack row
    $('bcnOwn').innerHTML = s.own.map(function (id, i) {
      return '<li><button type="button" class="pt-slot bcn-own-slot" data-own="' + i + '" aria-label="Remove ' + D.byId(id).name + ' (glass ' + (i + 1) + ')"><img src="' + glassImg(id) + '" alt=""><i>' + (i + 1) + '</i></button></li>';
    }).join('') || '<li class="bcn-own-empty">Add glass from the colours below.</li>';
    var ownCols = McBeacon.beam(s.own.map(function (id) { return D.byId(id).tex; }));
    $('bcnOwnRes').innerHTML = ownCols.length ? '<span style="background:' + D.hex(ownCols[ownCols.length - 1]) + '"></span>' + D.hex(ownCols[ownCols.length - 1]) : '';
    $('bcnUse').disabled = !ownCols.length;
    document.querySelectorAll('[data-res]').forEach(function (b) { b.setAttribute('aria-pressed', String(s.view === 'auto' && s.results[+b.getAttribute('data-res')] === s.pick)); });
    $('bcnShowOwn').setAttribute('aria-pressed', String(s.view === 'own'));
    kick();
  }

  // ---- input ----
  function setTarget(n, from) {
    if (n == null) return;
    s.target = n;
    if (from !== 'hex') $('bcnHex').value = D.hex(n);
    if (from !== 'picker') $('bcnPicker').value = D.hex(n);
    s.view = 'auto';
    startSearch();
    render();
  }
  $('bcnHex').addEventListener('input', function () { setTarget(D.parse(this.value), 'hex'); });
  $('bcnPicker').addEventListener('input', function () { setTarget(D.parse(this.value), 'picker'); });
  $('bcnQuick').innerHTML = D.LIST.map(function (d) {
    return '<button type="button" class="pt-slot bcn-glass" data-quick="' + d.id + '" title="' + d.name + '" aria-label="' + d.name + ' (' + D.hex(d.tex) + ')"><img src="' + glassImg(d.id) + '" alt=""></button>';
  }).join('');
  $('bcnQuick').addEventListener('click', function (e) {
    var b = e.target.closest('[data-quick]');
    if (b) setTarget(D.byId(b.getAttribute('data-quick')).tex);
  });
  $('bcnMax').addEventListener('click', function (e) {
    var b = e.target.closest('[data-max]');
    if (!b) return;
    s.max = +b.getAttribute('data-max');
    this.querySelectorAll('[data-max]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    s.view = 'auto';
    startSearch();
  });
  $('bcnResults').addEventListener('click', function (e) {
    var b = e.target.closest('[data-res]');
    if (!b) return;
    s.pick = s.results[+b.getAttribute('data-res')];
    s.view = 'auto';
    render();
  });
  $('bcnPalette').innerHTML = D.LIST.map(function (d) {
    return '<button type="button" class="pt-slot bcn-glass" data-add="' + d.id + '" title="Add ' + d.name + '" aria-label="Add ' + d.name + ' glass on top"><img src="' + glassImg(d.id) + '" alt=""></button>';
  }).join('');
  $('bcnPalette').addEventListener('click', function (e) {
    var b = e.target.closest('[data-add]');
    if (!b || s.own.length >= 10) return;
    s.own.push(b.getAttribute('data-add'));
    s.view = 'own';
    render();
  });
  $('bcnOwn').addEventListener('click', function (e) {
    var b = e.target.closest('[data-own]');
    if (!b) return;
    s.own.splice(+b.getAttribute('data-own'), 1);
    s.view = 'own';
    render();
  });
  $('bcnShowOwn').addEventListener('click', function () { s.view = s.view === 'own' ? 'auto' : 'own'; render(); });
  $('bcnClearOwn').addEventListener('click', function () { s.own = []; s.view = 'own'; render(); });
  $('bcnUse').addEventListener('click', function () {
    var c = McBeacon.beam(s.own.map(function (id) { return D.byId(id).tex; }));
    if (c.length) setTarget(c[c.length - 1]);
  });
  $('bcnCmdSeg').addEventListener('click', function (e) {
    var b = e.target.closest('[data-cmd]');
    if (!b) return;
    s.cmd = b.getAttribute('data-cmd');
    this.querySelectorAll('[data-cmd]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    render();
  });
  ['bcnX', 'bcnY', 'bcnZ'].forEach(function (id) { $(id).addEventListener('input', render); });
  if ('ResizeObserver' in window) new ResizeObserver(kick).observe($('bcnCanvas'));

  $('bcnHex').value = D.hex(s.target);
  $('bcnPicker').value = D.hex(s.target);
  startSearch();
  render();
})();
