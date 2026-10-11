import { HttpErrorResponse } from '@angular/common/http';
import { readableMessage } from './api-error-message.interceptor';

describe('readableMessage', () => {
  const failure = (status: number, error: unknown) =>
    new HttpErrorResponse({ status, statusText: 'OK', url: 'https://api.example.test/api/v1/x', error });

  it('says what the API said', () => {
    expect(readableMessage(failure(403, { message: 'This part of Flui is not included in the trial.' }))).toBe(
      'This part of Flui is not included in the trial.',
    );
    expect(readableMessage(failure(400, { message: ['name is too long', 'port must be a number'] }))).toBe(
      'name is too long; port must be a number',
    );
  });

  it('never shows the address or the status line', () => {
    for (const status of [0, 401, 403, 404, 418, 502]) {
      const message = readableMessage(failure(status, null));
      expect(message).not.toContain('http');
      expect(message).not.toContain(String(status));
    }
  });

  it('ignores an HTML error page from a proxy', () => {
    expect(readableMessage(failure(502, '<html>Bad gateway</html>'))).toContain('Try again');
  });
});
