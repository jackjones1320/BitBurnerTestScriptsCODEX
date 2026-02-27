# Bitburner Autonomous Runner

Phase 1 foundation is now implemented.

## Current capabilities (Phase 1)

- Network BFS discovery from `home`.
- Root automation using whichever port crackers are currently present.
- Fleet deployment for worker scripts (`hack/grow/weaken`).
- 8GB-safe bootstrap path (`starter/starter.js`) that pushes `starter/early-worker.js` to rooted servers first.
- Boot loop skeleton in `main.js` with periodic status logging.
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
