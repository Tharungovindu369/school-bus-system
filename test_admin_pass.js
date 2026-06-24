const { updateCredential, getAdminPassword } = require('./server/services/credentials.js');
async function test() {
  console.log("Current admin pass:", await getAdminPassword());
  const res = await updateCredential('adminPassword', 'adminPassword', 'admin123');
  console.log("Result:", res);
  console.log("New admin pass:", await getAdminPassword());
}
test().catch(console.error);


