
// ── NORMALIZER ──
function normalizePage(url) {
  if (!url) return "";
  return url.toString().split('/').pop().split('?')[0].split('#')[0].replace('.html', '') || "home";
}
const currentPage = normalizePage(window.location.pathname);

// ── SIDEBAR ──
const topBox = document.getElementById('top-box');
const gamesContainer = document.getElementById('games-container');
const tripleAList = document.getElementById('triple-a-list');
let sidebarLoaded = false;
let sidebarDataCache = null;

function loadSidebarData() {
  if (sidebarLoaded) return Promise.resolve(sidebarDataCache);
  return fetch('./sidebar.json').then(res => res.json()).then(data => {
    sidebarLoaded = true; sidebarDataCache = data; return data;
  }).catch(err => console.error("Sidebar load error:", err));
}

function buildSidebarFromJSON(data) {
  data.topBox.forEach(item => {
    const a = document.createElement('a');
    a.href = item.link; a.className = 'top-box-item';
    const isActive = normalizePage(item.link) === currentPage || item.activeOn?.map(normalizePage).includes(currentPage);
    if (isActive) a.classList.add('active');
    a.innerHTML = `<img src="${item.icon}" class="topbox-icon" onerror="this.style.display='none'"><span>${item.name}</span>`;
    topBox.appendChild(a);
  });
  data.games.forEach(game => {
    const a = document.createElement('a');
    a.href = game.link; a.className = 'game';
    if (game.link === currentPage || (game.activeOn?.map(normalizePage).includes(currentPage))) a.classList.add('active');
    a.innerHTML = `<img src="${game.icon}" class="sidebar-icon" alt=""><span>${game.name}</span>`;
    gamesContainer.appendChild(a);
  });
  data.tripleA.forEach(game => {
    const a = document.createElement('a');
    a.href = game.link || "#"; a.className = 'triple-a-game';
    a.innerHTML = `<img src="${game.icon}" class="sidebar-icon" alt=""><span>${game.name}</span>`;
    tripleAList.appendChild(a);
  });
}

function toggleTripleA() {
  const header = document.querySelector('.triple-a-header');
  const list = document.getElementById('triple-a-list');
  const isOpen = header.classList.contains('open');
  if (isOpen) { header.classList.remove('open'); header.classList.add('closed'); list.style.display = 'none'; }
  else { header.classList.remove('closed'); header.classList.add('open'); list.style.display = 'flex'; }
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const burger = document.getElementById('hamburger');
  sidebar.classList.toggle('active');
  burger.classList.toggle('active');
  if (sidebar.classList.contains('active') && !sidebarLoaded) {
    loadSidebarData().then(data => { buildSidebarFromJSON(data); });
  }
}

function handleDesktopSidebar() {
  const isDesktop = window.matchMedia("(min-width: 971px)").matches;
  const sidebar = document.getElementById('sidebar');
  if (isDesktop && !sidebar.classList.contains('active')) document.getElementById('hamburger').click();
}
document.addEventListener('DOMContentLoaded', handleDesktopSidebar);
window.addEventListener('resize', handleDesktopSidebar);

document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('.triple-a-header');
  const list = document.getElementById('triple-a-list');
  header.classList.add('open');
  list.style.display = 'flex';
});

// ── SECONDARY TOP BAR ──
document.querySelector('.secondary-top-bar').addEventListener('click', () => {
  document.querySelector('.coc-main').scrollTo({ top: 0, behavior: 'smooth' });
});

// ── HELP POPUP ──
function toggleHelp(event) {
  event.stopPropagation();
  const popup = document.getElementById('help-popup');
  popup.style.display = popup.style.display === 'block' ? 'none' : 'block';
}
document.addEventListener('click', () => { document.getElementById('help-popup').style.display = 'none'; });

// ── PAGE LOAD ──
window.addEventListener("load", () => { document.documentElement.classList.add("loaded"); });

// ── SEARCH ──
let SearchItemList = [], searchoverlay, closeBtn, searchinput, searchIcon, resultsContainer, isLoaded = false;
fetch('searchitemstorage.json').then(res => res.json()).then(data => { SearchItemList = data; isLoaded = true; });

