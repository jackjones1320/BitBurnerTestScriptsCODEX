/**
 * Guard sleep utility used by scheduler loops.
 */
export async function sleepSafe(ns, ms) {
  const delay = Number.isFinite(ms) ? Math.max(0, Math.floor(ms)) : 0;
  await ns.sleep(delay);
}

export function shouldEmit(now, previous, intervalMs) {
  if (!previous) return true;
  return now - previous >= intervalMs;
}
