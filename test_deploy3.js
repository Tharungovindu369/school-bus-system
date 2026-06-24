const { getAdminPassword } = require('./server/services/credentials.js');
getAdminPassword().then(console.log);
