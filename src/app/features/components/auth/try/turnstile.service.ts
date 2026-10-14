import { Injectable } from '@angular/core';

interface TurnstileApi {
  render(host: HTMLElement, options: Record<string, unknown>): string | undefined;
  remove(widgetId: string): void;
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export class TurnstileFailed extends Error {}

/** Cloudflare Turnstile, loaded once and only on the page that needs it. */
@Injectable({ providedIn: 'root' })
export class TurnstileService {
  private loading: Promise<TurnstileApi> | null = null;

  async token(siteKey: string, host: HTMLElement, timeoutMs = 30_000): Promise<string> {
    const api = await this.load();
    return new Promise<string>((resolve, reject) => {
      let widgetId: string | undefined;
      const finish = (settle: () => void) => {
        clearTimeout(timer);
        if (widgetId) api.remove(widgetId);
        settle();
      };
      const fail = () => finish(() => reject(new TurnstileFailed('challenge')));
      const timer = setTimeout(fail, timeoutMs);
      try {
        widgetId = api.render(host, {
          sitekey: siteKey,
          appearance: 'interaction-only',
          callback: (token: string) => finish(() => resolve(token)),
          'error-callback': fail,
          'expired-callback': fail,
          'timeout-callback': fail,
        });
      } catch {
        fail();
      }
    });
  }

  private load(): Promise<TurnstileApi> {
    const ready = (globalThis as { turnstile?: TurnstileApi }).turnstile;
    if (ready) return Promise.resolve(ready);
    this.loading ??= new Promise<TurnstileApi>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_URL;
      script.async = true;
      script.onload = () => {
        const api = (globalThis as { turnstile?: TurnstileApi }).turnstile;
        if (api) resolve(api);
        else reject(new TurnstileFailed('unavailable'));
      };
      script.onerror = () => {
        this.loading = null;
        script.remove();
        reject(new TurnstileFailed('unavailable'));
      };
      document.head.appendChild(script);
    });
    return this.loading;
  }
}
