const CONFIG = {
  loopIntervalMs: 5_000,
  statusIntervalMs: 30_000,
  homeReserveGb: 16,
  deploy: {
    workerScripts: [
      "/scripts/worker-hack.js",
      "/scripts/worker-grow.js",
      "/scripts/worker-weaken.js",
    ],
  },
  rooting: {
    crackers: [
      { file: "BruteSSH.exe", fn: "brutessh" },
      { file: "FTPCrack.exe", fn: "ftpcrack" },
      { file: "relaySMTP.exe", fn: "relaysmtp" },
      { file: "HTTPWorm.exe", fn: "httpworm" },
      { file: "SQLInject.exe", fn: "sqlinject" },
    ],
  },
  starterTargets: ["n00dles", "foodnstuff", "sigma-cosmetics"],
};

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

function scanAllServers(ns) {
  const visited = new Set(["home"]);
  const queue = ["home"];
  const edges = { home: ns.scan("home") };

  while (queue.length > 0) {
    const host = queue.shift();
    const neighbors = ns.scan(host);
    edges[host] = neighbors;

    for (const next of neighbors) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }

  return {
    hosts: [...visited],
    edges,
  };
}

function tryRoot(ns, host) {
  if (host === "home" || ns.hasRootAccess(host)) return true;

  let opened = 0;
  for (const cracker of CONFIG.rooting.crackers) {
    if (!ns.fileExists(cracker.file, "home")) continue;

    const fn = ns[cracker.fn];
    if (typeof fn === "function") {
      fn(host);
      opened += 1;
    }
  }

  const required = ns.getServerNumPortsRequired(host);
  if (opened < required) return false;

  ns.nuke(host);
  return ns.hasRootAccess(host);
}

function rootMany(ns, hosts) {
  const rootedNow = [];
  for (const host of hosts) {
    const hadRoot = ns.hasRootAccess(host);
    const hasRoot = tryRoot(ns, host);
    if (!hadRoot && hasRoot) rootedNow.push(host);
  }

  return rootedNow;
}

async function deployWorkersToHost(ns, host, scripts) {
  if (host === "home") return true;
  return await ns.scp(scripts, host, "home");
}

async function deployWorkersFleet(ns, hosts, scripts) {
  let copied = 0;
  for (const host of hosts) {
    if (!ns.hasRootAccess(host)) continue;
    if (await deployWorkersToHost(ns, host, scripts)) copied += 1;
  }

  return copied;
}

function writeState(ns, value) {
  ns.write("/data/runtime-state.txt", JSON.stringify(value, null, 2), "w");
}

function shouldEmit(now, last, everyMs) {
  return now - last >= everyMs;
}

function info(ns, scope, message) {
  ns.print(`[${scope}] ${message}`);
}

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  ns.ui.openTail();

  let lastStatusAt = 0;

  while (true) {
    const now = Date.now();

    const net = scanAllServers(ns);
    const rootedNow = rootMany(ns, net.hosts);
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
      info(
        ns,
        "main",
        `hosts=${net.hosts.length} rooted=${net.hosts.filter((h) => ns.hasRootAccess(h)).length} ` +
          `newRoot=${rootedNow.length} deployed=${copiedTo} starter=${starterTarget}`,
      );
    }

    await ns.sleep(CONFIG.loopIntervalMs);
  }
}
