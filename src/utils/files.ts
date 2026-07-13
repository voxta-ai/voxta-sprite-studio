export const baseName = (p: string) => p.split(/[\\/]/).pop() || '';

/**
 * Merge newly added file paths into an existing list.
 * New files are appended; a file whose name already exists replaces the old one
 * (keeping its original position).
 */
export function mergeFiles(prev: string[], incoming: string[]): string[] {
  const byName = new Map(prev.map((p) => [baseName(p), p]));
  for (const p of incoming) byName.set(baseName(p), p);
  return Array.from(byName.values());
}
