import { allocateJobThreads, createCapacitySnapshot } from "./allocator.js";

const JOB_PRIORITY = {
  weaken: 0,
  grow: 1,
  hack: 2,
};

function getPriority(tag = "") {
  if (tag.startsWith("weaken") || tag.startsWith("prep-w")) return JOB_PRIORITY.weaken;
  if (tag.startsWith("grow") || tag.startsWith("prep-g")) return JOB_PRIORITY.grow;
  if (tag.startsWith("hack")) return JOB_PRIORITY.hack;
  return 99;
}

function jobSort(a, b) {
  const byPriority = getPriority(a.tag) - getPriority(b.tag);
  if (byPriority !== 0) return byPriority;
  return b.threads - a.threads;
}

function getAllocatedPlan(ns, capacities, jobs) {
  const plan = [];
  let requestedThreads = 0;
  let missingThreads = 0;

  for (const job of jobs) {
    requestedThreads += job.threads;
    const allocation = allocateJobThreads(ns, capacities, job);
    plan.push({ job, allocation });
    missingThreads += allocation.missingThreads;
  }

  return { plan, requestedThreads, missingThreads };
}

export function executeJobSet(ns, runnerHosts, jobs, target, batchTag, homeReserveGb, options = {}) {
  const capacities = createCapacitySnapshot(ns, runnerHosts, homeReserveGb);
  const orderedJobs = [...jobs].sort(jobSort);

  let launchedScripts = 0;
  let launchedThreads = 0;
  let droppedThreads = 0;

  const strict = options.strict === true;
  const previewCapacities = capacities.map((slot) => ({ ...slot }));
  const preview = getAllocatedPlan(ns, previewCapacities, orderedJobs);
  const requestedThreads = preview.requestedThreads;

  if (strict && preview.missingThreads > 0) {
    return {
      launchedScripts: 0,
      launchedThreads: 0,
      requestedThreads,
      droppedThreads: requestedThreads,
      utilization: 0,
    };
  }

  for (const item of preview.plan) {
    const { job, allocation } = item;
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
