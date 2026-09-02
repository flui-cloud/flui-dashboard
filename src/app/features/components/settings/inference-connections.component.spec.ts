import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { InferenceSettingsService } from '../../service/inference-settings.service';
import { PermissionService } from '../../../core/services/permission.service';
import { InferenceConnectionsComponent } from './inference-connections.component';

describe('deleting an LLM connection', () => {
  let fixture: ComponentFixture<InferenceConnectionsComponent>;
  let deleteConnection: jasmine.Spy;
  let held: string[];

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
      validateConnection: jasmine.createSpy('validateConnection').and.returnValue(of({ success: true })),
      createConnection: jasmine.createSpy('createConnection').and.returnValue(of(connection)),
    };

    await TestBed.configureTestingModule({
      imports: [InferenceConnectionsComponent],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: InferenceSettingsService, useValue: service },
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

  const deleteButton = (): HTMLButtonElement => {
    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    return buttons.find((b) => b.className.includes('border-destructive'))!;
  };

  const dialogText = (): string =>
    (fixture.nativeElement.textContent ?? '') as string;

  it('does not delete anything on the click itself', () => {
    deleteButton().click();
    fixture.detectChanges();
    expect(deleteConnection).not.toHaveBeenCalled();
  });

  it('asks first, and names what goes with it', () => {
    deleteButton().click();
    fixture.detectChanges();
    const text = dialogText();
    expect(text).toContain('Delete LLM connection');
    expect(text).toContain('cannot be undone');
    expect(text).toContain('Mistral (prod)');
    expect(text).toContain('The stored API key is deleted with it');
  });

  it('deletes once the person confirms', () => {
    deleteButton().click();
    fixture.detectChanges();

    const confirm: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    confirm.find((b) => b.textContent?.trim() === 'Delete')!.click();
    fixture.detectChanges();

    expect(deleteConnection).toHaveBeenCalledWith('conn-1');
  });

  it('offers no delete at all to somebody who may not unplug the instance', async () => {
    held = [];
    TestBed.resetTestingModule();
    await build();
    expect(deleteButton()).toBeUndefined();
  });

  it('deletes nothing when the person backs out', () => {
    deleteButton().click();
    fixture.detectChanges();

    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    buttons.find((b) => b.textContent?.trim() === 'Cancel')!.click();
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
