/* The 16 Minecraft dye colours + colour maths, shared by the Beacon, Armor and
   Firework tools (/minecraft/tools/). Read from the 26.3 game files
   (DyeColor.class): tex = textureDiffuseColor (stained glass in a beacon beam,
   dyed leather), fw = fireworkColor (firework sparks). Names: lang/en_us.json.
   Match % on the tools is 100 minus the CIEDE2000 colour difference. */
var McDyes = (function () {
  var LIST = [
    ['white', 'White', 'f9fffe', 'f0f0f0'], ['orange', 'Orange', 'f9801d', 'eb8844'],
    ['magenta', 'Magenta', 'c74ebd', 'c354cd'], ['light_blue', 'Light Blue', '3ab3da', '6689d3'],
    ['yellow', 'Yellow', 'fed83d', 'decf2a'], ['lime', 'Lime', '80c71f', '41cd34'],
    ['pink', 'Pink', 'f38baa', 'd88198'], ['gray', 'Gray', '474f52', '434343'],
    ['light_gray', 'Light Gray', '9d9d97', 'ababab'], ['cyan', 'Cyan', '169c9c', '287697'],
    ['purple', 'Purple', '8932b8', '7b2fbe'], ['blue', 'Blue', '3c44aa', '253192'],
    ['brown', 'Brown', '835432', '51301a'], ['green', 'Green', '5e7c16', '3b511a'],
    ['red', 'Red', 'b02e26', 'b3312c'], ['black', 'Black', '1d1d21', '1e1b1b']
  ].map(function (d) {
    return { id: d[0], name: d[1], tex: parseInt(d[2], 16), fw: parseInt(d[3], 16) };
  });

  function hex(n) { return '#' + ('00000' + (n >>> 0 & 0xffffff).toString(16)).slice(-6); }
  function parse(v) {
    v = String(v || '').trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(v)) v = v.replace(/./g, '$&$&');
    return /^[0-9a-f]{6}$/i.test(v) ? parseInt(v, 16) : null;
  }
  function lab(n) {
    var c = [n >> 16 & 255, n >> 8 & 255, n & 255].map(function (v) {
      v /= 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    var x = (c[0] * 0.4124 + c[1] * 0.3576 + c[2] * 0.1805) / 0.95047;
    var y = c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
    var z = (c[0] * 0.0193 + c[1] * 0.1192 + c[2] * 0.9505) / 1.08883;
    var f = function (t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; };
    return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
  }
  // CIEDE2000 (Sharma et al. 2005)
  function de(a, b) {
    var A = lab(a), B = lab(b), rad = Math.PI / 180;
    var C1 = Math.hypot(A[1], A[2]), C2 = Math.hypot(B[1], B[2]), Cm = (C1 + C2) / 2;
    var G = 0.5 * (1 - Math.sqrt(Math.pow(Cm, 7) / (Math.pow(Cm, 7) + Math.pow(25, 7))));
    var a1 = A[1] * (1 + G), a2 = B[1] * (1 + G);
    var c1 = Math.hypot(a1, A[2]), c2 = Math.hypot(a2, B[2]);
    var h1 = (Math.atan2(A[2], a1) / rad + 360) % 360, h2 = (Math.atan2(B[2], a2) / rad + 360) % 360;
    var dL = B[0] - A[0], dC = c2 - c1, dh = c1 * c2 === 0 ? 0 : (Math.abs(h2 - h1) <= 180 ? h2 - h1 : h2 - h1 > 180 ? h2 - h1 - 360 : h2 - h1 + 360);
    var dH = 2 * Math.sqrt(c1 * c2) * Math.sin(dh * rad / 2);
    var Lm = (A[0] + B[0]) / 2, cm = (c1 + c2) / 2;
    var hm = c1 * c2 === 0 ? h1 + h2 : (Math.abs(h1 - h2) <= 180 ? (h1 + h2) / 2 : (h1 + h2 < 360 ? (h1 + h2 + 360) / 2 : (h1 + h2 - 360) / 2));
    var T = 1 - 0.17 * Math.cos((hm - 30) * rad) + 0.24 * Math.cos(2 * hm * rad) + 0.32 * Math.cos((3 * hm + 6) * rad) - 0.2 * Math.cos((4 * hm - 63) * rad);
    var Sl = 1 + 0.015 * Math.pow(Lm - 50, 2) / Math.sqrt(20 + Math.pow(Lm - 50, 2)), Sc = 1 + 0.045 * cm, Sh = 1 + 0.015 * cm * T;
    var Rt = -2 * Math.sqrt(Math.pow(cm, 7) / (Math.pow(cm, 7) + Math.pow(25, 7))) * Math.sin(60 * Math.exp(-Math.pow((hm - 275) / 25, 2)) * rad);
    return Math.sqrt(Math.pow(dL / Sl, 2) + Math.pow(dC / Sc, 2) + Math.pow(dH / Sh, 2) + Rt * (dC / Sc) * (dH / Sh));
  }
  function match(a, b) { return Math.max(0, Math.round(100 - de(a, b))); }
  // Fast stand-in for searches: "redmean" weighted RGB distance, squared.
  function near(a, b) {
    var r1 = a >> 16 & 255, r2 = b >> 16 & 255, rm = (r1 + r2) >> 1;
    var dr = r1 - r2, dg = (a >> 8 & 255) - (b >> 8 & 255), db = (a & 255) - (b & 255);
    return (((512 + rm) * dr * dr) >> 8) + 4 * dg * dg + (((767 - rm) * db * db) >> 8);
  }
  function byId(id) { return LIST.filter(function (d) { return d.id === id; })[0]; }
  // "#aabbcc" -> the closest dye name, for labels
  function nameOf(n, key) {
    var best = null, bd = Infinity;
    LIST.forEach(function (d) { var x = near(n, d[key || 'tex']); if (x < bd) { bd = x; best = d; } });
    return best;
  }
  // The texture tint the game applies: each channel times the colour.
  function tint(ctx, img, n, w, h) {
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    var d = ctx.getImageData(0, 0, w, h), p = d.data, r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
    for (var i = 0; i < p.length; i += 4) { p[i] = p[i] * r / 255; p[i + 1] = p[i + 1] * g / 255; p[i + 2] = p[i + 2] * b / 255; }
    ctx.putImageData(d, 0, 0);
  }
  var imgs = {};
  function img(src, done) {
    var im = imgs[src];
    if (!im) { im = imgs[src] = new Image(); im.src = src; }
    if (done) { if (im.complete && im.naturalWidth) done(im); else im.addEventListener('load', function () { done(im); }); }
    return im;
  }
  return { LIST: LIST, hex: hex, parse: parse, de: de, match: match, near: near, byId: byId, nameOf: nameOf, tint: tint, img: img };
})();
if (typeof module !== 'undefined') module.exports = McDyes;
