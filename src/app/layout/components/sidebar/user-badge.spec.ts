import { userBadge } from './user-badge';

describe('userBadge', () => {
  const user = { name: 'Ada Lovelace', email: 'ada@example.com' };

  it('shows the person signed in', () => {
    expect(userBadge(user, { masked: false, visitor: false })).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      initials: 'AL',
    });
  });

  it('shows a visitor without their placeholder email', () => {
    const badge = userBadge({ name: '', email: 'visitor-123@visitors.invalid' }, { masked: false, visitor: true });
    expect(badge).toEqual({ name: 'Visitor', email: '', initials: 'V' });
  });

  it('lets mask mode win over the visitor', () => {
    expect(userBadge(user, { masked: true, visitor: true }).name).toBe('Signed-in user');
  });

  it('copes with no profile yet', () => {
    expect(userBadge(null, { masked: false, visitor: false })).toEqual({ name: 'User', email: '', initials: '' });
  });
});
