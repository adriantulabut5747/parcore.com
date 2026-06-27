//NORMALIZER (REMOVES THE .HTML)
function normalizePage(url) {
  if (!url) return "";
  return url
    .toString()
    .split('/')
    .pop()
    .split('?')[0]
    .split('#')[0]
    .replace('.html', '')
    || "home";}
const currentPage = normalizePage(window.location.pathname);



// Sidebar elementssssssssssssssssssssssssssssssssssssss

const topBox = document.getElementById('top-box');
const gamesContainer = document.getElementById('games-container');
const tripleAList = document.getElementById('triple-a-list');

// LOAD CONTROL (ADDED ONLY)
let sidebarLoaded = false;
let sidebarDataCache = null;

// YOUR ORIGINAL FETCH (MODIFIED ONLY SLIGHTLY: moved into function wrapper)
function loadSidebarData() {
  if (sidebarLoaded) return Promise.resolve(sidebarDataCache);

  return fetch('./sidebar.json')
    .then(res => res.json())
    .then(data => {
      sidebarLoaded = true;
      sidebarDataCache = data;
      return data;
    })
    .catch(err => console.error("Sidebar load error:", err));
}


// 3 BOXES FUNCTION
function buildSidebarFromJSON(data) {

  // TOP BOX
  data.topBox.forEach(item => {
    const a = document.createElement('a');
    a.href = item.link;
    a.className = 'top-box-item';
    const isActive =
      normalizePage(item.link) === currentPage ||
      item.activeOn?.map(normalizePage).includes(currentPage);
    if (isActive) {
      a.classList.add('active'); }
    a.innerHTML = `
      <img src="${item.icon}" class="topbox-icon"
          onerror="this.style.display='none'">
      <span>${item.name}</span>`;
    topBox.appendChild(a);});

  // TOP GAMES
  data.games.forEach(game => {
    const a = document.createElement('a');
    a.href = game.link;
    a.className = 'game';
    if (
      game.link === currentPage ||
      (game.activeOn?.map(normalizePage).includes(currentPage))) {
      a.classList.add('active');}
    a.innerHTML = `
      <img src="${game.icon}" class="sidebar-icon" alt="">
      <span>${game.name}</span> `;
    gamesContainer.appendChild(a);});

  // TRIPLE A GAMES
  data.tripleA.forEach(game => {
    const a = document.createElement('a');
    a.href = game.link || "#";
    a.className = 'triple-a-game';
    a.innerHTML = `
    <img src="${game.icon}" class="sidebar-icon" alt="">
    <span>${game.name}</span> `;
    tripleAList.appendChild(a);});}


  // TOGGLE TRIPLE A
  function toggleTripleA() {
    const header = document.querySelector('.triple-a-header');
    const list = document.getElementById('triple-a-list');
    const isOpen = header.classList.contains('open');
    if (isOpen) {
      header.classList.remove('open');
      header.classList.add('closed');
      list.style.display = 'none';
    } else {
      header.classList.remove('closed');
      header.classList.add('open');
      list.style.display = 'flex';}}


// TOGGLE SIDEBAR
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const burger = document.getElementById('hamburger');
  sidebar.classList.toggle('active');
  burger.classList.toggle('active');
  // Lazy load JSON when opened first time
  if (sidebar.classList.contains('active') && !sidebarLoaded) {
    loadSidebarData().then(data => {
      buildSidebarFromJSON(data);
    });}}


//auto clicks the hamburger when on desktop mode 
function handleDesktopSidebar() {
  const isDesktop = window.matchMedia("(min-width: 971px)").matches;
  const sidebar = document.getElementById('sidebar');
  // Only auto-open if desktop AND sidebar is not already active
  if (isDesktop && !sidebar.classList.contains('active')) {
  document.getElementById('hamburger').click();}}
  document.addEventListener('DOMContentLoaded', handleDesktopSidebar);// run on load
  window.addEventListener('resize', handleDesktopSidebar);// run on resize (important when rotating / resizing window)

//DOM LOADER
document.addEventListener('DOMContentLoaded', () => {
const header = document.querySelector('.triple-a-header');
const list = document.getElementById('triple-a-list');
  header.classList.add('open'); // arrow points down
  list.style.display = 'flex';  // list visible
});

// PAGE LOADER — wait for ALL assets (images, fonts, etc.)
window.addEventListener('load', () => {
  document.documentElement.classList.add("loaded"); // reveals body
  const loader = document.getElementById('page-loader');
  if (loader) {
    loader.classList.add('hidden');
    setTimeout(() => loader.remove(), 400); // matches your 0.4s transition
  }
});

