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
    ],
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
  phase2: {
    targetPoolSize: 5,
    minSecurityBuffer: 5,
    growMoneyThreshold: 0.75,
  },
  starterTargets: ["n00dles", "foodnstuff", "sigma-cosmetics"],
};
