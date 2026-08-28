import {
  PlotBox,
  areaPath,
  fleetDomain,
  linePath,
  niceStep,
  nodeScale,
  outcomeBadgeClass,
  round1,
  shapesInOrder,
  spendScale,
  stackTotal,
  stepPoints,
  tickAnchor,
  tickIndexes,
  xAt,
  yAt,
} from './fleet-history.geometry';

const PLOT: PlotBox = { left: 40, right: 740, top: 0, bottom: 200 };

describe('fleet-history geometry', () => {
  describe('round1', () => {
    it('keeps one decimal', () => {
      expect(round1(12.34)).toBe(12.3);
      expect(round1(12.35)).toBe(12.4);
    });
  });

  describe('niceStep', () => {
    it('rounds up to 1, 2, 5 or 10 times a power of ten', () => {
      expect(niceStep(1)).toBe(1);
      expect(niceStep(1.5)).toBe(2);
      expect(niceStep(3)).toBe(5);
      expect(niceStep(7)).toBe(10);
      expect(niceStep(23)).toBe(50);
    });

    it('does not divide by zero on an empty range', () => {
      expect(niceStep(0)).toBe(1);
    });
  });

  describe('fleetDomain', () => {
    it('spans the points and every decision outside them', () => {
      expect(fleetDomain([100, 200], [50, 300])).toEqual({
        start: 50,
        end: 300,
      });
    });

    it('never returns a zero-width domain', () => {
      expect(fleetDomain([100], [])).toEqual({ start: 100, end: 101 });
      expect(fleetDomain([], [])).toEqual({ start: 0, end: 1 });
    });
  });

  describe('shapesInOrder', () => {
    it('keeps first appearance and does not repeat', () => {
      expect(
        shapesInOrder([{ cx22: 1 }, { cx32: 2, cx22: 1 }, { cx22: 3 }]),
      ).toEqual(['cx22', 'cx32']);
    });

    it('is empty for no points', () => {
      expect(shapesInOrder([])).toEqual([]);
    });
  });

  describe('stackTotal', () => {
    it('sums every shape in a reading', () => {
      expect(stackTotal({ cx22: 2, cx32: 3 })).toBe(5);
      expect(stackTotal({})).toBe(0);
    });
  });

  describe('nodeScale', () => {
    it('leaves one node of headroom above the peak', () => {
      const scale = nodeScale([1, 3, 2]);
      expect(scale.yMax).toBe(4);
      expect(scale.ticks.map((t) => t.label)).toEqual(['0', '1', '2', '3', '4']);
    });

    it('still draws an axis for an empty fleet', () => {
      expect(nodeScale([]).yMax).toBe(2);
    });
  });

  describe('spendScale', () => {
    it('reaches above the cap when the cap is the highest figure', () => {
      const scale = spendScale([40, 60], 200);
      expect(scale.yMax).toBeGreaterThanOrEqual(200);
    });

    it('labels ticks in euro', () => {
      expect(spendScale([100], null).ticks[0].label).toBe('€0');
    });

    it('treats a null cap as no cap rather than as zero', () => {
      expect(spendScale([100], null).yMax).toBe(spendScale([100], 0).yMax);
    });
  });

  describe('xAt', () => {
    it('places the domain bounds on the plot bounds', () => {
      const domain = { start: 0, end: 100 };
      expect(xAt(0, domain, PLOT)).toBe(40);
      expect(xAt(100, domain, PLOT)).toBe(740);
      expect(xAt(50, domain, PLOT)).toBe(390);
    });

    it('clamps a stamp outside the domain', () => {
      const domain = { start: 0, end: 100 };
      expect(xAt(-50, domain, PLOT)).toBe(40);
      expect(xAt(500, domain, PLOT)).toBe(740);
    });
  });

  describe('yAt', () => {
    it('puts zero on the baseline and the maximum on the top', () => {
      expect(yAt(0, 10, PLOT)).toBe(200);
      expect(yAt(10, 10, PLOT)).toBe(0);
      expect(yAt(5, 10, PLOT)).toBe(100);
    });

    it('does not divide by zero when nothing has been measured', () => {
      expect(yAt(0, 0, PLOT)).toBe(200);
    });
  });

  describe('stepPoints', () => {
    it('holds each value until the next reading and runs to the right edge', () => {
      expect(stepPoints([2, 4], [40, 300], 10, PLOT)).toEqual([
        '40,160',
        '300,160',
        '300,120',
        '740,120',
      ]);
    });
  });

  describe('linePath', () => {
    it('starts with a move and continues with lines', () => {
      const path = linePath([2, 4], [40, 300], 10, PLOT);
      expect(path.startsWith('M40,160 L')).toBe(true);
      expect(path).not.toContain('Z');
    });
  });

  describe('areaPath', () => {
    it('closes the shape back along the lower edge', () => {
      const path = areaPath([4], [0], [40], 10, PLOT);
      expect(path.startsWith('M')).toBe(true);
      expect(path.endsWith('Z')).toBe(true);
    });
  });

  describe('tickIndexes', () => {
    it('picks four spread readings', () => {
      expect(tickIndexes(10)).toEqual([0, 3, 6, 9]);
    });

    it('does not repeat an index on a short series', () => {
      expect(tickIndexes(2)).toEqual([0, 1]);
      expect(tickIndexes(1)).toEqual([0]);
    });
  });

  describe('tickAnchor', () => {
    it('pulls the first and last labels inside the plot', () => {
      expect(tickAnchor(0, 0, 4)).toBe('start');
      expect(tickAnchor(9, 3, 4)).toBe('end');
      expect(tickAnchor(3, 1, 4)).toBe('middle');
    });
  });

  describe('outcomeBadgeClass', () => {
    it('reads a purchase and a replacement as the same success', () => {
      expect(outcomeBadgeClass('added')).toBe(outcomeBadgeClass('replaced'));
    });

    it('separates an alert from an action', () => {
      expect(outcomeBadgeClass('alerted')).not.toBe(outcomeBadgeClass('added'));
    });

    it('has an answer for an outcome it does not know', () => {
      expect(
        outcomeBadgeClass('held' as Parameters<typeof outcomeBadgeClass>[0]),
      ).toContain('badge');
    });
  });
});
