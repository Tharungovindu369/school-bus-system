import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { api, todayStr, exportCSV } from '../api';
import Spinner from '../components/Spinner';
import BusMap from '../components/BusMap';
import ManageCredentials from '../components/ManageCredentials';
import StudentLookup from '../components/StudentLookup';





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

function ManageStudentModal({ student, auth, onClose, onUpdateFee, onChangeBus, onGenerateQR }) {
  const role = auth?.role || (typeof auth === 'string' ? 'admin' : '');
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-xl font-bold mb-1">{student.name}</h3>
        <p className="text-sm text-slate-500 mb-4">{student.student_id} • Bus {student.bus_number}</p>
        
        <div className="space-y-3">
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
          {role === 'admin' && (
            <button onClick={onGenerateQR} className="w-full p-3 border rounded-lg text-left hover:bg-slate-50 font-semibold flex items-center justify-between text-primary">
              Generate QR Code <span>➔</span>
            </button>
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
        <p className="text-sm text-slate-500 mb-2">Current status: <span className={`font-bold ${(student.fee_status||'').toUpperCase()==='DUE'?'text-red-500':'text-green-600'}`}>{student.fee_status || 'DUE'}</span></p>
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
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [selectedBusForEdit, setSelectedBusForEdit] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [reassignForm, setReassignForm] = useState({ bus_number: '', temp_driver: '', temp_driver_phone: '', temp_driver_bus: '', reason: '', end_date: '' });
  const [reassignSubmitting, setReassignSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feeFilter, setFeeFilter] = useState('ALL');
  const [busFilter, setBusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const feeUpdateLock = useRef(false);

  const loadData = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    try {
      const [dash, studs, att, busList, incs, reass] = await Promise.all([
        api.getDashboard(auth).catch(() => null),
        ['admin', 'accountant', 'bus_incharge'].includes(auth.role) ? api.getStudents(auth).catch(() => []) : Promise.resolve([]),
        auth.role === 'admin' ? api.getAttendance(todayStr(), auth).catch(() => []) : Promise.resolve([]),
        ['admin', 'bus_incharge'].includes(auth.role) ? api.getBuses(auth).catch(() => []) : Promise.resolve([]),
        auth.role === 'admin' ? api.getIncidents(auth).catch(() => []) : Promise.resolve([]),
        ['admin', 'bus_incharge'].includes(auth.role) ? api.getActiveReassignments(auth).catch(() => []) : Promise.resolve([])
      ]);
      if (dash) setStats({ ...dash, activeReassignments: reass });
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
    const interval = setInterval(loadData, 30000);
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
  
  const handleEditBus = async (busNumber, driverName, driverPhone) => {
    try {
      await api.updateBusDriver(busNumber, driverName, driverPhone, auth);
      toast.success('Bus driver updated');
      loadData();
    } catch (err) {
      toast.error(err.message);
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
    if (feeFilter === 'ALL') return true;
    return (s.fee_status || '').toUpperCase() === feeFilter;
  });

  if (!auth) return <AdminLogin onLogin={setAuth} />;

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-primary text-white p-4 shadow flex justify-between items-center">
        <h1 className="text-xl font-bold">Admin Dashboard ({auth.role})</h1>
        <button
          onClick={() => { sessionStorage.removeItem('admin_auth'); setAuth(null); }}
          className="text-sm bg-white/20 px-3 py-1 rounded-lg"
        >
          Logout
        </button>
      </header>

      <div className="flex overflow-x-auto bg-white border-b">
        {(()=>{
          let t = [];
          if (auth.role === 'admin') t = ['overview', 'attendance', 'students', 'buses', 'reassignment', 'incidents', 'lookup', 'manage_credentials'];
          if (auth.role === 'accountant') t = ['overview', 'students'];
          if (auth.role === 'bus_incharge') t = ['overview', 'buses', 'reassignment'];
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
                        <td className="p-3">Bus {a.bus_number}</td>
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
              <div className="flex flex-wrap gap-2 mb-4 items-center">
                {['admin', 'bus_incharge'].includes(auth?.role || (typeof auth === 'string' ? 'admin' : '')) && (
                  <button onClick={() => setShowAddStudent(true)} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold mr-4">
                    + Add Student
                  </button>
                )}
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
                {busFilter !== 'ALL' && (
                  <button
                    onClick={() => handlePrintBusQR(busFilter)}
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                    title={`Print QR labels for Bus ${busFilter} only`}
                  >
                    🖨️ Print Bus {busFilter} QR
                  </button>
                )}
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
                      const isPaid = (s.fee_status || '').toUpperCase() === 'PAID';
                      return (
                        <tr key={s.student_id} className="border-t hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedStudentForManage(s)}>
                          <td className="p-3">{s.student_id}</td>
                          <td className="p-3 font-medium">{s.name}</td>
                          <td className="p-3">{s.class}</td>
                          <td className="p-3">Bus {s.bus_number}</td>
                          <td className="p-3">{s.stop_name}</td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold text-white ${isPaid ? 'bg-paid' : 'bg-due'}`}>
                              {s.fee_status || 'DUE'}
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
              <p className="text-sm text-slate-500 mb-3">Live locations update every 30 seconds</p>
              <BusMap buses={buses} className="w-full h-[500px]" />
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                {buses.map((b) => (
                  <div key={b.bus_number} className="bg-white rounded-lg p-3 shadow text-sm">
                    <div className="flex justify-between items-center">
                      <p className="font-bold">Bus {b.bus_number}</p>
                      {['admin', 'bus_incharge'].includes(auth.role) && (
                        <button onClick={() => setSelectedBusForEdit(b)} className="text-xs text-primary font-bold">Edit</button>
                      )}
                    </div>
                    <p className="text-slate-500">{b.driver_name}</p>
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
    </div>
  );
}