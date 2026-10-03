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
let scheduled = false;

function currentContext() {
  const root = document.documentElement;
  return {
    style: root.dataset.learningStyle || 'academy',
    theme: root.dataset.theme === 'dark' ? 'dark' : 'light',
    intensity: root.dataset.sceneIntensity || 'full',
    mobile: sceneMedia.matches,
    highDpi: (window.devicePixelRatio || 1) >= 1.5,
    saveData: connection?.saveData === true || reducedDataMedia.matches,
  };
}

function pickAssetVariant(entry, context) {
  if (!entry) return null;

  const candidates = context.mobile
    ? [
        context.highDpi && entry.mobile2x,
        entry.mobile,
        context.highDpi && entry.desktop2x,
        entry.desktop,
      ]
    : [
        context.highDpi && entry.desktop2x,
        entry.desktop,
      ];

  const href = candidates.find(Boolean) || null;
  if (!href) return null;

  let variant = 'desktop';
  if (context.mobile && href === entry.mobile2x) variant = 'mobile-2x';
  else if (context.mobile && href === entry.mobile) variant = 'mobile';
  else if (context.highDpi && href === entry.desktop2x) variant = 'desktop-2x';
  else if (context.mobile) variant = 'mobile-fallback-desktop';

  return {
    href,
    variant,
    position: context.mobile
      ? (entry.focal?.mobile || entry.focal?.desktop || '76% center')
      : (entry.focal?.desktop || '76% center'),
  };
}

function resolveAsset(scene, context = currentContext()) {
  if (context.intensity === 'off') return { href: null, reason: 'off' };
  if (context.style === 'focus') return { href: null, reason: 'focus' };
  if (context.saveData) return { href: null, reason: 'data-saver' };

  const entry = SCENE_ASSETS[context.style]?.[scene]?.[context.theme] || null;
  return pickAssetVariant(entry, context) || { href: null, reason: 'missing' };
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

    const latest = resolveAsset(node.dataset.sceneArt);
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
      const latest = resolveAsset(node.dataset.sceneArt);
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
    const scene = node.dataset.sceneArt;
    setSceneAsset(node, resolveAsset(scene, context));
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