document.addEventListener('DOMContentLoaded', function () {
  searchoverlay = document.getElementById('search-overlay');
  closeBtn = document.getElementById('search-close-btn');
  resultsContainer = document.getElementById('search-results');
  searchinput = document.getElementById('search-input');
  searchIcon = document.getElementById('search-icon');

  function openSearch() { searchoverlay.style.display = 'block'; searchinput.focus(); if (!searchinput.value) searchItems(); }
  function closeSearch() { searchinput.value = ''; resultsContainer.innerHTML = ''; searchoverlay.style.display = 'none'; }
  searchIcon.addEventListener('click', openSearch);
  closeBtn.addEventListener('click', closeSearch);
  searchoverlay.addEventListener('click', e => { if (e.target === searchoverlay) closeSearch(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSearch(); });
});

function shuffleArray(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function searchItems() {
  const query = document.getElementById('search-input').value.toLowerCase();
  const resultsContainer = document.getElementById('search-results');
  resultsContainer.innerHTML = '';
  let filtered;
  if (!query) { filtered = shuffleArray(SearchItemList).slice(0, 7); }
  else {
    filtered = SearchItemList.filter(item => {
      if (item.name.toLowerCase().includes(query)) return true;
      if (item.keywords && item.keywords.some(k => k.toLowerCase().includes(query))) return true;
      return false;
    });
    if (filtered.length === 0) { resultsContainer.innerHTML = `<div style="padding:10px;">No results found</div>`; return; }
  }
  const limitedResults = query ? filtered.slice(0, 7) : filtered;
  limitedResults.forEach(item => {
    const a = document.createElement('a');
    a.href = item.link; a.className = 'search-result-item';
    a.innerHTML = item.icon ? `<img src="${item.icon}" class="result-icon" alt=""> ${item.name}` : item.name;
    resultsContainer.appendChild(a);
  });
  if (query && filtered.length > 10) {
    const viewMore = document.createElement('div');
    viewMore.textContent = "View More..."; viewMore.className = "view-more";
    viewMore.addEventListener('click', () => {
      resultsContainer.innerHTML = '';
      filtered.forEach(item => {
        const a = document.createElement('a');
        a.href = item.link; a.className = 'search-result-item';
        a.innerHTML = item.icon ? `<img src="${item.icon}" class="result-icon" alt=""> ${item.name}` : item.name;
        resultsContainer.appendChild(a);
      });
    });
    resultsContainer.appendChild(viewMore);
  }
}

// ── SCROLL ROWS ──
function scrollRow(id, dir) {
  const row = document.getElementById(id);
  row.scrollBy({ left: dir * 300, behavior: 'smooth' });
}
document.querySelectorAll('.cf-row').forEach(row => {
  row.addEventListener('scroll', () => updateArrows(row.id));
  updateArrows(row.id);
});
function updateArrows(rowId) {
  const row = document.getElementById(rowId);
  if (!row) return;
  const section = row.closest('.cf-section');
  if (!section) return;
  const leftBtn = section.querySelector('.cf-arrow:first-of-type');
  const rightBtn = section.querySelector('.cf-arrow:last-of-type');
  const atStart = row.scrollLeft <= 4;
  const atEnd = row.scrollLeft + row.clientWidth >= row.scrollWidth - 4;
  if (leftBtn) leftBtn.disabled = atStart;
  if (rightBtn) rightBtn.disabled = atEnd;
}

// ── COMMAND MODAL ──
let currentCmd = '', cmdFeedbackTimeout;
function openCmd(el) {
  document.getElementById('cmdModalTitle').textContent = el.dataset.name;
  document.getElementById('cmdModalSub').textContent = el.dataset.sub;
  document.getElementById('cmdModalCode').textContent = el.dataset.cmd;
  currentCmd = el.dataset.cmd;
  document.getElementById('cmdFeedback').textContent = '';
  document.getElementById('cmdModal').classList.add('open');
  pushModalState();
}
function closeCmd() { document.getElementById('cmdModal').classList.remove('open'); }
function closeCmdOutside(e) { if (e.target === document.getElementById('cmdModal')) closeCmd(); }
function copyCmd() {
  const fallback = () => {
    const el = document.createElement('textarea');
    el.value = currentCmd; el.style.position = 'fixed'; el.style.opacity = '0';
    document.body.appendChild(el); el.focus(); el.select();
    try { document.execCommand('copy'); } catch(e) {}
    document.body.removeChild(el); showCmdFeedback();
  };
  if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(currentCmd).then(showCmdFeedback).catch(fallback); }
  else { fallback(); }
}
function showCmdFeedback() {
  const fb = document.getElementById('cmdFeedback');
  fb.textContent = '✓ Copied to clipboard!';
  clearTimeout(cmdFeedbackTimeout);
  cmdFeedbackTimeout = setTimeout(() => fb.textContent = '', 2500);
}
// ── GALLERY LIGHTBOX (banners) ──
let lbScale = 1, lbX = 0, lbY = 0;
let pinchStartDist = 0, pinchStartScale = 1;
let isDragging = false, dragStartX = 0, dragStartY = 0, dragOriginX = 0, dragOriginY = 0;
let galCurrentCmd = '', galFeedbackTimeout;

function openLightbox(el) {
  const src = el.dataset.full || el.querySelector('img').src;
  const img = document.getElementById('gal-lb-img');
  img.src = src;
  lbScale = 1; lbX = 0; lbY = 0;
  applyGalTransform();
  document.getElementById('gal-lightbox').classList.add('open');
  pushModalState();
  document.getElementById('gal-lb-fixed-close').style.display = 'flex';
  galCurrentCmd = el.dataset.cmd || '';
  document.getElementById('gal-lb-name').textContent = el.dataset.name || '';
  document.getElementById('gal-lb-code').textContent = el.dataset.cmd || '';
  document.getElementById('gal-lb-feedback').textContent = '';
  document.getElementById('gal-lb-copybox').style.display = galCurrentCmd ? 'flex' : 'none';
  document.addEventListener('keydown', lbEscHandler);
}

function closeLightbox() {
  const lb = document.getElementById('gal-lightbox');
  if (!lb.classList.contains('open')) return;
  lb.classList.remove('open');
  document.getElementById('gal-lb-fixed-close').style.display = 'none';
  document.removeEventListener('keydown', lbEscHandler);
  if (history.state?.modal) history.back();
}

function lbEscHandler(e) { if (e.key === 'Escape') closeLightbox(); }

// ── BACK BUTTON CLOSES MODALS ──
function pushModalState() {
  history.pushState({ modal: true }, '');
}

function popModalHandler() {
  // Called by browser back — just close whichever is open, no history.back()
  const galLb = document.getElementById('gal-lightbox');
  const palLb = document.getElementById('pal-lightbox');
  const cmd   = document.getElementById('cmdModal');

  if (galLb.classList.contains('open')) {
    galLb.classList.remove('open');
    document.getElementById('gal-lb-fixed-close').style.display = 'none';
    document.removeEventListener('keydown', lbEscHandler);
  } else if (palLb.classList.contains('open')) {
    palLb.classList.remove('open');
    document.getElementById('pal-lb-fixed-close').style.display = 'none';
    palScale = 1; palPanX = 0; palPanY = 0; palIsPanning = false;
    window.onmousemove = null; window.onmouseup = null;
    document.removeEventListener('keydown', palEscHandler);
  } else if (cmd.classList.contains('open')) {
    cmd.classList.remove('open');
  }
}

window.addEventListener('popstate', popModalHandler);

function applyGalTransform() {
  document.getElementById('gal-lb-img').style.transform = `translate(${lbX}px, ${lbY}px) scale(${lbScale})`;
}

function galCopyCmd() {
  const fallback = () => {
    const el = document.createElement('textarea');
    el.value = galCurrentCmd; el.style.position = 'fixed'; el.style.opacity = '0';
    document.body.appendChild(el); el.focus(); el.select();
    try { document.execCommand('copy'); } catch(e) {}
    document.body.removeChild(el); showGalFeedback();
  };
  if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(galCurrentCmd).then(showGalFeedback).catch(fallback); }
  else { fallback(); }
}

