const fs = require('fs');
let content = fs.readFileSync('src/pages/AdminDashboard.jsx', 'utf8');

// Add AddStudentModal component
const addStudentModal = `
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
                {[...Array(20)].map((_, i) => <option key={i+1} value={\`Bus \${i+1}\`}>Bus {i+1}</option>)}
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
`;

content = content.replace('export default function AdminDashboard() {', addStudentModal + '\nexport default function AdminDashboard() {');

// Add state for AddStudentModal
const oldStates = `  const [editingBus, setEditingBus] = useState(null);`;
const newStates = `  const [editingBus, setEditingBus] = useState(null);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);`;
content = content.replace(oldStates, newStates);

// Add handlers
const oldHandlers = `  const handleBulkFeeUpdate = async (payload) => {`;
const newHandlers = `  const handleAddStudent = async (data) => {
    try {
      await api.addStudent(auth, data);
      toast.success('Student added successfully!');
      // Prompt for QR
      if (window.confirm('Student saved. Print QR Card now?')) {
        window.open(\`/api/qr/generate/\${data.student_id}\`, '_blank');
      }
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to add student');
      throw err;
    }
  };

  const handleBulkFeeUpdate = async (payload) => {`;
content = content.replace(oldHandlers, newHandlers);

// Add Button to Students Tab UI
const oldStudentsTop = `<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <h2 className="text-2xl font-bold">{t('admin.tabStudents')}</h2>`;
const newStudentsTop = `<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold">{t('admin.tabStudents')}</h2>
                {(auth.role === 'admin' || auth.role === 'accountant') && (
                  <button onClick={() => setShowAddStudentModal(true)} className="bg-primary text-white px-4 py-2 rounded-lg font-bold text-sm">+ Add New Student</button>
                )}
              </div>`;
content = content.replace(oldStudentsTop, newStudentsTop);

// Add Print QR to Students Table
const oldTableRow = `                      <td className="px-4 py-3 border-b text-slate-800 font-medium">{s.student_id}</td>`;
const newTableRow = `                      <td className="px-4 py-3 border-b text-slate-800 font-medium">
                        {s.student_id}
                        <button onClick={(e) => { e.stopPropagation(); window.open(\`/api/qr/generate/\${s.student_id}\`, '_blank'); }} className="ml-2 text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-1 rounded" title="Print QR">🖨️</button>
                      </td>`;
content = content.replace(oldTableRow, newTableRow);

// Render modal at bottom
const oldReturn = `      {showBulkFeeModal && (`;
const newReturn = `      {showAddStudentModal && <AddStudentModal onClose={() => setShowAddStudentModal(false)} onSave={handleAddStudent} />}
      {showBulkFeeModal && (`;
content = content.replace(oldReturn, newReturn);

// Ensure that api.addStudent uses the auth correctly inside api.js. I already added that.
fs.writeFileSync('src/pages/AdminDashboard.jsx', content);
console.log('AdminDashboard.jsx add student patched successfully');
