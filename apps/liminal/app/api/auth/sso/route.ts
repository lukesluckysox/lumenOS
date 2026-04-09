import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { queryOne, execute } from '@/lib/db';
import { createSession, COOKIE_NAME, COOKIE_OPTIONS } from '@/lib/auth/session';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('[sso] JWT_SECRET env var is not set — SSO will not work.');
}

/**
 * GET /api/auth/sso?token=<lumen_sso_token>
 *
 * Validates the short-lived (2 min) SSO token issued by Lumen,
 * finds or creates a Liminal user whose email is `<username>@lumen.sso`,
 * creates a new session, sets the liminal_session cookie, and redirects
 * the browser to the app root.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Missing SSO token' }, { status: 400 });
  }

  if (!JWT_SECRET) {
    return NextResponse.json({ error: 'SSO not configured' }, { status: 503 });
  }

  let payload: { userId: number; username: string; email?: string | null; sso: boolean };
  try {
    payload = jwt.verify(token, JWT_SECRET) as typeof payload;
  } catch {
    return NextResponse.json(
      { error: 'SSO token expired or invalid. Return to Lumen and try again.' },
      { status: 401 }
    );
  }

  if (!payload.sso || !payload.username) {
    return NextResponse.json({ error: 'Invalid SSO token' }, { status: 400 });
  }

  // Use the real Lumen email if present so we find the user's existing Liminal
  // account. Fall back to a synthetic email only for users who registered in
  // Lumen with a different email than their Liminal account (rare edge case).
  const ssoEmail =
    payload.email && !payload.email.endsWith('@lumen.sso')
      ? payload.email.toLowerCase().trim()
      : `${payload.username.toLowerCase()}@lumen.sso`;

  try {
    // Find existing SSO-linked user
    let user = await queryOne<{ id: string }>(
      'SELECT id FROM users WHERE email = $1',
      [ssoEmail]
    );

    // Create one on first sign-in
    if (!user) {
      const randomHash = await bcrypt.hash(crypto.randomUUID(), 10);
      user = await queryOne<{ id: string }>(
        `INSERT INTO users (email, password_hash, role, plan)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [ssoEmail, randomHash, 'user', 'open']
      );
    }

    if (!user) {
      throw new Error('Failed to find or create SSO user');
    }

    // Persist the Lumen userId so epistemic events can reference it
    if (payload.userId) {
      await execute(
        `UPDATE users SET lumen_user_id = $1 WHERE id = $2`,
        [String(payload.userId), user.id]
      );
    }

    // Create session (UUID token stored in auth_sessions table)
    const sessionToken = await createSession(user.id);

    // Build the redirect URL from Railway's forwarded headers.
    // Both request.url and request.nextUrl resolve to localhost:8080 inside
    // the container — the real public host lives in x-forwarded-host.
    const proto = request.headers.get('x-forwarded-proto') ?? 'https';
    const host =
      request.headers.get('x-forwarded-host') ??
      request.headers.get('host') ??
      'liminal-app.up.railway.app';
    const response = NextResponse.redirect(`${proto}://${host}/`);
    response.cookies.set(COOKIE_NAME, sessionToken, COOKIE_OPTIONS);

    return response;
  } catch (err) {
    console.error('[sso]', err);
    return NextResponse.json(
      { error: 'SSO authentication failed. Please try again.' },
      { status: 500 }
    );
  }
}
