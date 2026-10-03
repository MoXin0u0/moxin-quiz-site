import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const commands = String(pkg.scripts?.test || '')
  .split(/\s*&&\s*/)
  .map(item => item.trim())
  .filter(Boolean);

if (!commands.length) {
  console.error('No test commands found in package.json scripts.test');
  process.exit(1);
}

const failures = [];
let passed = 0;

for (const command of commands) {
  const result = spawnSync(command, {
    shell: true,
    encoding: 'utf8',
    stdio: 'pipe',
  });

  if (result.status === 0) {
    passed += 1;
    console.log(`PASS ${command}`);
    continue;
  }

  failures.push({
    command,
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  });
  console.error(`FAIL ${command}`);
}

console.log(`\nIndependent regression sweep: ${passed} passed / ${failures.length} failed.`);

if (failures.length) {
  for (const failure of failures) {
    console.error(`\n===== ${failure.command} =====`);
    if (failure.stdout.trim()) console.error(failure.stdout.trim());
    if (failure.stderr.trim()) console.error(failure.stderr.trim());
  }
  process.exit(1);
}

console.log('All individual regression commands passed.');
