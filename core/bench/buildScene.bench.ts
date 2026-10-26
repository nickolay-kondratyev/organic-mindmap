import { DEFAULT_CONFIG } from '../src/core/config/config';
import { DEFAULT_EXTENSIONS } from '../src/core/extensions';
import { buildScene } from '../src/core/render/scene';
import { syntheticTree } from '../test-support/syntheticTree';

/**
 * `npm run bench`: how long one `buildScene` takes per map size. A report, not a gate: it never fails on time, and
 * `npm test` does not pick it up (own config, own include). Sizes cover a long note (200), a big one (500) and a
 * stress case (1,000). Fan-out 8 resembles a vault: ~8 entries per folder, ~8 sub-headings per heading.
 */
const NODE_COUNTS = [50, 200, 500, 1000];
/** Median of a few runs after one warm-up, so JIT and GC noise do not decide a regression. */
const RUNS = 5;
const BENCH_TIMEOUT_MS = 10 * 60 * 1000;

describe('buildScene on a synthetic vault-like tree (fan-out 8, default config)', () => {
  const rows: { nodes: number; medianMs: number; minMs: number }[] = [];

  for (const nodeCount of NODE_COUNTS) {
    it(`${nodeCount} nodes`, () => {
      const data = syntheticTree(nodeCount);
      buildScene(data, DEFAULT_CONFIG, DEFAULT_EXTENSIONS);
      const times: number[] = [];
      for (let run = 0; run < RUNS; run += 1) {
        const started = performance.now();
        buildScene(data, DEFAULT_CONFIG, DEFAULT_EXTENSIONS);
        times.push(performance.now() - started);
      }
      times.sort((a, b) => a - b);
      rows.push({ nodes: nodeCount, medianMs: times[Math.floor(RUNS / 2)] as number, minMs: times[0] as number });
    }, BENCH_TIMEOUT_MS);
  }

  // WHY process.stdout: the runner swallows `console.log` from hooks, and the report is the whole point.
  afterAll(() => {
    const lines = rows.map((row) => `${String(row.nodes).padStart(6)} nodes  median=[${row.medianMs.toFixed(1)} ms]  min=[${row.minMs.toFixed(1)} ms]`);
    process.stdout.write(`\nbuildScene bench (median of ${RUNS} runs)\n${lines.join('\n')}\n\n`);
  });
});
