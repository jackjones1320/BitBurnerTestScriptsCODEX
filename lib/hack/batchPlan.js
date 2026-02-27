function finitePositive(value, fallback = 0) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, value);
}

export function createBatchPlan(ns, target, config, now = Date.now()) {
  const hackTime = finitePositive(ns.getHackTime(target), 1);
  const growTime = finitePositive(ns.getGrowTime(target), 1);
  const weakenTime = finitePositive(ns.getWeakenTime(target), 1);

  const maxMoney = Math.max(0, ns.getServerMaxMoney(target));
  if (maxMoney <= 0) return null;

  const hackFraction = Math.min(0.9, Math.max(0.01, config.hackFraction));
  const desiredHackMoney = maxMoney * hackFraction;
  let hackThreads = Math.floor(ns.hackAnalyzeThreads(target, desiredHackMoney));
  if (!Number.isFinite(hackThreads) || hackThreads < 1) hackThreads = 1;

  const growthRatio = 1 / Math.max(0.01, 1 - hackFraction);
  let growThreads = Math.ceil(ns.growthAnalyze(target, growthRatio));
  if (!Number.isFinite(growThreads) || growThreads < 1) growThreads = 1;

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
