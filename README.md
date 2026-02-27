# Bitburner Autonomous Runner

This repo now supports a **low-RAM starter path** for brand-new saves (8GB home), plus the modular main framework.

## Start from a fresh save (8GB home)

Run this first:

```text
run /starting/starter.js
```

What it does:

- scans the network
- attempts rooting with whatever crackers you own
- auto-deploys a tiny early worker to rooted servers
- picks a best early target and keeps hacking/growing/weakening it

Expected log line:

```text
[starter] hosts=... newRoots=... target=... threads=...
```

## Switch to the modular framework (after upgrades)

After you upgrade home RAM (recommended `>= 32GB`), run:

```text
run main.js
```

Phase 1 main framework currently provides:

- Network BFS discovery from `home`
- Root automation using available port crackers
- Fleet deployment for worker scripts (`hack/grow/weaken`)
- Boot loop skeleton in `main.js` with periodic status logging
- Runtime snapshot written to `/data/runtime-state.txt`

## Config

Tune values in `config/defaults.js`:

- `homeReserveGb` (default `16`)
- `loopIntervalMs`
- `statusIntervalMs`
- `starterTargets`

## Next phase

Phase 2 will add:

- Early-game money execution strategy integrated into modular scheduler
- automatic target scoring/selection for the main system
- active remote job placement in the `main.js` path
