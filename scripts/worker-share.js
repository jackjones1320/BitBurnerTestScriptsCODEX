/** @param {NS} ns */
export async function main(ns) {
  const durationMs = Number(ns.args[0] ?? 10_000);
  const delayMs = Number(ns.args[1] ?? 0);

  if (delayMs > 0) await ns.sleep(delayMs);

  const stopAt = Date.now() + Math.max(0, durationMs);
  while (Date.now() < stopAt) {
    await ns.share();
  }
}
