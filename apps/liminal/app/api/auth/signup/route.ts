import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query, queryOne, execute } from '@/lib/db';
import { createSession, COOKIE_NAME, COOKIE_OPTIONS } from '@/lib/auth/session';

const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    const lowerEmail = email.toLowerCase().trim();

    // Check for existing user
    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM users WHERE email = $1',
      [lowerEmail]
    );

    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Auto-assign oracle role for designated admin email
    const ORACLE_EMAIL = 'thebestpolicyis@gmail.com';
    const assignedRole = lowerEmail === ORACLE_EMAIL ? 'oracle' : 'user';
    const assignedPlan = lowerEmail === ORACLE_EMAIL ? 'fellow' : 'aspirant';

    // Create user
    const user = await queryOne<{ id: string }>(
      `INSERT INTO users (email, password_hash, role, plan)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [lowerEmail, passwordHash, assignedRole, assignedPlan]
    );

    if (!user) {
      throw new Error('Failed to create user');
    }

    // Create session
    const token = await createSession(user.id);

    const response = NextResponse.json(
      { success: true, message: 'Account created' },
      { status: 201 }
    );

    response.cookies.set(COOKIE_NAME, token, COOKIE_OPTIONS);

    return response;
  } catch (err) {
    console.error('[signup]', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
