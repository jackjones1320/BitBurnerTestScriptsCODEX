import { CONFIG } from "./config/defaults.js";
import { rankTargets } from "./lib/hack/score.js";
import { rootMany } from "./lib/net/access.js";
import { deployWorkersFleet } from "./lib/net/deploy.js";
import { scanAllServers } from "./lib/net/scan.js";
import { createLogger } from "./lib/runtime/logger.js";
import { writeState } from "./lib/runtime/state.js";

function getRunnerHosts(ns, discovered) {
  return discovered.filter((host) => {
    if (!ns.hasRootAccess(host)) return false;
    if (ns.getServerMaxRam(host) <= 0) return false;

    if (host === "home") {
      const free = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
      return free > CONFIG.homeReserveGb;
    }

    return true;
  });
}

function pickStarterFallbackTarget(ns) {
  for (const target of CONFIG.starterTargets) {
    if (!ns.serverExists(target)) continue;
    const level = ns.getServerRequiredHackingLevel(target);
    if (level <= ns.getHackingLevel()) return target;
  }

  return "n00dles";
}

function shouldEmit(now, previous, intervalMs) {
  if (!previous) return true;
  return now - previous >= intervalMs;
}

function chooseOperation(ns, target) {
  const minSec = ns.getServerMinSecurityLevel(target);
  const curSec = ns.getServerSecurityLevel(target);
  const maxMoney = ns.getServerMaxMoney(target);
  const curMoney = ns.getServerMoneyAvailable(target);

  if (curSec > minSec + CONFIG.phase2.minSecurityBuffer) {
    return "/scripts/worker-weaken.js";
  }

  if (maxMoney > 0 && curMoney < maxMoney * CONFIG.phase2.growMoneyThreshold) {
    return "/scripts/worker-grow.js";
  }

  return "/scripts/worker-hack.js";
}

function buildAssignments(ns, runnerHosts, rankedTargets) {
  if (rankedTargets.length === 0) return [];

  const assignments = [];
  let idx = 0;

  for (const host of runnerHosts) {
    const target = rankedTargets[idx % rankedTargets.length].host;
    idx += 1;

    const script = chooseOperation(ns, target);
    const ramPerThread = ns.getScriptRam(script, "home");
    if (!Number.isFinite(ramPerThread) || ramPerThread <= 0) continue;

    const maxRam = ns.getServerMaxRam(host);
    const usedRam = ns.getServerUsedRam(host);
    const reserve = host === "home" ? CONFIG.homeReserveGb : 0;
    const freeRam = Math.max(0, maxRam - usedRam - reserve);
    const threads = Math.floor(freeRam / ramPerThread);
    if (threads <= 0) continue;

    assignments.push({ host, target, script, threads });
  }

  return assignments;
}

function executeAssignments(ns, assignments) {
  let launchedHosts = 0;
  let launchedThreads = 0;

  for (const job of assignments) {
    for (const script of CONFIG.deploy.workerScripts) {
      ns.scriptKill(script, job.host);
    }

    const pid = ns.exec(job.script, job.host, job.threads, job.target);
    if (pid !== 0) {
      launchedHosts += 1;
      launchedThreads += job.threads;
    }
  }

  return { launchedHosts, launchedThreads };
}

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  ns.ui.openTail();
  const logger = createLogger(ns, "main");

  let lastStatusAt = 0;

  while (true) {
    const now = Date.now();
    const net = scanAllServers(ns);
    const rootedNow = rootMany(ns, net.hosts, CONFIG.rooting.crackers);
    const runnerHosts = getRunnerHosts(ns, net.hosts);
    const copiedTo = await deployWorkersFleet(ns, runnerHosts, CONFIG.deploy.workerScripts);

    const rankedTargets = rankTargets(ns, net.hosts, CONFIG.phase2.targetPoolSize);
    const fallbackTarget = pickStarterFallbackTarget(ns);
    const effectiveTargets = rankedTargets.length > 0 ? rankedTargets : [{ host: fallbackTarget, score: 0 }];

    const assignments = buildAssignments(ns, runnerHosts, effectiveTargets);
    const launched = executeAssignments(ns, assignments);

    writeState(ns, {
      discoveredHosts: net.hosts.length,
      rootedHosts: net.hosts.filter((h) => ns.hasRootAccess(h)).length,
      runners: runnerHosts.length,
      topTargets: rankedTargets.map((t) => t.host),
      launchedHosts: launched.launchedHosts,
      launchedThreads: launched.launchedThreads,
    });

    if (shouldEmit(now, lastStatusAt, CONFIG.statusIntervalMs)) {
      lastStatusAt = now;
      const targetSummary = effectiveTargets.map((t) => t.host).join(",");
      logger.info(
        `hosts=${net.hosts.length} rooted=${net.hosts.filter((h) => ns.hasRootAccess(h)).length} ` +
          `newRoot=${rootedNow.length} copied=${copiedTo} targets=${targetSummary} ` +
          `launchedHosts=${launched.launchedHosts} launchedThreads=${launched.launchedThreads}`,
      );
    }

    await ns.sleep(CONFIG.loopIntervalMs);
  }
}
