import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('assets/learning/styles');
const styles = ['academy', 'epic'];
const scenes = ['library', 'review', 'exam', 'stats'];
const themes = ['light', 'dark'];

const RECOMMENDED_BYTES = 160 * 1024;
const DESKTOP_TARGET = { width: 2560, height: 1440 };
const MOBILE_TARGET = { width: 1080, height: 1440 };

let warnings = 0;

for (const style of styles) {
  for (const scene of scenes) {
    for (const theme of themes) {
      auditAsset(style, scene, theme, 'desktop', `${scene}-${theme}.webp`, DESKTOP_TARGET);

      const mobileName = `${scene}-${theme}-mobile.webp`;
      const mobilePath = path.join(ROOT, style, mobileName);
      if (fs.existsSync(mobilePath)) {
        auditAsset(style, scene, theme, 'mobile', mobileName, MOBILE_TARGET);
      }
    }
  }
}

console.log(`\nScene asset audit: ${warnings} warning(s).`);
console.log('Warnings are informational. Visual detail, focal composition and safe-area quality still require manual review.');

function auditAsset(style, scene, theme, variant, filename, target) {
  const file = path.join(ROOT, style, filename);

  if (!fs.existsSync(file)) {
    console.log(`✗ missing ${path.relative('.', file)}`);
    warnings += 1;
    return;
  }

  const bytes = fs.statSync(file).size;
  const dimensions = readWebpSize(file);
  const sizeOk = bytes >= RECOMMENDED_BYTES;
  const dimensionsOk = dimensions &&
    dimensions.width >= target.width &&
    dimensions.height >= target.height;

  const mark = sizeOk && dimensionsOk ? '✓' : '⚠';
  if (!sizeOk || !dimensionsOk) warnings += 1;

  const dimensionText = dimensions
    ? `${dimensions.width}×${dimensions.height}`
    : 'unknown dimensions';

  console.log(
    `${mark} ${style}/${scene}-${theme} [${variant}] ` +
    `${dimensionText}, ${(bytes / 1024).toFixed(1)} KB ` +
    `(target ≥ ${target.width}×${target.height}, ≥ ${(RECOMMENDED_BYTES / 1024).toFixed(0)} KB)`,
  );
}

export function readWebpSize(file) {
  const buffer = fs.readFileSync(file);

  if (
    buffer.length < 16 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    return null;
  }

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunk = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;

    if (chunk === 'VP8X' && data + 10 <= buffer.length) {
      const width =
        1 +
        buffer[data + 4] +
        (buffer[data + 5] << 8) +
        (buffer[data + 6] << 16);
      const height =
        1 +
        buffer[data + 7] +
        (buffer[data + 8] << 8) +
        (buffer[data + 9] << 16);
      return { width, height };
    }

    if (
      chunk === 'VP8 ' &&
      data + 10 <= buffer.length &&
      buffer[data + 3] === 0x9d &&
      buffer[data + 4] === 0x01 &&
      buffer[data + 5] === 0x2a
    ) {
      return {
        width: buffer.readUInt16LE(data + 6) & 0x3fff,
        height: buffer.readUInt16LE(data + 8) & 0x3fff,
      };
    }

    if (chunk === 'VP8L' && data + 5 <= buffer.length && buffer[data] === 0x2f) {
      const bits = buffer.readUInt32LE(data + 1);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >>> 14) & 0x3fff) + 1,
      };
    }

    offset = data + size + (size % 2);
  }

  return null;
}
