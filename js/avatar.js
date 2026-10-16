/* =====================================================
 * avatar.js · 换图片（他的头像 / 我的头像 / 朋友圈封面）
 * 图片会先缩成小图再存在这台设备里，不会上传到任何地方
 * 用法：
 *   LN.bindImageButton(按钮, 'him' | 'me' | 'cover')
 *   LN.bindAvatarButton(按钮, 'him' | 'me')      // 简写
 *   LN.onAvatarChange(function(key){ ...重新渲染... })
 * ===================================================== */
(function () {
  'use strict';
  if (!window.LN) return;

  var built = false, key = null, els = {}, cbs = [];
  var $ = function (id) { return document.getElementById(id); };

  function hisLabel() {
    var c = LN.cfg() || {};
    return (c.chat && c.chat.partnerName) || (c.moments && c.moments.ownerName) || '他';
  }

  var TARGETS = {
    him: {
      title: function () { return hisLabel() + '的头像'; },
      get: function () { return LN.getAvatar('him'); },
      set: function (v) { LN.setAvatar('him', v); },
      clear: function () { LN.clearAvatar('him'); },
      size: [240, 240],
      preview: function () {
        return '<span class="avatar-lg">' + LN.avatarHtml('him') + '</span>';
      }
    },
    me: {
      title: function () { return '我的头像'; },
      get: function () { return LN.getAvatar('me'); },
      set: function (v) { LN.setAvatar('me', v); },
      clear: function () { LN.clearAvatar('me'); },
      size: [240, 240],
      preview: function () {
        return '<span class="avatar-lg av-me">' + LN.avatarHtml('me') + '</span>';
      }
    },
    cover: {
      title: function () { return '朋友圈封面'; },
      get: function () { return LN.getCover(); },
      set: function (v) { LN.setCover(v); },
      clear: function () { LN.clearCover(); },
      size: [900, 360],
      preview: function () {
        var src = LN.getCover();
        if (src) return '<div class="cover-preview"><img src="' + src + '" alt=""></div>';
        return '<div class="cover-preview empty">' +
          '<svg viewBox="0 0 72 72" class="bird-svg"><use href="#ln-bird"/></svg>' +
          '<span>现在是默认封面</span></div>';
      }
    }
  };

  function build() {
    if (built) return;
    built = true;
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="mask" id="lnAvMask"></div>' +
      '<div class="dialog" id="lnAvDialog">' +
        '<div class="panel-head">' +
          '<span class="panel-title" id="lnAvTitle">更换头像</span>' +
          '<button class="icon-btn" id="lnAvClose" type="button">✕</button>' +
        '</div>' +
        '<div class="panel-body">' +
          '<div id="lnAvPreview"></div>' +
          '<button class="btn block" id="lnAvPick" type="button">从相册里选一张</button>' +
          '<div class="row-btns">' +
            '<button type="button" id="lnAvReset">恢复默认</button>' +
            '<button type="button" id="lnAvCancel">取消</button>' +
          '</div>' +
          '<p class="tip-muted">图片会先缩成小图再存进这台设备里，不会上传到任何地方 🐤</p>' +
          '<input type="file" id="lnAvFile" accept="image/*" hidden>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap);

    els = {
      mask: $('lnAvMask'), dialog: $('lnAvDialog'), title: $('lnAvTitle'),
      preview: $('lnAvPreview'), pick: $('lnAvPick'), file: $('lnAvFile')
    };

    $('lnAvClose').addEventListener('click', close);
    $('lnAvCancel').addEventListener('click', close);
    els.mask.addEventListener('click', function (e) { if (e.target === els.mask) close(); });
    els.pick.addEventListener('click', function () { els.file.click(); });

    els.file.addEventListener('change', function () {
      var f = els.file.files && els.file.files[0];
      els.file.value = '';
      if (!f) return;
      var t = TARGETS[key];
      if (!t) return;
      els.pick.disabled = true;
      els.pick.textContent = '处理中…';
      LN.pickImage(f, t.size[0], t.size[1]).then(function (dataUrl) {
        t.set(dataUrl);
        close();
        fire(key);
        LN.toast('换好啦');
      }).catch(function () {
        window.alert('图片处理失败，换一张试试');
      }).then(function () {
        els.pick.disabled = false;
        els.pick.textContent = '从相册里选一张';
      });
    });

    $('lnAvReset').addEventListener('click', function () {
      if (!TARGETS[key]) return;
      TARGETS[key].clear();
      close();
      fire(key);
      LN.toast('已恢复默认');
    });
  }

  function fire(k) { cbs.forEach(function (f) { try { f(k); } catch (e) {} }); }

  function renderPreview() {
    if (!built || !key || !TARGETS[key]) return;
    els.preview.innerHTML = '<div class="avatar-preview">' + TARGETS[key].preview() + '</div>';
  }

  function open(k) {
    TARGETS[k] || (k = 'him');
    build();
    LN.sprite();
    key = k;
    els.title.textContent = TARGETS[k].title();
    renderPreview();
    els.mask.classList.add('show');
    els.dialog.classList.add('show');
  }
  function close() {
    if (!built) return;
    els.mask.classList.remove('show');
    els.dialog.classList.remove('show');
  }

  LN.openAvatar = open;
  LN.closeAvatar = close;
  LN.onAvatarChange = function (cb) { if (typeof cb === 'function') cbs.push(cb); };
  LN.bindImageButton = function (el, k) {
    if (!el) return;
    el.addEventListener('click', function () { open(k); });
  };
  LN.bindAvatarButton = function (el, who) { LN.bindImageButton(el, who); };
})();
