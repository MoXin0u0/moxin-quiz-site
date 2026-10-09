// B01 conservative security regression. This is NOT a penetration test or a CSP enforcement claim.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { APP_CONFIG } from '../src/app/config.js';

const paths = [];
function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(file);
    else if (entry.name.endsWith('.js')) paths.push(file);
  }
}
visit('src');

const violations = [];
for (const file of paths) {
  const source = fs.readFileSync(file, 'utf8');
  // Executable string construction should never enter the application source.
  if (/\beval\s*\(/.test(source) || /\bnew\s+Function\s*\(/.test(source)) {
    violations.push(`Dynamic code evaluation found in ${file}`);
  }
}
const zip = fs.readFileSync('src/question-bank/zip-reader.js', 'utf8');
assert.match(zip, /reader\.read\(\)/);
assert.match(zip, /reader\.cancel\(\)/);
assert.doesNotMatch(zip, /new Response\(stream\)\.arrayBuffer\(\)/);
assert.equal(APP_CONFIG.cloud.googleDriveScope, 'https://www.googleapis.com/auth/drive.appdata');
assert.equal(APP_CONFIG.dbVersion, 4);
assert.ok(APP_CONFIG.packageLimits.maxSingleFileBytes > 0);
assert.ok(APP_CONFIG.packageLimits.maxUncompressedBytes >= APP_CONFIG.packageLimits.maxSingleFileBytes);

const entryPoints = ['index.html', 'app.html', 'privacy.html', 'terms.html'];
for (const file of entryPoints) {
  const markup = fs.readFileSync(file, 'utf8');
  if (/href\s*=\s*["']javascript:/i.test(markup)) {
    violations.push(`javascript: navigation href in ${file}`);
  }
}
assert.deepEqual(violations, [], violations.join('\n'));

const inlineCount = entryPoints.reduce((sum, file) => {
  const html = fs.readFileSync(file, 'utf8');
  return sum + (html.match(/<script\b(?![^>]*\bsrc\s*=)[^>]*>/gi) || []).length;
}, 0);
console.log(`B01 boundary regression PASS: ${paths.length} JS files, ${entryPoints.length} HTML entries, ZIP streaming and OAuth scope.`);
console.log(`INFO: ${inlineCount} inline script blocks are present. CSP enforcement remains a separately tracked compatibility hardening task; this scan cannot prove XSS safety.`);
