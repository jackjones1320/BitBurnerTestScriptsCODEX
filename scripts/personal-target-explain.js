import { rankTargets, scoreTarget } from "../lib/hack/score.js";
import { scanAllServers } from "../lib/net/scan.js";

function fmtNumber(value) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}b`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toFixed(0);
}

function describe(ns, host) {
  const maxMoney = ns.getServerMaxMoney(host);
  const growth = Math.max(1, ns.getServerGrowth(host));
  const minSec = Math.max(1, ns.getServerMinSecurityLevel(host));
  const chance = Math.max(0.01, ns.hackAnalyzeChance(host));
  const hackTimeMs = Math.max(1, ns.getHackTime(host));
  const score = scoreTarget(ns, host);

  return { host, maxMoney, growth, minSec, chance, hackTimeMs, score };
}

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");

  const limit = Number(ns.args[0] ?? 10);
  const { hosts } = scanAllServers(ns);
  const ranked = rankTargets(ns, hosts, Math.max(1, limit));

  ns.tprint("Target scoring formula from lib/hack/score.js:");
  ns.tprint("score = (maxMoney * growth * hackChance) / (minSec * (hackTimeMs / 1000))");
  ns.tprint("Higher is better. It rewards rich/fast/easy targets and penalizes slow/high-security ones.");
  ns.tprint("-");

  for (let i = 0; i < ranked.length; i += 1) {
    const row = describe(ns, ranked[i].host);
    ns.tprint(
      `${String(i + 1).padStart(2)}. ${row.host.padEnd(20)} ` +
        `score=${row.score.toFixed(2).padStart(10)} ` +
        `money=${fmtNumber(row.maxMoney).padStart(8)} ` +
        `growth=${String(row.growth).padStart(4)} ` +
        `chance=${(row.chance * 100).toFixed(1).padStart(6)}% ` +
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
