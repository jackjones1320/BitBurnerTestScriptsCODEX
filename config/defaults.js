/**
 * Global runtime tuning values.
 */
export const CONFIG = {
  loopIntervalMs: 5_000,
  statusIntervalMs: 30_000,
  homeReserveGb: 16,
  deploy: {
    workerScripts: [
      "/scripts/worker-hack.js",
      "/scripts/worker-grow.js",
      "/scripts/worker-weaken.js",
      "/scripts/worker-share.js",
    ],
    syncIntervalMs: 120_000,
  },
  contracts: {
    enabled: true,
    intervalMs: 20_000,
  },
  rooting: {
    // All stock port openers Bitburner can provide over progression.
    crackers: [
      { file: "BruteSSH.exe", fn: "brutessh" },
      { file: "FTPCrack.exe", fn: "ftpcrack" },
      { file: "relaySMTP.exe", fn: "relaysmtp" },
      { file: "HTTPWorm.exe", fn: "httpworm" },
      { file: "SQLInject.exe", fn: "sqlinject" },
    ],
  },
  sharing: {
    enabled: true,
    windowMs: 10_000,
  },
  phase2: {
    targetPoolSize: 5,
    minSecurityBuffer: 5,
    growMoneyThreshold: 0.75,
    targetStickMs: 60_000,
    switchLeadPct: 0.15,
  },
  phase3: {
    securityTolerance: 0.5,
    moneyReadyRatio: 0.99,
    hackFraction: 0.1,
    landingSpacingMs: 120,
    dispatchCadenceMs: 2_000,
  },
  phase4: {
    purchasedServers: {
      enabled: true,
      prefix: "bb-fleet",
      minRamGb: 16,
      homeRamFraction: 0.5,
      moneyReserve: 20_000_000,
    },
    hacknet: {
      enabled: true,
      moneyReserve: 5_000_000,
      maxPaybackSeconds: 3 * 60 * 60,
    },
  },
  starterTargets: ["n00dles", "foodnstuff", "sigma-cosmetics"],
};
