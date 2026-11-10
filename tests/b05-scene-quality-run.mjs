import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

// B05-02 baseline: audit the shipped bytes, not visual quality inferred from file size.
const academy = JSON.parse(fs.readFileSync('docs/R2K5_1_ACADEMY_ASSET_MANIFEST.json', 'utf8'));
const epic = JSON.parse(fs.readFileSync('docs/R2K5_4_EPIC_ASSET_MANIFEST.json', 'utf8'));
const historicalComparison = JSON.parse(
  fs.readFileSync('docs/R2K5_4_STYLE_SEPARATION_AUDIT.json', 'utf8'));
const loader = fs.readFileSync('src/ui/scene-assets.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const workflow = fs.readFileSync('.github/workflows/v3-regression.yml', 'utf8');

const scenes = ['library', 'review', 'exam', 'stats'];
const themes = ['light', 'dark'];
const combinations = new Set();
const fingerprints = new Map();
const sources = { academy: new Set(), epic: new Set() };

assert.equal(academy.length, 16, 'Academy must have 16 approved mobile/desktop scene files');
assert.equal(epic.length, 16, 'Epic must have 16 approved mobile/desktop scene files');

for (const [world, assets] of [['academy', academy], ['epic', epic]]) {
  for (const asset of assets) {
    const expression = asset.path.match(
      /^assets\/learning\/styles\/(academy|epic)\/(library|review|exam|stats)-(light|dark)(-mobile)?\.webp$/);
    assert.ok(expression, `Bad scene asset path: ${asset.path}`);
    assert.equal(expression[1], world, 'World must match the asset directory');
    const [, , scene, theme, suffix] = expression;
    const variant = suffix ? 'mobile' : 'desktop';
    const key = [world, scene, theme, variant].join('/');
    assert.equal(combinations.has(key), false, `Duplicate scene slot ${key}`);
    combinations.add(key);

    const width = variant === 'mobile' ? 1080 : 2560;
    assert.equal(asset.width, width, `Unexpected width: ${key}`);
    assert.equal(asset.height, 1440, `Unexpected height: ${key}`);

    const file = fs.readFileSync(asset.path);
    assert.equal(file.length, asset.bytes, `Asset bytes differ from approved manifest: ${key}`);
    const hash = crypto.createHash('sha256').update(file).digest('hex');
    assert.equal(hash, asset.sha256, `Asset hash differs from approved manifest: ${key}`);
    assert.equal(fingerprints.has(hash), false,
      `Identical scene images appear in multiple slots: ${asset.path} / ${fingerprints.get(hash)}`);
    fingerprints.set(hash, asset.path);
    sources[world].add(world === 'academy' ? asset.source : asset.sourceFile);
    assert.ok(loader.includes(`./${asset.path}`), `Scene not wired through runtime: ${key}`);

    if (world === 'epic') {
      assert.equal(asset.derivedFromAcademy, false, `Epic must be independent: ${key}`);
      assert.equal(asset.sourceFamily, 'true-epic-v1', `Unexpected Epic source: ${key}`);
    }
  }
}
assert.equal(combinations.size, 32);
assert.equal(fingerprints.size, 32);
assert.equal(sources.academy.size, 8, 'Academy must have distinct source art per page/theme');
assert.equal(sources.epic.size, 8, 'Epic must have distinct source art per page/theme');
for (const source of sources.epic) {
  assert.equal(sources.academy.has(source), false, 'Epic may not reuse Academy source art');
}
const epicConcepts = new Set(epic.map(x => x.concept));
assert.equal(epicConcepts.size, 4, 'Four page types need four independent Epic concepts');
for (const scene of scenes) for (const theme of themes) {
  for (const world of ['academy', 'epic']) {
    for (const variant of ['desktop', 'mobile']) {
      assert.ok(combinations.has([world, scene, theme, variant].join('/')));
    }
  }
}

assert.equal(historicalComparison.length, 8);
for (const comparison of historicalComparison) {
  assert.equal(comparison.passes, true, 'Historical R2K.5.4 pixel separation threshold must pass');
  assert.ok(comparison.normalizedPixelDifference >= comparison.threshold);
}
assert.match(pkg.scripts.test, /b05-scene-quality-run\.mjs/);
assert.match(pkg.scripts['audit:b05-quality'], /b05-scene-quality-browser-run\.mjs/);
assert.match(workflow, /npm run audit:b05-quality/);
assert.match(workflow, /actions\/upload-artifact@v4/);

console.log('B05-02 PASS: 32 approved scene files, 32 independent hashes, 16 source scenes, 4 Epic concepts');
console.log('B05-02 note: historical image-separation values are not a live perceptual-quality measurement.');
console.log('B05-02 limitation: desktop sources are 2560x1440, mobile sources 1080x1440;');
console.log('B05-02 limitation: desktop2x/mobile2x files are absent, so browser DPR coverage must be measured.');
