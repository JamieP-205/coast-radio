// Run with: npm run hash-password
//
// Asks for the editor password and prints the two values to paste into
// Netlify's environment variables. The password itself is never saved.

import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { hashPassword } from '../netlify/lib/auth.mjs';

const input = createInterface({ input: process.stdin, output: process.stdout });
const password = await input.question('New editor password (at least 12 characters): ');
input.close();

if (password.length < 12) {
  console.error('That password is too short. Please use at least 12 characters.');
  process.exit(1);
}

console.log('\nAdd these in Netlify: Project configuration > Environment variables\n');
console.log(`ADMIN_PASSWORD_HASH = ${hashPassword(password)}`);
console.log(`SESSION_SECRET      = ${randomBytes(32).toString('hex')}`);
console.log('\nAlso add ADMIN_USERNAME with the username Jim will type.');