function showGalFeedback() {
  const fb = document.getElementById('gal-lb-feedback');
  fb.textContent = '✓ Copied!';
  clearTimeout(galFeedbackTimeout);
  galFeedbackTimeout = setTimeout(() => fb.textContent = '', 2500);
}

const lbImg = document.getElementById('gal-lb-img');
lbImg.addEventListener('touchstart', e => {
  if (e.touches.length === 2) {
    e.preventDefault();
    pinchStartDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    pinchStartScale = lbScale;
  } else if (e.touches.length === 1 && lbScale > 1) {
    isDragging = true;
    dragStartX = e.touches[0].clientX; dragStartY = e.touches[0].clientY;
    dragOriginX = lbX; dragOriginY = lbY;
  }
}, { passive: false });
lbImg.addEventListener('touchmove', e => {
  if (e.touches.length === 2) {
    e.preventDefault();
    const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    lbScale = Math.min(Math.max(pinchStartScale * (dist / pinchStartDist), 1), 5);
    applyGalTransform();
  } else if (e.touches.length === 1 && isDragging) {
    e.preventDefault();
    lbX = dragOriginX + (e.touches[0].clientX - dragStartX);
    lbY = dragOriginY + (e.touches[0].clientY - dragStartY);
    applyGalTransform();
  }
}, { passive: false });
lbImg.addEventListener('touchend', e => {
  if (e.touches.length < 2) isDragging = false;
  if (lbScale <= 1) { lbScale = 1; lbX = 0; lbY = 0; applyGalTransform(); }
});
let lastTap = 0;
lbImg.addEventListener('touchend', e => {
  const now = Date.now();
  if (now - lastTap < 280) { lbScale = 1; lbX = 0; lbY = 0; applyGalTransform(); }
  lastTap = now;
});
lbImg.addEventListener('click', e => e.stopPropagation());

