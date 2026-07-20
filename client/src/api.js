const API_BASE = '/api';

async function request(path, options = {}) {
  const { headers = {}, ...restOptions } = options;
  try {
    const fetchOptions = {
      ...restOptions,
      headers: { 'Content-Type': 'application/json', ...headers },
    };
    const res = await fetch(`${API_BASE}${path}`, fetchOptions);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.message || 'Request failed');
    return data;
  } catch (err) {
    throw err;
  }
}

function getAuthHeader(auth) {
  if (!auth) return {};
  if (typeof auth === 'string') return { 'x-admin-password': auth };
  if (auth.role === 'admin') return { 'x-admin-password': auth.token };
  if (auth.role === 'accountant') return { 'x-accountant-pin': auth.token };
  if (auth.role === 'bus_incharge') return { 'x-bus-incharge-pin': auth.token };
  return {};
}

export const api = {
  health: () => request('/health'),
  getMapsKey: () => request('/config/maps-key'),
  getScanMode: (bus_number) =>
    request(`/config/scan-mode${bus_number ? `?bus_number=${encodeURIComponent(bus_number)}` : ''}`),
  driverLogin: (pin, busNumber) =>
    request('/driver/login', { method: 'POST', body: JSON.stringify({ pin, busNumber }) }),
  getDriverBuses: () => request('/driver/pins'),
  
  getStudents: (auth) => request('/students', { headers: getAuthHeader(auth) }),
  getStudent: (id, auth) => request(`/students/${id}`, { headers: getAuthHeader(auth) }),
  getStudentLookup: (id, auth) => request(`/admin/student/${id}`, { headers: getAuthHeader(auth) }),
  getAttendance: (date, auth) => request(`/attendance${date ? `?date=${date}` : ''}`, { headers: getAuthHeader(auth) }),
  getIncidents: (auth) => request('/incidents', { headers: getAuthHeader(auth) }),
  getBuses: (auth) => request('/buses', { headers: getAuthHeader(auth) }),
  getStudentsByBus: (bus, auth) => request(`/buses/${bus}/students`, { headers: getAuthHeader(auth) }),
  getBus: (number) => request(`/bus/${number}`),
  getTodayTimeline: (studentId) => request(`/students/${studentId}/today-timeline`),
  
  updateBusLocation: (bus_number, lat, lng) =>
    request('/bus/location', { method: 'POST', body: JSON.stringify({ bus_number, lat, lng }) }),
  startBus: (bus_number, driver_name, fuel_reading, reason) =>
    request('/bus/start', { method: 'POST', body: JSON.stringify({ bus_number, driver_name, fuel_reading, reason }) }),
  startReturnJourney: (bus_number, driver_name, fuel_reading, reason) =>
    request('/bus/start-return', { method: 'POST', body: JSON.stringify({ bus_number, driver_name, fuel_reading, reason }) }),
  stopBus: (bus_number, driver_name, fuel_reading) =>
    request('/bus/stop', { method: 'POST', body: JSON.stringify({ bus_number, driver_name, fuel_reading }) }),
  stopReturnJourney: (bus_number, driver_name, fuel_reading) =>
    request('/bus/stop-return', { method: 'POST', body: JSON.stringify({ bus_number, driver_name, fuel_reading }) }),
  uploadOdometerPhoto: (bus_number, image, driver_name, reason, odometer_reading, refueled, liters) =>
    request('/bus/odometer-upload', { method: 'POST', body: JSON.stringify({ bus_number, image, driver_name, reason, odometer_reading, refueled, liters }) }),
  getOdometerStats: (busNumber) => request(`/bus/${busNumber}/odometer-stats`),
  getAdminOdometerStats: () => request('/admin/odometer-stats'),
  runOdometerOcr: (image) => request('/bus/odometer-ocr', { method: 'POST', body: JSON.stringify({ image }) }),
  addBus: (bus, auth) => request('/bus', { method: 'POST', body: JSON.stringify(bus), headers: getAuthHeader(auth) }),
  getStops: (auth) => request('/stops', { headers: getAuthHeader(auth) }),
  addStop: (stop, auth) => request('/stops', { method: 'POST', body: JSON.stringify(stop), headers: getAuthHeader(auth) }),
  deleteStop: (id, auth) => request(`/stops/${id}`, { method: 'DELETE', headers: getAuthHeader(auth) }),
    
  scan: (data) => request('/scan', { method: 'POST', body: JSON.stringify(data) }),
  notify: (data) => request('/notify', { method: 'POST', body: JSON.stringify(data) }),
  
  receptionLogin: (pin) =>
    request('/reception/login', { method: 'POST', body: JSON.stringify({ pin }) }),
  
  adminLogin: (password) =>
    request('/admin/login', { method: 'POST', body: JSON.stringify({ password }) }),
  accountantLogin: (pin) =>
    request('/accountant/login', { method: 'POST', body: JSON.stringify({ pin }) }),
  busInchargeLogin: (pin) =>
    request('/bus-incharge/login', { method: 'POST', body: JSON.stringify({ pin }) }),
    
  lookupStudent: (student_id, last4) =>
    request('/lookup', { method: 'POST', body: JSON.stringify({ student_id, last4 }) }),
    
  saveFcmToken: (studentId, fcmToken) =>
    request(`/students/${studentId}/fcm-token`, { method: 'POST', body: JSON.stringify({ fcmToken }) }),
    
  getReceptionSummary: () => request('/reception/summary'),
  receptionScan: (student_id) => request('/reception/scan', { method: 'POST', body: JSON.stringify({ student_id }) }),
    
  getDashboard: (auth) =>
    request('/admin/dashboard', { headers: getAuthHeader(auth) }),
  getActiveReassignments: (auth) =>
    request('/reassignments/active', { headers: getAuthHeader(auth) }),
  createReassignment: (data, auth) =>
    request('/reassignments', {
      method: 'POST',
      headers: getAuthHeader(auth),
      body: JSON.stringify(data),
    }),
  getCredentials: (auth) =>
    request('/admin/credentials', { headers: getAuthHeader(auth) }),
  updateCredential: (auth, type, key, value) =>
    request('/admin/credentials', {
      method: 'PUT',
      headers: getAuthHeader(auth),
      body: JSON.stringify({ type, key, value }),
    }),
  
  addStudent: (data, auth) => request('/students', {
    method: 'POST',
    headers: getAuthHeader(auth),
    body: JSON.stringify(data)
  }),
  updateStudentStatus: (studentId, status, auth) => request(`/students/${studentId}/status`, {
    method: 'PUT',
    headers: getAuthHeader(auth),
    body: JSON.stringify({ status })
  }),
  deleteStudent: (studentId, auth) => request(`/students/${studentId}`, {
    method: 'DELETE',
    headers: getAuthHeader(auth)
  }),
  assignStudentQr: (studentId, newQrId, auth) => request(`/students/${studentId}/assign-qr`, {
    method: 'POST',
    headers: getAuthHeader(auth),
    body: JSON.stringify({ newQrId })
  }),
  updateBusDriver: (number, driver_name, driver_phone, auth) =>
    request(`/bus/${number}/driver`, { method: 'PUT', body: JSON.stringify({ driver_name, driver_phone }), headers: getAuthHeader(auth) }),
  updateStudentBus: (studentId, newBus, auth) =>
    request(`/students/${studentId}/bus`, {
      method: 'PUT',
      headers: getAuthHeader(auth),
      body: JSON.stringify({ bus_number: newBus }),
    }),
  updateFee: (id, payload, auth) =>
    request(`/fee/${id}`, { method: 'PUT', body: JSON.stringify(payload), headers: getAuthHeader(auth) }),
  updateFeeBulk: (studentIds, fee_paid_until, auth) =>
    request('/fee/bulk', {
      method: 'PUT',
      headers: getAuthHeader(auth),
      body: JSON.stringify({ studentIds, fee_status }),
    }),
};

export function todayStr() {
  return new Date().toISOString().split('T')[0];
}

export function exportCSV(filename, rows, headers) {
  const csv = [
    headers.join(','),
    ...rows.map((row) =>
      headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
