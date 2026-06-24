const { getAllCredentials } = require('./server/services/credentials.js');
async function test() {
  console.log(await getAllCredentials());
}
test();
