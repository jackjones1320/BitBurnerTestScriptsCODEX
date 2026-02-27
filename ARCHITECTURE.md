# Bitburner Autonomous Runner – Proposed Architecture (Step B)

This document defines the final target architecture for an end-to-end autonomous Bitburner run from a fresh save.

## Design goals

- Single entrypoint (`main.js`) that orchestrates all subsystems.
- Deterministic scheduling and resource allocation.
- Reusable modules with low coupling and explicit responsibilities.
- Config-driven constants (RAM reserve, timing offsets, purchase caps, strategy toggles).
- Safe degradation when features are unavailable (port crackers, gang, corp, sleeves, singularity functions).

## Folder layout

```text
/main.js                         # Single bootstrap entrypoint

/config/
  defaults.js                    # Global config constants and tunables
  targets.js                     # Targeting strategy parameters and weighting

/lib/
  runtime/
    state.js                     # Persistent state read/write utilities
    logger.js                    # Structured logging + status snapshots
    timing.js                    # Sleep guards, jitter, and clock helpers

  net/
    scan.js                      # Full network discovery + graph mapping
    access.js                    # Rooting automation with available crackers
    deploy.js                    # SCP + remote launch helpers

  hw/
    ram.js                       # RAM accounting, reserved home RAM enforcement
    servers.js                   # Purchased server buy/replace/upgrade policy

  hack/
    formulas.js                  # Timing and thread math wrappers (formulas fallback)
    score.js                     # Target scoring and equal-opportunity rotation
    prep.js                      # Min-security + max-money preparation planner/executor
    batchPlan.js                 # HGW(W) plan construction and collision-safe offsets
    scheduler.js                 # Multi-batch queue builder/executor across hosts
    allocator.js                 # Thread splitting + placement across many servers

  progression/
    factions.js                  # Faction join/work/augmentation planning
    augs.js                      # Aug buy/install strategy
    gang.js                      # Gang creation, tasks, ascension, equipment
    corp.js                      # Corporation bootstrap + upgrades/divisions/products
    sleeves.js                   # Sleeve assignments and sync/shock policies

  ui/
    status.js                    # Tail/status lines for prep/batch cycle starts

/scripts/
  worker-hack.js                 # Pure worker: hack
  worker-grow.js                 # Pure worker: grow
  worker-weaken.js               # Pure worker: weaken

/tests/
  dryrun-plan.js                 # Offline sanity checks for timing/thread math
```

## 8GB bootstrap path (implemented)

To support fresh installs where `home` only has 8GB RAM, startup is split:

- `starting/starter.js` handles discovery/rooting and deploys `starting/early-worker.js` across rooted hosts.
- Deployment is remote-first (non-home hosts before `home`) so worker capacity appears even when local RAM is tight.
- `home` keeps a small reserve (`2GB`) to preserve terminal responsiveness.
- Once home RAM is upgraded, hand off control to `main.js` for full orchestration.

## Module responsibilities

### 1) Entrypoint / Control Plane

- `main.js` runs an infinite control loop with phases:
  1. Discover network and refresh rooted hosts.
  2. Maintain deployment footprint.
  3. Select targets and schedule prep/batches.
  4. Execute progression automations (factions/gang/corp/sleeves) opportunistically.
  5. Print periodic status summary and loop.

### 2) Network + Access

- `net/scan.js`: BFS from `home`, maintains adjacency map and metadata cache.
- `net/access.js`: checks required ports, opens what is possible, then nukes.
- `net/deploy.js`: asynchronously copies worker scripts and starts assigned jobs (awaits SCP completion before launch attempts).

### 3) Hacking Core

- `hack/score.js`: score targets using weighted money, security, growth, time, and hack chance.
- Equal-opportunity routing: top-N rotating pick and per-target cooldown to prevent one-target starvation.
- `hack/prep.js`: converges target to min security and max money before batching.
- `hack/batchPlan.js`: builds HGWW plans with strict offsets and shared landing window.
- `hack/scheduler.js`: supports multiple queued batches once target is prepped and RAM is available.
- `hack/allocator.js`: splits threads across rooted hosts while respecting host capacity and reserved home RAM.

### 4) Hardware Scaling

- `hw/servers.js`: purchases and upgrades servers up to configurable cap and RAM ladder.
- Replacement policy favors monotonic growth and avoids unnecessary churn.

### 5) Endgame Progression

- Independent automators for factions/augs/gang/corp/sleeves.
- Each subsystem checks availability (APIs, unlock conditions, funds) and no-ops safely when locked.

### 6) Observability

- `ui/status.js` prints one-line cycle headers when prep/batch starts containing:
  - current money / max money
  - current security / min security
  - hack/grow/weaken times
- `runtime/state.js` stores minimal JSON snapshots for continuity and anti-overlap locks.

## Execution model details

- Home RAM reserve (`config.defaults.homeReserveGb`, default 16 GB) is enforced by allocator.
- Collision prevention:
  - per-target active window locks;
  - schedule offsets include guard bands;
  - no mixed prep + batch concurrency on same target.
- Determinism:
  - all schedule times computed from a single capture of timing values per planning tick;
  - static delay constants in config;
  - avoid randomization except explicit tie-break rotation.

## Planned implementation phases

1. **Phase 1: Foundation**
   - config, logger/state, scan, access, deploy, worker scripts, boot loop skeleton.
2. **Phase 2: Early game automation**
   - money script fallback, auto-root/deploy, basic target scoring.
3. **Phase 3: Prep + deterministic batching**
   - prep convergence, HGWW planner, precise delay math, queueing batches.
4. **Phase 4: Fleet scaling**
   - purchased server automation and smarter thread allocator.
5. **Phase 5: Late game systems**
   - factions/augs, gang, corp, sleeves modules and integration.
6. **Phase 6: polish**
   - README runbook, tuning guide, dry-run checks.

## Runtime commands (target)

In Bitburner terminal (once scripts are copied into the game):

```text
run main.js
```

Expected high-level behavior:

- Starts scanning + rooting + deployment.
- Moves from basic income to prep to queued batches.
- Periodically logs progression subsystem actions as they unlock.
