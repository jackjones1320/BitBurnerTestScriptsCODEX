/**
 * Copy worker scripts to a destination host.
 */
export async function deployWorkersToHost(ns, host, scripts) {
  if (host === "home") return true;
  return await ns.scp(scripts, host, "home");
}

export async function deployWorkersFleet(ns, hosts, scripts) {
  let copied = 0;
  for (const host of hosts) {
    if (!ns.hasRootAccess(host)) continue;
    if (await deployWorkersToHost(ns, host, scripts)) copied += 1;
  }

  return copied;
}
