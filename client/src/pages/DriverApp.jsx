import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import toast from 'react-hot-toast';
import { api, todayStr } from '../api';
import { formatBusNumber, busesMatch, FEE_ALERT_MESSAGE } from '../utils';
import Spinner from '../components/Spinner';

function DriverLogin({ onLogin }) {
  const [busNumber, setBusNumber] = useState('');
  const [pin, setPin] = useState('');
  const [buses, setBuses] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getDriverBuses().then((d) => setBuses(d.buses || [])).catch(() => {});
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await api.driverLogin(pin, busNumber);
      if (result.success) {
        onLogin(result.busNumber);
        toast.success(`Logged in to ${result.busNumber}`);
      }
    } catch {
      toast.error('Invalid PIN for this bus');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
      <div className="text-5xl mb-4">🚌</div>
      <h1 className="text-2xl font-bold text-white mb-6">Driver Login</h1>
      <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4">
        <div>
          <label className="text-blue-200 text-sm font-medium block mb-1">Bus Number</label>
          <select
            value={busNumber}
            onChange={(e) => setBusNumber(e.target.value)}
            className="w-full p-4 rounded-xl text-lg bg-white text-slate-900 font-bold"
            required
          >
            <option value="">Select Bus</option>
            {buses.map((b) => (
              <option key={b} value={b}>{formatBusNumber(b)}</option>
            ))}
            {buses.length === 0 &&
              Array.from({ length: 44 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{formatBusNumber(n)}</option>
              ))}
          </select>
        </div>
        <div>
          <label className="text-blue-200 text-sm font-medium block mb-1">4-Digit PIN</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            className="w-full p-4 rounded-xl text-2xl text-center tracking-widest bg-white text-slate-900 font-bold"
            placeholder="••••"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-white font-bold py-4 rounded-xl text-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <Spinner size="sm" /> : 'Login'}
        </button>
      </form>
      <p className="text-blue-300 text-xs mt-6 text-center">
        Default PIN for Bus N is 000N (e.g. Bus 1 → 0001)
      </p>
    </div>
  );
}

function BoardingResult({ student, feeAlert, isCrossBus, actualBus, assignedBus, onDismiss }) {
  const isDue = feeAlert;
  const isPaid = !isDue;

  if (isCrossBus) {
    const crossBusClass = isPaid ? 'bg-paid' : 'bg-due';
    return (
      <div>
        <div className={`rounded-2xl p-6 text-white shadow-xl ${crossBusClass}`}>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-3xl">
              🔵
            </div>
            <div>
              <h2 className="text-2xl font-bold">{student.name} — Different Bus</h2>
              <p className="text-white/80">Class {student.class}</p>
            </div>
          </div>
          <div className={`rounded-xl p-4 text-left space-y-2 text-sm ${isPaid ? 'bg-white/10 border border-white/20' : 'bg-white/10 border border-red-300'}`}>
            <p><span className="font-semibold">Regular Bus:</span> {assignedBus}</p>
            <p><span className="font-semibold">Boarding Today:</span> {actualBus}</p>
            <p><span className="font-semibold">Fee Status:</span> {isDue ? 'DUE' : 'PAID'}</p>
          </div>
          <button
            onClick={onDismiss}
            className="mt-4 w-full bg-white/20 py-3 rounded-xl font-semibold hover:bg-white/30"
          >
            Board Next Student
          </button>
        </div>
      </div>
    );
  }

  /* duplicate isPaid removed */
  return (
    <div>
      <div className={`rounded-2xl p-6 text-white shadow-xl ${isPaid ? 'bg-paid' : 'bg-due'}`}>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-3xl">
            {isPaid ? '✅' : '⚠️'}
          </div>
          <div>
            <h2 className="text-2xl font-bold">{student.name}</h2>
            <p className="text-white/80">Class {student.class} | {formatBusNumber(student.bus_number)}</p>
          </div>
        </div>
        <div className="bg-white/20 rounded-xl p-4 text-center">
          <p className="text-xl font-bold">
            {isPaid ? 'Fee Paid - Allow boarding' : 'Fee Due - Amount pending'}
          </p>
          <p className="text-sm mt-1 text-white/80">Stop: {student.stop_name}</p>
        </div>
        <button
          onClick={onDismiss}
          className="mt-4 w-full bg-white/20 py-3 rounded-xl font-semibold hover:bg-white/30"
        >
          Board Next Student
        </button>
      </div>
      {feeAlert && (
        <div className="mt-4 bg-due text-white rounded-xl p-4 border-2 border-red-800 shadow-lg">
          <p className="font-bold text-lg">{FEE_ALERT_MESSAGE}</p>
        </div>
      )}
    </div>
  );
}