// ── PALETTE LIGHTBOX ──
let palScale = 1, palStartDist = 0, palLastScale = 1;
let palIsPanning = false, palPanStartX = 0, palPanStartY = 0, palPanX = 0, palPanY = 0;

function getPalClampLimits() {
  const img = document.getElementById('pal-lb-img');
  const scaledW = img.offsetWidth * palScale;
  const scaledH = img.offsetHeight * palScale;
  return {
    maxX: Math.max(0, (scaledW - window.innerWidth) / 2),
    maxY: Math.max(0, (scaledH - window.innerHeight) / 2)
  };
}

function clampPalPan() {
  if (palScale <= 1) { palPanX = 0; palPanY = 0; return; }
  const { maxX, maxY } = getPalClampLimits();
  palPanX = Math.min(maxX, Math.max(-maxX, palPanX));
  palPanY = Math.min(maxY, Math.max(-maxY, palPanY));
}

function applyPalTransform() {
  document.getElementById('pal-lb-img').style.transform = `translate(${palPanX}px, ${palPanY}px) scale(${palScale})`;
}

function palEscHandler(e) { if (e.key === 'Escape') closePalette(); }

function closePalette() {
  const lb = document.getElementById('pal-lightbox');
  if (!lb.classList.contains('open')) return;
  lb.classList.remove('open');
  document.getElementById('pal-lb-fixed-close').style.display = 'none';
  palScale = 1; palPanX = 0; palPanY = 0; palIsPanning = false;
  window.onmousemove = null; window.onmouseup = null;
  document.removeEventListener('keydown', palEscHandler);
  if (history.state?.modal) history.back();
}

