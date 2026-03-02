import { rankTargets, scoreTarget } from "../lib/hack/score.js";
import { getHackChance, getHackPercentPerThread, getHackTimeMs, hasFormulas } from "../lib/hack/formulas.js";
import { scanAllServers } from "../lib/net/scan.js";

function fmtNumber(value) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}b`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toFixed(0);
}

function describe(ns, host) {
  const maxMoney = ns.getServerMaxMoney(host);
  const serverGrowth = Math.max(1, ns.getServerGrowth(host));
  const minSec = Math.max(1, ns.getServerMinSecurityLevel(host));
  const chance = getHackChance(ns, host);
  const hackPercentPerThread = getHackPercentPerThread(ns, host);
  const hackTimeMs = getHackTimeMs(ns, host);
  const score = scoreTarget(ns, host);

  return { host, maxMoney, serverGrowth, minSec, chance, hackPercentPerThread, hackTimeMs, score };
}

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");

  const limit = Number(ns.args[0] ?? 10);
  const { hosts } = scanAllServers(ns);
  const ranked = rankTargets(ns, hosts, Math.max(1, limit));

  ns.tprint("Target scoring formula from lib/hack/score.js:");
  ns.tprint("score = (maxMoney * hackPercentPerThread * hackChance) / hackTimeMs");
  ns.tprint("Higher is better. It follows the Formulas API expected-value-over-time pattern for cleaner target comparisons.");
  ns.tprint(`Using ${hasFormulas(ns) ? "Formulas.exe" : "built-in analyze APIs"} for hack chance/percent/time estimates.`);
  ns.tprint("-");

  for (let i = 0; i < ranked.length; i += 1) {
    const row = describe(ns, ranked[i].host);
    ns.tprint(
      `${String(i + 1).padStart(2)}. ${row.host.padEnd(20)} ` +
        `score=${row.score.toFixed(2).padStart(10)} ` +
        `money=${fmtNumber(row.maxMoney).padStart(8)} ` +
        `growthStat=${String(row.serverGrowth).padStart(4)} ` +
        `chance=${(row.chance * 100).toFixed(1).padStart(6)}% ` +
        `hackPct=${(row.hackPercentPerThread * 100).toFixed(3).padStart(7)}% ` +
        `minSec=${row.minSec.toFixed(1).padStart(5)} ` +
        `hackTime=${(row.hackTimeMs / 1000).toFixed(1).padStart(6)}s`,
    );
  }

  const n00dlesInList = ranked.find((entry) => entry.host === "n00dles");
  if (n00dlesInList) {
    ns.tprint("-");
    ns.tprint(`n00dles is currently in your top ${ranked.length} targets at score=${n00dlesInList.score.toFixed(2)}.`);
  } else {
    const n00dlesScore = scoreTarget(ns, "n00dles");
    ns.tprint("-");
    ns.tprint(`n00dles score=${n00dlesScore.toFixed(2)} and is outside your top ${ranked.length} right now.`);
  }
}
