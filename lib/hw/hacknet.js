function estimateNodeProduction(level, ram, cores, productionMult) {
  return level * 1.5 * Math.pow(1.035, ram - 1) * ((cores + 5) / 6) * productionMult;
}

function getProductionMult(ns) {
  try {
    return ns.getHacknetMultipliers().production ?? 1;
  } catch {
    return 1;
  }
}

function formatMoney(ns, amount) {
  return ns.formatNumber(amount, 2);
}

function emitSpend(ns, script, amount, subject) {
  ns.tprint(`[${script}] spent $${formatMoney(ns, amount)} on ${subject}`);
}

function getBestHacknetAction(ns, config) {
  const count = ns.hacknet.numNodes();
  const maxNodes = ns.hacknet.maxNumNodes();
  const maxLevel = ns.hacknet.getMaxLevel();
  const maxRam = ns.hacknet.getMaxRam();
  const maxCores = ns.hacknet.getMaxCores();
  const productionMult = getProductionMult(ns);

  let best = null;

  if (count < maxNodes) {
    const cost = ns.hacknet.getPurchaseNodeCost();
    if (cost > 0 && Number.isFinite(cost)) {
      const delta = estimateNodeProduction(1, 1, 1, productionMult);
      best = {
        type: "purchase-node",
        cost,
        delta,
        paybackSec: cost / Math.max(delta, 1e-9),
      };
    }
  }

  for (let i = 0; i < count; i += 1) {
    const stats = ns.hacknet.getNodeStats(i);
    const current = estimateNodeProduction(stats.level, stats.ram, stats.cores, productionMult);

    if (stats.level < maxLevel) {
      const cost = ns.hacknet.getLevelUpgradeCost(i, 1);
      const next = estimateNodeProduction(stats.level + 1, stats.ram, stats.cores, productionMult);
      const delta = Math.max(0, next - current);
      if (cost > 0 && delta > 0) {
        const candidate = { type: "upgrade-level", node: i, cost, delta, paybackSec: cost / delta };
        if (!best || candidate.paybackSec < best.paybackSec) best = candidate;
      }
    }

    if (stats.ram < maxRam) {
      const cost = ns.hacknet.getRamUpgradeCost(i, 1);
      const next = estimateNodeProduction(stats.level, stats.ram * 2, stats.cores, productionMult);
      const delta = Math.max(0, next - current);
      if (cost > 0 && delta > 0) {
        const candidate = { type: "upgrade-ram", node: i, cost, delta, paybackSec: cost / delta };
        if (!best || candidate.paybackSec < best.paybackSec) best = candidate;
      }
    }

    if (stats.cores < maxCores) {
      const cost = ns.hacknet.getCoreUpgradeCost(i, 1);
      const next = estimateNodeProduction(stats.level, stats.ram, stats.cores + 1, productionMult);
      const delta = Math.max(0, next - current);
      if (cost > 0 && delta > 0) {
        const candidate = { type: "upgrade-core", node: i, cost, delta, paybackSec: cost / delta };
        if (!best || candidate.paybackSec < best.paybackSec) best = candidate;
      }
    }
  }

  if (!best) return null;
  if (best.paybackSec > config.maxPaybackSeconds) return { ...best, rejected: "payback" };
  return best;
}

export function manageHacknet(ns, config) {
  if (!config?.enabled) return { action: "disabled" };

  const script = ns.getScriptName();
  const money = ns.getServerMoneyAvailable("home");
  const budget = Math.max(0, money - config.moneyReserve);
  const best = getBestHacknetAction(ns, config);

  if (!best) return { action: "stable" };
  if (best.rejected === "payback") {
    return { action: "defer", reason: "payback", paybackSec: best.paybackSec, cost: best.cost };
  }
  if (best.cost > budget) {
    return { action: "defer", reason: "insufficient-funds", cost: best.cost, budget };
  }

  if (best.type === "purchase-node") {
    const idx = ns.hacknet.purchaseNode();
    if (idx >= 0) {
      emitSpend(ns, script, best.cost, `hacknet node ${idx}`);
      return { action: "purchased", type: best.type, node: idx, cost: best.cost, paybackSec: best.paybackSec };
    }
    return { action: "defer", reason: "purchase-failed", type: best.type, cost: best.cost };
  }

  const node = best.node;
  let ok = false;
  if (best.type === "upgrade-level") ok = ns.hacknet.upgradeLevel(node, 1);
  if (best.type === "upgrade-ram") ok = ns.hacknet.upgradeRam(node, 1);
  if (best.type === "upgrade-core") ok = ns.hacknet.upgradeCore(node, 1);

  if (ok) {
    emitSpend(ns, script, best.cost, `hacknet ${best.type.replace("upgrade-", "")} upgrade on node ${node}`);
    return { action: "upgraded", type: best.type, node, cost: best.cost, paybackSec: best.paybackSec };
  }

  return { action: "defer", reason: "upgrade-failed", type: best.type, node, cost: best.cost };
}
