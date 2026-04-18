// CORS allowlist (A6).
//
// Production accepts *.lire-help.com plus any host listed in
// CORS_ALLOWED_HOSTS (comma-separated, `*.example.com` style for wildcards).
// Replit dev hosts and localhost are only reflected when NODE_ENV !==
// "production" — production builds must not trust *.replit.dev / *.replit.app.

export type CorsOptions = {
  isProd: boolean;
  extraAllowedHosts: string[];
};

export function parseAllowedHosts(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
}

function matchesHost(origin: string, host: string): boolean {
  if (host.startsWith("*.")) {
    const suffix = host.slice(1);
    return origin.endsWith(suffix);
  }
  return origin.endsWith(host);
}

export function isCorsOriginAllowed(origin: string, opts: CorsOptions): boolean {
  if (!origin) return false;

  const isLireHelp = /\.lire-help\.com$/.test(origin);
  const isExtra = opts.extraAllowedHosts.some((host) => matchesHost(origin, host));
  const isDevHost =
    /\.replit\.dev$/.test(origin) ||
    /\.replit\.app$/.test(origin) ||
    origin.startsWith("http://localhost") ||
    origin.startsWith("http://127.0.0.1");

  if (isLireHelp || isExtra) return true;
  if (!opts.isProd && isDevHost) return true;
  return false;
}
