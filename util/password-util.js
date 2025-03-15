const bcrypt = require('bcryptjs')

const password = 'Admin@123'
const salt = bcrypt.genSaltSync(10);
const encoded = bcrypt.hashSync(password, salt);

console.log('encoded: ',encoded);

const valid = bcrypt.compareSync(password, encoded);
console.log('valid: ',valid);