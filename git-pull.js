/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");

  const [repoArg, branchArg = "main"] = ns.args.map((v) => String(v ?? "").trim());
  const repo = repoArg || "";
  const branch = branchArg || "main";

  if (!repo || !repo.includes("/")) {
    ns.tprint("Usage: run git-pull.js <owner/repo> [branch=main]");
    ns.tprint("Example: run git-pull.js your-name/BitBurnerTestScripts main");
    return;
  }

  const [owner, name] = repo.split("/");
  const treeUrl = `https://api.github.com/repos/${owner}/${name}/git/trees/${branch}?recursive=1`;
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
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${name}/${branch}/${file}?v=${cacheBuster}`;
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

  ns.tprint(`Git pull complete. Downloaded ${success}/${files.length} .js files from ${repo}@${branch}.`);
  if (failed > 0) {
    ns.tprint(`Failed files: ${failed}. Check script logs for details.`);
  }
}
