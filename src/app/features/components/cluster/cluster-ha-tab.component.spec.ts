import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ClusterService } from '../../service/cluster.service';
import {
  ClusterHaService,
  ClusterHaView,
} from '../../service/cluster-ha.service';
import { ClusterHaTabComponent } from './cluster-ha-tab.component';

const threeLocations: ClusterHaView = {
  clusterId: 'c1',
  level: 'three-locations',
  region: 'eu-central',
  topology: {
    validated: true,
    zones: [
      { zone: 'fsn1', role: 'data', servers: ['master'], dataHosts: ['w2'] },
      { zone: 'nbg1', role: 'data', servers: ['w1'], dataHosts: ['w1'] },
      { zone: 'hel1', role: 'vote', servers: ['w3'], dataHosts: [] },
    ],
  },
  unsupported: null,
  servers: { count: 3, ready: 3, zones: ['fsn1', 'nbg1', 'hel1'] },
  survives: ['the loss of a whole location'],
  doesNotSurvive: ['the loss of two locations at once'],
  warnings: [],
  missing: [],
  observed: {
    at: new Date().toISOString(),
    etcdLeader: { node: 'w1', zone: 'nbg1' },
    roundTrips: [
      { from: 'fsn1', to: 'hel1', ms: 35.04 },
      { from: 'fsn1', to: 'nbg1', ms: 3.12 },
      { from: 'hel1', to: 'nbg1', ms: null },
    ],
    reachedThrough: 'master',
    reachableServers: ['master', 'w1', 'w3'],
  },
};

describe('ClusterHaTabComponent', () => {
  let fixture: ComponentFixture<ClusterHaTabComponent>;

  let addNode: jasmine.Spy;

  function render(get: () => unknown) {
    addNode = jasmine
      .createSpy('addNode')
      .and.returnValue(of({ operationId: 'op-1' }));
    TestBed.configureTestingModule({
      imports: [ClusterHaTabComponent],
      providers: [
        { provide: ClusterHaService, useValue: { get, addNode } },
        {
          provide: ClusterService,
          useValue: { cluster: signal({ id: 'c1' }) },
        },
      ],
    });
    fixture = TestBed.createComponent(ClusterHaTabComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows each location with its role, who leads, and where Flui connects', () => {
    const el = render(() => of(threeLocations));
    expect(el.textContent).toContain('Survives the loss of a whole location');
    const hel = el.querySelector('[data-testid="ha-zone-hel1"]')!;
    expect(hel.textContent).toContain('Vote only');
    const nbg = el.querySelector('[data-testid="ha-zone-nbg1"]')!;
    expect(nbg.textContent).toContain('leads');
    expect(nbg.textContent).toContain('Copies of data on w1');
    const fsn = el.querySelector('[data-testid="ha-zone-fsn1"]')!;
    expect(fsn.textContent).toContain('Flui');
  });

  it('gives the round trip between each pair of locations', () => {
    const el = render(() => of(threeLocations));
    const trips = el.querySelector('[data-testid="ha-round-trips"]')!;
    expect(trips.textContent).toContain('35.0 ms');
    expect(trips.textContent).toContain('3.1 ms');
    expect(trips.textContent).toContain('no answer');
    expect(trips.textContent).toContain('measured just now');
  });

  it('keeps what it survives behind a button, with where Flui moves to', () => {
    const el = render(() => of(threeLocations));
    expect(el.querySelector('[data-testid="ha-survives"]')).toBeNull();
    (el.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    const list = el.querySelector('[data-testid="ha-survives"]')!;
    expect(list.textContent).toContain('Survives the loss of a whole location');
    expect(list.textContent).toContain(
      'If master is lost, Flui moves to w1, w3.',
    );
  });

  it('names what a location still needs on a standard cluster', () => {
    const el = render(() =>
      of({
        ...threeLocations,
        level: 'standard',
        observed: undefined,
        missing: [
          { role: 'server', zone: 'hel1', why: 'One server in each location.' },
        ],
      }),
    );
    expect(el.textContent).toContain('Standard');
    expect(
      el.querySelector('[data-testid="ha-zone-hel1"]')!.textContent,
    ).toContain('Needs a server');
    expect(el.querySelector('[data-testid="ha-round-trips"]')).toBeNull();
  });

  it('adds a missing server only after it is confirmed, and says it is on its way', () => {
    const el = render(() =>
      of({
        ...threeLocations,
        level: 'standard',
        observed: undefined,
        missing: [
          { role: 'server', zone: 'hel1', why: 'One server in each location.' },
        ],
      }),
    );
    (
      el.querySelector(
        '[data-testid="ha-add-server-hel1"]',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(addNode).not.toHaveBeenCalled();
    fixture.componentInstance.add();
    fixture.detectChanges();
    expect(addNode).toHaveBeenCalledWith('c1', 'server', 'hel1');
    expect(
      el.querySelector('[data-testid="ha-add-notice"]')!.textContent,
    ).toContain('Adding a server in hel1');
  });

  it('says so when the cluster cannot be read', () => {
    const el = render(() => throwError(() => new Error('503')));
    expect(el.textContent).toContain('could not read');
  });
});
