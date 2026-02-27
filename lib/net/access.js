/**
 * Attempt to gain root on a host with whatever port crackers currently exist.
 */
export function tryRoot(ns, host, crackers) {
  if (host === "home") return true;
  if (ns.hasRootAccess(host)) return true;

  let opened = 0;
  for (const cracker of crackers) {
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

export function rootMany(ns, hosts, crackers) {
  const rootedNow = [];
  for (const host of hosts) {
    const hadRoot = ns.hasRootAccess(host);
    const hasRoot = tryRoot(ns, host, crackers);
    if (!hadRoot && hasRoot) rootedNow.push(host);
  }

  return rootedNow;
}
