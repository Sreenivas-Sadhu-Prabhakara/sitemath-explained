/* sitemath explained — page logic.
   No network calls (the CSP forbids them anyway). localStorage holds only the
   theme choice. The numbers shown on the page are re-derived by data/facts.js
   (loaded before this file) and proved by test/facts.test.js. */
'use strict';

(function () {
  var root = document.documentElement;
  root.classList.add('js');

  /* ---------- theme toggle ---------- */
  var THEME_KEY = 'sitemath-explained.theme';
  var toggle = document.getElementById('theme-toggle');

  function systemPrefersDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function effectiveTheme() {
    var t = root.getAttribute('data-theme');
    if (t === 'dark' || t === 'light') return t;
    return systemPrefersDark() ? 'dark' : 'light';
  }
  function applyTheme(t) {
    if (t === 'dark' || t === 'light') {
      root.setAttribute('data-theme', t);
    } else {
      root.removeAttribute('data-theme');
    }
    if (toggle) toggle.setAttribute('aria-pressed', String(effectiveTheme() === 'dark'));
  }
  try {
    applyTheme(localStorage.getItem(THEME_KEY));
  } catch (e) { /* storage may be unavailable; theme stays on system preference */ }

  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = effectiveTheme() === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* non-fatal */ }
    });
  }

  /* ---------- build the tile grid (Scene 4): 36 cells, last one is the spare ----------
     Data-driven from Facts so the drawing matches the proved numbers: 35 laid + 1 spare. */
  var grid = document.querySelector('.tile-grid');
  if (grid) {
    var facts = (typeof Facts !== 'undefined') ? Facts.FACTS : null;
    var laid = facts ? facts.tileCount : 35;                 // 35
    var spare = facts ? facts.tileBoxes.spare : 1;           // 1
    var total = laid + spare;                                // 36 (= 9 boxes × 4)
    for (var i = 0; i < total; i++) {
      var cell = document.createElement('span');
      cell.className = 'tile-cell' + (i >= laid ? ' spare' : '');
      grid.appendChild(cell);
    }
  }

  /* ---------- scroll-triggered scene animations ---------- */
  var animated = Array.prototype.slice.call(document.querySelectorAll('.anim, .feature-grid, .cite-grid'));
  var io = null;
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.25 });
    animated.forEach(function (el) { io.observe(el); });
  } else {
    animated.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- replay buttons: re-run a scene's entrance animation ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('.replay'), function (btn) {
    btn.addEventListener('click', function () {
      var scene = btn.closest('.scene');
      if (!scene) return;
      scene.classList.remove('in');
      if (io) io.unobserve(scene);
      // force reflow so removing/re-adding .in restarts the CSS animations
      void scene.offsetWidth;
      requestAnimationFrame(function () {
        scene.classList.add('in');
        if (io) io.observe(scene);
      });
    });
  });
})();
