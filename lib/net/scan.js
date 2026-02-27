/**
 * Breadth-first scan from home and return all discovered hosts.
 */
export function scanAllServers(ns) {
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
