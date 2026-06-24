const fs = require('fs');

let content = fs.readFileSync('src/pages/AdminDashboard.jsx', 'utf8');

// 1. AdminLogin Replacement
const oldLogin = content.substring(
  content.indexOf('function AdminLogin({ onLogin }) {'),
  content.indexOf('export default function AdminDashboard')
);

const newLogin = `function AdminLogin({ onLogin }) {
  const { t, lang, toggleLang } = useLanguage();
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
      toast.success(\`Welcome, \${res.role}\`);
    } catch {
      toast.error('Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 relative">
      <button 
        onClick={toggleLang}
        className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full font-bold transition"
      >
        {lang === 'en' ? 'తెలుగు' : 'English'}
      </button>
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

`;

content = content.replace(oldLogin, newLogin);

// 2. AdminDashboard Signature Replacement
const oldSig = `  const [password, setPassword] = useState(() => {
    const pw = sessionStorage.getItem('admin_pw');
    const time = sessionStorage.getItem('admin_pw_time');
    if (pw && time) {
      if (Date.now() - parseInt(time, 10) > 2 * 60 * 60 * 1000) {
        sessionStorage.removeItem('admin_pw');
        sessionStorage.removeItem('admin_pw_time');
        return null;
      }
      return pw;
    }
    return null;
  });`;

const newSig = `  const [auth, setAuth] = useState(() => {
    try {
      const stored = sessionStorage.getItem('admin_auth');
      const time = sessionStorage.getItem('admin_auth_time');
      if (stored && time) {
        if (Date.now() - parseInt(time, 10) > 2 * 60 * 60 * 1000) {
          sessionStorage.removeItem('admin_auth');
          sessionStorage.removeItem('admin_auth_time');
          return null;
        }
        return JSON.parse(stored);
      }
    } catch { return null; }
    return null;
  });`;

content = content.replace(oldSig, newSig);

// Replace password references
content = content.replace(/password/g, 'auth');
// Oh wait, replacing "password" globally might break password input forms.
// Let's replace only specific variables:
// setPassword -> setAuth
// !password -> !auth
// password) -> auth)
// getDashboard(password) -> getDashboard(auth) etc.
content = content.replace(/setPassword/g, 'setAuth');
content = content.replace(/!password/g, '!auth');
content = content.replace(/\(password\)/g, '(auth)');
content = content.replace(/password,/g, 'auth,');

// 3. Tab visibility based on role
const tabsMenu = `<div className="flex gap-2 overflow-x-auto pb-4 hide-scrollbar">
          <TabButton id="overview" label={t('admin.tabOverview')} icon="📊" />
          <TabButton id="students" label={t('admin.tabStudents')} icon="🎓" />
          <TabButton id="buses" label={t('admin.tabBuses')} icon="🚌" />
          <TabButton id="incidents" label={t('admin.tabIncidents')} icon="⚠️" />
          <TabButton id="credentials" label={t('admin.tabCredentials')} icon="🔐" />
        </div>`;

const newTabsMenu = `<div className="flex gap-2 overflow-x-auto pb-4 hide-scrollbar">
          {(auth.role === 'admin' || auth.role === 'accountant' || auth.role === 'bus_incharge') && <TabButton id="overview" label={t('admin.tabOverview')} icon="📊" />}
          {(auth.role === 'admin' || auth.role === 'accountant') && <TabButton id="students" label={t('admin.tabStudents')} icon="🎓" />}
          {(auth.role === 'admin' || auth.role === 'bus_incharge') && <TabButton id="buses" label={t('admin.tabBuses')} icon="🚌" />}
          {(auth.role === 'admin') && <TabButton id="incidents" label={t('admin.tabIncidents')} icon="⚠️" />}
          {(auth.role === 'admin') && <TabButton id="credentials" label={t('admin.tabCredentials')} icon="🔐" />}
        </div>`;

content = content.replace(tabsMenu, newTabsMenu);

// 4. Protect activeTab loading
const loadDataBlock = `  const loadData = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    try {
      const [dash, studs, att, busList, incs, reassigns] = await Promise.all([
        api.getDashboard(auth),
        api.getStudents(),
        api.getAttendance(todayStr()),
        api.getBuses(),
        api.getIncidents(auth),
        api.getActiveReassignments(auth)
      ]);`;

const newLoadDataBlock = `  const loadData = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    try {
      let dash={}, studs=[], att=[], busList=[], incs=[], reassigns=[];
      if (auth.role === 'admin') {
        [dash, studs, att, busList, incs, reassigns] = await Promise.all([
          api.getDashboard(auth), api.getStudents(), api.getAttendance(todayStr()), api.getBuses(), api.getIncidents(auth), api.getActiveReassignments(auth)
        ]);
      } else if (auth.role === 'accountant') {
        [dash, studs, att, busList] = await Promise.all([
          api.getDashboard(auth), api.getStudents(), api.getAttendance(todayStr()), api.getBuses()
        ]);
      } else if (auth.role === 'bus_incharge') {
        [dash, studs, att, busList, reassigns] = await Promise.all([
          api.getDashboard(auth), api.getStudents(), api.getAttendance(todayStr()), api.getBuses(), api.getActiveReassignments(auth)
        ]);
      }`;

content = content.replace(loadDataBlock, newLoadDataBlock);

fs.writeFileSync('src/pages/AdminDashboard.jsx', content);
console.log('AdminDashboard.jsx patched successfully');
