// Prints the hash for a new admin password (the #admin page's sign-in, api/admin-auth.js). Put it in
// ADMIN_PASSWORD_HASH on Vercel. The password itself is never stored.
//   node scripts/admin-password.mjs 'new password'
import { randomBytes, scryptSync } from 'node:crypto';
import { SCRYPT } from '../api/admin-auth.js';

const pw = process.argv[2];
if (!pw || pw.length < 8) { console.error('Give a password of 8 characters or more.'); process.exit(1); }
const salt = randomBytes(16).toString('base64url');
console.log(`scrypt$${salt}$${scryptSync(pw, salt, 32, SCRYPT).toString('base64url')}`);
