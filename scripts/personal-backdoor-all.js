import { scanAllServers } from "../lib/net/scan.js";

function buildParentMap(edges) {
  const parent = { home: null };
  const depth = { home: 0 };
  const queue = ["home"];

  while (queue.length > 0) {
    const host = queue.shift();
    for (const neighbor of edges[host] ?? []) {
      if (parent[neighbor] !== undefined) continue;
      parent[neighbor] = host;
      depth[neighbor] = depth[host] + 1;
      queue.push(neighbor);
    }
  }

  const pathFor = (target) => {
    if (parent[target] === undefined) return [];
    const path = [];
    let cursor = target;
    while (cursor !== null) {
      path.push(cursor);
      cursor = parent[cursor];
    }
    return path.reverse();
  };

  return { pathFor, depth };
}

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");

  if (!ns.singularity || typeof ns.singularity.installBackdoor !== "function") {
    ns.tprint("This script needs Singularity access (Source-File 4).");
    return;
  }

  const { hosts, edges } = scanAllServers(ns);
  const { pathFor, depth } = buildParentMap(edges);
  const playerLevel = ns.getHackingLevel();

  const candidates = hosts
    .filter((host) => host !== "home")
    .map((host) => {
      const info = ns.getServer(host);
      return {
        host,
        depth: depth[host] ?? Number.MAX_SAFE_INTEGER,
        requiredLevel: info.requiredHackingSkill,
        rooted: info.hasAdminRights,
        hasBackdoor: info.backdoorInstalled,
        path: pathFor(host),
      };
    })
    .filter((entry) => entry.rooted && !entry.hasBackdoor && entry.requiredLevel <= playerLevel && entry.path.length > 0)
    .sort((a, b) => a.depth - b.depth || a.requiredLevel - b.requiredLevel || a.host.localeCompare(b.host));

  ns.tprint(`Backdoor candidates: ${candidates.length}`);

  let installed = 0;
  for (const entry of candidates) {
    ns.singularity.connect("home");
    for (const step of entry.path.slice(1)) {
      ns.singularity.connect(step);
    }

    ns.tprint(`Installing backdoor on ${entry.host}...`);
    await ns.singularity.installBackdoor();
    installed += 1;
    ns.tprint(`Backdoor installed: ${entry.host}`);
  }

  ns.singularity.connect("home");
  ns.tprint(`Done. Installed ${installed} backdoor(s).`);
}
