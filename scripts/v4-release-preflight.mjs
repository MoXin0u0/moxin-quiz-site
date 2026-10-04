import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const errors = [];
const warnings = [];

const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const exists = file => fs.existsSync(path.join(root, file));

const fail = message => errors.push(message);
const warn = message => warnings.push(message);

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
  'app.html',
  'v3.html',
  'legacy-v2.html',
  'legacy-v2/index.html',
  'manifest.webmanifest',
  'service-worker.js',
  'package.json',
  'styles/v41-landing.css',
  'src/app/landing.js',
]) {
  checkFile(file, 'release file');
}

const landing = exists('index.html') ? read('index.html') : '';
const app = exists('app.html') ? read('app.html') : '';
const compatibility = exists('v3.html') ? read('v3.html') : '';
const legacy = exists('legacy-v2.html') ? read('legacy-v2.html') : '';

if (app && compatibility && app !== compatibility) {
  fail('app.html and v3.html must remain byte-identical.');
}

checkHtml('index.html', landing);
checkHtml('app.html', app);
checkHtml('v3.html', compatibility);

if (!landing.includes('class="landing-body"')) fail('index.html must be the public landing page.');
if (!landing.includes('href="./app.html"')) fail('Landing page must link to ./app.html.');
if (landing.includes('src/app/main.js')) fail('Landing page must not bootstrap the Learning Studio runtime.');

for (const nav of [
  'data-nav-library',
  'data-nav-review',
  'data-nav-exam',
  'data-nav-stats',
  'data-nav-tools',
  'data-nav-settings',
]) {
  if (!app.includes(nav)) fail(`Missing app navigation entry: ${nav}`);
}

if (!app.includes('src/app/main.js')) fail('app.html must load src/app/main.js.');

if (legacy && !legacy.includes('./legacy-v2/')) {
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
  if (exists(legacyRootFile)) fail(`Legacy root file should be archived: ${legacyRootFile}`);
}

let manifest = null;
try {
  manifest = JSON.parse(read('manifest.webmanifest'));
} catch (error) {
  fail(`Invalid manifest.webmanifest JSON: ${error.message}`);
}

if (manifest) {
  if (manifest.start_url !== './app.html') {
    fail(`manifest start_url must be ./app.html, got ${manifest.start_url}`);
  }
  if (manifest.scope !== './') fail(`manifest scope must be ./, got ${manifest.scope}`);

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
        for (const size of String(icon.sizes || '').split(/\s+/)) {
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
  const refs = [...shellBlock[1].matchAll(/['"]\.\/([^'"]+)['"]/g)].map(match => match[1]);
  for (const required of [
    'index.html',
    'app.html',
    'v3.html',
    'styles/v41-landing.css',
    'src/app/landing.js',
  ]) {
    if (!refs.includes(required)) fail(`Service Worker App Shell missing ${required}.`);
  }
  for (const ref of refs) checkFile(ref, 'Service Worker App Shell resource');
}

if (!/cache\.match\('\.\/index\.html'\)/.test(sw)) {
  fail('Service Worker navigation fallback must include ./index.html.');
}
if (!/cache\.match\('\.\/app\.html'\)/.test(sw)) {
  fail('Service Worker navigation fallback must include ./app.html.');
}

const codeFiles = [
  ...walk(path.join(root, 'src')).filter(file => file.endsWith('.js')),
  ...walk(path.join(root, 'tests')).filter(file => file.endsWith('.mjs')),
];

for (const absolute of codeFiles) {
  const source = fs.readFileSync(absolute, 'utf8');
  const imports = [...source.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g)].map(match => match[1]);
  for (const specifier of imports) {
    if (!specifier.startsWith('.')) continue;
    const resolved = path.resolve(path.dirname(absolute), specifier);
    if (!fs.existsSync(resolved)) {
      fail(`Missing import target: ${path.relative(root, absolute)} -> ${specifier}`);
    }
  }
}

for (const absolute of [...codeFiles, path.join(root, 'service-worker.js')]) {
  const result = spawnSync(process.execPath, ['--check', absolute], { encoding: 'utf8' });
  if (result.status !== 0) {
    fail(`Syntax error in ${path.relative(root, absolute)}: ${result.stderr.trim()}`);
  }
}

if (/https?:\/\//i.test(landing)) {
  warn('Landing page contains an absolute HTTP(S) URL; review offline/local-first requirement.');
}
if (/https?:\/\//i.test(shellBlock?.[1] || '')) {
  fail('Service Worker APP_SHELL must not depend on remote HTTP(S) assets.');
}

console.log(`V4.1 release preflight: ${errors.length ? 'FAIL' : 'PASS'}`);
console.log(`Checked landing + app + v3 compatibility, ${codeFiles.length} module/test files.`);

for (const message of warnings) console.warn(`WARN: ${message}`);
for (const message of errors) console.error(`ERROR: ${message}`);

if (errors.length) process.exit(1);

function checkHtml(name, html) {
  if (!html) return;
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) fail(`Duplicate HTML id in ${name}: ${id}`);
    seen.add(id);
  }

  const refs = [...html.matchAll(/\b(?:src|href)="([^"]+)"/g)]
    .map(match => normalizeLocalPath(match[1]))
    .filter(Boolean);

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
