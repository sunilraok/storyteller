/**
 * Whether `email` may sign in. `allowList` is a comma-separated list of addresses
 * and/or "@domain" entries; an empty list allows any verified Google account.
 */
export function isAllowedEmail(email: string, allowList: string | undefined): boolean {
  const entries = (allowList ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!entries.length) return true;
  const addr = email.toLowerCase();
  return entries.some((e) => (e.startsWith("@") ? addr.endsWith(e) : addr === e));
}
