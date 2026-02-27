# Bitburner Autonomous Runner

Phase 1 foundation is now implemented.

## Current capabilities (Phase 1)

- Network BFS discovery from `home`.
- Root automation using whichever port crackers are currently present.
- Fleet deployment for worker scripts (`hack/grow/weaken`).
- Boot loop skeleton in `main.js` with periodic status logging.
- Persistent runtime snapshot written to `/data/runtime-state.txt`.

## Start

In Bitburner terminal:

```text
run main.js
```

Expected tail output (every ~30s by default):

```text
[main] hosts=... rooted=... newRoot=... deployed=... starter=...
```

## Config

Tune values in `config/defaults.js`:

- `homeReserveGb` (default `16`)
- `loopIntervalMs`
- `statusIntervalMs`
- `starterTargets`

## Next phase

Phase 2 will add:

- Early-game money execution strategy
- automatic target scoring/selection
- active remote job placement
