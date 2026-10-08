import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
} from '../src/storage/settings.js';

const index = fs.readFileSync('app.html', 'utf8');
const settingsUi = fs.readFileSync('src/ui/settings.js', 'utf8');
const css = fs.readFileSync('styles/v4-learning-styles.css', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');
const sceneLoader = fs.readFileSync('src/ui/scene-assets.js', 'utf8');

assert.equal(DEFAULT_SETTINGS.learningStyle, 'academy');
assert.equal(normalizeSettings({ learningStyle: 'epic' }).learningStyle, 'epic');
assert.match(index, /\['academy', 'epic', 'focus'\]\.includes\(settings\.learningStyle\)/);

assert.match(settingsUi, /value: 'epic'/);
assert.match(settingsUi, /label: '史詩幻想'/);
assert.match(settingsUi, /previewClass: 'epic'/);

assert.match(css, /Style Pack: Epic Fantasy/);
assert.match(css, /data-learning-style="epic"/);
assert.match(css, /styles\/epic\/library-light\.webp/);
assert.match(css, /styles\/epic\/library-dark\.webp/);
assert.match(css, /styles\/epic\/review-light\.webp/);
assert.match(css, /styles\/epic\/review-dark\.webp/);
assert.match(css, /styles\/epic\/exam-light\.webp/);
assert.match(css, /styles\/epic\/exam-dark\.webp/);
assert.match(css, /styles\/epic\/stats-light\.webp/);
assert.match(css, /styles\/epic\/stats-dark\.webp/);
assert.match(css, /--epic-gold:/);
assert.match(css, /--epic-violet:/);

for (const asset of [
  'library-light.webp', 'library-dark.webp',
  'review-light.webp', 'review-dark.webp',
  'exam-light.webp', 'exam-dark.webp',
  'stats-light.webp', 'stats-dark.webp',
]) {
  const path = `assets/learning/styles/epic/${asset}`;
  assert.equal(fs.existsSync(path), true, `${path} must exist`);
  assert.ok(fs.statSync(path).size > 20_000, `${path} must contain a real scene asset`);
}

assert.match(sceneLoader, /styles\/epic\/library-light\.webp/);
assert.match(sceneLoader, /styles\/epic\/stats-dark\.webp/);
assert.match(sw, /cacheFirstScene/);
assert.match(sw, /moxin-quiz-scenes-/);
// Cache revision is allowed to advance independently of this milestone.
assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v(?:3-4\.\d+\.\d+|5)-[^']+'/);

console.log('MoXin Quiz v4.0 R2J epic fantasy style tests passed.');
