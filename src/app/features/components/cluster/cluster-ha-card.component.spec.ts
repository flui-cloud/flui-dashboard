import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import {
  ClusterHaService,
  ClusterHaView,
} from '../../service/cluster-ha.service';
import { ClusterHaCardComponent } from './cluster-ha-card.component';

const standard: ClusterHaView = {
  clusterId: 'c1',
  level: 'standard',
  region: 'eu-central',
  topology: {
    validated: true,
    zones: [
      { zone: 'fsn1', role: 'data', servers: ['m'], dataHosts: ['w2'] },
      { zone: 'nbg1', role: 'data', servers: [], dataHosts: [] },
      { zone: 'hel1', role: 'vote', servers: [], dataHosts: [] },
    ],
  },
  unsupported: null,
  servers: { count: 1, ready: 1, zones: ['fsn1'] },
  survives: ['the loss of a worker, for applications with two or more copies'],
  doesNotSurvive: [
    'the loss of the master: nothing can change until it returns',
  ],
  warnings: [],
  missing: [
    {
      role: 'server',
      zone: 'nbg1',
      why: 'One server in each of the three locations.',
    },
    {
      role: 'server',
      zone: 'hel1',
      why: 'One server in each of the three locations.',
    },
  ],
};

describe('ClusterHaCardComponent', () => {
  let fixture: ComponentFixture<ClusterHaCardComponent>;

  function render(view: ClusterHaView) {
    TestBed.configureTestingModule({
      imports: [ClusterHaCardComponent],
      providers: [
        provideRouter([]),
        { provide: ClusterHaService, useValue: { get: () => of(view) } },
      ],
    });
    fixture = TestBed.createComponent(ClusterHaCardComponent);
    fixture.componentRef.setInput('clusterId', 'c1');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('says in one line what is still missing, and keeps the rest behind a button', () => {
    const el = render(standard);
    expect(el.textContent).toContain('Standard');
    expect(el.textContent).toContain(
      'it still needs a server in nbg1, a server in hel1.',
    );
    expect(
      el.querySelector('[data-testid="cluster-ha-zones"]')!.textContent,
    ).toContain('hel1: vote');
    expect(el.querySelector('[data-testid="cluster-ha-details"]')).toBeNull();
    (el.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    const details = el.querySelector(
      '[data-testid="cluster-ha-details"]',
    )!.textContent!;
    expect(details).toContain('Survives the loss of a worker');
    expect(details).toContain('Does not survive the loss of the master');
  });

  it('says it survives a location once nothing is missing', () => {
    const el = render({ ...standard, level: 'three-locations', missing: [] });
    expect(el.textContent).toContain('Survives a location');
    expect(el.textContent).toContain('Survives the loss of a whole location.');
  });

  it('gives the reason when the region has no validated layout', () => {
    const el = render({
      ...standard,
      topology: null,
      unsupported:
        'Flui has not validated a highly available layout for us-east yet.',
      missing: [],
    });
    expect(el.textContent).toContain('us-east');
  });
});
