import { spawnSync } from 'node:child_process';

const forbiddenTrackedPathPatterns = [
  /^\.env$/,
  /^\.env\.(?!example$|test\.example$|production\.example$)/,
  /(^|\/)node_modules\//,
  /(^|\/)dist\//,
  /^\.local\//,
  /apps\/backend\/src\/generated\//,
  /\.(?:ogg|opus|wav|mp3)$/i,
  /\.(?:gguf|bin|safetensors)$/i,
];

function git(args) {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
  return result.stdout;
}

const trackedFiles = git(['ls-files']).split('\n').filter(Boolean);
const forbidden = trackedFiles.filter((file) =>
  forbiddenTrackedPathPatterns.some((pattern) => pattern.test(file)),
);

if (forbidden.length > 0) {
  console.error('Forbidden generated, secret, audio, or model files are tracked:');
  forbidden.forEach((file) => console.error(`- ${file}`));
  process.exit(1);
}

const whitespaceCheck = spawnSync('git', ['diff', '--check'], {
  encoding: 'utf8',
});
if (whitespaceCheck.status !== 0) {
  process.stderr.write(whitespaceCheck.stdout);
  process.stderr.write(whitespaceCheck.stderr);
  process.exit(whitespaceCheck.status ?? 1);
}

console.log('✓ Repository tracking and whitespace checks passed');
