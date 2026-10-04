/* =============================================================================
 * script.js — 随机图片占屏
 * 纯原生 JavaScript，无框架、无构建工具、无后端依赖。
 *
 * 流程：
 *   1. 用一个 Image 对象预加载 assets/image.jpg，加载失败就显示错误提示；
 *   2. 加载成功后延迟 300ms 开始，每隔 100ms 在随机位置插入一张随机大小的图片；
 *   3. 每张图片宽度取屏幕宽度的 5%~30%，保持原图宽高比，位置随机且尽量完整可见；
 *   4. 用 100×100 的布尔网格统计被覆盖的格子，覆盖率达到 80% 时停止并保持画面；
 *   5. 退出：电脑按 ESC，手机双击屏幕。
 *
 * 实现说明：用 DOM + 绝对定位的 <img>，不使用 canvas。
 * 图片元素只增不减（后生成的 z-index 更大，覆盖先生成的），
 * 同一张图片资源只加载一次，后续 <img> 直接命中浏览器缓存。
 * ============================================================================= */

(function () {
  'use strict';

  /* ------------------------------- 可调参数 ------------------------------- */
  const IMAGE_SRC       = 'assets/image.jpg'; // 图片路径（相对 index.html）
  const START_DELAY     = 300;   // 页面加载完成后延迟多久开始生成（毫秒）
  const SPAWN_INTERVAL  = 100;   // 每张图片之间的间隔（毫秒）
  const MIN_WIDTH_RATIO = 0.05;  // 图片最小宽度 = 屏幕宽度 × 5%
  const MAX_WIDTH_RATIO = 0.30;  // 图片最大宽度 = 屏幕宽度 × 30%
  const GRID_SIZE       = 100;   // 覆盖率网格：100 × 100
  const TARGET_COVERAGE = 0.80;  // 覆盖率达到 80% 时停止生成
  const MAX_IMAGES      = 2000;  // 安全上限，防止极端长宽比导致 DOM 无限膨胀
  const DOUBLE_TAP_MS   = 300;   // 手机“双击”判定：两次点击的最大时间间隔（毫秒）
  const DOUBLE_TAP_DIST = 60;    // 手机“双击”判定：两次点击的最大位移（像素）

  /* ------------------------------- DOM 引用 ------------------------------- */
  const stage   = document.getElementById('stage');
  const errorEl = document.getElementById('error');
  const endedEl = document.getElementById('ended');

  /* ------------------------------ 运行时状态 ------------------------------ */
  let viewW = 1;                 // 可视区域宽度（像素）
  let viewH = 1;                 // 可视区域高度（像素）
  let aspect = 1;                // 图片宽高比 = 原图宽 / 原图高
  let grid = new Uint8Array(GRID_SIZE * GRID_SIZE); // 0 = 未覆盖，1 = 已覆盖
  let coveredCount = 0;          // 已覆盖的格子数量
  let zCounter = 0;              // z-index 递增计数器
  let imageCount = 0;            // 已生成的图片数量
  let timerId = null;            // 生成定时器句柄
  let stopped = false;           // 是否已停止生成
  let quitDone = false;          // 是否已触发退出（避免 ESC 和双击重复执行）
  let lastTapTime = 0;           // 手机双击检测：上一次触摸点击的时间
  let lastTapX = 0;
  let lastTapY = 0;

  /* ------------------------------- 工具函数 ------------------------------- */

  // 重新计算可视区域尺寸（窗口大小变化、屏幕旋转时调用）
  function measureViewport() {
    viewW = stage.clientWidth  || window.innerWidth  || 1;
    viewH = stage.clientHeight || window.innerHeight || 1;
  }

  // 把 value 限制在 [min, max] 区间内
  function clamp(value, min, max) {
    return value < min ? min : (value > max ? max : value);
  }

  // 当前覆盖率（0 ~ 1）
  function getCoverage() {
    return coveredCount / (GRID_SIZE * GRID_SIZE);
  }

  /* ------------------------------ 错误提示 ------------------------------ */

  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;

    // 出错时停止后续生成，避免错误被不断刷新的图片盖住
    stopGenerating('图片加载失败');
  }

  /* ------------------------------ 覆盖率网格 ------------------------------ */

  // 把图片矩形覆盖到的网格格子标记为已覆盖（并集，不重复计数）。
  // 说明：只要格子和图片矩形有交集就算覆盖，边缘格子会被整格计入，
  //       属于轻微高估，对“覆盖率大约到 80% 就停”这个目标是够用的。
  function markCoverage(left, top, width, height) {
    const cellW = viewW / GRID_SIZE;
    const cellH = viewH / GRID_SIZE;
    const epsilon = 1e-6; // 避免正好落在格子边界上时多算一整行/一整列

    const col0 = clamp(Math.floor(left / cellW), 0, GRID_SIZE - 1);
    const col1 = clamp(Math.floor((left + width - epsilon) / cellW), 0, GRID_SIZE - 1);
    const row0 = clamp(Math.floor(top / cellH), 0, GRID_SIZE - 1);
    const row1 = clamp(Math.floor((top + height - epsilon) / cellH), 0, GRID_SIZE - 1);

    for (let row = row0; row <= row1; row++) {
      const rowOffset = row * GRID_SIZE;
      for (let col = col0; col <= col1; col++) {
        const index = rowOffset + col;
        if (grid[index] === 0) {
          grid[index] = 1;
          coveredCount++;
        }
      }
    }
  }

  /* ------------------------------- 生成图片 ------------------------------- */

  function spawnImage() {
    if (viewW <= 1 || viewH <= 1) {
      measureViewport();
    }

    // 1) 随机宽度：屏幕宽度的 5% ~ 30%；高度按原图宽高比换算，保持比例
    let width  = viewW * (MIN_WIDTH_RATIO +
                          Math.random() * (MAX_WIDTH_RATIO - MIN_WIDTH_RATIO));
    let height = width / aspect;

    // 2) 兜底：极端长宽比时按比例缩小，尽量让整张图完整落在可视区域内
    if (height > viewH) {
      height = viewH;
      width  = height * aspect;
    }
    if (width > viewW) {
      width  = viewW;
      height = width / aspect;
    }
    width  = Math.max(width, 1);
    height = Math.max(height, 1);

    // 3) 随机位置：left ∈ [0, 可视宽度 - 图片宽度]，top 同理
    const left = Math.random() * Math.max(viewW - width, 0);
    const top  = Math.random() * Math.max(viewH - height, 0);

    // 4) 插入 DOM：z-index 递增，后插入的图片盖住先插入的图片
    const img = new Image();
    img.src = IMAGE_SRC;        // 图片已被预加载过，这里直接命中浏览器缓存
    img.alt = '';
    img.draggable = false;
    img.decoding = 'async';
    img.style.left   = left + 'px';
    img.style.top    = top + 'px';
    img.style.width  = width + 'px';
    img.style.height = height + 'px';
    img.style.zIndex = String(++zCounter);

    stage.appendChild(img);     // 已经在页面上的图片不删除、不移动

    // 5) 更新覆盖率统计
    markCoverage(left, top, width, height);
    imageCount++;
  }

  /* -------------------------------- 主循环 -------------------------------- */

  // 每隔 SPAWN_INTERVAL 毫秒生成一张图片，直到覆盖率达标或达到数量上限
  function tick() {
    timerId = null;
    if (stopped) return;

    spawnImage();

    if (getCoverage() >= TARGET_COVERAGE) {
      stopGenerating('覆盖率已达 ' + Math.round(TARGET_COVERAGE * 100) + '%');
      return;
    }
    if (imageCount >= MAX_IMAGES) {
      stopGenerating('已达图片数量上限 ' + MAX_IMAGES);
      return;
    }

    timerId = window.setTimeout(tick, SPAWN_INTERVAL);
  }

  // 停止生成：保留所有已显示的图片，画面就此定格
  function stopGenerating(reason) {
    stopped = true;
    if (timerId !== null) {
      window.clearTimeout(timerId);
      timerId = null;
    }
    if (reason) {
      console.log('[随机图片占屏] 已停止生成：' + reason);
    }
  }

  /* --------------------------- 启动：预加载图片 --------------------------- */

  function preloadImage() {
    const loader = new Image();

    loader.onload = function () {
      // 尺寸异常的图片（例如 0 字节文件）也当作失败处理
      if (!loader.naturalWidth || !loader.naturalHeight) {
        showError('图片加载失败：assets/image.jpg 尺寸无效。');
        return;
      }
      aspect = loader.naturalWidth / loader.naturalHeight;
      measureViewport();
      // 延迟 START_DELAY 毫秒后开始生成第一张图片
      timerId = window.setTimeout(tick, START_DELAY);
    };

    loader.onerror = function () {
      showError('图片加载失败：请确认 assets/image.jpg 是否存在。');
    };

    loader.src = IMAGE_SRC;
  }

  /* --------------------------- 退出（ESC / 双击） --------------------------- */

  function quit() {
    if (quitDone) return;
    quitDone = true;

    stopGenerating('用户主动退出');

    // 1) 先尝试关闭窗口（浏览器只允许脚本关闭由脚本自己打开的窗口，
    //    所以普通标签页里这一步通常会被忽略，属于预期行为）
    try {
      window.close();
    } catch (err) {
      /* 忽略：不允许关闭时直接走下面的兜底提示 */
    }

    // 2) 兜底：窗口还活着就显示“已结束”提示（延迟执行，给 close() 一点时间；
    //    如果窗口真的关掉了，这段代码不会被执行）
    window.setTimeout(function () {
      endedEl.hidden = false;
    }, 50);
  }

  /* ------------------------------- 事件监听 ------------------------------- */

  // 窗口大小变化：只需重新计算可视区域尺寸，已显示的图片保持原位
  window.addEventListener('resize', measureViewport);

  // 屏幕旋转：iOS 在 orientationchange 触发时尺寸还没更新，延后一拍再量
  window.addEventListener('orientationchange', function () {
    window.setTimeout(measureViewport, 100);
  });

  // 电脑：按 ESC 退出
  window.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' || event.key === 'Esc' || event.keyCode === 27) {
      quit();
    }
  });

  // 双击退出：大多数移动浏览器和桌面浏览器都会派发 dblclick
  window.addEventListener('dblclick', quit, { passive: true });

  // 双击退出的兜底：自己检测触屏上的“双击”（时间间隔 + 位移双重判定）
  window.addEventListener('touchend', function (event) {
    if (event.touches.length > 0 || event.changedTouches.length === 0) return;

    const touch = event.changedTouches[0];
    const now = Date.now();
    const dx = touch.clientX - lastTapX;
    const dy = touch.clientY - lastTapY;

    if (now - lastTapTime <= DOUBLE_TAP_MS &&
        dx * dx + dy * dy <= DOUBLE_TAP_DIST * DOUBLE_TAP_DIST) {
      lastTapTime = 0; // 重置，避免“三连击”被算成第二次双击
      quit();
      return;
    }

    lastTapTime = now;
    lastTapX = touch.clientX;
    lastTapY = touch.clientY;
  }, { passive: true });

  // 禁止长按/右键弹出上下文菜单
  document.addEventListener('contextmenu', function (event) {
    event.preventDefault();
  });

  // 禁止 iOS 双指缩放（Safari 出于无障碍考虑可能忽略 user-scalable=no）
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (type) {
    document.addEventListener(type, function (event) {
      event.preventDefault();
    }, { passive: false });
  });

  /* -------------------------------- 启动 -------------------------------- */
  preloadImage();
})();
