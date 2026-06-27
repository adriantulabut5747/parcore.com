
  
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

// Keeps you on your window scrolly thingy (super duper usefuller)
history.scrollRestoration = 'manual';

window.addEventListener('scroll', function() {
  sessionStorage.setItem('scrollPos_' + location.pathname, window.scrollY);
});

window.addEventListener('pageshow', function(e) {
  var saved = sessionStorage.getItem('scrollPos_' + location.pathname);
  if (saved) setTimeout(function() { window.scrollTo(0, parseInt(saved)); }, 50);
});