const SCENE_BREAKPOINT = '(max-width: 760px)';
const REDUCED_DATA_QUERY = '(prefers-reduced-data: reduce)';

const sceneMedia = window.matchMedia(SCENE_BREAKPOINT);
const reducedDataMedia = window.matchMedia(REDUCED_DATA_QUERY);
const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;

const SCENE_ASSETS = Object.freeze({
  academy: Object.freeze({
    library: Object.freeze({
      light: Object.freeze({
        desktop: './assets/learning/styles/academy/library-light.webp',
        mobile: './assets/learning/styles/academy/library-light-mobile.webp',
        focal: Object.freeze({ desktop: '78% 50%', mobile: '70% 42%' }),
      }),
      dark: Object.freeze({
        desktop: './assets/learning/styles/academy/library-dark.webp',
        mobile: './assets/learning/styles/academy/library-dark-mobile.webp',
        focal: Object.freeze({ desktop: '78% 50%', mobile: '70% 42%' }),
      }),
    }),
    review: Object.freeze({
      light: Object.freeze({
        desktop: './assets/learning/styles/academy/review-light.webp',
        mobile: './assets/learning/styles/academy/review-light-mobile.webp',
        focal: Object.freeze({ desktop: '76% 48%', mobile: '69% 40%' }),
      }),
      dark: Object.freeze({
        desktop: './assets/learning/styles/academy/review-dark.webp',
        mobile: './assets/learning/styles/academy/review-dark-mobile.webp',
        focal: Object.freeze({ desktop: '76% 48%', mobile: '69% 40%' }),
      }),
    }),
    exam: Object.freeze({
      light: Object.freeze({
        desktop: './assets/learning/styles/academy/exam-light.webp',
        mobile: './assets/learning/styles/academy/exam-light-mobile.webp',
        focal: Object.freeze({ desktop: '73% 50%', mobile: '66% 42%' }),
      }),
      dark: Object.freeze({
        desktop: './assets/learning/styles/academy/exam-dark.webp',
        mobile: './assets/learning/styles/academy/exam-dark-mobile.webp',
        focal: Object.freeze({ desktop: '73% 50%', mobile: '66% 42%' }),
      }),
    }),
    stats: Object.freeze({
      light: Object.freeze({
        desktop: './assets/learning/styles/academy/stats-light.webp',
        mobile: './assets/learning/styles/academy/stats-light-mobile.webp',
        focal: Object.freeze({ desktop: '78% 48%', mobile: '70% 40%' }),
      }),
      dark: Object.freeze({
        desktop: './assets/learning/styles/academy/stats-dark.webp',
        mobile: './assets/learning/styles/academy/stats-dark-mobile.webp',
        focal: Object.freeze({ desktop: '78% 48%', mobile: '70% 40%' }),
      }),
    }),
  }),
  epic: Object.freeze({
    library: Object.freeze({
      light: Object.freeze({
        desktop: './assets/learning/styles/epic/library-light.webp',
        mobile: './assets/learning/styles/epic/library-light-mobile.webp',
        focal: Object.freeze({ desktop: '80% 47%', mobile: '72% 38%' }),
      }),
      dark: Object.freeze({
        desktop: './assets/learning/styles/epic/library-dark.webp',
        mobile: './assets/learning/styles/epic/library-dark-mobile.webp',
        focal: Object.freeze({ desktop: '80% 47%', mobile: '72% 38%' }),
      }),
    }),
    review: Object.freeze({
      light: Object.freeze({
        desktop: './assets/learning/styles/epic/review-light.webp',
        mobile: './assets/learning/styles/epic/review-light-mobile.webp',
        focal: Object.freeze({ desktop: '78% 50%', mobile: '71% 40%' }),
      }),
      dark: Object.freeze({
        desktop: './assets/learning/styles/epic/review-dark.webp',
        mobile: './assets/learning/styles/epic/review-dark-mobile.webp',
        focal: Object.freeze({ desktop: '78% 50%', mobile: '71% 40%' }),
      }),
    }),
    exam: Object.freeze({
      light: Object.freeze({
        desktop: './assets/learning/styles/epic/exam-light.webp',
        mobile: './assets/learning/styles/epic/exam-light-mobile.webp',
        focal: Object.freeze({ desktop: '76% 50%', mobile: '68% 42%' }),
      }),
      dark: Object.freeze({
        desktop: './assets/learning/styles/epic/exam-dark.webp',
        mobile: './assets/learning/styles/epic/exam-dark-mobile.webp',
        focal: Object.freeze({ desktop: '76% 50%', mobile: '68% 42%' }),
      }),
    }),
    stats: Object.freeze({
      light: Object.freeze({
        desktop: './assets/learning/styles/epic/stats-light.webp',
        mobile: './assets/learning/styles/epic/stats-light-mobile.webp',
        focal: Object.freeze({ desktop: '78% 48%', mobile: '70% 40%' }),
      }),
      dark: Object.freeze({
        desktop: './assets/learning/styles/epic/stats-dark.webp',
        mobile: './assets/learning/styles/epic/stats-dark-mobile.webp',
        focal: Object.freeze({ desktop: '78% 48%', mobile: '70% 40%' }),
      }),
    }),
  }),
});

