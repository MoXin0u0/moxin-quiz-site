import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

// B05-03C is a RELEASE GATE for future genuine higher-detail scene art.
// No upscaled mockups or generated previews should be shipped as 4K sources.
const loader = fs.readFileSync('src/ui/scene-assets.js', 'utf8');
const app = fs.readFileSync('app.html', 'utf8');
const legacy = fs.readFileSync('v3.html', 'utf8');
const standard = [
  ...JSON.parse(fs.readFileSync('docs/R2K5_1_ACADEMY_ASSET_MANIFEST.json', 'utf8')),
  ...JSON.parse(fs.readFileSync('docs/R2K5_4_EPIC_ASSET_MANIFEST.json', 'utf8')),
];
const manifestPath = 'docs/R2K5_5_NATIVE_HIRES_MANIFEST.json';
const manifest = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { schemaVersion: 1, assets: [] };
const validPath = /^\.\/assets\/learning\/styles\/(academy|epic)\/(library|review|exam|stats)-(light|dark)(-mobile)?-2x\.webp$/;
const actualRefs = [...loader.matchAll(/\b(desktop2x|mobile2x)\s*:\s*['"]([^'"]+\.webp)['"]/g)];
const standardHashes = new Set(standard.map(x => x.sha256));
const SHA = /^[0-9a-f]{64}$/;

function webpDimensions(bytes) {
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', 'expected WebP RIFF header');
  assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', 'expected WebP signature');
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const type = bytes.toString('ascii', offset, offset + 4);
    const length = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    assert.ok(start + length <= bytes.length, 'truncated WebP chunk');
    if (type === 'VP8X') {
      return {
        width: 1 + bytes.readUIntLE(start + 4, 3),
        height: 1 + bytes.readUIntLE(start + 7, 3),
      };
    }
    if (type === 'VP8L') {
      assert.equal(bytes[start], 0x2f, 'invalid VP8L lossless signature');
      return {
        width: 1 + (bytes[start + 1] | ((bytes[start + 2] & 0x3f) << 8)),
        height: 1 + ((bytes[start + 2] >> 6) |
          (bytes[start + 3] << 2) | ((bytes[start + 4] & 0x0f) << 10)),
      };
    }
    if (type === 'VP8 ') {
      assert.equal(bytes[start + 3], 0x9d, 'invalid VP8 keyframe marker');
      assert.equal(bytes[start + 4], 0x01, 'invalid VP8 keyframe marker');
      assert.equal(bytes[start + 5], 0x2a, 'invalid VP8 keyframe marker');
      return {
        width: bytes.readUInt16LE(start + 6) & 0x3fff,
        height: bytes.readUInt16LE(start + 8) & 0x3fff,
      };
    }
    offset = start + length + (length % 2);
  }
  throw new Error('No recognizable WebP image dimension chunk');
}

assert.equal(manifest.schemaVersion, 1);
assert.ok(Array.isArray(manifest.assets), 'hires manifest requires an assets array');
assert.equal(app, legacy, 'app.html and v3.html preload logic must stay identical');
assert.equal(standard.length, 32, 'approved base scene set must remain intact');
for (const base of standard) {
  const bytes = fs.readFileSync(base.path);
  const dims = webpDimensions(bytes);
  assert.equal(dims.width, base.width, base.path + ' pixel width mismatch');
  assert.equal(dims.height, base.height, base.path + ' pixel height mismatch');
}

const refs = new Map();
for (const [, variant, href] of actualRefs) {
  const parts = href.match(validPath);
  assert.ok(parts, '2x path must use standard naming: ' + href);
  const wantVariant = parts[3] ? 'mobile2x' : 'desktop2x';
  assert.equal(variant, wantVariant, href + ' has wrong variant field');
  assert.equal(refs.has(href), false, 'duplicate runtime hi-res asset ' + href);
  refs.set(href, { variant, parts });
}

const files = new Set();
for (const item of manifest.assets) {
  assert.ok(item && typeof item === 'object');
  const path = item.path;
  const href = './' + path;
  assert.ok(refs.has(href), 'manifest hi-res file is missing runtime link: ' + path);
  assert.equal(files.has(path), false, 'duplicate hi-res asset: ' + path);
  files.add(path);
  assert.equal(item.variant, refs.get(href).variant, path + ' variant mismatch');
  assert.equal(item.approvedForRelease, true,
    path + ' must be explicitly reviewed before publishing');
  assert.equal(item.sourceKind, 'independent-high-detail',
    path + ' cannot be an interpolated/enlarged low-res scene');
  assert.match(item.sha256, SHA, path + ' must have a reproducible SHA256');
  assert.equal(fs.existsSync(path), true, 'missing approved high-res image: ' + path);

  const bytes = fs.readFileSync(path);
  assert.equal(bytes.length, item.bytes, 'size mismatch: ' + path);
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  assert.equal(hash, item.sha256, 'SHA mismatch: ' + path);
  assert.equal(standardHashes.has(hash), false, 'reused 1x bytes: ' + path);
  assert.ok(item.bytes <= 5 * 1024 * 1024,
    path + ' exceeds 5 MiB; optimize or explicitly revise bandwidth gate');
  const dims = webpDimensions(bytes);
  assert.equal(dims.width, item.width, path + ' actual width differs from manifest');
  assert.equal(dims.height, item.height, path + ' actual height differs from manifest');
  if (item.variant === 'desktop2x') {
    assert.ok(item.width >= 3840 && item.height >= 2160,
      path + ' must be >=3840x2160 source pixels, not a smaller preview');
  } else {
    assert.ok(item.width >= 1440 && item.height >= 1920,
      path + ' must be >=1440x1920 phone source pixels');
  }
  assert.ok(item.nativeSourceWidth >= item.width &&
    item.nativeSourceHeight >= item.height,
    path + ' must document sufficiently detailed original source resolution');
  assert.ok(typeof item.sourceId === 'string' && item.sourceId.length >= 6,
    path + ' must have auditable source identification');
}
assert.equal(files.size, refs.size,
  'every runtime 2x image requires an approved native-resolution manifest entry');

// A 2x library image changes early-load behavior: do not preload 1x then
// request 2x again. This contract deliberately blocks 2x promotion until
// app.html/v3.html are updated with a matching resolution-aware preload.
if (manifest.assets.some(x => /\/library-/.test(x.path))) {
  assert.match(app, /hiResLibraryPreloadPolicy/,
    '2x library art requires matching early-preload policy; avoid double fetch');
}

assert.equal(1672 < 3840, true,
  'B05-03C concept renders (1672x941) are not native 4K assets');
assert.equal(2560 < 3840, true,
  'the old approved 2560x1440 source does not meet new 4K gate');
console.log('B05-03C source gate PASS:', standard.length, 'approved base WebP files,',
  files.size, 'independent high-res sources deployed.');
if (!files.size) {
  console.log('B05-03C PENDING: no genuine 3840x2160 art is wired; draft renders remain review-only.');
}
