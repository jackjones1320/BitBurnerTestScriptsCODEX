import { scanAllServers } from "../lib/net/scan.js";

function buildPaths(edges) {
  const parent = { home: null };
  const queue = ["home"];

  while (queue.length > 0) {
    const host = queue.shift();
    for (const neighbor of edges[host] ?? []) {
      if (parent[neighbor] !== undefined) continue;
      parent[neighbor] = host;
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

  return { parent, pathFor };
}

function getConnectCommand(path) {
  if (path.length <= 1) return "home";
  return path.join("; connect ");
}

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");

  const { hosts, edges } = scanAllServers(ns);
  const { pathFor } = buildPaths(edges);
  const playerLevel = ns.getHackingLevel();

  const connectable = hosts
    .filter((host) => host !== "home")
    .map((host) => {
      const reqLevel = ns.getServerRequiredHackingLevel(host);
      const path = pathFor(host);
      return {
        host,
        reqLevel,
        rooted: ns.hasRootAccess(host),
        path,
        command: getConnectCommand(path),
      };
    })
    .filter((entry) => entry.path.length > 0 && entry.reqLevel <= playerLevel)
    .sort((a, b) => a.reqLevel - b.reqLevel || a.host.localeCompare(b.host));

  ns.tprint(`Connectable targets (hack level <= ${playerLevel}): ${connectable.length}`);
  for (const entry of connectable) {
    const rootFlag = entry.rooted ? "rooted" : "no-root";
    ns.tprint(`${entry.host.padEnd(20)} req=${String(entry.reqLevel).padStart(4)} ${rootFlag.padEnd(8)} :: ${entry.command}`);
  }

  if (connectable.length === 0) return;

  const pick = await ns.prompt("Pick a server to connect to", {
    type: "select",
    choices: connectable.map((entry) => entry.host),
  });

  if (!pick) return;

  const singularity = ns.singularity;
  if (!singularity || typeof singularity.connect !== "function") {
    ns.tprint(`Selected: ${pick}. Auto-connect requires Singularity access. Use: ${connectable.find((x) => x.host === pick)?.command}`);
    return;
  }

  const selected = connectable.find((entry) => entry.host === pick);
  if (!selected) return;

  singularity.connect("home");
  for (const host of selected.path.slice(1)) {
    singularity.connect(host);
  }

  ns.tprint(`Connected to ${pick}. Path: ${selected.command}`);
}
