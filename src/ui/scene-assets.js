const SCENE_ASSETS = Object.freeze({
  academy: Object.freeze({
    library: { light: './assets/learning/styles/academy/library-light.webp', dark: './assets/learning/styles/academy/library-dark.webp' },
    review: { light: './assets/learning/styles/academy/review-light.webp', dark: './assets/learning/styles/academy/review-dark.webp' },
    exam: { light: './assets/learning/styles/academy/exam-light.webp', dark: './assets/learning/styles/academy/exam-dark.webp' },
    stats: { light: './assets/learning/styles/academy/stats-light.webp', dark: './assets/learning/styles/academy/stats-dark.webp' },
  }),
  epic: Object.freeze({
    library: { light: './assets/learning/styles/epic/library-light.webp', dark: './assets/learning/styles/epic/library-dark.webp' },
    review: { light: './assets/learning/styles/epic/review-light.webp', dark: './assets/learning/styles/epic/review-dark.webp' },
    exam: { light: './assets/learning/styles/epic/exam-light.webp', dark: './assets/learning/styles/epic/exam-dark.webp' },
    stats: { light: './assets/learning/styles/epic/stats-light.webp', dark: './assets/learning/styles/epic/stats-dark.webp' },
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
  };
}

function resolveAsset(scene, context = currentContext()) {
  if (context.intensity === 'off' || context.style === 'focus') return null;
  return SCENE_ASSETS[context.style]?.[scene]?.[context.theme] || null;
}

function setSceneAsset(node, href) {
  if (!node) return;

  if (!href) {
    node.style.backgroundImage = 'none';
    node.removeAttribute('data-scene-src');
    node.dataset.sceneState = 'off';
    return;
  }

  if (node.dataset.sceneSrc === href && node.dataset.sceneState === 'ready') return;

  node.dataset.sceneSrc = href;
  node.dataset.sceneState = loadedAssets.has(href) ? 'ready' : 'loading';

  const image = new Image();
  image.decoding = 'async';
  image.src = href;

  const ready = async () => {
    try {
      if (typeof image.decode === 'function') await image.decode();
    } catch {
      // A successfully loaded image can still fail decode() in some browsers.
    }

    if (node.dataset.sceneSrc !== href) return;
    loadedAssets.add(href);
    node.style.backgroundImage = `url("${href}")`;
    node.dataset.sceneState = 'ready';
  };

  if (image.complete && image.naturalWidth) ready();
  else {
    image.addEventListener('load', ready, { once: true });
    image.addEventListener('error', () => {
      if (node.dataset.sceneSrc !== href) return;
      node.style.backgroundImage = 'none';
      node.dataset.sceneState = 'error';
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

const rootObserver = new MutationObserver(scheduleSync);
rootObserver.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['data-theme', 'data-learning-style', 'data-scene-intensity'],
});

const bodyObserver = new MutationObserver(scheduleSync);
bodyObserver.observe(document.body, { childList: true, subtree: true });

document.addEventListener('DOMContentLoaded', scheduleSync, { once: true });
scheduleSync();
