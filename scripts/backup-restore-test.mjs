import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const backupRoot = path.resolve(root, '.local', 'backups');
const supplied = process.argv[2];
if (!supplied) throw new Error('Pass a backup file under .local/backups');
const backup = path.resolve(root, supplied);
if (
  !(backup === backupRoot || backup.startsWith(`${backupRoot}${path.sep}`)) ||
  !backup.endsWith('.dump')
) {
  throw new Error('Backup must be a .dump file under .local/backups');
}
if (!existsSync(backup)) throw new Error('Backup file does not exist');

const target = process.env.RESTORE_TEST_DATABASE ?? 'muday_restore_test';
if (target !== 'muday_restore_test') throw new Error('Restore target must be muday_restore_test');
const containerPath = '/tmp/muday-restore-test.dump';

function run(arguments_, options = {}) {
  const result = spawnSync('docker', ['compose', ...arguments_], {
    cwd: root,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
  });
  if (result.status !== 0) throw new Error('Restore verification command failed');
  return result.stdout?.trim() ?? '';
}

run(['cp', backup, `muday-postgres:${containerPath}`]);
try {
  run([
    'exec',
    '-T',
    'muday-postgres',
    'dropdb',
    '-U',
    process.env.POSTGRES_USER || 'muday',
    '--if-exists',
    '--force',
    target,
  ]);
  run([
    'exec',
    '-T',
    'muday-postgres',
    'createdb',
    '-U',
    process.env.POSTGRES_USER || 'muday',
    target,
  ]);
  run([
    'exec',
    '-T',
    'muday-postgres',
    'pg_restore',
    '-U',
    process.env.POSTGRES_USER || 'muday',
    '-d',
    target,
    '--exit-on-error',
    containerPath,
  ]);
  const counts = run(
    [
      'exec',
      '-T',
      'muday-postgres',
      'psql',
      '-U',
      process.env.POSTGRES_USER || 'muday',
      '-d',
      target,
      '-At',
      '-c',
      "SELECT json_build_object('users',count(*),'active',count(*) FILTER (WHERE status='active')) FROM users;",
    ],
    { capture: true },
  );
  run([
    'exec',
    '-T',
    'muday-postgres',
    'psql',
    '-U',
    process.env.POSTGRES_USER || 'muday',
    '-d',
    target,
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    'SELECT COUNT(*) AS transaction_groups FROM transaction_groups;',
    '-c',
    'SELECT COUNT(*) AS events FROM events;',
  ]);
  process.stdout.write(`Restore verified in ${target}: ${counts}\n`);
} finally {
  run(['exec', '-T', 'muday-postgres', 'rm', '-f', containerPath]);
}
