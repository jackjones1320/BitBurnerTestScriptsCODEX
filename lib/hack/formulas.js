function finitePositive(value, fallback = 0) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, value);
}

export function hasFormulas(ns) {
  return ns.fileExists("Formulas.exe", "home") && ns.formulas?.hacking;
}

function getServerAndPlayer(ns, target) {
  return { server: ns.getServer(target), player: ns.getPlayer() };
}

export function getHackTimeMs(ns, target) {
  if (hasFormulas(ns)) {
    const { server, player } = getServerAndPlayer(ns, target);
    return finitePositive(ns.formulas.hacking.hackTime(server, player), 1);
  }
  return finitePositive(ns.getHackTime(target), 1);
}

export function getGrowTimeMs(ns, target) {
  if (hasFormulas(ns)) {
    const { server, player } = getServerAndPlayer(ns, target);
    return finitePositive(ns.formulas.hacking.growTime(server, player), 1);
  }
  return finitePositive(ns.getGrowTime(target), 1);
}

export function getWeakenTimeMs(ns, target) {
  if (hasFormulas(ns)) {
    const { server, player } = getServerAndPlayer(ns, target);
    return finitePositive(ns.formulas.hacking.weakenTime(server, player), 1);
  }
  return finitePositive(ns.getWeakenTime(target), 1);
}

export function getHackChance(ns, target) {
  if (hasFormulas(ns)) {
    const { server, player } = getServerAndPlayer(ns, target);
    return Math.max(0.01, ns.formulas.hacking.hackChance(server, player));
  }
  return Math.max(0.01, ns.hackAnalyzeChance(target));
}

export function getHackPercentPerThread(ns, target) {
  if (hasFormulas(ns)) {
    const { server, player } = getServerAndPlayer(ns, target);
    return Math.max(0.000001, ns.formulas.hacking.hackPercent(server, player));
  }
  return Math.max(0.000001, ns.hackAnalyze(target));
}

export function getHackThreadsForMoney(ns, target, desiredHackMoney) {
  if (hasFormulas(ns)) {
    const { server, player } = getServerAndPlayer(ns, target);
    const hackPercent = Math.max(0.000001, ns.formulas.hacking.hackPercent(server, player));
    const moneyAvailable = Math.max(1, server.moneyAvailable);
    return Math.max(1, Math.floor(desiredHackMoney / (moneyAvailable * hackPercent)));
  }

  let hackThreads = Math.floor(ns.hackAnalyzeThreads(target, desiredHackMoney));
  if (!Number.isFinite(hackThreads) || hackThreads < 1) hackThreads = 1;
  return hackThreads;
}

export function getGrowThreadsForRatio(ns, target, growthRatio) {
  if (hasFormulas(ns)) {
    const { server, player } = getServerAndPlayer(ns, target);
    const targetMoney = Math.max(1, Math.min(server.moneyMax, server.moneyAvailable * growthRatio));
    const growThreads = ns.formulas.hacking.growThreads(server, player, targetMoney);
    return Math.max(1, Math.ceil(growThreads));
  }

  let growThreads = Math.ceil(ns.growthAnalyze(target, growthRatio));
  if (!Number.isFinite(growThreads) || growThreads < 1) growThreads = 1;
  return growThreads;
}
