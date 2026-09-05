// Confirms the shared seed-user bcrypt hash (sql/ddl/006_dev_test_data.sql) decodes
// to the expected plaintext. Run once when standing the suite up.
import bcrypt from 'bcryptjs';

const SEED_HASH = '$2b$10$VdhRjllq5P5zBeh3zi51Y.oYNI5CXk2Mu5u0eQs3HvVhM7wxTPQTS';
const expected = process.env.QA_ADMIN_PASS || 'admin123';

const ok = bcrypt.compareSync(expected, SEED_HASH);
console.log(`seed hash vs "${expected}": ${ok ? 'MATCH' : 'NO MATCH'}`);
if (!ok) {
  const tried = ['admin123', 'Admin@123', 'password', 'rgpapp', 'admin'];
  for (const p of tried) {
    if (bcrypt.compareSync(p, SEED_HASH)) console.log(`  -> actual plaintext is "${p}"`);
  }
  process.exit(1);
}
