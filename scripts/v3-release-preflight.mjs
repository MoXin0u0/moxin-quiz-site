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

// Core release files
for (const file of [
  'v3.html',
  'manifest.webmanifest',
  'service-worker.js',
  'package.json',
]) checkFile(file, 'release file');

const html = read('v3.html');

// Duplicate IDs
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const seenIds = new Set();
for (const id of ids) {
  if (seenIds.has(id)) fail(`Duplicate HTML id: ${id}`);
  seenIds.add(id);
}

// HTML local resources
const htmlRefs = [
  ...html.matchAll(/\b(?:src|href)="([^"]+)"/g),
].map(match => normalizeLocalPath(match[1])).filter(Boolean);

for (const ref of htmlRefs) checkFile(ref, 'HTML resource');

if (/\b(?:script\.js|style\.css)\b/.test(html)) {
  fail('v3.html must not reference the legacy root script.js/style.css.');
}

// Required nav entries
for (const nav of [
  'data-nav-library',
  'data-nav-review',
  'data-nav-exam',
  'data-nav-stats',
  'data-nav-settings',
]) {
  if (!html.includes(nav)) fail(`Missing main navigation entry: ${nav}`);
}

// Manifest
let manifest = null;
try {
  manifest = JSON.parse(read('manifest.webmanifest'));
} catch (error) {
  fail(`Invalid manifest.webmanifest JSON: ${error.message}`);
}

if (manifest) {
  if (manifest.start_url !== './v3.html') {
    fail(`manifest start_url must be ./v3.html, got ${manifest.start_url}`);
  }
  if (manifest.display !== 'standalone') {
    warn(`manifest display is ${manifest.display}; standalone is expected for installable app UX.`);
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

// Service Worker App Shell resources
const sw = read('service-worker.js');
const shellBlock = sw.match(/const\s+APP_SHELL\s*=\s*\[([\s\S]*?)\];/);
if (!shellBlock) {
  fail('service-worker.js does not expose an APP_SHELL array.');
} else {
  const shellRefs = [...shellBlock[1].matchAll(/['"]\.\/([^'"]+)['"]/g)].map(match => match[1]);
  if (!shellRefs.includes('v3.html')) fail('Service Worker App Shell must include v3.html.');
  for (const ref of shellRefs) checkFile(ref, 'Service Worker App Shell resource');
}

// Resolve relative ES module imports.
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

// Syntax check every JS/MJS file plus Service Worker.
for (const absolute of [...codeFiles, path.join(root, 'service-worker.js')]) {
  const result = spawnSync(process.execPath, ['--check', absolute], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    fail(`Syntax error in ${path.relative(root, absolute)}: ${result.stderr.trim()}`);
  }
}

// CSS custom property audit across v3 styles.
const styleDir = path.join(root, 'styles');
const cssFiles = walk(styleDir).filter(file => file.endsWith('.css') && path.basename(file).startsWith('v3'));
const css = cssFiles.map(file => fs.readFileSync(file, 'utf8')).join('\n');
const refs = new Set([...css.matchAll(/var\((--[\w-]+)/g)].map(match => match[1]));
const defs = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map(match => match[1]));
for (const ref of refs) {
  if (!defs.has(ref)) fail(`Undefined CSS custom property: ${ref}`);
}

// No remote runtime dependencies in v3 entry or SW shell.
if (/https?:\/\//i.test(html)) {
  warn('v3.html contains an absolute HTTP(S) URL; review local-first/offline requirement.');
}
if (/https?:\/\//i.test(shellBlock?.[1] || '')) {
  fail('Service Worker APP_SHELL must not depend on remote HTTP(S) assets.');
}

console.log(`V3 release preflight: ${errors.length ? 'FAIL' : 'PASS'}`);
console.log(`Checked ${codeFiles.length} module/test files, ${cssFiles.length} v3 CSS files, ${ids.length} HTML IDs.`);

for (const message of warnings) console.warn(`WARN: ${message}`);
for (const message of errors) console.error(`ERROR: ${message}`);

if (errors.length) process.exit(1);

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
