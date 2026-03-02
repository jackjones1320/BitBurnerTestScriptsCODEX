/** @param {NS} ns */
export async function main(ns) {
  const durationMs = Number(ns.args[0] ?? 10_000);
  const delayMs = Number(ns.args[1] ?? 0);

  if (delayMs > 0) await ns.sleep(delayMs);

  const stopAt = Date.now() + Math.max(0, durationMs);
  let lastShareDurationMs = 0;

  while (Date.now() < stopAt) {
    const remainingMs = stopAt - Date.now();
    if (lastShareDurationMs > 0 && remainingMs < lastShareDurationMs) break;

    const startedAt = Date.now();
    await ns.share();
    lastShareDurationMs = Math.max(1, Date.now() - startedAt);
  }
}
