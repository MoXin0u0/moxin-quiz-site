import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const home = readFileSync('styles/v4-home.css', 'utf8');
const styles = readFileSync('styles/v4-learning-styles.css', 'utf8');
const sw = readFileSync('service-worker.js', 'utf8');

assert.match(home, /\.home-action-card\.warning > span,[\s\S]*?color: color-mix\(in srgb, var\(--learn-gold\) 45%, var\(--learn-text\)\)/);
for (const page of ['libraryView', 'reviewView', 'examCenterView', 'statsView']) {
  assert.match(styles, new RegExp('html\\[data-theme="dark"\\]\\[data-learning-style="academy"\\] #' + page));
}
assert.match(styles, /html\[data-theme="light"\] :is\([\s\S]*?\) \.learning-kicker \{\s*color: color-mix\(in srgb, var\(--learn-page-accent\) 58%, var\(--learn-text\)\)/);
assert.match(styles, /html\[data-theme="light"\] #examCenterView \.learning-flow-step span \{\s*color: color-mix\(in srgb, var\(--learn-page-accent\) 55%, var\(--learn-text\)\)/);
assert.match(styles, /html\[data-theme="light"\] \.learning-bank-symbol\.exam \{\s*color: color-mix\(in srgb, var\(--learn-gold\) 58%, var\(--learn-text\)\)/);
assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v5-5\.0\.0-prod-12'/);
console.log('B04-02 light/dark theme readability and PWA source contracts PASS');
