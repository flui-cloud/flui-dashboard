import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { SandboxClaimComponent } from './sandbox-claim.component';
import { SandboxService } from '../../../core/services/sandbox.service';

describe('the sandbox door', () => {
  const build = (queryParams: Record<string, string>) => {
    const claim = jasmine.createSpy('claim').and.returnValue(of({}));
    const navigate = jasmine.createSpy('navigate').and.resolveTo(true);

    TestBed.configureTestingModule({
      providers: [
        { provide: SandboxService, useValue: { claim } },
        { provide: Router, useValue: { navigate } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap(queryParams) },
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(SandboxClaimComponent);
    fixture.detectChanges();
    return { fixture, claim, navigate };
  };

  it('claims on arrival, because getting here was already a deliberate click', () => {
    const { claim } = build({});
    expect(claim).toHaveBeenCalled();
  });

  it('does not claim for someone whose sandbox expired, and says so', () => {
    const { fixture, claim } = build({ expired: '1' });

    expect(claim).not.toHaveBeenCalled();
    expect(
      (fixture.nativeElement as HTMLElement).textContent,
    ).toContain('That sandbox is gone');
  });

  it('claims when that visitor asks for a new one', () => {
    const { fixture, claim } = build({ expired: '1' });

    const button = (fixture.nativeElement as HTMLElement).querySelector(
      'button',
    ) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();

    expect(claim).toHaveBeenCalled();
  });
});
