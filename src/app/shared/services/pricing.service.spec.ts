import { TestBed } from '@angular/core/testing';
import { PricingService } from './pricing.service';

describe('PricingService', () => {
  let service: PricingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PricingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('calculateMonthlyPrice', () => {
    it('should calculate monthly price using 730 hours per month', () => {
      const hourlyPrice = 0.05;
      const monthlyPrice = service.calculateMonthlyPrice(hourlyPrice);
      expect(monthlyPrice).toBe(36.5); // 0.05 * 730 = 36.5
    });

    it('should handle zero price', () => {
      expect(service.calculateMonthlyPrice(0)).toBe(0);
    });

    it('should handle large prices', () => {
      const hourlyPrice = 1.5;
      const monthlyPrice = service.calculateMonthlyPrice(hourlyPrice);
      expect(monthlyPrice).toBe(1095); // 1.5 * 730 = 1095
    });
  });

  describe('formatMonthlyPrice', () => {
    it('should format monthly price with 2 decimals', () => {
      const hourlyPrice = 0.05;
      const formatted = service.formatMonthlyPrice(hourlyPrice);
      expect(formatted).toBe('36.50');
    });

    it('should format price with proper rounding', () => {
      const hourlyPrice = 0.0567;
      const formatted = service.formatMonthlyPrice(hourlyPrice);
      expect(formatted).toBe('41.39'); // 0.0567 * 730 = 41.391
    });
  });

  describe('calculateMonthlyPriceRounded', () => {
    it('should round monthly price to nearest integer', () => {
      const hourlyPrice = 0.05;
      const rounded = service.calculateMonthlyPriceRounded(hourlyPrice);
      expect(rounded).toBe(37); // 36.5 rounds to 37
    });

    it('should round down when below .5', () => {
      const hourlyPrice = 0.04;
      const rounded = service.calculateMonthlyPriceRounded(hourlyPrice);
      expect(rounded).toBe(29); // 29.2 rounds to 29
    });
  });

  describe('calculateClusterMonthlyCost', () => {
    it('should calculate cost for multiple nodes', () => {
      const hourlyPrice = 0.05;
      const nodeCount = 3;
      const totalCost = service.calculateClusterMonthlyCost(hourlyPrice, nodeCount);
      expect(totalCost).toBe(109.5); // 36.5 * 3 = 109.5
    });

    it('should handle single node', () => {
      const hourlyPrice = 0.1;
      const totalCost = service.calculateClusterMonthlyCost(hourlyPrice, 1);
      expect(totalCost).toBe(73); // 0.1 * 730 = 73
    });
  });

  describe('formatClusterMonthlyCost', () => {
    it('should format cluster cost with 2 decimals', () => {
      const hourlyPrice = 0.05;
      const nodeCount = 3;
      const formatted = service.formatClusterMonthlyCost(hourlyPrice, nodeCount);
      expect(formatted).toBe('109.50'); // 36.5 * 3 = 109.50
    });

    it('should format with proper rounding', () => {
      const hourlyPrice = 0.0567;
      const nodeCount = 2;
      const formatted = service.formatClusterMonthlyCost(hourlyPrice, nodeCount);
      expect(formatted).toBe('82.78'); // 41.391 * 2 = 82.782
    });
  });

  describe('calculateClusterMonthlyCostRounded', () => {
    it('should round cluster cost to nearest integer', () => {
      const hourlyPrice = 0.05;
      const nodeCount = 3;
      const rounded = service.calculateClusterMonthlyCostRounded(hourlyPrice, nodeCount);
      expect(rounded).toBe(110); // 109.5 rounds to 110
    });
  });

  describe('calculateCostForDuration', () => {
    it('should calculate cost for 60 minutes (1 hour)', () => {
      const hourlyPrice = 0.1;
      const durationMinutes = 60;
      const cost = service.calculateCostForDuration(hourlyPrice, durationMinutes);
      expect(cost).toBe(0.1); // 0.1 * (60/60) = 0.1
    });

    it('should calculate cost for 120 minutes (2 hours)', () => {
      const hourlyPrice = 0.05;
      const durationMinutes = 120;
      const cost = service.calculateCostForDuration(hourlyPrice, durationMinutes);
      expect(cost).toBe(0.1); // 0.05 * (120/60) = 0.1
    });

    it('should calculate cost for 30 minutes', () => {
      const hourlyPrice = 0.1;
      const durationMinutes = 30;
      const cost = service.calculateCostForDuration(hourlyPrice, durationMinutes);
      expect(cost).toBe(0.05); // 0.1 * (30/60) = 0.05
    });

    it('should handle zero duration', () => {
      const cost = service.calculateCostForDuration(0.1, 0);
      expect(cost).toBe(0);
    });
  });

  describe('getHoursPerMonth', () => {
    it('should return 730 hours per month', () => {
      expect(service.getHoursPerMonth()).toBe(730);
    });
  });

  describe('consistency across components', () => {
    it('should ensure same price calculation for provider-region-selector and wizards', () => {
      const hourlyPrice = 0.0456;

      // What provider-region-selector displays
      const monthlyFormatted = service.formatMonthlyPrice(hourlyPrice);

      // What cluster wizard calculates (formatted)
      const clusterCostFormatted = service.formatClusterMonthlyCost(hourlyPrice, 1);

      // Both should be based on same base calculation
      const baseMonthly = service.calculateMonthlyPrice(hourlyPrice);
      expect(baseMonthly).toBeCloseTo(33.288, 2); // 0.0456 * 730, allow floating point precision
      expect(monthlyFormatted).toBe('33.29');
      expect(clusterCostFormatted).toBe('33.29'); // Now shows decimals too
    });

    it('should match build agent always-on pricing', () => {
      const hourlyPrice = 0.075;

      // Always-on mode uses formatMonthlyPrice
      const formatted = service.formatMonthlyPrice(hourlyPrice);
      expect(formatted).toBe('54.75');

      // Verify it matches base calculation
      const baseMonthly = service.calculateMonthlyPrice(hourlyPrice);
      expect(baseMonthly).toBe(54.75);
    });
  });
});
