import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync('app.html', 'utf8');
const legacy = fs.readFileSync('v3.html', 'utf8');
const loader = fs.readFileSync('src/ui/scene-assets.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const sw = fs.readFileSync('service-worker.js', 'utf8');
assert.equal(app, legacy, 'legacy app entry must remain byte-identical');
assert.match(app, /hiResLibraryPreloadPolicy/);
assert.match(app, /skipUncertainPreload/);
assert.match(app, /library-\$\{theme\}\$\{mobileSuffix\}\.webp/);
assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v5-5\.0\.0-prod-12'/);

const match = app.match(/<script>\s*([\s\S]*?)<\/script>/);
assert.ok(match, 'head inline preload script required');
const script = match[1];
const originalRegistry = 'const hiResLibraryPreloadPolicy = new Set([]);';
assert.ok(script.includes(originalRegistry), 'the staged library 2x registry must start empty');
const registered2x = [...loader.matchAll(/(?:desktop2x|mobile2x)\s*:\s*['"]\.\/assets\/learning\/styles\/(academy|epic)\/library-(light|dark)[^'"]*\.webp/g)];
assert.equal(registered2x.length, 0, 'shipped website must not claim unapproved 4K sources');

function simulate({ style = 'academy', theme = 'light', width = 1920,
  dpr = 2, intensity = 'full', saveData = false, reducedData = false,
  future2x = [] } = {}) {
  const appended = [];
  const html = { dataset: {} };
  const sandbox = {
    document: {
      documentElement: html,
      createElement(tag) {
        assert.equal(tag, 'link');
        return { rel: '', as: '', fetchPriority: '', href: '' };
      },
      head: { append(node) { appended.push(node); } },
    },
    localStorage: {
      getItem(key) {
        assert.equal(key, 'moxin.v3.settings');
        return JSON.stringify({ theme, learningStyle: style, sceneIntensity: intensity });
      },
    },
    matchMedia(query) {
      return { matches: query.includes('max-width: 760px') ? width <= 760
        : query.includes('prefers-reduced-data') ? reducedData : false };
    },
    navigator: { connection: { saveData } },
    window: { devicePixelRatio: dpr },
  };
  const patched = script.replace(originalRegistry,
    'const hiResLibraryPreloadPolicy = new Set(' + JSON.stringify(future2x) + ');');
  vm.runInNewContext(patched, sandbox, { timeout: 300 });
  return appended.map(x => ({ rel: x.rel, as: x.as,
    fetchPriority: x.fetchPriority, href: x.href }));
}

const base = 'assets/learning/styles/academy/library-light';
assert.equal(simulate().length, 1);
assert.equal(simulate()[0].href, base + '.webp');
assert.equal(simulate({ width: 390, dpr: 3 })[0].href,
  base + '-mobile.webp');
assert.equal(simulate({ style: 'epic', theme: 'dark', width: 390 })[0].href,
  'assets/learning/styles/epic/library-dark-mobile.webp');

// Simulate a future approved asset without adding any pretend WebP to git.
// A high-DPI screen is deferred to runtime to avoid 1x+2x dual downloads.
const enabled = ['academy/light/desktop'];
assert.equal(simulate({ future2x: enabled, dpr: 2 }).length, 0,
  '1920px/DPR2 with genuine desktop2x must NOT preload 1x');
assert.equal(simulate({ future2x: enabled, width: 1366, dpr: 2 }).length, 0,
  'conservative skip: runtime decides if 1366px actually needs 2x');
assert.equal(simulate({ future2x: enabled, dpr: 1 })[0].href, base + '.webp',
  'DPR1 preloads light 1x even when a 2x file exists');
assert.equal(simulate({ future2x: enabled, width: 390, dpr: 3 })[0].href,
  base + '-mobile.webp',
  'desktop2x approval must never disable phone 1x preload');
assert.equal(simulate({ future2x: ['academy/light/mobile'], width: 390, dpr: 3 })
  .length, 0, 'mobile2x approval must avoid phone double preload');
assert.equal(simulate({ future2x: ['academy/light/mobile'], width: 1920, dpr: 2 })[0]
  .href, base + '.webp',
  'mobile2x must not suppress desktop 1x preload');
assert.equal(simulate({ future2x: ['academy/dark/desktop'] })[0].href, base + '.webp',
  'approval is theme scoped');
assert.equal(simulate({ future2x: enabled, intensity: 'off' }).length, 0);
assert.equal(simulate({ future2x: enabled, intensity: 'reduced' }).length, 0);
assert.equal(simulate({ future2x: enabled, saveData: true }).length, 0);
assert.equal(simulate({ future2x: enabled, reducedData: true }).length, 0);
assert.equal(simulate({ style: 'focus' }).length, 0);

assert.match(pkg.scripts.test, /b05-hires-preload-policy-run\.mjs/);
console.log('B05-03C2 PASS: correct library preload, 2x de-dup, theme/device/tier scope, Reduced/Off/save-data.');
