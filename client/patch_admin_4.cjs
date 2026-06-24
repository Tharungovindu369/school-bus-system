const fs = require('fs');

let content = fs.readFileSync('src/pages/AdminDashboard.jsx', 'utf8');

const regex = /function UpdatePaymentModal[\s\S]*?<\/div>\n  \);\n\}/;
const newModal = `function UpdatePaymentModal({ student, onClose, onSave }) {
  const [duration, setDuration] = useState('1 month');
  const [customDate, setCustomDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
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
        <select value={duration} onChange={e => setDuration(e.target.value)} className="w-full border p-2 rounded mb-4">
          <option value="1 month">1 Month</option>
          <option value="3 months">3 Months</option>
          <option value="6 months">6 Months</option>
          <option value="1 year">1 Year</option>
          <option value="custom date">Custom Date</option>
          <option value="mark due">Mark as Due</option>
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
}`;

if (regex.test(content)) {
    content = content.replace(regex, newModal);
    fs.writeFileSync('src/pages/AdminDashboard.jsx', content);
    console.log('UpdatePaymentModal replaced!');
} else {
    console.log('UpdatePaymentModal not found!');
}
