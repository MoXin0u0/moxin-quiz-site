import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
} from '../src/storage/settings.js';

assert.equal(DEFAULT_SETTINGS.studioTypeSwitchConfirm, true);
assert.equal(normalizeSettings({}).studioTypeSwitchConfirm, true);
assert.equal(
  normalizeSettings({ studioTypeSwitchConfirm: false }).studioTypeSwitchConfirm,
  false,
);

const settingsUi = fs.readFileSync('src/ui/settings.js', 'utf8');
const p7 = fs.readFileSync('src/app/p7.js', 'utf8');
const studio = fs.readFileSync('src/ui/studio-r1.js', 'utf8');
const css = fs.readFileSync('styles/v4-studio-r1.css', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');

assert.match(settingsUi, /data-setting-studio-type-switch-confirm/);
assert.match(settingsUi, /題型切換前確認/);
assert.match(p7, /data-setting-studio-type-switch-confirm/);

assert.match(studio, /document\.createElement\('dialog'\)/);
assert.match(studio, /studioTypeSwitchConfirm/);
assert.match(studio, /data-studio-disable-type-confirm/);
assert.match(studio, /data-studio-undo-type-change/);
assert.match(studio, /undoLastTypeChange/);
assert.match(studio, /renderUndoNotice/);

const typeChangeStart = studio.indexOf('async function changeCurrentQuestionType');
const typeChangeEnd = studio.indexOf('function renderEditor', typeChangeStart);
const typeChangeBlock = studio.slice(typeChangeStart, typeChangeEnd);
assert.doesNotMatch(typeChangeBlock, /\bconfirm\s*\(/);

assert.match(css, /\.studio-r1-dialog/);
assert.match(css, /\.studio-r1-snackbar/);
assert.match(css, /\.studio-r1-health-grid/);
assert.match(css, /grid-template-columns:\s*260px minmax\(500px, 1fr\)/);

assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v3-4\.\d+\.\d+-[^']+'/);

console.log('MoXin Quiz v4.0 R1.1 UI refinement tests passed.');
