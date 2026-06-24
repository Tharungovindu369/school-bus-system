Created At: 2026-06-21T07:16:38Z
Completed At: 2026-06-21T07:17:04Z
The following changes were made by the multi_replace_file_content tool to: D:\school-bus-system\client\src\pages\AdminDashboard.jsx. If relevant, proactively run terminal commands to execute this code for the USER. Don't ask for permission.
[diff_block_start]
@@ -171,602 +171,855 @@
             </button>
             <button
               onClick={handleSave}
-              disabled={loading}
-              className="flex-1 bg-primary hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition flex justify-center items-center"
-            >
-              {loading ? <Spinner size="sm" /> : 'Save Payment'}
-            </button>
-          </div>
-        </div>
-      </div>
-    </div>
-  );
-}
-
-function AdminLogin({ onLogin }) {
-  const [password, setPassword] = useState('');
-  const [loading, setLoading] = useState(false);
-
-  const handleSubmit = async (e) => {
-    e.preventDefault();
-    setLoading(true);
-    try {
-      await api.adminLogin(password);
-      sessionStorage.setItem('admin_pw', password);
-      onLogin(password);
-      toast.success('Welcome, Admin');
-    } catch {
-      toast.error('Invalid password');
-    } finally {
-      setLoading(false);
-    }
-  };
-
-  return (
-    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
-      <h1 className="text-2xl font-bold text-white mb-6">Admin Dashboard</h1>
-      <form onSubmit={handleSubmit} className="w-full max-w-sm">
-        <input
-          type="password"
-          value={password}
-          onChange={(e) => setPassword(e.target.value)}
-          placeholder="Admin Password"
-          className="w-full p-4 rounded-xl text-lg mb-4"
-          required
-        />
-        <button
-          type="submit"
-          disabled={loading}
-          className="w-full bg-primary text-white font-bold py-4 rounded-xl disabled:opacity-50 flex justify-center"
-        >
-          {loading ? <Spinner size="sm" /> : 'Login'}
-        </button>
-      </form>
-    </div>
-  );
-}
-
-function StatCard({ label, value, color = 'primary' }) {
-  const colors = {
-    primary: 'bg-primary',
-    green: 'bg-paid',
-    red: 'bg-due',
-    purple: 'bg-purple-600',
-  };
-  return (
-    <div className={`${colors[color]} text-white rounded-xl p-4 shadow`}>
-      <p className="text-sm opacity-80">{label}</p>
-      <p className="text-3xl font-bold mt-1">{value}</p>
-    </div>
-  );
-}
-
-export default function AdminDashboard() {
-  const [password, setPassword] = useState(() => sessionStorage.getItem('admin_pw'));
-  const [stats, setStats] = useState(null);
-  const [students, setStudents] = useState([]);
-  const [attendance, setAttendance] = useState([]);
-  const [buses, setBuses] = useState([]);
-  const [loading, setLoading] = useState(true);
-  const [feeFilter, setFeeFilter] = useState('ALL');
-  const [busFilter, setBusFilter] = useState('');
-  const [search, setSearch] = useState('');
-  const [activeTab, setActiveTab] = useState('overview');
-
-  const [studentsSearch, setStudentsSearch] = useState('');
-  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());
-  const [showBulkFeeModal, setShowBulkFeeModal] = useState(false);
+import { useState, useEffect, useCallback } from 'react';
+import toast from 'react-hot-toast';
+import { api, todayStr, exportCSV } from '../api';
+import { formatBusNumber, busesMatch, isFeeDue } from '../utils';
+import Spinner from '../components/Spinner';
+import BusMap from '../components/BusMap';
+import ManageCredentials from '../components/ManageCredentials';
+import StudentLookup from '../components/StudentLookup';
+
+function UpdateFeeModal({ student, onClose, onSave }) {
+  const [option, setOption] = useState('1');
+  const [customDate, setCustomDate] = useState('');
+  const [loading, setLoading] = useState(false);
+
+  const handleSave = async () => {
+    setLoading(true);
+    try {
+      const payload = {};
+      if (option === 'due') {
+        payload.mark_due = true;
+      } else if (option === 'custom') {
+        if (!customDate) {
+          toast.error('Please select a custom date');
+          setLoading(false);
+          return;
+        }
+        payload.custom_date = customDate;
+      } else {
+        payload.duration_months = parseInt(option, 10);
+      }
+      await onSave(student.student_id, payload);
+      onClose();
+    } catch (err) {
+      toast.error(err.message);
+    } finally {
+      setLoading(false);
+    }
+  };
+
+  return (
+    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
+      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
+        <div className="bg-primary p-6 text-white text-center">
+          <h2 className="text-2xl font-bold">Update Payment</h2>
+          <p className="opacity-90">{student.name} ({student.student_id})</p>
+        </div>
+        
+        <div className="p-6 space-y-5">
+          <div>
+            <label className="block text-sm font-bold text-slate-700 mb-2">Payment Duration</label>
+            <select
+              value={option}
+              onChange={(e) => setOption(e.target.value)}
+              className="w-full border-2 border-slate-200 rounded-xl p-3 text-slate-700 font-semibold focus:border-primary outline-none"
+            >
+              <option value="1">1 Month</option>
+              <option value="3">3 Months</option>
+              <option value="6">6 Months</option>
+              <option value="12">12 Months (1 Year)</option>
+              <option value="custom">Custom Due Date...</option>
+              <option value="due">Mark as DUE</option>
+            </select>
+          </div>
+
+          {option === 'custom' && (
+            <div>
+              <label className="block text-sm font-bold text-slate-700 mb-2">Custom Due Date</label>
+              <input
+                type="date"
+                value={customDate}
+                onChange={(e) => setCustomDate(e.target.value)}
+                className="w-full border-2 border-slate-200 rounded-xl p-3 text-slate-700 font-semibold focus:border-primary outline-none"
+              />
+            </div>
+          )}
+
+          <div className="flex gap-3 pt-4">
+            <button
+              onClick={onClose}
+              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-xl transition"
+            >
+              Cancel
+            </button>
+            <button
+              onClick={handleSave}
+              disabled={loading}
+              className="flex-1 bg-primary hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition flex justify-center items-center"
+            >
+              {loading ? <Spinner size="sm" /> : 'Save Payment'}
+            </button>
+          </div>
+        </div>
+      </div>
+    </div>
+  );
+}
+
+function BulkUpdateFeeModal({ studentIds, onClose, onSave }) {
+  const [option, setOption] = useState('1');
+  const [customDate, setCustomDate] = useState('');
+  const [loading, setLoading] = useState(false);
+
+  const handleSave = async () => {
+    setLoading(true);
+    try {
+      const payload = { student_ids: Array.from(studentIds) };
+      if (option === 'due') {
+        payload.mark_due = true;
+      } else if (option === 'custom') {
+        if (!customDate) {
+          toast.error('Please select a custom date');
+          setLoading(false);
+          return;
+        }
+        payload.custom_date = customDate;
+      } else {
+        payload.duration_months = parseInt(option, 10);
+      }
+      await onSave(payload);
+      onClose();
+    } catch (err) {
+      toast.error(err.message);
+    } finally {
+      setLoading(false);
+    }
+  };
+
+  return (
+    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
+      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
+        <div className="bg-primary p-6 text-white text-center">
+          <h2 className="text-2xl font-bold">Bulk Update Payment</h2>
+          <p className="opacity-90">Updating {studentIds.size} students</p>
+        </div>
+        
+        <div className="p-6 space-y-5">
+          <div>
+            <label className="block text-sm font-bold text-slate-700 mb-2">Payment Duration</label>
+            <select
+              value={option}
+              onChange={(e) => setOption(e.target.value)}
+              className="w-full border-2 border-slate-200 rounded-xl p-3 text-slate-700 font-semibold focus:border-primary outline-none"
+            >
+              <option value="1">1 Month</option>
+              <option value="3">3 Months</option>
+              <option value="6">6 Months</option>
+              <option value="12">12 Months (1 Year)</option>
+              <option value="custom">Custom Due Date...</option>
+              <option value="due">Mark as DUE</option>
+            </select>
+          </div>
+
+          {option === 'custom' && (
+            <div>
+              <label className="block text-sm font-bold text-slate-700 mb-2">Custom Due Date</label>
+              <input
+                type="date"
+                value={customDate}
+                onChange={(e) => setCustomDate(e.target.value)}
+                className="w-full border-2 border-slate-200 rounded-xl p-3 text-slate-700 font-semibold focus:border-primary outline-none"
+              />
+            </div>
+          )}
+
+          <div className="flex gap-3 pt-4">
+            <button
+              onClick={onClose}
+              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-xl transition"
+            >
+              Cancel
+            </button>
+            <button
+              onClick={handleSave}
+              disabled={loading}
+              className="flex-1 bg-primary hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition flex justify-center items-center"
+            >
+              {loading ? <Spinner size="sm" /> : 'Save Payment'}
+            </button>
+          </div>
+        </div>
+      </div>
+    </div>
+  );
+}
+
+function EditDriverModal({ bus, onClose, onSave }) {
+  const [name, setName] = useState(bus.driver_name || '');
+  const [phone, setPhone] = useState(bus.driver_phone || '');
+  const [loading, setLoading] = useState(false);
+
+  const handleSave = async () => {
+    setLoading(true);
+    try {
+      await onSave(bus.bus_number, { driver_name: name, driver_phone: phone });
+      onClose();
+    } catch (err) {
+      toast.error(err.message);
+    } finally {
+      setLoading(false);
+    }
+  };
+
+  return (
+    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
+      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
+        <div className="bg-primary p-6 text-white text-center">
+          <h2 className="text-2xl font-bold">Edit Driver Details</h2>
+          <p className="opacity-90">Bus {bus.bus_number}</p>
+        </div>
+        
+        <div className="p-6 space-y-4">
+          <div>
+            <label className="block text-sm font-bold text-slate-700 mb-1">Driver Name</label>
+            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full border-2 border-slate-200 rounded-xl p-3 text-slate-700 font-semibold focus:border-primary outline-none" />
+          </div>
+          <div>
+            <label className="block text-sm font-bold text-slate-700 mb-1">Driver Phone</label>
+            <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border-2 border-slate-200 rounded-xl p-3 text-slate-700 font-semibold focus:border-primary outline-none" />
+          </div>
+          <div className="flex gap-3 pt-4">
+            <button onClick={onClose} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-xl">Cancel</button>
+            <button onClick={handleSave} disabled={loading} className="flex-1 bg-primary hover:bg-blue-700 text-white font-semibold py-3 rounded-xl flex justify-center items-center">
+              {loading ? <Spinner size="sm" /> : 'Save Details'}
+            </button>
+          </div>
+        </div>
+      </div>
+    </div>
+  );
+}
+
+function AdminLogin({ onLogin }) {
+  const [password, setPassword] = useState('');
+  const [loading, setLoading] = useState(false);
+
+  const handleSubmit = async (e) => {
+    e.preventDefault();
+    setLoading(true);
+    try {
+      await api.adminLogin(password);
+      sessionStorage.setItem('admin_pw', password);
+      onLogin(password);
+      toast.success('Welcome, Admin');
+    } catch {
+      toast.error('Invalid password');
+    } finally {
+      setLoading(false);
+    }
+  };
+
+  return (
+    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
+      <h1 className="text-2xl font-bold text-white mb-6">Admin Dashboard</h1>
+      <form onSubmit={handleSubmit} className="w-full max-w-sm">
+        <input
+          type="password"
+          value={password}
+          onChange={(e) => setPassword(e.target.value)}
+          placeholder="Admin Password"
+          className="w-full p-4 rounded-xl text-lg mb-4"
+          required
+        />
+        <button
+          type="submit"
+          disabled={loading}
+          className="w-full bg-primary text-white font-bold py-4 rounded-xl disabled:opacity-50 flex justify-center"
+        >
+          {loading ? <Spinner size="sm" /> : 'Login'}
+        </button>
+      </form>
+    </div>
+  );
+}
+
+function StatCard({ label, value, color = 'primary' }) {
+  const colors = {
+    primary: 'bg-primary',
+    green: 'bg-paid',
+    red: 'bg-due',
+    purple: 'bg-purple-600',
+  };
+  return (
+    <div className={`${colors[color]} text-white rounded-xl p-4 shadow`}>
+      <p className="text-sm opacity-80">{label}</p>
+      <p className="text-3xl font-bold mt-1">{value}</p>
+    </div>
+  );
+}
+
+export default function AdminDashboard() {
+  const [password, setPassword] = useState(() => sessionStorage.getItem('admin_pw'));
+  const [stats, setStats] = useState(null);
+  const [students, setStudents] = useState([]);
+  const [attendance, setAttendance] = useState([]);
+  const [buses, setBuses] = useState([]);
+  const [loading, setLoading] = useState(true);
+  const [feeFilter, setFeeFilter] = useState('ALL');
+  const [busFilter, setBusFilter] = useState('');
+  const [search, setSearch] = useState('');
+  const [activeTab, setActiveTab] = useState('overview');
+
+  const [studentsSearch, setStudentsSearch] = useState('');
+  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());
+  const [showBulkFeeModal, setShowBulkFeeModal] = useState(false);
   const [selectedStudentForBusChange, setSelectedStudentForBusChange] = useState(null);
   const [selectedStudentForLookup, setSelectedStudentForLookup] = useState(null);
