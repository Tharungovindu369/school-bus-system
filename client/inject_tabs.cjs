const fs = require('fs');

let content = fs.readFileSync('src/pages/AdminDashboard.jsx', 'utf8');

// The new tabs to append
const newTabs = `
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

              <div className="bg-white rounded-xl shadow overflow-hidden">
                <h3 className="font-bold text-lg p-4 border-b bg-slate-50">Active Reassignments</h3>
                <div className="divide-y">
                  {stats?.activeReassignments?.length > 0 ? (
                    stats.activeReassignments.map((r, i) => (
                      <div key={i} className="p-4">
                        <div className="flex justify-between">
                          <span className="font-bold">{r.bus_number}</span>
                          <span className="text-sm bg-blue-100 text-blue-800 px-2 rounded">
                            Until {r.end_date}
                          </span>
                        </div>
                        <div className="text-sm text-slate-600 mt-1">
                          Covered by {r.temp_driver} ({r.temp_driver_phone}) logging in as {r.temp_driver_bus}
                        </div>
                        <div className="text-sm text-slate-500 italic mt-1">
                          "{r.reason}"
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center text-slate-500">No active reassignments</div>
                  )}
                </div>
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
                    <tr key={i} className={\`hover:bg-slate-50 \${inc.level === 'CRITICAL' ? 'bg-red-50' : inc.level === 'WARNING' ? 'bg-amber-50' : ''}\`}>
                      <td className="p-3">{new Date(inc.timestamp).toLocaleString()}</td>
                      <td className="p-3">
                        <span className={\`px-2 py-1 rounded text-xs font-bold \${inc.level === 'CRITICAL' ? 'bg-red-500 text-white' : inc.level === 'WARNING' ? 'bg-amber-500 text-white' : 'bg-slate-200'}\`}>
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
`;

// Inject before the final closing divs of the main dashboard area
if (!content.includes("activeTab === 'manage_credentials'")) {
    const parts = content.split('        </div>\n      )}\n    </div>\n  );\n}');
    if (parts.length === 2) {
        content = parts[0] + newTabs + '\n        </div>\n      )}\n    </div>\n  );\n}';
        fs.writeFileSync('src/pages/AdminDashboard.jsx', content);
        console.log('Tabs injected successfully!');
    } else {
        console.log('Failed to split!');
    }
} else {
    console.log('Tabs already exist!');
}
