const fs = require('fs');
let c = fs.readFileSync('D:/school-bus-system/client/src/pages/AdminDashboard.jsx', 'utf8');

const search = `<div className="bg-white rounded-xl shadow p-4 border-l-4 border-orange-500">
                    <h3 className="font-bold text-slate-700 mb-2">Cross-Bus Boardings Today</h3>
                    {stats.crossBusBoardings && stats.crossBusBoardings.length > 0 ? (
                      <div className="space-y-2">
                        {stats.crossBusBoardings.map((r, i) => (
                          <div key={i} className="text-sm bg-slate-50 p-2 rounded">
                            <span className="font-semibold">{r.student_name}</span> ({r.student_id}) 
                            boarded <span className="text-orange-600 font-bold">Bus {r.actual_bus}</span> 
                            (Assigned: Bus {r.assigned_bus}) at {r.boarded_at}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 italic">No cross-bus boardings today.</p>
                    )}
                  </div>`;

const replace = `<div className="bg-white rounded-xl shadow p-4 border-l-4 border-red-500">
                    <h3 className="font-bold text-slate-700 mb-2">Fee Defaulters Boarded Today</h3>
                    {stats.feeDefaultersBoarded && stats.feeDefaultersBoarded.length > 0 ? (
                      <div className="space-y-2">
                        {stats.feeDefaultersBoarded.map((r, i) => (
                          <div key={i} className="text-sm bg-slate-50 p-2 rounded">
                            <span className="font-semibold">{r.student_name}</span> ({r.student_id}) 
                            boarded <span className="text-red-600 font-bold">Bus {r.actual_bus}</span> 
                            at {r.boarded_at}. Parent WA: {r.parent_whatsapp}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 italic">No fee defaulters boarded today.</p>
                    )}
                  </div>`;

if (!c.includes(search)) {
  console.log('Search string not found!');
  process.exit(1);
}
c = c.replace(search, replace);
fs.writeFileSync('D:/school-bus-system/client/src/pages/AdminDashboard.jsx', c);
console.log('AdminDashboard Replaced');
