import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { api, todayStr, exportCSV } from '../api';
import Spinner from '../components/Spinner';
import BusMap from '../components/BusMap';
import ManageCredentials from '../components/ManageCredentials';
import StudentLookup from '../components/StudentLookup';
import { getFeeStatusDetails, formatBusNumber, busNumberKey } from '../utils';
import { Html5Qrcode } from 'html5-qrcode';
import { useLanguage } from '../contexts/LanguageContext';





function AddBusModal({ onClose, onSave }) {
  const [formData, setFormData] = useState({
    bus_number: '',
    driver_name: '',
    driver_phone: '',
    route_name: '',
    capacity: '50'
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.bus_number.trim()) {
      toast.error('Bus Number is required');
      return;
    }
    setLoading(true);
    try {
      await onSave({
        bus_number: formData.bus_number.trim(),
        driver_name: formData.driver_name.trim(),
        driver_phone: formData.driver_phone.trim(),
        route_name: formData.route_name.trim(),
        capacity: formData.capacity.trim()
      });
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden text-slate-900 text-left">
        <div className="bg-primary p-6 text-white text-center">
          <h2 className="text-2xl font-bold">Add New Bus</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Bus Number *</label>
            <input
              type="text"
              value={formData.bus_number}
              onChange={e => setFormData({ ...formData, bus_number: e.target.value })}
              className="w-full border p-2.5 rounded-xl bg-slate-50 focus:outline-none"
              placeholder="e.g. Bus 17"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Route Name</label>
            <input
              type="text"
              value={formData.route_name}
              onChange={e => setFormData({ ...formData, route_name: e.target.value })}
              className="w-full border p-2.5 rounded-xl bg-slate-50 focus:outline-none"
              placeholder="e.g. Route 17"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Driver Name</label>
            <input
              type="text"
              value={formData.driver_name}
              onChange={e => setFormData({ ...formData, driver_name: e.target.value })}
              className="w-full border p-2.5 rounded-xl bg-slate-50 focus:outline-none"
              placeholder="e.g. Ramesh"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Driver Phone</label>
            <input
              type="text"
              value={formData.driver_phone}
              onChange={e => setFormData({ ...formData, driver_phone: e.target.value })}
              className="w-full border p-2.5 rounded-xl bg-slate-50 focus:outline-none"
              placeholder="e.g. 919876543210"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Capacity</label>
            <input
              type="number"
              value={formData.capacity}
              onChange={e => setFormData({ ...formData, capacity: e.target.value })}
              className="w-full border p-2.5 rounded-xl bg-slate-50 focus:outline-none"
              placeholder="50"
            />
          </div>
          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="flex-1 bg-slate-200 text-slate-700 py-3 rounded-xl font-bold">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-primary text-white py-3 rounded-xl font-bold flex justify-center">
              {loading ? <Spinner size="sm" /> : 'Save Bus'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StopMapPicker({ lat, lng, onChange }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (!window.L || !mapRef.current) return;

    const initialLat = parseFloat(lat) || 16.7375;
    const initialLng = parseFloat(lng) || 78.0017;

    // Initialize map
    const map = window.L.map(mapRef.current).setView([initialLat, initialLng], 13);
    mapInstance.current = map;

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Create marker
    const marker = window.L.marker([initialLat, initialLng], { draggable: true }).addTo(map);
    markerRef.current = marker;

    // Handle marker drag
    marker.on('dragend', () => {
      const position = marker.getLatLng();
      onChange(position.lat.toFixed(6), position.lng.toFixed(6));
    });

    // Handle map click
    map.on('click', (e) => {
      const position = e.latlng;
      marker.setLatLng(position);
      onChange(position.lat.toFixed(6), position.lng.toFixed(6));
    });

    // Fix map loading sizes
    setTimeout(() => map.invalidateSize(), 200);

    return () => {
      map.remove();
    };
  }, []);

  // Update marker position if coordinates change externally
  useEffect(() => {
    if (!mapInstance.current || !markerRef.current) return;
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (isNaN(parsedLat) || isNaN(parsedLng)) return;

    const currentPos = markerRef.current.getLatLng();
    if (Math.abs(currentPos.lat - parsedLat) > 0.0001 || Math.abs(currentPos.lng - parsedLng) > 0.0001) {
      markerRef.current.setLatLng([parsedLat, parsedLng]);
      mapInstance.current.setView([parsedLat, parsedLng]);
    }
  }, [lat, lng]);

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden mb-3 animate-fadeIn">
      <div ref={mapRef} className="w-full h-[180px] bg-slate-100" />
      <div className="bg-slate-50 p-2 text-center text-[10px] text-slate-400 font-semibold border-t">
        🖱️ Click anywhere on the map or drag the marker to pick coordinates
      </div>
    </div>
  );
}

function AssignQrModal({ student, onClose, onSave }) {
  const [newQrId, setNewQrId] = useState('');
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const html5QrRef = useRef(null);

  const startScanning = () => {
    setCameraActive(true);
    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode('qr-reader-assign');
        html5QrRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText) => {
            setNewQrId(decodedText);
            stopScanning();
            toast.success(`Scanned: ${decodedText}`);
          },
          () => {} // silent fail
        );
      } catch (err) {
        console.error('Failed to start scanner:', err);
        toast.error('Could not access camera scanner');
        setCameraActive(false);
      }
    }, 100);
  };

  const stopScanning = () => {
    if (html5QrRef.current) {
      html5QrRef.current.stop().catch(() => {}).then(() => {
        html5QrRef.current = null;
        setCameraActive(false);
      });
    } else {
      setCameraActive(false);
    }
  };

  useEffect(() => {
    return () => {
      if (html5QrRef.current) {
        html5QrRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newQrId.trim()) return;
    setLoading(true);
    try {
      await onSave(student.student_id, newQrId.trim());
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-slate-900 text-left animate-fadeIn">
        <h3 className="text-xl font-bold mb-1">Assign QR Card</h3>
        <p className="text-sm text-slate-500 mb-4">
          Assign a physical QR card to <strong className="text-slate-800">{student.name}</strong>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {cameraActive ? (
            <div className="relative rounded-xl overflow-hidden border border-slate-300 bg-black aspect-video flex flex-col justify-end mb-2">
              <div id="qr-reader-assign" className="absolute inset-0 w-full h-full object-cover" />
              <div className="relative z-10 p-3 bg-gradient-to-t from-black/80 to-transparent text-center">
                <button
                  type="button"
                  onClick={stopScanning}
                  className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-4 py-1.5 rounded-lg text-xs"
                >
                  Close Camera
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
              <span className="text-xs font-semibold text-slate-500 block mb-2">Use Device Camera</span>
              <button
                type="button"
                onClick={startScanning}
                className="w-full bg-primary text-white text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 hover:bg-primary/95 transition mb-1"
              >
                📷 Open Camera Scanner
              </button>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">
              Scan Card with Barcode Gun or Type Code
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="Click here & scan/type QR code..."
              value={newQrId}
              onChange={(e) => setNewQrId(e.target.value)}
              className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Tip: If using a Barcode wedge gun, focus this box and pull the scanner trigger.
            </p>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold text-xs transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !newQrId.trim()}
              className="px-4 py-2 bg-primary hover:bg-primary/95 text-white font-bold rounded text-xs transition"
            >
              {loading ? 'Saving...' : '🔗 Save Assignment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ChangeBusModal({ student, onClose, onSave, buses }) {
  const [busNumber, setBusNumber] = useState(student.bus_number || '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!busNumber) return;
    setLoading(true);
    try {
      await onSave(student.student_id, busNumber);
      onClose();
    } catch (e) {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-xl font-bold mb-4">Change Bus - {student.name}</h3>
        <select value={busNumber} onChange={e => setBusNumber(e.target.value)} className="w-full border p-2 rounded mb-4">
          <option value="">-- Select Bus --</option>
          {buses.map(b => <option key={b.bus_number} value={b.bus_number}>Bus {b.bus_number}</option>)}
        </select>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border rounded">Cancel</button>
          <button onClick={handleSave} disabled={loading} className="px-4 py-2 bg-primary text-white rounded font-bold">Update Bus</button>
        </div>
      </div>
    </div>
  );
}

function ManageStudentModal({ student, auth, onClose, onUpdateFee, onChangeBus, onGenerateQR, onDeleteStudent, onDownloadQR, onAssignQR }) {
  const role = auth?.role || (typeof auth === 'string' ? 'admin' : '');
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-slate-900 text-left">
        <h3 className="text-xl font-bold mb-1">{student.name}</h3>
        <p className="text-sm text-slate-500 mb-4 flex items-center gap-1.5">
          <span>{student.student_id}</span>
          <span>&bull;</span>
          <span>{formatBusNumber(student.bus_number)}</span>
          <span>&bull;</span>
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800">
            Active
          </span>
        </p>
        
        <div className="space-y-3">
          {['admin', 'accountant'].includes(role) && (
            <button onClick={onAssignQR} className="w-full p-3 border border-primary/20 rounded-lg text-left hover:bg-slate-50 font-bold flex items-center justify-between text-primary bg-primary/5">
              🔗 Bind/Assign QR Card <span>➔</span>
            </button>
          )}
          {['admin', 'accountant'].includes(role) && (
            <button onClick={onUpdateFee} className="w-full p-3 border rounded-lg text-left hover:bg-slate-50 font-semibold flex items-center justify-between">
              Update Fee Status <span>➔</span>
            </button>
          )}
          {['admin', 'bus_incharge'].includes(role) && (
            <button onClick={onChangeBus} className="w-full p-3 border rounded-lg text-left hover:bg-slate-50 font-semibold flex items-center justify-between">
              Change Bus Assignment <span>➔</span>
            </button>
          )}
          {['admin', 'accountant'].includes(role) && (
            <>
              <button onClick={onGenerateQR} className="w-full p-3 border rounded-lg text-left hover:bg-slate-50 font-semibold flex items-center justify-between text-primary">
                View/Print QR Code <span>➔</span>
              </button>
              <button onClick={onDownloadQR} className="w-full p-3 border rounded-lg text-left hover:bg-slate-50 font-semibold flex items-center justify-between text-emerald-600">
                📥 Download QR Code (PNG) <span>➔</span>
              </button>

              <button 
                onClick={() => {
                  if (window.confirm(`Are you sure you want to permanently delete student ${student.name} (${student.student_id})? This action cannot be undone.`)) {
                    onDeleteStudent(student.student_id);
                  }
                }} 
                className="w-full p-3 border border-red-200 rounded-lg text-left hover:bg-red-50 font-semibold flex items-center justify-between text-red-600"
              >
                🚨 Delete Student <span>➔</span>
              </button>
            </>
          )}
        </div>
        
        <button onClick={onClose} className="w-full mt-6 px-4 py-2 bg-slate-200 text-slate-700 rounded font-bold">Close</button>
      </div>
    </div>
  );
}

function UpdatePaymentModal({ student, onClose, onSave }) {
  const [duration, setDuration] = useState('');
  const [customDate, setCustomDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!duration) { toast.error('Please select an action'); return; }
    setLoading(true);
    try {
      let payload = {};
      if (duration === 'custom date') {
        if (!customDate) throw new Error('Please select a custom date');
        payload.custom_date = customDate;
      } else if (duration === 'mark due') {
        payload.mark_due = true;
      } else {
        if (duration === '1 month') payload.duration_months = 1;
        else if (duration === '3 months') payload.duration_months = 3;
        else if (duration === '6 months') payload.duration_months = 6;
        else if (duration === '1 year') payload.duration_months = 12;
      }
      await onSave(student.student_id, payload);
      onClose();
    } catch (e) {
      toast.error(e.message);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-xl font-bold mb-4">Update Fee - {student.name}</h3>
        {(() => {
          const feeDetails = getFeeStatusDetails(student);
          const colorClass = feeDetails.status === 'EXPIRED'
            ? 'text-red-500'
            : feeDetails.status === 'EXPIRING_SOON'
            ? 'text-amber-500'
            : 'text-green-600';
          return (
            <p className="text-sm text-slate-500 mb-2">
              Current status: <span className={`font-bold ${colorClass}`}>{feeDetails.label}</span>
            </p>
          );
        })()}
        <select value={duration} onChange={e => setDuration(e.target.value)} className="w-full border p-2 rounded mb-4">
          <option value="">-- Select Action --</option>
          <option value="mark due">🔴 Mark as Due</option>
          <option value="1 month">✅ Extend 1 Month</option>
          <option value="3 months">✅ Extend 3 Months</option>
          <option value="6 months">✅ Extend 6 Months</option>
          <option value="1 year">✅ Extend 1 Year</option>
          <option value="custom date">📅 Custom Date</option>
        </select>
        {duration === 'custom date' && (
          <input type="date" value={customDate} onChange={e => setCustomDate(e.target.value)} className="w-full border p-2 rounded mb-4" />
        )}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 border rounded">Cancel</button>
          <button onClick={handleSave} disabled={loading} className="px-4 py-2 bg-primary text-white rounded">Save</button>
        </div>
      </div>
    </div>
  );
}

function EditBusModal({ bus, onClose, onSave }) {
  const [driverName, setDriverName] = useState(bus.driver_name || '');
  const [driverPhone, setDriverPhone] = useState(bus.driver_phone || '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      await onSave(bus.bus_number, driverName, driverPhone);
      onClose();
    } catch (e) {
      toast.error(e.message);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-xl font-bold mb-4">Edit Bus {bus.bus_number}</h3>
        <input type="text" placeholder="Driver Name" value={driverName} onChange={e => setDriverName(e.target.value)} className="w-full border p-2 rounded mb-4" />
        <input type="tel" placeholder="Driver Phone" value={driverPhone} onChange={e => setDriverPhone(e.target.value)} className="w-full border p-2 rounded mb-4" />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 border rounded">Cancel</button>
          <button onClick={handleSave} disabled={loading} className="px-4 py-2 bg-primary text-white rounded">Save</button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color = 'blue' }) {
  const colors = {
    blue: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white',
    green: 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white',
    red: 'bg-gradient-to-r from-red-500 to-red-600 text-white',
    purple: 'bg-gradient-to-r from-purple-500 to-purple-600 text-white',
  };
  return (
    <div className={`p-4 rounded-xl shadow-sm ${colors[color] || colors.blue}`}>
      <p className="text-sm font-semibold opacity-80">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function AdminLogin({ onLogin }) {
  const [role, setRole] = useState('admin');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let res;
      if (role === 'admin') res = await api.adminLogin(pin);
      else if (role === 'accountant') res = await api.accountantLogin(pin);
      else res = await api.busInchargeLogin(pin);
      
      const authObj = { role: res.role, token: pin };
      sessionStorage.setItem('admin_auth', JSON.stringify(authObj));
      sessionStorage.setItem('admin_auth_time', Date.now().toString());
      onLogin(authObj);
      toast.success(`Welcome, ${res.role}`);
    } catch {
      toast.error('Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 relative">
      <h1 className="text-2xl font-bold text-white mb-6">Staff Login</h1>
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white p-6 rounded-2xl shadow-xl">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full p-4 rounded-xl text-lg mb-4 bg-slate-100 border border-slate-200"
        >
          <option value="admin">Admin</option>
          <option value="accountant">Accountant</option>
          <option value="bus_incharge">Bus Incharge</option>
        </select>
        <input
          type={role === 'admin' ? 'password' : 'tel'}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder={role === 'admin' ? 'Password' : 'PIN'}
          className="w-full p-4 rounded-xl text-lg mb-4 bg-slate-100 border border-slate-200"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-white font-bold py-4 rounded-xl disabled:opacity-50 flex justify-center hover:bg-blue-700 transition"
        >
          {loading ? <Spinner size="sm" /> : 'Login'}
        </button>
      </form>
    </div>
  );
}

function AddStudentModal({ onClose, onSave }) {
  const [formData, setFormData] = useState({
    student_id: '',
    name: '',
    class: '',
    bus_number: 'Bus 1',
    stop_name: '',
    parent_name: '',
    parent_whatsapp: '',
    fee_paid_until: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      // Error handled by parent
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="bg-primary p-6 text-white text-center">
          <h2 className="text-2xl font-bold">Add New Student</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Student ID *</label>
            <input type="text" value={formData.student_id} onChange={e => setFormData({...formData, student_id: e.target.value.toUpperCase()})} className="w-full border p-2 rounded" required />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Student Name *</label>
            <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border p-2 rounded" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Class</label>
              <input type="text" value={formData.class} onChange={e => setFormData({...formData, class: e.target.value})} className="w-full border p-2 rounded" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Bus Number *</label>
              <select value={formData.bus_number} onChange={e => setFormData({...formData, bus_number: e.target.value})} className="w-full border p-2 rounded" required>
                {[...Array(20)].map((_, i) => <option key={i+1} value={`Bus ${i+1}`}>Bus {i+1}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Stop Name *</label>
            <input type="text" value={formData.stop_name} onChange={e => setFormData({...formData, stop_name: e.target.value})} className="w-full border p-2 rounded" required />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Parent Name</label>
            <input type="text" value={formData.parent_name} onChange={e => setFormData({...formData, parent_name: e.target.value})} className="w-full border p-2 rounded" />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Parent WhatsApp</label>
            <input type="text" value={formData.parent_whatsapp} onChange={e => setFormData({...formData, parent_whatsapp: e.target.value})} className="w-full border p-2 rounded" placeholder="919876543210" />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Fee Paid Until (Optional)</label>
            <input type="date" value={formData.fee_paid_until} onChange={e => setFormData({...formData, fee_paid_until: e.target.value})} className="w-full border p-2 rounded" />
            <p className="text-xs text-slate-500 mt-1">If blank, student will default to DUE.</p>
          </div>
          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="flex-1 bg-slate-200 text-slate-700 py-3 rounded-xl font-bold">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-primary text-white py-3 rounded-xl font-bold flex justify-center">
              {loading ? <Spinner size="sm" /> : 'Save Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { lang, toggleLang } = useLanguage();
  const [auth, setAuth] = useState(() => {
    const a = sessionStorage.getItem('admin_auth');
    try { return a ? JSON.parse(a) : null; } catch { return null; }
  });
  const [stats, setStats] = useState(null);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [buses, setBuses] = useState([]);
  const [selectedStudentForFee, setSelectedStudentForFee] = useState(null);
  const [selectedStudentForManage, setSelectedStudentForManage] = useState(null);
  const [selectedStudentForBus, setSelectedStudentForBus] = useState(null);
  const [selectedStudentForQr, setSelectedStudentForQr] = useState(null);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showAddBus, setShowAddBus] = useState(false);
  const [selectedBusForEdit, setSelectedBusForEdit] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [reassignForm, setReassignForm] = useState({ bus_number: '', temp_driver: '', temp_driver_phone: '', temp_driver_bus: '', reason: '', end_date: '' });
  const [reassignSubmitting, setReassignSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feeFilter, setFeeFilter] = useState('ALL');
  const [busFilter, setBusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [odoStats, setOdoStats] = useState({ stats: {}, logs: [] });
  const [stops, setStops] = useState([]);
  const [newStop, setNewStop] = useState({ bus_number: '', stop_name: '', latitude: '', longitude: '', sequence: '' });
  const [submittingStop, setSubmittingStop] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchingMap, setSearchingMap] = useState(false);
  const feeUpdateLock = useRef(false);

  const loadData = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    try {
      const [dash, studs, att, busList, incs, reass, odos, stopsList] = await Promise.all([
        api.getDashboard(auth).catch(() => null),
        ['admin', 'accountant', 'bus_incharge'].includes(auth.role) ? api.getStudents(auth).catch(() => []) : Promise.resolve([]),
        auth.role === 'admin' ? api.getAttendance(todayStr(), auth).catch(() => []) : Promise.resolve([]),
        ['admin', 'bus_incharge'].includes(auth.role) ? api.getBuses(auth).catch(() => []) : Promise.resolve([]),
        auth.role === 'admin' ? api.getIncidents(auth).catch(() => []) : Promise.resolve([]),
        ['admin', 'bus_incharge'].includes(auth.role) ? api.getActiveReassignments(auth).catch(() => []) : Promise.resolve([]),
        ['admin', 'bus_incharge'].includes(auth.role) ? api.getAdminOdometerStats(auth).catch(() => ({ stats: {}, logs: [] })) : Promise.resolve({ stats: {}, logs: [] }),
        ['admin', 'bus_incharge'].includes(auth.role) ? api.getStops(auth).catch(() => []) : Promise.resolve([])
      ]);
      if (dash) setStats({ ...dash, activeReassignments: reass });
      if (odos) setOdoStats(odos);
      if (stopsList) setStops(stopsList);
      // Don't overwrite students if a fee update just happened
      if (studs && !feeUpdateLock.current) setStudents(studs);
      setAttendance(att || []);
      setBuses(busList || []);
      setIncidents(incs || []);
    } catch (err) {
      if (err.message.includes('Unauthorized') || err.message.includes('Forbidden')) {
        sessionStorage.removeItem('admin_auth');
        setAuth(null);
      }
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleReassignSubmit = async (e) => {
    e.preventDefault();
    setReassignSubmitting(true);
    try {
      await api.createReassignment({
        ...reassignForm,
        reassigned_by: auth.role || 'admin',
      }, auth);
      toast.success('Reassignment saved!');
      setReassignForm({ bus_number: '', temp_driver: '', temp_driver_phone: '', temp_driver_bus: '', reason: '', end_date: '' });
      loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setReassignSubmitting(false);
    }
  };

  const toggleFee = (s) => {
    setSelectedStudentForFee(s);
  };
  
  const handleAddStudent = async (data) => {
    try {
      await api.addStudent(data, auth);
      toast.success('✅ Student added successfully');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to add student');
      throw err;
    }
  };

  const handleChangeBus = async (studentId, busNumber) => {
    try {
      await api.updateStudentBus(studentId, busNumber, auth);
      toast.success('✅ Bus changed successfully');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to change bus');
      throw err;
    }
  };

  const handleAssignQr = async (studentId, newQrId) => {
    try {
      await api.assignStudentQr(studentId, newQrId, auth);
      toast.success('✅ QR Code assigned successfully!');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to assign QR Code');
      throw err;
    }
  };

  const handleMapSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchingMap(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(data);
      if (data.length === 0) {
        toast.error('No locations found for this query');
      }
    } catch (err) {
      toast.error('Failed to search location');
    } finally {
      setSearchingMap(false);
    }
  };

  const handleSelectSearchResult = (result) => {
    setNewStop(prev => ({
      ...prev,
      latitude: parseFloat(result.lat).toFixed(6),
      longitude: parseFloat(result.lon).toFixed(6),
      stop_name: prev.stop_name || result.display_name.split(',')[0]
    }));
    setSearchResults([]);
    setSearchQuery(result.display_name.split(',')[0]);
    toast.success(`Selected: ${result.display_name.split(',')[0]}`);
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setNewStop(prev => ({
          ...prev,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6)
        }));
        toast.success('Auto-filled current location!');
      },
      (error) => {
        toast.error(`Geolocation error: ${error.message}`);
      }
    );
  };

  const handleAddStopSubmit = async (e) => {
    e.preventDefault();
    if (!newStop.bus_number || !newStop.stop_name || !newStop.latitude || !newStop.longitude || !newStop.sequence) {
      toast.error('Please fill in all stop details');
      return;
    }
    setSubmittingStop(true);
    try {
      await api.addStop({
        bus_number: newStop.bus_number,
        stop_name: newStop.stop_name,
        latitude: parseFloat(newStop.latitude),
        longitude: parseFloat(newStop.longitude),
        sequence: parseInt(newStop.sequence, 10)
      }, auth);
      toast.success('Stop location added successfully!');
      setNewStop({ bus_number: '', stop_name: '', latitude: '', longitude: '', sequence: '' });
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to add stop');
    } finally {
      setSubmittingStop(false);
    }
  };

  const handleDeleteStopClick = async (stopId, stopName) => {
    if (!window.confirm(`Are you sure you want to delete stop "${stopName}"?`)) return;
    try {
      await api.deleteStop(stopId, auth);
      toast.success('Stop location deleted!');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to delete stop');
    }
  };

  const handleGenerateQR = (student) => {
    window.open(`/api/qr/generate/${student.student_id}?token=${auth.token || auth}`, '_blank');
  };

  const handlePrintAllQR = () => {
    window.open(`/api/qr/print-all?token=${auth.token || auth}`, '_blank');
  };

  const handlePrintBusQR = (busNumber) => {
    window.open(`/api/qr/print-all?bus=${busNumber}&token=${auth.token || auth}`, '_blank');
  };

  const handleUpdateFee = async (studentId, payload) => {
    try {
      const res = await api.updateFee(studentId, payload, auth);
      if (!res.fee_status) throw new Error('Invalid server response');
      feeUpdateLock.current = true;
      // Fetch fresh list from server — server cache is updated immediately after write
      const freshStudents = await api.getStudents(auth);
      setStudents(freshStudents || []);
      feeUpdateLock.current = false;
      setSelectedStudentForFee(null);
      toast.success(`✅ Fee marked as ${res.fee_status}`);
    } catch (err) {
      feeUpdateLock.current = false;
      toast.error(err.message || 'Failed to update fee');
    }
  };



  const handleDeleteStudent = async (studentId) => {
    try {
      await api.deleteStudent(studentId, auth);
      toast.success('Student deleted successfully');
      setSelectedStudentForManage(null);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to delete student');
    }
  };

  const handleDownloadQR = (student) => {
    window.open(`/api/qr/download/${student.student_id}?token=${auth.token || auth}`, '_blank');
    setSelectedStudentForManage(null);
  };
  
  const handleEditBus = async (busNumber, driverName, driverPhone) => {
    try {
      await api.updateBusDriver(busNumber, driverName, driverPhone, auth);
      toast.success('Bus driver updated');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleAddBus = async (bus) => {
    try {
      await api.addBus(bus, auth);
      toast.success('✅ New bus added successfully!');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to add bus');
      throw err;
    }
  };

const exportTodayCSV = () => {
    const headers = ['timestamp', 'student_id', 'student_name', 'bus_number', 'stop_name', 'boarded_at', 'driver_name', 'date'];
    exportCSV(`attendance_${todayStr()}.csv`, filteredAttendance, headers);
    toast.success('CSV downloaded');
  };

  const exportUnpaidCSV = () => {
    const unpaid = students.filter((s) => (s.fee_status || '').toUpperCase() === 'DUE');
    const headers = ['student_id', 'name', 'class', 'bus_number', 'stop_name', 'parent_name', 'parent_whatsapp', 'fee_status', 'fee_due_date'];
    exportCSV('unpaid_fees.csv', unpaid, headers);
    toast.success('Unpaid fees report downloaded');
  };

  const filteredAttendance = attendance.filter((a) => {
    const matchBus = !busFilter || String(a.bus_number) === busFilter;
    const matchSearch = !search ||
      a.student_name?.toLowerCase().includes(search.toLowerCase()) ||
      a.student_id?.includes(search);
    return matchBus && matchSearch;
  });

  const filteredStudents = students.filter((s) => {
    // fee status filter
    const matchFee = feeFilter === 'ALL' || (s.fee_status || '').toUpperCase() === feeFilter;
    
    // bus filter
    const matchBus = !busFilter || String(s.bus_number) === busFilter;
    
    // search text filter
    const matchSearch = !search ||
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.student_id?.toUpperCase().includes(search.toUpperCase()) ||
      s.class?.toLowerCase().includes(search.toLowerCase());
      
    return matchFee && matchBus && matchSearch;
  });

  if (!auth) return <AdminLogin onLogin={setAuth} />;

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-primary text-white p-4 shadow flex justify-between items-center">
        <h1 className="text-xl font-bold">Admin Dashboard ({auth.role})</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleLang}
            className="text-xs bg-white/20 hover:bg-white/30 text-white font-bold py-1.5 px-3 rounded-xl transition"
          >
            {lang === 'en' ? 'తెలుగు' : 'English'}
          </button>
          <button
            onClick={() => { sessionStorage.removeItem('admin_auth'); setAuth(null); }}
            className="text-sm bg-white/20 px-3 py-1 rounded-lg"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="flex overflow-x-auto bg-white border-b">
        {(()=>{
          let t = [];
          if (auth.role === 'admin') t = ['overview', 'attendance', 'students', 'buses', 'reassignment', 'incidents', 'fuel_odometer', 'route_stops', 'lookup', 'manage_credentials'];
          if (auth.role === 'accountant') t = ['overview', 'students'];
          if (auth.role === 'bus_incharge') t = ['overview', 'students', 'buses', 'reassignment', 'fuel_odometer', 'route_stops'];
          return t;
        })().map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-semibold capitalize whitespace-nowrap ${
              activeTab === tab ? 'text-primary border-b-2 border-primary' : 'text-slate-500'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading && !stats && activeTab === 'overview' ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <div className="p-4 max-w-7xl mx-auto">
          {activeTab === 'overview' && stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard label="Total Students" value={stats.totalStudents} />
              <StatCard label="Boarded Today" value={stats.boardedToday} color="green" />
              <StatCard label="Fee Defaulters" value={stats.feeDefaulters} color="red" />
              <StatCard label="Active Buses" value={stats.activeBuses} color="purple" />
            </div>
          )}

          {activeTab === 'attendance' && (
            <div>
              <div className="flex flex-wrap gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Search student..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[150px]"
                />
                <select
                  value={busFilter}
                  onChange={(e) => setBusFilter(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">All Buses</option>
                  {Array.from(new Set(attendance.map((a) => a.bus_number))).map((b) => (
                    <option key={b} value={b}>Bus {b}</option>
                  ))}
                </select>
                <button
                  onClick={exportTodayCSV}
                  className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold"
                >
                  Export CSV
                </button>
              </div>
              <div className="bg-white rounded-xl shadow overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Time', 'Student', 'Bus', 'Stop', 'Driver'].map((h) => (
                        <th key={h} className="text-left p-3 font-semibold text-slate-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttendance.map((a, i) => (
                      <tr key={i} className="border-t hover:bg-slate-50">
                        <td className="p-3">{a.boarded_at}</td>
                        <td className="p-3 font-medium">{a.student_name}</td>
                        <td className="p-3">{formatBusNumber(a.bus_number)}</td>
                        <td className="p-3">{a.stop_name}</td>
                        <td className="p-3">{a.driver_name}</td>
                      </tr>
                    ))}
                    {!filteredAttendance.length && (
                      <tr><td colSpan={5} className="p-6 text-center text-slate-400">No attendance today</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'students' && (
            <div>
              <div className="flex flex-wrap gap-2 mb-4 items-center w-full">
                {['admin', 'bus_incharge'].includes(auth?.role || (typeof auth === 'string' ? 'admin' : '')) && (
                  <button onClick={() => setShowAddStudent(true)} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold mr-2">
                    + Add Student
                  </button>
                )}
                
                <input
                  type="text"
                  placeholder="Search name or ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[150px]"
                />

                <select
                  value={busFilter}
                  onChange={(e) => setBusFilter(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm bg-white font-semibold text-slate-700"
                >
                  <option value="">All Buses</option>
                  {Array.from(new Set(students.map((s) => s.bus_number)))
                    .filter(Boolean)
                    .sort((a, b) => (parseInt(busNumberKey(a), 10) || 0) - (parseInt(busNumberKey(b), 10) || 0))
                    .map((b) => (
                      <option key={b} value={b}>{formatBusNumber(b)}</option>
                    ))}
                </select>



                {['ALL', 'PAID', 'DUE'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFeeFilter(f)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                      feeFilter === f
                        ? f === 'PAID' ? 'bg-paid text-white' : f === 'DUE' ? 'bg-due text-white' : 'bg-primary text-white'
                        : 'bg-white border text-slate-600'
                    }`}
                  >
                    {f}
                  </button>
                ))}
                <button
                  onClick={exportUnpaidCSV}
                  className="ml-auto bg-due text-white px-4 py-2 rounded-lg text-sm font-semibold"
                >
                  Export Unpaid Report
                </button>
                <button
                  onClick={handlePrintAllQR}
                  className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold"
                  title="Print QR labels for ALL students (50×35mm, ~18-20 per sheet)"
                >
                  🖨️ Print All QR Labels
                </button>
              </div>
              <div className="bg-white rounded-xl shadow overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {['ID', 'Name', 'Class', 'Bus', 'Stop', 'Fee Status', 'Action'].map((h) => (
                        <th key={h} className="text-left p-3 font-semibold text-slate-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((s) => {
                      const feeDetails = getFeeStatusDetails(s);
                      const badgeBgClass = feeDetails.status === 'EXPIRED'
                        ? 'bg-due'
                        : feeDetails.status === 'EXPIRING_SOON'
                        ? 'bg-amber-500 animate-pulse'
                        : 'bg-paid';
                      return (
                        <tr key={s.student_id} className="border-t hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedStudentForManage(s)}>
                          <td className="p-3">{s.student_id}</td>
                          <td className="p-3 font-medium">{s.name}</td>
                          <td className="p-3">{s.class}</td>
                          <td className="p-3">{formatBusNumber(s.bus_number)}</td>
                          <td className="p-3">{s.stop_name}</td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold text-white ${badgeBgClass}`}>
                              {feeDetails.label}
                            </span>
                          </td>
                          <td className="p-3 text-primary text-xs font-semibold">Manage</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'buses' && (
            <div>
              <div className="flex justify-between items-center mb-3">
                <p className="text-sm text-slate-500">Live locations update every 10 seconds</p>
                {['admin', 'bus_incharge'].includes(auth.role) && (
                  <button
                    onClick={() => setShowAddBus(true)}
                    className="bg-primary hover:bg-primary/95 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1"
                  >
                    ➕ Add New Bus
                  </button>
                )}
              </div>
              <BusMap buses={buses} className="w-full h-[500px]" />
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                {buses.map((b) => (
                  <div key={b.bus_number} className="bg-white rounded-lg p-3 shadow text-sm">
                    <div className="flex justify-between items-center">
                      <p className="font-bold">{formatBusNumber(b.bus_number)}</p>
                      {['admin', 'bus_incharge'].includes(auth.role) && (
                        <button onClick={() => setSelectedBusForEdit(b)} className="text-xs text-primary font-bold">Edit</button>
                      )}
                    </div>
                    <p className="text-slate-500">{b.driver_name}</p>
                    {b.current_stop && (
                      <p className="text-[11px] text-emerald-600 font-bold mt-1">Crossed: {b.current_stop}</p>
                    )}
                    {b.next_stop && (
                      <p className="text-[11px] text-blue-600 font-bold mt-0.5">Next: {b.next_stop}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">
                      {b.last_updated ? new Date(b.last_updated).toLocaleString() : 'No location'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'reassignment' && (
            <div className="max-w-2xl">
              <div className="bg-white rounded-xl shadow p-6 mb-6">
                <h2 className="font-bold text-xl mb-4">Bus Reassignment</h2>
                <form onSubmit={handleReassignSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold mb-1">Target Bus</label>
                      <input
                        type="text"
                        placeholder="e.g. Bus 1"
                        value={reassignForm.bus_number}
                        onChange={(e) => setReassignForm({...reassignForm, bus_number: e.target.value})}
                        className="w-full border rounded p-2"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Temp Driver Name</label>
                      <input
                        type="text"
                        value={reassignForm.temp_driver}
                        onChange={(e) => setReassignForm({...reassignForm, temp_driver: e.target.value})}
                        className="w-full border rounded p-2"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold mb-1">Driver Phone</label>
                      <input
                        type="tel"
                        value={reassignForm.temp_driver_phone}
                        onChange={(e) => setReassignForm({...reassignForm, temp_driver_phone: e.target.value})}
                        className="w-full border rounded p-2"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Temp Driver Bus (Login)</label>
                      <input
                        type="text"
                        placeholder="e.g. Bus 12"
                        value={reassignForm.temp_driver_bus}
                        onChange={(e) => setReassignForm({...reassignForm, temp_driver_bus: e.target.value})}
                        className="w-full border rounded p-2"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Reason</label>
                    <input
                      type="text"
                      value={reassignForm.reason}
                      onChange={(e) => setReassignForm({...reassignForm, reason: e.target.value})}
                      className="w-full border rounded p-2"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 items-end">
                    <div>
                      <label className="block text-sm font-semibold mb-1">End Date</label>
                      <input
                        type="date"
                        value={reassignForm.end_date}
                        onChange={(e) => setReassignForm({...reassignForm, end_date: e.target.value})}
                        className="w-full border rounded p-2"
                        required
                        min={todayStr()}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={reassignSubmitting}
                      className="bg-primary text-white font-bold py-2 px-4 rounded w-full disabled:opacity-50"
                    >
                      {reassignSubmitting ? 'Saving...' : 'Create Reassignment'}
                    </button>
                  </div>
                </form>
              </div>

              <div className="bg-white rounded-xl shadow overflow-x-auto">
                <h3 className="font-bold text-lg p-4 border-b bg-slate-50">Active Reassignments</h3>
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left p-3 font-semibold text-slate-600">Original Bus</th>
                      <th className="text-left p-3 font-semibold text-slate-600">Temp Bus</th>
                      <th className="text-left p-3 font-semibold text-slate-600">Temp Driver Name</th>
                      <th className="text-left p-3 font-semibold text-slate-600">Temp Driver Phone</th>
                      <th className="text-left p-3 font-semibold text-slate-600">Reason</th>
                      <th className="text-left p-3 font-semibold text-slate-600">Valid Until</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {stats?.activeReassignments?.length > 0 ? (
                      stats.activeReassignments.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="p-3 font-bold">{r.bus_number}</td>
                          <td className="p-3 font-bold text-primary">{r.temp_driver_bus}</td>
                          <td className="p-3">{r.temp_driver}</td>
                          <td className="p-3">{r.temp_driver_phone}</td>
                          <td className="p-3 text-slate-500 italic">"{r.reason}"</td>
                          <td className="p-3">
                            <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              {r.end_date}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="p-6 text-center text-slate-500">No active reassignments</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'incidents' && (
            <div className="bg-white rounded-xl shadow overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {['Time', 'Level', 'Bus', 'Details'].map(h => (
                      <th key={h} className="text-left p-3 font-semibold text-slate-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {incidents.map((inc, i) => (
                    <tr key={i} className={`hover:bg-slate-50 ${inc.level === 'CRITICAL' ? 'bg-red-50' : inc.level === 'WARNING' ? 'bg-amber-50' : ''}`}>
                      <td className="p-3">{new Date(inc.timestamp).toLocaleString()}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${inc.level === 'CRITICAL' ? 'bg-red-500 text-white' : inc.level === 'WARNING' ? 'bg-amber-500 text-white' : 'bg-slate-200'}`}>
                          {inc.level}
                        </span>
                      </td>
                      <td className="p-3">{inc.bus_number}</td>
                      <td className="p-3">{inc.details}</td>
                    </tr>
                  ))}
                  {!incidents.length && (
                    <tr><td colSpan={4} className="p-6 text-center text-slate-500">No incidents found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'lookup' && (
            <div className="bg-white rounded-xl shadow p-6">
              <StudentLookup auth={auth} />
            </div>
          )}

          {activeTab === 'fuel_odometer' && (
            <div className="space-y-6 text-left">
              {/* Bus Cards Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {buses.map(bus => {
                  const bNumber = bus.bus_number;
                  const bStats = odoStats.stats[bNumber] || {
                    currentOdometer: 0,
                    lastRefuelDate: null,
                    daysSinceLastRefuel: null,
                    mileage: 0,
                    totalLogs: 0
                  };

                  // Check if warning is needed (e.g. no refuels in > 7 days)
                  const warningOdo = bStats.daysSinceLastRefuel != null && bStats.daysSinceLastRefuel > 7;
                  
                  return (
                    <div key={bNumber} className="bg-white rounded-xl shadow p-5 border-l-4 border-l-primary relative overflow-hidden">
                      {warningOdo && (
                        <div className="absolute top-2 right-2 bg-rose-50 text-rose-600 font-bold px-2 py-0.5 rounded text-[10px] animate-pulse">
                          ⚠️ Needs Fueling
                        </div>
                      )}
                      <h4 className="font-bold text-slate-800 text-lg mb-1">{bNumber}</h4>
                      <p className="text-xs text-slate-400 mb-4">Route: {bus.route_name || 'N/A'}</p>
                      
                      <div className="grid grid-cols-2 gap-x-2 gap-y-3 text-xs">
                        <div>
                          <span className="text-slate-400 block mb-0.5">Current Odo</span>
                          <span className="font-bold text-slate-700 text-sm">{bStats.currentOdometer || 'N/A'} km</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block mb-0.5">Mileage</span>
                          <span className="font-bold text-slate-700 text-sm">
                            {bStats.mileage ? `${bStats.mileage} km/L` : 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block mb-0.5">Last Refuel</span>
                          <span className="font-bold text-slate-700 text-sm text-slate-600">{bStats.lastRefuelDate || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block mb-0.5">Days Since Refuel</span>
                          <span className="font-bold text-slate-700 text-sm text-slate-600">
                            {bStats.daysSinceLastRefuel != null 
                              ? `${bStats.daysSinceLastRefuel} days` 
                              : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Log History */}
              <div className="bg-white rounded-xl shadow overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h3 className="font-bold text-slate-700">Fuel & Odometer Logs</h3>
                  <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-500 rounded">
                    Last 100 entries
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-slate-50 text-slate-400 font-bold border-b">
                      <tr>
                        <th className="p-4">Date / Time</th>
                        <th className="p-4">Bus</th>
                        <th className="p-4">Logged By</th>
                        <th className="p-4">Reason</th>
                        <th className="p-4">Reading</th>
                        <th className="p-4">Liters Filled</th>
                        <th className="p-4">Refueled</th>
                        <th className="p-4 text-center">Photo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {odoStats.logs.map((log, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/30 text-slate-700">
                          <td className="p-4 text-xs">
                            {new Date(log.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                          </td>
                          <td className="p-4 font-semibold">{log.bus_number}</td>
                          <td className="p-4 text-xs text-slate-500">{log.logged_by}</td>
                          <td className="p-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              log.reason === 'Fuel' ? 'bg-emerald-50 text-emerald-700' :
                              log.reason.includes('pickup') ? 'bg-amber-50 text-amber-700' :
                              log.reason.includes('drop off') ? 'bg-blue-50 text-blue-700' :
                              'bg-slate-50 text-slate-600'
                            }`}>
                              {log.reason}
                            </span>
                          </td>
                          <td className="p-4 font-mono font-semibold">{log.reading} km</td>
                          <td className="p-4 font-mono">{log.liters != null ? `${log.liters} L` : '-'}</td>
                          <td className="p-4">
                            {log.refueled ? (
                              <span className="text-emerald-600 font-bold">✓</span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            {log.photo_url ? (
                              <a
                                href={log.photo_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:underline text-xs font-semibold flex items-center justify-center gap-1"
                              >
                                🖼️ View
                              </a>
                            ) : (
                              <span className="text-slate-300 text-xs">No image</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {!odoStats.logs.length && (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-400">
                            No odometer or fuel logs have been submitted yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'route_stops' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
              {/* Add Stop Form */}
              <div className="bg-white rounded-xl shadow p-5 border border-slate-200 h-fit animate-fadeIn">
                <h3 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-1.5">
                  📍 Add Route Stop
                </h3>
                <form onSubmit={handleAddStopSubmit} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Select Bus</label>
                    <select
                      required
                      value={newStop.bus_number}
                      onChange={(e) => setNewStop({ ...newStop, bus_number: e.target.value })}
                      className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none"
                    >
                      <option value="">-- Choose Bus --</option>
                      {buses.map(b => (
                        <option key={b.bus_number} value={b.bus_number}>Bus {b.bus_number}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Stop Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Padmavathi Colony"
                      value={newStop.stop_name}
                      onChange={(e) => setNewStop({ ...newStop, stop_name: e.target.value })}
                      className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none"
                    />
                  </div>

                  {/* Search Location from Maps */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                    <span className="text-xs font-bold text-slate-600 block">🔍 Search Location / Address</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Search area (e.g. RTC Bus Stand)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1 text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleMapSearch}
                        disabled={searchingMap}
                        className="bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs px-3 py-1.5 rounded-lg transition"
                      >
                        {searchingMap ? 'Searching...' : 'Search'}
                      </button>
                    </div>

                    {searchResults.length > 0 && (
                      <div className="bg-white border border-slate-200 rounded-lg max-h-[150px] overflow-y-auto divide-y text-xs shadow-lg">
                        {searchResults.map((res, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handleSelectSearchResult(res)}
                            className="w-full text-left p-2.5 hover:bg-slate-50 font-medium block truncate text-slate-700"
                          >
                            📍 {res.display_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Current Location Button */}
                  <div>
                    <button
                      type="button"
                      onClick={handleUseCurrentLocation}
                      className="w-full bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 transition"
                    >
                      📍 Use My Current Location
                    </button>
                  </div>

                  {/* Map Coordinates Picker */}
                  <StopMapPicker
                    lat={newStop.latitude}
                    lng={newStop.longitude}
                    onChange={(lat, lng) => setNewStop(prev => ({ ...prev, latitude: lat, longitude: lng }))}
                  />

                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Sequence (Order)</label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="e.g. 1 (first stop)"
                      value={newStop.sequence}
                      onChange={(e) => setNewStop({ ...newStop, sequence: e.target.value })}
                      className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submittingStop}
                    className="w-full bg-primary hover:bg-primary/95 text-white font-bold py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-1.5"
                  >
                    {submittingStop ? <Spinner size="sm" /> : '📍 Save Stop Location'}
                  </button>
                </form>
              </div>

              {/* Stops List */}
              <div className="lg:col-span-2 space-y-4">
                {buses.map(bus => {
                  const busStops = stops
                    .filter(s => String(s.bus_number) === String(bus.bus_number))
                    .sort((a, b) => Number(a.sequence) - Number(b.sequence));

                  return (
                    <div key={bus.bus_number} className="bg-white rounded-xl shadow overflow-hidden border border-slate-100">
                      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <div>
                          <h4 className="font-bold text-slate-800">Bus {bus.bus_number} Route Stops</h4>
                          <span className="text-xs text-slate-400">Route: {bus.route_name || 'N/A'}</span>
                        </div>
                        <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">
                          {busStops.length} stops configured
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="text-xs uppercase bg-slate-50 text-slate-400 font-bold border-b">
                            <tr>
                              <th className="p-4 w-12 text-center">Seq</th>
                              <th className="p-4">Stop Name</th>
                              <th className="p-4">Coordinates</th>
                              <th className="p-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {busStops.map((stop) => (
                              <tr key={stop.id} className="hover:bg-slate-50/30 text-slate-700">
                                <td className="p-4 text-center font-bold font-mono bg-slate-50/50 w-12">{stop.sequence}</td>
                                <td className="p-4 font-semibold text-slate-800">{stop.stop_name}</td>
                                <td className="p-4 font-mono text-xs text-slate-500">{stop.latitude}, {stop.longitude}</td>
                                <td className="p-4 text-right">
                                  <button
                                    onClick={() => handleDeleteStopClick(stop.id, stop.stop_name)}
                                    className="text-xs text-red-500 hover:text-red-700 font-bold hover:underline"
                                  >
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {!busStops.length && (
                              <tr>
                                <td colSpan={4} className="p-6 text-center text-slate-400 text-xs">
                                  No stops configured for Bus {bus.bus_number} yet.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'manage_credentials' && (
            <div className="bg-white rounded-xl shadow p-6">
              <ManageCredentials auth={auth} />
            </div>
          )}

        </div>
      )}
      {showAddStudent && (
        <AddStudentModal
          buses={buses}
          onClose={() => setShowAddStudent(false)}
          onSave={handleAddStudent}
        />
      )}
      
      {selectedStudentForManage && (
        <ManageStudentModal
          student={selectedStudentForManage}
          auth={auth}
          onClose={() => setSelectedStudentForManage(null)}
          onUpdateFee={() => { setSelectedStudentForFee(selectedStudentForManage); setSelectedStudentForManage(null); }}
          onChangeBus={() => { setSelectedStudentForBus(selectedStudentForManage); setSelectedStudentForManage(null); }}
          onGenerateQR={() => { handleGenerateQR(selectedStudentForManage); setSelectedStudentForManage(null); }}
          onDeleteStudent={handleDeleteStudent}
          onDownloadQR={() => handleDownloadQR(selectedStudentForManage)}
          onAssignQR={() => { setSelectedStudentForQr(selectedStudentForManage); setSelectedStudentForManage(null); }}
        />
      )}

      {selectedStudentForQr && (
        <AssignQrModal
          student={selectedStudentForQr}
          onClose={() => setSelectedStudentForQr(null)}
          onSave={handleAssignQr}
        />
      )}
      
      {selectedStudentForBus && (
        <ChangeBusModal
          student={selectedStudentForBus}
          buses={buses}
          onClose={() => setSelectedStudentForBus(null)}
          onSave={handleChangeBus}
        />
      )}

      {selectedStudentForFee && (
        <UpdatePaymentModal
          student={selectedStudentForFee}
          onClose={() => setSelectedStudentForFee(null)}
          onSave={handleUpdateFee}
        />
      )}
      {selectedBusForEdit && (
        <EditBusModal
          bus={selectedBusForEdit}
          onClose={() => setSelectedBusForEdit(null)}
          onSave={handleEditBus}
        />
      )}

      {showAddBus && (
        <AddBusModal
          onClose={() => setShowAddBus(false)}
          onSave={handleAddBus}
        />
      )}
    </div>
  );
}