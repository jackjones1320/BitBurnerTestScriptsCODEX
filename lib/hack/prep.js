function safeMoney(ns, target) {
  return Math.max(1, ns.getServerMoneyAvailable(target));
}

export function getPrepState(ns, target, config) {
  const minSec = ns.getServerMinSecurityLevel(target);
  const curSec = ns.getServerSecurityLevel(target);
  const maxMoney = ns.getServerMaxMoney(target);
  const curMoney = ns.getServerMoneyAvailable(target);

  const secReady = curSec <= minSec + config.securityTolerance;
  const moneyReady = maxMoney <= 0 || curMoney >= maxMoney * config.moneyReadyRatio;

  return {
    minSec,
    curSec,
    maxMoney,
    curMoney,
    secReady,
    moneyReady,
    isPrepped: secReady && moneyReady,
  };
}

export function buildPrepJobs(ns, target, config) {
  const state = getPrepState(ns, target, config);
  if (state.isPrepped) return { state, jobs: [] };

  const weakenPerThread = Math.max(0.0001, ns.weakenAnalyze(1));

  if (!state.secReady) {
    const secDelta = Math.max(0, state.curSec - state.minSec);
    const weakenThreads = Math.ceil(secDelta / weakenPerThread);
    return {
      state,
      jobs: [{ script: "/scripts/worker-weaken.js", threads: weakenThreads, delayMs: 0, tag: "prep-w" }],
    };
  }

  const growthRatio = Math.max(1.01, state.maxMoney / safeMoney(ns, target));
  const growThreads = Math.max(1, Math.ceil(ns.growthAnalyze(target, growthRatio)));
  const growSec = ns.growthAnalyzeSecurity(growThreads, target);
  const weakenThreads = Math.max(1, Math.ceil(growSec / weakenPerThread));

  return {
    state,
    jobs: [
      { script: "/scripts/worker-grow.js", threads: growThreads, delayMs: 0, tag: "prep-g" },
      { script: "/scripts/worker-weaken.js", threads: weakenThreads, delayMs: 0, tag: "prep-gw" },
    ],
  };
}
