import { Injectable, signal } from '@angular/core';

/**
 * IP Detection Service
 *
 * Singleton service for detecting user's public IP address.
 * Uses api.ipify.org for IP detection with caching to avoid multiple calls.
 *
 * Usage:
 * - Inject service: `private ipService = inject(IpDetectionService)`
 * - Call `await ipService.detectPublicIP()` to get IP
 * - Access cached IP via `ipService.userPublicIP()` signal
 * - Check loading state via `ipService.isDetecting()` signal
 */
@Injectable({
  providedIn: 'root',
})
export class IpDetectionService {
  private readonly userIP = signal<string | null>(null);
  private readonly detecting = signal<boolean>(false);

  readonly userPublicIP = this.userIP.asReadonly();
  readonly isDetecting = this.detecting.asReadonly();

  /**
   * Detect user's public IP address using ipify.org API.
   * Results are cached - subsequent calls return cached value.
   *
   * @param forceRefresh - Force new detection even if cached value exists
   * @returns The detected IP address or null if detection failed
   */
  async detectPublicIP(forceRefresh = false): Promise<string | null> {
    // Return cached value if available and not forcing refresh
    if (this.userIP() && !forceRefresh) {
      return this.userIP();
    }

    this.detecting.set(true);

    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();

      if (data.ip) {
        this.userIP.set(data.ip);
        return data.ip;
      }
    } catch (error) {
      console.error('Failed to detect public IP:', error);
      // Silent failure - user can still enter IP manually
    } finally {
      this.detecting.set(false);
    }

    return null;
  }

  /**
   * Clear cached IP address.
   * Useful for testing or forcing fresh detection.
   */
  clearCache(): void {
    this.userIP.set(null);
  }
}
