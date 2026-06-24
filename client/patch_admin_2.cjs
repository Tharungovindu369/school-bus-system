const fs = require('fs');

// 1. Update api.js
let apiContent = fs.readFileSync('src/api.js', 'utf8');
if (!apiContent.includes('updateBusDriver:')) {
    apiContent = apiContent.replace(
        "  updateStudentBus: (studentId, newBus, auth) =>",
        "  updateBusDriver: (number, driver_name, driver_phone, auth) =>\n    request(`/bus/${number}/driver`, { method: 'PUT', body: JSON.stringify({ driver_name, driver_phone }), headers: getAuthHeader(auth) }),\n  updateStudentBus: (studentId, newBus, auth) =>"
    );
    fs.writeFileSync('src/api.js', apiContent);
}

// 2. Update AdminDashboard.jsx
let dashContent = fs.readFileSync('src/pages/AdminDashboard.jsx', 'utf8');

// A. Fix StatCard Colors
dashContent = dashContent.replace(
    /const colors = \{[\s\S]*?blue: 'bg-blue-50 text-blue-600',[\s\S]*?purple: 'bg-purple-50 text-purple-600',\n  \};/,
    `const colors = {
    blue: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white',
    green: 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white',
    red: 'bg-gradient-to-r from-red-500 to-red-600 text-white',
    purple: 'bg-gradient-to-r from-purple-500 to-purple-600 text-white',
  };`
);

// B. Remove manage_credentials from Accountant and Bus Incharge
dashContent = dashContent.replace(
    /if \(auth.role === 'accountant'\) t = \['overview', 'students', 'manage_credentials'\];/,
    "if (auth.role === 'accountant') t = ['overview', 'students'];"
);
dashContent = dashContent.replace(
    /if \(auth.role === 'bus_incharge'\) t = \['overview', 'buses', 'reassignment', 'manage_credentials'\];/,
    "if (auth.role === 'bus_incharge') t = ['overview', 'buses', 'reassignment'];"
);

// C. Add Modals
const modals = `
function UpdatePaymentModal({ student, onClose, onSave }) {
  const [duration, setDuration] = useState('1 month');
  const [customDate, setCustomDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      let dateStr = '';
      if (duration === 'custom date') {
        if (!customDate) throw new Error('Please select a custom date');
        dateStr = customDate;
      } else {
        const d = new Date();
        if (duration === '1 month') d.setMonth(d.getMonth() + 1);
        else if (duration === '3 months') d.setMonth(d.getMonth() + 3);
        else if (duration === '6 months') d.setMonth(d.getMonth() + 6);
        else if (duration === '1 year') d.setFullYear(d.getFullYear() + 1);
        dateStr = d.toISOString().split('T')[0];
      }
      await onSave(student.student_id, dateStr);
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
        <select value={duration} onChange={e => setDuration(e.target.value)} className="w-full border p-2 rounded mb-4">
          <option value="1 month">1 Month</option>
          <option value="3 months">3 Months</option>
          <option value="6 months">6 Months</option>
          <option value="1 year">1 Year</option>
          <option value="custom date">Custom Date</option>
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
`;

if (!dashContent.includes('function UpdatePaymentModal')) {
    dashContent = dashContent.replace('function StatCard', modals + '\nfunction StatCard');
}

// D. Update toggleFee logic
if (!dashContent.includes('const [selectedStudentForFee')) {
    dashContent = dashContent.replace(
        "const [buses, setBuses] = useState([]);",
        "const [buses, setBuses] = useState([]);\n  const [selectedStudentForFee, setSelectedStudentForFee] = useState(null);\n  const [selectedBusForEdit, setSelectedBusForEdit] = useState(null);"
    );
}

dashContent = dashContent.replace(
    /const toggleFee = async \(s\) => \{[\s\S]*?setStudents\(res\);[\s\S]*?\} catch \(err\) \{[\s\S]*?\}[\s\S]*?\};/,
    `const toggleFee = (s) => {
    setSelectedStudentForFee(s);
  };
  
  const handleUpdateFee = async (studentId, dateStr) => {
    const res = await api.updateFee(studentId, dateStr, auth);
    toast.success('Fee updated');
    setStudents(res);
  };
  
  const handleEditBus = async (busNumber, driverName, driverPhone) => {
    await api.updateBusDriver(busNumber, driverName, driverPhone, auth);
    toast.success('Bus driver updated');
    loadData();
  };`
);

// E. Add Modals to render output
if (!dashContent.includes('<UpdatePaymentModal')) {
    dashContent = dashContent.replace(
        /<\/div>\n      \)\}\n    <\/div>\n  \);\n\}/,
        `</div>
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
}`
    );
}

// F. Add Edit button to Buses tab
if (!dashContent.includes("onClick={() => setSelectedBusForEdit(b)}")) {
    dashContent = dashContent.replace(
        /<p className="font-bold">Bus \{b.bus_number\}<\/p>/g,
        `<div className="flex justify-between items-center">
                      <p className="font-bold">Bus {b.bus_number}</p>
                      {['admin', 'bus_incharge'].includes(auth.role) && (
                        <button onClick={() => setSelectedBusForEdit(b)} className="text-xs text-primary font-bold">Edit</button>
                      )}
                    </div>`
    );
}

fs.writeFileSync('src/pages/AdminDashboard.jsx', dashContent);
console.log('AdminDashboard patched successfully!');
