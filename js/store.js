/* =====================================================
 * store.js · 公共库
 * 本地存储 / 北京时间 / 字卡库 / 频率设置 / 小鸟装饰
 * 所有数据都保存在手机本地（localStorage），退出重进不会丢
 * ===================================================== */
(function () {
  'use strict';

  /* ---------------- 存储键 ---------------- */
  var KEYS = {
    settings:        'dz.settings',
    cardsChat:       'dz.cards.chat',
    cardsMoments:    'dz.cards.moments',
    cardsLetter:     'dz.cards.letter',
    chatLog:         'dz.chat.log',
    moments:         'dz.moments',
    momentSchedule:  'dz.moments.schedule',
    letters:         'dz.letters',
    letterSchedule:  'dz.letter.schedule',
    letterPending:   'dz.letter.pending',
    letterSeen:      'dz.letter.seen',
    playlist:        'dz.music.playlist',
    avatars:         'dz.avatars',
    momentsCover:    'dz.moments.cover',
    timerPref:       'dz.timer.pref'
  };

  /* config.js 里可能是 const / let 声明，不一定挂在 window 上，这里做兜底 */
  function cfg() {
    if (window.SITE_CONFIG) return window.SITE_CONFIG;
    try {
      if (typeof SITE_CONFIG !== 'undefined' && SITE_CONFIG) return SITE_CONFIG;
    } catch (e) {}
    return {};
  }

  /* 三个互相独立的字卡库 */
  var CARD_LIBS = {
    chat: {
      key: KEYS.cardsChat,
      name: '聊天字卡库',
      hint: '他聊天时会随机抽一张来回你'
    },
    moments: {
      key: KEYS.cardsMoments,
      name: '朋友圈字卡库',
      hint: '他发朋友圈、回评论时从这里抽'
    },
    letter: {
      key: KEYS.cardsLetter,
      name: '写信字卡库',
      hint: '他给你回信、主动写信时从这里抽'
    }
  };

  /* ---------------- 小工具 ---------------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function $(sel, p) { return (p || document).querySelector(sel); }
  function $$(sel, p) { return Array.prototype.slice.call((p || document).querySelectorAll(sel)); }
  function randInt(min, max) {
    min = Number(min) || 0; max = Number(max) || 0;
    if (max < min) { var t = min; min = max; max = t; }
    return min + Math.floor(Math.random() * (max - min + 1));
  }
  function read(k, def) {
    try {
      var v = localStorage.getItem(k);
      return v === null || v === undefined ? def : JSON.parse(v);
    } catch (e) { return def; }
  }
  function write(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch (e) { return false; }
  }
  function del(k) { try { localStorage.removeItem(k); } catch (e) {} }

  /* ---------------- 北京时间 ---------------- */
  var BJ = 8 * 3600000;                       // UTC+8
  function bjMs(ts) {                         // 当前时刻对应的"北京时间毫秒"
    var base = (ts == null) ? Date.now() : ts;
    return base + new Date(base).getTimezoneOffset() * 60000 + BJ;
  }
  function bjParts(ts) {                      // 北京时间拆分
    var d = new Date(bjMs(ts));
    return {
      y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(),
      h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds(),
      w: d.getUTCDay()
    };
  }
  function bjToTs(y, m, d, h, mi) {           // 北京时间 -> 时间戳
    return Date.UTC(y, m - 1, d, h || 0, mi || 0, 0) - BJ;
  }
  function bjDateKey(ts) {
    var p = bjParts(ts);
    return p.y + '-' + (p.m < 10 ? '0' : '') + p.m + '-' + (p.d < 10 ? '0' : '') + p.d;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtBJ(ts) {                        // MM-DD HH:mm
    var p = bjParts(ts);
    return pad(p.m) + '-' + pad(p.d) + ' ' + pad(p.h) + ':' + pad(p.mi);
  }
  function fmtBJFull(ts) {                    // YYYY年M月D日 HH:mm
    var p = bjParts(ts);
    return p.y + ' 年 ' + p.m + ' 月 ' + p.d + ' 日 ' + pad(p.h) + ':' + pad(p.mi);
  }
  function fmtBJDate(ts) {                    // YYYY年M月D日
    var p = bjParts(ts);
    return p.y + ' 年 ' + p.m + ' 月 ' + p.d + ' 日';
  }
  function timeAgoBJ(ts) {
    var diff = Date.now() - ts;
    if (diff < 60e3) return '刚刚';
    if (diff < 3600e3) return Math.floor(diff / 60e3) + ' 分钟前';
    var p = bjParts(ts), n = bjParts();
    if (diff < 86400e3 && p.d === n.d) return pad(p.h) + ':' + pad(p.mi);
    if (diff < 2 * 86400e3) return '昨天 ' + pad(p.h) + ':' + pad(p.mi);
    return fmtBJ(ts);
  }

  /* ---------------- 设置 ---------------- */
  function defaultSettings() {
    var s = cfg().settings || {};
    return {
      momentPerDayMin:       num(s.momentPerDayMin, 1),
      momentPerDayMax:       num(s.momentPerDayMax, 3),
      momentFromHour:        num(s.momentFromHour, 9),
      momentToHour:          num(s.momentToHour, 23),
      momentCommentDelayMin: num(s.momentCommentDelayMin, 20),
      momentCommentDelayMax: num(s.momentCommentDelayMax, 90),
      letterReplyMinMin:     num(s.letterReplyMinMin, 10),
      letterReplyMaxMin:     num(s.letterReplyMaxMin, 60),
      letterActiveEnabled:   s.letterActiveEnabled !== false,
      letterActiveChance:    num(s.letterActiveChance, 60),
      letterActiveFromHour:  num(s.letterActiveFromHour, 9),
      letterActiveToHour:    num(s.letterActiveToHour, 22),
      chatReplyDelayMs:      num(s.chatReplyDelayMs, 1000),
      focusMinutes:          num(s.focusMinutes, 25),
      breakMinutes:          num(s.breakMinutes, 5)
    };
  }
  function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }

  function getSettings() {
    var s = read(KEYS.settings, null) || {};
    var d = defaultSettings();
    Object.keys(d).forEach(function (k) {
      if (s[k] === undefined || s[k] === null) s[k] = d[k];
    });
    return s;
  }
  function setSettings(patch) {
    var s = getSettings();
    Object.keys(patch || {}).forEach(function (k) { s[k] = patch[k]; });
    write(KEYS.settings, s);
    return s;
  }
  function resetSettings() { del(KEYS.settings); return getSettings(); }

  /* ---------------- 字卡库 ---------------- */
  function cardSeed(name) {
    var c = cfg();
    if (name === 'chat') return (c.chat && c.chat.randomReplies) || [];
    if (name === 'moments') return (c.moments && c.moments.defaultCards) || [];
    if (name === 'letter') return (c.letter && c.letter.defaultCards) || [];
    return [];
  }
  /* 是否已经初始化过这套字卡库。
   * 之前有 bug 导致种子读不到，库被存成了空数组；
   * 有了这个标记，空库会自动补回默认字卡，而你手动「清空」之后不会被再塞回来。 */
  function seededKey(name) { return (CARD_LIBS[name] || {}).key + '.seeded'; }
  function markSeeded(name) { write(seededKey(name), 1); }

  function getCards(name) {
    var lib = CARD_LIBS[name];
    if (!lib) return [];
    var v = read(lib.key, null);
    if (v === null || (Array.isArray(v) && v.length === 0 && !read(seededKey(name), 0))) {
      v = cardSeed(name).slice();
      write(lib.key, v);
      /* 种子非空才算初始化完成；万一 config 还没加载出来，下次还会再试一次 */
      if (v.length) markSeeded(name);
    }
    return Array.isArray(v) ? v : [];
  }
  function setCards(name, list) {
    var lib = CARD_LIBS[name];
    if (!lib) return;
    write(lib.key, Array.isArray(list) ? list : []);
    markSeeded(name);
  }
  /* 批量添加：一行一张，空行忽略；dedupe=true 时跳过已有的一模一样的字卡 */
  function addCards(name, text, dedupe) {
    var lines = String(text || '').split(/\r?\n/).map(function (l) {
      return l.replace(/^\s+|\s+$/g, '');
    }).filter(function (l) { return l.length > 0; });
    if (!lines.length) return { added: 0, skipped: 0 };
    var list = getCards(name);
    var added = 0, skipped = 0;
    if (dedupe) {
      var have = {};
      list.forEach(function (t) { have[String(t).replace(/^\s+|\s+$/g, '')] = 1; });
      lines = lines.filter(function (l) {
        if (have[l]) { skipped++; return false; }
        have[l] = 1; added++;
        return true;
      });
    } else {
      added = lines.length;
    }
    if (lines.length) {
      setCards(name, list.concat(lines));
    } else {
      markSeeded(name);
    }
    return { added: added, skipped: skipped };
  }
  /* 删除若干张（按序号，从大到小删，序号不会乱） */
  function removeCards(name, indexes) {
    var list = getCards(name);
    indexes.slice().sort(function (a, b) { return b - a; }).forEach(function (i) {
      if (i >= 0 && i < list.length) list.splice(i, 1);
    });
    setCards(name, list);
    return list.length;
  }
  function pickCard(name, fallback) {
    var list = getCards(name);
    if (!list.length) return fallback || '……';
    return list[Math.floor(Math.random() * list.length)];
  }
  function cardCount(name) { return getCards(name).length; }

  /* ---------------- 头像（裁成小图存在这台设备里，不上传） ---------------- */
  function getAvatars() {
    var v = read(KEYS.avatars, null);
    return (v && typeof v === 'object') ? v : {};
  }
  function getAvatar(who) { return getAvatars()[who] || ''; }
  function setAvatar(who, dataUrl) {
    var a = getAvatars();
    a[who] = dataUrl || '';
    write(KEYS.avatars, a);
  }
  function clearAvatar(who) {
    var a = getAvatars();
    delete a[who];
    write(KEYS.avatars, a);
  }
  /* 朋友圈封面（同样只存在这台设备里） */
  function getCover() { return read(KEYS.momentsCover, '') || ''; }
  function setCover(dataUrl) { write(KEYS.momentsCover, dataUrl || ''); }
  function clearCover() { del(KEYS.momentsCover); }

  /* 选一张图 → 居中裁成 w×h → 压成 jpeg dataURL（默认正方形） */
  function pickImage(file, w, h) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var cw = w || 240, ch = h || w || 240;
          var cv = document.createElement('canvas');
          cv.width = cw; cv.height = ch;
          var ctx = cv.getContext('2d');
          /* 等比放大到铺满，再居中裁掉多余的部分 */
          var scale = Math.max(cw / (img.width || 1), ch / (img.height || 1));
          var sw = cw / scale, sh = ch / scale;
          ctx.drawImage(img,
            (img.width - sw) / 2, (img.height - sh) / 2, sw, sh,
            0, 0, cw, ch);
          try { resolve(cv.toDataURL('image/jpeg', 0.85)); }
          catch (e) { reject(new Error('图片处理失败')); }
        };
        img.onerror = function () { reject(new Error('图片读取失败')); };
        img.src = reader.result;
      };
      reader.onerror = function () { reject(new Error('图片读取失败')); };
      reader.readAsDataURL(file);
    });
  }
  /* who = 'him' | 'me'；没换过头像时：他是小鸟，我是名字首字 */
  function avatarHtml(who) {
    var src = getAvatar(who);
    if (src) return '<img src="' + src + '" alt="">';
    if (who === 'him') {
      return '<svg viewBox="0 0 72 72" style="width:68%;height:68%"><use href="#ln-bird"/></svg>';
    }
    var c = cfg().chat || {};
    return esc((c.userName || '我').slice(0, 1));
  }

  /* ---------------- 小鸟装饰 ---------------- */
  var SPRITE =
    '<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">' +
      '<defs>' +
        '<linearGradient id="lnBirdBody" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#eee2ff"/>' +
        '</linearGradient>' +
        '<linearGradient id="lnBirdWing" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="#dcc6ff"/><stop offset="1" stop-color="#b591f0"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<symbol id="ln-bird" viewBox="0 0 72 72">' +
        '<path d="M30 58v7M30 65h-5M42 58v7M42 65h5" stroke="#ffb86b" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
        '<path d="M17 45q-12 2-14-8 10 2 14 7z" fill="url(#lnBirdWing)"/>' +
        '<ellipse cx="36" cy="43" rx="21" ry="18" fill="url(#lnBirdBody)"/>' +
        '<circle cx="36" cy="26" r="15" fill="url(#lnBirdBody)"/>' +
        '<path d="M33 12q-2-9 5-10-1 6-2 10z" fill="#c9a3ff"/>' +
        '<ellipse cx="36" cy="49" rx="13" ry="10" fill="#ffffff" opacity=".8"/>' +
        '<path d="M21 40q7 7 16 4-3 11-14 7-5-4-2-11z" fill="url(#lnBirdWing)"/>' +
        '<ellipse cx="29" cy="31" rx="4" ry="2.6" fill="#ffb6d5" opacity=".9"/>' +
        '<circle cx="43" cy="24" r="2.6" fill="#5b3f6b"/>' +
        '<circle cx="44.1" cy="23" r=".9" fill="#ffffff"/>' +
        '<path d="M51 28l9 3.5-9 4z" fill="#ffb86b"/>' +
      '</symbol>' +
      '<symbol id="ln-bird-fly" viewBox="0 0 48 32">' +
        '<path d="M2 22c6-12 15-13 21-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>' +
        '<path d="M46 22c-6-12-15-13-21-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>' +
        '<ellipse cx="24" cy="21" rx="3" ry="4.6" fill="currentColor"/>' +
      '</symbol>' +
      '<symbol id="ln-heart" viewBox="0 0 32 30">' +
        '<path d="M16 29S1 20 1 10.5A7.5 7.5 0 0 1 16 7a7.5 7.5 0 0 1 15 3.5C31 20 16 29 16 29z" fill="currentColor"/>' +
      '</symbol>' +
    '</svg>';

  function sprite() {
    if (!document.getElementById('ln-sprite-host')) {
      var host = document.createElement('div');
      host.id = 'ln-sprite-host';
      host.innerHTML = SPRITE;
      document.body.appendChild(host);
    }
  }
  function birdSvg(cls, style) {
    return '<svg class="bird-svg ' + (cls || '') + '" viewBox="0 0 72 72"' +
      (style ? ' style="' + style + '"' : '') + '><use href="#ln-bird"/></svg>';
  }
  function deco(box, count) {
    if (!box) return;
    sprite();
    var n = count || 9;
    var kinds = ['bird-fly', 'bird-fly', 'heart', 'sparkle', 'bird-fly'];
    for (var i = 0; i < n; i++) {
      var s = document.createElement('span');
      var kind = kinds[i % kinds.length];
      if (kind === 'bird-fly') {
        s.innerHTML = '<svg viewBox="0 0 48 32" style="width:100%;height:100%;color:#c9a3ff"><use href="#ln-bird-fly"/></svg>';
        s.style.width = (16 + Math.random() * 12).toFixed(0) + 'px';
        s.style.height = 'auto';
      } else if (kind === 'heart') {
        s.innerHTML = '<svg viewBox="0 0 32 30" style="width:100%;height:100%;color:#ffb6cd"><use href="#ln-heart"/></svg>';
        s.style.width = (10 + Math.random() * 8).toFixed(0) + 'px';
      } else {
        s.textContent = '✦';
        s.style.fontSize = (10 + Math.random() * 10).toFixed(0) + 'px';
        s.style.color = '#d9b8ff';
      }
      s.style.left = (Math.random() * 92).toFixed(1) + '%';
      s.style.animationDuration = (11 + Math.random() * 12).toFixed(1) + 's';
      s.style.animationDelay = (-Math.random() * 18).toFixed(1) + 's';
      box.appendChild(s);
    }
  }

  /* ---------------- 轻提示 ---------------- */
  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById('ln-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ln-toast';
      el.className = 'ln-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  /* ---------------- 页面启动 ---------------- */
  function boot(opts) {
    opts = opts || {};
    sprite();
    var g = cfg().global || {};
    var r = document.documentElement.style;
    r.setProperty('--grad-from', g.gradientFrom || '#f4e9ff');
    r.setProperty('--grad-to', g.gradientTo || '#ffe6f0');
    r.setProperty('--text-color', g.textColor || '#6d4f74');
    if (opts.title) document.title = g.siteTitle ? (g.siteTitle + ' · ' + opts.title) : opts.title;
    if (opts.deco !== false) deco(document.getElementById('floatDeco') || null, opts.decoCount || 9);
  }

  window.LN = {
    KEYS: KEYS, CARD_LIBS: CARD_LIBS, cfg: cfg,
    $: $, $$: $$,
    esc: esc, uid: uid, randInt: randInt,
    read: read, write: write, del: del,
    bjMs: bjMs, bjParts: bjParts, bjToTs: bjToTs, bjDateKey: bjDateKey,
    pad: pad, fmtBJ: fmtBJ, fmtBJFull: fmtBJFull, fmtBJDate: fmtBJDate, timeAgoBJ: timeAgoBJ,
    getSettings: getSettings, setSettings: setSettings, resetSettings: resetSettings, defaultSettings: defaultSettings,
    getCards: getCards, setCards: setCards, addCards: addCards,
    removeCards: removeCards, pickCard: pickCard, cardCount: cardCount,
    getAvatar: getAvatar, setAvatar: setAvatar, clearAvatar: clearAvatar,
    avatarHtml: avatarHtml, pickImage: pickImage,
    getCover: getCover, setCover: setCover, clearCover: clearCover,
    sprite: sprite, birdSvg: birdSvg, deco: deco, toast: toast, boot: boot
  };
})();
