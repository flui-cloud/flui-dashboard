import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';
import {
  MailDeliveryEvent,
  MailDomainProofs,
  MailEventKind,
  MailOverview,
  MailPublishResult,
  MailRemoveResult,
  MailReadiness,
  MailSuppression,
  MailTestDraft,
  MailTestResult,
  MailWindow,
  ConnectProviderInput,
  MailConnectResult,
  MailConnection,
  MailConnectionSetup,
} from '../model/mail-console.models';

export interface MailEventFilter {
  since?: string;
  until?: string;
  kinds?: MailEventKind[];
  sender?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

@Injectable({ providedIn: 'root' })
export class MailConsoleService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private get base(): string {
    return `${this.appConfig.apiBaseUrl}/api/v1/mail`;
  }

  overview(window: MailWindow): Observable<MailOverview> {
    return this.http.get<MailOverview>(`${this.base}/overview`, {
      params: new HttpParams().set('window', window),
    });
  }

  domains(): Observable<MailDomainProofs[]> {
    return this.http.get<MailDomainProofs[]>(`${this.base}/domains`);
  }

  readiness(domain?: string): Observable<MailReadiness> {
    const params = domain ? new HttpParams().set('domain', domain) : undefined;
    return this.http.get<MailReadiness>(`${this.base}/readiness`, { params });
  }

  events(filter: MailEventFilter = {}): Observable<MailDeliveryEvent[]> {
    let params = new HttpParams();
    if (filter.since) params = params.set('since', filter.since);
    if (filter.until) params = params.set('until', filter.until);
    if (filter.kinds?.length) params = params.set('kind', filter.kinds.join(','));
    if (filter.sender) params = params.set('sender', filter.sender);
    if (filter.search) params = params.set('q', filter.search);
    if (filter.limit !== undefined) params = params.set('limit', filter.limit);
    if (filter.offset !== undefined) params = params.set('offset', filter.offset);
    return this.http.get<MailDeliveryEvent[]>(`${this.base}/events`, { params });
  }

  publishDomain(domain: string): Observable<MailPublishResult> {
    return this.http.post<MailPublishResult>(
      `${this.base}/domains/${encodeURIComponent(domain)}/publish`,
      {},
    );
  }

  removeDomain(domain: string): Observable<MailRemoveResult> {
    return this.http.delete<MailRemoveResult>(
      `${this.base}/domains/${encodeURIComponent(domain)}`,
    );
  }

  testDraft(domain: string): Observable<MailTestDraft> {
    return this.http.get<MailTestDraft>(
      `${this.base}/domains/${encodeURIComponent(domain)}/test`,
    );
  }

  test(
    domain: string,
    body: { kind?: 'delivery' | 'bounce'; to?: string; subject?: string; text?: string } = {},
  ): Observable<MailTestResult> {
    return this.http.post<MailTestResult>(
      `${this.base}/domains/${encodeURIComponent(domain)}/test`,
      body,
    );
  }

  connectionSetup(id: string): Observable<MailConnectionSetup> {
    return this.http.get<MailConnectionSetup>(
      `${this.base}/connections/${encodeURIComponent(id)}/setup`,
    );
  }

  publishForConnection(id: string, domain?: string): Observable<MailPublishResult> {
    return this.http.post<MailPublishResult>(
      `${this.base}/connections/${encodeURIComponent(id)}/publish`,
      domain ? { domain } : {},
    );
  }

  connectionTestDraft(id: string): Observable<MailTestDraft & { domain: string }> {
    return this.http.get<MailTestDraft & { domain: string }>(
      `${this.base}/connections/${encodeURIComponent(id)}/test`,
    );
  }

  connectionTest(
    id: string,
    body: { kind?: 'delivery' | 'bounce'; to?: string; subject?: string; text?: string } = {},
  ): Observable<MailTestResult> {
    return this.http.post<MailTestResult>(
      `${this.base}/connections/${encodeURIComponent(id)}/test`,
      body,
    );
  }

  suppressions(): Observable<MailSuppression[]> {
    return this.http.get<MailSuppression[]>(`${this.base}/suppressions`);
  }

  unsuppress(address: string): Observable<void> {
    return this.http.delete<void>(
      `${this.base}/suppressions/${encodeURIComponent(address)}`,
    );
  }

  connections(): Observable<MailConnection[]> {
    return this.http.get<MailConnection[]>(`${this.base}/connections`);
  }

  connect(input: ConnectProviderInput): Observable<MailConnectResult> {
    return this.http.post<MailConnectResult>(`${this.base}/connections`, input);
  }

  activate(id: string): Observable<MailConnection> {
    return this.http.post<MailConnection>(
      `${this.base}/connections/${encodeURIComponent(id)}/activate`,
      {},
    );
  }

  retryWebhook(id: string): Observable<{ registered: boolean; url?: string; reason?: string }> {
    return this.http.post<{ registered: boolean; url?: string; reason?: string }>(
      `${this.base}/connections/${encodeURIComponent(id)}/webhook`,
      {},
    );
  }

  disconnect(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/connections/${encodeURIComponent(id)}`);
  }
}
