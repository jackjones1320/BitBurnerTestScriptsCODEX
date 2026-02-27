function getHostFreeRam(ns, host, homeReserveGb) {
  try {
    const maxRam = ns.getServerMaxRam(host);
    const usedRam = ns.getServerUsedRam(host);
    const reserve = host === "home" ? homeReserveGb : 0;
    return Math.max(0, maxRam - usedRam - reserve);
  } catch {
    return 0;
  }
}

function getJobRam(ns, script) {
  const ram = ns.getScriptRam(script, "home");
  if (!Number.isFinite(ram) || ram <= 0) return null;
  return ram;
}

function placementPriority(a, b) {
  if (a.host === "home" && b.host !== "home") return 1;
  if (b.host === "home" && a.host !== "home") return -1;
  return b.freeRam - a.freeRam;
}

export function createCapacitySnapshot(ns, runnerHosts, homeReserveGb) {
  return runnerHosts
    .map((host) => ({ host, freeRam: getHostFreeRam(ns, host, homeReserveGb) }))
    .filter((slot) => slot.freeRam > 0)
    .sort(placementPriority);
}

/**
 * Best-fit allocation across hosts. Keeps home as last choice to preserve responsiveness.
 */
export function allocateJobThreads(ns, capacities, job) {
  const ramPerThread = getJobRam(ns, job.script);
  if (!ramPerThread) {
    return { placements: [], assignedThreads: 0, missingThreads: job.threads };
  }

  let remaining = job.threads;
  const placements = [];

  const candidateOrder = capacities
    .map((slot, index) => ({ index, host: slot.host, freeRam: slot.freeRam }))
    .filter((slot) => slot.freeRam >= ramPerThread)
    .sort((a, b) => {
      const aThreads = Math.floor(a.freeRam / ramPerThread);
      const bThreads = Math.floor(b.freeRam / ramPerThread);
      if (aThreads === bThreads) return placementPriority(a, b);
      return aThreads - bThreads;
    });

  for (const candidate of candidateOrder) {
    if (remaining <= 0) break;

    const slot = capacities[candidate.index];
    const maxThreads = Math.floor(slot.freeRam / ramPerThread);
    if (maxThreads <= 0) continue;

    const assigned = Math.min(maxThreads, remaining);
    remaining -= assigned;
    slot.freeRam -= assigned * ramPerThread;
    placements.push({ host: slot.host, threads: assigned });
  }

  return {
    placements,
    assignedThreads: job.threads - remaining,
    missingThreads: remaining,
  };
}
