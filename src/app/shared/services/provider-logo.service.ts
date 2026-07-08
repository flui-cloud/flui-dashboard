import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { AppConfigService } from '../../core/services/app-config.service';

@Injectable({ providedIn: 'root' })
export class ProviderLogoService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);
  private readonly cache = new Map<string, Observable<string | null>>();

  resolve(logoUrl: string | null | undefined): Observable<string | null> {
    if (!logoUrl) {
      return of(null);
    }
    if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
      return of(logoUrl);
    }
    const url = `${this.appConfig.apiBaseUrl}${logoUrl}`;
    let stream = this.cache.get(url);
    if (!stream) {
      stream = this.http.get(url, { responseType: 'blob' }).pipe(
        map((blob) => URL.createObjectURL(blob)),
        catchError(() => of(null)),
        shareReplay(1),
      );
      this.cache.set(url, stream);
    }
    return stream;
  }

  resolveUrl(logoUrl: string | null | undefined): Promise<string | null> {
    return firstValueFrom(this.resolve(logoUrl));
  }
}
