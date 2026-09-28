/** When allowlist is empty, all sites are allowed. */
export function isHostAllowed(hostname: string, allowlist: string[]): boolean {
  if (!allowlist?.length) return true;
  const host = hostname.toLowerCase();
  return allowlist.some((entry) => {
    const domain = entry.trim().toLowerCase();
    if (!domain) return false;
    return host === domain || host.endsWith(`.${domain}`);
  });
}
