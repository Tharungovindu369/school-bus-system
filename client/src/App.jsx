import { useState } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import DriverApp from './pages/DriverApp';
import AdminDashboard from './pages/AdminDashboard';
import ParentTrack from './pages/ParentTrack';
import ReceptionScanner from './pages/ReceptionScanner';
import ParentLookup from './pages/ParentLookup';
import ParentInstructionSlip from './pages/ParentInstructionSlip';
import { SCHOOL_NAME, formatBusNumber } from './utils';

function Home() {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [studentId, setStudentId] = useState(() => localStorage.getItem('parent_studentId') || '');
  const [password, setPassword] = useState(() => localStorage.getItem('parent_last4') || '');

  const handleParentSubmit = (e) => {
    e.preventDefault();
    if (!studentId.trim() || !password.trim()) {
      return;
    }
    localStorage.setItem('parent_studentId', studentId.trim().toUpperCase());
    localStorage.setItem('parent_last4', password.trim());
    navigate('/lookup');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-950 to-slate-900 flex flex-col items-center justify-center p-4 sm:p-6 pb-20 text-white selection:bg-blue-500 selection:text-white">
      {/* College Logo & Header */}
      <div className="flex flex-col items-center text-center max-w-md w-full mb-6">
        <div className="bg-white/95 p-3 rounded-2xl shadow-xl mb-4 border border-white/20 backdrop-blur">
          <img src="/logo.png" alt="College Logo" className="h-20 object-contain" />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/20 text-emerald-300 text-xs font-semibold mb-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          {lang === 'te' ? '16 బస్సులు ఆపరేషనల్' : '16 Fleet Routes Active'}
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-1">
          {SCHOOL_NAME}
        </h1>
        <p className="text-blue-200 text-sm font-medium">
          {lang === 'te' ? 'కళాశాల బస్సు లైవ్ ట్రాకింగ్ & హాజరు పోర్టల్' : 'Live Campus Bus Tracking & Attendance Portal'}
        </p>
      </div>

      {/* Main Content Container */}
      <div className="w-full max-w-md space-y-4">
        {/* CARD 1: PARENT LOGIN & AUTO BUS TRACKER (HERO) */}
        <div className="bg-white text-slate-900 rounded-2xl p-5 shadow-2xl border border-blue-100">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-xl shadow-sm">
              🎓
            </div>
            <div>
              <h2 className="font-bold text-lg text-slate-900 leading-tight">
                {lang === 'te' ? 'తల్లిదండ్రులు & విద్యార్థుల పోర్టల్' : 'Parent & Student Portal'}
              </h2>
              <p className="text-xs text-slate-500">
                {lang === 'te' ? 'లైవ్ బస్సు లొకేషన్ & విద్యార్థి వివరాల కోసం లాగిన్ చేయండి' : 'Enter details to track your bus and view boarding status'}
              </p>
            </div>
          </div>

          <form onSubmit={handleParentSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {lang === 'te' ? 'విద్యార్థి ID' : 'Student ID'}
              </label>
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value.toUpperCase())}
                placeholder={lang === 'te' ? 'ఉదా. S0123' : 'e.g. S0123 / PRAT-101'}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-base font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary uppercase tracking-wider"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {lang === 'te' ? 'పాస్‌వర్డ్ (ఫోన్ చివరి 4 అంకెలు)' : 'Password (Parent Phone Last 4 Digits)'}
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={password}
                onChange={(e) => setPassword(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-2xl text-center font-bold tracking-widest text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-primary hover:bg-blue-700 active:scale-[0.99] text-white font-bold py-3.5 px-4 rounded-xl text-base shadow-md transition flex items-center justify-center gap-2"
            >
              <span>{lang === 'te' ? 'బస్సు ట్రాక్ చేయండి & వివరాలు చూడండి' : 'Track My Bus & View Details'}</span>
              <span>➔</span>
            </button>
          </form>

          <p className="text-center text-[11px] text-slate-400 mt-3">
            🔒 {lang === 'te' ? 'సురక్షిత లాగిన్ • లైవ్ GPS మ్యాప్స్ & బోర్డింగ్ నోటిఫికేషన్లు' : 'Secure Login • Real-time GPS Map & Boarding Alerts'}
          </p>
        </div>

        {/* CARD 2: PARENT INSTRUCTION GUIDE */}
        <Link
          to="/instruction-slip"
          className="flex items-center justify-between bg-blue-900/40 hover:bg-blue-900/60 border border-blue-400/30 p-3.5 rounded-xl transition text-left text-xs font-semibold text-blue-100"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-lg">📋</span>
            <div>
              <p className="font-bold text-white text-xs">
                {lang === 'te' ? 'తల్లిదండ్రుల సూచనలు & సమాచారం' : 'Parent Instructions & User Guide'}
              </p>
              <p className="text-[11px] text-blue-300">
                {lang === 'te' ? 'WhatsApp గ్రూప్ లింక్‌లు మరియు వివరాలు' : 'How to track and save live route links'}
              </p>
            </div>
          </div>
          <span className="text-blue-300">➔</span>
        </Link>

        {/* CARD 3: STAFF & DRIVERS PORTAL (COMPACT & SLEEK) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 backdrop-blur">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <span>🔒</span>
              <span>{lang === 'te' ? 'సిబ్బంది పోర్టల్' : 'Staff & Authorized Access'}</span>
            </span>
            <span className="text-[10px] text-slate-500 font-medium">PIN / Password Required</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Link
              to="/driver"
              className="bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/80 rounded-xl p-2.5 text-center flex flex-col items-center justify-center gap-1 transition active:scale-95 group"
            >
              <span className="text-xl group-hover:scale-110 transition">🚌</span>
              <span className="text-xs font-bold text-slate-200 group-hover:text-white">
                {t('home.driverApp')}
              </span>
            </Link>

            <Link
              to="/admin?role=bus_incharge"
              className="bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/80 rounded-xl p-2.5 text-center flex flex-col items-center justify-center gap-1 transition active:scale-95 group"
            >
              <span className="text-xl group-hover:scale-110 transition">🚍</span>
              <span className="text-xs font-bold text-slate-200 group-hover:text-white">
                {lang === 'te' ? 'బస్ ఇన్‌ఛార్జ్' : 'Bus Incharge'}
              </span>
            </Link>

            <Link
              to="/admin?role=accountant"
              className="bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/80 rounded-xl p-2.5 text-center flex flex-col items-center justify-center gap-1 transition active:scale-95 group"
            >
              <span className="text-xl group-hover:scale-110 transition">💼</span>
              <span className="text-xs font-bold text-slate-200 group-hover:text-white">
                {lang === 'te' ? 'అకౌంటెంట్' : 'Accountant'}
              </span>
            </Link>

            <Link
              to="/reception"
              className="bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/80 rounded-xl p-2.5 text-center flex flex-col items-center justify-center gap-1 transition active:scale-95 group"
            >
              <span className="text-xl group-hover:scale-110 transition">📷</span>
              <span className="text-xs font-bold text-slate-200 group-hover:text-white">
                {lang === 'te' ? 'గేట్ స్కానర్' : 'Gate Scan'}
              </span>
            </Link>

            <Link
              to="/admin?role=admin"
              className="col-span-2 sm:col-span-1 bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/80 rounded-xl p-2.5 text-center flex flex-col items-center justify-center gap-1 transition active:scale-95 group"
            >
              <span className="text-xl group-hover:scale-110 transition">🛡️</span>
              <span className="text-xs font-bold text-slate-200 group-hover:text-white">
                {lang === 'te' ? 'అడ్మిన్' : 'Admin'}
              </span>
            </Link>
          </div>
        </div>

        {/* FOOTER */}
        <p className="text-center text-[11px] text-blue-300/60 pb-2">
          {SCHOOL_NAME} • Safe & Punctual Student Transit
        </p>
      </div>
    </div>
  );
}

import { LanguageProvider, useLanguage } from './contexts/LanguageContext';

function GlobalLanguageButton() {
  const { lang, toggleLang } = useLanguage();
  return (
    <button
      onClick={toggleLang}
      className="fixed bottom-4 right-4 z-50 bg-white/95 hover:bg-white text-slate-800 border border-slate-200 px-4 py-2 rounded-full font-bold shadow-lg hover:shadow-xl transition flex items-center gap-1.5 no-print"
      style={{ cursor: 'pointer' }}
    >
      🌐 {lang === 'en' ? 'తెలుగు' : 'English'}
    </button>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <GlobalLanguageButton />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/driver" element={<DriverApp />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/reception" element={<ReceptionScanner />} />
        <Route path="/lookup" element={<ParentLookup />} />
        <Route path="/instruction-slip" element={<ParentInstructionSlip />} />
        <Route path="/track/:bus_number" element={<ParentTrack />} />
      </Routes>
    </LanguageProvider>
  );
}
