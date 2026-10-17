const MAX_SLUG = 20;
const WILDCARD_DNS = ['nip.io', 'sslip.io'];
const ROLE_LABELS = new Set(['api', 'app', 'dashboard', 'www']);
const IP_LABEL = /^\d{1,3}(-\d{1,3}){3}$/;

/**
 * The name an agent registers this instance's MCP server under, so that two
 * instances added to the same agent never collide.
 *
 * Rule: `flui-<slug>`, where the slug comes from the host of the MCP endpoint.
 * A wildcard-DNS host (nip.io, sslip.io) keeps only the labels before its IP,
 * or the dashed IP when there are none. A leading api/app/dashboard/www label
 * is dropped. An explicit port is kept. Everything else becomes `-`, and the
 * slug is cut to 20 characters on a `-` boundary so tool names stay within
 * what agents accept.
 */
export function mcpServerName(endpoint: string): string {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return 'flui';
  }
  const slug = hostSlug(url.hostname.toLowerCase(), url.port);
  return slug ? `flui-${slug}` : 'flui';
}

function hostSlug(hostname: string, port: string): string {
  let labels = hostname.split('.').filter(Boolean);
  if (labels.length > 1 && ROLE_LABELS.has(labels[0])) labels = labels.slice(1);
  const wildcard = WILDCARD_DNS.find((suffix) => hostname.endsWith(`.${suffix}`));
  if (wildcard) {
    labels = labels.slice(0, -wildcard.split('.').length);
    const ip = dottedOrDashedIp(labels);
    const named = labels.slice(0, labels.length - ip.length);
    labels = named.length > 0 ? named : ip;
  }
  if (labels.length > 0) labels[0] = labels[0].replace(/^(api|app)-/, '');
  const raw = [...labels, port]
    .filter(Boolean)
    .join('-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cut(raw);
}

function dottedOrDashedIp(labels: string[]): string[] {
  const last = labels.at(-1);
  if (last && IP_LABEL.test(last)) return [last];
  const tail = labels.slice(-4);
  if (tail.length === 4 && tail.every((l) => /^\d{1,3}$/.test(l))) return tail;
  return [];
}

function cut(slug: string): string {
  if (slug.length <= MAX_SLUG) return slug;
  const head = slug.slice(0, MAX_SLUG);
  const boundary = head.lastIndexOf('-');
  return (boundary > 0 ? head.slice(0, boundary) : head).replace(/-+$/, '');
}
