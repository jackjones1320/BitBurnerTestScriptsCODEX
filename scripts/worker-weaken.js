/**
 * Stateless weaken worker used by schedulers.
 * args: [target, delayMs=0, batchTag='']
 */
export async function main(ns) {
  const [target, delayMs = 0, batchTag = ""] = ns.args;
  if (!target) {
    ns.tprint("[worker-weaken] Missing target argument");
    return;
  }

  if (delayMs > 0) await ns.sleep(Number(delayMs));
  await ns.weaken(String(target), { additionalMsec: 0, stock: false });

  if (batchTag) ns.print(`[worker-weaken] done target=${target} tag=${batchTag}`);
}
