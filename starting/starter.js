const WORKER = "/starting/early-worker.js";
const HOME_RESERVE_GB = 2; // keep terminal responsiveness on 8GB starts
const LOOP_MS = 10_000;

function scanAll(ns) {
  const seen = new Set(["home"]);
  const q = ["home"];

  while (q.length) {
    const host = q.shift();
    for (const n of ns.scan(host)) {
      if (!seen.has(n)) {
        seen.add(n);
        q.push(n);
      }
    }
  }

  return [...seen];
}

function tryRoot(ns, host) {
  if (host === "home" || ns.hasRootAccess(host)) return true;

  if (ns.fileExists("BruteSSH.exe", "home")) ns.brutessh(host);
  if (ns.fileExists("FTPCrack.exe", "home")) ns.ftpcrack(host);
  if (ns.fileExists("relaySMTP.exe", "home")) ns.relaysmtp(host);
  if (ns.fileExists("HTTPWorm.exe", "home")) ns.httpworm(host);
  if (ns.fileExists("SQLInject.exe", "home")) ns.sqlinject(host);

  try {
    ns.nuke(host);
  } catch {
    return false;
  }
  return ns.hasRootAccess(host);
}

function pickTarget(ns, hosts) {
  const level = ns.getHackingLevel();
  let best = "n00dles";
  let bestScore = -1;

  for (const h of hosts) {
    if (!ns.hasRootAccess(h)) continue;
    if (ns.getServerRequiredHackingLevel(h) > level) continue;
    const maxMoney = ns.getServerMaxMoney(h);
    if (maxMoney <= 0) continue;

    const growth = Math.max(1, ns.getServerGrowth(h));
    const minSec = Math.max(1, ns.getServerMinSecurityLevel(h));
    const score = (maxMoney * growth) / minSec;
    if (score > bestScore) {
      bestScore = score;
      best = h;
    }
  }

  return best;
}

function deploy(ns, hosts, target) {
  const ramPerThread = ns.getScriptRam(WORKER, "home");
  let threads = 0;

  for (const host of hosts) {
    if (!ns.hasRootAccess(host)) continue;
    if (!ns.scp(WORKER, host, "home")) continue;

    const max = ns.getServerMaxRam(host);
    const used = ns.getServerUsedRam(host);
    const reserve = host === "home" ? HOME_RESERVE_GB : 0;
    const free = Math.max(0, max - used - reserve);
    const t = Math.floor(free / ramPerThread);
    if (t <= 0) continue;

    ns.scriptKill(WORKER, host);
    const pid = ns.exec(WORKER, host, t, target);
    if (pid !== 0) threads += t;
  }

  return threads;
}

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  ns.tail();

  while (true) {
    const hosts = scanAll(ns);
    let newRoots = 0;
    for (const host of hosts) {
      const had = ns.hasRootAccess(host);
      const has = tryRoot(ns, host);
      if (!had && has) newRoots += 1;
    }

    const target = pickTarget(ns, hosts);
    const totalThreads = deploy(ns, hosts, target);

    ns.clearLog();
    ns.print(`[starter] hosts=${hosts.length} newRoots=${newRoots} target=${target} threads=${totalThreads}`);
    ns.print(`[starter] Run main.js after upgrading home RAM (recommended >= 32GB).`);

    await ns.sleep(LOOP_MS);
  }
}
