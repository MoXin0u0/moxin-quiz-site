import fs from 'node:fs';
import assert from 'node:assert/strict';

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

function rgb(hex) {
  const value = hex.replace('#', '');
  assert.equal(value.length, 6, `Expected 6-digit hex: ${hex}`);
  return [0, 2, 4].map(i => parseInt(value.slice(i, i + 2), 16) / 255);
}

function luminance(hex) {
  const [r, g, b] = rgb(hex).map(channel =>
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

function assertContrast(fg, bg, min = 4.5) {
  const ratio = contrast(fg, bg);
  assert.ok(
    ratio >= min,
    `Contrast ${fg} on ${bg} = ${ratio.toFixed(2)}; expected >= ${min}`
  );
}

const legacyPractice = read('styles/v3-p4.css');
assert.ok(
  legacyPractice.includes('.unfamiliar-button.is-active') &&
  legacyPractice.includes('color: var(--warning);')
);
const unfamiliarRule = legacyPractice.match(/\.unfamiliar-button\.is-active\s*\{[^}]*\}/)?.[0] || '';
assert.ok(unfamiliarRule);
assert.ok(!unfamiliarRule.includes('color: #8b5700;'));

const learning = read('styles/v4-learning.css');
assert.ok(learning.includes('color: var(--learn-primary-action-fg, #fff);'));
assert.ok(learning.includes('color: var(--learn-selected-fg, #fff);'));
assert.ok(learning.includes('.exam-focus-time-block .exam-timer.is-warning'));
assert.ok(learning.includes('.exam-focus-time-block .exam-timer.is-danger'));
assert.ok(learning.includes('.answer-option:focus-within'));
assert.ok(learning.includes('.practice-option-feedback'));

const styles = read('styles/v4-learning-styles.css');
assert.ok(styles.includes('--academy-action-start: #805734;'));
assert.ok(styles.includes('--academy-action-end: #8d633d;'));
assert.ok(styles.includes('--learn-primary-action-fg: #0d081d;'));
assert.ok(styles.includes('--learn-selected-fg: #130f2a;'));
assert.ok(styles.includes('--learn-primary-action-fg: #171e29;'));

const design = read('styles/v4-design.css');
assert.ok(design.includes(':focus-visible'));
assert.ok(design.includes('var(--focus-ring, var(--primary))'));

const practice = read('src/ui/practice.js');
assert.ok(practice.includes("feedback.textContent = isCorrect ? '✓ 正確答案' : '✕ 你的答案';"));

// Primary CTA representative endpoint checks.
assertContrast('#fffaf0', '#67462f');
assertContrast('#fffaf0', '#8d633d');
assertContrast('#fffaf0', '#805734');
assertContrast('#0d081d', '#815cff');
assertContrast('#0d081d', '#4ac4eb');
assertContrast('#0d081d', '#ad85ff');
assertContrast('#0d081d', '#72dcff');
assertContrast('#ffffff', '#4f65b7');
assertContrast('#171e29', '#98a6df');

// Current exam-number foreground checks.
assertContrast('#ffffff', '#6d4b30');
assertContrast('#17100b', '#d0ad72');
assertContrast('#ffffff', '#714fd5');
assertContrast('#130f2a', '#aa7cff');
assertContrast('#ffffff', '#4f65b7');
assertContrast('#171e29', '#98a6df');

console.log('V5 P0A theme contract passed.');
