/**
 * Small logger wrapper so all modules emit a consistent prefix.
 */
export function createLogger(ns, scope) {
  const prefix = `[${scope}]`;
  return {
    info: (msg) => ns.print(`${prefix} ${msg}`),
    warn: (msg) => ns.print(`${prefix} WARN: ${msg}`),
    error: (msg) => ns.print(`${prefix} ERROR: ${msg}`),
    tinfo: (msg) => ns.tprint(`${prefix} ${msg}`),
  };
}
