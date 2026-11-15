import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const checks = [
  ['Node.js', process.execPath, ['--version']],
  ['npm', 'npm', ['--version']],
  ['Docker', 'docker', ['--version']],
  ['Docker Compose', 'docker', ['compose', 'version']],
  ['ffmpeg', 'ffmpeg', ['-version']],
];

let failed = false;

for (const [name, command, args] of checks) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
  });

  if (result.status === 0) {
    const output = `${result.stdout}${result.stderr}`.trim().split('\n')[0];
    console.log(`✓ ${name}: ${output || 'available'}`);
  } else {
    failed = true;
    console.error(`✗ ${name} is unavailable`);
  }
}

console.log(
  existsSync('.env')
    ? '✓ .env exists'
    : 'ℹ .env is not created yet; copy .env.example to .env before running applications',
);

if (failed) {
  process.exitCode = 1;
}
