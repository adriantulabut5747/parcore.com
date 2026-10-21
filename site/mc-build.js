// 3D build viewer for Minecraft articles (Oct 2026).
//
//   <div class="mcb" data-build="/mc-build-<id>.json" data-materials="mcbMats"></div>
//
// The JSON comes from _tools/mcbuild/build.py (structure block .nbt -> palette + blocks per
// state). Blocks are drawn from the game's own 16px textures (/minecrafticons/builds/textures/),
// using the game's model coordinates (0-16 "pixels" per block). "Front" = the north side, the
// side the build is meant to be seen from; directions in labels are as seen from there.
// Rendering is on demand (a frame only when something changes), so an idle viewer costs nothing.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const TEX = '/minecrafticons/builds/textures/';
const RED = 0xe0403f;
// Plain building blocks: what "Hide building blocks" ghosts out.
const FILLER = new Set(['minecraft:iron_block', 'minecraft:dirt', 'minecraft:cobblestone', 'minecraft:stone', 'minecraft:smooth_stone']);
const NAMES = { redstone_wire: 'Redstone Dust', piston_head: 'Piston Head' };
const ICONS = {
  'minecraft:sticky_piston': 'piston_top_sticky', 'minecraft:piston': 'piston_top', 'minecraft:observer': 'observer_front',
  'minecraft:dropper': 'dropper_front', 'minecraft:redstone_wire': 'item_redstone', 'minecraft:repeater': 'item_repeater',
  'minecraft:lever': 'lever', 'minecraft:iron_block': 'iron_block', 'minecraft:dirt': 'dirt', 'minecraft:cobblestone': 'cobblestone',
};
const OPP = { north: 'south', south: 'north', east: 'west', west: 'east', up: 'down', down: 'up' };
const REL = { up: 'up', down: 'down', east: 'left', west: 'right', north: 'out the front', south: 'out the back' };
const WHERE = { up: 'above it', down: 'below it', east: 'to its left', west: 'to its right', north: 'in front of it', south: 'behind it' };
const VEC = { north: [0, 0, -1], south: [0, 0, 1], east: [1, 0, 0], west: [-1, 0, 0], up: [0, 1, 0], down: [0, -1, 0] };

const nameOf = (id) => { const k = id.replace('minecraft:', ''); if (k === 'iron_block') return 'Block of choice'; return NAMES[k] || k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()); };

// ---- textures and materials (shared by every viewer on the page) ----
const viewers = new Set();
const loader = new THREE.TextureLoader();
const texCache = {}, matCache = {};
function tex(name) {
  if (!texCache[name]) {
    const t = loader.load(TEX + name + '.png', () => viewers.forEach((v) => v.render()));
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    t.colorSpace = THREE.SRGBColorSpace;
    texCache[name] = t;
  }
  return texCache[name];
}
function mat(name, tint) {
  const key = name + '|' + (tint || '');
  if (!matCache[key]) {
    // Tinted = redstone dust: unlit, so unpowered dust keeps its true dark red instead of going black.
    const M = tint ? THREE.MeshBasicMaterial : THREE.MeshLambertMaterial;
    matCache[key] = new M({ map: tex(name), color: tint || 0xffffff, alphaTest: 0.5, side: THREE.DoubleSide });
  }
  return matCache[key];
}

// ---- model geometry: one quad per face, game-style from/to boxes in pixels ----
// Corners per face, as seen from outside: TL, TR, BR, BL. uv default = the game's auto-uv.
function faceGeo(f, t, dir) {
  const [fx, fy, fz] = f, [tx, ty, tz] = t;
  const c = {
    north: [[tx, ty, fz], [fx, ty, fz], [fx, fy, fz], [tx, fy, fz]],
    south: [[fx, ty, tz], [tx, ty, tz], [tx, fy, tz], [fx, fy, tz]],
    west: [[fx, ty, fz], [fx, ty, tz], [fx, fy, tz], [fx, fy, fz]],
    east: [[tx, ty, tz], [tx, ty, fz], [tx, fy, fz], [tx, fy, tz]],
    up: [[fx, ty, fz], [tx, ty, fz], [tx, ty, tz], [fx, ty, tz]],
    down: [[fx, fy, tz], [tx, fy, tz], [tx, fy, fz], [fx, fy, fz]],
  }[dir];
  const uv = {
    north: [16 - tx, 16 - ty, 16 - fx, 16 - fy], south: [fx, 16 - ty, tx, 16 - fy],
    west: [fz, 16 - ty, tz, 16 - fy], east: [16 - tz, 16 - ty, 16 - fz, 16 - fy],
    up: [fx, fz, tx, tz], down: [fx, 16 - tz, tx, 16 - fz],
  }[dir];
  return { c, uv };
}
function face(f, t, dir, spec) {
  if (typeof spec === 'string') spec = { t: spec };
  const g = faceGeo(f, t, dir);
  const [u1, v1, u2, v2] = spec.uv || g.uv;
  let uvs = [[u1, v1], [u2, v1], [u2, v2], [u1, v2]];
  if (spec.transpose) uvs = [uvs[0], uvs[3], uvs[2], uvs[1]];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(g.c.flat(), 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs.flatMap(([u, v]) => [u / 16, 1 - v / 16]), 2));
  geo.setIndex([0, 3, 2, 0, 2, 1]);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat(spec.t, spec.tint));
}
const SIDES = ['north', 'south', 'west', 'east'];
function box(f, t, faces) {
  const g = new THREE.Group();
  for (const d of [...SIDES, 'up', 'down']) {
    const spec = faces[d] || (SIDES.includes(d) ? faces.side : null) || faces.all;
    if (spec) g.add(face(f, t, d, spec));
  }
  return g;
}

