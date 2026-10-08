import fs from 'node:fs';
import assert from 'node:assert/strict';
import { APP_CONFIG } from '../src/app/config.js';

const BASELINE_COMMIT = 'bc71d9514ef7d66f314c7e6d64f680c2f88fd7a9';

assert.equal(APP_CONFIG.appName, 'MoXin Quiz');
assert.equal(APP_CONFIG.schemaVersion, '2.0');
assert.equal(APP_CONFIG.dbName, 'moxin-quiz-v3');
assert.ok(APP_CONFIG.dbVersion >= 3);

const baselineDoc = fs.readFileSync(new URL('../docs/v5-baseline.md', import.meta.url), 'utf8');
assert.match(baselineDoc, new RegExp(BASELINE_COMMIT));
assert.match(baselineDoc, /IndexedDB version: `3`/);

const appHtml = fs.readFileSync(new URL('../app.html', import.meta.url), 'utf8');
const v3Html = fs.readFileSync(new URL('../v3.html', import.meta.url), 'utf8');
assert.equal(appHtml, v3Html, 'app.html and v3.html must remain byte-identical at the V5 baseline');

const packageJson = JSON.parse(
  fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')
);
assert.equal(typeof packageJson.scripts?.test, 'string');
assert.equal(typeof packageJson.scripts?.preflight, 'string');

console.log(`V5 baseline contract passed against V4.1 base ${BASELINE_COMMIT}.`);
