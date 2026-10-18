import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { MaskModeService } from '../services/mask-mode.service';
import { AppConfigService } from '../services/app-config.service';

/**
 * Stamps `x-mask-mode: on` while the local toggle is enabled — on requests to
 * the Flui API only. Another origin (the identity provider's discovery and
 * token endpoints) would refuse an unknown header in its CORS preflight, and
 * sign-in would fail with it. The backend decides what gets substituted; this
 * makes no decision of its own and never touches the response.
 */
export const maskModeInterceptor: HttpInterceptorFn = (req, next) => {
  const headers = maskModeHeaders(
    inject(MaskModeService).enabled(),
    req.url,
    inject(AppConfigService).apiBaseUrl,
  );
  return Object.keys(headers).length ? next(req.clone({ setHeaders: headers })) : next(req);
};

/** The same decision for a request that does not go through HttpClient, such as a stream read with fetch. */
export function maskModeHeaders(enabled: boolean, url: string, apiBaseUrl: string): Record<string, string> {
  return enabled && isFluiApi(url, apiBaseUrl) ? { 'x-mask-mode': 'on' } : {};
}

function isFluiApi(url: string, apiBaseUrl: string): boolean {
  if (url.startsWith('/') && !url.startsWith('//')) return true;
  let base = apiBaseUrl ?? '';
  while (base.endsWith('/')) base = base.slice(0, -1);
  return !!base && (url === base || url.startsWith(`${base}/`));
}
