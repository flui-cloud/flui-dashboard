import { TestBed } from '@angular/core/testing';
import { TopologyInfrastructureComponent } from './topology-infrastructure.component';
import { topologyFixture } from './topology.fixture';
import { TopologyResponseDto } from '../../../core/api/model/topologyResponseDto';

function fleetOf(servers: number): TopologyResponseDto {
  const t = topologyFixture();
  const base = t.servers[0];
  t.servers = Array.from({ length: servers }, (_, i) => ({
    ...base,
    id: `s-${i}`,
    clusterId: i % 2 ? 'c-eu' : 'c-asia',
    nodeName: `node-${i}`,
    capacity: { ...base.capacity!, usedMemPct: 30 + (i % 65) },
  }));
  return t;
}

describe('TopologyInfrastructureComponent', () => {
  function render(snapshot: TopologyResponseDto) {
    const fixture = TestBed.createComponent(TopologyInfrastructureComponent);
    fixture.componentRef.setInput('snapshot', snapshot);
    fixture.detectChanges();
    return fixture;
  }

  it('draws 60 servers as focusable tiles quickly', () => {
    const started = performance.now();
    const fixture = render(fleetOf(60));
    const elapsed = performance.now() - started;
    const tiles = fixture.nativeElement.querySelectorAll('button[data-columns]');
    expect(tiles).toHaveSize(60);
    expect(elapsed).toBeLessThan(500);
  });

  it('names each tile for a screen reader, with its status and value', () => {
    const fixture = render(topologyFixture());
    const first = fixture.nativeElement.querySelector('button[data-columns]') as HTMLElement;
    expect(first.getAttribute('aria-label')).toBe('eu-worker-1, healthy, 92% memory');
  });

  it('moves focus between tiles with the arrow keys', () => {
    const fixture = render(fleetOf(8));
    const tiles = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('section')[0]
        .querySelectorAll<HTMLElement>('button[data-columns]'),
    );
    tiles[0].focus();
    tiles[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(tiles[1]);
    const columns = Number(tiles[0].getAttribute('data-columns'));
    tiles[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(tiles[1 + columns] ?? tiles[1]);
  });

  it('selects a server on click', () => {
    const fixture = render(topologyFixture());
    const picked: unknown[] = [];
    fixture.componentInstance.selected.subscribe((f) => picked.push(f));
    (fixture.nativeElement.querySelector('button[data-columns]') as HTMLElement).click();
    expect(picked).toEqual([{ type: 'server', id: 's-1' }]);
  });

  it('shows the connections between clusters only in network mode', () => {
    const fixture = render(topologyFixture());
    expect(fixture.nativeElement.querySelector('app-topology-network-strip')).toBeNull();
    fixture.componentRef.setInput('colorBy', 'network');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-topology-network-strip')).not.toBeNull();
  });
});
