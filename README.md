# Bitburner Autonomous Runner

Phase 4 fleet scaling has been started with purchased server management and a smarter allocator.

## Current capabilities

- Network BFS discovery from `home`.
- Root automation using whichever port crackers are currently present.
- Fleet deployment for worker scripts (`hack/grow/weaken`) with incremental sync to avoid repeated full SCP every loop.
- 8GB-safe bootstrap path (`starter/starter.js`) that pushes `starter/early-worker.js` to rooted servers first.
- Boot loop in `main.js` with periodic status logging and automatic `/scripts/worker-{hack,grow,weaken}.js` launch across runner hosts.
- Automatic target scoring/selection with stickiness to reduce target thrashing when scores are close.
- Target prep cycle that converges security and money before entering batch mode.
- Deterministic HGWW batch plan creation with collision-safe landing offsets.
- Smarter multi-host dispatcher with job-priority sorting, best-fit thread placement, and dropped-thread telemetry.
- Purchased server lifecycle automation (buy and replace weakest when affordable) with conservative money reserve and spend notifications.
- Hacknet automation with ROI/payback-based node purchase and upgrades.
- Persistent runtime snapshot written to `/data/runtime-state.txt`.
- Automatic coding contract sweeps with built-in solvers for common contract types.

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
[main] hosts=... rooted=... newRoot=... copied=... mode=... target=... fleet=... hacknet=... launchedScripts=... launchedThreads=... droppedThreads=... utilization=...%
```

## Config

Tune values in `config/defaults.js`:

- `homeReserveGb` (default `16`)
- `loopIntervalMs`
- `statusIntervalMs`
- `phase2.targetPoolSize`
- `phase2.minSecurityBuffer`
- `phase2.growMoneyThreshold`
- `phase2.targetStickMs`
- `phase2.switchLeadPct`
- `phase4.purchasedServers.enabled`
- `phase4.purchasedServers.minRamGb`
- `phase4.purchasedServers.homeRamFraction`
- `phase4.purchasedServers.moneyReserve`
- `phase4.hacknet.enabled`
- `phase4.hacknet.moneyReserve`
- `phase4.hacknet.maxPaybackSeconds`
- `deploy.syncIntervalMs`
- `contracts.enabled`
- `contracts.intervalMs`
- `starterTargets`

## Personal utility scripts

- `run scripts/personal-connect-list.js`
  - Prints all currently connectable servers (by your hacking level), their route from `home`, and opens a clickable picker via `ns.prompt`.
  - If you have Singularity access, the selected host is auto-connected.
- `run scripts/personal-backdoor-all.js`
  - Walks every rooted + hackable host that does not yet have a backdoor installed and installs backdoors automatically.
  - Requires Singularity access (Source-File 4).
- `run scripts/personal-target-explain.js [topN]`
  - Prints the target-scoring formula and a breakdown for the top ranked targets so you can see why a target wins.
  - `serverGrowthStat` in that output is `ns.getServerGrowth(host)` (the server growth stat), not a max/current money growth ratio.
  - Also shows where `n00dles` currently stands.

## Next phase

Next up:

- Per-target queue balancing and anti-overlap locks across multiple concurrent targets
- Throughput-aware scheduling cadence tuning
