/* ===================================================
   HWR BOOKMARKS — shared localStorage helper
   Include this file (via <script src="hwr-bookmarks.js" defer></script>)
   on any hwr-*.html page that needs bookmark buttons, and on
   homewebresources.html to render the saved list.

   Storage shape: localStorage['hwr_bookmarks'] = JSON array of
   { name, link, icon, sub, cat } objects, deduped by `link`.
   =================================================== */
(function(window){
  var KEY = 'hwr_bookmarks';

  function getBookmarks(){
    try {
      var raw = localStorage.getItem(KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch(e){
      console.error('Failed to read bookmarks', e);
      return [];
    }
  }

  function saveBookmarks(list){
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
      return true;
    } catch(e){
      console.error('Failed to save bookmarks', e);
      return false;
    }
  }

  function isBookmarked(link){
    return getBookmarks().some(function(b){ return b.link === link; });
  }

  // Adds the site if not already saved, removes it if it is.
  // Returns the new bookmarked state (true = now bookmarked).
  function toggleBookmark(site){
    var list = getBookmarks();
    var idx = list.findIndex(function(b){ return b.link === site.link; });
    if(idx === -1){
      list.push({
        name: site.name || '',
        link: site.link || '',
        icon: site.icon || '',
        sub: site.sub || '',
        cat: site.cat || '',
        savedAt: Date.now()
      });
      saveBookmarks(list);
      return true;
    } else {
      list.splice(idx, 1);
      saveBookmarks(list);
      return false;
    }
  }

  // Wipes every saved bookmark. Returns true on success.
  function clearBookmarks(){
    return saveBookmarks([]);
  }

  /* ===================================================
     RECENT VISITS — a lightweight history of sites actually opened.

     Separate key from bookmarks, and deliberately not a "feature you turn
     on": a 589-site directory's real problem is remembering which site you
     used last week, and most people never save anything. hwr-js.js's
     renderItem() records a visit on every site-card click, so this fills
     itself on all ten category pages with no opt-in.

     Stored newest-first, deduped by link (re-opening a site moves it to
     the front rather than adding a second row) and capped, so it can't
     grow without bound in localStorage.
     =================================================== */
  var VISITS_KEY = 'hwr_recent_visits';
  var VISITS_MAX = 12;

  function getVisits(){
    try {
      var raw = localStorage.getItem(VISITS_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch(e){
      console.error('Failed to read recent visits', e);
      return [];
    }
  }

  function recordVisit(site){
    if(!site || !site.link) return false;
    try {
      var list = getVisits().filter(function(v){ return v.link !== site.link; });
      list.unshift({
        name: site.name || '',
        link: site.link,
        icon: site.icon || '',
        sub: site.sub || '',
        cat: site.cat || '',
        at: Date.now()
      });
      localStorage.setItem(VISITS_KEY, JSON.stringify(list.slice(0, VISITS_MAX)));
      return true;
    } catch(e){
      // A full or blocked localStorage must never break the click that
      // triggered this — the link still has to open.
      console.error('Failed to record visit', e);
      return false;
    }
  }

  function clearVisits(){
    try { localStorage.removeItem(VISITS_KEY); return true; }
    catch(e){ console.error('Failed to clear visits', e); return false; }
  }

  /* ===================================================
     EXPORT / IMPORT — bookmarks live only in this browser's localStorage.
     Clearing site data, switching browser, or moving to a phone destroys
     them silently, and nothing on the site warned about that. These make
     the set portable as a small JSON payload, usable either as a
     downloaded file or as text pasted between devices.
     =================================================== */
  var EXPORT_KIND = 'parchrome-bookmarks';
  var EXPORT_VERSION = 1;

  function exportBookmarks(){
    return JSON.stringify({
      kind: EXPORT_KIND,
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      bookmarks: getBookmarks()
    }, null, 2);
  }

  // Accepts either the wrapped export object or a bare array, so a payload
  // hand-edited down to just its list still imports.
  // Returns { ok, added, skipped, total, error }.
  function importBookmarks(text){
    var parsed;
    try {
      parsed = JSON.parse(text);
    } catch(e){
      return { ok: false, error: "That doesn't look like a Parchrome backup — the text isn't valid JSON." };
    }

    var incoming = Array.isArray(parsed) ? parsed
                 : (parsed && Array.isArray(parsed.bookmarks)) ? parsed.bookmarks
                 : null;
    if(!incoming){
      return { ok: false, error: "No bookmarks found in that backup." };
    }

    var current = getBookmarks();
    var seen = {};
    current.forEach(function(b){ seen[b.link] = true; });

    var added = 0, skipped = 0;
    incoming.forEach(function(b){
      // Anything without a link can't be deduped or opened, so it's not a
      // bookmark. Already-saved links are skipped rather than duplicated,
      // which makes importing the same file twice harmless.
      if(!b || typeof b.link !== 'string' || !b.link){ skipped++; return; }
      if(seen[b.link]){ skipped++; return; }
      seen[b.link] = true;
      current.push({
        name: String(b.name || ''),
        link: b.link,
        icon: String(b.icon || ''),
        sub: String(b.sub || ''),
        cat: String(b.cat || ''),
        savedAt: typeof b.savedAt === 'number' ? b.savedAt : Date.now()
      });
      added++;
    });

    if(!saveBookmarks(current)){
      return { ok: false, error: 'Could not save — this browser may be out of storage space.' };
    }
    return { ok: true, added: added, skipped: skipped, total: current.length };
  }

/* ===================================================
   HWR ICONS — first-letter fallback for site favicons.

   Lives here (rather than in hwr-js.js) because hwr-bookmarks.js is
   loaded on all 14 hwr pages and runs before hwr-js.js, so every list
   that renders a site icon can reach it.

   THE THING THAT MAKES THIS NON-OBVIOUS: most icons come from
   google.com/s2/favicons, and that service does NOT 404 for a domain it
   has no icon for — it answers 200 with a generic grey globe. So an
   'error' handler alone catches nothing, which is exactly why the globe
   kept showing up in the newer panels. The only tell is the size: the
   placeholder comes back 16x16 even when sz=64 was requested.

   Handles all three failure modes:
     - the request fails outright          -> 'error'
     - it succeeds but is the globe        -> 'load' + naturalWidth <= 16
     - it was already cached before we
       attached the listeners              -> the img.complete check
   =================================================== */
  var HwrIcons = {
    isPlaceholder: function(img){
      return img.src.indexOf('google.com/s2/favicons') !== -1 &&
             !!img.naturalWidth && img.naturalWidth <= 16;
    },

    /* img           the <img> to watch
       name          site name; its first letter becomes the fallback
       fallbackClass class applied to whatever ends up holding the letter
       mode          'parent'  — put the letter in the img's parent
                                 (matches .web-icon-wrap / .stb-toc-icon,
                                  where the wrapper is already sized)
                     'replace' — swap the img itself for a <span>
                                 (for markup with no wrapper) */
    watch: function(img, name, fallbackClass, mode){
      if(!img) return;
      var letter = String(name || '?').trim().charAt(0).toUpperCase() || '?';
      var done = false;

      function fail(){
        if(done) return;
        done = true;
        if(mode === 'replace'){
          var span = document.createElement('span');
          span.className = fallbackClass;
          span.textContent = letter;
          if(img.parentNode) img.parentNode.replaceChild(span, img);
        } else {
          var p = img.parentElement;
          if(p){
            p.classList.add(fallbackClass);
            p.textContent = letter;
          }
          if(img.parentNode) img.remove();
        }
      }

      img.addEventListener('error', fail);
      img.addEventListener('load', function(){
        if(HwrIcons.isPlaceholder(img)) fail();
      });

      // A cached image can finish loading before the listeners above are
      // attached, in which case neither event will ever fire.
      if(img.complete){
        if(!img.naturalWidth) fail();
        else if(HwrIcons.isPlaceholder(img)) fail();
      }
    },

    // Convenience for markup built with innerHTML: wires every <img> in a
    // container, taking each one's name from a data attribute.
    watchAll: function(root, selector, fallbackClass, mode, nameAttr){
      if(!root) return;
      Array.prototype.forEach.call(root.querySelectorAll(selector), function(img){
        var holder = img.closest('[' + nameAttr + ']') || img;
        HwrIcons.watch(img, holder.getAttribute(nameAttr), fallbackClass, mode);
      });
    }
  };

  window.HwrIcons = HwrIcons;

  window.HwrBookmarks = {
    getBookmarks: getBookmarks,
    isBookmarked: isBookmarked,
    toggleBookmark: toggleBookmark,
    clearBookmarks: clearBookmarks,
    getVisits: getVisits,
    recordVisit: recordVisit,
    clearVisits: clearVisits,
    exportBookmarks: exportBookmarks,
    importBookmarks: importBookmarks
  };
})(window);