import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { INSTALL_PAGE_OPENER, InstallPromptService } from './install-prompt.service';
import { SandboxService } from './sandbox.service';

describe('InstallPromptService', () => {
  const build = (opts: { visitor?: boolean; inSandbox?: boolean; hasArea?: boolean } = {}) => {
    const openPage = jasmine.createSpy('openPage');
    TestBed.configureTestingModule({
      providers: [
        { provide: INSTALL_PAGE_OPENER, useValue: openPage },
        {
          provide: SandboxService,
          useValue: {
            visitor: signal(opts.visitor ?? false),
            inSandbox: signal(opts.inSandbox ?? false),
            hasArea: signal(opts.hasArea ?? false),
          },
        },
      ],
    });
    return { prompt: TestBed.inject(InstallPromptService), openPage };
  };

  it('opens the install dialog instead of a visitor’s write', () => {
    const { prompt } = build({ visitor: true, inSandbox: true });
    expect(prompt.requireInstall()).toBeTrue();
    expect(prompt.dialogOpen()).toBeTrue();
    prompt.close();
    expect(prompt.dialogOpen()).toBeFalse();
  });

  it('opens it for a demo guest without a space', () => {
    const { prompt } = build({ inSandbox: true });
    expect(prompt.requireInstall()).toBeTrue();
  });

  it('lets a guest with a space and an operator through', () => {
    expect(build({ inSandbox: true, hasArea: true }).prompt.requireInstall()).toBeFalse();
    TestBed.resetTestingModule();
    const { prompt } = build();
    expect(prompt.requireInstall()).toBeFalse();
    expect(prompt.dialogOpen()).toBeFalse();
  });

  it('opens the install page', () => {
    const { prompt, openPage } = build();
    prompt.visitInstallPage();
    expect(openPage).toHaveBeenCalled();
  });
});
