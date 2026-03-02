import { hasFormulas } from "./formulas.js";

/**
 * Phase-2 target scoring using expected hack value over hack-time.
 * Mirrors common Formulas API guidance: maxMoney * hackPercent * hackChance / hackTime.
 */
export function scoreTarget(ns, host) {
  const server = ns.getServer(host);
  const maxMoney = server.moneyMax;
  if (maxMoney <= 0) return 0;

  if (hasFormulas(ns)) {
    const player = ns.getPlayer();
    const hackChance = ns.formulas.hacking.hackChance(server, player);
    const hackPercent = ns.formulas.hacking.hackPercent(server, player);
    const hackTime = ns.formulas.hacking.hackTime(server, player);
    const expectedValue = maxMoney * Math.max(0, hackPercent) * Math.max(0, hackChance);
    return expectedValue / Math.max(1, hackTime);
  }

  const hackChance = Math.max(0.01, ns.hackAnalyzeChance(host));
  const hackPercent = Math.max(0.000001, ns.hackAnalyze(host));
  const hackTime = Math.max(1, ns.getHackTime(host));
  return (maxMoney * hackPercent * hackChance) / hackTime;
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
