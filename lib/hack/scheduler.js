import { allocateJobThreads, createCapacitySnapshot } from "./allocator.js";

const JOB_PRIORITY = {
  weaken: 0,
  grow: 1,
  hack: 2,
};

function jobSort(a, b) {
  const byPriority = (JOB_PRIORITY[a.tag] ?? 99) - (JOB_PRIORITY[b.tag] ?? 99);
  if (byPriority !== 0) return byPriority;
  return b.threads - a.threads;
}

export function executeJobSet(ns, runnerHosts, jobs, target, batchTag, homeReserveGb) {
  const capacities = createCapacitySnapshot(ns, runnerHosts, homeReserveGb);
  const orderedJobs = [...jobs].sort(jobSort);

  let launchedScripts = 0;
  let launchedThreads = 0;
  let requestedThreads = 0;
  let droppedThreads = 0;

  for (const job of orderedJobs) {
    requestedThreads += job.threads;

    const allocation = allocateJobThreads(ns, capacities, job);
    if (allocation.placements.length === 0) {
      droppedThreads += job.threads;
      continue;
    }

    for (const place of allocation.placements) {
      const pid = ns.exec(job.script, place.host, place.threads, target, job.delayMs ?? 0, `${batchTag}:${job.tag ?? job.script}`);
      if (pid !== 0) {
        launchedScripts += 1;
        launchedThreads += place.threads;
      } else {
        droppedThreads += place.threads;
      }
    }

    droppedThreads += allocation.missingThreads;
  }

  return {
    launchedScripts,
    launchedThreads,
    requestedThreads,
    droppedThreads,
    utilization: requestedThreads > 0 ? launchedThreads / requestedThreads : 1,
  };
}
