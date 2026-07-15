import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BASE_PATH } from '../../core/api/variables';
import {
  AddGatewayRouteRequest,
  GatewayRoute,
  SetGatewayPolicyRequest,
} from '../model/gateway-route.models';

/**
 * Gateway routes + L7 policies for an application. Uses raw HttpClient
 * because these endpoints are not yet in the generated OpenAPI client.
 */
@Injectable({ providedIn: 'root' })
export class ApplicationGatewayService {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(BASE_PATH, { optional: true }) ?? '';

  private readonly routesData = signal<GatewayRoute[]>([]);
  private readonly loadingData = signal<boolean>(false);
  private readonly savingData = signal<boolean>(false);
  private readonly errorData = signal<string | null>(null);

  readonly routes = this.routesData.asReadonly();
  readonly loading = this.loadingData.asReadonly();
  readonly saving = this.savingData.asReadonly();
  readonly error = this.errorData.asReadonly();

  private base(appId: string): string {
    return `${this.basePath}/api/v1/applications/${encodeURIComponent(appId)}/gateway`;
  }

  async loadForApp(appId: string): Promise<void> {
    this.loadingData.set(true);
    this.errorData.set(null);
    try {
      const data = await firstValueFrom(
        this.http.get<GatewayRoute[]>(`${this.base(appId)}/routes`),
      );
      this.routesData.set(data ?? []);
    } catch (error: any) {
      console.error('Error loading gateway routes:', error);
      this.errorData.set(this.message(error, 'Failed to load gateway routes'));
    } finally {
      this.loadingData.set(false);
    }
  }

  async addRoute(
    appId: string,
    body: AddGatewayRouteRequest,
  ): Promise<GatewayRoute | null> {
    this.savingData.set(true);
    this.errorData.set(null);
    try {
      const created = await firstValueFrom(
        this.http.post<GatewayRoute>(`${this.base(appId)}/routes`, body),
      );
      if (created) {
        this.routesData.update((list) => [...list, created]);
      }
      return created;
    } catch (error: any) {
      console.error('Error adding gateway route:', error);
      this.errorData.set(this.message(error, 'Failed to add route'));
      return null;
    } finally {
      this.savingData.set(false);
    }
  }

  async setPolicy(
    appId: string,
    endpointId: string,
    body: SetGatewayPolicyRequest,
  ): Promise<GatewayRoute | null> {
    this.savingData.set(true);
    this.errorData.set(null);
    try {
      const updated = await firstValueFrom(
        this.http.patch<GatewayRoute>(
          `${this.base(appId)}/routes/${encodeURIComponent(endpointId)}`,
          body,
        ),
      );
      if (updated) {
        this.routesData.update((list) =>
          list.map((r) => (r.endpointId === endpointId ? updated : r)),
        );
      }
      return updated;
    } catch (error: any) {
      console.error('Error updating gateway policy:', error);
      this.errorData.set(this.message(error, 'Failed to update policies'));
      return null;
    } finally {
      this.savingData.set(false);
    }
  }

  async removeRoute(appId: string, endpointId: string): Promise<boolean> {
    this.errorData.set(null);
    try {
      await firstValueFrom(
        this.http.delete<void>(
          `${this.base(appId)}/routes/${encodeURIComponent(endpointId)}`,
        ),
      );
      this.routesData.update((list) =>
        list.filter((r) => r.endpointId !== endpointId),
      );
      return true;
    } catch (error: any) {
      console.error('Error removing gateway route:', error);
      this.errorData.set(this.message(error, 'Failed to remove route'));
      return false;
    }
  }

  async reconcile(
    appId: string,
    endpointId: string,
  ): Promise<GatewayRoute | null> {
    this.errorData.set(null);
    try {
      const updated = await firstValueFrom(
        this.http.post<GatewayRoute>(
          `${this.base(appId)}/routes/${encodeURIComponent(endpointId)}/reconcile`,
          {},
        ),
      );
      if (updated) {
        this.routesData.update((list) =>
          list.map((r) => (r.endpointId === endpointId ? updated : r)),
        );
      }
      return updated;
    } catch (error: any) {
      console.error('Error reconciling gateway route:', error);
      this.errorData.set(this.message(error, 'Failed to reconcile route'));
      return null;
    }
  }

  reset(): void {
    this.routesData.set([]);
    this.errorData.set(null);
  }

  private message(error: any, fallback: string): string {
    return error?.error?.message || error?.message || fallback;
  }
}
