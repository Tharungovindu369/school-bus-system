const fs = require('fs');
let code = fs.readFileSync('client/src/pages/AdminDashboard.jsx', 'utf8');

// Add state
const stateHook = 'const [selectedStudentForBusChange, setSelectedStudentForBusChange] = useState(null);';
const newState = stateHook + '\n  const [selectedStudentForLookup, setSelectedStudentForLookup] = useState(null);\n  const [lookupPinInput, setLookupPinInput] = useState(\'\');';
code = code.replace(stateHook, newState);

// Add button
const changeBusButton = `<button
                              onClick={() => setSelectedStudentForBusChange([s.student_id])}
                              className="text-primary text-xs font-semibold px-2 py-1 bg-primary/10 rounded hover:bg-primary/20"
                            >
                              Change Bus
                            </button>`;
const newButton = changeBusButton + `\n                            <button
                              onClick={() => { setSelectedStudentForLookup(s); setLookupPinInput(''); }}
                              className="text-primary text-xs font-semibold px-2 py-1 bg-primary/10 rounded hover:bg-primary/20"
                            >
                              Edit Lookup
                            </button>`;
code = code.replace(changeBusButton, newButton);

// Add modal
const activeReassignmentModal = `      {selectedStudentForBusChange && (`;
const newModal = `      {selectedStudentForLookup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
            <h2 className="text-xl font-bold mb-4">Edit Lookup Credentials</h2>
            <p className="text-sm text-slate-500 mb-4">
              Update the 4-digit PIN for <strong>{selectedStudentForLookup.name}</strong>.
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={lookupPinInput}
              onChange={(e) => setLookupPinInput(e.target.value.replace(/\\D/g, ''))}
              className="w-full p-3 rounded-lg border border-slate-300 text-xl tracking-widest text-center mb-4 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="4-digit PIN"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedStudentForLookup(null)}
                className="flex-1 px-4 py-2 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (lookupPinInput.length !== 4) {
                    toast.error('PIN must be exactly 4 digits');
                    return;
                  }
                  try {
                    await api.updateStudentLookupCredential(password, selectedStudentForLookup.student_id, lookupPinInput);
                    toast.success('Lookup credentials updated for ' + selectedStudentForLookup.name);
                    setSelectedStudentForLookup(null);
                  } catch (err) {
                    toast.error(err.message || 'Failed to update credentials');
                  }
                }}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 font-semibold"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}\n\n` + activeReassignmentModal;
code = code.replace(activeReassignmentModal, newModal);

fs.writeFileSync('client/src/pages/AdminDashboard.jsx', code);
console.log('AdminDashboard.jsx updated');
