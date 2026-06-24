const { updateCredential } = require('./server/services/credentials.js');
async function test() {
  await updateCredential('driverPin', '1', '9999');
  console.log('Driver 1 PIN updated to 9999');
}
test();
