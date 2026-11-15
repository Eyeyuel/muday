const baseUrl = process.env.BENCHMARK_API_URL ?? 'http://127.0.0.1:3001';
const samples = Number(process.env.BENCHMARK_SAMPLES ?? 20);
if (!Number.isInteger(samples) || samples < 1 || samples > 25)
  throw new Error('BENCHMARK_SAMPLES must be 1-25');
const times = [];
for (let index = 0; index < samples; index += 1) {
  const started = performance.now();
  const response = await fetch(`${baseUrl}/api/dashboard?period=month`, {
    headers: { Authorization: 'dev' },
  });
  if (!response.ok) throw new Error(`Dashboard benchmark failed with HTTP ${response.status}`);
  await response.arrayBuffer();
  times.push(performance.now() - started);
}
times.sort((a, b) => a - b);
const percentile = (value) =>
  times[Math.min(times.length - 1, Math.ceil(times.length * value) - 1)];
process.stdout.write(
  `${JSON.stringify({ samples, unit: 'ms', p50: percentile(0.5)?.toFixed(2), p90: percentile(0.9)?.toFixed(2), p95: percentile(0.95)?.toFixed(2), max: times.at(-1)?.toFixed(2) }, null, 2)}\n`,
);
