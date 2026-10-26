/* Portfolio behaviour: scene crossfade, video sync, AI-step pauses with a camera that zooms onto the highlighted area,
   step buttons in the AI panel, a tap-to-open demo mode for phones and tablets, AI-backed / AI-ready / Non-AI filter. No dependencies.
   The AI-step text lives in cues.js (generated from the same table the design file uses). */
(function () {
  var TAG = { 1: 'ready', 2: 'backed', 3: 'backed', 14: 'backed' }; // Lucy is AI-ready; SympliLyfe, Atlas and the AI Admin Dashboard are AI-backed; everything else is Non-AI
  var FEATURED = [2, 14, 3, 4, 5]; // full-screen chapters, in page order; Lucy (1) and the smaller tools sit in the More builds cards
  var NAMES = { 2: 'SympliLyfe', 14: 'AI Admin Dashboard', 3: 'Atlas', 4: 'Trackd', 5: 'Folder Reader + Diff' };
  var CUES = window.CUES || {};
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var layers = Array.prototype.slice.call(document.querySelectorAll('[data-layer]'));
  var panel = document.querySelector('.aipanel');
  var topBar = document.querySelector('.demotop'), botBar = document.querySelector('.demobar');
  var root = document.documentElement;
  var active = 0, filter = 'all', openCue = null, skip = false;
  var demoOpen = null, userPaused = false, hist = false, scrollY = 0, opener = null, tcTimer = 0;
  var seen = {}, lastT = {};

  function q(sel, root_) { return Array.prototype.slice.call((root_ || document).querySelectorAll(sel)); }
  function sceneOf(a) { var h = a.getAttribute('href') || ''; if (h === '#more') return 13; return Number(h.replace('#ch', '')); }
  function narrow() { return !!(window.matchMedia && window.matchMedia('(max-width: 1000px)').matches); }
  function focusEl(el) { if (el && el.focus) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } } }

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


  /* ---- camera: pan and zoom the demo onto the highlighted area, inside a window beside the panel ---- */
  function camOn(scene, box, again) {
    var layer = document.querySelector('[data-layer="' + scene + '"]');
    if (!layer || !panel || !box) return;
    var zone = layer.querySelector('.zone'), demo = layer.querySelector('.demo'), vid = layer.querySelector('video[data-v]');
    if (!zone || !demo || !vid) return;
    var pr = panel.getBoundingClientRect();
    if (!pr.width && !again) { setTimeout(function () { camOn(scene, box, true); }, 160); return; }
    demo.style.transition = 'none'; zone.style.transition = 'none';
    demo.style.transform = 'none';
    var z = zone.getBoundingClientRect(), v = vid.getBoundingClientRect(), d = demo.getBoundingClientRect();
    demo.style.transition = ''; zone.style.transition = '';
    var gap = 16, T = { l: z.left, t: z.top, r: z.right, b: z.bottom };
    if (pr.width && pr.height) {
      if (pr.width > z.width * 0.6) T.b = Math.max(T.t + 120, Math.min(T.b, pr.top - gap));
      else if (pr.left > z.left + z.width * 0.3) T.r = Math.max(T.l + 200, Math.min(T.r, pr.left - gap));
    }
    var bw = box[2] / 100 * v.width, bh = box[3] / 100 * v.height;
    var hx = v.left + box[0] / 100 * v.width + bw / 2, hy = v.top + box[1] / 100 * v.height + bh / 2;
    var tw = T.r - T.l, th = T.b - T.t;
    var smax = vid.videoWidth ? Math.min(3, 1.5 * vid.videoWidth / v.width) : 2;
    var sc = Math.max(0.7, Math.min(0.88 * tw / bw, 0.8 * th / bh, smax));
    var R = function (x) { return Math.round(x * 10) / 10; };
    demo.style.transformOrigin = R(hx - d.left) + 'px ' + R(hy - d.top) + 'px';
    zone.style.clipPath = 'inset(' + R(T.t - z.top) + 'px ' + R(z.right - T.r) + 'px ' + R(z.bottom - T.b) + 'px ' + R(T.l - z.left) + 'px round 10px)';
    void demo.offsetWidth;
    demo.style.transform = 'translate(' + R((T.l + T.r) / 2 - hx) + 'px,' + R((T.t + T.b) / 2 - hy) + 'px) scale(' + Math.round(sc * 1000) / 1000 + ')';
  }
  function camOff() {
    q('[data-layer] .demo').forEach(function (e) { e.style.transform = ''; });
    q('[data-layer] .zone').forEach(function (e) { e.style.clipPath = ''; });
  }

  /* ---- AI-step pause panel ---- */
  function hlStyle(b) {
    return 'position: absolute; left: ' + b[0] + '%; top: ' + b[1] + '%; width: ' + b[2] + '%; height: ' + b[3] + '%; box-sizing: border-box; border: 3px solid #F5B335; border-radius: 6px; box-shadow: 0 0 0 9999px rgba(8,12,22,0.55); pointer-events: none';
  }
  function clearHl() { q('[data-hl]').forEach(function (e) { e.style.cssText = 'display: none'; }); }
  function showBar() { if (botBar) botBar.style.display = (demoOpen != null && !openCue) ? '' : 'none'; }
  function closePanel() { openCue = null; if (panel) panel.style.display = 'none'; clearHl(); camOff(); showBar(); }
  function stepChip(n, label, onclick, current) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'ai-step'; b.textContent = String(n);
    b.setAttribute('aria-label', label);
    if (current != null) b.setAttribute('aria-current', current ? 'true' : 'false');
    b.addEventListener('click', onclick); return b;
  }
  function showPanel(scene, i) {
    var list = CUES[scene], c = list[i];
    openCue = { scene: scene, i: i };
    panel.querySelector('.ai-count').textContent = 'AI step ' + (i + 1) + ' of ' + list.length;
    panel.querySelector('.ai-title').textContent = c.title;
    panel.querySelector('.ai-what').textContent = c.what;
    var steps = panel.querySelector('.ai-steps');
    if (steps) {
      steps.innerHTML = '';
      list.forEach(function (cc, j) { steps.appendChild(stepChip(j + 1, 'Go to AI step ' + (j + 1) + ': ' + cc.title, function () { goStep(scene, j); }, j === i)); });
      steps.style.cssText = list.length > 1 ? '' : 'display: none';
    }
    var nav = panel.querySelector('.ai-nav'); if (nav) nav.style.cssText = list.length > 1 ? '' : 'display: none';
    var pb = panel.querySelector('.ai-prev'), nb = panel.querySelector('.ai-next');
    if (pb) pb.setAttribute('aria-disabled', i === 0 ? 'true' : 'false');
    if (nb) nb.setAttribute('aria-disabled', i === list.length - 1 ? 'true' : 'false');
    var flow = panel.querySelector('.ai-flow');
    if (flow) {
      flow.innerHTML = '';
      (c.flow || []).forEach(function (t, k) {
        var chip = document.createElement('span'); chip.className = 'ai-chip'; chip.textContent = t;
        chip.style.cssText = k === c.hot ? 'background: #0F1B2D; color: #FFFFFF; border: 1px solid #0F1B2D; box-shadow: 0 0 0 2px #F5B335' : 'background: #EEF2F8; color: #1F2D40; border: 1px solid rgba(15,27,45,0.22)';
        flow.appendChild(chip);
      });
      flow.style.cssText = (c.flow && c.flow.length) ? '' : 'display: none';
    }
    var how = panel.querySelector('.ai-how'); how.innerHTML = '';
    c.how.forEach(function (t) {
      var d = document.createElement('div');
      d.style.cssText = 'font-size: 14px; line-height: 1.45; padding-left: 12px; border-left: 3px solid #0F1B2D; color: #1F2D40';
      d.textContent = t; how.appendChild(d);
    });
    var body = panel.querySelector('.ai-body'); if (body) body.scrollTop = 0;
    var note = panel.querySelector('.ai-note'); note.textContent = c.note || ''; note.style.display = c.note ? '' : 'none';
    clearHl();
    var hl = document.querySelector('[data-hl="' + scene + '"]'); if (hl) hl.style.cssText = hlStyle(c.box);
    panel.style.display = '';
    showBar();
    setTimeout(function () { if (openCue && openCue.scene === scene && openCue.i === i) camOn(scene, c.box); }, 90);
    setTimeout(function () { var b = panel.querySelector('.ai-continue'); focusEl(b); }, 80);
  }
  function playScene(n) {
    if (reduced && demoOpen == null) return;
    var v = document.querySelector('video[data-v="' + n + '"]');
    if (v) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
  }
  function resume(doSkip) {
    var c = openCue; closePanel(); if (doSkip) skip = true;
    userPaused = false; renderBar();
    if (c && c.scene === active) playScene(c.scene);
  }
  /* Jump to AI step i: seek the video to that moment, mark the steps up to it as seen, open its panel and zoom. */
  function goStep(scene, i) {
    var list = CUES[scene]; if (!list || !list[i]) return;
    var v = document.querySelector('video[data-v="' + scene + '"]');
    var sn = {}; for (var j = 0; j <= i; j++) sn[j] = true;
    seen[scene] = sn; lastT[scene] = list[i].t;
    if (v) { try { v.pause(); v.currentTime = list[i].t; } catch (e) {} }
    userPaused = false;
    showPanel(scene, i);
  }
  function stepBy(d) {
    if (!openCue) return;
    var list = CUES[openCue.scene], n = openCue.i + d;
    if (list && n >= 0 && n < list.length) goStep(openCue.scene, n);
  }
  function checkCue() {
    if (skip || openCue) return;
    if (demoOpen == null && (reduced || narrow())) return; // previews on phones and tablets never interrupt reading
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
    var pbtn = panel.querySelector('.ai-prev'), nbtn = panel.querySelector('.ai-next');
    if (pbtn) pbtn.addEventListener('click', function () { stepBy(-1); });
    if (nbtn) nbtn.addEventListener('click', function () { stepBy(1); });
    closePanel();
  }
  setInterval(checkCue, 120);

  /* ---- demo mode (phones and tablets): tap a preview and the demo comes to the front ---- */
  function renderBar() {
    if (!botBar) return;
    var pl = botBar.querySelector('.demoplay'); if (pl) pl.textContent = userPaused ? 'Play' : 'Pause';
  }
  function buildBar(scene) {
    if (topBar) topBar.querySelector('.demoname').textContent = NAMES[scene] || '';
    var ds = botBar && botBar.querySelector('.demosteps'); if (!ds) return;
    q('.ai-step', ds).forEach(function (b) { b.parentNode.removeChild(b); });
    var list = CUES[scene] || [];
    list.forEach(function (c, j) { ds.appendChild(stepChip(j + 1, 'Go to AI step ' + (j + 1) + ': ' + c.title, function () { goStep(scene, j); }, null)); });
    ds.style.cssText = list.length ? '' : 'display: none';
  }
  function openDemo(scene) {
    if (!narrow() || demoOpen != null) return;
    var v = document.querySelector('video[data-v="' + scene + '"]'); if (!v) return;
    scrollY = window.pageYOffset; opener = document.activeElement;
    root.classList.add('demo-open');
    try { history.pushState({ demo: scene }, ''); hist = true; } catch (e) { hist = false; }
    seen[scene] = {}; lastT[scene] = null;
    try { v.currentTime = 0; } catch (e) {}
    camOff(); closePanel();
    demoOpen = scene; active = scene; skip = false; userPaused = !!reduced;
    if (topBar) topBar.style.display = '';
    buildBar(scene); renderBar(); showBar();
    setLayers();
    setTimeout(function () { if (demoOpen === scene) focusEl(topBar && topBar.querySelector('.demoback')); }, 120);
  }
  function endDemo() {
    clearTimeout(tcTimer);
    root.classList.remove('demo-open');
    demoOpen = null; skip = false; userPaused = false;
    closePanel();
    if (topBar) topBar.style.display = 'none';
    if (botBar) botBar.style.display = 'none';
    if (Math.abs(window.pageYOffset - scrollY) > 2) window.scrollTo(0, scrollY);
    setTimeout(function () { syncVideos(); var o = opener; opener = null; if (o && o !== document.body && document.contains(o)) focusEl(o); }, 80);
  }
  function closeDemo() {
    if (demoOpen == null) return;
    if (hist) {
      try { history.back(); } catch (e) { hist = false; }
      if (hist) { clearTimeout(tcTimer); tcTimer = setTimeout(function () { if (demoOpen != null) { hist = false; endDemo(); } }, 400); return; }
    }
    endDemo();
  }
  function togglePlay() {
    var a = demoOpen != null ? demoOpen : active;
    var v = document.querySelector('video[data-v="' + a + '"]'); if (!v) return;
    if (v.paused) { var p = v.play(); if (p && p.catch) p.catch(function () {}); userPaused = false; }
    else { v.pause(); userPaused = true; }
    renderBar();
  }
  function tapPreview(e) {
    if (!narrow() || demoOpen != null) return;
    var t = e.target;
    if (t && t.closest && t.closest('a,button,summary,input,select,textarea,label,[data-card],.aipanel,.topbar,.filterbar')) return;
    var layer = document.querySelector('[data-layer="' + active + '"]');
    var demo = layer && layer.querySelector('.demo');
    if (!demo || !layer.querySelector('video[data-v]')) return;
    var r = demo.getBoundingClientRect();
    if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) openDemo(active);
  }
  var tap = null;
  document.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    tap = { x: e.clientX, y: e.clientY, t: Date.now(), sy: window.pageYOffset };
  }, true);
  document.addEventListener('pointercancel', function () { tap = null; }, true);
  document.addEventListener('pointerup', function (e) {
    var s0 = tap; tap = null; if (!s0) return;
    if (Math.abs(e.clientX - s0.x) > 10 || Math.abs(e.clientY - s0.y) > 10 || Date.now() - s0.t > 700 || Math.abs(window.pageYOffset - s0.sy) > 2) return;
    tapPreview(e);
  }, true);
  q('.demoopen').forEach(function (b) {
    b.addEventListener('click', function () { var s = b.closest('[data-scene]'); if (s) openDemo(Number(s.getAttribute('data-scene'))); });
  });
  if (topBar) topBar.querySelector('.demoback').addEventListener('click', closeDemo);
  if (botBar) botBar.querySelector('.demoplay').addEventListener('click', togglePlay);
  window.addEventListener('popstate', function () { if (demoOpen != null) { hist = false; endDemo(); } });
  window.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (openCue) resume(false); else if (demoOpen != null) closeDemo();
  });

  /* ---- which scene is on screen ---- */
  function visible(el) {
    if (!el || getComputedStyle(el).display === 'none') return 0;
    var t = el.querySelector('[data-card]') || el, r = t.getBoundingClientRect(), vh = window.innerHeight;
    return Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
  }
  var raf = 0;
  function pick() {
    raf = 0; if (demoOpen != null) return;
    var best = 0, bn = -1, cur = 0;
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
    var fallback = any ? '#more' : '#ch12';
    if (start) start.setAttribute('href', first ? '#' + first.id : fallback);
    if (active !== 0) { var target = first || document.querySelector(fallback); if (target) target.scrollIntoView({ block: 'start' }); }
    setTimeout(pick, 60);
  }
  q('button').forEach(function (b) {
    var t = (b.textContent || '').trim();
    var key = /^All/.test(t) ? 'all' : /^AI-backed/.test(t) ? 'ai' : /^AI-ready/.test(t) ? 'ready' : /^Non-AI/.test(t) ? 'plain' : null;
    if (key) { b.setAttribute('data-filter', key); b.addEventListener('click', function () { setFilter(key); }); }
  });
  window.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', onScroll);
  var rsTimer = 0;
  window.addEventListener('resize', function () {
    if (demoOpen != null && !narrow()) { closeDemo(); return; }
    if (!openCue) return;
    clearTimeout(rsTimer);
    rsTimer = setTimeout(function () { if (openCue) camOn(openCue.scene, CUES[openCue.scene][openCue.i].box); }, 150);
  });
  setInterval(pick, 500);
  setLayers(); setTimeout(pick, 300);
})();
