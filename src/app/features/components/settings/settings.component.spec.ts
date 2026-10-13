import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { AppConfigService } from '../../../core/services/app-config.service';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import { PermissionService } from '../../../core/services/permission.service';
import { InferenceSettingsService } from '../../service/inference-settings.service';
import { SandboxSignInService } from '../../service/sandbox-sign-in.service';
import { SettingsComponent } from './settings.component';

describe('SettingsComponent demo sign-in tab', () => {
  const tabs = async (granted: string[], demo: boolean) => {
    const permissions = signal(new Set(granted));
    const list = jasmine
      .createSpy('list')
      .and.returnValue(of({ demo, callbackUrl: null, providers: [] }));
    TestBed.overrideComponent(SettingsComponent, {
      set: { template: '', imports: [] },
    });
    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        { provide: AuthService, useValue: { currentUser: signal(null) } },
        { provide: AppConfigService, useValue: { authMode: 'oidc' } },
        { provide: ActivatedRoute, useValue: { fragment: of(null) } },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
        { provide: CurrentSurfaceService, useValue: { set: () => undefined } },
        { provide: InferenceSettingsService, useValue: { connections: signal([]) } },
        {
          provide: PermissionService,
          useValue: { can: (key: string) => permissions().has(key) },
        },
        { provide: SandboxSignInService, useValue: { list } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return {
      ids: () => fixture.componentInstance.visibleSections().map((s) => s.id),
      list,
    };
  };

  it('shows the tab on a demo installation to someone who may operate it', async () => {
    const { ids } = await tabs(['sandbox:operate'], true);
    expect(ids()).toContain('demo-sign-in');
  });

  it('hides the tab on an installation that is not a demo', async () => {
    const { ids } = await tabs(['sandbox:operate'], false);
    expect(ids()).not.toContain('demo-sign-in');
  });

  it('hides the tab, and does not ask, without the permission', async () => {
    const { ids, list } = await tabs([], true);
    expect(ids()).not.toContain('demo-sign-in');
    expect(list).not.toHaveBeenCalled();
  });
});