// SECONDARY TOP BAR AUTO TOP
function scrollToTop() {
  const main = document.querySelector('.coc-main');
  main.scrollTo({ top: 0, behavior: 'smooth' });}

// SCROLLS TO TOP WHEN 2ND TOP BAR HIT
document.querySelector('.secondary-top-bar').addEventListener('click', scrollToTop);

//HELP POPUP
function toggleHelp(event) {
  event.stopPropagation(); // prevent closing immediately
  const popup = document.getElementById('help-popup');
  popup.style.display = popup.style.display === 'block' ? 'none' : 'block';}
//CLOSE POPUP WHEN CLICKING OUTSIDE
document.addEventListener('click', () => {
  document.getElementById('help-popup').style.display = 'none';
});

//THIS ANNOYING SHI THAT IDK WHAT IT IS
 window.addEventListener("load", () => {
    document.documentElement.classList.add("loaded");
  });



function openImage(src) {
  const modal = document.getElementById('image-modal');
  const img = document.getElementById('modal-img');
  img.src = src;
  modal.style.display = 'flex';
}

function closeImage() {
  document.getElementById('image-modal').style.display = 'none';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeImage();
});

function zoomImage(src) {
  const zoom = document.getElementById('imageZoom');
  const img = document.getElementById('zoomedImg');

  img.src = src;
  zoom.style.display = 'flex';
  document.body.classList.add('no-zoom');
}

function closeZoom() {
  document.getElementById('imageZoom').style.display = 'none';
  document.body.classList.remove('no-zoom');
}

function toggleCC(el) {
  const popup = el.parentElement.querySelector('.cc-popup');
  const isOpen = popup.style.display === 'block';

  // Close all other popups
  document.querySelectorAll('.cc-popup').forEach(p => {
    p.style.display = 'none';
  });

  popup.style.display = isOpen ? 'none' : 'block';
}

// Close when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.image-logo') && !e.target.closest('.cc-popup')) {
    document.querySelectorAll('.cc-popup').forEach(p => {
      p.style.display = 'none';
    });}
});
//clan tag copy
const clanTagItem = document.getElementById('clan-tag');
clanTagItem.addEventListener('click', () => {
  const tag = '#2GYPGPJP9';
  navigator.clipboard.writeText(tag)
    .then(() => {
      const msg = document.getElementById('copy-msg');
      msg.style.display = 'block';
      setTimeout(() => { msg.style.display = 'none'; }, 1500);
    })
    .catch(err => console.error('Failed to copy: ', err));
});

//copy cliboards
const clanTag = document.getElementById('clan-tag');
const copyMsg = document.getElementById('copy-msg');

clanTag.addEventListener('click', () => {
  // Copy to clipboard
  navigator.clipboard.writeText(clanTag.textContent).then(() => {
    // Show "Copied!" message
    copyMsg.style.display = 'block';
    setTimeout(() => { copyMsg.style.display = 'none'; }, 1500);
  });
});


document.querySelectorAll('.zoomable').forEach(img => {
  img.addEventListener('click', () => {
    zoomImage(img.src);
  });
});

let scale = 1;
let startDist = 0;
let lastScale = 1;

function zoomImage(src) {
  const zoom = document.getElementById('imageZoom');
  const img = document.getElementById('zoomedImg');

  scale = 1;
  img.src = src;
  img.style.transform = 'scale(1)';
  zoom.style.display = 'flex';

  /* ===== PC SCROLL ZOOM ===== */
  zoom.onwheel = (e) => {
    e.preventDefault();
    scale += e.deltaY * -0.0015; // stronger zoom
    scale = Math.min(Math.max(1, scale), 6);
    img.style.transform = `scale(${scale})`;
  };

  /* ===== MOBILE PINCH ZOOM ===== */
  img.ontouchstart = (e) => {
    if (e.touches.length === 2) {
      startDist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      lastScale = scale;
    }
  };

  img.ontouchmove = (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();

      const newDist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );

      scale = lastScale * (newDist / startDist);
      scale = Math.min(Math.max(1, scale), 6);
      img.style.transform = `scale(${scale})`;
    }
  };
}

function closeZoom() {
  document.getElementById('imageZoom').style.display = 'none';
}

document.querySelectorAll('.zoomable').forEach(img => {
  img.addEventListener('click', (e) => {
    e.preventDefault();
    setTimeout(() => zoomImage(img.src), 100);
  });
});



window.addEventListener('load', () => {
  const container = document.getElementById('second-layer-container');
  const activeBtn = container.querySelector('button.active'); // the active TH button

  if (activeBtn) {
    const containerRect = container.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();

    const scrollLeft = container.scrollLeft + (btnRect.left - containerRect.left) - (containerRect.width / 2) + (btnRect.width / 2);

    container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
  }
});