const loadedAssets = new Set();
const watchedNodes = new WeakSet();
let scheduled = false;
// Observe size changes so a scene promoted from a hidden tab is re-evaluated.
const sceneResizeObserver = typeof ResizeObserver === 'function'
  ? new ResizeObserver(scheduleSync)
  : null;

function currentContext() {
  const root = document.documentElement;
  return {
    style: root.dataset.learningStyle || 'academy',
    theme: root.dataset.theme === 'dark' ? 'dark' : 'light',
    intensity: root.dataset.sceneIntensity || 'full',
    mobile: sceneMedia.matches,
    highDpi: (window.devicePixelRatio || 1) >= 1.5,
    dpr: window.devicePixelRatio || 1,
    saveData: connection?.saveData === true || reducedDataMedia.matches,
  };
}

function pickAssetVariant(entry, context) {
  if (!entry) return null;

  // B05-03B: only pay for optional 2x when actual cover pixels fall short.
  // A 1366px / DPR2 desktop already has enough 2560px source detail.
  const allow2x = shouldRequestHiRes(entry, context);
  const candidates = context.mobile
    ? [
        allow2x && entry.mobile2x,
        entry.mobile,
        allow2x && entry.desktop2x,
        entry.desktop,
      ]
    : [
        allow2x && entry.desktop2x,
        entry.desktop,
      ];

  const href = candidates.find(Boolean) || null;
  if (!href) return null;

  let variant = 'desktop';
  if (context.mobile && href === entry.mobile2x) variant = 'mobile-2x';
  else if (context.mobile && href === entry.mobile) variant = 'mobile';
  else if (allow2x && href === entry.desktop2x) variant = 'desktop-2x';
  else if (context.mobile) variant = 'mobile-fallback-desktop';

  return {
    href,
    variant,
    position: context.mobile
      ? (entry.focal?.mobile || entry.focal?.desktop || '76% center')
      : (entry.focal?.desktop || '76% center'),
  };
}

// Most approved desktop artwork is 2560x1440; portrait artwork 1080x1440.
// These are SOURCE pixels, not nominal viewport sizes. Use the same cover math
// as our B05-02 browser audit. We choose a conservative 0.90 threshold to
// avoid loading multi-megabyte images for negligible shortfalls (e.g. 0.94).
function shouldRequestHiRes(entry, context) {
  if (!context.highDpi || context.intensity !== 'full' || context.saveData) return false;
  const box = context.artBox;
  if (!box) return true; // Preserve the pure selector's documented API.
  if (!Number.isFinite(box.width) || !Number.isFinite(box.height) ||
      box.width <= 0 || box.height <= 0) return false;

  const mobileArt = context.mobile && Boolean(entry.mobile);
  const sourceWidth = mobileArt ? 1080 : 2560;
  const sourceHeight = 1440;
  const physicalScale = Math.max(box.width / sourceWidth, box.height / sourceHeight) *
    (context.dpr || 1);
  if (physicalScale <= 0) return false;
  return 1 / physicalScale < 0.90;
}

