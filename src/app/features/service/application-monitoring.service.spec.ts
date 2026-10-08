import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApplicationMonitoringService } from './application-monitoring.service';
import { ApplicationMetricsService } from '../../core/api/api/applicationMetrics.service';

describe('ApplicationMonitoringService polling', () => {
  let fetch: jasmine.Spy;
  let service: ApplicationMonitoringService;

  beforeEach(() => {
    jasmine.clock().install();
    fetch = jasmine
      .createSpy('applicationMetricsControllerGetAppMetrics')
      .and.returnValue(of({ metrics: {} }));
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ApplicationMetricsService,
          useValue: { applicationMetricsControllerGetAppMetrics: fetch },
        },
      ],
    });
    service = TestBed.inject(ApplicationMonitoringService);
  });

  afterEach(() => {
    service.stopPolling();
    jasmine.clock().uninstall();
  });

  it('keeps asking while the page is in view', () => {
    spyOnProperty(document, 'hidden').and.returnValue(false);

    service.startPolling('a1');
    jasmine.clock().tick(10_000);

    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('stops asking while the tab is hidden', () => {
    spyOnProperty(document, 'hidden').and.returnValue(true);

    service.startPolling('a1');
    jasmine.clock().tick(10_000);

    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
