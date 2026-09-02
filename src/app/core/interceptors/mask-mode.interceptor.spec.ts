import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { MaskModeService } from '../services/mask-mode.service';
import { maskModeInterceptor } from './mask-mode.interceptor';

describe('maskModeInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let mask: MaskModeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([maskModeInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    mask = TestBed.inject(MaskModeService);
  });

  afterEach(() => {
    httpMock.verify();
    try {
      localStorage.removeItem('flui-mask-mode');
    } catch {
      /* noop */
    }
  });

  it('sends no mask-mode header while the toggle is off', () => {
    http.get('/api/v1/whatever').subscribe();
    const req = httpMock.expectOne('/api/v1/whatever');
    expect(req.request.headers.has('x-mask-mode')).toBe(false);
    req.flush({});
  });

  it('stamps x-mask-mode: on while the toggle is on', () => {
    mask.setEnabled(true);

    http.get('/api/v1/whatever').subscribe();
    const req = httpMock.expectOne('/api/v1/whatever');
    expect(req.request.headers.get('x-mask-mode')).toBe('on');
    req.flush({});
  });

  it('stops stamping the header the moment the toggle turns back off', () => {
    mask.setEnabled(true);
    http.get('/api/v1/first').subscribe();
    httpMock.expectOne('/api/v1/first').flush({});

    mask.setEnabled(false);
    http.get('/api/v1/second').subscribe();
    const req = httpMock.expectOne('/api/v1/second');
    expect(req.request.headers.has('x-mask-mode')).toBe(false);
    req.flush({});
  });
});
