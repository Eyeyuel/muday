import { chmod, mkdir, open, rename, stat, unlink } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const directory = path.join(root, '.local', 'backups');
const stamp = new Date().toISOString().replaceAll(':', '').replaceAll('.', '-');
const finalPath = path.join(directory, `muday-${stamp}.dump`);
const temporaryPath = `${finalPath}.partial`;
await mkdir(directory, { recursive: true, mode: 0o700 });

async function run(command, arguments_, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, { cwd: root, stdio: options.stdio ?? 'inherit' });
    child.once('error', reject);
    child.once('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${command} failed`))));
  });
}

try {
  const output = await open(temporaryPath, 'w', 0o600);
  try {
    await run(
      'docker',
      [
        'compose',
        'exec',
        '-T',
        'muday-postgres',
        'pg_dump',
        '-Fc',
        '-U',
        process.env.POSTGRES_USER || 'muday',
        '-d',
        process.env.POSTGRES_DB || 'muday',
      ],
      { stdio: ['ignore', output.fd, 'inherit'] },
    );
  } finally {
    await output.close();
  }
  const input = await open(temporaryPath, 'r');
  try {
    await run('docker', ['compose', 'exec', '-T', 'muday-postgres', 'pg_restore', '--list'], {
      stdio: [input.fd, 'ignore', 'inherit'],
    });
  } finally {
    await input.close();
  }
  await chmod(temporaryPath, 0o600);
  await rename(temporaryPath, finalPath);
  const details = await stat(finalPath);
  process.stdout.write(
    `Backup verified: ${path.relative(root, finalPath)} (${details.size} bytes)\n`,
  );
} catch (error) {
  await unlink(temporaryPath).catch(() => undefined);
  throw error;
}
