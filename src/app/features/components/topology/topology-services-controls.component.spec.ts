import { TestBed } from '@angular/core/testing';
import { TopologyServicesControlsComponent } from './topology-services-controls.component';
import { DEFAULT_TOPOLOGY_STATE, TopologyViewState } from './topology-state';
import { TopologyGraph } from './topology-graph';
import { topologyFixture } from './topology.fixture';

describe('TopologyServicesControlsComponent', () => {
  const build = (graph: Partial<TopologyGraph>, state: Partial<TopologyViewState> = {}) => {
    const fixture = TestBed.createComponent(TopologyServicesControlsComponent);
    fixture.componentRef.setInput('snapshot', topologyFixture());
    fixture.componentRef.setInput('state', { ...DEFAULT_TOPOLOGY_STATE, ...state });
    fixture.componentRef.setInput('graph', { level: 'fleet', nodes: [], edges: [], collapsedFrom: null, ...graph });
    fixture.componentRef.setInput('fleetBy', 'apps');
    const changes: Partial<TopologyViewState>[] = [];
    fixture.componentInstance.changed.subscribe((c) => changes.push(c));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const click = (testId: string) => (el.querySelector(`[data-testid="${testId}"]`) as HTMLButtonElement).click();
    return { el, changes, click };
  };

  it('offers to narrow a fleet drawn in full to its problems and their neighbours', () => {
    const { el, changes, click } = build({ filterable: true });
    expect(el.textContent).not.toContain('Showing problems and their neighbours');
    click('topology-show-problems');
    expect(changes).toEqual([{ problems: true }]);
  });

  it('brings the whole fleet back from the narrowed view', () => {
    const { el, changes, click } = build({ filtered: true }, { problems: true });
    expect(el.textContent).toContain('Showing problems and their neighbours');
    expect(el.querySelector('[data-testid="topology-show-problems"]')).toBeNull();
    click('topology-show-all');
    expect(changes).toEqual([{ problems: false }]);
  });

  it('draws a crowded cluster in full when asked', () => {
    const { changes, click } = build({ level: 'cluster', filtered: true }, { level: 'cluster', cluster: 'c-eu' });
    click('topology-show-all');
    expect(changes).toEqual([{ all: true }]);
  });

  it('offers nothing when the map is drawn in full and small', () => {
    const { el } = build({});
    expect(el.querySelector('[data-testid="topology-show-problems"]')).toBeNull();
    expect(el.querySelector('[data-testid="topology-show-all"]')).toBeNull();
  });
});
