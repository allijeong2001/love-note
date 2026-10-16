/* =====================================================
 * shell.js · 判断当前页面是不是跑在壳层（index.html）的 iframe 里
 * 在壳层里时：
 *   1. 站内链接都在 iframe 内跳转，页面不重载 —— 音乐不会断
 *   2. 告诉宿主这一页有没有底部栏，迷你播放条会 accordingly 抬高
 * 直接单独打开某个页面（比如 chat.html）时什么都不做，照常跳转
 * ===================================================== */
(function () {
  'use strict';
  var hosted = false;
  try {
    hosted = (window.name === 'lnview') && window.parent !== window;
  } catch (e) {}

  window.LN_HOSTED = hosted;

  /* ----------------------------------------------------
   * 手机键盘弹起来时，把「可视高度」写进 CSS 变量 --vvh。
   * 固定布局（聊天页这种）用 height: var(--vvh) 就不会被键盘挡住输入栏。
   * 这一段不管是不是在壳层里都要跑。
   * ---------------------------------------------------- */
  (function () {
    var vv = window.visualViewport;
    if (!vv) return;
    function apply() {
      document.documentElement.style.setProperty('--vvh', vv.height + 'px');
    }
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    apply();
  })();

  /* 输入时把某个滚动容器拉到底（键盘弹起后不用手动滑） */
  window.LN.scrollToBottomOnKeyboard = function (scroller) {
    if (!scroller) return;
    var t = null;
    function go() {
      clearTimeout(t);
      t = setTimeout(function () {
        requestAnimationFrame(function () { scroller.scrollTop = scroller.scrollHeight; });
      }, 260);
    }
    document.addEventListener('focusin', function (e) {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) go();
    });
  };

  if (!hosted) return;

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  ready(function () {
    /* 回主页在壳层里要跳 home.html（index.html 是壳层本身） */
    var links = document.querySelectorAll('a[href]');
    Array.prototype.forEach.call(links, function (a) {
      var href = a.getAttribute('href') || '';
      if (href === 'index.html' || href === './index.html') {
        a.setAttribute('href', 'home.html');
      }
      /* 站内页面都在 iframe 里打开 */
      if (/\.html($|\?|#)/.test(href) && href.charAt(0) !== 'h') {
        a.setAttribute('target', 'lnview');
      }
    });

    /* 把页面标题同步给壳层（iframe 里的 title 看不见） */
    try { if (document.title) window.parent.document.title = document.title; } catch (e) {}

    /* 底部栏类型：聊天是输入栏，朋友圈/写信是操作栏 */
    var path = location.pathname || '';
    var kind = null;
    if (/chat\.html/.test(path)) kind = 'inputbar';
    else if (/moments\.html|letter\.html/.test(path)) kind = 'actionbar';
    try {
      window.parent.postMessage({ type: 'ln:bar', kind: kind }, '*');
    } catch (e) {}
  });
})();
