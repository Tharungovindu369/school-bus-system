import { Routes, Route, Link } from 'react-router-dom';
import DriverApp from './pages/DriverApp';
import AdminDashboard from './pages/AdminDashboard';
import ParentTrack from './pages/ParentTrack';
import ReceptionScanner from './pages/ReceptionScanner';
import ParentLookup from './pages/ParentLookup';
import ParentInstructionSlip from './pages/ParentInstructionSlip';
import { SCHOOL_NAME } from './utils';

function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary to-blue-800 flex flex-col items-center justify-center p-6 text-white">
      <img src="/logo.png" alt="College Logo" className="h-24 object-contain mb-6 bg-white/90 p-3 rounded-xl shadow-lg" />
      <h1 className="text-3xl font-bold text-center mb-2">College Bus Management</h1>
      <p className="text-blue-100 text-center mb-10">{SCHOOL_NAME} Transport System</p>
      <div className="flex flex-col gap-4 w-full max-w-sm">
        <Link
          to="/driver"
          className="bg-white text-primary font-bold py-4 px-6 rounded-xl text-center text-lg shadow-lg hover:bg-blue-50 transition"
        >
          Driver App
        </Link>
        <Link
          to="/admin"
          className="bg-blue-900 text-white font-bold py-4 px-6 rounded-xl text-center text-lg border-2 border-blue-400 hover:bg-blue-950 transition"
        >
          Admin Dashboard
        </Link>
        <Link
          to="/reception"
          className="bg-emerald-700 text-white font-bold py-4 px-6 rounded-xl text-center text-lg border-2 border-emerald-400 hover:bg-emerald-800 transition"
        >
          College Gate Scanner
        </Link>
        <Link
          to="/lookup"
          className="bg-amber-500 text-white font-bold py-4 px-6 rounded-xl text-center text-lg shadow-lg hover:bg-amber-600 transition"
        >
          Check Your Child's Bus Status
        </Link>
        <p className="text-center text-sm text-blue-100 opacity-90 px-2 -mt-2">
          Use your child's Student ID and the last 4 digits of your registered phone number to check their status.
        </p>
        <Link
          to="/instruction-slip"
          className="bg-slate-700 text-white font-semibold py-3 px-6 rounded-xl text-center hover:bg-slate-600 transition text-sm"
        >
          🖨️ Print Parent Instructions
        </Link>
        <Link
          to="/track/1"
          className="bg-transparent text-white font-semibold py-3 px-6 rounded-xl text-center border border-blue-300 hover:bg-blue-700 transition"
        >
          Parent Tracking (Demo Bus 1)
        </Link>
      </div>
    </div>
  );
}

import { LanguageProvider } from './contexts/LanguageContext';

export default function App() {
  return (
    <LanguageProvider>
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
