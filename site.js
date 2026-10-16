/* Portfolio behaviour: scene crossfade, video sync, AI / Non-AI filter. No dependencies. */
(function () {
  var AI = { 1: true, 2: true, 4: true }; // Lucy, SympliLyfe, Trackd are AI-backed
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var layersEl = document.getElementById('layers');
  var layers = layersEl ? Array.prototype.slice.call(layersEl.children) : [];
  var layerIndex = [0, 9, 1, 2, 3, 4, 5, 6, 7, 8]; // DOM order of the background layers
  var sections = [];
  for (var i = 0; i <= 9; i++) { var el = document.getElementById('ch' + i); if (el) sections[i] = el; }
  var active = 0, filter = 'all';

  function setLayers() {
    layers.forEach(function (l, k) { l.style.opacity = layerIndex[k] === active ? '1' : '0'; });
    var dotSpans = document.querySelectorAll('.dots a span');
    Array.prototype.forEach.call(dotSpans, function (s) {
      var n = Number(s.parentNode.getAttribute('href').replace('#ch', ''));
      var on = n === active;
      s.style.width = s.style.height = on ? '14px' : '10px';
      s.style.background = on ? '#F5B335' : 'rgba(255,255,255,0.9)';
    });
    syncVideos();
  }
  function syncVideos() {
    Array.prototype.forEach.call(document.querySelectorAll('video[data-v]'), function (v) {
      var on = Number(v.getAttribute('data-v')) === active;
      v.muted = true;
      if (on && !reduced) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } else { v.pause(); }
    });
  }
  function visible(n) {
    var s = sections[n]; if (!s || s.style.display === 'none') return 0;
    var t = s.querySelector('[data-card]') || s, r = t.getBoundingClientRect(), vh = window.innerHeight;
    return Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
  }
  var raf = 0;
  function pick() {
    raf = 0; var best = 0, bn = -1, cur = visible(active);
    for (var n = 0; n <= 9; n++) { var v = visible(n); if (v > best) { best = v; bn = n; } }
    if (bn >= 0 && bn !== active && best > cur + 24) { active = bn; setLayers(); }
  }
  function onScroll() { if (!raf) raf = requestAnimationFrame(pick); }

  function setFilter(key) {
    filter = key;
    for (var n = 1; n <= 7; n++) {
      var show = key === 'all' || (key === 'ai' ? !!AI[n] : !AI[n]);
      if (sections[n]) sections[n].style.display = show ? '' : 'none';
      var a = document.querySelector('.dots a[href="#ch' + n + '"]'); if (a) a.style.display = show ? '' : 'none';
    }
    Array.prototype.forEach.call(document.querySelectorAll('button[data-filter]'), function (b) {
      var on = b.getAttribute('data-filter') === key;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.style.background = on ? '#0F1B2D' : 'rgba(255,255,255,0.85)';
      b.style.color = on ? '#FFFFFF' : '#0F1B2D';
    });
    var first = null; for (var m = 1; m <= 7; m++) if (sections[m] && sections[m].style.display !== 'none') { first = sections[m]; break; }
    var start = document.querySelector('a[href^="#ch"][style*="background: rgb(15, 27, 45)"]');
    if (start && first) start.setAttribute('href', '#' + first.id);
    if (active !== 0 && first) first.scrollIntoView({ block: 'start' });
    setTimeout(pick, 60);
  }

  Array.prototype.forEach.call(document.querySelectorAll('button'), function (b) {
    var t = (b.textContent || '').trim();
    var key = /^All/.test(t) ? 'all' : /^AI-backed/.test(t) ? 'ai' : /^Non-AI/.test(t) ? 'plain' : null;
    if (key) { b.setAttribute('data-filter', key); b.addEventListener('click', function () { setFilter(key); }); }
  });
  window.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', onScroll);
  setInterval(pick, 500);
  setLayers(); setTimeout(pick, 300);
})();
