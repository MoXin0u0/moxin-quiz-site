import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
} from '../src/storage/settings.js';

const index = fs.readFileSync('app.html', 'utf8');
const v3 = fs.readFileSync('v3.html', 'utf8');
const settingsUi = fs.readFileSync('src/ui/settings.js', 'utf8');
const p7 = fs.readFileSync('src/app/p7.js', 'utf8');
const styleCss = fs.readFileSync('styles/v4-learning-styles.css', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');

assert.equal(index, v3);
assert.equal(DEFAULT_SETTINGS.learningStyle, 'academy');
assert.equal(DEFAULT_SETTINGS.sceneIntensity, 'full');

assert.deepEqual(
  normalizeSettings({ learningStyle: 'focus', sceneIntensity: 'off' }),
  {
    theme: 'system',
    fontScale: 'normal',
    optionSpacing: 'normal',
    reduceMotion: false,
    learningStyle: 'focus',
    sceneIntensity: 'off',
    studioTypeSwitchConfirm: true,
  },
);

const invalid = normalizeSettings({ learningStyle: 'unknown', sceneIntensity: 'maximum' });
assert.equal(invalid.learningStyle, 'academy');
assert.equal(invalid.sceneIntensity, 'full');

assert.ok(index.indexOf('styles/v4-learning-styles.css') > index.indexOf('styles/v4-learning.css'));
assert.match(index, /dataset\.learningStyle/);
assert.match(index, /dataset\.sceneIntensity/);

assert.match(settingsUi, /data-setting-learning-style/);
assert.match(settingsUi, /data-setting-scene-intensity/);
assert.match(settingsUi, /經典學院/);
assert.match(settingsUi, /純粹專注/);
assert.match(settingsUi, /史詩幻想/);
assert.match(settingsUi, /自然晨光/);
assert.match(settingsUi, /準備中/);

assert.match(p7, /root\.dataset\.learningStyle = settings\.learningStyle/);
assert.match(p7, /root\.dataset\.sceneIntensity = settings\.sceneIntensity/);

assert.match(styleCss, /data-learning-style="academy"/);
assert.match(styleCss, /data-learning-style="focus"/);
assert.match(styleCss, /data-learning-style="epic"/);
assert.match(styleCss, /data-scene-intensity="reduced"/);
assert.match(styleCss, /data-scene-intensity="off"/);
assert.match(styleCss, /learning-style-picker/);
assert.match(styleCss, /scene-intensity-picker/);

assert.match(sw, /styles\/v4-learning-styles\.css/);
// Cache revision is allowed to advance independently of this milestone.
assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v(?:3-4\.\d+\.\d+|5)-[^']+'/);

console.log('MoXin Quiz v4.0 R2I visual style system tests passed.');
