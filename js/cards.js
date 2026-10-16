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
  var impLines = [];       // 导入预览里正在编辑的字卡
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
            '<button type="button" id="cardSelMerge">合并成一张</button>' +
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
          '<input type="file" id="cardFile" accept=".json,.txt,application/json" hidden>' +
          '<div class="row mt8" style="gap:10px">' +
            '<button class="btn" id="cardBulkAdd" type="button" style="flex:1">批量添加</button>' +
            '<button class="btn ghost" id="cardAddOne" type="button">+ 单张</button>' +
          '</div>' +
          '<div class="row mt8" style="gap:10px">' +
            '<button class="btn ghost small" id="cardImport" type="button" style="flex:1">📥 导入 JSON</button>' +
            '<button class="btn ghost small" id="cardSample" type="button" style="flex:1">看 JSON 长啥样</button>' +
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
      '</div>' +

      /* 导入 JSON 之后的预览：可以改、可以删，确认后才真的导入 */
      '<div class="mask" id="cardImpMask"></div>' +
      '<div class="dialog card-dialog" id="cardImpDialog">' +
        '<div class="panel-head">' +
          '<span class="panel-title">导入预览</span>' +
          '<button class="icon-btn" id="cardImpClose" type="button">✕</button>' +
        '</div>' +
        '<div class="panel-body">' +
          '<div class="card-lib-hint" id="cardImpHint"></div>' +
          '<div class="card-imp-list" id="cardImpList"></div>' +
          '<div class="row mt8" style="gap:10px">' +
            '<button class="btn ghost small" id="cardImpAdd" type="button">＋ 加一行</button>' +
            '<span class="card-count" id="cardImpCount"></span>' +
          '</div>' +
          '<div class="row mt8" style="gap:10px">' +
            '<button class="btn" id="cardImpOk" type="button" style="flex:1">导入</button>' +
            '<button class="btn ghost" id="cardImpNo" type="button">取消</button>' +
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
      selMerge: $('cardSelMerge'),
      undoBar: $('cardUndo'), undoText: $('cardUndoText'), undoBtn: $('cardUndoBtn'),
      bulkAdd: $('cardBulkAdd'), addOne: $('cardAddOne'),
      importBtn: $('cardImport'), sampleBtn: $('cardSample'), file: $('cardFile'),
      restore: $('cardRestore'), clear: $('cardClear'), done: $('cardDone'),
      close: $('cardClose'),
      askMask: $('cardAskMask'), askDialog: $('cardAskDialog'),
      askText: $('cardAskText'), askOk: $('cardAskOk'), askNo: $('cardAskNo'),
      impMask: $('cardImpMask'), impDialog: $('cardImpDialog'), impHint: $('cardImpHint'),
      impList: $('cardImpList'), impAdd: $('cardImpAdd'), impCount: $('cardImpCount'),
      impOk: $('cardImpOk'), impNo: $('cardImpNo'), impClose: $('cardImpClose')
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

    /* 合并选中的字卡 */
    els.selMerge.addEventListener('click', doMerge);

    /* 导入 JSON 文件：先预览，让你改完再确定 */
    els.importBtn.addEventListener('click', function () { els.file.click(); });
    els.file.addEventListener('change', function () {
      var f = els.file.files && els.file.files[0];
      els.file.value = '';
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        var lines = parseCards(fr.result);
        if (!lines.length) { window.LN.toast('这个文件里没找到字卡～'); return; }
        openImport(lines);
      };
      fr.onerror = function () { window.LN.toast('文件读不出来，换一个试试'); };
      fr.readAsText(f, 'utf-8');
    });

    els.impClose.addEventListener('click', closeImport);
    els.impNo.addEventListener('click', closeImport);
    els.impMask.addEventListener('click', closeImport);
    els.impOk.addEventListener('click', doImport);
    els.impAdd.addEventListener('click', function () {
      impLines.push('');
      renderImport();
      var rows = els.impList.querySelectorAll('input');
      if (rows.length) rows[rows.length - 1].focus();
    });
    els.impList.addEventListener('input', function (e) {
      var row = e.target.closest ? e.target.closest('.card-imp-row') : null;
      if (!row) return;
      impLines[parseInt(row.getAttribute('data-i'), 10)] = e.target.value;
      updateImpCount();
    });
    els.impList.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-rm]') : null;
      if (!b) return;
      impLines.splice(parseInt(b.getAttribute('data-rm'), 10), 1);
      renderImport();
    });

    els.sampleBtn.addEventListener('click', function () {
      ask('JSON 文件写成下面任意一种都认：\n\n' +
        '① 直接是数组：\n["想你了", "早点睡", "今天也很喜欢你"]\n\n' +
        '② 带字段名：\n{ "cards": [{ "text": "想你了" }] }\n\n' +
        '③ 连 JSON 都不是也行，一行一张的纯文本\n\n' +
        '重复的会自动跳过，不会变多。', function () {});
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

  /* ---------------- JSON 导入 ---------------- */
  /* 把各种奇形怪状的 JSON 都摊平成一堆字卡文字 */
  function toLines(v) {
    var out = [];
    if (v == null) return out;
    if (typeof v === 'string') {
      String(v).split(/\r?\n/).forEach(function (l) {
        l = l.replace(/^\s+|\s+$/g, '');
        if (l) out.push(l);
      });
      return out;
    }
    if (typeof v === 'number' || typeof v === 'boolean') return [String(v)];
    if (Array.isArray(v)) {
      v.forEach(function (x) { out = out.concat(toLines(x)); });
      return out;
    }
    if (typeof v === 'object') {
      ['text', 'name', 'card', 'content', 'value', 'title',
       'cards', 'list', 'items', 'data', 'replies',
       'randomReplies', 'defaultCards'].forEach(function (k) {
        if (v[k] != null) out = out.concat(toLines(v[k]));
      });
      if (!out.length) {
        Object.keys(v).forEach(function (k) { out = out.concat(toLines(v[k])); });
      }
      return out;
    }
    return out;
  }

  function parseCards(raw) {
    var text = String(raw == null ? '' : raw).replace(/^\s+|\s+$/g, '');
    if (!text) return [];
    var data = null, ok = true;
    try { data = JSON.parse(text); } catch (e) { ok = false; }
    var lines;
    if (!ok) {
      /* 不是 JSON 也认，当纯文本一行一张 */
      lines = toLines(text);
    } else {
      /* 本站导出的整包备份：优先取当前这一套 */
      var libKey = (window.LN.CARD_LIBS[current] || {}).key;
      if (data && !Array.isArray(data) && typeof data === 'object' && libKey && data[libKey]) {
        lines = toLines(data[libKey]);
      } else {
        lines = toLines(data);
      }
    }
    var seen = {}, out = [];
    lines.forEach(function (l) {
      l = String(l).replace(/^\s+|\s+$/g, '');
      if (!l || seen[l]) return;
      seen[l] = 1;
      out.push(l);
    });
    return out;
  }

  /* ---------------- 导入预览 ---------------- */
  function openImport(lines) {
    build();
    impLines = lines.slice();
    if (!impLines.length) impLines.push('');
    renderImport();
    els.impMask.classList.add('show');
    els.impDialog.classList.add('show');
  }

  function renderImport() {
    var html = '';
    impLines.forEach(function (t, i) {
      html += '<div class="card-imp-row" data-i="' + i + '">' +
        '<input type="text" value="' + window.LN.esc(t) + '">' +
        '<button type="button" data-rm="' + i + '">✕</button>' +
        '</div>';
    });
    if (!impLines.length) {
      html = '<div class="card-imp-empty">一行都没有了，点下面「＋ 加一行」自己写一张。</div>';
    }
    els.impList.innerHTML = html;
    els.impHint.textContent = '认出来 ' + impLines.length +
      ' 条：不对的直接改，不要的点右边 ✕ 删掉，确认没问题再点导入。';
    updateImpCount();
  }

  function countImp() {
    return impLines.filter(function (t) { return String(t).replace(/^\s+|\s+$/g, ''); }).length;
  }
  function updateImpCount() {
    var n = countImp();
    els.impCount.textContent = '会导入 ' + n + ' 张';
    els.impOk.textContent = n ? ('导入 ' + n + ' 张') : '导入';
    els.impOk.disabled = !n;
  }

  function closeImport() {
    if (!built) return;
    els.impMask.classList.remove('show');
    els.impDialog.classList.remove('show');
  }

  function doImport() {
    var vals = impLines
      .map(function (t) { return String(t).replace(/^\s+|\s+$/g, ''); })
      .filter(function (t) { return t; });
    if (!vals.length) { window.LN.toast('没有可以导入的字卡～'); return; }
    var r = window.LN.addCards(current, vals.join('\n'), true);
    closeImport();
    sel = {};
    render();
    window.LN.toast('导入 ' + r.added + ' 张' +
      (r.skipped ? '，跳过重复 ' + r.skipped + ' 张' : ''));
  }

  /* ---------------- 合并选中的字卡 ---------------- */
  function joinTexts(arr) {
    var out = '';
    arr.forEach(function (t) {
      if (!out) { out = t; return; }
      /* 上一张已经有标点就接着写，没有就补个逗号 */
      out = /[\s，。！？、,.!?~～…：:；;）)]$/.test(out) ? out + t : out + '，' + t;
    });
    return out;
  }

  function doMerge() {
    var idxs = Object.keys(sel).map(Number).sort(function (a, b) { return a - b; });
    if (idxs.length < 2) { window.LN.toast('先选 2 张以上再合并～'); return; }
    var list = window.LN.getCards(current);
    var texts = idxs.map(function (i) {
      return String(list[i] == null ? '' : list[i]).replace(/^\s+|\s+$/g, '');
    }).filter(function (t) { return t; });
    if (texts.length < 2) { window.LN.toast('选中的字卡是空的'); return; }

    var all = window.LN.getCards(current);
    all.push(joinTexts(texts));
    window.LN.setCards(current, all);
    var at = all.length - 1;
    sel = {};
    render();
    /* 直接打开编辑框，方便再改改 */
    var row = els.list.querySelector('.card-row[data-i="' + at + '"]');
    if (row) {
      if (row.scrollIntoView) row.scrollIntoView({ block: 'center' });
      startEdit(row, at);
    }
    window.LN.toast('已合并成 1 张，原来那几张还留着');
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
    closeImport();
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

  /* 给别的页面用的自定义确认框（原生 confirm 在内嵌预览里点不动） */
  window.LN.ask = ask;

  window.LN.openCardLibrary = open;
  window.LN.closeCardLibrary = close;
  window.LN.bindCardButton = bindCardButton;
  window.LN.refreshCardBadges = refreshBadges;
})();
