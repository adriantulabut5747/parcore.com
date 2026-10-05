/* coc-help.js -- the "i" help button + modal on every CoC page.
   Builds its markup at the right end of the secondary top bar (so the
   help text lives in ONE place, not in 29 page copies) and runs it.
   Styles: coc-help.css. Load with defer, after the top bar's markup.

   The open/close behaviour, the scroll lock and the "detach the panel to
   <body>" placement are copied from hwr-js.js (initStbInfoDropdown,
   stbLockScroll / stbUnlockScroll, stbDetachDropdownPanel) -- see the
   comments there for why each step exists. Same ids too (stbInfoBtn,
   stbInfoDropdown, stbDdOverlay), which never meet hwr's: no page loads
   both files. */
(function () {
  try {
    var bar = document.querySelector('.secondary-top-bar');
    if (!bar || document.getElementById('stbInfoBtn')) return;

    var ICON_INFO =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.25" /><line x1="12" y1="11" x2="12" y2="16.5" stroke-width="2.4" /><circle cx="12" cy="7.6" r="1.3" fill="currentColor" stroke="none" /></svg>';
    // Lucide: external-link, layers, message-circle.
    var ICON_BROWSER =
      '<svg viewBox="0 0 24 24"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>';
    var ICON_TH =
      '<svg viewBox="0 0 24 24"><path d="m12 2 9.5 5.5L12 13 2.5 7.5Z" /><path d="m2.5 12 9.5 5.5 9.5-5.5" /><path d="m2.5 16.5 9.5 5.5 9.5-5.5" /></svg>';
    var ICON_CHAT = '<svg viewBox="0 0 24 24"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></svg>';
    var CHAT_URL = 'https://link.clashofclans.com/en/?action=OpenGlobalChat&chatId=P46a9cfc5f81340b1b43363b9a30316fb';

    var actions = document.createElement('div');
    actions.className = 'stb-mobile-actions';
    actions.innerHTML =
      '<div class="stb-help-divider" aria-hidden="true"></div>' +
      '<div class="stb-info-dropdown-wrap" id="stbInfoDropdownWrap">' +
      '<button type="button" class="stb-icon-btn" id="stbInfoBtn" aria-label="Help: copying bases" aria-haspopup="dialog" aria-expanded="false" aria-controls="stbInfoDropdown">' +
      ICON_INFO +
      '</button>' +
      '<div class="stb-info-dropdown" id="stbInfoDropdown" role="dialog" aria-labelledby="cchTitle" aria-hidden="true">' +
      '<div class="cch-head"><h3 class="cch-title" id="cchTitle">Link not working?</h3>' +
      '<p class="cch-sub">If Copy Layout does nothing or the page shows an error, try these.</p></div>' +
      '<ul class="cch-list">' +
      '<li class="cch-item is-key"><span class="cch-ico" aria-hidden="true">' +
      ICON_BROWSER +
      '</span><div>' +
      '<h4>Open the page in your browser</h4>' +
      '<p>Discord, Facebook and Messenger open links in their own built-in browser, which can&rsquo;t launch the game. Tap <span class="cch-chip">&#8942;</span>, choose <b>Open in Chrome</b> (or Safari), then try again.</p>' +
      '</div></li>' +
      '<li class="cch-item"><span class="cch-ico" aria-hidden="true">' +
      ICON_TH +
      '</span><div>' +
      '<h4>Check your Town Hall level</h4>' +
      '<p>Base links work on your Town Hall or one level up or down. Any further and the game won&rsquo;t load them.</p>' +
      '</div></li>' +
      '</ul>' +
      // Not a support line: an optional invite, set apart from the fixes.
      '<div class="cch-clan">' +
      '<span class="cch-logo" aria-hidden="true"><img src="/icons/aclogonobg-cropped.png" alt="" /></span>' +
      '<div><h4>Join our clan</h4>' +
      '<p>Looking for people to war and raid with? Ascendere&rsquo;s Global Chat is open to everyone.</p></div>' +
      '</div>' +
      '<div class="cch-foot"><a class="cch-btn" href="' +
      CHAT_URL +
      '" target="_blank" rel="noopener noreferrer">' +
      ICON_CHAT +
      '<span>Join Global Chat</span></a></div>' +
      '</div>' +
      '</div>';
    bar.appendChild(actions);

    var ddOverlay = document.getElementById('stbDdOverlay');
    if (!ddOverlay) {
      ddOverlay = document.createElement('div');
      ddOverlay.className = 'stb-dd-overlay';
      ddOverlay.id = 'stbDdOverlay';
      ddOverlay.setAttribute('aria-hidden', 'true');
      document.body.appendChild(ddOverlay);
    }

    // ---- copied from hwr-js.js ----
    function stbDetachDropdownPanel(panel, wrap) {
      function reposition() {
        var r = wrap.getBoundingClientRect();
        panel.style.top = r.bottom + 10 + 'px';
        panel.style.right = window.innerWidth - r.right - 4 + 'px';
      }
      if (!panel.dataset.stbDetached) {
        panel.dataset.stbDetached = '1';
        document.body.appendChild(panel);
        window.addEventListener('resize', reposition);
        window.addEventListener('orientationchange', reposition);
      }
      reposition();
    }

    var stbScrollLockY = 0;
    function stbBlockScroll(e) {
      e.preventDefault();
    }
    function stbLockScroll() {
      stbScrollLockY = window.pageYOffset || document.documentElement.scrollTop || 0;
      document.body.classList.add('stb-dd-scroll-locked');
      var scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollbarWidth > 0) document.body.style.paddingRight = scrollbarWidth + 'px';
      document.body.style.position = 'fixed';
      document.body.style.top = -stbScrollLockY + 'px';
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      document.documentElement.style.overscrollBehaviorY = 'none';
      var cocMain = document.querySelector('.coc-main');
      if (cocMain) {
        cocMain.addEventListener('wheel', stbBlockScroll, { passive: false });
        cocMain.addEventListener('touchmove', stbBlockScroll, { passive: false });
      }
    }
    function stbUnlockScroll() {
      document.body.classList.remove('stb-dd-scroll-locked');
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      document.body.style.paddingRight = '';
      document.documentElement.style.overscrollBehaviorY = '';
      var cocMain = document.querySelector('.coc-main');
      if (cocMain) {
        cocMain.removeEventListener('wheel', stbBlockScroll);
        cocMain.removeEventListener('touchmove', stbBlockScroll);
      }
      window.scrollTo(0, stbScrollLockY);
    }

    var btn = document.getElementById('stbInfoBtn');
    var dropdown = document.getElementById('stbInfoDropdown');
    var wrap = document.getElementById('stbInfoDropdownWrap');

    function isOpen() {
      return dropdown.classList.contains('is-open');
    }
    function openDropdown() {
      stbDetachDropdownPanel(dropdown, wrap);
      dropdown.classList.add('is-open');
      dropdown.setAttribute('aria-hidden', 'false');
      btn.setAttribute('aria-expanded', 'true');
      ddOverlay.classList.add('open');
      stbLockScroll();
    }
    function closeDropdown() {
      if (!isOpen()) return;
      dropdown.classList.remove('is-open');
      dropdown.setAttribute('aria-hidden', 'true');
      btn.setAttribute('aria-expanded', 'false');
      ddOverlay.classList.remove('open');
      stbUnlockScroll();
    }
    window.closeStbInfoDropdown = closeDropdown;

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (isOpen()) closeDropdown();
      else openDropdown();
    });
    document.addEventListener('click', function (e) {
      if (isOpen() && !wrap.contains(e.target) && !dropdown.contains(e.target)) closeDropdown();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) {
        closeDropdown();
        btn.focus();
      }
    });
  } catch (err) {
    console.error('coc-help.js failed:', err);
  }
})();
