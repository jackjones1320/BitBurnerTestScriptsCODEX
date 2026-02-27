function clampPow2Ram(value, max) {
  let ram = 1;
  while (ram < value) ram *= 2;
  return Math.min(ram, max);
}

function getTargetPurchaseRam(ns, config) {
  const maxPurchasable = ns.getPurchasedServerMaxRam();
  const desired = Math.max(config.minRamGb, Math.floor(ns.getServerMaxRam("home") * config.homeRamFraction));
  return clampPow2Ram(desired, maxPurchasable);
}

function makeHostname(prefix, ram, seq) {
  return `${prefix}-${ram}gb-${seq}`;
}

function emitSpend(ns, amount, subject) {
  ns.tprint(`[${ns.getScriptName()}] spent $${ns.formatNumber(amount, 2)} on ${subject}`);
}

export function managePurchasedServers(ns, config) {
  if (!config?.enabled) return { action: "disabled" };

  const purchased = ns.getPurchasedServers();
  const limit = ns.getPurchasedServerLimit();
  const targetRam = getTargetPurchaseRam(ns, config);
  const cost = ns.getPurchasedServerCost(targetRam);
  const money = ns.getServerMoneyAvailable("home");
  const budget = Math.max(0, money - config.moneyReserve);

  if (budget < cost) {
    return { action: "defer", reason: "insufficient-funds", targetRam, cost, budget };
  }

  if (purchased.length < limit) {
    const hostname = makeHostname(config.prefix, targetRam, purchased.length + 1);
    const created = ns.purchaseServer(hostname, targetRam);
    if (created) emitSpend(ns, cost, `purchased server ${created}`);
    return {
      action: created ? "purchased" : "defer",
      host: created || null,
      targetRam,
      cost,
    };
  }

  let weakest = null;
  for (const host of purchased) {
    const ram = ns.getServerMaxRam(host);
    if (!weakest || ram < weakest.ram) weakest = { host, ram };
  }

  if (!weakest || weakest.ram >= targetRam) {
    return { action: "stable", targetRam };
  }

  if (ns.ps(weakest.host).length > 0) {
    ns.killall(weakest.host, true);
  }

  if (!ns.deleteServer(weakest.host)) {
    return { action: "defer", reason: "delete-failed", targetRam, replaced: weakest.host };
  }

  const replacementName = makeHostname(config.prefix, targetRam, Date.now());
  const replacement = ns.purchaseServer(replacementName, targetRam);
  if (replacement) emitSpend(ns, cost, `replacement server ${replacement}`);
  return {
    action: replacement ? "replaced" : "defer",
    host: replacement || null,
    replaced: weakest.host,
    targetRam,
    cost,
  };
}
