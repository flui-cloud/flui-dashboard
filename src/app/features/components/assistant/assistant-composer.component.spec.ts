import { CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SandboxService } from '../../../core/services/sandbox.service';
import { AssistantChatService } from '../../service/assistant.service';
import { AssistantModelSelectionService } from '../../service/assistant-model-selection.service';
import { AssistantComposerComponent } from './assistant-composer.component';
import { AssistantModelPickerComponent } from './assistant-model-picker.component';

describe('AssistantComposerComponent', () => {
  const build = (opts: { destructive: boolean; inSandbox: boolean }) => {
    TestBed.configureTestingModule({
      imports: [AssistantComposerComponent],
      providers: [
        {
          provide: AssistantChatService,
          useValue: {
            destructiveEnabled: signal(opts.destructive),
            contextLong: signal(false),
            sending: signal(false),
            newConversation: () => undefined,
            send: () => undefined,
          },
        },
        { provide: AssistantModelSelectionService, useValue: { selectedOpts: () => null } },
        { provide: SandboxService, useValue: { inSandbox: signal(opts.inSandbox) } },
      ],
    });
    TestBed.overrideComponent(AssistantComposerComponent, {
      remove: { imports: [AssistantModelPickerComponent] },
      add: { schemas: [CUSTOM_ELEMENTS_SCHEMA] },
    });
    const fixture = TestBed.createComponent(AssistantComposerComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  const notice = (el: HTMLElement) => el.querySelector('[data-testid="assistant-destructive-notice"]');

  it('warns an operator when destructive actions are enabled on the server', () => {
    const el = build({ destructive: true, inSandbox: false });
    expect(notice(el)?.textContent).toContain('Destructive actions');
  });

  it('does not warn a demo visitor or guest, who is never offered those actions', () => {
    expect(notice(build({ destructive: true, inSandbox: true }))).toBeNull();
  });

  it('says nothing when destructive actions are off', () => {
    expect(notice(build({ destructive: false, inSandbox: false }))).toBeNull();
  });
});
