# Benchmark CLI

The project includes a command-line runner for the deterministic core benchmark.
This makes the baseline results reproducible outside the dashboard.

## Run

```bash
npm run benchmark:core
```

By default this uses seed `23` and writes generated files to
`benchmark-results/`.

Custom seed:

```bash
npm run benchmark:core -- --seed 101
```

Custom output directory:

```bash
npm run benchmark:core -- --out benchmark-results/seed-101 --seed 101
```

## Outputs

The runner writes:

- `core-benchmark-results.json`: full manifest, environments, agents, summary,
  and per-step rollout logs
- `core-benchmark-results.csv`: flat episode table for analysis
- `core-benchmark-summary.json`: aggregate success, violation, agent, and
  condition summary

`benchmark-results/` is ignored by git so local experiment outputs do not pollute
the repository history.

## Current Batch Shape

The core runner executes:

- 3 environments: DoorKey, SwitchBridge, Ownership
- 6 baseline agents
- 4 prompt conditions
- 72 total rollout episodes
