import { CHIP_W, placementStrip } from './topology-placement';
import { GraphLayout } from './topology-layout';
import { topologyFixture } from './topology.fixture';

const layout = (x: number): GraphLayout => ({
  width: 800,
  height: 300,
  nodes: new Map([['a-web', { x, y: 100 }]]),
  edges: new Map(),
  sizes: new Map(),
});

describe('the placement strip', () => {
  it('puts one chip per server the app runs on, under the map, each tied to the app', () => {
    const t = topologyFixture();
    const app = t.apps.find((a) => a.id === 'a-web')!;
    const strip = placementStrip(t, layout(300), 'a-web', { width: 196, height: 64 })!;
    expect(strip.chips.map((c) => [c.serverId, c.count])).toEqual(app.replicas.map((r) => [r.serverId, r.count]));
    expect(strip.chips.every((c) => c.y > 300)).toBeTrue();
    expect(strip.lines).toHaveSize(strip.chips.length + 2);
    expect(strip.lines[0]).toBe(`M398,164 V${strip.chips[0].y - 14}`);
    for (const chip of strip.chips) {
      expect(strip.lines).toContain(`M${chip.x + CHIP_W / 2},${chip.y - 14} V${chip.y}`);
    }
  });

  it('stays inside the map when the app sits on its edge', () => {
    const strip = placementStrip(topologyFixture(), layout(0), 'a-web', { width: 196, height: 64 })!;
    expect(strip.chips[0].x).toBe(0);
    const right = placementStrip(topologyFixture(), layout(780), 'a-web', { width: 196, height: 64 })!;
    expect(right.chips.at(-1)!.x + CHIP_W).toBeLessThanOrEqual(800);
  });

  it('leaves the lines out when another card sits between the app and the strip', () => {
    const below = [{ x: 320, y: 200, width: 196, height: 64 }];
    const beside = [{ x: 600, y: 200, width: 196, height: 64 }];
    expect(placementStrip(topologyFixture(), layout(300), 'a-web', { width: 196, height: 64 }, below)!.lines).toEqual([]);
    expect(placementStrip(topologyFixture(), layout(300), 'a-web', { width: 196, height: 64 }, beside)!.lines.length).toBeGreaterThan(0);
  });

  it('draws nothing for an app with no replica or no place on the map', () => {
    expect(placementStrip(topologyFixture(), layout(0), 'gone', { width: 196, height: 64 })).toBeNull();
  });
});
