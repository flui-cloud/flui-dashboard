import { Injectable } from '@angular/core';

/**
 * Pricing Service
 *
 * Centralized service for all pricing calculations to ensure consistency
 * across the application.
 *
 * Used by:
 * - Provider Region Selector
 * - Cluster Creation Wizard
 * - Build Agent Wizard
 * - Provider Card Component
 */
@Injectable({
  providedIn: 'root',
})
export class PricingService {
  /**
   * Standard hours per month for price estimation
   * Using 730 hours = average month (365 days / 12 months * 24 hours)
   */
  private readonly HOURS_PER_MONTH = 730;

  /**
   * Calculate estimated monthly price from hourly rate
   *
   * @param pricePerHour - Hourly price in currency units
   * @returns Estimated monthly price
   *
   * @example
   * ```typescript
   * const monthlyPrice = pricingService.calculateMonthlyPrice(0.05); // 36.50
   * ```
   */
  calculateMonthlyPrice(pricePerHour: number): number {
    return pricePerHour * this.HOURS_PER_MONTH;
  }

  /**
   * Calculate estimated monthly price and format as string with 2 decimals
   *
   * @param pricePerHour - Hourly price in currency units
   * @returns Formatted monthly price (e.g., "36.50")
   *
   * @example
   * ```typescript
   * const formatted = pricingService.formatMonthlyPrice(0.05); // "36.50"
   * ```
   */
  formatMonthlyPrice(pricePerHour: number): string {
    return this.calculateMonthlyPrice(pricePerHour).toFixed(2);
  }

  /**
   * Calculate estimated monthly price rounded to nearest integer
   *
   * @param pricePerHour - Hourly price in currency units
   * @returns Rounded monthly price
   *
   * @example
   * ```typescript
   * const rounded = pricingService.calculateMonthlyPriceRounded(0.05); // 37
   * ```
   */
  calculateMonthlyPriceRounded(pricePerHour: number): number {
    return Math.round(this.calculateMonthlyPrice(pricePerHour));
  }

  /**
   * Calculate estimated monthly cost for multiple nodes/servers
   *
   * @param pricePerHour - Hourly price per node
   * @param nodeCount - Number of nodes
   * @returns Total estimated monthly cost
   *
   * @example
   * ```typescript
   * const totalCost = pricingService.calculateClusterMonthlyCost(0.05, 3); // 109.50
   * ```
   */
  calculateClusterMonthlyCost(pricePerHour: number, nodeCount: number): number {
    return this.calculateMonthlyPrice(pricePerHour) * nodeCount;
  }

  /**
   * Calculate estimated monthly cost for multiple nodes/servers and format with 2 decimals
   *
   * @param pricePerHour - Hourly price per node
   * @param nodeCount - Number of nodes
   * @returns Formatted total estimated monthly cost (e.g., "109.50")
   *
   * @example
   * ```typescript
   * const formatted = pricingService.formatClusterMonthlyCost(0.05, 3); // "109.50"
   * ```
   */
  formatClusterMonthlyCost(pricePerHour: number, nodeCount: number): string {
    return this.calculateClusterMonthlyCost(pricePerHour, nodeCount).toFixed(2);
  }

  /**
   * Calculate estimated monthly cost for multiple nodes/servers, rounded
   *
   * @param pricePerHour - Hourly price per node
   * @param nodeCount - Number of nodes
   * @returns Rounded total estimated monthly cost
   *
   * @example
   * ```typescript
   * const totalCost = pricingService.calculateClusterMonthlyCostRounded(0.05, 3); // 110
   * ```
   */
  calculateClusterMonthlyCostRounded(pricePerHour: number, nodeCount: number): number {
    return Math.round(this.calculateClusterMonthlyCost(pricePerHour, nodeCount));
  }

  /**
   * Calculate cost for a specific duration in minutes
   * Useful for on-demand/temporary resources
   *
   * @param pricePerHour - Hourly price
   * @param durationMinutes - Duration in minutes
   * @returns Cost for the specified duration
   *
   * @example
   * ```typescript
   * const cost = pricingService.calculateCostForDuration(0.05, 120); // 0.10 (2 hours)
   * ```
   */
  calculateCostForDuration(pricePerHour: number, durationMinutes: number): number {
    return pricePerHour * (durationMinutes / 60);
  }

  /**
   * Get the hours per month constant used for calculations
   * Useful for displaying in UI explanations
   *
   * @returns Hours per month (730)
   */
  getHoursPerMonth(): number {
    return this.HOURS_PER_MONTH;
  }
}
