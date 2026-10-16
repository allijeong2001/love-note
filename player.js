/* =====================================================
 * player.js · 一起听（照搬学习小手机那一版 + 跨页不断）
 * 三种运行方式：
 *   1. 壳层 index.html（body.ln-shell）：这里是唯一的 audio，切页面不重载，音乐永不断
 *   2. 壳层里的页面：通过 postMessage 指挥壳层播放
 *   3. 单独打开某个页面：自己在页面里放，切页面时按上次进度续播
 * 音频文件存在 IndexedDB，进度 / 音量存在 localStorage
 * ===================================================== */
(function () {
  'use strict';

  var cfg = (window.LN && LN.cfg) ? LN.cfg() : (window.SITE_CONFIG || {});
  var mc = cfg.music || {};

  var isShell = !!(document.body && document.body.classList && document.body.classList.contains('ln-shell'));
  var hosted = false;
  try { hosted = (window.name === 'lnview') && window.parent !== window; } catch (e) {}

  var LS_KEY = 'dz_player_state';
  var SS_KEY = 'dz_player_session';
  var FOLD_KEY = 'dz_player_folded';
  var FAB_POS_KEY = 'dz_player_fab_pos';

  function hisName() { return mc.partnerName || (cfg.chat && cfg.chat.partnerName) || '他'; }

  /* =====================================================
   * 一、壳层里的桥（页面用）：只发指令 + 收状态
   * ===================================================== */
  function createBridge() {
    var st = { name: '', playing: false, time: 0, duration: 0, volume: 0.9 };
    var cbs = [];

    window.addEventListener('message', function (e) {
      var d = e.data;
      if (!d || d.type !== 'ln:state') return;
      st = {
        name: d.name || '',
        playing: !!d.playing,
        time: d.time || 0,
        duration: d.duration || 0,
        volume: (typeof d.volume === 'number') ? d.volume : 0.9
      };
      cbs.forEach(function (f) { try { f(); } catch (err) {} });
    });

    function send(msg) {
      try { window.parent.postMessage(msg, '*'); } catch (e) {}
    }
    send({ type: 'ln:hello' });

    var fake = {
      get currentTime() { return st.time; },
      get duration() { return st.duration; },
      get paused() { return !st.playing; },
      get volume() { return st.volume; },
      get ended() { return false; }
    };

    return {
      audio: fake,
      bridge: true,
      setTrack: function (name, file) { send({ type: 'ln:file', name: name, file: file }); },
      play: function () { send({ type: 'ln:play' }); },
      pause: function () { send({ type: 'ln:pause' }); },
      toggle: function () { send({ type: 'ln:toggle' }); },
      seek: function (t) { send({ type: 'ln:seek', t: t }); },
      setVolume: function (v) { send({ type: 'ln:volume', v: v }); },
      hasTrack: function () { return !!st.name; },
      getName: function () { return st.name; },
      onChange: function (f) { cbs.push(f); },
      hisName: hisName, cfg: mc
    };
  }

  /* =====================================================
   * 二、真正的播放器（壳层 / 单独打开页面时用）
   * ===================================================== */
  function createLocal() {
    var inSession = false;
    try { inSession = sessionStorage.getItem(SS_KEY) === '1'; } catch (e) {}

    var state = inSession ? loadState() : {};
    var audio = new Audio();
    audio.preload = 'auto';
    audio.volume = typeof state.volume === 'number' ? state.volume : 0.9;

    var objUrl = null;
    var trackName = inSession ? (state.name || '') : '';
    var listeners = [];
    var pendingSeek = (inSession && typeof state.time === 'number') ? state.time : 0;

    function loadState() {
      try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; }
      catch (e) { return {}; }
    }
    function saveState() {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({
          name: trackName,
          playing: !audio.paused && !audio.ended,
          time: audio.currentTime || 0,
          volume: audio.volume
        }));
      } catch (e) {}
    }

    /* ---------- IndexedDB（存音频文件） ---------- */
    function openDB() {
      return new Promise(function (resolve, reject) {
        var req = indexedDB.open('dz_player_db', 1);
        req.onupgradeneeded = function () { req.result.createObjectStore('files'); };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
      });
    }
    function idbOp(mode, fn) {
      return openDB().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction('files', mode);
          var req = fn(tx.objectStore('files'));
          tx.oncomplete = function () { resolve(req ? req.result : undefined); };
          tx.onerror = function () { reject(tx.error); };
        });
      });
    }
    function idbGet(key) { return idbOp('readonly', function (s) { return s.get(key); }); }
    function idbSet(key, val) { return idbOp('readwrite', function (s) { return s.put(val, key); }); }

    audio.addEventListener('timeupdate', function () { saveState(); notify(); });
    audio.addEventListener('play', function () { saveState(); notify(); });
    audio.addEventListener('pause', function () { saveState(); notify(); });
    audio.addEventListener('ended', function () { saveState(); notify(); });
    audio.addEventListener('loadedmetadata', function () {
      if (pendingSeek >= 0) {
        try { audio.currentTime = pendingSeek; } catch (e) {}
        pendingSeek = -1;
      }
    });
    window.addEventListener('pagehide', saveState);
    document.addEventListener('visibilitychange', function () { if (document.hidden) saveState(); });

    function notify() { listeners.forEach(function (f) { try { f(); } catch (e) {} }); }

    function setTrack(name, blob) {
      trackName = name;
      try { sessionStorage.setItem(SS_KEY, '1'); } catch (e) {}
      if (objUrl) { URL.revokeObjectURL(objUrl); objUrl = null; }
      objUrl = URL.createObjectURL(blob);
      audio.src = objUrl;
      pendingSeek = -1;
      idbSet('current_audio', blob).catch(function () {});
      saveState();
      play();
      notify();
    }
    function play() {
      var p = audio.play();
      if (p && p.catch) p.catch(function () { saveState(); notify(); });
    }
    function pause() { audio.pause(); }
    function toggle() { if (!audio.src) return; if (audio.paused) play(); else pause(); }
    function seek(t) {
      if (!audio.src) return;
      t = Math.max(0, Number(t) || 0);
      var dur = (audio.duration && isFinite(audio.duration)) ? audio.duration : 0;
      if (dur) {
        try { audio.currentTime = Math.min(t, dur); } catch (e) {}
      } else {
        /* 音频还没加载好，先记下来，loadedmetadata 时再跳 */
        pendingSeek = t;
      }
      saveState();
      notify();
    }
    function setVolume(v) {
      audio.volume = Math.max(0, Math.min(1, v));
      saveState();
      notify();
    }

    var api = {
      audio: audio,
      bridge: false,
      setTrack: setTrack, play: play, pause: pause, toggle: toggle, seek: seek,
      setVolume: setVolume,
      hasTrack: function () { return !!trackName; },
      getName: function () { return trackName; },
      onChange: function (f) { listeners.push(f); },
      notify: notify,
      hisName: hisName, cfg: mc
    };

    /* 恢复上次的曲目 */
    if (trackName) {
      idbGet('current_audio').then(function (blob) {
        if (!blob) { trackName = ''; saveState(); notify(); return; }
        objUrl = URL.createObjectURL(blob);
        audio.src = objUrl;
        if (pendingSeek > 0) {
          try { audio.currentTime = pendingSeek; } catch (e) {}
        }
        if (state.playing) play();
        notify();
      }).catch(function () {});
    }
    return api;
  }

  /* =====================================================
   * 三、迷你播放条（壳层或单独页面）
   * ===================================================== */
  function setupMini(P) {
    var folded = false;
    try { folded = localStorage.getItem(FOLD_KEY) === '1'; } catch (e) {}
    var miniEl = null, miniFab = null;

    function loadFabPos() {
      try { return JSON.parse(localStorage.getItem(FAB_POS_KEY)) || null; }
      catch (e) { return null; }
    }
    function saveFabPos(x, y) {
      try { localStorage.setItem(FAB_POS_KEY, JSON.stringify({ x: x, y: y })); } catch (e) {}
    }
    function applyFabPos(x, y) {
      if (!miniFab) return;
      var w = miniFab.offsetWidth || 44, h = miniFab.offsetHeight || 44;
      x = Math.max(0, Math.min(x, window.innerWidth - w));
      y = Math.max(0, Math.min(y, window.innerHeight - h));
      miniFab.style.left = x + 'px';
      miniFab.style.top = y + 'px';
      miniFab.style.right = 'auto';
      miniFab.style.bottom = 'auto';
    }
    function setFolded(v) {
      folded = v;
      try { localStorage.setItem(FOLD_KEY, v ? '1' : '0'); } catch (e) {}
      renderMini();
    }

    function view() { return document.getElementById('lnview'); }
    function gotoMusic() {
      if (isShell && view()) view().src = 'music.html';
      else location.href = 'music.html';
    }

    function build() {
      if (miniEl) return;
      var el = document.createElement('div');
      el.className = 'mini-player';
      el.style.display = 'none';
      el.innerHTML =
        '<span class="mp-cover">' + (mc.discCandy || '🐤') + '</span>' +
        '<div class="mp-info">' +
          '<div class="mp-name"></div>' +
          '<div class="mp-state">和' + hisName() + '一起听中 ♪</div>' +
        '</div>' +
        '<button class="mp-btn" type="button">▶</button>' +
        '<button class="mp-fold" type="button" title="收成小爱心">♥</button>' +
        '<div class="mp-prog"><i></i></div>';
      document.body.appendChild(el);
      el.querySelector('.mp-btn').addEventListener('click', function (e) { e.stopPropagation(); P.toggle(); });
      el.querySelector('.mp-info').addEventListener('click', gotoMusic);
      el.querySelector('.mp-fold').addEventListener('click', function (e) { e.stopPropagation(); setFolded(true); });
      miniEl = el;

      var fab = document.createElement('button');
      fab.type = 'button';
      fab.className = 'mini-player-fab';
      fab.title = '点一下展开，按住可拖动位置';
      fab.style.display = 'none';
      document.body.appendChild(fab);
      miniFab = fab;

      var savedPos = loadFabPos();
      if (savedPos && typeof savedPos.x === 'number') applyFabPos(savedPos.x, savedPos.y);
      window.addEventListener('resize', function () {
        var p = loadFabPos();
        if (p && typeof p.x === 'number') applyFabPos(p.x, p.y);
      });

      var drag = null;
      fab.addEventListener('pointerdown', function (e) {
        if (e.button != null && e.button !== 0) return;
        var r = fab.getBoundingClientRect();
        drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, moved: false };
        try { fab.setPointerCapture(e.pointerId); } catch (err) {}
        e.preventDefault();
      });
      fab.addEventListener('pointermove', function (e) {
        if (!drag || e.pointerId !== drag.id) return;
        var dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
        if (!drag.moved && Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        drag.moved = true;
        fab.classList.add('dragging');
        applyFabPos(drag.ox + dx, drag.oy + dy);
      });
      function endDrag(e) {
        if (!drag || (e && e.pointerId !== drag.id)) return;
        if (drag.moved) {
          var r = fab.getBoundingClientRect();
          saveFabPos(r.left, r.top);
          fab.addEventListener('click', function swallow(ev) {
            ev.stopPropagation(); ev.preventDefault();
            fab.removeEventListener('click', swallow);
          }, { capture: true });
        }
        fab.classList.remove('dragging');
        drag = null;
      }
      fab.addEventListener('pointerup', endDrag);
      fab.addEventListener('pointercancel', endDrag);
      fab.addEventListener('click', function () { setFolded(false); });
    }

    function renderMini() {
      if (!miniEl) return;
      if (!P.hasTrack()) {
        miniEl.style.display = 'none';
        if (miniFab) miniFab.style.display = 'none';
        return;
      }
      miniEl.style.display = folded ? 'none' : 'flex';
      if (miniFab) {
        miniFab.style.display = folded ? 'flex' : 'none';
        miniFab.textContent = P.audio.paused ? '♡' : '♥';
        miniFab.classList.toggle('playing', !P.audio.paused);
      }
      miniEl.querySelector('.mp-name').textContent = P.getName();
      miniEl.querySelector('.mp-btn').textContent = P.audio.paused ? '▶' : '⏸';
      miniEl.classList.toggle('playing', !P.audio.paused);
      var dur = P.audio.duration || 0;
      var pct = dur ? (P.audio.currentTime / dur) * 100 : 0;
      miniEl.querySelector('.mp-prog i').style.width = pct + '%';
    }
    P.onChange(renderMini);

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { build(); renderMini(); });
    } else {
      build(); renderMini();
    }
  }

  /* =====================================================
   * 启动
   * ===================================================== */
  if (hosted) {
    window.LNPlayer = createBridge();
    return;
  }

  var P = createLocal();

  if (isShell) {
    /* 壳层：收页面的指令 + 把状态广播回去 */
    var viewEl = document.getElementById('lnview');
    function broadcast() {
      if (!viewEl || !viewEl.contentWindow) return;
      try {
        viewEl.contentWindow.postMessage({
          type: 'ln:state',
          name: P.getName(),
          playing: !P.audio.paused,
          time: P.audio.currentTime || 0,
          duration: P.audio.duration || 0,
          volume: P.audio.volume
        }, '*');
      } catch (e) {}
    }
    P.onChange(broadcast);
    setInterval(broadcast, 500);

    window.addEventListener('message', function (e) {
      var d = e.data;
      if (!d || typeof d !== 'object') return;
      switch (d.type) {
        case 'ln:hello': broadcast(); break;
        case 'ln:file':
          if (d.file) P.setTrack(d.name || '音频', d.file);
          broadcast();
          break;
        case 'ln:play': P.play(); break;
        case 'ln:pause': P.pause(); break;
        case 'ln:toggle': P.toggle(); break;
        case 'ln:seek': P.seek(d.t); break;
        case 'ln:volume': P.setVolume(d.v); break;
        case 'ln:bar':
          document.body.classList.remove('has-inputbar', 'has-actionbar');
          if (d.kind) document.body.classList.add('has-' + d.kind);
          break;
        case 'ln:goto':
          if (viewEl && d.url) viewEl.src = d.url;
          break;
      }
    });
  } else {
    /* 单独打开页面：有底部栏就把迷你条抬上去 */
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        if (document.querySelector('.chat-input-bar')) document.body.classList.add('has-inputbar');
        if (document.querySelector('.moments-bar')) document.body.classList.add('has-actionbar');
      });
    } else {
      if (document.querySelector('.chat-input-bar')) document.body.classList.add('has-inputbar');
      if (document.querySelector('.moments-bar')) document.body.classList.add('has-actionbar');
    }
  }

  setupMini(P);
  window.LNPlayer = P;
})();
