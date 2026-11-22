import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { InferenceSettingsService } from '../../service/inference-settings.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ConfirmService } from '../../../ui/overlays/confirm';
import { InferenceConnectionsComponent } from './inference-connections.component';

describe('deleting an LLM connection', () => {
  let fixture: ComponentFixture<InferenceConnectionsComponent>;
  let deleteConnection: jasmine.Spy;
  let held: string[];
  let confirm: jasmine.Spy;

  const connection = {
    id: 'conn-1',
    label: 'Mistral (prod)',
    baseUrl: 'https://api.mistral.ai/v1',
    models: [],
    isDefault: true,
  };

  const build = async (): Promise<void> => {
    deleteConnection = jasmine.createSpy('deleteConnection').and.returnValue(of(void 0));
    const service = {
      connections: signal([connection]),
      isHosted: signal(false),
      loadConnections: jasmine.createSpy('loadConnections'),
      deleteConnection,
      validateConnection: jasmine
        .createSpy('validateConnection')
        .and.returnValue(of({ success: true })),
      createConnection: jasmine.createSpy('createConnection').and.returnValue(of(connection)),
    };
    confirm = jasmine.createSpy('confirm').and.resolveTo(false);

    await TestBed.configureTestingModule({
      imports: [InferenceConnectionsComponent],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: InferenceSettingsService, useValue: service },
        { provide: ConfirmService, useValue: { confirm } },
        {
          provide: PermissionService,
          useValue: {
            isAdmin: () => false,
            can: (key: string) => held.includes(key),
            isSectionReadOnly: () => false,
            hasSection: () => true,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InferenceConnectionsComponent);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    // A connection is the installation's credential to a model provider, so the
    // API asks for `integration:manage` to unplug one. Every case below is about
    // somebody who holds it; the last one is about somebody who does not.
    held = ['integration:manage'];
    await build();
  });

  const deleteButton = (): HTMLButtonElement =>
    fixture.nativeElement.querySelector('[data-testid="delete-connection-conn-1"]') ?? undefined;

  it('does not delete anything on the click itself', () => {
    deleteButton().click();
    fixture.detectChanges();
    expect(deleteConnection).not.toHaveBeenCalled();
  });

  it('asks first, and names what goes with it', () => {
    deleteButton().click();
    fixture.detectChanges();
    const options = confirm.calls.mostRecent().args[0];
    expect(options.title).toBe('Delete LLM connection');
    expect(options.body).toContain('cannot be undone');
    expect(options.body).toContain('Mistral (prod)');
    expect(options.body).toContain('The stored API key is deleted with it');
    expect(options.confirmLabel).toBe('Delete');
  });

  it('deletes once the person confirms', async () => {
    confirm.and.resolveTo(true);
    deleteButton().click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(deleteConnection).toHaveBeenCalledWith('conn-1');
  });

  it('offers no delete at all to somebody who may not unplug the instance', async () => {
    held = [];
    TestBed.resetTestingModule();
    await build();
    expect(deleteButton()).toBeUndefined();
  });

  it('deletes nothing when the person backs out', async () => {
    deleteButton().click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(deleteConnection).not.toHaveBeenCalled();
  });

  /**
   * Creating one is now the same permission as removing one. "You may plug in
   * but not unplug" was never a position; the button that acts on neither half
   * must not be offered to somebody the API will refuse.
   */
  it('offers no way to add one either, to the same person', async () => {
    held = [];
    TestBed.resetTestingModule();
    await build();

    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    expect(buttons.find((b) => b.textContent?.includes('Add connection'))).toBeUndefined();
  });
});
