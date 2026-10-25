/* Portfolio behaviour: scene crossfade, video sync, AI-step pauses, AI-backed / AI-ready / Non-AI filter. No dependencies.
   The AI-step text lives in cues.js (generated from the same table the design file uses). */
(function () {
  var TAG = { 1: 'ready', 2: 'backed', 3: 'backed', 14: 'backed' }; // Lucy is AI-ready; SympliLyfe, Atlas and the AI Admin Dashboard are AI-backed; everything else is Non-AI
  var FEATURED = [2, 14, 3, 1, 4, 6]; // full-screen chapters, in page order
  var CUES = window.CUES || {};
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var layers = Array.prototype.slice.call(document.querySelectorAll('[data-layer]'));
  var panel = document.querySelector('.aipanel');
  var active = 0, filter = 'all', openCue = null, skip = false;
  var seen = {}, lastT = {};

  function q(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function sceneOf(a) { var h = a.getAttribute('href') || ''; if (h === '#more') return 13; return Number(h.replace('#ch', '')); }

  function setLayers() {
    layers.forEach(function (l) { l.style.opacity = Number(l.getAttribute('data-layer')) === active ? '1' : '0'; });
    q('.dots a').forEach(function (a) {
      var s = a.querySelector('span'); var on = sceneOf(a) === active;
      s.style.width = s.style.height = on ? '14px' : '10px';
      s.style.background = on ? '#F5B335' : 'rgba(255,255,255,0.9)';
    });
    syncVideos();
  }
  function syncVideos() {
    q('video[data-v]').forEach(function (v) {
      var n = Number(v.getAttribute('data-v')), on = n === active;
      v.muted = true;
      if (on && !reduced) {
        if (openCue) return;
        var p = v.play(); if (p && p.catch) p.catch(function () {});
      } else {
        v.pause();
        if (!on && CUES[n]) { try { v.currentTime = 0; } catch (e) {} seen[n] = {}; }
      }
    });
  }

  /* ---- AI-step pause panel ---- */
  function hlStyle(b) {
    return 'position: absolute; left: ' + b[0] + '%; top: ' + b[1] + '%; width: ' + b[2] + '%; height: ' + b[3] + '%; box-sizing: border-box; border: 3px solid #F5B335; border-radius: 6px; box-shadow: 0 0 0 9999px rgba(8,12,22,0.55); pointer-events: none';
  }
  function clearHl() { q('[data-hl]').forEach(function (e) { e.style.cssText = 'display: none'; }); }
  function closePanel() { openCue = null; if (panel) panel.style.display = 'none'; clearHl(); }
  function showPanel(scene, i) {
    var list = CUES[scene], c = list[i];
    openCue = { scene: scene, i: i };
    panel.querySelector('.ai-count').textContent = 'AI step ' + (i + 1) + ' of ' + list.length;
    panel.querySelector('.ai-title').textContent = c.title;
    panel.querySelector('.ai-what').textContent = c.what;
    var how = panel.querySelector('.ai-how'); how.innerHTML = '';
    c.how.forEach(function (t) {
      var d = document.createElement('div');
      d.style.cssText = 'font-size: 14px; line-height: 1.45; padding-left: 12px; border-left: 3px solid #0F1B2D; color: #1F2D40';
      d.textContent = t; how.appendChild(d);
    });
    var note = panel.querySelector('.ai-note'); note.textContent = c.note || ''; note.style.display = c.note ? '' : 'none';
    clearHl();
    var hl = document.querySelector('[data-hl="' + scene + '"]'); if (hl) hl.style.cssText = hlStyle(c.box);
    panel.style.display = '';
    setTimeout(function () { var b = panel.querySelector('.ai-continue'); if (b && b.focus) { try { b.focus({ preventScroll: true }); } catch (e) { b.focus(); } } }, 80);
  }
  function playScene(n) {
    if (reduced) return;
    var v = document.querySelector('video[data-v="' + n + '"]');
    if (v) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
  }
  function resume(doSkip) {
    var c = openCue; closePanel(); if (doSkip) skip = true;
    if (c && c.scene === active) playScene(c.scene);
  }
  function checkCue() {
    if (reduced || skip || openCue) return;
    var list = CUES[active]; if (!list) return;
    var v = document.querySelector('video[data-v="' + active + '"]');
    if (!v || v.paused || v.seeking) return;
    var t = v.currentTime;
    if (lastT[active] != null && t < lastT[active] - 0.5) seen[active] = {};
    lastT[active] = t;
    var s = seen[active] || (seen[active] = {});
    for (var i = 0; i < list.length; i++) {
      if (!s[i] && t >= list[i].t && t < list[i].t + 1.5) { s[i] = true; v.pause(); showPanel(active, i); return; }
    }
  }
  if (panel) {
    panel.querySelector('.ai-continue').addEventListener('click', function () { resume(false); });
    panel.querySelector('.ai-skip').addEventListener('click', function () { resume(true); });
    closePanel();
  }
  window.addEventListener('keydown', function (e) { if (e.key === 'Escape' && openCue) resume(false); });
  setInterval(checkCue, 120);

  /* ---- which scene is on screen ---- */
  function visible(el) {
    if (!el || getComputedStyle(el).display === 'none') return 0;
    var t = el.querySelector('[data-card]') || el, r = t.getBoundingClientRect(), vh = window.innerHeight;
    return Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
  }
  var raf = 0;
  function pick() {
    raf = 0; var best = 0, bn = -1, cur = 0;
    q('[data-scene]').forEach(function (el) {
      var n = Number(el.getAttribute('data-scene')); if (isNaN(n)) return;
      var v = visible(el); if (n === active) cur = Math.max(cur, v); if (v > best) { best = v; bn = n; }
    });
    if (bn >= 0 && bn !== active && best > cur + 24) { active = bn; closePanel(); skip = false; setLayers(); }
  }
  function onScroll() { if (!raf) raf = requestAnimationFrame(pick); }

  /* ---- filter ---- */
  function setFilter(key) {
    filter = key;
    function show(n) { return key === 'all' || (key === 'ai' ? TAG[n] === 'backed' : key === 'ready' ? TAG[n] === 'ready' : !TAG[n]); }
    FEATURED.forEach(function (n) {
      var sec = document.getElementById('ch' + n); if (sec) sec.style.display = show(n) ? '' : 'none';
      var a = document.querySelector('.dots a[href="#ch' + n + '"]'); if (a) a.style.display = show(n) ? '' : 'none';
    });
    var any = 0;
    q('.gcard').forEach(function (c) { var on = show(Number(c.getAttribute('data-idx'))); c.style.display = on ? '' : 'none'; if (on) any++; });
    var more = document.getElementById('more'); if (more) more.style.display = any ? '' : 'none';
    var md = document.querySelector('.dots a[href="#more"]'); if (md) md.style.display = any ? '' : 'none';
    q('button[data-filter]').forEach(function (b) {
      var on = b.getAttribute('data-filter') === key;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.style.background = on ? '#0F1B2D' : 'rgba(255,255,255,0.85)';
      b.style.color = on ? '#FFFFFF' : '#0F1B2D';
    });
    var first = null;
    for (var m = 0; m < FEATURED.length; m++) { var s = document.getElementById('ch' + FEATURED[m]); if (s && s.style.display !== 'none') { first = s; break; } }
    var start = document.querySelector('a[data-start]');
    if (start) start.setAttribute('href', first ? '#' + first.id : '#ch12');
    if (active !== 0) { var target = first || document.getElementById('ch12'); if (target) target.scrollIntoView({ block: 'start' }); }
    setTimeout(pick, 60);
  }
  q('button').forEach(function (b) {
    var t = (b.textContent || '').trim();
    var key = /^All/.test(t) ? 'all' : /^AI-backed/.test(t) ? 'ai' : /^AI-ready/.test(t) ? 'ready' : /^Non-AI/.test(t) ? 'plain' : null;
    if (key) { b.setAttribute('data-filter', key); b.addEventListener('click', function () { setFilter(key); }); }
  });
  window.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', onScroll);
  setInterval(pick, 500);
  setLayers(); setTimeout(pick, 300);
})();