// Rotations from a model's canonical facing to the block's facing.
const FROM_UP = { up: [0, 0, 0], down: [Math.PI, 0, 0], north: [-Math.PI / 2, 0, 0], south: [Math.PI / 2, 0, 0], east: [0, 0, -Math.PI / 2], west: [0, 0, Math.PI / 2] };
const FROM_NORTH = { north: [0, 0, 0], south: [0, Math.PI, 0], east: [0, -Math.PI / 2, 0], west: [0, Math.PI / 2, 0], up: [Math.PI / 2, 0, 0], down: [-Math.PI / 2, 0, 0] };

function wireColor(power) {
  const f = power / 15;
  return new THREE.Color(f * 0.6 + (f > 0 ? 0.4 : 0.3), Math.max(0, Math.min(1, f * f * 0.7 - 0.5)), Math.max(0, Math.min(1, f * f * 0.6 - 0.7)));
}

// Returns { model (Group in pixel space), rot (euler), dir (arrow direction or null), info (label line) }.
function blockModel(id, p) {
  const k = id.replace('minecraft:', '');
  const fc = p.facing;
  if (k === 'sticky_piston' || k === 'piston') {
    const top = k === 'sticky_piston' ? 'piston_top_sticky' : 'piston_top';
    const ext = p.extended === 'true';
    const model = ext
      ? box([0, 0, 0], [16, 12, 16], { up: 'piston_inner', down: 'piston_bottom', side: 'piston_side' })
      : box([0, 0, 0], [16, 16, 16], { up: top, down: 'piston_bottom', side: 'piston_side' });
    return { model, rot: FROM_UP[fc], dir: fc, info: 'Pushes ' + REL[fc] + (ext ? ' · extended' : '') };
  }
  if (k === 'piston_head') {
    const top = p.type === 'sticky' ? 'piston_top_sticky' : 'piston_top';
    const model = box([0, 12, 0], [16, 16, 16], { up: top, down: 'piston_top', side: 'piston_side' });
    model.add(box([6, -4, 6], [10, 12, 10], { side: { t: 'piston_side', uv: [0, 4, 4, 16] } }));
    return { model, rot: FROM_UP[fc], dir: null, info: 'Part of the piston ' + WHERE[OPP[fc]] };
  }
  if (k === 'observer') {
    const model = box([0, 0, 0], [16, 16, 16], {
      north: 'observer_front', south: p.powered === 'true' ? 'observer_back_on' : 'observer_back', up: 'observer_top', down: 'observer_top', side: 'observer_side',
    });
    return { model, rot: FROM_NORTH[fc], dir: fc, info: 'Face points ' + REL[fc] + ' · signal out ' + REL[OPP[fc]] };
  }
  if (k === 'dropper' || k === 'dispenser') {
    const vertical = fc === 'up' || fc === 'down';
    const model = vertical
      ? box([0, 0, 0], [16, 16, 16], { up: k + '_front_vertical', down: 'furnace_top', side: 'furnace_top' })
      : box([0, 0, 0], [16, 16, 16], { north: k + '_front', up: 'furnace_top', down: 'furnace_top', side: 'furnace_side' });
    return { model, rot: vertical ? FROM_UP[fc] : FROM_NORTH[fc], dir: fc, info: 'Faces ' + REL[fc] };
  }
  if (k === 'repeater') {
    const on = p.powered === 'true', d = +p.delay, torch = on ? 'redstone_torch' : 'redstone_torch_off';
    const model = box([0, 0, 0], [16, 2, 16], { up: on ? 'repeater_on' : 'repeater', down: 'smooth_stone', side: 'smooth_stone' });
    const tspec = { side: { t: torch, uv: [7, 6, 9, 11] }, up: { t: torch, uv: [7, 6, 9, 8] } };
    model.add(box([7, 2, 2], [9, 7, 4], tspec));
    model.add(box([7, 2, 4 + 2 * d], [9, 7, 6 + 2 * d], tspec));
    const out = OPP[fc]; // a repeater's facing points at its input
    return { model, rot: FROM_NORTH[out], dir: out, info: d + '-tick delay · signal goes ' + REL[out] };
  }
  if (k === 'redstone_wire') {
    const power = +p.power, tint = wireColor(power), y = 0.25;
    const model = new THREE.Group();
    const has = (d) => p[d] && p[d] !== 'none';
    const line = (d) => ({ t: 'redstone_dust_line0', tint, ...d });
    if (has('north')) model.add(box([0, y, 0], [16, y, 8], { up: line({}) }));
    if (has('south')) model.add(box([0, y, 8], [16, y, 16], { up: line({}) }));
    if (has('east')) model.add(box([8, y, 0], [16, y, 16], { up: line({ uv: [0, 0, 16, 8], transpose: true }) }));
    if (has('west')) model.add(box([0, y, 0], [8, y, 16], { up: line({ uv: [0, 8, 16, 16], transpose: true }) }));
    const straight = (has('north') && has('south') && !has('east') && !has('west')) || (has('east') && has('west') && !has('north') && !has('south'));
    if (!straight) model.add(box([0, y, 0], [16, y, 16], { up: { t: 'redstone_dust_dot', tint } }));
    // "up": the dust climbs the side of the next block over
    if (p.east === 'up') model.add(box([15.75, 0, 0], [15.75, 16, 16], { west: line({ uv: [0, 0, 16, 16] }) }));
    if (p.west === 'up') model.add(box([0.25, 0, 0], [0.25, 16, 16], { east: line({ uv: [0, 0, 16, 16] }) }));
    if (p.north === 'up') model.add(box([0, 0, 0.25], [16, 16, 0.25], { south: line({ uv: [0, 0, 16, 16] }) }));
    if (p.south === 'up') model.add(box([0, 0, 15.75], [16, 16, 15.75], { north: line({ uv: [0, 0, 16, 16] }) }));
    return { model, rot: [0, 0, 0], dir: null, info: 'Power ' + power + (power ? ' · on' : ' · off') };
  }
  if (k === 'lever') {
    const on = p.powered === 'true';
    const model = box([5, 0, 4], [11, 3, 12], { all: 'cobblestone' });
    const handle = new THREE.Group();
    const stick = box([7, 1, 7], [9, 11, 9], { side: { t: 'lever', uv: [7, 6, 9, 16] }, up: { t: 'lever', uv: [7, 6, 9, 8] } });
    stick.position.set(-8, -1, -8); handle.add(stick);
    handle.position.set(8, 1, 8); handle.rotation.x = on ? Math.PI / 4 : -Math.PI / 4;
    model.add(handle);
    const spin = { north: 0, south: Math.PI, east: -Math.PI / 2, west: Math.PI / 2 }[fc] || 0;
    const rot = p.face === 'wall' ? FROM_UP[fc] : p.face === 'ceiling' ? [Math.PI, spin, 0] : [0, spin, 0];
    return { model, rot, dir: null, info: on ? 'On' : 'Off' };
  }
  const known = ['iron_block', 'dirt', 'cobblestone', 'smooth_stone'].includes(k);
  const model = known ? box([0, 0, 0], [16, 16, 16], { all: k }) : new THREE.Mesh(new THREE.BoxGeometry(16, 16, 16).translate(8, 8, 8), new THREE.MeshLambertMaterial({ color: 0x8a8a90 }));
  return { model, rot: [0, 0, 0], dir: null, info: FILLER.has(id) ? 'Building block' : '' };
}

