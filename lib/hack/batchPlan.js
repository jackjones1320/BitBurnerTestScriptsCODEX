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
  const landingW1 = now + weakenTime + spacing * 2;
  const landingH = landingW1 - spacing * 3;
  const landingG = landingW1 - spacing;
  const landingW2 = landingW1 + spacing;

  return {
    target,
    preparedAt: now,
    timings: { hackTime, growTime, weakenTime },
    steps: [
      { type: "hack", script: "/scripts/worker-hack.js", threads: hackThreads, delayMs: Math.max(0, landingH - now - hackTime) },
      { type: "weaken-1", script: "/scripts/worker-weaken.js", threads: w1Threads, delayMs: Math.max(0, landingW1 - now - weakenTime) },
      { type: "grow", script: "/scripts/worker-grow.js", threads: growThreads, delayMs: Math.max(0, landingG - now - growTime) },
      { type: "weaken-2", script: "/scripts/worker-weaken.js", threads: w2Threads, delayMs: Math.max(0, landingW2 - now - weakenTime) },
    ],
    endsAt: landingW2,
  };
}
