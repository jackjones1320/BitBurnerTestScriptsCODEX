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

const STATE_FILE = "/data/runtime-state.txt";

function bbMainGetStarterTarget(ns) {
  for (const target of CONFIG.starterTargets) {
    if (!ns.serverExists(target)) continue;
    const level = ns.getServerRequiredHackingLevel(target);
    if (level <= ns.getHackingLevel()) return target;
  }

  return "n00dles";
}

function bbMainGetRunnerHosts(ns, discovered) {
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

function bbMainScanAllServers(ns) {
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

  return { hosts: [...visited], edges };
}

function bbMainTryRoot(ns, host) {
  if (host === "home" || ns.hasRootAccess(host)) return true;

  let opened = 0;
  for (const cracker of CONFIG.rooting.crackers) {
    if (!ns.fileExists(cracker.file, "home")) continue;

    const fn = ns[cracker.fn];
    if (typeof fn !== "function") continue;

    fn(host);
    opened += 1;
  }

  if (opened < ns.getServerNumPortsRequired(host)) return false;

  ns.nuke(host);
  return ns.hasRootAccess(host);
}

function bbMainRootMany(ns, hosts) {
  const rootedNow = [];
  for (const host of hosts) {
    const hadRoot = ns.hasRootAccess(host);
    const hasRoot = bbMainTryRoot(ns, host);
    if (!hadRoot && hasRoot) rootedNow.push(host);
  }

  return rootedNow;
}

async function bbMainDeployWorkersFleet(ns, hosts, scripts) {
  let copied = 0;
  for (const host of hosts) {
    if (!ns.hasRootAccess(host)) continue;

    if (host !== "home") {
      const copiedHost = await ns.scp(scripts, host, "home");
      if (!copiedHost) continue;
    }

    copied += 1;
  }

  return copied;
}

function bbMainReadState(ns) {
  if (!ns.fileExists(STATE_FILE, "home")) return {};

  try {
    const raw = ns.read(STATE_FILE);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function bbMainWriteState(ns, partial) {
  const current = bbMainReadState(ns);
  const merged = { ...current, ...partial, updatedAt: Date.now() };
  ns.write(STATE_FILE, JSON.stringify(merged, null, 2), "w");
}

function bbMainShouldEmit(now, previous, intervalMs) {
  if (!previous) return true;
  return now - previous >= intervalMs;
}

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  ns.ui.openTail();

  let lastStatusAt = 0;

  while (true) {
    const now = Date.now();

    const net = bbMainScanAllServers(ns);
    const rootedNow = bbMainRootMany(ns, net.hosts);
    const runners = bbMainGetRunnerHosts(ns, net.hosts);
    const copiedTo = await bbMainDeployWorkersFleet(ns, runners, CONFIG.deploy.workerScripts);
    const starterTarget = bbMainGetStarterTarget(ns);

    bbMainWriteState(ns, {
      discoveredHosts: net.hosts.length,
      rootedHosts: net.hosts.filter((h) => ns.hasRootAccess(h)).length,
      runners: runners.length,
      starterTarget,
    });

    if (bbMainShouldEmit(now, lastStatusAt, CONFIG.statusIntervalMs)) {
      lastStatusAt = now;
      ns.print(
        `[main] hosts=${net.hosts.length} rooted=${net.hosts.filter((h) => ns.hasRootAccess(h)).length} ` +
          `newRoot=${rootedNow.length} deployed=${copiedTo} starter=${starterTarget}`,
      );
    }

    await ns.sleep(CONFIG.loopIntervalMs);
  }
}
