import { cookies } from 'next/headers';
import { queryOne, execute } from '@/lib/db';
import { COOKIE_NAME, SESSION_DURATION_DAYS } from './constants';

export { COOKIE_NAME } from './constants';

export type UserRole = 'user' | 'oracle';
export type UserPlan = 'open' | 'cabinet' | 'trialing' | 'canceled' | 'grandfathered';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  plan: UserPlan;
  created_at: Date;
  lumen_user_id?: string | null;
}

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
  path: '/',
};

/**
 * Read the current session from cookies and validate against the DB.
 * Safe to call in Server Components and Route Handlers via cookies().
 */
export async function getSession(): Promise<AuthUser | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const user = await queryOne<AuthUser>(
    `SELECT u.id, u.email, u.role, u.plan, u.created_at, u.lumen_user_id
     FROM auth_sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.token = $1
       AND s.expires_at > NOW()`,
    [token]
  );

  return user;
}

/**
 * Create a new auth session and return the token.
 * The caller is responsible for setting the cookie on the response.
 */
export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000
  );

  await execute(
    `INSERT INTO auth_sessions (user_id, token, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, token, expiresAt]
  );

  return token;
}

/**
 * Delete an auth session by token.
 */
export async function deleteSession(token: string): Promise<void> {
  await execute(`DELETE FROM auth_sessions WHERE token = $1`, [token]);
}
