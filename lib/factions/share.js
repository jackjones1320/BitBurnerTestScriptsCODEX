function getSingularity(ns) {
  return ns.singularity ?? null;
}

function getCurrentWorkFaction(ns) {
  try {
    const current = getSingularity(ns)?.getCurrentWork?.();
    return current?.factionName ?? ns.getPlayer()?.currentWorkFactionName ?? null;
  } catch {
    return null;
  }
}

function getTopRepGapFactions(ns) {
  const singularity = getSingularity(ns);
  if (!singularity) return [];

  const factions = ns.getPlayer()?.factions ?? [];
  const needed = [];

  for (const faction of factions) {
    try {
      const augments = singularity.getAugmentationsFromFaction(faction) ?? [];
      if (augments.length === 0) continue;

      let highestRepReq = 0;
      for (const augment of augments) {
        const repReq = singularity.getAugmentationRepReq(augment);
        if (Number.isFinite(repReq) && repReq > highestRepReq) highestRepReq = repReq;
      }

      const factionRep = singularity.getFactionRep(faction);
      if (factionRep < highestRepReq) {
        needed.push({ faction, repGap: highestRepReq - factionRep });
      }
    } catch {
      continue;
    }
  }

  needed.sort((a, b) => b.repGap - a.repGap);
  return needed.map((entry) => entry.faction);
}

export function pickShareFaction(ns, state = { rotation: 0 }) {
  const currentWorkFaction = getCurrentWorkFaction(ns);
  if (currentWorkFaction) {
    return { faction: currentWorkFaction, reason: "current-work", state };
  }

  const fallback = getTopRepGapFactions(ns);
  if (fallback.length === 0) {
    return { faction: null, reason: "none-needed", state };
  }

  const rotation = Number.isInteger(state.rotation) ? state.rotation : 0;
  const index = ((rotation % fallback.length) + fallback.length) % fallback.length;
  const faction = fallback[index];

  return {
    faction,
    reason: "fallback-gap",
    state: {
      ...state,
      rotation: rotation + 1,
    },
  };
}

export function ensureFactionWork(ns, faction) {
  if (!faction) return false;

  const singularity = getSingularity(ns);
  if (!singularity?.workForFaction) return false;

  try {
    const current = singularity.getCurrentWork?.();
    if (current?.factionName === faction) return true;
  } catch {
    // fall through to work attempts
  }

  const workTypes = ["hacking", "field", "security"];
  for (const type of workTypes) {
    try {
      if (singularity.workForFaction(faction, type, false)) return true;
    } catch {
      continue;
    }
  }

  return false;
}

export function launchShareWindow(ns, runnerHosts, options = {}) {
  const {
    homeReserveGb = 16,
    script = "/scripts/worker-share.js",
    durationMs = 10_000,
    tag = "share",
    debug = false,
  } = options;

  const scriptRam = ns.getScriptRam(script, "home");
  if (!Number.isFinite(scriptRam) || scriptRam <= 0) {
    return { launchedScripts: 0, launchedThreads: 0 };
  }

  let launchedScripts = 0;
  let launchedThreads = 0;

  for (const host of runnerHosts) {
    try {
      const maxRam = ns.getServerMaxRam(host);
      const usedRam = ns.getServerUsedRam(host);
      const reserve = host === "home" ? homeReserveGb : 0;
      const freeRam = Math.max(0, maxRam - usedRam - reserve);
      const threads = Math.floor(freeRam / scriptRam);
      if (threads <= 0) continue;

      const pid = ns.exec(script, host, threads, durationMs, 0, tag, debug ? 1 : 0);
      if (pid !== 0) {
        launchedScripts += 1;
        launchedThreads += threads;
      }
    } catch {
      continue;
    }
  }

  return { launchedScripts, launchedThreads };
}
