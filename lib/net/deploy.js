/**
 * Copy worker scripts to a destination host.
 */
export function deployWorkersToHost(ns, host, scripts) {
  if (host === "home") return true;
  return ns.scp(scripts, host, "home");
}

export function deployWorkersFleet(ns, hosts, scripts) {
  let copied = 0;
  for (const host of hosts) {
    if (!ns.hasRootAccess(host)) continue;
    if (deployWorkersToHost(ns, host, scripts)) copied += 1;
  }

  return copied;
}
