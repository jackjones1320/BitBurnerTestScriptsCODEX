const STATE_FILE = "/data/runtime-state.txt";

/**
 * Persist loop metadata for observability and future anti-collision locks.
 */
export function writeState(ns, partial) {
  const current = readState(ns);
  const merged = { ...current, ...partial, updatedAt: Date.now() };
  ns.write(STATE_FILE, JSON.stringify(merged, null, 2), "w");
}

export function readState(ns) {
  if (!ns.fileExists(STATE_FILE, "home")) {
    return {};
  }

  try {
    const raw = ns.read(STATE_FILE);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export { STATE_FILE };
