import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';

export interface QueueScaling {
  stream: string;
  consumer: string;
  lagThreshold: number;
  min: number;
  max: number;
}

export interface AppMessaging {
  applicationId: string;
  connected: boolean;
  url: string | null;
  account: string | null;
  queueScaling: QueueScaling | null;
}

export interface QueueView {
  name: string;
  subjects: string[];
  maxAgeHours: number;
  maxDeliver: number;
  waiting: number;
  inFlight: number;
  redelivered: number;
  consumers: number;
  deadLetters: number | null;
}

/** An application's own account on the NATS its cluster shares. */
@Injectable({ providedIn: 'root' })
export class AppMessagingService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private url(appId: string): string {
    return `${this.appConfig.apiBaseUrl}/api/v1/applications/${encodeURIComponent(appId)}/messaging`;
  }

  get(appId: string): Observable<AppMessaging> {
    return this.http.get<AppMessaging>(this.url(appId));
  }

  connect(appId: string): Observable<AppMessaging> {
    return this.http.put<AppMessaging>(this.url(appId), {});
  }

  queues(appId: string): Observable<QueueView[]> {
    return this.http.get<QueueView[]>(`${this.url(appId)}/queues`);
  }

  createQueue(appId: string, q: { name: string; maxAgeHours: number; maxDeliver: number; deadLetter: boolean }): Observable<QueueView[]> {
    return this.http.post<QueueView[]>(`${this.url(appId)}/queues`, q);
  }

  deleteQueue(appId: string, name: string): Observable<QueueView[]> {
    return this.http.delete<QueueView[]>(`${this.url(appId)}/queues/${encodeURIComponent(name)}`);
  }

  scale(appId: string, scaling: QueueScaling): Observable<AppMessaging> {
    return this.http.put<AppMessaging>(`${this.url(appId)}/scaling`, scaling);
  }

  stopScaling(appId: string): Observable<AppMessaging> {
    return this.http.delete<AppMessaging>(`${this.url(appId)}/scaling`);
  }

  disconnect(appId: string): Observable<void> {
    return this.http.delete<void>(this.url(appId));
  }
}
