import fs from 'node:fs';
import path from 'node:path';
import { migrateLegacyBank } from '../src/data/migration/legacy-v1-to-v2.js';
import { validatePackage } from '../src/question-bank/validator.js';

const root = process.cwd();
const legacyPath = path.join(
  root,
  'questions/ERP_Planner_202509_V06_improved_explanations.json',
);
const targetDir = path.join(
  root,
  'author-banks/ERP_Planner_202509_V06',
);
const catalogPath = path.join(root, 'author-banks.json');
const packagePath = path.join(root, 'package.json');
const indexPath = path.join(root, 'index.html');
const v3Path = path.join(root, 'v3.html');
const swPath = path.join(root, 'service-worker.js');

if (!fs.existsSync(legacyPath)) {
  throw new Error(`Legacy ERP source not found: ${legacyPath}`);
}

const legacy = JSON.parse(fs.readFileSync(legacyPath, 'utf8'));
const migrated = migrateLegacyBank(legacy);

if (migrated.questions.length !== 443) {
  throw new Error(`ERP 題數錯誤：預期 443，實際 ${migrated.questions.length}`);
}

const manifest = {
  ...migrated.manifest,
  id: 'ERP_Planner_202509_V06',
  name: 'ERP 規劃師題庫 2025.09 V06',
  description: '依據既有 ERP 規劃師題庫整理之墨忻刷題網 Schema v2 作者題庫。',
  version: '1.2.0',
  author: '墨忻',
  language: 'zh-TW',
  questionCount: migrated.questions.length,
  updatedAt: new Date().toISOString(),
  metadata: {
    ...(migrated.manifest.metadata || {}),
    category: 'ERP 規劃師',
    sourceType: 'author',
    migratedFrom: 'legacy-v1',
    legacySource: 'questions/ERP_Planner_202509_V06_improved_explanations.json',
  },
};

const report = validatePackage({
  manifest,
  questions: migrated.questions,
  assetPaths: migrated.assetPaths || [],
});

if (!report.valid) {
  console.error(JSON.stringify(report, null, 2));
  throw new Error(
    `ERP Schema v2 驗證失敗：${report.summary?.errors ?? 0} 個錯誤`,
  );
}

fs.mkdirSync(targetDir, { recursive: true });
fs.writeFileSync(
  path.join(targetDir, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
fs.writeFileSync(
  path.join(targetDir, 'questions.json'),
  `${JSON.stringify(migrated.questions, null, 2)}\n`,
);

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const entry = catalog.find(item => item.id === 'ERP_Planner_202509_V06');
if (!entry) throw new Error('author-banks.json 找不到 ERP catalog 項目。');

entry.name = manifest.name;
entry.description = '原生 Schema v2 ERP 規劃師作者題庫。';
entry.version = manifest.version;
entry.author = manifest.author;
entry.category = 'ERP 規劃師';
entry.questionCount = manifest.questionCount;
entry.source = {
  kind: 'v2-package',
  manifestUrl: './author-banks/ERP_Planner_202509_V06/manifest.json',
  questionsUrl: './author-banks/ERP_Planner_202509_V06/questions.json',
};

fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);

for (const htmlPath of [indexPath, v3Path]) {
  let html = fs.readFileSync(htmlPath, 'utf8');
  html = html
    .replace('<title>墨忻刷題網 v3.1</title>', '<title>墨忻刷題網 v3.2</title>')
    .replace(
      '<span class="version-badge">v3.1</span>',
      '<span class="version-badge">v3.2</span>',
    );
  fs.writeFileSync(htmlPath, html);
}

let sw = fs.readFileSync(swPath, 'utf8');
sw = sw.replace(
  /const CACHE_VERSION = '[^']+';/,
  "const CACHE_VERSION = 'moxin-quiz-v3-3.2.0-1';",
);
fs.writeFileSync(swPath, sw);

const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
if (!pkg.scripts.test.includes('node tests/v32-run.mjs')) {
  pkg.scripts.test += ' && node tests/v32-run.mjs';
}
fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

console.log('ERP native Schema v2 generation complete.');
console.log(`Questions: ${migrated.questions.length}`);
console.log(`Warnings: ${report.summary?.warnings ?? 0}`);
