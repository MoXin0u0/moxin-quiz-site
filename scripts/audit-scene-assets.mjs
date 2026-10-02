import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('assets/learning/styles');
const styles = ['academy', 'epic'];
const scenes = ['library', 'review', 'exam', 'stats'];
const themes = ['light', 'dark'];
const RECOMMENDED_BYTES = 160 * 1024;

let warnings = 0;
for (const style of styles) {
  for (const scene of scenes) {
    for (const theme of themes) {
      const file = path.join(ROOT, style, `${scene}-${theme}.webp`);
      if (!fs.existsSync(file)) {
        console.log(`✗ missing ${path.relative('.', file)}`);
        warnings += 1;
        continue;
      }
      const bytes = fs.statSync(file).size;
      const mark = bytes >= RECOMMENDED_BYTES ? '✓' : '⚠';
      if (bytes < RECOMMENDED_BYTES) warnings += 1;
      console.log(`${mark} ${path.relative('.', file)} ${(bytes / 1024).toFixed(1)} KB`);
    }
  }
}

console.log(`\nScene asset audit: ${warnings} warning(s).`);
console.log('This audit is informational; visual detail must be judged from the source artwork, not file size alone.');