function DropoffResult({ student, onDismiss }) {
  return (
    <div className="rounded-2xl p-6 text-white shadow-xl bg-primary">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-3xl">📍</div>
        <div>
          <h2 className="text-2xl font-bold">{student.name} has been dropped off</h2>
          <p className="text-blue-100">Class {student.class} | {formatBusNumber(student.bus_number)}</p>
        </div>
      </div>
      <div className="bg-white/20 rounded-xl p-4 text-center">
        <p className="text-xl font-bold">📍 {student.name} has been dropped off</p>
        <p className="text-sm mt-1 text-blue-100">Stop: {student.stop_name}</p>
      </div>
      <button
        onClick={onDismiss}
        className="mt-4 w-full bg-white/20 py-3 rounded-xl font-semibold hover:bg-white/30"
      >
        Scan Next Student
      </button>
    </div>
  );
}

export default function DriverApp() {
  const [loggedIn, setLoggedIn] = useState(() => sessionStorage.getItem('driver_bus'));
  const [boardedCount, setBoardedCount] = useState(0);
  const [dropoffCount, setDropoffCount] = useState(0);
  const [scanMode, setScanMode] = useState({ scanType: 'boarding', isDropoff: false });
  const [busInfo, setBusInfo] = useState(null);
  const [startingBus, setStartingBus] = useState(false);
  const [stoppingBus, setStoppingBus] = useState(false);
  const [startingReturn, setStartingReturn] = useState(false);
  const [stoppingReturn, setStoppingReturn] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const [studentIdInput, setStudentIdInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const [driverName, setDriverName] = useState('');
  const scannerRef = useRef(null);
  const html5QrRef = useRef(null);
  const processingRef = useRef(false);

  const morningRunning = busInfo?.current_status === 'morning_running';
  const returnRunning = busInfo?.current_status === 'return_running';

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

  const today = new Date().toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const loadCounts = useCallback(async () => {
    if (!loggedIn) return;
    try {
      const attendance = await api.getAttendance(todayStr());
      const boarded = attendance.filter(
        (a) => busesMatch(a.bus_number, loggedIn) && a.scan_type === 'boarding'
      ).length;
      const dropped = attendance.filter(
        (a) => busesMatch(a.bus_number, loggedIn) && a.scan_type === 'dropoff'
      ).length;
      setBoardedCount(boarded);
      setDropoffCount(dropped);
    } catch { /* ignore */ }
  }, [loggedIn]);

  const loadBusInfo = useCallback(async () => {
    if (!loggedIn) return;
    try {
      const bus = await api.getBus(loggedIn);
      setBusInfo(bus);
      setDriverName(bus.driver_name || 'Driver');
    } catch { /* ignore */ }
  }, [loggedIn]);

  const loadScanMode = useCallback(async () => {
    if (!loggedIn) return;
    try {
      const mode = await api.getScanMode(loggedIn);
      setScanMode(mode);
    } catch { /* ignore */ }
  }, [loggedIn]);

  useEffect(() => {
    if (!loggedIn) return;
    loadBusInfo();
    loadCounts();
    loadScanMode();
    const modeInterval = setInterval(() => {
      loadBusInfo();
      loadScanMode();
    }, 60000);
    return () => clearInterval(modeInterval);
  }, [loggedIn, loadCounts, loadScanMode, loadBusInfo]);

  useEffect(() => {
    if (!loggedIn) return;
    const sendLocation = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          api.updateBusLocation(loggedIn, pos.coords.latitude, pos.coords.longitude).catch(() => {});
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000 }
      );
    };
    sendLocation();
    const interval = setInterval(sendLocation, 60000);
    return () => clearInterval(interval);
  }, [loggedIn]);

  const processStudent = useCallback(async (studentId) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    setDuplicateWarning('');
    try {
      const scanResult = await api.scan({
        student_id: studentId.trim(),
        bus_number: loggedIn,
        driver_name: driverName,
      });

      if (scanResult.duplicate) {
        setDuplicateWarning(scanResult.message);
        toast(scanResult.message, { icon: '⚠️', duration: 5000 });
        return;
      }

      setResult({
        student: scanResult.student,
        scanType: scanResult.scan_type,
        feeAlert: scanResult.feeAlert,
        isCrossBus: scanResult.isCrossBus,
        actualBus: scanResult.record?.actual_bus || loggedIn,
        assignedBus: scanResult.record?.assigned_bus || formatBusNumber(scanResult.student.bus_number),
      });
      
      await loadCounts();
      setManualEntry(false);
      setStudentIdInput('');
      await stopScanner();
    } catch (err) {
      toast.error(err.message || 'Submission failed');
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  }, [loggedIn, driverName, loadCounts, stopScanner]);

  const handleScan = useCallback(async (decodedText) => {
    if (!decodedText?.trim()) return;
    let studentId;
    try {
      // Old format: JSON payload  {"student_id": "S1234", ...}
      const data = JSON.parse(decodedText);
      studentId = data.student_id;
    } catch {
      // New format: plain student_id string e.g. "S1884"
      studentId = decodedText.trim();
    }
    if (!studentId) {
      toast.error('Invalid QR code');
      return;
    }
    await processStudent(studentId);
  }, [processStudent]);

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!studentIdInput.trim()) {
      toast.error('Enter a student ID');
      return;
    }
    await processStudent(studentIdInput);
  };

  const handleStartReturn = async () => {
    setStartingReturn(true);
    try {
      await api.startReturnJourney(loggedIn, driverName);
      await loadBusInfo();
      await loadScanMode();
      
    } catch (err) {
      toast.error(err.message || 'Failed to start return journey');
    } finally {
      setStartingReturn(false);
    }
  };

  const handleStopReturn = async () => {
    setStoppingReturn(true);
    try {
      await api.stopReturnJourney(loggedIn, driverName);
      await loadBusInfo();
      await loadScanMode();
      toast.success('Return journey ended ✅');
    } catch (err) {
      toast.error(err.message || 'Failed to stop return journey');
    } finally {
      setStoppingReturn(false);
    }
  };

  const handleStartBus = async () => {
    setStartingBus(true);
    try {
      await api.startBus(loggedIn, driverName);
      await loadBusInfo();
      
    } catch (err) {
      toast.error(err.message || 'Failed to start bus');
    } finally {
      setStartingBus(false);
    }
  };

  const handleStopBus = async () => {
    setStoppingBus(true);
    try {
      await api.stopBus(loggedIn, driverName);
      await loadBusInfo();
      await loadScanMode();
      toast.success('Morning trip ended ✅');
    } catch (err) {
      toast.error(err.message || 'Failed to stop bus');
    } finally {
      setStoppingBus(false);
    }
  };

  const startScanner = async () => {
    setManualEntry(false);
    setStudentIdInput('');
    setDuplicateWarning('');
    setScanning(true);
    setResult(null);
    await new Promise((r) => setTimeout(r, 100));
    const scanner = new Html5Qrcode('qr-reader');
    html5QrRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        handleScan,
        () => {}
      );
    } catch {
      toast.error('Camera access denied or unavailable');
      setScanning(false);
    }
  };

  const openManualEntry = () => {
    stopScanner();
    setResult(null);
    setDuplicateWarning('');
    setStudentIdInput('');
    setManualEntry(true);
  };

  const handleLogout = () => {
    stopScanner();
    setManualEntry(false);
    sessionStorage.removeItem('driver_bus');
    setLoggedIn(null);
  };

  const dismissResult = () => {
    setResult(null);
    setDuplicateWarning('');
  };

  if (!loggedIn) {
    return (
      <DriverLogin
        onLogin={(bus) => {
          const formatted = formatBusNumber(bus);
          sessionStorage.setItem('driver_bus', formatted);
          setLoggedIn(formatted);
        }}
      />
    );
  }

  const isDropoff = scanMode.isDropoff;
  const isReturn = scanMode.journeyType === 'return' || scanMode.currentStatus === 'return_running';

  const modeLabel = isDropoff
    ? '📍 Drop-off Mode'
    : isReturn
      ? '🔄 Return Boarding Mode'
      : '✅ Morning Boarding Mode';

  const modeClass = isDropoff
    ? 'bg-blue-100 text-primary'
    : isReturn
      ? 'bg-purple-100 text-purple-800'
      : 'bg-green-100 text-paid';

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="bg-primary text-white p-4 shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">{formatBusNumber(loggedIn)}</h1>
            <p className="text-blue-100 text-sm">{driverName}</p>
          </div>
          <button onClick={handleLogout} className="text-sm bg-white/20 px-3 py-1 rounded-lg">
            Logout
          </button>
        </div>
        <p className="text-blue-100 text-xs mt-1">{today}</p>
      </div>

      <div className="flex text-white text-center font-bold text-sm">
        <div className="flex-1 bg-paid py-3">Boarded: {boardedCount}</div>
        <div className="flex-1 bg-primary py-3">Dropped: {dropoffCount}</div>
      </div>

      <div className={`text-center py-2 text-sm font-semibold ${modeClass}`}>
        {modeLabel}
      </div>

      <div className="p-4 max-w-lg mx-auto">
        {!scanning && !manualEntry && !result && (
          <div className="mb-4 space-y-3">
            <div className="flex gap-2">
              {morningRunning ? (
                <div className="flex-1 bg-paid text-white font-bold py-4 rounded-xl text-center text-sm md:text-base flex items-center justify-center">
                  Morning Bus Running 🟢
                </div>
              ) : (
                <button
                  onClick={handleStartBus}
                  disabled={startingBus || stoppingBus}
                  className="flex-1 bg-amber-500 text-white font-bold py-4 rounded-xl text-lg hover:bg-amber-600 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {startingBus ? <Spinner size="sm" /> : '🚌 Start Bus'}
                </button>
              )}
              {morningRunning && (
                <button
                  onClick={handleStopBus}
                  disabled={stoppingBus}
                  className="flex-1 bg-orange-600 text-white font-bold py-4 rounded-xl text-lg hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {stoppingBus ? <Spinner size="sm" /> : '🛑 Stop Bus'}
                </button>
              )}
            </div>

            <div className="flex gap-2">
              {returnRunning ? (
                <div className="flex-1 bg-primary text-white font-bold py-4 rounded-xl text-center text-sm md:text-base flex items-center justify-center">
                  Return Journey Started 🟢
                </div>
              ) : (
                <button
                  onClick={handleStartReturn}
                  disabled={startingReturn || stoppingReturn}
                  className="flex-1 bg-indigo-600 text-white font-bold py-4 rounded-xl text-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {startingReturn ? <Spinner size="sm" /> : '🔄 Start Return Journey'}
                </button>
              )}
              {returnRunning && (
                <button
                  onClick={handleStopReturn}
                  disabled={stoppingReturn}
                  className="flex-1 bg-red-600 text-white font-bold py-4 rounded-xl text-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {stoppingReturn ? <Spinner size="sm" /> : '🛑 Stop Return Journey'}
                </button>
              )}
            </div>
          </div>
        )}

        {duplicateWarning && !result && (
          <div className="mb-4 bg-amber-100 border-2 border-amber-400 text-amber-900 rounded-xl p-4 font-semibold">
            {duplicateWarning}
          </div>
        )}

        {result && !scanning && !manualEntry && (
          result.scanType === 'dropoff' ? (
            <DropoffResult student={result.student} onDismiss={dismissResult} />
          ) : (
            <BoardingResult
              student={result.student}
              feeAlert={result.feeAlert}
              isCrossBus={result.isCrossBus}
              actualBus={result.actualBus}
              assignedBus={result.assignedBus}
              onDismiss={dismissResult}
            />
          )
        )}

        {scanning ? (
          <div className="mt-4">
            <div id="qr-reader" ref={scannerRef} className="rounded-xl overflow-hidden" />
            {processing && (
              <div className="flex justify-center mt-4">
                <Spinner />
                <span className="ml-2 text-slate-600">Processing...</span>
              </div>
            )}
            <button
              onClick={stopScanner}
              className="mt-4 w-full bg-due text-white font-bold py-4 rounded-xl text-lg"
            >
              Cancel Scan
            </button>
          </div>
        ) : manualEntry ? (
          <div className="mt-4 bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Manual Entry</h2>
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-600 block mb-1">Student ID</label>
                <input
                  type="text"
                  value={studentIdInput}
                  onChange={(e) => setStudentIdInput(e.target.value)}
                  className="w-full p-4 rounded-xl text-lg border-2 border-slate-200 focus:border-primary focus:outline-none font-semibold"
                  placeholder="e.g. STU001"
                  autoFocus
                  required
                />
              </div>
              <button
                type="submit"
                disabled={processing}
                className="w-full bg-primary text-white font-bold py-4 rounded-xl text-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {processing ? <Spinner size="sm" /> : 'Submit'}
              </button>
              <button
                type="button"
                onClick={() => { setManualEntry(false); setStudentIdInput(''); setDuplicateWarning(''); }}
                className="w-full bg-slate-200 text-slate-700 font-bold py-3 rounded-xl"
              >
                Cancel
              </button>
            </form>
          </div>
        ) : (
          !result && (
            <div className="mt-4 space-y-4">
              <button
                onClick={startScanner}
                className="w-full bg-primary text-white font-bold py-8 rounded-2xl text-2xl shadow-xl hover:bg-blue-700 flex flex-col items-center gap-2"
              >
                <span className="text-5xl">📷</span>
                {isDropoff ? 'Scan for Drop-off' : 'Scan Student QR'}
              </button>
              <button
                onClick={openManualEntry}
                className="w-full bg-white text-primary font-bold py-5 rounded-2xl text-xl shadow-lg border-2 border-primary hover:bg-blue-50 flex flex-col items-center gap-1"
              >
                <span className="text-3xl">⌨️</span>
                Manual Entry
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
