const fs = require('fs');

let content = fs.readFileSync('src/pages/AdminDashboard.jsx', 'utf8');

const append = `
          {activeTab === 'credentials' && (
            <ManageCredentials 
              adminPassword={auth} 
              onPasswordChange={(newPw) => {
                const newAuth = { role: 'admin', token: newPw };
                setAuth(newAuth);
                sessionStorage.setItem('admin_auth', JSON.stringify(newAuth));
                sessionStorage.setItem('admin_auth_time', Date.now().toString());
              }}
            />
          )}

          {activeTab === 'student_lookup' && (
            <StudentLookup adminPassword={auth} />
          )}
`;

content = content.replace('</main>', append + '\n        </main>');
fs.writeFileSync('src/pages/AdminDashboard.jsx', content);
console.log('Tabs appended');
