import { CONFIG } from "./config/defaults.js";
import { createBatchPlan } from "./lib/hack/batchPlan.js";
import { buildPrepJobs, getPrepState } from "./lib/hack/prep.js";
import { rankTargets } from "./lib/hack/score.js";
import { executeJobSet } from "./lib/hack/scheduler.js";
import { manageHacknet } from "./lib/hw/hacknet.js";
import { managePurchasedServers } from "./lib/hw/servers.js";
import { rootMany } from "./lib/net/access.js";
import { deployWorkersFleet } from "./lib/net/deploy.js";
import { scanAllServers } from "./lib/net/scan.js";
import { createLogger } from "./lib/runtime/logger.js";
import { writeState } from "./lib/runtime/state.js";
import { shouldEmit } from "./lib/runtime/timing.js";

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

function pickTarget(rankedTargets) {
  if (rankedTargets.length === 0) return null;
  return rankedTargets[0].host;
}

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  ns.ui.openTail();
  const logger = createLogger(ns, "main");

  let lastStatusAt = 0;
  let nextDispatchAt = 0;

  while (true) {
    const now = Date.now();
    const net = scanAllServers(ns);
    const rootedNow = rootMany(ns, net.hosts, CONFIG.rooting.crackers);
    const runnerHosts = getRunnerHosts(ns, net.hosts);
    const copiedTo = await deployWorkersFleet(ns, runnerHosts, CONFIG.deploy.workerScripts);
    const fleetAction = managePurchasedServers(ns, CONFIG.phase4.purchasedServers);
    const hacknetAction = manageHacknet(ns, CONFIG.phase4.hacknet);

    const rankedTargets = rankTargets(ns, net.hosts, CONFIG.phase2.targetPoolSize);
    const target = pickTarget(rankedTargets);

    let mode = "idle";
    let launched = { launchedScripts: 0, launchedThreads: 0, requestedThreads: 0, droppedThreads: 0, utilization: 1 };
    let prep = null;
    let plan = null;

    if (target && now >= nextDispatchAt) {
      prep = buildPrepJobs(ns, target, CONFIG.phase3);

      if (prep.jobs.length > 0) {
        mode = "prep";
        launched = executeJobSet(ns, runnerHosts, prep.jobs, target, `prep:${now}`, CONFIG.homeReserveGb);
        const prepTime = Math.max(ns.getWeakenTime(target), ns.getGrowTime(target));
        nextDispatchAt = now + Math.max(CONFIG.loopIntervalMs, prepTime + 100);
      } else {
        mode = "batch";
        plan = createBatchPlan(ns, target, CONFIG.phase3, now);
        if (plan) {
          const jobs = plan.steps.map((step) => ({
            script: step.script,
            threads: step.threads,
            delayMs: step.delayMs,
            tag: step.type,
          }));
          launched = executeJobSet(ns, runnerHosts, jobs, target, `batch:${now}`, CONFIG.homeReserveGb);
        }
        nextDispatchAt = now + CONFIG.phase3.dispatchCadenceMs;
      }
    }

    const prepState = target ? getPrepState(ns, target, CONFIG.phase3) : null;

    writeState(ns, {
      discoveredHosts: net.hosts.length,
      rootedHosts: net.hosts.filter((h) => ns.hasRootAccess(h)).length,
      runners: runnerHosts.length,
      topTargets: rankedTargets.map((t) => t.host),
      activeTarget: target,
      mode,
      prepped: prepState?.isPrepped ?? false,
      launchedScripts: launched.launchedScripts,
      launchedThreads: launched.launchedThreads,
      requestedThreads: launched.requestedThreads,
      droppedThreads: launched.droppedThreads,
      threadUtilization: Number((launched.utilization * 100).toFixed(1)),
      fleetAction,
      hacknetAction,
      nextDispatchAt,
      lastBatchEndsAt: plan?.endsAt ?? null,
    });

    if (shouldEmit(now, lastStatusAt, CONFIG.statusIntervalMs)) {
      lastStatusAt = now;
      const status = prepState
        ? `money=${Math.floor(prepState.curMoney)}/${Math.floor(prepState.maxMoney)} sec=${prepState.curSec.toFixed(2)}/${prepState.minSec.toFixed(2)}`
        : "money=0/0 sec=0/0";
      logger.info(
        `hosts=${net.hosts.length} rooted=${net.hosts.filter((h) => ns.hasRootAccess(h)).length} ` +
          `newRoot=${rootedNow.length} copied=${copiedTo} mode=${mode} target=${target ?? "none"} fleet=${fleetAction.action} hacknet=${hacknetAction.action} ` +
          `${status} launchedScripts=${launched.launchedScripts} launchedThreads=${launched.launchedThreads} ` +
          `droppedThreads=${launched.droppedThreads} utilization=${(launched.utilization * 100).toFixed(1)}%`,
      );
    }

    await ns.sleep(CONFIG.loopIntervalMs);
  }
}
