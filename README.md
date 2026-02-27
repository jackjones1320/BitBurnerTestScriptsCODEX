# Bitburner Autonomous Runner

Phase 3 prep + deterministic batch foundations are now implemented.

## Current capabilities (Phase 3 foundation)

- Network BFS discovery from `home`.
- Root automation using whichever port crackers are currently present.
- Fleet deployment for worker scripts (`hack/grow/weaken`).
- 8GB-safe bootstrap path (`starter/starter.js`) that pushes `starter/early-worker.js` to rooted servers first.
- Boot loop in `main.js` with periodic status logging and automatic `/scripts/worker-{hack,grow,weaken}.js` launch across runner hosts.
- Automatic target scoring/selection with a rotating top target pool.
- Target prep cycle that converges security and money before entering batch mode.
- Deterministic HGWW batch plan creation with collision-safe landing offsets.
- Basic multi-host batch dispatcher that splits threads across available runner capacity.
- Active remote job placement: each runner host is assigned the best available target and an operation (`weaken`, `grow`, or `hack`) based on live server state.
- Persistent runtime snapshot written to `/data/runtime-state.txt`.

## Getting started

### Fresh save / 8GB home RAM

1. Run the low-RAM bootstrap script:

   ```text
   run starter/starter.js
   ```

2. Let it discover + root hosts and deploy `starter/early-worker.js` to remote servers such as `n00dles`.
3. Keep it running while you buy TOR/programs and upgrade home RAM.
4. Once home RAM is comfortably larger (recommended `>= 32GB`), switch to the full runner:

   ```text
   run main.js
   ```

### Normal startup (already upgraded home)

```text
run main.js
```

Expected tail output (every ~30s by default):

```text
[main] hosts=... rooted=... newRoot=... copied=... targets=... launchedHosts=... launchedThreads=...
```

## Config

Tune values in `config/defaults.js`:

- `homeReserveGb` (default `16`)
- `loopIntervalMs`
- `statusIntervalMs`
- `phase2.targetPoolSize`
- `phase2.minSecurityBuffer`
- `phase2.growMoneyThreshold`
- `starterTargets`

## Next phase

Phase 4 will add:

- Purchased server automation and replacement policy
- Smarter allocator heuristics with per-target queue balancing
- Expanded runtime telemetry for batch throughput
