const bcrypt = require('bcryptjs');

const password = "changeMe"
const salt = bcrypt.genSaltSync(10);
const encPaswd = bcrypt.hashSync(password, salt);

console.log(encPaswd);