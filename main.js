import { CONFIG } from "./config/defaults.js";
import { createBatchPlan } from "./lib/hack/batchPlan.js";
import { buildPrepJobs, getPrepState } from "./lib/hack/prep.js";
import { rankTargets } from "./lib/hack/score.js";
import { executeJobSet } from "./lib/hack/scheduler.js";
import { solveContracts } from "./lib/contracts/automation.js";
import { manageHacknet } from "./lib/hw/hacknet.js";
import { managePurchasedServers } from "./lib/hw/servers.js";
import { rootMany } from "./lib/net/access.js";
import { deployWorkersFleet } from "./lib/net/deploy.js";
import { scanAllServers } from "./lib/net/scan.js";
import { createLogger } from "./lib/runtime/logger.js";
import { writeState } from "./lib/runtime/state.js";
import { shouldEmit } from "./lib/runtime/timing.js";
import { ensureFactionWork, launchShareWindow, pickShareFaction } from "./lib/factions/share.js";

function getRunnerHosts(ns, discovered) {
  return discovered.filter((host) => {
    try {
      if (!ns.hasRootAccess(host)) return false;

      const maxRam = ns.getServerMaxRam(host);
      if (maxRam <= 0) return false;

      if (host === "home") {
        const free = maxRam - ns.getServerUsedRam(host);
        return free > CONFIG.homeReserveGb;
      }

      return true;
    } catch {
      return false;
    }
  });
}

function safeHasRootAccess(ns, host) {
  try {
    return ns.hasRootAccess(host);
  } catch {
    return false;
  }
}

function countRootedHosts(ns, hosts) {
  let rooted = 0;
  for (const host of hosts) {
    if (safeHasRootAccess(ns, host)) rooted += 1;
  }
  return rooted;
}

function scoreMapFromRanked(rankedTargets) {
  const byHost = new Map();
  for (const entry of rankedTargets) {
    byHost.set(entry.host, entry.score);
  }
  return byHost;
}

