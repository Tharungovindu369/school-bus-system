const fs = require('fs');
let content = fs.readFileSync('src/pages/AdminDashboard.jsx', 'utf8');

const badChunk = `                    </div>
                    <tr>
                      {['Time', 'Student', 'Type', 'Description', 'Reported By'].map((h) => (`;

const goodChunk = `                    </div>
                    <button
                      onClick={() => setEditingBus(b)}
                      className="mt-3 w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded text-xs transition"
                    >
                      ✏️ Edit Driver
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'incidents' && (
            <div>
              <div className="bg-white rounded-xl shadow overflow-x-auto mt-4">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Time', 'Student', 'Type', 'Description', 'Reported By'].map((h) => (`;

content = content.replace(badChunk, goodChunk);

fs.writeFileSync('src/pages/AdminDashboard.jsx', content);
console.log('Fixed syntax error');