-  const [lookupPinInput, setLookupPinInput] = useState('');
-  const [showReassignModal, setShowReassignModal] = useState(false);
-  const [selectedStudentForPayment, setSelectedStudentForPayment] = useState(null);
-
-  const [currentPage, setCurrentPage] = useState(1);
-  const itemsPerPage = 50;
-
-  const [incidents, setIncidents] = useState([]);
-  const [reassignments, setReassignments] = useState([]);
-
-  const loadData = useCallback(async () => {
-    if (!password) return;
-    setLoading(true);
-    try {
-      const [dash, studs, att, busList, incs, reassigns] = await Promise.all([
-        api.getDashboard(password),
-        api.getStudents(),
-        api.getAttendance(todayStr()),
-        api.getBuses(),
-        api.getIncidents(password),
-        api.getActiveReassignments(password),
-      ]);
-      setStats(dash);
-      setStudents(studs);
-      setAttendance(att);
-      setBuses(busList);
-      setIncidents(incs);
-      setReassignments(reassigns);
-    } catch (err) {
-      toast.error(err.message);
-      if (err.message.includes('Unauthorized')) {
-        sessionStorage.removeItem('admin_pw');
-        setPassword(null);
-      }
-    } finally {
-      setLoading(false);
-    }
-  }, [password]);
-
-  useEffect(() => {
-    loadData();
-    const interval = setInterval(loadData, 30000);
-    return () => clearInterval(interval);
-  }, [loadData]);
-
-  const handleSavePayment = async (studentId, payload) => {
-    try {
-      await api.updateFee(studentId, payload, password);
-      toast.success('Payment updated successfully!');
-      loadData();
-    } catch (err) {
-      toast.error(err.message);
-    }
-  };
-
-  const exportTodayCSV = () => {
-    const headers = ['timestamp', 'student_id', 'student_name', 'bus_number', 'stop_name', 'boarded_at', 'driver_name', 'date'];
-    exportCSV(`attendance_${todayStr()}.csv`, filteredAttendance, headers);
-    toast.success('CSV downloaded');
-  };
-
-  const exportUnpaidCSV = () => {
-    const unpaid = students.filter((s) => isFeeDue(s));
-    const headers = ['student_id', 'name', 'class', 'bus_number', 'stop_name', 'parent_name', 'parent_whatsapp', 'fee_paid_until'];
-    exportCSV('unpaid_fees.csv', unpaid, headers);
-    toast.success('Unpaid fees report downloaded');
-  };
-
-  const filteredAttendance = attendance.filter((a) => {
-    const matchBus = !busFilter || String(a.bus_number) === busFilter;
-    const matchSearch = !search ||
-      a.student_name?.toLowerCase().includes(search.toLowerCase()) ||
-      a.student_id?.includes(search);
-    return matchBus && matchSearch;
-  });
-
-  const filteredStudents = students.filter((s) => {
-    const isPaid = !isFeeDue(s);
-    const statusStr = isPaid ? 'PAID' : 'DUE';
-    const matchFee = feeFilter === 'ALL' || statusStr === feeFilter;
-    const matchSearch = !studentsSearch || 
-      s.name?.toLowerCase().includes(studentsSearch.toLowerCase()) || 
-      s.student_id?.includes(studentsSearch) ||
-      s.bus_number?.toLowerCase().includes(studentsSearch.toLowerCase());
-    return matchFee && matchSearch;
-  });
-
-  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
-  const paginatedStudents = filteredStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
-
-  useEffect(() => {
-    setCurrentPage(1);
-  }, [studentsSearch, feeFilter]);
-
-  if (!password) return <AdminLogin onLogin={setPassword} />;
-
-  return (
-    <div className="min-h-screen bg-slate-100">
-      <header className="bg-primary text-white p-4 shadow flex justify-between items-center">
-        <h1 className="text-xl font-bold">Admin Dashboard</h1>
-        <button
-          onClick={() => { sessionStorage.removeItem('admin_pw'); setPassword(null); }}
-          className="text-sm bg-white/20 px-3 py-1 rounded-lg"
-        >
-          Logout
-        </button>
-      </header>
-
-        <div className="flex overflow-x-auto bg-white border-b">
-          {['overview', 'attendance', 'students', 'student_lookup', 'incidents', 'buses', 'reassignment', 'manage_credentials'].map((tab) => (
-            <button
-              key={tab}
-              onClick={() => setActiveTab(tab)}
-              className={`px-4 py-3 text-sm font-semibold capitalize whitespace-nowrap ${
-                activeTab === tab ? 'text-primary border-b-2 border-primary' : 'text-slate-500'
-              }`}
-            >
-              {tab === 'reassignment' ? 'Bus Reassignment' : tab.replace('_', ' ')}
-            </button>
-          ))}
-        </div>
-
-      {loading && !stats ? (
-        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
-      ) : (
-        <div className="p-4 max-w-7xl mx-auto">
-          {activeTab === 'overview' && stats && (
-            <>
-              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
-                <StatCard label="Total Students" value={stats.totalStudents} />
-                <StatCard label="Boarded Today" value={stats.boardedToday} color="green" />
-                <StatCard label="Fee Defaulters" value={stats.feeDefaulters} color="red" />
-                <StatCard label="Active Buses" value={stats.activeBuses} color="purple" />
-              </div>
-              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
-                <div className="bg-white rounded-xl shadow p-4 border-l-4 border-orange-500">
-                  <h3 className="font-bold text-slate-700 mb-2">Cross-Bus Boardings Today</h3>
-                  {stats.crossBusBoardings && stats.crossBusBoardings.length > 0 ? (
-                    <div className="space-y-2">
-                      {stats.crossBusBoardings.map((r, i) => (
-                        <div key={i} className="text-sm bg-slate-50 p-2 rounded">
-                          <span className="font-semibold">{r.student_name}</span> ({r.student_id}) 
-                          boarded <span className="text-orange-600 font-bold">Bus {r.actual_bus}</span> 
-                          (Assigned: Bus {r.assigned_bus}) at {r.boarded_at}
-                        </div>
-                      ))}
-                    </div>
-                  ) : (
-                    <p className="text-sm text-slate-500 italic">No cross-bus boardings today.</p>
-                  )}
-                </div>
-
-                <div className="bg-white rounded-xl shadow p-4 border-l-4 border-blue-500">
-                  <h3 className="font-bold text-slate-700 mb-2">Active Reassignments</h3>
-                  {stats.activeReassignments && stats.activeReassignments.length > 0 ? (
-                    <div className="space-y-2">
-                      {stats.activeReassignments.map((r, i) => (
-                        <div key={i} className="text-sm bg-slate-50 p-2 rounded">
-                          <span className="font-semibold text-blue-700">{r.bus_number}</span> reassigned to 
-                          <span className="font-semibold"> {r.temp_driver}</span> ({r.temp_driver_phone}) 
-                          due to {r.reason}. Ends: {r.end_date}
-                        </div>
-                      ))}
-                    </div>
-                  ) : (
-                    <p className="text-sm text-slate-500 italic">No active bus reassignments.</p>
-                  )}
-                </div>
-              </div>
-            </>
-          )}
-
-          {activeTab === 'attendance' && (
-            <div>
-              <div className="flex flex-wrap gap-2 mb-4">
-                <input
-                  type="text"
-                  placeholder="Search student..."
-                  value={search}
-                  onChange={(e) => setSearch(e.target.value)}
-                  className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[150px]"
-                />
-                <select
-                  value={busFilter}
-                  onChange={(e) => setBusFilter(e.target.value)}
-                  className="border rounded-lg px-3 py-2 text-sm"
-                >
-                  <option value="">All Buses</option>
-                  {Array.from({length: 13}, (_, i) => i + 1).map((b) => (
-                    <option key={b} value={`Bus ${b}`}>Bus {b}</option>
-                  ))}
-                </select>
-                <button
-                  onClick={exportTodayCSV}
-                  className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold"
-                >
-                  Export CSV
-                </button>
-              </div>
-              <div className="bg-white rounded-xl shadow overflow-x-auto">
-                <table className="w-full text-sm">
-                  <thead className="bg-slate-50">
-                    <tr>
-                      {['Time', 'Student', 'Bus', 'Stop', 'Driver'].map((h) => (
-                        <th key={h} className="text-left p-3 font-semibold text-slate-600">{h}</th>
-                      ))}
-                    </tr>
-                  </thead>
-                  <tbody>
-                    {filteredAttendance.map((a, i) => (
-                      <tr key={i} className="border-t hover:bg-slate-50">
-                        <td className="p-3">{a.boarded_at}</td>
-                        <td className="p-3 font-medium">{a.student_name}</td>
-                        <td className="p-3">Bus {a.bus_number}</td>
-                        <td className="p-3">{a.stop_name}</td>
-                        <td className="p-3">{a.driver_name}</td>
-                      </tr>
-                    ))}
-                    {!filteredAttendance.length && (
-                      <tr><td colSpan={5} className="p-6 text-center text-slate-400">No attendance today</td></tr>
-                    )}
-                  </tbody>
-                </table>
-              </div>
-            </div>
-          )}
-
-          {activeTab === 'students' && (
-            <div>
-              <div className="flex flex-wrap gap-2 mb-4 items-center">
-                <input
-                  type="text"
-                  placeholder="Search students..."
-                  value={studentsSearch}
-                  onChange={(e) => setStudentsSearch(e.target.value)}
-                  className="border border-slate-300 rounded px-3 py-2 w-full max-w-sm"
-                />
-                <button
-                  onClick={() => setShowBulkFeeModal(true)}
-                  disabled={selectedStudentIds.size === 0}
-                  className="bg-primary text-white px-4 py-2 rounded shadow disabled:opacity-50 font-semibold"
-                >
-                  Update Fee Status ({selectedStudentIds.size})
-                </button>
-                {['ALL', 'PAID', 'DUE'].map((f) => (
-                  <button
-                    key={f}
-                    onClick={() => setFeeFilter(f)}
-                    className={`px-4 py-2 rounded-lg text-sm font-semibold ${
-                      feeFilter === f
-                        ? f === 'PAID' ? 'bg-paid text-white' : f === 'DUE' ? 'bg-due text-white' : 'bg-primary text-white'
-                        : 'bg-white border text-slate-600'
-                    }`}
-                  >
-                    {f}
-                  </button>
-                ))}
-                <button
-                  onClick={() => setSelectedStudentForBusChange(Array.from(selectedStudentIds))}
-                  disabled={selectedStudentIds.size === 0}
-                  className="bg-primary text-white px-4 py-2 rounded shadow disabled:opacity-50 font-semibold"
-                >
-                  Change Bus ({selectedStudentIds.size})
-                </button>
-                <button
-                  onClick={exportUnpaidCSV}
-                  className="ml-auto bg-due text-white px-4 py-2 rounded-lg text-sm font-semibold"
-                >
-                  Export Unpaid Report
-                </button>
-              </div>
-              <div className="bg-white rounded-xl shadow overflow-x-auto">
-                <table className="w-full text-sm">
-                  <thead className="bg-slate-50">
-                    <tr>
-                      <th className="p-3 w-10">
-                        <input
-                          type="checkbox"
-                          checked={filteredStudents.length > 0 && selectedStudentIds.size === filteredStudents.length}
-                          onChange={(e) => {
-                            if (e.target.checked) {
-                              setSelectedStudentIds(new Set(filteredStudents.map(s => s.student_id)));
-                            } else {
-                              setSelectedStudentIds(new Set());
-                            }
-                          }}
-                        />
-                      </th>
-                      {['ID', 'Name', 'Class', 'Bus', 'Stop', 'Fee Status', 'Action'].map((h) => (
-                        <th key={h} className="text-left p-3 font-semibold text-slate-600">{h}</th>
-                      ))}
-                    </tr>
-                  </thead>
-                  <tbody>
-                    {paginatedStudents.map((s) => {
-                      const isPaid = !isFeeDue(s);
-                      const statusStr = isPaid ? 'PAID' : 'DUE';
-                      return (
-                        <tr key={s.student_id} className="border-t hover:bg-slate-50">
-                          <td className="p-3">
-                            <input
-                              type="checkbox"
-                              checked={selectedStudentIds.has(s.student_id)}
-                              onChange={(e) => {
-                                const newSet = new Set(selectedStudentIds);
-                                if (e.target.checked) newSet.add(s.student_id);
-                                else newSet.delete(s.student_id);
-                                setSelectedStudentIds(newSet);
-                              }}
-                            />
-                          </td>
-                          <td className="p-3">{s.student_id}</td>
-                          <td className="p-3 font-medium">{s.name}</td>
-                          <td className="p-3">{s.class}</td>
-                          <td className="p-3">Bus {s.bus_number}</td>
-                          <td className="p-3">{s.stop_name}</td>
-                          <td className="p-3">
-                            <span className={`px-2 py-1 rounded-full text-xs font-bold text-white ${isPaid ? 'bg-paid' : 'bg-due'}`}>
-                              {statusStr}
-                            </span>
-                          </td>
-                          <td className="p-3 flex gap-2">
-                            <button
-                              onClick={() => setSelectedStudentForPayment(s)}
-                              className="text-primary text-xs font-semibold px-2 py-1 bg-primary/10 rounded hover:bg-primary/20"
-                            >
-                              Update Fee
-                            </button>
-                            <button
-                              onClick={() => setSelectedStudentForBusChange([s.student_id])}
-                              className="text-primary text-xs font-semibold px-2 py-1 bg-primary/10 rounded hover:bg-primary/20"
-                            >
-                              Change Bus
-                            </button>
-                          </td>
-                        </tr>
-                      );
-                    })}
-                  </tbody>
-                </table>
-              </div>
-              
-              {totalPages > 1 && (
-                <div className="flex items-center justify-between mt-4 px-2">
-                  <span className="text-sm text-slate-600">
-                    Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredStudents.length)} of {filteredStudents.length} students
-                  </span>
-                  <div className="flex gap-2">
-                    <button
-                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
-                      disabled={currentPage === 1}
-                      className="px-3 py-1 bg-white border rounded text-sm disabled:opacity-50"
-                    >
-                      Previous
-                    </button>
-                    <span className="px-3 py-1 text-sm bg-slate-100 rounded">
-                      Page {currentPage} of {totalPages}
-                    </span>
-                    <button
-                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
-                      disabled={currentPage === totalPages}
-                      className="px-3 py-1 bg-white border rounded text-sm disabled:opacity-50"
-                    >
-                      Next
-                    </button>
-                  </div>
-                </div>
-              )}
-            </div>
-          )}
-
-          {activeTab === 'buses' && (
-            <div>
-              <p className="text-sm text-slate-500 mb-3">Live locations update every 30 seconds</p>
-              <BusMap buses={buses} className="w-full h-[500px]" />
-              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
-                {buses.map((b) => (
-                  <div key={b.bus_number} className="bg-white rounded-lg p-3 shadow text-sm">
-                    <p className="font-bold">Bus {b.bus_number}</p>
-                    <p className="text-slate-500">{b.driver_name}</p>
-                    <p className="text-xs text-slate-400 mt-1">
-                      {b.last_updated ? new Date(b.last_updated).toLocaleString() : 'No location'}
-                    </p>
-                  </div>
-                ))}
-              </div>
-            </div>
-          )}
-
-          {activeTab === 'manage_credentials' && (
-            <ManageCredentials 
-              adminPassword={password} 
-              onPasswordChange={(newPw) => {
-                setPassword(newPw);
-                sessionStorage.setItem('admin_pw', newPw);
-              }}
-            />
-          )}
-
-          {activeTab === 'student_lookup' && (
-            <StudentLookup adminPassword={password} />
-          )}
-
-          {activeTab === 'incidents' && (
-            <div>
-              <div className="bg-white rounded-xl shadow overflow-x-auto mt-4">
-                <table className="w-full text-sm">
-                  <thead className="bg-slate-50">
-                    <tr>
-                      {['Time', 'Student', 'Type', 'Description', 'Reported By'].map((h) => (
-                        <th key={h} className="text-left p-3 font-semibold text-slate-600">{h}</th>
-                      ))}
-                    </tr>
-                  </thead>
-                  <tbody>
-                    {incidents.map((inc, i) => (
-                      <tr key={i} className="border-t hover:bg-slate-50">
-                        <td className="p-3">{inc.time}</td>
-                        <td className="p-3 font-medium">{inc.student_name} <span className="text-xs text-slate-400">({inc.student_id})</span></td>
-                        <td className="p-3">
-                          <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold capitalize">
-                            {inc.incident_type.replace('_', ' ')}
-                          </span>
-                        </td>
-                        <td className="p-3">{inc.description}</td>
-                        <td className="p-3">{inc.reported_by}</td>
-                      </tr>
-                    ))}
-                    {!incidents.length && (
-                      <tr><td colSpan={5} className="p-6 text-center text-slate-400">No incidents reported</td></tr>
-                    )}
-                  </tbody>
-                </table>
-              </div>
-            </div>
-          )}
-
-          {activeTab === 'reassignment' && (
-            <div>
-              <div className="flex justify-end mt-4">
-                <button
-                  onClick={() => setShowReassignModal(true)}
-                  className="bg-primary text-white px-4 py-2 rounded-lg font-bold shadow"
-                >
-                  Create Reassignment
-                </button>
-              </div>
-              <div className="bg-white rounded-xl shadow overflow-x-auto mt-4">
-                <table className="w-full text-sm">
-                  <thead className="bg-slate-50">
-                    <tr>
-                      {['Date', 'Original Bus', 'Temporary Bus', 'Status', 'Action'].map((h) => (
-                        <th key={h} className="text-left p-3 font-semibold text-slate-600">{h}</th>
-                      ))}
-                    </tr>
-                  </thead>
-                  <tbody>
-                    {reassignments.map((r, i) => (
-                      <tr key={i} className="border-t hover:bg-slate-50">
-                        <td className="p-3">{r.date}</td>
-                        <td className="p-3 font-medium">{r.original_bus}</td>
-                        <td className="p-3 font-medium text-primary">{r.temporary_bus}</td>
-                        <td className="p-3">
-                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${r.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}`}>
-                            {r.status.toUpperCase()}
-                          </span>
-                        </td>
-                        <td className="p-3">
-                          {r.status === 'active' && (
-                            <button
-                              onClick={async () => {
-                                try {
-                                  await api.endBusReassignment(r.original_bus, password);
-                                  toast.success('Reassignment ended');
-                                  loadData();
-                                } catch (e) { toast.error(e.message); }
-                              }}
-                              className="text-red-600 font-semibold text-xs bg-red-50 px-3 py-1 rounded hover:bg-red-100"
-                            >
-                              End Now
-                            </button>
-                          )}
-                        </td>
-                      </tr>
-                    ))}
-                    {!reassignments.length && (
-                      <tr><td colSpan={5} className="p-6 text-center text-slate-400">No active reassignments</td></tr>
-                    )}
-                  </tbody>
-                </table>
-              </div>
-            </div>
-          )}
-        </div>
-      )}
-      
-      {showBulkFeeModal && (
-        <BulkUpdateFeeModal
-          studentIds={selectedStudentIds}
-          onClose={() => setShowBulkFeeModal(false)}
-          onSave={async (payload) => {
-            await api.bulkUpdateFee(payload, password);
-            toast.success('Bulk update successful');
-            loadData();
-            setSelectedStudentIds(new Set());
-          }}
-        />
-      )}
-
+  const [lookupPinInput, setLookupPinInput] = useState('');
+  const [showReassignModal, setShowReassignModal] = useState(false);
+  const [selectedStudentForPayment, setSelectedStudentForPayment] = useState(null);
+  const [editingBus, setEditingBus] = useState(null);
+
+  const [currentPage, setCurrentPage] = useState(1);
+  const itemsPerPage = 50;
+
+  const [incidents, setIncidents] = useState([]);
+  const [reassignments, setReassignments] = useState([]);
+
+  const loadData = useCallback(async () => {
+    if (!password) return;
+    setLoading(true);
+    try {
+      const [dash, studs, att, busList, incs, reassigns] = await Promise.all([
+        api.getDashboard(password),
+        api.getStudents(),
+        api.getAttendance(todayStr()),
+        api.getBuses(),
+        api.getIncidents(password),
+        api.getActiveReassignments(password),
+      ]);
+      setStats(dash);
+      setStudents(studs);
+      setAttendance(att);
+      setBuses(busList);
+      setIncidents(incs);
+      setReassignments(reassigns);
+    } catch (err) {
+      toast.error(err.message);
+      if (err.message.includes('Unauthorized')) {
+        sessionStorage.removeItem('admin_pw');
+        setPassword(null);
+      }
+    } finally {
+      setLoading(false);
+    }
+  }, [password]);
+
+  useEffect(() => {
+    loadData();
+    const interval = setInterval(loadData, 30000);
+    return () => clearInterval(interval);
+  }, [loadData]);
+
+  const handleSavePayment = async (studentId, payload) => {
+    try {
+      await api.updateFee(studentId, payload, password);
+      toast.success('Payment updated successfully!');
+      loadData();
+    } catch (err) {
+      toast.error(err.message);
+    }
+  };
+
+  const exportTodayCSV = () => {
+    const headers = ['timestamp', 'student_id', 'student_name', 'bus_number', 'stop_name', 'boarded_at', 'driver_name', 'date'];
+    exportCSV(`attendance_${todayStr()}.csv`, filteredAttendance, headers);
+    toast.success('CSV downloaded');
+  };
+
+  const exportUnpaidCSV = () => {
+    const unpaid = students.filter((s) => isFeeDue(s));
+    const headers = ['student_id', 'name', 'class', 'bus_number', 'stop_name', 'parent_name', 'parent_whatsapp', 'fee_paid_until'];
+    exportCSV('unpaid_fees.csv', unpaid, headers);
+    toast.success('Unpaid fees report downloaded');
+  };
+
+  const filteredAttendance = attendance.filter((a) => {
+    const matchBus = !busFilter || String(a.bus_number) === busFilter;
+    const matchSearch = !search ||
+      a.student_name?.toLowerCase().includes(search.toLowerCase()) ||
+      a.student_id?.includes(search);
+    return matchBus && matchSearch;
+  });
+
+  const filteredStudents = students.filter((s) => {
+    const isPaid = !isFeeDue(s);
+    const statusStr = isPaid ? 'PAID' : 'DUE';
+    const matchFee = feeFilter === 'ALL' || statusStr === feeFilter;
+    const matchSearch = !studentsSearch || 
+      s.name?.toLowerCase().includes(studentsSearch.toLowerCase()) || 
+      s.student_id?.includes(studentsSearch) ||
+      s.bus_number?.toLowerCase().includes(studentsSearch.toLowerCase());
+    return matchFee && matchSearch;
+  });
+
+  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
+  const paginatedStudents = filteredStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
+
+  useEffect(() => {
+    setCurrentPage(1);
+  }, [studentsSearch, feeFilter]);
+
+  if (!password) return <AdminLogin onLogin={setPassword} />;
+
+  return (
+    <div className="min-h-screen bg-slate-100">
+      <header className="bg-primary text-white p-4 shadow flex justify-between items-center">
+        <h1 className="text-xl font-bold">Admin Dashboard</h1>
+        <button
+          onClick={() => { sessionStorage.removeItem('admin_pw'); setPassword(null); }}
+          className="text-sm bg-white/20 px-3 py-1 rounded-lg"
+        >
+          Logout
+        </button>
+      </header>
+
+        <div className="flex overflow-x-auto bg-white border-b">
+          {['overview', 'attendance', 'students', 'student_lookup', 'incidents', 'buses', 'reassignment', 'manage_credentials'].map((tab) => (
+            <button
+              key={tab}
+              onClick={() => setActiveTab(tab)}
+              className={`px-4 py-3 text-sm font-semibold capitalize whitespace-nowrap ${
+                activeTab === tab ? 'text-primary border-b-2 border-primary' : 'text-slate-500'
+              }`}
+            >
+              {tab === 'reassignment' ? 'Bus Reassignment' : tab.replace('_', ' ')}
+            </button>
+          ))}
+        </div>
+
+      {loading && !stats ? (
+        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
+      ) : (
+        <div className="p-4 max-w-7xl mx-auto">
+          {activeTab === 'overview' && stats && (
+            <>
+              {incidents.filter(i => i.incident_type === 'emergency' && i.date === todayStr()).length > 0 && (
+                <div className="mb-6 bg-red-600 text-white p-4 rounded-xl shadow-lg border-4 border-red-800 flex items-center justify-between">
+                  <div className="flex items-center gap-3">
+                    <span className="text-4xl animate-pulse">🆘</span>
+                    <div>
+                      <h2 className="text-xl font-bold uppercase tracking-widest">Emergency Alert</h2>
+                      <p className="opacity-90 text-sm">One or more SOS buttons were pressed today. Check the Incidents tab immediately.</p>
+                    </div>
+                  </div>
+                  <button onClick={() => setActiveTab('incidents')} className="bg-white text-red-700 font-bold px-4 py-2 rounded-lg hover:bg-red-50">View Incidents</button>
+                </div>
+              )}
+              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
+                <StatCard label="Total Students" value={stats.totalStudents} />
+                <StatCard label="Boarded Today" value={stats.boardedToday} color="green" />
+                <StatCard label="Fee Defaulters" value={stats.feeDefaulters} color="red" />
+                <StatCard label="Active Buses" value={stats.activeBuses} color="purple" />
+              </div>
+              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
+                <div className="bg-white rounded-xl shadow p-4 border-l-4 border-orange-500">
+                  <h3 className="font-bold text-slate-700 mb-2">Cross-Bus Boardings Today</h3>
+                  {stats.crossBusBoardings && stats.crossBusBoardings.length > 0 ? (
+                    <div className="space-y-2">
+                      {stats.crossBusBoardings.map((r, i) => (
+                        <div key={i} className="text-sm bg-slate-50 p-2 rounded">
+                          <span className="font-semibold">{r.student_name}</span> ({r.student_id}) 
+                          boarded <span className="text-orange-600 font-bold">Bus {r.actual_bus}</span> 
+                          (Assigned: Bus {r.assigned_bus}) at {r.boarded_at}
+                        </div>
+                      ))}
+                    </div>
+                  ) : (
+                    <p className="text-sm text-slate-500 italic">No cross-bus boardings today.</p>
+                  )}
+                </div>
+
+                <div className="bg-white rounded-xl shadow p-4 border-l-4 border-blue-500">
+                  <h3 className="font-bold text-slate-700 mb-2">Active Reassignments</h3>
+                  {stats.activeReassignments && stats.activeReassignments.length > 0 ? (
+                    <div className="space-y-2">
+                      {stats.activeReassignments.map((r, i) => (
+                        <div key={i} className="text-sm bg-slate-50 p-2 rounded">
+                          <span className="font-semibold text-blue-700">{r.bus_number}</span> reassigned to 
+                          <span className="font-semibold"> {r.temp_driver}</span> ({r.temp_driver_phone}) 
+                          due to {r.reason}. Ends: {r.end_date}
+                        </div>
+                      ))}
+                    </div>
+                  ) : (
+                    <p className="text-sm text-slate-500 italic">No active bus reassignments.</p>
+                  )}
+                </div>
+              </div>
+            </>
+          )}
+
+          {activeTab === 'attendance' && (
+            <div>
+              <div className="flex flex-wrap gap-2 mb-4">
+                <input
+                  type="text"
+                  placeholder="Search student..."
+                  value={search}
+                  onChange={(e) => setSearch(e.target.value)}
+                  className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[150px]"
+                />
+                <select
+                  value={busFilter}
+                  onChange={(e) => setBusFilter(e.target.value)}
+                  className="border rounded-lg px-3 py-2 text-sm"
+                >
+                  <option value="">All Buses</option>
+                  {Array.from({length: 13}, (_, i) => i + 1).map((b) => (
+                    <option key={b} value={`Bus ${b}`}>Bus {b}</option>
+                  ))}
+                </select>
+                <button
+                  onClick={exportTodayCSV}
+                  className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold"
+                >
+                  Export CSV
+                </button>
+              </div>
+              <div className="bg-white rounded-xl shadow overflow-x-auto">
+                <table className="w-full text-sm">
+                  <thead className="bg-slate-50">
+                    <tr>
+                      {['Time', 'Student', 'Bus', 'Stop', 'Driver'].map((h) => (
+                        <th key={h} className="text-left p
<truncated 16016 bytes>

NOTE: The output was truncated because it was too long. Use a more targeted query or a smaller range to get the information you need.