import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import toast from 'react-hot-toast';
import { api, todayStr } from '../api';
import { formatBusNumber, busesMatch, FEE_ALERT_MESSAGE, getFeeStatusDetails } from '../utils';
import Spinner from '../components/Spinner';
import { useLanguage } from '../contexts/LanguageContext';

function DriverLogin({ onLogin }) {
  const { t } = useLanguage();
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
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-slate-900">
      <div className="text-5xl mb-4">🚌</div>
      <h1 className="text-2xl font-bold text-white mb-6">{t('driver.loginTitle')}</h1>
      <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4">
        <div>
          <label className="text-blue-200 text-sm font-medium block mb-1">{t('driver.busSelect')}</label>
          <select
            value={busNumber}
            onChange={(e) => setBusNumber(e.target.value)}
            className="w-full p-4 rounded-xl text-lg bg-white text-slate-900 font-bold"
            required
          >
            <option value="">{t('driver.busSelect')}</option>
            {buses.map((b) => (
              <option key={b} value={b}>{formatBusNumber(b)}</option>
            ))}
            {buses.length === 0 &&
              Array.from({ length: 18 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{formatBusNumber(n)}</option>
              ))}
          </select>
        </div>
        <div>
          <label className="text-blue-200 text-sm font-medium block mb-1">{t('driver.enterPin')}</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            className="w-full p-4 rounded-xl text-2xl text-center tracking-widest bg-white text-slate-900 font-bold"
            placeholder={t('driver.pinPlaceholder')}
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-white font-bold py-4 rounded-xl text-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <Spinner size="sm" /> : t('driver.loginBtn')}
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
  const details = getFeeStatusDetails(student);
  const isExpiringSoon = details.status === 'EXPIRING_SOON';

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
            <p><span className="font-semibold">Fee Status:</span> {isDue ? 'DUE' : isExpiringSoon ? 'EXPIRING SOON' : 'PAID'}</p>
          </div>
          <button
            onClick={onDismiss}
            className="mt-4 w-full bg-white/20 py-3 rounded-xl font-semibold hover:bg-white/30"
          >
            Board Next Student
          </button>
        </div>
        {isExpiringSoon && (
          <div className="mt-4 bg-amber-500 text-white rounded-xl p-4 border-2 border-amber-600 shadow-lg text-center font-bold">
            ⚠️ Fee Expiring Soon — Please pay within 3 days.
          </div>
        )}
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
            {isPaid ? (isExpiringSoon ? 'Fee Expiring Soon' : 'Fee Paid - Allow boarding') : 'Fee Due - Amount pending'}
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
      {isExpiringSoon && (
        <div className="mt-4 bg-amber-500 text-white rounded-xl p-4 border-2 border-amber-600 shadow-lg text-center font-bold">
          ⚠️ Fee Expiring Soon — Please pay within 3 days.
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
  const { t } = useLanguage();
  const [loggedIn, setLoggedIn] = useState(() => sessionStorage.getItem('driver_bus'));
  const [boardedCount, setBoardedCount] = useState(0);
  const [dropoffCount, setDropoffCount] = useState(0);
  const [scanMode, setScanMode] = useState({ scanType: 'boarding', isDropoff: false });
  const [busInfo, setBusInfo] = useState(null);
  const [startingBus, setStartingBus] = useState(false);
  const [stoppingBus, setStoppingBus] = useState(false);
  const [startingReturn, setStartingReturn] = useState(false);
  const [stoppingReturn, setStoppingReturn] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showStopModal, setShowStopModal] = useState(false);
  const [startModalType, setStartModalType] = useState(''); // 'morning' or 'return'
  const [stopModalType, setStopModalType] = useState(''); // 'morning' or 'return'
  const [fuelInput, setFuelInput] = useState('');
  const [reasonInput, setReasonInput] = useState('1. Pick up');
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
  const [scannerType, setScannerType] = useState(() => localStorage.getItem('driver_scanner_type') || 'camera');
  const keyBuffer = useRef('');
  const bufferTimeout = useRef(null);

  const [odometerFormOpen, setOdometerFormOpen] = useState(false);
  const [odoReading, setOdoReading] = useState('');
  const [odoLiters, setOdoLiters] = useState('');
  const [odoReason, setOdoReason] = useState('Starting for pickup');
  const [odoRefueled, setOdoRefueled] = useState(false);
  const [odoBase64, setOdoBase64] = useState('');
  const [odoPreview, setOdoPreview] = useState('');
  const [submittingOdoLog, setSubmittingOdoLog] = useState(false);
  const [odometerStats, setOdometerStats] = useState(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [scanningOdo, setScanningOdo] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const loadOdometerStats = useCallback(async () => {
    if (!loggedIn) return;
    try {
      const stats = await api.getOdometerStats(loggedIn);
      setOdometerStats(stats);
    } catch (err) {
      console.error('Failed to load odometer stats:', err.message);
    }
  }, [loggedIn]);

  const startCamera = async () => {
    setCameraActive(true);
    setOdoPreview('');
    setOdoBase64('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera access failed:', err.message);
      toast.error('Could not access camera. Please check browser permissions.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const runOcr = async (base64Image) => {
    setScanningOdo(true);
    setOdoReading('');
    try {
      const res = await api.runOdometerOcr(base64Image);
      if (res.success && res.extractedReading !== '0') {
        setOdoReading(res.extractedReading);
        toast.success(`OCR Extracted: ${res.extractedReading} km`);
      } else {
        toast.error('Failed to auto-parse reading. Please verify image or type manually.');
      }
    } catch (err) {
      console.error('OCR failed:', err.message);
      toast.error('OCR scan failed.');
    } finally {
      setScanningOdo(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg');
      setOdoPreview(dataUrl);
      setOdoBase64(dataUrl);
      stopCamera();
      runOcr(dataUrl);
    }
  };

  const handleOdometerFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setOdoPreview(reader.result);
      setOdoBase64(reader.result);
      runOcr(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleOdometerSubmit = async (e) => {
    e.preventDefault();
    if (!odoBase64) {
      toast.error('Odometer photo is required');
      return;
    }
    setSubmittingOdoLog(true);
    try {
      const res = await api.uploadOdometerPhoto(
        loggedIn,
        odoBase64,
        driverName,
        odoReason,
        odoReading,
        odoReason === 'Fuel' ? odoRefueled : false,
        odoReason === 'Fuel' ? odoLiters : ''
      );
      if (res.success) {
        toast.success('Odometer & Fuel log submitted successfully!');
        setOdoReading('');
        setOdoLiters('');
        setOdoBase64('');
        setOdoPreview('');
        setOdometerFormOpen(false);
        await loadOdometerStats();
      } else {
        toast.error('Submission failed. Please try again.');
      }
    } catch (err) {
      toast.error('Submission failed: ' + err.message);
    } finally {
      setSubmittingOdoLog(false);
    }
  };

  const handleScannerTypeChange = (type) => {
    setScannerType(type);
    localStorage.setItem('driver_scanner_type', type);
    if (type === 'bluetooth') {
      stopScanner().catch(() => {});
    }
  };

  const pairBluetoothDevice = async () => {
    try {
      if (!navigator.bluetooth) {
        toast.error('Web Bluetooth is not supported by your browser/OS.');
        return;
      }
      await navigator.bluetooth.requestDevice({ acceptAllDevices: true });
      toast.success('Scanner permission granted');
    } catch (err) {
      toast.error('Bluetooth pairing cancelled or failed: ' + err.message);
    }
  };

  const [uploadingOdometer, setUploadingOdometer] = useState(false);

  const handleOdometerPhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingOdometer(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = reader.result;
        try {
          const res = await api.uploadOdometerPhoto(loggedIn, base64Data, driverName);
          if (res.success) {
            setFuelInput(res.extractedReading);
            toast.success(`OCR Extracted digits: ${res.extractedReading}`);
          } else {
            toast.error('Failed to parse odometer. Please enter manually.');
          }
        } catch (err) {
          toast.error('Odometer upload error: ' + err.message);
        } finally {
          setUploadingOdometer(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      toast.error('Failed to read image file');
      setUploadingOdometer(false);
    }
  };

  const morningRunning = busInfo?.current_status === 'morning_running';
  const returnRunning = busInfo?.current_status === 'return_running';

  async function stopScanner() {
    if (html5QrRef.current) {
      try {
        await html5QrRef.current.stop();
        html5QrRef.current.clear();
      } catch { /* ignore */ }
      html5QrRef.current = null;
    }
    setScanning(false);
  }

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
    loadOdometerStats();
    const modeInterval = setInterval(() => {
      loadBusInfo();
      loadScanMode();
      loadOdometerStats();
    }, 60000);
    return () => clearInterval(modeInterval);
  }, [loggedIn, loadCounts, loadScanMode, loadBusInfo, loadOdometerStats]);

  const isTripActive = morningRunning || returnRunning;

  useEffect(() => {
    if (!loggedIn || !isTripActive) return;

    let wakeLock = null;
    const acquireWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
          console.log('[WakeLock] Screen Wake Lock is active');
        }
      } catch (err) {
        console.warn(`[WakeLock] Failed to acquire: ${err.message}`);
      }
    };

    const releaseWakeLock = () => {
      if (wakeLock) {
        wakeLock.release().catch(() => {});
        wakeLock = null;
        console.log('[WakeLock] Screen Wake Lock released');
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        acquireWakeLock();
      }
    };

    // Request wake lock initially
    acquireWakeLock();
    document.addEventListener('visibilitychange', handleVisibilityChange);

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
    const interval = setInterval(sendLocation, 10000);

    return () => {
      clearInterval(interval);
      releaseWakeLock();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loggedIn, isTripActive]);

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
      
      setManualEntry(false);
      setStudentIdInput('');
      
      // Stop scanner and load counts in background to eliminate UI lag
      stopScanner().catch(() => {});
      loadCounts().catch(() => {});

      // Auto-reopen scanner if fee is paid
      if (!scanResult.feeAlert) {
        setTimeout(() => {
          setResult(null);
          setDuplicateWarning('');
          startScanner();
        }, 1500);
      }
    } catch (err) {
      toast.error(err.message || 'Submission failed');
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  }, [loggedIn, driverName, loadCounts, stopScanner]);

  useEffect(() => {
    if (!loggedIn || scannerType !== 'bluetooth' || result || scanning || manualEntry) return;

    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'Enter') {
        const studentId = keyBuffer.current.trim();
        keyBuffer.current = '';
        if (studentId) {
          e.preventDefault();
          processStudent(studentId);
        }
        return;
      }

      if (e.key.length !== 1) return;

      if (bufferTimeout.current) clearTimeout(bufferTimeout.current);
      bufferTimeout.current = setTimeout(() => {
        keyBuffer.current = '';
      }, 1000);

      keyBuffer.current += e.key;
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (bufferTimeout.current) clearTimeout(bufferTimeout.current);
    };
  }, [loggedIn, scannerType, result, scanning, manualEntry, processStudent]);

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

  const executeStartJourney = async (fuel, reason, type) => {
    if (type === 'morning') {
      setStartingBus(true);
      try {
        await api.startBus(loggedIn, driverName, fuel, reason);
        await loadBusInfo();
        toast.success('Morning journey started 🟢');
        setShowStartModal(false);
      } catch (err) {
        toast.error(err.message || 'Failed to start bus');
      } finally {
        setStartingBus(false);
      }
    } else {
      setStartingReturn(true);
      try {
        await api.startReturnJourney(loggedIn, driverName, fuel, reason);
        await loadBusInfo();
        await loadScanMode();
        toast.success('Return journey started 🟢');
        setShowStartModal(false);
      } catch (err) {
        toast.error(err.message || 'Failed to start return journey');
      } finally {
        setStartingReturn(false);
      }
    }
  };

  const executeStopJourney = async (fuel, type) => {
    if (type === 'morning') {
      setStoppingBus(true);
      try {
        await api.stopBus(loggedIn, driverName, fuel);
        await loadBusInfo();
        await loadScanMode();
        toast.success('Morning trip ended 🟢');
        setShowStopModal(false);
      } catch (err) {
        toast.error(err.message || 'Failed to stop bus');
      } finally {
        setStoppingBus(false);
      }
    } else {
      setStoppingReturn(true);
      try {
        await api.stopReturnJourney(loggedIn, driverName, fuel);
        await loadBusInfo();
        await loadScanMode();
        toast.success('Return journey ended 🟢');
        setShowStopModal(false);
      } catch (err) {
        toast.error(err.message || 'Failed to stop return journey');
      } finally {
        setStoppingReturn(false);
      }
    }
  };

  const handleStartBusClick = () => {
    executeStartJourney('N/A', '1. Pick up', 'morning');
  };

  const handleStartReturnClick = () => {
    executeStartJourney('N/A', '2. Drop', 'return');
  };

  const handleStopBusClick = () => {
    executeStopJourney('N/A', 'morning');
  };

  const handleStopReturnClick = () => {
    executeStopJourney('N/A', 'return');
  };

  async function startScanner() {
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
    startScanner(); // Restart scanning automatically
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
            {t('driver.logout') || 'Logout'}
          </button>
        </div>
        <p className="text-blue-100 text-xs mt-1">{today}</p>
      </div>

      <div className="flex text-white text-center font-bold text-sm">
        <div className="flex-1 bg-paid py-3">{t('driver.boardedCount')} {boardedCount}</div>
        <div className="flex-1 bg-primary py-3">{t('driver.droppedCount')} {dropoffCount}</div>
      </div>

      <div className={`text-center py-2 text-sm font-semibold ${modeClass}`}>
        {modeLabel}
      </div>

      <div className="p-4 max-w-lg mx-auto">
        {busInfo?.activeJourney && (
          <div className="mb-4 bg-white rounded-2xl p-4 shadow border border-slate-200 text-left text-slate-800 animate-fadeIn">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">📋 Current Trip Info</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="font-semibold block text-slate-500">Trip Purpose</span>
                <span className="font-bold text-slate-800">{busInfo.activeJourney.reason}</span>
              </div>
              <div>
                <span className="font-semibold block text-slate-500">Start Odometer</span>
                <span className="font-bold text-slate-800">{busInfo.activeJourney.start_fuel}</span>
              </div>
            </div>
          </div>
        )}

        {!scanning && !manualEntry && !result && (
          <div className="mb-4 space-y-3">
            <div className="flex gap-2">
              {morningRunning ? (
                <div className="flex-1 bg-paid text-white font-bold py-4 rounded-xl text-center text-sm md:text-base flex items-center justify-center">
                  {t('driver.morningBusRunning')}
                </div>
              ) : (
                <button
                  onClick={handleStartBusClick}
                  disabled={startingBus || stoppingBus}
                  className="flex-1 bg-amber-500 text-white font-bold py-4 rounded-xl text-lg hover:bg-amber-600 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {startingBus ? <Spinner size="sm" /> : `🚌 ${t('driver.startMorning')}`}
                </button>
              )}
              {morningRunning && (
                <button
                  onClick={handleStopBusClick}
                  disabled={stoppingBus}
                  className="flex-1 bg-orange-600 text-white font-bold py-4 rounded-xl text-lg hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {stoppingBus ? <Spinner size="sm" /> : `🛑 ${t('driver.stopBus')}`}
                </button>
              )}
            </div>

            <div className="flex gap-2">
              {returnRunning ? (
                <div className="flex-1 bg-primary text-white font-bold py-4 rounded-xl text-center text-sm md:text-base flex items-center justify-center">
                  {t('driver.returnJourneyStarted')}
                </div>
              ) : (
                <button
                  onClick={handleStartReturnClick}
                  disabled={startingReturn || stoppingReturn}
                  className="flex-1 bg-indigo-600 text-white font-bold py-4 rounded-xl text-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {startingReturn ? <Spinner size="sm" /> : `🔄 ${t('driver.startReturn')}`}
                </button>
              )}
              {returnRunning && (
                <button
                  onClick={handleStopReturnClick}
                  disabled={stoppingReturn}
                  className="flex-1 bg-red-600 text-white font-bold py-4 rounded-xl text-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {stoppingReturn ? <Spinner size="sm" /> : `🛑 ${t('driver.endJourney')}`}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ODOMETER & FUEL TRACKING PANEL */}
        {!scanning && !manualEntry && !result && (
          <div className="mb-4 bg-white rounded-2xl p-5 shadow border border-slate-200 text-slate-800 text-left animate-fadeIn">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-base font-bold text-slate-700 flex items-center gap-1.5">
                ⛽ Odometer & Fuel Tracker
              </h3>
              <div className="flex gap-1.5">
                <button
                  onClick={() => {
                    if (odometerFormOpen && odoReason === 'Starting for pickup') {
                      setOdometerFormOpen(false);
                    } else {
                      setOdometerFormOpen(true);
                      setOdoReason('Starting for pickup');
                      setOdoRefueled(false);
                    }
                  }}
                  className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg transition ${
                    odometerFormOpen && odoReason !== 'Fuel'
                      ? 'bg-primary text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  📝 Log Status
                </button>
                <button
                  onClick={() => {
                    if (odometerFormOpen && odoReason === 'Fuel') {
                      setOdometerFormOpen(false);
                    } else {
                      setOdometerFormOpen(true);
                      setOdoReason('Fuel');
                      setOdoRefueled(true);
                    }
                  }}
                  className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg transition ${
                    odometerFormOpen && odoReason === 'Fuel'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                  }`}
                >
                  ⛽ Refueled
                </button>
              </div>
            </div>

            {/* Quick Stats Display */}
            {odometerStats && (
              <div className="grid grid-cols-3 gap-2.5 mb-3 bg-slate-50 p-3 rounded-xl text-center text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">Current Odo</span>
                  <span className="font-bold text-slate-700 text-sm">{odometerStats.currentOdometer || 'N/A'} km</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Fuel Mileage</span>
                  <span className="font-bold text-slate-700 text-sm">
                    {odometerStats.mileage ? `${odometerStats.mileage} km/L` : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Last Refuel</span>
                  <span className="font-bold text-slate-700 text-sm">
                    {odometerStats.daysSinceLastRefuel != null 
                      ? `${odometerStats.daysSinceLastRefuel} d ago` 
                      : 'N/A'}
                  </span>
                </div>
              </div>
            )}

            {odometerFormOpen && (
              <form onSubmit={handleOdometerSubmit} className="space-y-3.5 border-t border-slate-100 pt-3.5 animate-fadeIn">
                {odoReason !== 'Fuel' && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">
                      Reason for Log
                    </label>
                    <select
                      value={odoReason}
                      onChange={(e) => setOdoReason(e.target.value)}
                      className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none"
                    >
                      <option value="Starting for pickup">Starting for pickup</option>
                      <option value="Returning for drop off">Returning for drop off</option>
                      <option value="Repair">Repair / Maintenance</option>
                      <option value="Main branch">Main branch</option>
                      <option value="Others">Others</option>
                    </select>
                  </div>
                )}

                {/* Webcam Live Feed */}
                {cameraActive && (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-300 bg-black aspect-video flex flex-col justify-end">
                    <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
                    <div className="relative z-10 p-3 bg-gradient-to-t from-black/80 to-transparent flex justify-between gap-2">
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="flex-1 bg-primary text-white font-bold py-2 rounded-xl text-xs hover:bg-primary/95"
                      >
                        🎯 Capture Photo
                      </button>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="bg-slate-700 text-white font-bold px-3 py-2 rounded-xl text-xs hover:bg-slate-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Odometer Photo Selection */}
                {!cameraActive && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center">
                    <span className="text-xs font-semibold text-slate-500 block mb-2.5">Odometer Photo Required</span>
                    <div className="flex justify-center gap-2">
                      <button
                        type="button"
                        onClick={startCamera}
                        className="flex-1 bg-primary text-white text-xs font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 hover:bg-primary/95 transition"
                      >
                        📷 Take Photo
                      </button>
                      <label className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition">
                        📁 Choose File
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handleOdometerFileChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                    {odoPreview && (
                      <div className="mt-3 relative rounded-lg overflow-hidden border border-slate-200 bg-slate-100 max-h-32 flex items-center justify-center">
                        <img src={odoPreview} alt="Odometer Preview" className="max-h-32 object-contain" />
                        <button
                          type="button"
                          onClick={() => { setOdoPreview(''); setOdoBase64(''); setOdoReading(''); }}
                          className="absolute top-1 right-1 bg-red-500/80 text-white text-[10px] px-1.5 py-0.5 rounded"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Extracted Reading Status */}
                {(scanningOdo || odoReading) && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-500">Odometer Reading:</span>
                    {scanningOdo ? (
                      <span className="text-primary font-bold animate-pulse flex items-center gap-1">
                        <Spinner size="sm" /> Scanning image...
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          required
                          value={odoReading}
                          onChange={(e) => setOdoReading(e.target.value)}
                          className="w-20 text-center font-mono font-bold bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-800"
                        />
                        <span className="font-semibold text-slate-500">km</span>
                      </div>
                    )}
                  </div>
                )}

                {odoReason === 'Fuel' && (
                  <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 block mb-1">
                        Liters Filled
                      </label>
                      <input
                        type="number"
                        step="any"
                        required
                        placeholder="e.g. 35.5"
                        value={odoLiters}
                        onChange={(e) => setOdoLiters(e.target.value)}
                        className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>

                    <div className="flex items-center gap-2 py-0.5">
                      <input
                        type="checkbox"
                        id="odoRefueledCheckbox"
                        checked={odoRefueled}
                        onChange={(e) => setOdoRefueled(e.target.checked)}
                        className="rounded text-primary focus:ring-primary/20 h-4 w-4"
                      />
                      <label htmlFor="odoRefueledCheckbox" className="text-xs text-slate-600 font-semibold cursor-pointer select-none">
                        Mark as Weekly Refueling Event (For Mileage)
                      </label>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submittingOdoLog || !odoBase64 || scanningOdo}
                  className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5 transition"
                >
                  {submittingOdoLog ? (
                    <>
                      <Spinner size="sm" /> Logging & Uploading Photo...
                    </>
                  ) : (
                    '📤 Submit Log'
                  )}
                </button>
              </form>
            )}
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
              {t('driver.cancelScan')}
            </button>
          </div>
        ) : manualEntry ? (
          <div className="mt-4 bg-white rounded-2xl shadow-xl p-6 text-slate-900 text-left">
            <h2 className="text-xl font-bold text-slate-800 mb-4">{t('driver.manualEntry')}</h2>
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-600 block mb-1">Student ID</label>
                <input
                  type="text"
                  value={studentIdInput}
                  onChange={(e) => setStudentIdInput(e.target.value)}
                  className="w-full p-4 rounded-xl text-lg border-2 border-slate-200 focus:border-primary focus:outline-none font-semibold bg-white text-slate-900"
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
                {processing ? <Spinner size="sm" /> : t('common.submit')}
              </button>
              <button
                type="button"
                onClick={() => { setManualEntry(false); setStudentIdInput(''); setDuplicateWarning(''); }}
                className="w-full bg-slate-200 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-300 transition"
              >
                {t('common.cancel')}
              </button>
            </form>
          </div>
        ) : (
          !result && (
            <div className="mt-4 space-y-4">
              {/* Scanner Mode Toggle */}
              <div className="bg-white rounded-2xl shadow p-4 flex justify-between items-center mb-2 text-slate-800">
                <span className="font-bold text-slate-700">Scanner Mode:</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleScannerTypeChange('camera')}
                    className={`px-4 py-2 rounded-xl font-semibold text-sm transition ${scannerType === 'camera' ? 'bg-primary text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    📷 Camera
                  </button>
                  <button
                    onClick={() => handleScannerTypeChange('bluetooth')}
                    className={`px-4 py-2 rounded-xl font-semibold text-sm transition ${scannerType === 'bluetooth' ? 'bg-primary text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    🔌 Bluetooth
                  </button>
                </div>
              </div>

              {scannerType === 'bluetooth' ? (
                <div className="w-full bg-slate-800 text-white font-bold py-8 px-4 rounded-2xl text-center shadow-xl border-2 border-slate-700 flex flex-col items-center gap-3">
                  <span className="text-5xl animate-pulse">🔌</span>
                  <div>
                    <p className="text-xl animate-fadeIn">Bluetooth Scanner Active</p>
                    <p className="text-xs font-normal text-slate-300 mt-2">
                      Ready to scan. Point your Bluetooth scanner at the student's QR code and pull the trigger.
                    </p>
                  </div>
                  <button
                    onClick={pairBluetoothDevice}
                    className="mt-2 text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg border border-white/10 transition"
                  >
                    Pair Scanner (Optional)
                  </button>
                </div>
              ) : (
                <button
                  onClick={startScanner}
                  className="w-full bg-primary text-white font-bold py-8 rounded-2xl text-2xl shadow-xl hover:bg-blue-700 flex flex-col items-center gap-2"
                >
                  <span className="text-5xl">📷</span>
                  {isDropoff ? t('driver.scanForDropoff') : t('driver.scanStudentQr')}
                </button>
              )}

              <button
                onClick={openManualEntry}
                className="w-full bg-white text-primary font-bold py-5 rounded-2xl text-xl shadow-lg border-2 border-primary hover:bg-blue-50 flex flex-col items-center gap-1"
              >
                <span className="text-3xl">⌨️</span>
                {t('driver.manualEntry')}
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
