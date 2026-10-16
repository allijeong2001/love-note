/* =====================================================
 * stickers.js · 表情包
 * 参考 cute-chat-stickers 的交互：输入框旁一颗按钮 → 底部抽屉 →
 * 分组 tab → 点一下直接贴出去；另外还能从相册导入自己的图。
 * 内置贴纸是 emoji + 文字画的，不依赖任何图片文件；
 * 自己导入的图裁小后存在这台设备里。
 * ===================================================== */
(function () {
  'use strict';
  if (!window.LN) return;

  /* 内置贴纸：[emoji, 一句话] */
  var GROUPS = [
    {
      name: '撒娇', items: [
        ['🥺', '拜托~'], ['💕', '喜欢你'], ['😚', '亲亲'], ['🫣', '偷偷看你'],
        ['🐤', '啾啾'], ['🧸', '抱抱'], ['🎀', '给你'], ['🫶', '最爱你了']
      ]
    },
    {
      name: '想你', items: [
        ['💭', '在想你'], ['🌙', '想你想到睡不着'], ['📮', '写给你'],
        ['☎️', '想听你声音'], ['🫧', '冒个泡'], ['🧷', '别乱跑']
      ]
    },
    {
      name: '生气', items: [
        ['😤', '哼'], ['💢', '生气了'], ['🙄', '无语'], ['😠', '不理你'],
        ['🥲', '委屈'], ['🫨', '吓我一跳']
      ]
    },
    {
      name: '日常', items: [
        ['🍚', '吃饭了吗'], ['☕', '喝点热的'], ['🛏️', '该睡了'], ['🌧️', '记得带伞'],
        ['🧣', '多穿点'], ['💊', '吃药了吗'], ['📚', '好好上课'], ['🍰', '给你留了蛋糕']
      ]
    },
    {
      name: '晚安', items: [
        ['🌙', '晚安'], ['⭐', '好梦'], ['🛌', '睡吧'], ['🫧', '明天见'],
        ['🤍', '梦里见'], ['🐑', '数羊羊']
      ]
    }
  ];

  /* 给内置贴纸编个稳定 id */
  GROUPS.forEach(function (g, gi) {
    g.key = 'g' + gi;
    g.items = g.items.map(function (it, i) {
      return { id: 'b' + gi + '_' + i, emoji: it[0], label: it[1] };
    });
  });

  var MY = '__mine__';

  var els = null;
  var built = false;
  var tab = GROUPS[0].key;
  var onPick = null;

  function $(id) { return document.getElementById(id); }

  /* ---------------- 取一张贴纸 ---------------- */
  function findBuiltin(id) {
    for (var i = 0; i < GROUPS.length; i++) {
      for (var j = 0; j < GROUPS[i].items.length; j++) {
        if (GROUPS[i].items[j].id === id) return GROUPS[i].items[j];
      }
    }
    return null;
  }

  /* 随机来一张内置贴纸（他回消息时会用） */
  function randomSticker() {
    var g = GROUPS[Math.floor(Math.random() * GROUPS.length)];
    if (!g) return null;
    var it = g.items[Math.floor(Math.random() * g.items.length)];
    return it ? { t: 'b', id: it.id } : null;
  }

  /* 消息气泡里用的 HTML */
  function stickerHtml(p) {
    if (!p) return '';
    if (p.t === 'm') {
      var mine = window.LN.getSticker(p.id);
      if (!mine) return '<span class="stk stk-gone">（表情被删掉了）</span>';
      return '<img class="stk-img" src="' + window.LN.esc(mine.src) + '" alt="表情包">';
    }
    var b = findBuiltin(p.id);
    if (!b) return '<span class="stk stk-gone">（找不到这个表情）</span>';
    return '<span class="stk">' +
      '<i>' + b.emoji + '</i>' +
      '<b>' + window.LN.esc(b.label) + '</b>' +
      '</span>';
  }

  /* ---------------- 面板 ---------------- */
  function build() {
    if (built) return;
    built = true;
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="mask stk-mask" id="stkMask"></div>' +
      '<div class="stk-panel" id="stkPanel">' +
        '<div class="stk-head">' +
          '<span class="stk-title">表情包</span>' +
          '<button class="icon-btn" id="stkClose" type="button">✕</button>' +
        '</div>' +
        '<div class="stk-tabs" id="stkTabs"></div>' +
        '<div class="stk-grid" id="stkGrid"></div>' +
        '<div class="stk-foot" id="stkFoot">' +
          '<button class="btn ghost small" id="stkAdd" type="button">＋ 从相册加一张</button>' +
          '<span class="stk-tip" id="stkTip"></span>' +
        '</div>' +
        '<input type="file" id="stkFile" accept="image/*" hidden>' +
      '</div>';
    document.body.appendChild(wrap);

    els = {
      mask: $('stkMask'), panel: $('stkPanel'), tabs: $('stkTabs'),
      grid: $('stkGrid'), foot: $('stkFoot'), tip: $('stkTip'),
      add: $('stkAdd'), file: $('stkFile'), close: $('stkClose')
    };

    els.close.addEventListener('click', close);
    els.mask.addEventListener('click', close);

    els.tabs.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-tab]') : null;
      if (!b) return;
      tab = b.getAttribute('data-tab');
      render();
    });

    els.grid.addEventListener('click', function (e) {
      var del = e.target.closest ? e.target.closest('[data-del]') : null;
      if (del) {
        window.LN.removeSticker(del.getAttribute('data-del'));
        render();
        window.LN.toast('删掉啦');
        return;
      }
      var item = e.target.closest ? e.target.closest('[data-stk]') : null;
      if (!item) return;
      var t = item.getAttribute('data-t');
      var id = item.getAttribute('data-stk');
      close();
      if (onPick) onPick({ t: t, id: id });
    });

    els.add.addEventListener('click', function () { els.file.click(); });
    els.file.addEventListener('change', function () {
      var f = els.file.files && els.file.files[0];
      els.file.value = '';
      if (!f) return;
      els.add.disabled = true;
      els.add.textContent = '处理中…';
      window.LN.pickImage(f, 200)
        .then(function (dataUrl) {
          window.LN.addSticker(dataUrl);
          tab = MY;
          render();
          window.LN.toast('加好啦，点一下就能发出去');
        })
        .catch(function () { window.LN.toast('图片读不出来，换一张试试'); })
        .then(function () {
          els.add.disabled = false;
          els.add.textContent = '＋ 从相册加一张';
        });
    });
  }

  function renderTabs() {
    var html = '';
    GROUPS.forEach(function (g) {
      html += '<button type="button" class="stk-tab' + (tab === g.key ? ' on' : '') +
        '" data-tab="' + g.key + '">' + g.name + '</button>';
    });
    html += '<button type="button" class="stk-tab' + (tab === MY ? ' on' : '') +
      '" data-tab="' + MY + '">我的</button>';
    els.tabs.innerHTML = html;
  }

  function renderGrid() {
    var html = '';
    if (tab === MY) {
      var list = window.LN.getStickers();
      list.forEach(function (s) {
        html += '<span class="stk-item" data-stk="' + window.LN.esc(s.id) + '" data-t="m">' +
          '<img src="' + window.LN.esc(s.src) + '" alt="">' +
          '<i class="stk-del" data-del="' + window.LN.esc(s.id) + '">✕</i>' +
          '</span>';
      });
      if (!list.length) {
        html = '<div class="stk-empty">还没有自己的表情包<br>点下面「从相册加一张」</div>';
      }
      els.foot.style.display = 'flex';
      els.tip.textContent = '点右上角 ✕ 删掉，图片只存在这台手机里';
    } else {
      var g = null;
      GROUPS.forEach(function (x) { if (x.key === tab) g = x; });
      (g ? g.items : []).forEach(function (it) {
        html += '<span class="stk-item" data-stk="' + it.id + '" data-t="b">' +
          '<i class="stk-emoji">' + it.emoji + '</i>' +
          '<b class="stk-label">' + window.LN.esc(it.label) + '</b>' +
          '</span>';
      });
      els.foot.style.display = 'flex';
      els.tip.textContent = '点一下就贴出去～';
    }
    els.grid.innerHTML = html;
  }

  function render() { renderTabs(); renderGrid(); }

  function open(cb) {
    build();
    onPick = cb;
    render();
    els.mask.classList.add('show');
    els.panel.classList.add('show');
  }
  function close() {
    if (!built) return;
    els.mask.classList.remove('show');
    els.panel.classList.remove('show');
  }

  /* 输入框旁边那颗小按钮 */
  function bindStickerButton(btn, cb) {
    if (!btn) return;
    btn.addEventListener('click', function () { open(cb); });
  }

  window.LN.openStickerPanel = open;
  window.LN.closeStickerPanel = close;
  window.LN.bindStickerButton = bindStickerButton;
  window.LN.stickerHtml = stickerHtml;
  window.LN.randomSticker = randomSticker;
})();
