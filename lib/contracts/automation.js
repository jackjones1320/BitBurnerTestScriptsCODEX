import { solveContract } from "./solver.js";

function listContractsOnHost(ns, host) {
  return ns.ls(host, ".cct").map((file) => ({ host, file }));
}

export function solveContracts(ns, hosts, state, logger) {
  const contracts = [];
  for (const host of hosts) {
    contracts.push(...listContractsOnHost(ns, host));
  }

  let solved = 0;
  let failed = 0;
  let skipped = 0;

  for (const contract of contracts) {
    const key = `${contract.host}:${contract.file}`;
    if (state.attempted.has(key)) continue;

    state.attempted.add(key);
    const type = ns.codingcontract.getContractType(contract.file, contract.host);
    const data = ns.codingcontract.getData(contract.file, contract.host);
    const answer = solveContract(type, data);

    if (!answer.solved) {
      skipped += 1;
      logger.warn(`contract unsupported type='${type}' host=${contract.host} file=${contract.file} reason=${answer.reason}`);
      continue;
    }

    const reward = ns.codingcontract.attempt(answer.answer, contract.file, contract.host, { returnReward: true });
    if (reward) {
      solved += 1;
      logger.info(`contract solved type='${type}' host=${contract.host} reward=${reward}`);
    } else {
      failed += 1;
      logger.warn(`contract failed type='${type}' host=${contract.host} file=${contract.file}`);
    }
  }

  return {
    discovered: contracts.length,
    solved,
    failed,
    skipped,
  };
}
