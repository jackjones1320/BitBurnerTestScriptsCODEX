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
  if (ns.fileExists("BruteSSH.exe", "home")) {
    ns.brutessh(host);
    opened += 1;
  }
  if (ns.fileExists("FTPCrack.exe", "home")) {
    ns.ftpcrack(host);
    opened += 1;
  }
  if (ns.fileExists("relaySMTP.exe", "home")) {
    ns.relaysmtp(host);
    opened += 1;
  }
  if (ns.fileExists("HTTPWorm.exe", "home")) {
    ns.httpworm(host);
    opened += 1;
  }
  if (ns.fileExists("SQLInject.exe", "home")) {
    ns.sqlinject(host);
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


function bbMainPickWorkerScript(ns, target) {
  const minSec = ns.getServerMinSecurityLevel(target);
  const curSec = ns.getServerSecurityLevel(target);
  const maxMoney = ns.getServerMaxMoney(target);
  const curMoney = ns.getServerMoneyAvailable(target);

  if (curSec > minSec + 5) return "/scripts/worker-weaken.js";
  if (maxMoney > 0 && curMoney < maxMoney * 0.75) return "/scripts/worker-grow.js";
  return "/scripts/worker-hack.js";
}

async function bbMainLaunchWorkers(ns, hosts, target) {
  const workerScript = bbMainPickWorkerScript(ns, target);
  const ramPerThread = ns.getScriptRam(workerScript, "home");
  if (!Number.isFinite(ramPerThread) || ramPerThread <= 0) {
    ns.print(`[main] Cannot launch ${workerScript}; RAM cost was ${ramPerThread}.`);
    return { launchedHosts: 0, launchedThreads: 0, workerScript };
  }

  let launchedHosts = 0;
  let launchedThreads = 0;

  for (const host of hosts) {
    if (!ns.hasRootAccess(host)) continue;

    const maxRam = ns.getServerMaxRam(host);
    const usedRam = ns.getServerUsedRam(host);
    const reserve = host === "home" ? CONFIG.homeReserveGb : 0;
    const freeRam = Math.max(0, maxRam - usedRam - reserve);
    const threads = Math.floor(freeRam / ramPerThread);
    if (threads <= 0) continue;

    for (const script of CONFIG.deploy.workerScripts) {
      ns.scriptKill(script, host);
    }

    const pid = ns.exec(workerScript, host, threads, target);
    if (pid !== 0) {
      launchedHosts += 1;
      launchedThreads += threads;
    }
  }

  return { launchedHosts, launchedThreads, workerScript };
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
    const launched = await bbMainLaunchWorkers(ns, runners, starterTarget);

    bbMainWriteState(ns, {
      discoveredHosts: net.hosts.length,
      rootedHosts: net.hosts.filter((h) => ns.hasRootAccess(h)).length,
      runners: runners.length,
      starterTarget,
      launchedHosts: launched.launchedHosts,
      launchedThreads: launched.launchedThreads,
      activeWorkerScript: launched.workerScript,
    });

    if (bbMainShouldEmit(now, lastStatusAt, CONFIG.statusIntervalMs)) {
      lastStatusAt = now;
      ns.print(
        `[main] hosts=${net.hosts.length} rooted=${net.hosts.filter((h) => ns.hasRootAccess(h)).length} ` +
          `newRoot=${rootedNow.length} copied=${copiedTo} starter=${starterTarget} ` +
          `worker=${launched.workerScript} launchedHosts=${launched.launchedHosts} launchedThreads=${launched.launchedThreads}`,
      );
    }

    await ns.sleep(CONFIG.loopIntervalMs);
  }
}
