const base = 'http://127.0.0.1:3002';
const fetch = global.fetch;
(async () => {
  const doFetch = async (path, opts = {}) => {
    const res = await fetch(base + path, opts);
    const text = await res.text();
    console.log(path, res.status, text);
  };
  await doFetch('/api/health');
  await doFetch('/api/config/scan-mode?bus_number=Bus%201');
  await doFetch('/api/reception/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '9999' }) });
  await doFetch('/api/driver/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '0001', busNumber: 'Bus 1' }) });
  await doFetch('/api/lookup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ student_id: 'S0001', last4: '0001' }) });
  await doFetch('/driver');
})();
