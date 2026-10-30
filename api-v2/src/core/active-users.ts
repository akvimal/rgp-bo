/**
 * Whether a login is still active, remembered for a few seconds so the request guard does not ask the database on every call.
 * Removing a login forgets it at once, so a removal takes effect on the next request; any other way a login stops being active
 * (archiving it, say) is noticed within the TTL. Pure apart from the clock, which is passed in for the tests.
 */
export const ACTIVE_TTL_MS = 5000;

const seen = new Map<number, { ok: boolean; at: number }>();

export async function isActiveUser(id: number, load: (id: number) => Promise<boolean>, now: number = Date.now()): Promise<boolean> {
  const hit = seen.get(id);
  if (hit && now - hit.at < ACTIVE_TTL_MS) return hit.ok;
  const ok = await load(id);
  seen.set(id, { ok, at: now });
  return ok;
}

/** a login was removed or changed: the next request asks again */
export function forgetUser(id: number) {
  seen.delete(id);
}

/** for tests */
export function forgetAllUsers() {
  seen.clear();
}