// Save scroll position when navigating
function goToTH(url, btn) {
  const container = document.getElementById('second-layer-container');
  if (container) {
    sessionStorage.setItem('secondLayerScroll', container.scrollLeft);
  }
  // Navigate to the next page
  window.location.href = url;
}

// Restore scroll position on page load
window.addEventListener('load', () => {
  const container = document.getElementById('second-layer-container');
  const savedScroll = sessionStorage.getItem('secondLayerScroll');
  
  if (container && savedScroll !== null) {
    container.scrollTo({ left: parseFloat(savedScroll), behavior: 'auto' });
  }
});


//copyclipboard ac clan box
const ascendereTag = document.getElementById('ascendere-clan-tag');
if (ascendereTag) {
  ascendereTag.addEventListener('click', () => {
    navigator.clipboard.writeText('#2GYPGPJP9').then(() => {
      const msg = document.getElementById('copy-msg');
      if (msg) {
        msg.style.display = 'block';
        setTimeout(() => { msg.style.display = 'none'; }, 1500);
      }
    });
  });
}

 window.addEventListener("load", () => {
    document.documentElement.classList.add("loaded");
  });


// SEARCH SYSTEM
let SearchItemList = [];
let searchoverlay;
let closeBtn;
let searchinput;
let searchIcon;
let resultsContainer;
let isLoaded = false;
// Fetch JSON on page load
fetch('searchitemstorage.json')
  .then(res => res.json())
  .then(data => {
    SearchItemList = data;
    isLoaded = true;
  });

document.addEventListener('DOMContentLoaded', function () {
  searchoverlay = document.getElementById('search-overlay');
  closeBtn = document.getElementById('search-close-btn');
  resultsContainer = document.getElementById('search-results');
  searchinput = document.getElementById('search-input');
  searchIcon = document.getElementById('search-icon');

  // OPEN overlay
function openSearch() {
    searchoverlay.style.display = 'block';
    searchinput.focus();
    if (!searchinput.value) searchItems();  }
      if (!isLoaded) {
    searchItems(); // fallback or loading state
  } else {
    searchItems();
  }

  // CLOSE overlay
function closeSearch() {
  searchinput.value = '';
  resultsContainer.innerHTML = '';
  searchoverlay.style.display = 'none';  }
  searchIcon.addEventListener('click', openSearch);
  closeBtn.addEventListener('click', closeSearch);
  // Click outside to close
  searchoverlay.addEventListener('click', e => {
    if (e.target === searchoverlay) closeSearch();
  });
  // ESC key to close
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSearch(); });
  });


// 🔀 Shuffle function
function shuffleArray(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;}

//Main search function
function searchItems() {
  const query = document.getElementById('search-input').value.toLowerCase();
  const resultsContainer = document.getElementById('search-results');
  resultsContainer.innerHTML = '';
  let filtered;
  if (!query) {
    filtered = shuffleArray(SearchItemList).slice(0, 7);} 
  else {
    filtered = SearchItemList.filter(item => {
  if (item.name.toLowerCase().includes(query)) return true;
      if (
        item.keywords &&
        item.keywords.some(k => k.toLowerCase().includes(query))
      ) return true;
      return false;});

  // No results
  if (filtered.length === 0) {
      resultsContainer.innerHTML = `<div style="padding:10px;">No results found</div>`;
      return;}}

// Limit results
const limitedResults = query ? filtered.slice(0, 7) : filtered;

// Render results
limitedResults.forEach(item => {
    const a = document.createElement('a');
    a.href = item.link;
    a.className = 'search-result-item';
    if (item.icon) {
    a.innerHTML = `<img src="${item.icon}" class="result-icon" alt=""> ${item.name}`;
    } else { a.textContent = item.name; }
    resultsContainer.appendChild(a);});

// View more button
if (query && filtered.length > 10) {
    const viewMore = document.createElement('div');
    viewMore.textContent = "View More...";
    viewMore.className = "view-more";
    viewMore.addEventListener('click', () => {
      resultsContainer.innerHTML = '';
      filtered.forEach(item => {
      const a = document.createElement('a');
      a.href = item.link;
      a.className = 'search-result-item';
      if (item.icon) {
      a.innerHTML = `<img src="${item.icon}" class="result-icon" alt=""> ${item.name}`;
      } else {  a.textContent = item.name; }
      resultsContainer.appendChild(a); });
      });
      resultsContainer.appendChild(viewMore); }}



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