function arrow(dir) {
  const m = new THREE.MeshBasicMaterial({ color: RED, depthTest: false, transparent: true });
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 10), m); shaft.position.y = 0.25;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.32, 14), m); tip.position.y = 0.66;
  shaft.userData.arrow = tip.userData.arrow = true;
  g.add(shaft, tip);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...VEC[dir]));
  g.renderOrder = 10; shaft.renderOrder = 10; tip.renderOrder = 10;
  return g;
}

// ---- the viewer ----
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

async function mount(root) {
  const data = await (await fetch(root.dataset.build)).json();
  const [W, H, Dp] = data.size;
  const center = new THREE.Vector3(W / 2, H / 2, Dp / 2);
  const hasOpen = !!data.states.open;
  let state = 'closed', showArrows = false, hideFiller = false, layer = H, hovered = null;

  // UI
  const bar = el('div', 'mcb-bar');
  const seg = el('div', 'mcb-seg', '<button type="button" data-s="closed" aria-pressed="true">Closed</button><button type="button" data-s="open" aria-pressed="false">Open</button>');
  if (!hasOpen) seg.hidden = true;
  const togs = el('div', 'mcb-togs', '<button type="button" class="mcb-tog" data-t="arrows" aria-pressed="false">Facing arrows</button><button type="button" class="mcb-tog" data-t="filler" aria-pressed="false">Hide frame blocks</button>');
  bar.append(seg, togs);
  const stage = el('div', 'mcb-stage');
  const tip = el('div', 'mcb-tip'); tip.hidden = true;
  const touch = matchMedia('(pointer: coarse)').matches;
  const hint = el('div', 'mcb-hint', touch ? 'Drag to rotate · pinch to zoom · tap a block' : 'Drag to rotate · scroll to zoom · hover a block');
  stage.append(tip, hint);
  // Phones: the model starts locked so a swipe over it scrolls the page (Adrian's pick).
  // Tap unlocks it; Done, or scrolling it out of view, locks it again.
  const unlock = el('button', 'mcb-unlock', '<span>Tap to rotate</span>'); unlock.type = 'button';
  const done = el('button', 'mcb-done', 'Done'); done.type = 'button'; done.hidden = true;
  if (touch) stage.append(unlock, done);
  const foot = el('div', 'mcb-foot');
  const lab = el('label', 'mcb-layer', '<span>Layers</span>');
  const range = el('input'); Object.assign(range, { type: 'range', min: 1, max: H, value: H, step: 1 }); range.setAttribute('aria-label', 'Show layers from the bottom up');
  const lval = el('output', 'mcb-lval');
  lab.append(range, lval);
  const reset = el('button', 'mcb-reset', 'Reset view'); reset.type = 'button';
  foot.append(lab, reset);
  root.append(bar, stage, foot);

  // three.js
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
  catch (e) { stage.append(el('p', 'mcb-err', 'Your browser can’t show 3D here. The build list below still has every block.')); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  stage.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5); sun.position.set(-3, 8, -5); scene.add(sun);
  const back = new THREE.DirectionalLight(0xffffff, 0.5); back.position.set(4, -2, 6); scene.add(back);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(center); controls.enablePan = false;
  function setActive(on) {
    controls.enabled = on;
    renderer.domElement.style.touchAction = on ? 'none' : 'pan-y'; // OrbitControls sets 'none' inline
    unlock.hidden = on; done.hidden = !on;
    if (!on && hovered) { hovered = null; outline.visible = false; tip.hidden = true; apply(); }
  }
  if (touch) {
    unlock.addEventListener('click', () => setActive(true));
    done.addEventListener('click', () => setActive(false));
    new IntersectionObserver(([e]) => { if (!e.isIntersecting && controls.enabled) setActive(false); }).observe(stage);
  }
  const dist = Math.max(W, H) * 2.1;
  controls.minDistance = dist * 0.35; controls.maxDistance = dist * 2.5;
  function home() { camera.position.set(center.x - dist * 0.32, center.y + dist * 0.18, center.z - dist); controls.update(); }
  home();

  const world = new THREE.Group(); scene.add(world);
  const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.04, 1.04, 1.04)), new THREE.LineBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true }));
  outline.renderOrder = 11; outline.visible = false; scene.add(outline);
  const ghostMat = new THREE.LineBasicMaterial({ color: 0x8b9097, transparent: true, opacity: 0.35 });
  const ghostGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
  let blocks = [];

  function build() {
    world.clear(); blocks = [];
    for (const [x, y, z, i] of data.states[state]) {
      const { id, props = {} } = data.palette[i];
      const m = blockModel(id, props);
      const inner = m.model; inner.position.set(-8, -8, -8);
      const pivot = new THREE.Group(); pivot.add(inner); pivot.scale.setScalar(1 / 16); pivot.rotation.set(...m.rot);
      const holder = new THREE.Group(); holder.position.set(x + 0.5, y + 0.5, z + 0.5); holder.add(pivot);
      const ghost = new THREE.LineSegments(ghostGeo, ghostMat); ghost.visible = false; holder.add(ghost);
      let arr = null;
      if (m.dir) { arr = arrow(m.dir); arr.visible = false; holder.add(arr); }
      const b = { id, props, y, holder, pivot, ghost, arr, info: m.info, filler: FILLER.has(id) };
      holder.traverse((o) => { o.userData.block = b; });
      world.add(holder); blocks.push(b);
    }
    apply();
  }
  function apply() {
    for (const b of blocks) {
      const inLayer = b.y < layer;
      b.holder.visible = inLayer;
      b.pivot.visible = !(hideFiller && b.filler);
      b.ghost.visible = hideFiller && b.filler;
      if (b.arr) { b.arr.visible = showArrows || hovered === b; b.arr.scale.setScalar(hovered === b ? 1.3 : 1); }
    }
    lval.value = layer === H ? 'All ' + H : layer + ' of ' + H;
    render();
  }
  let queued = false;
  const view = {
    render() {
      if (queued) return; queued = true;
      requestAnimationFrame(() => { queued = false; renderer.render(scene, camera); });
    },
  };
  const render = () => view.render();
  viewers.add(view);
  controls.addEventListener('change', render);

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); render();
  }
  new ResizeObserver(resize).observe(stage);

  // hover / tap: outline, its arrow, and the label
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  function pick(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(world.children, true).find((h) => h.object.visible && h.object.isMesh && h.object.userData.block && h.object.userData.block.pivot.visible && h.object.userData.block.holder.visible && !h.object.userData.arrow);
    const b = hit && hit.object.userData.block;
    if (b !== hovered) {
      hovered = b || null;
      outline.visible = !!b;
      if (b) outline.position.copy(b.holder.position);
      apply();
    }
    if (b) {
      tip.innerHTML = '<b>' + nameOf(b.id) + '</b>' + (b.info ? '<span>' + b.info + '</span>' : '');
      tip.hidden = false;
      const x = ev.clientX - r.left, y = ev.clientY - r.top;
      tip.style.left = Math.min(x + 14, r.width - tip.offsetWidth - 8) + 'px';
      tip.style.top = Math.max(8, y - tip.offsetHeight - 12) + 'px';
    } else tip.hidden = true;
  }
  let down = null;
  renderer.domElement.addEventListener('pointermove', (ev) => { if (ev.pointerType === 'mouse' && !ev.buttons) pick(ev); });
  renderer.domElement.addEventListener('pointerdown', (ev) => { down = [ev.clientX, ev.clientY]; hint.classList.add('is-gone'); });
  renderer.domElement.addEventListener('pointerup', (ev) => { if (down && Math.hypot(ev.clientX - down[0], ev.clientY - down[1]) < 6) pick(ev); });
  renderer.domElement.addEventListener('pointerleave', () => { if (hovered) { hovered = null; outline.visible = false; tip.hidden = true; apply(); } });

  seg.addEventListener('click', (e) => {
    const s = e.target.closest('button')?.dataset.s; if (!s || s === state) return;
    state = s; seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.s === s));
    hovered = null; outline.visible = false; tip.hidden = true; build(); materials();
  });
  togs.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on);
    if (b.dataset.t === 'arrows') showArrows = on; else hideFiller = on;
    apply();
  });
  range.addEventListener('input', () => { layer = +range.value; apply(); });
  reset.addEventListener('click', () => { home(); render(); });

  // Materials: counted from the closed build (a piston head belongs to its piston).
  function materials() {
    const box = root.dataset.materials && document.getElementById(root.dataset.materials);
    if (!box) return;
    const n = {};
    for (const [, , , i] of data.states.closed) {
      const id = data.palette[i].id;
      if (id === 'minecraft:piston_head' || id === 'minecraft:moving_piston') continue;
      n[id] = (n[id] || 0) + 1;
    }
    box.innerHTML = Object.entries(n).sort((a, b) => b[1] - a[1]).map(([id, c]) =>
      '<span class="ap-chip"><img src="' + TEX + (ICONS[id] || 'iron_block') + '.png" alt="" width="36" height="36" loading="lazy" decoding="async">' + c + ' × ' + nameOf(id) + '</span>').join('');
  }
  build(); materials(); resize();
  if (touch) setActive(false);
}

document.querySelectorAll('.mcb[data-build]').forEach(mount);
