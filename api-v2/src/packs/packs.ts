/**
 * Which business packs this installation loads. PACKS is a comma list in the environment (PACKS=pharmacy); not set means every pack there is.
 * A pack that is not loaded adds no routes, no hooks and no screens' data; a business of another type never sees it either way.
 */
export const ALL_PACKS = ['pharmacy'];

export const packEnabled = (name: string, env: string | undefined = process.env.PACKS): boolean => {
  if (env === undefined || env === null || env.trim() === '') return ALL_PACKS.includes(name);
  return env.split(',').map((s) => s.trim().toLowerCase()).includes(name);
};