function pickTarget(rankedTargets, currentTarget, currentSinceMs, nowMs) {
  if (rankedTargets.length === 0) return null;

  const top = rankedTargets[0];
  if (!currentTarget || currentSinceMs <= 0) return top.host;

  const scores = scoreMapFromRanked(rankedTargets);
  const currentScore = scores.get(currentTarget);
  if (!Number.isFinite(currentScore) || currentScore <= 0) return top.host;

  const heldForMs = nowMs - currentSinceMs;
  if (heldForMs >= CONFIG.phase2.targetStickMs) return top.host;

  const requiredLead = currentScore * (1 + CONFIG.phase2.switchLeadPct);
  return top.score >= requiredLead ? top.host : currentTarget;
}

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  ns.ui.openTail();
  const logger = createLogger(ns, "main");

  let lastStatusAt = 0;
  let lastContractSweepAt = 0;
  let nextDispatchAt = 0;
  let activeTarget = null;
  let activeTargetSince = 0;
  let lastFullDeployAt = 0;
  let shareUntilAt = 0;
  let shareState = { rotation: 0 };
  const deployedHosts = new Set(["home"]);
  const contractState = { attempted: new Set() };

  while (true) {
    const now = Date.now();
    const net = scanAllServers(ns);
    const rootedNow = rootMany(ns, net.hosts, CONFIG.rooting.crackers);
    const runnerHosts = getRunnerHosts(ns, net.hosts);

    const fullSyncDue = now - lastFullDeployAt >= CONFIG.deploy.syncIntervalMs;
    const newlyRooted = new Set(rootedNow);
    const copiedTo = await deployWorkersFleet(ns, runnerHosts, CONFIG.deploy.workerScripts, {
      shouldCopy: (host) => fullSyncDue || !deployedHosts.has(host) || newlyRooted.has(host),
    });

    if (fullSyncDue) {
      lastFullDeployAt = now;
      for (const host of runnerHosts) deployedHosts.add(host);
    } else {
      for (const host of rootedNow) deployedHosts.add(host);
    }

    const fleetAction = managePurchasedServers(ns, CONFIG.phase4.purchasedServers);
    const hacknetAction = manageHacknet(ns, CONFIG.phase4.hacknet);

    let contractSummary = { discovered: 0, solved: 0, failed: 0, skipped: 0 };
    if (CONFIG.contracts.enabled && now - lastContractSweepAt >= CONFIG.contracts.intervalMs) {
      try {
        contractSummary = solveContracts(ns, net.hosts, contractState, logger);
      } catch (error) {
        logger.error("contract sweep failed: " + String(error));
      }
      lastContractSweepAt = now;
    }

    const rankedTargets = rankTargets(ns, net.hosts, CONFIG.phase2.targetPoolSize);
    const target = pickTarget(rankedTargets, activeTarget, activeTargetSince, now);
    if (target !== activeTarget) {
      activeTarget = target;
      activeTargetSince = now;
    }

    let mode = "idle";
    let launched = { launchedScripts: 0, launchedThreads: 0, requestedThreads: 0, droppedThreads: 0, utilization: 0 };
    let prep = null;
    let plan = null;
    let shareSummary = { launchedScripts: 0, launchedThreads: 0, faction: null, reason: "none" };

    const shareActive = CONFIG.sharing.enabled && now < shareUntilAt;
    if (shareActive) mode = "share";

    if (target && now >= nextDispatchAt && !shareActive) {
      prep = buildPrepJobs(ns, target, CONFIG.phase3);

      if (prep.jobs.length > 0) {
        mode = "prep";
        launched = executeJobSet(ns, runnerHosts, prep.jobs, target, `prep:${now}`, CONFIG.homeReserveGb);
        const prepTime = Math.max(ns.getWeakenTime(target), ns.getGrowTime(target));
        const prepCadence = launched.droppedThreads > 0 ? CONFIG.phase3.dispatchCadenceMs : Math.max(CONFIG.loopIntervalMs, prepTime + 100);
        nextDispatchAt = now + prepCadence;
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
          launched = executeJobSet(ns, runnerHosts, jobs, target, `batch:${now}`, CONFIG.homeReserveGb, { strict: true });
        }
        nextDispatchAt = now + CONFIG.phase3.dispatchCadenceMs;
      }
    }

    const prepState = target ? getPrepState(ns, target, CONFIG.phase3) : null;

    const shareEligible =
      CONFIG.sharing.enabled &&
      !shareActive &&
      target &&
      prepState?.isPrepped === true &&
      now < nextDispatchAt &&
      nextDispatchAt - now >= CONFIG.sharing.windowMs;

    if (shareEligible) {
      const picked = pickShareFaction(ns, shareState);
      shareState = picked.state;

      let canShare = false;
      if (picked.reason === "current-work") {
        canShare = true;
      } else if (picked.faction) {
        canShare = ensureFactionWork(ns, picked.faction);
      }

      if (canShare) {
        const launchedShare = launchShareWindow(ns, runnerHosts, {
          homeReserveGb: CONFIG.homeReserveGb,
          durationMs: CONFIG.sharing.windowMs,
          tag: `share:${now}:${picked.faction}`,
        });
        if (launchedShare.launchedThreads > 0) {
          shareUntilAt = now + CONFIG.sharing.windowMs;
          mode = "share";
        }
        shareSummary = { ...launchedShare, faction: picked.faction, reason: picked.reason };
      }
    }

    writeState(ns, {
      discoveredHosts: net.hosts.length,
      rootedHosts: countRootedHosts(ns, net.hosts),
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
      contracts: contractSummary,
      nextDispatchAt,
      lastBatchEndsAt: plan?.endsAt ?? null,
      sharingUntilAt: shareUntilAt,
      sharingFaction: shareSummary.faction,
    });

    if (shouldEmit(now, lastStatusAt, CONFIG.statusIntervalMs)) {
      lastStatusAt = now;
      const status = prepState
        ? `money=${Math.floor(prepState.curMoney)}/${Math.floor(prepState.maxMoney)} sec=${prepState.curSec.toFixed(2)}/${prepState.minSec.toFixed(2)}`
        : "money=0/0 sec=0/0";
      logger.info(
        `hosts=${net.hosts.length} rooted=${countRootedHosts(ns, net.hosts)} ` +
          `newRoot=${rootedNow.length} copied=${copiedTo} mode=${mode} target=${target ?? "none"} fleet=${fleetAction.action} hacknet=${hacknetAction.action} ` +
          `contracts(s/f/k)=${contractSummary.solved}/${contractSummary.failed}/${contractSummary.skipped} ${status} ` +
          `launchedScripts=${launched.launchedScripts} launchedThreads=${launched.launchedThreads} ` +
          `droppedThreads=${launched.droppedThreads} utilization=${(launched.utilization * 100).toFixed(1)}% ` +
          `shareThreads=${shareSummary.launchedThreads} shareFaction=${shareSummary.faction ?? "none"}`,
      );
    }

    await ns.sleep(CONFIG.loopIntervalMs);
  }
}
