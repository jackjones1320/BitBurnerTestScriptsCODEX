const REPO_OWNER = "jackjones1320";
const REPO_NAME = "BitBurnerTestScriptsCODEX";
const REPO_BRANCH = "main";

function toTempFile(path) {
  return `/Temp/git-pull-${path.replaceAll("/", "__")}`;
}

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

  let downloaded = 0;
  let failed = 0;
  const added = [];
  const updated = [];
  const unchanged = [];
  const cacheBuster = Date.now();

  for (const file of files) {
    const rawUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${REPO_BRANCH}/${file}?v=${cacheBuster}`;
    const target = `/${file}`;
    const tempFile = toTempFile(file);

    const ok = await ns.wget(rawUrl, tempFile);
    if (!ok) {
      failed += 1;
      ns.print(`[FAIL] ${target}`);
      await ns.sleep(20);
      continue;
    }

    downloaded += 1;
    const current = ns.read(target);
    const incoming = ns.read(tempFile);

    if (!current) {
      ns.write(target, incoming, "w");
      added.push(target);
      ns.print(`[ADDED] ${target}`);
    } else if (current !== incoming) {
      ns.write(target, incoming, "w");
      updated.push(target);
      ns.print(`[UPDATED] ${target}`);
    } else {
      unchanged.push(target);
      ns.print(`[UNCHANGED] ${target}`);
    }

    await ns.sleep(20);
  }

  ns.tprint(
    `Git pull complete. Downloaded ${downloaded}/${files.length} .js files from ${REPO_OWNER}/${REPO_NAME}@${REPO_BRANCH}.`,
  );
  ns.tprint(`Changes: added=${added.length}, updated=${updated.length}, unchanged=${unchanged.length}, failed=${failed}`);

  if (added.length > 0) ns.tprint(`Added: ${added.join(", ")}`);
  if (updated.length > 0) ns.tprint(`Updated: ${updated.join(", ")}`);
  if (failed > 0) ns.tprint("Some files failed to download. Check script logs for details.");
}
