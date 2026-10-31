export const WEBSITE_MAX_LENGTH = 120;

/** A website address as typed ("www.shop.in" or "https://shop.in/pharmacy"): kept as typed, minus spaces at the ends. Empty is fine. */
export function checkWebsite(raw: any, label = 'The website'): { ok: true; value: string | null } | { ok: false; error: string } {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return { ok: true, value: null };
  if (text.length > WEBSITE_MAX_LENGTH) return { ok: false, error: `${label} can be at most ${WEBSITE_MAX_LENGTH} characters.` };
  if (!/^(https?:\/\/)?[A-Za-z0-9][A-Za-z0-9-]*(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}(:[0-9]{1,5})?(\/[^\s<>"']*)?$/.test(text)) {
    return { ok: false, error: `${label} does not look like a web address, for example www.yourshop.in.` };
  }
  return { ok: true, value: text };
}
