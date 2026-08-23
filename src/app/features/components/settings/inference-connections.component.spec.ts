import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { InferenceSettingsService } from '../../service/inference-settings.service';
import { InferenceConnectionsComponent } from './inference-connections.component';

describe('deleting an LLM connection', () => {
  let fixture: ComponentFixture<InferenceConnectionsComponent>;
  let deleteConnection: jasmine.Spy;

  const connection = {
    id: 'conn-1',
    label: 'Mistral (prod)',
    baseUrl: 'https://api.mistral.ai/v1',
    models: [],
    isDefault: true,
  };

  beforeEach(async () => {
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
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: InferenceSettingsService, useValue: service },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InferenceConnectionsComponent);
    fixture.detectChanges();
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
});
