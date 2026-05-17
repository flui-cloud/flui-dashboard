/**
 * Builds the "Open app" link for a catalog install. Honours the manifest's
 * `entrypointPath` (e.g. PocketBase `/_/`, Jupyter `/lab`) so the user doesn't
 * land on a root URL that returns 404.
 *
 * Per the integration doc: `href = https://${fqdn}${entrypointPath ?? '/'}`.
 * The backend guarantees valid paths always start with '/', so we only append
 * a default '/' when `entrypointPath` is missing.
 */
export function buildOpenAppUrl(
  fqdn: string | undefined | null,
  entrypointPath?: string | null,
  tlsEnabled: boolean = true,
): string {
  if (!fqdn) return '';
  const path = entrypointPath?.startsWith('/') ? entrypointPath : '/';
  const scheme = tlsEnabled ? 'https' : 'http';
  return `${scheme}://${fqdn}${path}`;
}

/**
 * K8s label the backend sets on every application installed from the catalog.
 * The value is the catalog app definition slug (e.g. "vaultwarden").
 */
export const CATALOG_APP_LABEL = 'flui.cloud/catalog-app';
