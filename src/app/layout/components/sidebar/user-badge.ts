import { UserProfile } from '../../../core/services/auth.service';

export interface UserBadge {
  name: string;
  email: string;
  initials: string;
}

/** What the sidebar shows for the person signed in; a visitor's placeholder email never shows. */
export function userBadge(
  user: Pick<UserProfile, 'name' | 'email'> | null,
  state: { masked: boolean; visitor: boolean },
): UserBadge {
  if (state.masked) return { name: 'Signed-in user', email: 'user@example.com', initials: '••' };
  if (state.visitor) return { name: 'Visitor', email: '', initials: 'V' };
  if (!user) return { name: 'User', email: '', initials: '' };
  const source = user.name || user.email || '';
  return {
    name: user.name || user.email || 'User',
    email: user.email ?? '',
    initials: source
      .split(/[\s@]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join(''),
  };
}
