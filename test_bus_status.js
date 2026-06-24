const sheets = require('./server/services/sheets.js');
async function test() {
  const buses = await sheets.getBuses();
  console.log(buses.find(b => b.bus_number === 'Bus 1').current_status);
}
test();
