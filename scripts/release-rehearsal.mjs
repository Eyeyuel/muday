import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
function run(command, arguments_) {
  const result = spawnSync(command, arguments_, { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command} ${arguments_.join(' ')} failed`);
}

run('npm', ['run', 'ci']);
run('npm', ['run', 'prod:config']);
run('npm', ['run', 'backup:create']);
const directory = path.join(root, '.local', 'backups');
const backups = (await readdir(directory)).filter((name) => name.endsWith('.dump')).sort();
const latest = backups.at(-1);
if (!latest) throw new Error('Backup rehearsal did not create a dump');
run('npm', ['run', 'backup:restore:test', '--', path.join('.local', 'backups', latest)]);
run('npm', ['run', 'analytics:report']);
run('npm', ['run', 'queues:inspect']);
process.stdout.write('Local release rehearsal passed.\n');