function openPalette(el) {
  const src = el.dataset.full || el.querySelector('img').src;
  const lb  = document.getElementById('pal-lightbox');
  const img = document.getElementById('pal-lb-img');
  palScale = 1; palPanX = 0; palPanY = 0;
  img.src = src;
  img.style.transform = 'translate(0px, 0px) scale(1)';
  img.style.cursor = 'default';
  lb.classList.add('open');
  pushModalState();
  document.getElementById('pal-lb-fixed-close').style.display = 'flex';

  lb.onwheel = (e) => {
    e.preventDefault();
    const rect = img.getBoundingClientRect();
    const cx = e.clientX - (rect.left + rect.width / 2);
    const cy = e.clientY - (rect.top + rect.height / 2);
    const prevScale = palScale;
    palScale = Math.min(Math.max(1, palScale * (1 - e.deltaY * 0.002)), 6);
    const ratio = palScale / prevScale;
    palPanX = palPanX * ratio + cx * (ratio - 1);
    palPanY = palPanY * ratio + cy * (ratio - 1);
    clampPalPan();
    applyPalTransform();
    img.style.cursor = palScale > 1 ? 'grab' : 'default';
  };

  img.onmousedown = (e) => {
    if (palScale <= 1) return;
    e.preventDefault();
    palIsPanning = true;
    palPanStartX = e.clientX - palPanX;
    palPanStartY = e.clientY - palPanY;
    img.style.cursor = 'grabbing';
  };
  window.onmousemove = (e) => {
    if (!palIsPanning) return;
    palPanX = e.clientX - palPanStartX;
    palPanY = e.clientY - palPanStartY;
    clampPalPan();
    applyPalTransform();
  };
  window.onmouseup = () => {
    if (!palIsPanning) return;
    palIsPanning = false;
    img.style.cursor = palScale > 1 ? 'grab' : 'default';
  };

  img.ontouchstart = (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      palStartDist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
      palLastScale = palScale;
    } else if (e.touches.length === 1 && palScale > 1) {
      palIsPanning = true;
      palPanStartX = e.touches[0].clientX - palPanX;
      palPanStartY = e.touches[0].clientY - palPanY;
    }
  };
  img.ontouchmove = (e) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      const newDist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
      const newCX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const newCY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const prevScale = palScale;
      palScale = Math.min(Math.max(1, palLastScale * (newDist / palStartDist)), 6);
      const ratio = palScale / prevScale;
      const rect = img.getBoundingClientRect();
      const cx = newCX - (rect.left + rect.width / 2);
      const cy = newCY - (rect.top + rect.height / 2);
      palPanX = palPanX * ratio + cx * (ratio - 1);
      palPanY = palPanY * ratio + cy * (ratio - 1);
      clampPalPan();
      applyPalTransform();
    } else if (e.touches.length === 1 && palIsPanning) {
      palPanX = e.touches[0].clientX - palPanStartX;
      palPanY = e.touches[0].clientY - palPanStartY;
      clampPalPan();
      applyPalTransform();
    }
  };
  img.ontouchend = (e) => {
    if (e.touches.length < 2) palIsPanning = false;
    if (palScale <= 1) { palScale = 1; palPanX = 0; palPanY = 0; }
    else clampPalPan();
    applyPalTransform();
  };

  // Backdrop click closes — but stop propagation from the image itself
  img.onclick = (e) => e.stopPropagation();
  lb.onclick = (e) => { if (e.target === lb) closePalette(); };

  document.addEventListener('keydown', palEscHandler);
}

// PAGE LOADER — fires when HTML is parsed, doesn't wait for images/fonts
document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.classList.add("loaded");
  const loader = document.getElementById('page-loader');
  loader.classList.add('hidden');
  setTimeout(() => loader.remove(), 400);
});



// Skeleton for sidebar when not loaded
      function showSkeletons(container, count) {
  for (let i = 0; i < count; i++) {
    const div = document.createElement('div');
    div.className = 'skeleton-item';
    div.innerHTML = `
      <div class="skeleton-icon"></div>
      <div class="skeleton-text"></div>`;
    container.appendChild(div);
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const burger = document.getElementById('hamburger');
  sidebar.classList.toggle('active');
  burger.classList.toggle('active');

  if (sidebar.classList.contains('active') && !sidebarLoaded) {
    // show skeletons immediately
    showSkeletons(topBox, 3);
    showSkeletons(gamesContainer, 5);
    showSkeletons(tripleAList, 4);

    loadSidebarData().then(data => {
      // wipe skeletons then build real content
      topBox.innerHTML = '';
      gamesContainer.innerHTML = '';
      tripleAList.innerHTML = '';
      buildSidebarFromJSON(data);
    });
  }
}