import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import {
  SandboxSignInService,
  SignInProviderStatus,
  SignInProviders,
} from '../../service/sandbox-sign-in.service';
import { DemoSignInComponent } from './demo-sign-in.component';

const status = (over: Partial<SignInProviderStatus>): SignInProviderStatus => ({
  provider: 'github',
  name: 'GitHub',
  connected: false,
  source: null,
  clientId: null,
  connectedAt: null,
  connectedBy: null,
  disconnectedAt: null,
  onSignInPage: false,
  ...over,
});

const VIEW: SignInProviders = {
  demo: true,
  callbackUrl: 'https://auth.demo.example.com/ui/login/login/externalidp/callback',
  providers: [
    status({}),
    status({
      provider: 'google',
      name: 'Google',
      connected: true,
      source: 'flui',
      clientId: 'g-client',
      onSignInPage: true,
    }),
  ],
};

describe('DemoSignInComponent', () => {
  let fixture: ComponentFixture<DemoSignInComponent>;
  let service: {
    list: jasmine.Spy;
    connect: jasmine.Spy;
    disconnect: jasmine.Spy;
  };

  const build = async (view: SignInProviders = VIEW): Promise<void> => {
    service = {
      list: jasmine.createSpy('list').and.returnValue(of(view)),
      connect: jasmine.createSpy('connect').and.returnValue(
        of(
          status({
            connected: true,
            source: 'flui',
            clientId: 'gh-client',
            onSignInPage: true,
          }),
        ),
      ),
      disconnect: jasmine.createSpy('disconnect').and.returnValue(
        of(status({ provider: 'google', name: 'Google' })),
      ),
    };
    await TestBed.configureTestingModule({
      imports: [DemoSignInComponent],
      providers: [{ provide: SandboxSignInService, useValue: service }],
    }).compileComponents();
    fixture = TestBed.createComponent(DemoSignInComponent);
    fixture.detectChanges();
  };

  const text = (): string => (fixture.nativeElement.textContent ?? '') as string;
  const row = (provider: string): HTMLElement =>
    fixture.nativeElement.querySelector(`[data-provider="${provider}"]`);
  const button = (provider: string, label: string): HTMLButtonElement =>
    Array.from(row(provider).querySelectorAll('button')).find(
      (b) => (b as HTMLButtonElement).textContent?.trim() === label,
    ) as HTMLButtonElement;
  const type = (id: string, value: string): void => {
    const input = fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };

  it('shows each provider, its state and the callback URL to register', async () => {
    await build();
    expect(text()).toContain('Not connected');
    expect(text()).toContain('g-client');
    expect(
      fixture.nativeElement.querySelector('[data-testid="callback-url"]').textContent,
    ).toContain('/ui/login/login/externalidp/callback');
    expect(button('google', 'Rotate')).toBeTruthy();
    expect(button('github', 'Connect')).toBeTruthy();
    expect(button('github', 'Disconnect')).toBeUndefined();
  });

  it('asks for the secret in a password field and sends it once', async () => {
    await build();
    button('github', 'Connect').click();
    fixture.detectChanges();

    const secret = fixture.nativeElement.querySelector(
      '#sign-in-client-secret',
    ) as HTMLInputElement;
    expect(secret.type).toBe('password');

    type('sign-in-client-id', ' gh-client ');
    type('sign-in-client-secret', 'top-secret');
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    fixture.detectChanges();

    expect(service.connect).toHaveBeenCalledOnceWith('github', {
      clientId: 'gh-client',
      clientSecret: 'top-secret',
    });
  });

  it('never shows the secret again after it was sent', async () => {
    await build();
    button('github', 'Connect').click();
    fixture.detectChanges();
    type('sign-in-client-id', 'gh-client');
    type('sign-in-client-secret', 'top-secret');
    fixture.componentInstance.submit();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#sign-in-client-secret')).toBeNull();
    expect(fixture.componentInstance.form.controls.clientSecret.value).toBe('');
    expect(fixture.nativeElement.innerHTML).not.toContain('top-secret');
    expect(text()).toContain('gh-client');
  });

  it('clears the secret when the identity provider refuses it', async () => {
    await build();
    service.connect.and.returnValue(
      throwError(() => ({ error: { message: 'The identity provider could not add GitHub' } })),
    );
    button('github', 'Connect').click();
    fixture.detectChanges();
    type('sign-in-client-id', 'gh-client');
    type('sign-in-client-secret', 'top-secret');
    fixture.componentInstance.submit();
    fixture.detectChanges();

    expect(text()).toContain('could not add GitHub');
    expect(fixture.componentInstance.form.controls.clientSecret.value).toBe('');
  });

  it('asks before disconnecting, and only then calls the API', async () => {
    await build();
    button('google', 'Disconnect').click();
    fixture.detectChanges();
    expect(service.disconnect).not.toHaveBeenCalled();
    expect(text()).toContain('Guests who signed in with Google can no longer do so.');

    fixture.componentInstance.disconnect();
    fixture.detectChanges();
    expect(service.disconnect).toHaveBeenCalledOnceWith('google');
    expect(button('google', 'Disconnect')).toBeUndefined();
  });

  it('names where a visitor who signs in comes back, and the GitHub root that covers both', async () => {
    await build({ ...VIEW, intentCallbackUrl: 'https://auth.demo.example.com/idps/callback' });
    const line = fixture.nativeElement.querySelector('[data-testid="intent-callback-url"]').textContent;
    expect(line).toContain('https://auth.demo.example.com/idps/callback');
    expect(line).toContain('https://auth.demo.example.com/ ');
  });

  it('says nothing about a second callback when the API does not name one', async () => {
    await build();
    expect(fixture.nativeElement.querySelector('[data-testid="intent-callback-url"]')).toBeNull();
  });

  it('notes that the callback must follow a change of the sign-in address', async () => {
    await build();
    expect(
      fixture.nativeElement.querySelector('[data-testid="callback-note"]').textContent,
    ).toContain('If you change the sign-in address, update the callback at GitHub and Google.');
  });

  it('lets one left on the identity provider by the old configuration be taken over or removed', async () => {
    await build({
      ...VIEW,
      providers: [
        status({ connected: true, source: 'identity-provider', onSignInPage: true }),
        VIEW.providers[1],
      ],
    });
    expect(row('github').textContent).toContain('From old configuration');
    expect(row('github').textContent).toContain('Connect it here to manage it.');
    expect(button('github', 'Connect')).toBeTruthy();
    expect(button('github', 'Disconnect')).toBeTruthy();
  });

  it('says so on an installation that is not a demo, and offers nothing', async () => {
    await build({ demo: false, callbackUrl: null, providers: VIEW.providers });
    expect(fixture.nativeElement.querySelector('[data-testid="not-demo"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('button[type="button"]')).toBeNull();
  });
});
