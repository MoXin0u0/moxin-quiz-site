import assert from 'node:assert/strict';
import fs from 'node:fs';

const loader = fs.readFileSync('src/ui/scene-assets.js', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');

const styles = ['academy', 'epic'];
const scenes = ['library', 'review', 'exam', 'stats'];
const themes = ['light', 'dark'];

for (const style of styles) {
  for (const scene of scenes) {
    for (const theme of themes) {
      const desktop = `assets/learning/styles/${style}/${scene}-${theme}.webp`;
      const mobile = `assets/learning/styles/${style}/${scene}-${theme}-mobile.webp`;

      for (const [variant, path, target] of [
        ['desktop', desktop, { width: 2560, height: 1440 }],
        ['mobile', mobile, { width: 1080, height: 1440 }],
      ]) {
        assert.equal(fs.existsSync(path), true, `${path} should exist`);
        const size = fs.statSync(path).size;
        assert.ok(size >= 160 * 1024, `${path} should contain production-detail artwork`);

        const dimensions = readWebpSize(path);
        assert.ok(dimensions, `${path} should be a valid WebP`);
        assert.ok(
          dimensions.width >= target.width && dimensions.height >= target.height,
          `${path} should be at least ${target.width}x${target.height}, got ${dimensions.width}x${dimensions.height}`,
        );

        assert.match(
          loader,
          new RegExp(`${escapeRegExp(scene)}-${theme}${variant === 'mobile' ? '-mobile' : ''}\\.webp`),
          `${path} should be wired into the scene loader`,
        );
      }
    }
  }
}

assert.match(sw, /moxin-quiz-v3-4\.0\.0-r2k\.5-\d+/);
assert.match(sw, /moxin-quiz-scenes-r2k\.5-\d+/);
assert.match(sw, /cacheFirstScene/);

console.log('MoXin Quiz v4.0 R2K.5 production scene asset tests passed.');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readWebpSize(file) {
  const buffer = fs.readFileSync(file);

  if (
    buffer.length < 16 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WEBP'
  ) return null;

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunk = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;

    if (chunk === 'VP8X' && data + 10 <= buffer.length) {
      return {
        width: 1 + buffer[data + 4] + (buffer[data + 5] << 8) + (buffer[data + 6] << 16),
        height: 1 + buffer[data + 7] + (buffer[data + 8] << 8) + (buffer[data + 9] << 16),
      };
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
