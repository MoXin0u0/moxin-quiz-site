import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync('styles/v3-p7.css', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');

assert.match(
  css,
  /html\[data-theme="dark"\]\s+\.resume-card,\s*html\[data-theme="dark"\]\s+\.exam-resume-banner\s*\{[^}]*border-color:\s*var\(--line\);[^}]*background:\s*var\(--surface-soft\);[^}]*color:\s*var\(--text\);/s
);

assert.match(
  css,
  /html\[data-theme="dark"\]\s+\.resume-card p,\s*html\[data-theme="dark"\]\s+\.exam-resume-banner span\s*\{[^}]*color:\s*var\(--muted\);/s
);

assert.match(sw, /moxin-quiz-v3-rc2-1/);

console.log('MoXin Quiz v3 RC2 dark contrast regression tests passed.');
