import { CONFIG } from "./config/defaults.js";
import { rootMany } from "./lib/net/access.js";
import { deployWorkersFleet } from "./lib/net/deploy.js";
import { scanAllServers } from "./lib/net/scan.js";
import { createLogger } from "./lib/runtime/logger.js";
import { writeState } from "./lib/runtime/state.js";
import { shouldEmit, sleepSafe } from "./lib/runtime/timing.js";

function getStarterTarget(ns) {
  for (const target of CONFIG.starterTargets) {
    if (!ns.serverExists(target)) continue;
    const level = ns.getServerRequiredHackingLevel(target);
    if (level <= ns.getHackingLevel()) return target;
  }

  return "n00dles";
}

function getRunnerHosts(ns, discovered) {
  return discovered.filter((host) => {
    if (!ns.hasRootAccess(host)) return false;
    const maxRam = ns.getServerMaxRam(host);
    if (maxRam <= 0) return false;

    if (host === "home") {
      const free = maxRam - ns.getServerUsedRam(host);
      return free > CONFIG.homeReserveGb;
    }

    return true;
  });
}

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  ns.tail();

  const log = createLogger(ns, "main");
  let lastStatusAt = 0;

  while (true) {
    const now = Date.now();

    const net = scanAllServers(ns);
    const rootedNow = rootMany(ns, net.hosts, CONFIG.rooting.crackers);
    const runners = getRunnerHosts(ns, net.hosts);
    const copiedTo = await deployWorkersFleet(ns, runners, CONFIG.deploy.workerScripts);
    const starterTarget = getStarterTarget(ns);

    writeState(ns, {
      discoveredHosts: net.hosts.length,
      rootedHosts: net.hosts.filter((h) => ns.hasRootAccess(h)).length,
      runners: runners.length,
      starterTarget,
    });

    if (shouldEmit(now, lastStatusAt, CONFIG.statusIntervalMs)) {
      lastStatusAt = now;
      log.info(
        `hosts=${net.hosts.length} rooted=${net.hosts.filter((h) => ns.hasRootAccess(h)).length} ` +
          `newRoot=${rootedNow.length} deployed=${copiedTo} starter=${starterTarget}`,
      );
    }

    await sleepSafe(ns, CONFIG.loopIntervalMs);
  }
}
