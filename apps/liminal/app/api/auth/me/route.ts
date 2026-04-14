import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }
    return NextResponse.json({ user: { id: user.id, email: user.email, username: user.username ?? null } });
  } catch (err) {
    console.error('[me]', err);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
