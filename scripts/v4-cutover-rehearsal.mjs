import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const outDir = path.resolve(process.env.CUTOVER_REPORT_DIR || 'artifacts/rc1-main-cutover-rehearsal');
fs.mkdirSync(outDir, { recursive: true });

const mainRef = process.env.CUTOVER_MAIN_REF || 'origin/main';
const candidateRef = process.env.CUTOVER_CANDIDATE_REF || 'HEAD';

function git(args, { allowFailure = false } = {}) {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
  });
  if (!allowFailure && result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed:\n${result.stderr || result.stdout}`);
  }
  return result;
}

function value(args) {
  return git(args).stdout.trim();
}

const mainSha = value(['rev-parse', mainRef]);
const candidateSha = value(['rev-parse', candidateRef]);
const mergeBase = value(['merge-base', mainRef, candidateRef]);

const ancestor = git(['merge-base', '--is-ancestor', mainRef, candidateRef], { allowFailure: true });
const mainIsAncestor = ancestor.status === 0;

const ahead = Number(value(['rev-list', '--count', `${mainRef}..${candidateRef}`]));
const behind = Number(value(['rev-list', '--count', `${candidateRef}..${mainRef}`]));
const changedFiles = value(['diff', '--name-only', `${mainRef}...${candidateRef}`])
  .split('\n')
  .map(item => item.trim())
  .filter(Boolean);

const candidateFiles = value(['ls-tree', '-r', '--name-only', candidateRef])
  .split('\n')
  .filter(Boolean);

const forbiddenInstallerFiles = candidateFiles.filter(file =>
  /^\.github\/workflows\/apply-.*\.ya?ml$/.test(file) ||
  /^scripts\/apply-.*\.mjs$/.test(file)
);

const checks = {
  mainIsAncestor,
  aheadGreaterThanZero: ahead > 0,
  behindIsZero: behind === 0,
  mergeBaseIsMain: mergeBase === mainSha,
  noOneTimeInstallers: forbiddenInstallerFiles.length === 0,
};

const failures = Object.entries(checks)
  .filter(([, ok]) => !ok)
  .map(([name]) => name);

const report = {
  generatedAt: new Date().toISOString(),
  repository: process.env.GITHUB_REPOSITORY || null,
  mainRef,
  candidateRef,
  mainSha,
  candidateSha,
  mergeBase,
  ahead,
  behind,
  changedFileCount: changedFiles.length,
  forbiddenInstallerFiles,
  checks,
  failures,
};

fs.writeFileSync(
  path.join(outDir, 'git-state.json'),
  JSON.stringify(report, null, 2),
  'utf8',
);

const markdown = `# RC1 Main Cutover Rehearsal — Git State

- Generated: ${report.generatedAt}
- Main: \`${mainSha}\`
- Candidate: \`${candidateSha}\`
- Merge base: \`${mergeBase}\`
- Ahead: **${ahead}**
- Behind: **${behind}**
- Changed files: **${changedFiles.length}**
- Main is ancestor: **${mainIsAncestor ? 'YES' : 'NO'}**
- One-time installer files in candidate: **${forbiddenInstallerFiles.length}**

## Contract

- main must be an ancestor of the release candidate
- candidate must be ahead of main
- candidate must not be behind main
- merge base must equal current main
- one-time apply workflows / scripts must not enter production

${failures.length ? `## Failures\n\n${failures.map(item => `- ${item}`).join('\n')}\n` : '## Result\n\nPASS\n'}
`;

fs.writeFileSync(path.join(outDir, 'git-state.md'), markdown, 'utf8');
console.log(markdown);

if (failures.length) process.exit(1);
