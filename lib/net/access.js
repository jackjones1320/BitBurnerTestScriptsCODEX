function safeHasRootAccess(ns, host) {
  try {
    return ns.hasRootAccess(host);
  } catch {
    return false;
  }
}

/**
 * Attempt to gain root on a host with whatever port crackers currently exist.
 *
 * Note: keep calls to ns port-opener functions static (no ns[fn] indirection),
 * otherwise Bitburner can treat this as dynamic RAM usage and reject execution.
 */
export function tryRoot(ns, host, crackers) {
  if (host === "home") return true;
  if (safeHasRootAccess(ns, host)) return true;

  let opened = 0;

  for (const cracker of crackers) {
    if (!ns.fileExists(cracker.file, "home")) continue;

    if (cracker.file === "BruteSSH.exe") {
      ns.brutessh(host);
      opened += 1;
      continue;
    }

    if (cracker.file === "FTPCrack.exe") {
      ns.ftpcrack(host);
      opened += 1;
      continue;
    }

    if (cracker.file === "relaySMTP.exe") {
      ns.relaysmtp(host);
      opened += 1;
      continue;
    }

    if (cracker.file === "HTTPWorm.exe") {
      ns.httpworm(host);
      opened += 1;
      continue;
    }

    if (cracker.file === "SQLInject.exe") {
      ns.sqlinject(host);
      opened += 1;
    }
  }

  const required = ns.getServerNumPortsRequired(host);
  if (opened < required) return false;

  ns.nuke(host);
  return safeHasRootAccess(ns, host);
}

export function rootMany(ns, hosts, crackers) {
  const rootedNow = [];
  for (const host of hosts) {
    const hadRoot = safeHasRootAccess(ns, host);
    const hasRoot = tryRoot(ns, host, crackers);
    if (!hadRoot && hasRoot) rootedNow.push(host);
  }

  return rootedNow;
}
