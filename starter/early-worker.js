/** @param {NS} ns */
export async function main(ns) {
  const target = String(ns.args[0] || "n00dles");

  while (true) {
    const minSec = ns.getServerMinSecurityLevel(target);
    const curSec = ns.getServerSecurityLevel(target);
    const maxMoney = ns.getServerMaxMoney(target);
    const curMoney = ns.getServerMoneyAvailable(target);

    // Early-game simple policy:
    // 1) Keep security close to min.
    // 2) Refill money.
    // 3) Hack only when the target is stable.
    if (curSec > minSec + 5) {
      await ns.weaken(target);
    } else if (maxMoney > 0 && curMoney < maxMoney * 0.75) {
      await ns.grow(target);
    } else {
      await ns.hack(target);
    }
  }
}
