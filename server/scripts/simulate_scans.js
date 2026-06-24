const API_URL = 'http://localhost:3002/api';
const scans = [
  { student_id: 'S0001', bus_number: 'Bus 1' },
  { student_id: 'S0002', bus_number: 'Bus 2' },
  { student_id: 'S0003', bus_number: 'Bus 3' },
  { student_id: 'S0004', bus_number: 'Bus 1' },
  { student_id: 'S0005', bus_number: 'Bus 2' },
  { student_id: 'S0006', bus_number: 'Bus 3' },
  { student_id: 'S0007', bus_number: 'Bus 1' },
  { student_id: 'S0008', bus_number: 'Bus 2' },
  { student_id: 'S0009', bus_number: 'Bus 3' },
  { student_id: 'S0010', bus_number: 'Bus 1' },
];

async function simulateScans() {
  console.log(`Starting simulation of ${scans.length} rapid scans across multiple buses...`);
  
  for (let i = 0; i < scans.length; i++) {
    const scan = scans[i];
    try {
      const res = await fetch(`${API_URL}/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          student_id: scan.student_id,
          bus_number: scan.bus_number,
          driver_name: `Driver ${scan.bus_number}`,
          scan_type: 'boarding',
          scan_mode: 'morning'
        })
      });
      
      const data = await res.json();
      console.log(`Scan ${i+1} (${scan.student_id} on ${scan.bus_number}): Status ${res.status} - ${data.success ? 'Success' : 'Failed'}`);
      if (data.duplicate) console.log(`  -> Note: Duplicate Scan`);
      if (data.feeAlert) console.log(`  -> Note: Fee Alert triggered`);
      if (data.isCrossBus) console.log(`  -> Note: Cross-Bus triggered`);
    } catch (err) {
      console.error(`Scan ${i+1} (${scan.student_id}) failed:`, err.message);
    }
  }
  console.log('Simulation complete!');
}

simulateScans();
