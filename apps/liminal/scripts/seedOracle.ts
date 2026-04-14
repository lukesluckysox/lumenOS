/**
 * One-time seed script: promote a user to oracle role.
 *
 * Reads the admin email from the ORACLE_EMAIL environment variable
 * and sets role='oracle', plan='fellow' on that user row.
 *
 * Usage:
 *   ORACLE_EMAIL=you@example.com npx tsx scripts/seedOracle.ts
 *   — or —
 *   npm run seed:oracle   (with ORACLE_EMAIL set in Railway env)
 */

import { query, execute, initializeDatabase } from '../lib/db';

async function main() {
  const email = process.env.ORACLE_EMAIL;

  if (!email) {
    console.error(
      '[seed:oracle] ERROR: ORACLE_EMAIL environment variable is not set.\n' +
      'Set it to the admin email address, e.g.:\n' +
      '  ORACLE_EMAIL=you@example.com npm run seed:oracle'
    );
    process.exit(1);
  }

  const normalizedEmail = email.toLowerCase().trim();
  console.log(`[seed:oracle] Promoting ${normalizedEmail} to oracle…`);

  await initializeDatabase();

  // Check user exists
  const rows = await query<{ id: string; email: string; role: string }>(
    'SELECT id, email, role FROM users WHERE email = $1',
    [normalizedEmail]
  );

  if (rows.length === 0) {
    console.error(
      `[seed:oracle] ERROR: No user found with email "${normalizedEmail}".\n` +
      'The user must sign up first before being promoted.'
    );
    process.exit(1);
  }

  const user = rows[0];

  if (user.role === 'oracle') {
    console.log(`[seed:oracle] ${normalizedEmail} is already an oracle. No changes needed.`);
    process.exit(0);
  }

  await execute(
    `UPDATE users SET role = 'oracle', plan = 'fellow' WHERE email = $1`,
    [normalizedEmail]
  );

  console.log(`[seed:oracle] Done. ${normalizedEmail} is now oracle with cabinet plan.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed:oracle] Fatal error:', err);
  process.exit(1);
});