function resolveAsset(scene, context = currentContext(), node = null) {
  if (context.intensity === 'off') return { href: null, reason: 'off' };
  if (context.style === 'focus') return { href: null, reason: 'focus' };
  if (context.saveData) return { href: null, reason: 'data-saver' };

  const entry = SCENE_ASSETS[context.style]?.[scene]?.[context.theme] || null;
  if (!entry) return { href: null, reason: 'missing' };

  const rect = node?.getBoundingClientRect();
  const artBox = rect ? { width: rect.width, height: rect.height } : null;
  return pickAssetVariant(entry, { ...context, artBox }) ||
    { href: null, reason: 'missing' };
}

function clearSceneAsset(node, reason = 'off') {
  node.style.backgroundImage = 'none';
  node.style.removeProperty('background-position');
  node.removeAttribute('data-scene-src');
  node.removeAttribute('data-scene-variant');
  node.dataset.sceneState = reason;
}

function applySceneAsset(node, asset) {
  node.style.backgroundImage = `url("${asset.href}")`;
  node.style.backgroundPosition = asset.position;
  node.dataset.sceneSrc = asset.href;
  node.dataset.sceneVariant = asset.variant;
  node.dataset.sceneState = 'ready';
}

function setSceneAsset(node, asset) {
  if (!node) return;

  if (!asset?.href) {
    clearSceneAsset(node, asset?.reason || 'off');
    return;
  }

  node.style.backgroundPosition = asset.position;
  node.dataset.sceneVariant = asset.variant;

  if (node.dataset.sceneSrc === asset.href && node.dataset.sceneState === 'ready') return;

  if (loadedAssets.has(asset.href)) {
    applySceneAsset(node, asset);
    return;
  }

  const previousHref = node.dataset.sceneSrc;
  const hasVisibleScene =
    Boolean(previousHref) &&
    node.style.backgroundImage &&
    node.style.backgroundImage !== 'none';

  node.dataset.sceneState = hasVisibleScene ? 'swapping' : 'loading';

  const image = new Image();
  image.decoding = 'async';
  image.src = asset.href;

  const ready = async () => {
    try {
      if (typeof image.decode === 'function') await image.decode();
    } catch {
      // A successfully loaded image can still fail decode() in some browsers.
    }

    const latest = resolveAsset(node.dataset.sceneArt, currentContext(), node);
    if (!latest?.href || latest.href !== asset.href) return;

    loadedAssets.add(asset.href);
    applySceneAsset(node, {
      ...asset,
      position: latest.position,
      variant: latest.variant,
    });
  };

  if (image.complete && image.naturalWidth) ready();
  else {
    image.addEventListener('load', ready, { once: true });
    image.addEventListener('error', () => {
      const latest = resolveAsset(node.dataset.sceneArt, currentContext(), node);
      if (latest?.href !== asset.href) return;

      if (hasVisibleScene) {
        node.dataset.sceneState = 'ready';
      } else {
        clearSceneAsset(node, 'error');
      }
    }, { once: true });
  }
}

export function syncLearningScenes() {
  const context = currentContext();
  document.querySelectorAll('[data-scene-art]').forEach(node => {
    if (sceneResizeObserver && !watchedNodes.has(node)) {
      watchedNodes.add(node);
      sceneResizeObserver.observe(node);
    }
    const scene = node.dataset.sceneArt;
    setSceneAsset(node, resolveAsset(scene, context, node));
  });
}

function scheduleSync() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    syncLearningScenes();
  });
}

function listenMediaQuery(query) {
  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', scheduleSync);
  } else if (typeof query.addListener === 'function') {
    query.addListener(scheduleSync);
  }
}

listenMediaQuery(sceneMedia);
listenMediaQuery(reducedDataMedia);
// The same breakpoint can contain many different actual hero sizes.
window.addEventListener('resize', scheduleSync, { passive: true });

if (connection && typeof connection.addEventListener === 'function') {
  connection.addEventListener('change', scheduleSync);
}

const rootObserver = new MutationObserver(scheduleSync);
rootObserver.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['data-theme', 'data-learning-style', 'data-scene-intensity'],
});

const bodyObserver = new MutationObserver(scheduleSync);
bodyObserver.observe(document.body, { childList: true, subtree: true });

document.addEventListener('DOMContentLoaded', scheduleSync, { once: true });
scheduleSync();
