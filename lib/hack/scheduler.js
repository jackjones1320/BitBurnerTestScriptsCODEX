function getCapacity(ns, host, homeReserveGb) {
  const maxRam = ns.getServerMaxRam(host);
  const usedRam = ns.getServerUsedRam(host);
  const reserve = host === "home" ? homeReserveGb : 0;
  return Math.max(0, maxRam - usedRam - reserve);
}

function allocateThreads(ns, capacities, script, threads) {
  const ramPerThread = ns.getScriptRam(script, "home");
  if (!Number.isFinite(ramPerThread) || ramPerThread <= 0) return [];

  let remaining = threads;
  const placement = [];

  for (const slot of capacities) {
    if (remaining <= 0) break;
    const maxThreads = Math.floor(slot.freeRam / ramPerThread);
    if (maxThreads <= 0) continue;

    const assigned = Math.min(maxThreads, remaining);
    slot.freeRam -= assigned * ramPerThread;
    remaining -= assigned;
    placement.push({ host: slot.host, threads: assigned });
  }

  if (remaining > 0) return [];
  return placement;
}

export function executeJobSet(ns, runnerHosts, jobs, target, batchTag, homeReserveGb) {
  const capacities = runnerHosts
    .map((host) => ({ host, freeRam: getCapacity(ns, host, homeReserveGb) }))
    .filter((slot) => slot.freeRam > 0)
    .sort((a, b) => b.freeRam - a.freeRam);

  let launchedScripts = 0;
  let launchedThreads = 0;

  for (const job of jobs) {
    const placements = allocateThreads(ns, capacities, job.script, job.threads);
    if (placements.length === 0) continue;

    for (const place of placements) {
      const pid = ns.exec(job.script, place.host, place.threads, target, job.delayMs ?? 0, `${batchTag}:${job.tag ?? job.script}`);
      if (pid !== 0) {
        launchedScripts += 1;
        launchedThreads += place.threads;
      }
    }
  }

  return { launchedScripts, launchedThreads };
}
