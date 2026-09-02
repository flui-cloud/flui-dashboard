import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { AppConfigService } from '../../core/services/app-config.service';
import { AgentCycleService } from './agent-cycle.service';

const API = 'http://api.test';

describe('the action-cycle client', () => {
  let service: AgentCycleService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: AppConfigService, useValue: { apiBaseUrl: API } },
      ],
    });
    service = TestBed.inject(AgentCycleService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the requests waiting on a person', () => {
    service.listProposals().subscribe();
    const req = http.expectOne(`${API}/api/v1/agent/proposals`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('reads one request', () => {
    service.proposal('p 1').subscribe();
    const req = http.expectOne(`${API}/api/v1/agent/proposals/p%201`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('answers a request with the decision in the body', () => {
    service.decide('p-1', 'always').subscribe();
    const req = http.expectOne(`${API}/api/v1/agent/proposals/p-1/decide`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ decision: 'always' });
    req.flush({ proposal: {}, concession: null });
  });

  it('reads what stands', () => {
    service.listConcessions().subscribe();
    const req = http.expectOne(`${API}/api/v1/agent/concessions`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('asks what is still running under a grant', () => {
    service.runningUnder('g-1').subscribe();
    const req = http.expectOne(`${API}/api/v1/agent/concessions/g-1/operations`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('revokes without asking anything to stop by default', () => {
    service.revoke('g-1', false).subscribe();
    const req = http.expectOne(`${API}/api/v1/agent/concessions/g-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ concession: {}, stopRequested: [], stillRunning: [] });
  });

  it('asks what is running to stop only when told to', () => {
    service.revoke('g-1', true).subscribe();
    const req = http.expectOne(`${API}/api/v1/agent/concessions/g-1?stop=true`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ concession: {}, stopRequested: ['o-1'], stillRunning: [] });
  });

  it('prices a request from the route the request itself named', () => {
    service.estimate('/infrastructure/clusters/c-1/capacity-plan').subscribe();
    const req = http.expectOne(`${API}/api/v1/infrastructure/clusters/c-1/capacity-plan`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('tolerates a price route that arrived without its leading slash', () => {
    service.estimate('infrastructure/clusters/c-1/capacity-plan').subscribe();
    const req = http.expectOne(`${API}/api/v1/infrastructure/clusters/c-1/capacity-plan`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });
});
