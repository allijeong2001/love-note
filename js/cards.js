/* =====================================================
 * cards.js · 字卡库弹窗
 * 三套字卡库互相独立：chat / moments / letter
 * 支持 搜索 · 改 · 删（可撤销）· 多选批量删 · 批量添加（一行一张，自动去重）
 * 所有改动立刻写进手机本地
 * 弹窗全部是自己画的，不用 confirm —— 内嵌预览/APP 里也能正常删
 * ===================================================== */
(function () {
  'use strict';
  if (!window.LN) return;

  var current = '';
  var els = {};
  var built = false;
  var sel = {};            // 多选：{ 序号: true }
  var undo = null;         // 上一次删除的内容，用于撤销
  var askCb = null;        // 自定义确认框的回调

  function $(id) { return document.getElementById(id); }

  function build() {
    if (built) return;
    built = true;
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="mask" id="cardMask"></div>' +
      '<div class="dialog card-dialog" id="cardDialog" role="dialog">' +
        '<div class="panel-head">' +
          '<span class="panel-title" id="cardTitle">字卡库</span>' +
          '<button class="icon-btn" id="cardClose" type="button">✕</button>' +
        '</div>' +
        '<div class="panel-body">' +
          '<div class="card-lib-hint" id="cardHint"></div>' +
          '<div class="card-lib-bar">' +
            '<input type="search" id="cardSearch" placeholder="搜索字卡…" autocomplete="off">' +
            '<span class="card-count" id="cardCount"></span>' +
          '</div>' +
          '<div class="card-selbar" id="cardSelBar">' +
            '<span id="cardSelCount">已选 0 张</span>' +
            '<button type="button" id="cardSelAll">全选</button>' +
            '<button type="button" id="cardSelDel" class="danger">删除选中</button>' +
            '<button type="button" id="cardSelNone">取消</button>' +
          '</div>' +
          '<div class="card-undo" id="cardUndo">' +
            '<span id="cardUndoText"></span>' +
            '<button type="button" id="cardUndoBtn">撤销</button>' +
          '</div>' +
          '<div class="card-lib-list" id="cardList"></div>' +
          '<div class="field" style="margin-top:14px">' +
            '<label>批量添加（换行一次就是下一张，一行一张，重复的会自动跳过）</label>' +
            '<textarea id="cardBulk" rows="4" ' +
              'placeholder="想你了&#10;早点睡&#10;今天也很喜欢你"></textarea>' +
          '</div>' +
          '<div class="row mt8" style="gap:10px">' +
            '<button class="btn" id="cardBulkAdd" type="button" style="flex:1">批量添加</button>' +
            '<button class="btn ghost" id="cardAddOne" type="button">+ 单张</button>' +
          '</div>' +
          '<div class="row mt8" style="gap:10px">' +
            '<button class="btn ghost small" id="cardRestore" type="button" style="flex:1">恢复默认</button>' +
            '<button class="btn ghost small danger" id="cardClear" type="button" style="flex:1">清空全部</button>' +
          '</div>' +
          '<button class="btn block mt12" id="cardDone" type="button">完成</button>' +
        '</div>' +
      '</div>' +

      /* 自定义确认框 */
      '<div class="mask ask-mask" id="cardAskMask"></div>' +
      '<div class="dialog ask-dialog" id="cardAskDialog">' +
        '<div class="panel-body">' +
          '<p class="ask-text" id="cardAskText"></p>' +
          '<div class="row-btns">' +
            '<button type="button" id="cardAskOk" class="primary">确定</button>' +
            '<button type="button" id="cardAskNo">取消</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap);

    els = {
      mask: $('cardMask'), dialog: $('cardDialog'), title: $('cardTitle'),
      hint: $('cardHint'), search: $('cardSearch'), count: $('cardCount'),
      list: $('cardList'), bulk: $('cardBulk'),
      selBar: $('cardSelBar'), selCount: $('cardSelCount'),
      selAll: $('cardSelAll'), selDel: $('cardSelDel'), selNone: $('cardSelNone'),
      undoBar: $('cardUndo'), undoText: $('cardUndoText'), undoBtn: $('cardUndoBtn'),
      bulkAdd: $('cardBulkAdd'), addOne: $('cardAddOne'),
      restore: $('cardRestore'), clear: $('cardClear'), done: $('cardDone'),
      close: $('cardClose'),
      askMask: $('cardAskMask'), askDialog: $('cardAskDialog'),
      askText: $('cardAskText'), askOk: $('cardAskOk'), askNo: $('cardAskNo')
    };

    els.close.addEventListener('click', close);
    els.done.addEventListener('click', close);
    els.mask.addEventListener('click', close);
    els.search.addEventListener('input', render);

    /* 确认框 */
    els.askOk.addEventListener('click', function () { answerAsk(true); });
    els.askNo.addEventListener('click', function () { answerAsk(false); });
    els.askMask.addEventListener('click', function () { answerAsk(false); });

    /* 批量添加 */
    els.bulkAdd.addEventListener('click', function () {
      var r = window.LN.addCards(current, els.bulk.value, true);
      if (!r.added) {
        window.LN.toast(r.skipped ? '这些字卡都已经有了～' : '先写点内容吧～');
        return;
      }
      els.bulk.value = '';
      render();
      window.LN.toast('已添加 ' + r.added + ' 张' + (r.skipped ? '，跳过重复 ' + r.skipped + ' 张' : ''));
    });

    els.addOne.addEventListener('click', function () {
      var v = els.bulk.value.trim();
      if (!v) { window.LN.toast('先在下面写一张字卡'); els.bulk.focus(); return; }
      var r = window.LN.addCards(current, v, true);
      if (!r.added) { window.LN.toast('这张已经有了～'); return; }
      els.bulk.value = '';
      render();
      window.LN.toast('已添加 1 张字卡');
    });

    els.restore.addEventListener('click', function () {
      ask('把这套字卡恢复成默认内容？\n你添加过的字卡会被覆盖。', function (ok) {
        if (!ok) return;
        var cfg = window.LN.cfg();
        var seed = current === 'chat'
          ? ((cfg.chat && cfg.chat.randomReplies) || []).slice()
          : current === 'moments'
            ? ((cfg.moments && cfg.moments.defaultCards) || []).slice()
            : ((cfg.letter && cfg.letter.defaultCards) || []).slice();
        window.LN.setCards(current, seed);
        sel = {};
        render();
        window.LN.toast('已恢复默认字卡');
      });
    });

    els.clear.addEventListener('click', function () {
      ask('清空这套字卡库？\n清空后他会说不出话，需要用「恢复默认」或重新添加。', function (ok) {
        if (!ok) return;
        window.LN.setCards(current, []);
        sel = {};
        render();
      });
    });

    /* 列表操作 */
    els.list.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-op]') : null;
      if (!btn) return;
      var row = btn.closest('.card-row');
      if (!row) return;
      var idx = parseInt(row.getAttribute('data-i'), 10);
      var op = btn.getAttribute('data-op');
      if (op === 'del') {
        var list = window.LN.getCards(current);
        var text = list[idx] || '';
        ask('删除这张字卡？\n「' + text + '」', function (ok) {
          if (!ok) return;
          doRemove([idx]);
        });
      } else if (op === 'edit') {
        startEdit(row, idx);
      } else if (op === 'pick') {
        if (sel[idx]) delete sel[idx]; else sel[idx] = true;
        render();
      }
    });

    /* 多选 */
    els.selAll.addEventListener('click', function () {
      var idxs = visibleIndexes();
      var allOn = idxs.length && idxs.every(function (i) { return sel[i]; });
      idxs.forEach(function (i) {
        if (allOn) delete sel[i]; else sel[i] = true;
      });
      render();
    });
    els.selDel.addEventListener('click', function () {
      var idxs = Object.keys(sel).map(Number);
      if (!idxs.length) return;
      ask('删除选中的 ' + idxs.length + ' 张字卡？', function (ok) {
        if (!ok) return;
        doRemove(idxs);
      });
    });
    els.selNone.addEventListener('click', function () { sel = {}; render(); });

    els.undoBtn.addEventListener('click', function () {
      if (!undo) return;
      var list = window.LN.getCards(current);
      undo.items.forEach(function (it) {
        list.splice(Math.min(it.i, list.length), 0, it.text);
      });
      window.LN.setCards(current, list);
      undo = null;
      hideUndo();
      render();
      window.LN.toast('已撤销');
    });
  }

  /* ---------------- 自定义确认框 ---------------- */
  function ask(text, cb) {
    build();
    askCb = cb;
    els.askText.textContent = text;
    els.askMask.classList.add('show');
    els.askDialog.classList.add('show');
  }
  function answerAsk(ok) {
    els.askMask.classList.remove('show');
    els.askDialog.classList.remove('show');
    var cb = askCb;
    askCb = null;
    if (cb) cb(ok);
  }

  /* ---------------- 删除 + 撤销 ---------------- */
  var undoTimer = null;
  function doRemove(idxs) {
    var list = window.LN.getCards(current);
    undo = {
      items: idxs.slice().sort(function (a, b) { return a - b; }).map(function (i) {
        return { i: i, text: list[i] };
      })
    };
    window.LN.removeCards(current, idxs);
    sel = {};
    render();
    els.undoText.textContent = '已删除 ' + idxs.length + ' 张';
    els.undoBar.classList.add('show');
    clearTimeout(undoTimer);
    undoTimer = setTimeout(hideUndo, 6000);
  }
  function hideUndo() {
    if (els.undoBar) els.undoBar.classList.remove('show');
  }

  /* ---------------- 行内编辑 ---------------- */
  function startEdit(row, idx) {
    var list = window.LN.getCards(current);
    var old = list[idx] || '';
    var box = document.createElement('textarea');
    box.className = 'card-edit-box';
    box.rows = 2;
    box.value = old;
    row.innerHTML = '';
    row.appendChild(box);
    var acts = document.createElement('div');
    acts.className = 'card-edit-acts';
    acts.innerHTML =
      '<button class="btn small" data-act="save" type="button">保存</button>' +
      '<button class="btn ghost small" data-act="cancel" type="button">取消</button>';
    row.appendChild(acts);
    box.focus();
    box.setSelectionRange(old.length, old.length);

    function finish(save) {
      if (save) {
        var v = box.value.replace(/^\s+|\s+$/g, '');
        var l = window.LN.getCards(current);
        if (v) l[idx] = v;
        window.LN.setCards(current, l);
      }
      render();
    }
    acts.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!b) return;
      finish(b.getAttribute('data-act') === 'save');
    });
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finish(true); }
      if (e.key === 'Escape') finish(false);
    });
  }

  function visibleIndexes() {
    var kw = (els.search.value || '').trim().toLowerCase();
    var list = window.LN.getCards(current);
    var out = [];
    list.forEach(function (t, i) {
      if (kw && String(t).toLowerCase().indexOf(kw) === -1) return;
      out.push(i);
    });
    return out;
  }

  function render() {
    var lib = window.LN.CARD_LIBS[current] || { name: '字卡库', hint: '' };
    els.title.textContent = lib.name;
    els.hint.textContent = lib.hint;
    var list = window.LN.getCards(current);
    var idxs = visibleIndexes();
    els.count.textContent = idxs.length === list.length
      ? ('共 ' + list.length + ' 张')
      : ('筛出 ' + idxs.length + ' / 共 ' + list.length + ' 张');

    var nSel = Object.keys(sel).length;
    els.selBar.classList.toggle('show', nSel > 0);
    els.selCount.textContent = '已选 ' + nSel + ' 张';

    var html = '';
    idxs.forEach(function (i) {
      var text = list[i];
      html += '<div class="card-row' + (sel[i] ? ' picked' : '') + '" data-i="' + i + '">' +
        '<span class="card-row-no" data-op="pick" title="点一下选中">' + (i + 1) + '</span>' +
        '<span class="card-row-text" data-op="edit" title="点一下修改">' + window.LN.esc(text) + '</span>' +
        '<span class="card-row-ops">' +
          '<button type="button" data-op="edit">改</button>' +
          '<button type="button" data-op="del" class="del">删</button>' +
        '</span>' +
      '</div>';
    });
    if (!idxs.length) {
      html = '<div class="card-lib-empty">' +
        '<svg viewBox="0 0 72 72" class="bird-svg"><use href="#ln-bird"/></svg>' +
        '<p>' + (els.search.value ? '没有匹配的字卡' : '这套字卡库还是空的，在下面批量添加几张吧～') + '</p></div>';
    }
    els.list.innerHTML = html;
  }

  function open(name) {
    build();
    current = name;
    sel = {};
    undo = null;
    hideUndo();
    els.search.value = '';
    els.bulk.value = '';
    render();
    els.mask.classList.add('show');
    els.dialog.classList.add('show');
  }
  function close() {
    if (!built) return;
    els.mask.classList.remove('show');
    els.dialog.classList.remove('show');
    answerAsk(false);
    refreshBadges();
  }

  /* ---------------- 字卡库小按键 ---------------- */
  var badges = [];
  function bindCardButton(btn, name) {
    if (!btn) return;
    badges.push({ btn: btn, name: name });
    btn.addEventListener('click', function () { open(name); });
    refreshBadges();
  }
  function refreshBadges() {
    badges.forEach(function (b) {
      if (!b.btn) return;
      var n = window.LN.cardCount(b.name);
      var slot = b.btn.querySelector('.card-badge');
      if (!slot) {
        slot = document.createElement('span');
        slot.className = 'card-badge';
        b.btn.appendChild(slot);
      }
      slot.textContent = n;
    });
  }

  window.LN.openCardLibrary = open;
  window.LN.closeCardLibrary = close;
  window.LN.bindCardButton = bindCardButton;
  window.LN.refreshCardBadges = refreshBadges;
})();
