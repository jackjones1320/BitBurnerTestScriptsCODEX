/** @param {NS} ns */
export async function main(ns) {
  const durationMs = Number(ns.args[0] ?? 10_000);
  const delayMs = Number(ns.args[1] ?? 0);
  const tag = String(ns.args[2] ?? "share");
  const debug = Number(ns.args[3] ?? 0) === 1;

  if (debug) {
    ns.disableLog("ALL");
    ns.ui.openTail();
    ns.print(`[share] start host=${ns.getHostname()} tag=${tag} threads=${ns.getRunningScript()?.threads ?? "?"} durationMs=${durationMs} delayMs=${delayMs}`);
  }

  if (delayMs > 0) await ns.sleep(delayMs);

  const stopAt = Date.now() + Math.max(0, durationMs);
  let lastShareDurationMs = 0;
  let loops = 0;

  while (Date.now() < stopAt) {
    const remainingMs = stopAt - Date.now();
    if (lastShareDurationMs > 0 && remainingMs < lastShareDurationMs) {
      if (debug) {
        ns.print(
          `[share] stop early host=${ns.getHostname()} tag=${tag} remainingMs=${remainingMs} lastShareDurationMs=${lastShareDurationMs} loops=${loops}`,
        );
      }
      break;
    }

    const startedAt = Date.now();
    await ns.share();
    lastShareDurationMs = Math.max(1, Date.now() - startedAt);
    loops += 1;
  }

  if (debug) {
    const elapsed = Math.max(0, durationMs - Math.max(0, stopAt - Date.now()));
    ns.print(`[share] done host=${ns.getHostname()} tag=${tag} loops=${loops} elapsedMs=${elapsed}`);
  }
}
