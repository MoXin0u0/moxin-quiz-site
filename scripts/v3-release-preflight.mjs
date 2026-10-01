import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const errors = [];
const warnings = [];

const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const exists = file => fs.existsSync(path.join(root, file));

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function normalizeLocalPath(value) {
  if (!value || /^(?:https?:|data:|blob:|#)/i.test(value)) return null;
  const clean = value.split(/[?#]/, 1)[0].replace(/^\.\//, '');
  return clean || null;
}

function checkFile(file, label = 'resource') {
  if (!exists(file)) fail(`Missing ${label}: ${file}`);
}

function parsePngSize(file) {
  const buffer = fs.readFileSync(path.join(root, file));
  if (buffer.length < 24 || buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') {
    throw new Error(`${file} is not a valid PNG.`);
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

for (const file of [
  'index.html',
  'v3.html',
  'legacy-v2.html',
  'legacy-v2/index.html',
  'manifest.webmanifest',
  'service-worker.js',
  'package.json',
]) {
  checkFile(file, 'release file');
}

const productionHtml = exists('index.html') ? read('index.html') : '';
const compatibilityHtml = exists('v3.html') ? read('v3.html') : '';
const legacyHtml = exists('legacy-v2.html') ? read('legacy-v2.html') : '';

if (productionHtml && compatibilityHtml && productionHtml !== compatibilityHtml) {
  fail('index.html and v3.html must remain byte-identical during the release cutover.');
}

checkHtml('index.html', productionHtml);
checkHtml('v3.html', compatibilityHtml);

if (/\b(?:script\.js|style\.css)\b/.test(productionHtml)) {
  fail('index.html must not reference the legacy root script.js/style.css.');
}
if (/\b(?:script\.js|style\.css)\b/.test(compatibilityHtml)) {
  fail('v3.html must not reference the legacy root script.js/style.css.');
}

if (legacyHtml && !legacyHtml.includes('./legacy-v2/')) {
  fail('legacy-v2.html must redirect to ./legacy-v2/.');
}

for (const file of [
  'legacy-v2/index.html',
  'legacy-v2/script.js',
  'legacy-v2/style.css',
  'legacy-v2/question-banks.json',
]) {
  checkFile(file, 'legacy archive file');
}

for (const legacyRootFile of ['script.js', 'style.css', 'question-banks.json']) {
  if (exists(legacyRootFile)) {
    fail(`Legacy root file should be archived: ${legacyRootFile}`);
  }
}

for (const nav of [
  'data-nav-library',
  'data-nav-review',
  'data-nav-exam',
  'data-nav-stats',
  'data-nav-tools',
  'data-nav-settings',
]) {
  if (!productionHtml.includes(nav)) fail(`Missing main navigation entry in index.html: ${nav}`);
}

let manifest = null;
try {
  manifest = JSON.parse(read('manifest.webmanifest'));
} catch (error) {
  fail(`Invalid manifest.webmanifest JSON: ${error.message}`);
}

if (manifest) {
  if (manifest.start_url !== './') {
    fail(`manifest start_url must be ./ after cutover, got ${manifest.start_url}`);
  }
  if (manifest.scope !== './') {
    fail(`manifest scope must be ./, got ${manifest.scope}`);
  }

  const iconRequirements = new Map([
    ['192x192', [192, 192]],
    ['512x512', [512, 512]],
  ]);

  for (const icon of manifest.icons || []) {
    const iconPath = normalizeLocalPath(icon.src);
    if (!iconPath) {
      fail(`Manifest icon must be local: ${icon.src}`);
      continue;
    }

    checkFile(iconPath, 'manifest icon');

    if (exists(iconPath) && icon.type === 'image/png') {
      try {
        const actual = parsePngSize(iconPath);
        const declared = String(icon.sizes || '').split(/\s+/);
        for (const size of declared) {
          const expected = iconRequirements.get(size);
          if (expected && (actual.width !== expected[0] || actual.height !== expected[1])) {
            fail(`${iconPath} declares ${size} but is ${actual.width}x${actual.height}.`);
          }
        }
      } catch (error) {
        fail(error.message);
      }
    }
  }
}

const sw = read('service-worker.js');
const shellBlock = sw.match(/const\s+APP_SHELL\s*=\s*\[([\s\S]*?)\];/);
if (!shellBlock) {
  fail('service-worker.js does not expose an APP_SHELL array.');
} else {
  const shellRefs = [...shellBlock[1].matchAll(/['"]\.\/([^'"]+)['"]/g)].map(match => match[1]);
  if (!shellRefs.includes('index.html')) fail('Service Worker App Shell must include index.html.');
  if (!shellRefs.includes('v3.html')) fail('Service Worker App Shell must retain v3.html compatibility entry.');
  for (const ref of shellRefs) checkFile(ref, 'Service Worker App Shell resource');
}

if (!/cache\.match\('\.\/index\.html'\)/.test(sw)) {
  fail('Service Worker navigation fallback must prefer ./index.html.');
}

const codeFiles = [
  ...walk(path.join(root, 'src')).filter(file => file.endsWith('.js')),
  ...walk(path.join(root, 'tests')).filter(file => file.endsWith('.mjs')),
];

for (const absolute of codeFiles) {
  const source = fs.readFileSync(absolute, 'utf8');
  const imports = [
    ...source.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g),
  ].map(match => match[1]);

  for (const specifier of imports) {
    if (!specifier.startsWith('.')) continue;
    const resolved = path.resolve(path.dirname(absolute), specifier);
    if (!fs.existsSync(resolved)) {
      fail(`Missing import target: ${path.relative(root, absolute)} -> ${specifier}`);
    }
  }
}

for (const absolute of [...codeFiles, path.join(root, 'service-worker.js')]) {
  const result = spawnSync(process.execPath, ['--check', absolute], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    fail(`Syntax error in ${path.relative(root, absolute)}: ${result.stderr.trim()}`);
  }
}

const styleDir = path.join(root, 'styles');
const cssFiles = walk(styleDir).filter(file => file.endsWith('.css') && path.basename(file).startsWith('v3'));
const css = cssFiles.map(file => fs.readFileSync(file, 'utf8')).join('\n');
const refs = new Set([...css.matchAll(/var\((--[\w-]+)/g)].map(match => match[1]));
const defs = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map(match => match[1]));
for (const ref of refs) {
  if (!defs.has(ref)) fail(`Undefined CSS custom property: ${ref}`);
}

if (/https?:\/\//i.test(productionHtml)) {
  warn('index.html contains an absolute HTTP(S) URL; review local-first/offline requirement.');
}
if (/https?:\/\//i.test(shellBlock?.[1] || '')) {
  fail('Service Worker APP_SHELL must not depend on remote HTTP(S) assets.');
}

console.log(`V3 release preflight: ${errors.length ? 'FAIL' : 'PASS'}`);
console.log(
  `Checked production index + v3 alias, ${codeFiles.length} module/test files, ` +
  `${cssFiles.length} v3 CSS files.`
);

for (const message of warnings) console.warn(`WARN: ${message}`);
for (const message of errors) console.error(`ERROR: ${message}`);

if (errors.length) process.exit(1);

function checkHtml(name, html) {
  if (!html) return;

  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  const seenIds = new Set();
  for (const id of ids) {
    if (seenIds.has(id)) fail(`Duplicate HTML id in ${name}: ${id}`);
    seenIds.add(id);
  }

  const refs = [
    ...html.matchAll(/\b(?:src|href)="([^"]+)"/g),
  ].map(match => normalizeLocalPath(match[1])).filter(Boolean);

  for (const ref of refs) checkFile(ref, `${name} resource`);
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  const output = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...walk(absolute));
    else output.push(absolute);
  }
  return output;
}
