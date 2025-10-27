// Quick script to fix the admin user's password
// Run with: node scripts/fix-admin-password.js

const bcrypt = require('bcryptjs');

const password = 'admin123';
const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync(password, salt);

console.log('Correctly hashed password for "admin123":');
console.log(hash);
console.log('\nRun this SQL command to fix the admin user:');
console.log(`UPDATE app_user SET password = '${hash}' WHERE email = 'admin@rgp.com';`);
