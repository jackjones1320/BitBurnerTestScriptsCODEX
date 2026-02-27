/**
 * Early-game target scoring for Phase 2.
 * Focuses on expected money throughput with gentle penalties for long runtimes and high security floors.
 */
export function scoreTarget(ns, host) {
  const maxMoney = ns.getServerMaxMoney(host);
  if (maxMoney <= 0) return 0;

  const growth = Math.max(1, ns.getServerGrowth(host));
  const minSec = Math.max(1, ns.getServerMinSecurityLevel(host));
  const hackChance = Math.max(0.01, ns.hackAnalyzeChance(host));
  const hackTime = Math.max(1, ns.getHackTime(host));

  // Money-oriented baseline with a time divisor so extremely slow targets lose priority.
  return (maxMoney * growth * hackChance) / (minSec * (hackTime / 1_000));
}

function isAccessibleServer(ns, host) {
  try {
    ns.getServer(host);
    return true;
  } catch {
    return false;
  }
}

export function getHackableTargets(ns, hosts) {
  const playerLevel = ns.getHackingLevel();
  const purchasedHosts = new Set(ns.getPurchasedServers());

  return hosts.filter((host) => {
    if (host === "home") return false;
    if (purchasedHosts.has(host)) return false;
    if (!isAccessibleServer(ns, host)) return false;
    if (!ns.hasRootAccess(host)) return false;
    if (ns.getServerRequiredHackingLevel(host) > playerLevel) return false;
    return ns.getServerMaxMoney(host) > 0;
  });
}

export function rankTargets(ns, hosts, limit = 5) {
  const ranked = getHackableTargets(ns, hosts)
    .map((host) => ({ host, score: scoreTarget(ns, host) }))
    .filter((entry) => Number.isFinite(entry.score) && entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return ranked.slice(0, Math.max(1, limit));
}
