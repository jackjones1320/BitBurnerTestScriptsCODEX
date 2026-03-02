import { getGrowTimeMs, getHackThreadsForMoney, getHackTimeMs, getGrowThreadsForRatio, getWeakenTimeMs } from "./formulas.js";

export function createBatchPlan(ns, target, config, now = Date.now()) {
  const hackTime = getHackTimeMs(ns, target);
  const growTime = getGrowTimeMs(ns, target);
  const weakenTime = getWeakenTimeMs(ns, target);

  const maxMoney = Math.max(0, ns.getServerMaxMoney(target));
  if (maxMoney <= 0) return null;

  const hackFraction = Math.min(0.9, Math.max(0.01, config.hackFraction));
  const desiredHackMoney = maxMoney * hackFraction;
  const hackThreads = getHackThreadsForMoney(ns, target, desiredHackMoney);

  const growthRatio = 1 / Math.max(0.01, 1 - hackFraction);
  const growThreads = getGrowThreadsForRatio(ns, target, growthRatio);

  const weakenPerThread = Math.max(0.0001, ns.weakenAnalyze(1));
  const w1Threads = Math.max(1, Math.ceil(ns.hackAnalyzeSecurity(hackThreads, target) / weakenPerThread));
  const w2Threads = Math.max(1, Math.ceil(ns.growthAnalyzeSecurity(growThreads, target) / weakenPerThread));

  const spacing = Math.max(20, config.landingSpacingMs);
  const launchJitterBuffer = spacing * 4;

  // Keep the canonical HWGW completion order (H < W1 < G < W2) while
  // deriving delays from weaken as the anchor like the Formulas API docs pattern.
  // We intentionally reserve extra guard space so sequential launch jitter in
  // executeJobSet (weaken/grow/hack ordering) does not invert completion order.
  const delays = {
    hack: Math.max(0, weakenTime - hackTime - launchJitterBuffer),
    weaken1: spacing,
    grow: Math.max(0, weakenTime - growTime + launchJitterBuffer),
    weaken2: launchJitterBuffer * 2,
  };

  return {
    target,
    preparedAt: now,
    timings: { hackTime, growTime, weakenTime },
    steps: [
      { type: "hack", script: "/scripts/worker-hack.js", threads: hackThreads, delayMs: delays.hack },
      { type: "weaken-1", script: "/scripts/worker-weaken.js", threads: w1Threads, delayMs: delays.weaken1 },
      { type: "grow", script: "/scripts/worker-grow.js", threads: growThreads, delayMs: delays.grow },
      { type: "weaken-2", script: "/scripts/worker-weaken.js", threads: w2Threads, delayMs: delays.weaken2 },
    ],
    endsAt: now + weakenTime + delays.weaken2,
  };
}
