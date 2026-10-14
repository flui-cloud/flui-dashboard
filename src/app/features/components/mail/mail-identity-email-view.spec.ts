import { MailIdentityStatus } from '../../model/mail-console.models';
import { mailIdentityView } from './mail-identity-email-view';

const base: MailIdentityStatus = {
  state: 'active',
  reason: null,
  mailProvider: 'scaleway-tem',
  providerId: 'p1',
  active: true,
  endpoint: 'http://flui-api/api/v1/identity/email',
  lastSyncAt: null,
  lastSyncError: null,
  lastDeliveryAt: '2026-10-13T10:00:00.000Z',
  lastErrorAt: null,
  lastError: null,
};

describe('mailIdentityView', () => {
  it('names the provider by its product name when sign-in mail goes through Flui', () => {
    const view = mailIdentityView(base);
    expect(view.tone).toBe('ok');
    expect(view.provider).toBe('Scaleway Transactional Email');
    expect(view.note).toBeNull();
  });

  it('says why when it is not set up', () => {
    const view = mailIdentityView({
      ...base,
      state: 'not_configured',
      reason: 'no_transactional_connection',
      mailProvider: null,
    });
    expect(view.tone).toBe('idle');
    expect(view.provider).toBeNull();
    expect(view.note).toBe('Connect a transactional provider first.');
  });

  it('shows the sync error when the sync failed', () => {
    const view = mailIdentityView({
      ...base,
      state: 'error',
      reason: 'sync_failed',
      lastSyncError: '403 Forbidden',
    });
    expect(view.tone).toBe('error');
    expect(view.note).toBe('403 Forbidden');
  });

  it('falls back to the raw id for a provider it does not know', () => {
    expect(mailIdentityView({ ...base, mailProvider: 'acme' }).provider).toBe('acme');
  });

  it('shows the last error only when it came after the last delivery', () => {
    const failing = {
      ...base,
      lastError: 'provider down',
      lastErrorAt: '2026-10-13T11:00:00.000Z',
    };
    expect(mailIdentityView(failing).note).toBe('provider down');
    expect(
      mailIdentityView({ ...failing, lastErrorAt: '2026-10-13T09:00:00.000Z' }).note,
    ).toBeNull();
  });
});
