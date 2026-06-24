import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import toast from 'react-hot-toast';
import { api } from '../api';
import { formatBusNumber, SCHOOL_NAME } from '../utils';
import Spinner from '../components/Spinner';
import { useLanguage } from '../contexts/LanguageContext';

function ArrivalResult({ result, onDismiss }) {
  const { t } = useLanguage();
  if (result.isDue) {
    return (
      <div className="rounded-2xl p-6 text-white shadow-xl bg-red-600">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-3xl">💰</div>
          <div>
            <h2 className="text-xl font-bold">{result.student.name}</h2>
            <p className="text-red-100">Class {result.student.class}</p>
          </div>
        </div>
        <div className="bg-white/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-black uppercase tracking-wider">FEE DUE</p>
          {result.missedScan && <p className="text-sm mt-2 text-white font-semibold">⚠️ Also Missed Bus Scan</p>}
        </div>
        <button onClick={onDismiss} className="mt-4 w-full bg-white/20 py-3 rounded-xl font-semibold">
          {t('reception.scanNext')}
        </button>
      </div>
    );
  }
  
  if (result.missedScan) {
    return (
      <div className="rounded-2xl p-6 text-white shadow-xl bg-orange-500">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-3xl">⚠️</div>
          <div>
            <h2 className="text-xl font-bold">{result.student.name}</h2>
            <p className="text-orange-100">Class {result.student.class}</p>
          </div>
        </div>
        <div className="bg-white/20 rounded-xl p-4">
          <p className="font-bold text-lg">{result.message}</p>
        </div>
        <button onClick={onDismiss} className="mt-4 w-full bg-white/20 py-3 rounded-xl font-semibold">
          {t('reception.scanNext')}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-6 text-white shadow-xl bg-paid">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-3xl">✅</div>
        <div>
          <h2 className="text-xl font-bold">{result.student.name}</h2>
          <p className="text-green-100">Class {result.student.class}</p>
        </div>
      </div>
      <div className="bg-white/20 rounded-xl p-4 text-center">
        <p className="text-xl font-bold">{result.message}</p>
      </div>
      <button onClick={onDismiss} className="mt-4 w-full bg-white/20 py-3 rounded-xl font-semibold">
        {t('reception.scanNext')}
      </button>
    </div>
  );
}

function ReceptionLogin({ onLogin }) {
  const { t } = useLanguage();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.receptionLogin(pin);
      sessionStorage.setItem('reception_auth', 'true');
      toast.success('Logged in successfully');
      onLogin();
    } catch (err) {
      toast.error(err.message || 'Invalid PIN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-800">{t('reception.loginTitle')}</h1>
          <p className="text-slate-600 mt-2">{SCHOOL_NAME}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">{t('driver.enterPin')}</label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl text-center text-2xl tracking-[0.5em] font-bold focus:border-primary focus:ring-0 transition"
              maxLength={4}
              pattern="\d{4}"
              autoFocus
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg transition"
          >
            {loading ? <Spinner size="sm" /> : t('common.login')}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ReceptionScanner() {
  const { t, lang, toggleLang } = useLanguage();
  const [loggedIn, setLoggedIn] = useState(() => sessionStorage.getItem('reception_auth') === 'true');
  const [summary, setSummary] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [manualEntry, setManualEntry] = useState(false);
  const [studentIdInput, setStudentIdInput] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const html5QrRef = useRef(null);
  const processingRef = useRef(false);

  const loadSummary = useCallback(async () => {
    try {
      const data = await api.getReceptionSummary();
      setSummary(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    loadSummary();
    const interval = setInterval(loadSummary, 30000);
    return () => clearInterval(interval);
  }, [loggedIn, loadSummary]);

  const stopScanner = useCallback(async () => {
    if (html5QrRef.current) {
      try {
        await html5QrRef.current.stop();
        html5QrRef.current.clear();
      } catch { /* ignore */ }
      html5QrRef.current = null;
    }
    setScanning(false);
  }, []);

  const processStudent = useCallback(async (studentId) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    setDuplicateWarning('');
    try {
      const scanResult = await api.receptionScan(studentId.trim());
      if (scanResult.duplicate) {
        setDuplicateWarning(scanResult.message);
        toast(scanResult.message, { icon: '⚠️', duration: 5000 });
        return;
      }
      setResult(scanResult);
      toast.success('Arrival logged');
      await loadSummary();
      setManualEntry(false);
      setStudentIdInput('');
      await stopScanner();
    } catch (err) {
      toast.error(err.message || 'Scan failed');
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  }, [loadSummary, stopScanner]);

  const handleScan = useCallback(async (decodedText) => {
    if (!decodedText?.trim()) return;
    let studentId;
    try {
      // Old format: JSON payload {"student_id": "S0002", ...}
      const data = JSON.parse(decodedText);
      studentId = data.student_id;
    } catch {
      // New format: plain student_id string e.g. "S0002"
      studentId = decodedText.trim();
    }
    if (!studentId) {
      toast.error('Invalid QR code');
      return;
    }
    await processStudent(studentId);
  }, [processStudent]);

  const startScanner = async () => {
    setManualEntry(false);
    setResult(null);
    setDuplicateWarning('');
    setScanning(true);
    await new Promise((r) => setTimeout(r, 100));
    const scanner = new Html5Qrcode('reception-qr-reader');
    html5QrRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 280, height: 280 } },
        handleScan,
        () => {}
      );
    } catch {
      toast.error('Camera access denied');
      setScanning(false);
    }
  };

  if (!loggedIn) {
    return <ReceptionLogin onLogin={() => setLoggedIn(true)} />;
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="bg-primary text-white p-4 shadow-lg flex justify-between items-center relative">
        <div>
          <h1 className="text-2xl font-bold">{t('reception.loginTitle')}</h1>
          <p className="text-blue-100 text-sm">Reception | {SCHOOL_NAME}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button 
            onClick={toggleLang}
            className="bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded-full text-sm font-bold transition"
          >
            {lang === 'en' ? 'తెలుగు' : 'English'}
          </button>
          <button
            onClick={() => { sessionStorage.removeItem('reception_auth'); setLoggedIn(false); }}
            className="text-sm bg-white/20 px-3 py-1 rounded-lg"
          >
            {t('common.logout')}
          </button>
        </div>
      </div>

      {summary && (
        <div className="p-4 bg-white border-b grid grid-cols-2 gap-3 max-w-2xl mx-auto">
          <div className="bg-green-50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-paid">{summary.totalArrived}</p>
            <p className="text-sm text-slate-600">{t('reception.arrivedToday')}</p>
          </div>
          <div className="bg-orange-50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-orange-600">{summary.missedScans}</p>
            <p className="text-sm text-slate-600">{t('reception.missedScans')}</p>
          </div>
          {summary.busesWithMissed?.length > 0 && (
            <div className="col-span-2 bg-orange-50 rounded-xl p-3">
              <p className="text-sm font-semibold text-orange-800 mb-2">{t('reception.busesWithMissed')}</p>
              <div className="flex flex-wrap gap-2">
                {summary.busesWithMissed.map((b) => (
                  <span key={b.bus_number} className="bg-orange-200 text-orange-900 px-3 py-1 rounded-full text-sm font-medium">
                    {formatBusNumber(b.bus_number)} ({b.count})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="p-4 max-w-2xl mx-auto">
        {duplicateWarning && !result && (
          <div className="mb-4 bg-amber-100 border-2 border-amber-400 text-amber-900 rounded-xl p-4 font-semibold">
            {duplicateWarning}
          </div>
        )}

        {result && !scanning && !manualEntry && (
          <ArrivalResult result={result} onDismiss={() => setResult(null)} />
        )}

        {scanning ? (
          <div>
            <div id="reception-qr-reader" className="rounded-xl overflow-hidden" />
            {processing && <div className="flex justify-center mt-4"><Spinner /></div>}
            <button onClick={stopScanner} className="mt-4 w-full bg-due text-white font-bold py-4 rounded-xl">
              {t('common.cancel')}
            </button>
          </div>
        ) : manualEntry ? (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold mb-4">{t('reception.manualEntry')}</h2>
            <form onSubmit={(e) => { e.preventDefault(); processStudent(studentIdInput); }} className="space-y-4">
              <input
                type="text"
                value={studentIdInput}
                onChange={(e) => setStudentIdInput(e.target.value)}
                className="w-full p-4 rounded-xl text-lg border-2 border-slate-200 font-semibold"
                placeholder="Student ID"
                autoFocus
                required
              />
              <button type="submit" disabled={processing} className="w-full bg-primary text-white font-bold py-4 rounded-xl">
                {processing ? <Spinner size="sm" /> : t('common.submit')}
              </button>
              <button type="button" onClick={() => setManualEntry(false)} className="w-full bg-slate-200 py-3 rounded-xl font-bold">
                {t('common.cancel')}
              </button>
            </form>
          </div>
        ) : (
          !result && (
            <div className="space-y-4 mt-4">
              <button
                onClick={startScanner}
                className="w-full bg-primary text-white font-bold py-10 rounded-2xl text-2xl shadow-xl flex flex-col items-center gap-2"
              >
                <span className="text-5xl">📷</span>
                {t('reception.scanNext')}
              </button>
              <button
                onClick={() => { setManualEntry(true); setResult(null); }}
                className="w-full bg-white text-primary font-bold py-5 rounded-2xl text-xl border-2 border-primary"
              >
                ⌨️ {t('reception.manualEntry')}
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
