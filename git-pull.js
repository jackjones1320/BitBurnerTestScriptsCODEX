const REPO_OWNER = "jackjones1320";
const REPO_NAME = "BitBurnerTestScriptsCODEX";
const REPO_BRANCH = "main";

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");

  const treeUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/trees/${REPO_BRANCH}?recursive=1`;
  const treeOk = await ns.wget(treeUrl, "/Temp/git-tree.json");

  if (!treeOk) {
    ns.tprint(`Failed to fetch repo tree from ${treeUrl}`);
    return;
  }

  let treeData;
  try {
    treeData = JSON.parse(ns.read("/Temp/git-tree.json"));
  } catch {
    ns.tprint("Failed to parse GitHub tree response.");
    return;
  }

  if (!treeData?.tree || !Array.isArray(treeData.tree)) {
    const message = treeData?.message ? ` (${treeData.message})` : "";
    ns.tprint(`GitHub API did not return a file tree${message}.`);
    return;
  }

  const files = treeData.tree
    .filter((entry) => entry.type === "blob")
    .map((entry) => entry.path)
    .filter((path) => path.endsWith(".js"));

  if (files.length === 0) {
    ns.tprint("No .js files found to download.");
    return;
  }

  let success = 0;
  let failed = 0;
  const cacheBuster = Date.now();

  for (const file of files) {
    const rawUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${REPO_BRANCH}/${file}?v=${cacheBuster}`;
    const ok = await ns.wget(rawUrl, `/${file}`);

    if (ok) {
      success += 1;
      ns.print(`[OK] /${file}`);
    } else {
      failed += 1;
      ns.print(`[FAIL] /${file}`);
    }

    await ns.sleep(20);
  }

  ns.tprint(
    `Git pull complete. Downloaded ${success}/${files.length} .js files from ${REPO_OWNER}/${REPO_NAME}@${REPO_BRANCH}.`,
  );
  if (failed > 0) {
    ns.tprint(`Failed files: ${failed}. Check script logs for details.`);
  }
}
