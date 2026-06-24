const fs = require('fs');
let content = fs.readFileSync('src/pages/ReceptionScanner.jsx', 'utf8');

// 1. Rewrite processStudent logic to always show Result
const oldProcess = `  const processStudent = useCallback(async (studentId) => {
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
  }, [loadSummary, stopScanner]);`;

const newProcess = `  const processStudent = useCallback(async (studentId) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    setDuplicateWarning('');
    try {
      const scanResult = await api.receptionScan(studentId.trim());
      setResult(scanResult);
      if (scanResult.duplicate) {
        toast('Already scanned today', { icon: '⚠️', duration: 3000 });
      } else {
        toast.success('Arrival logged');
      }
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
  }, [loadSummary, stopScanner]);`;

content = content.replace(oldProcess, newProcess);

// 2. Rewrite ArrivalResult
const oldArrivalResult = content.substring(
  content.indexOf('function ArrivalResult({ result, onDismiss }) {'),
  content.indexOf('function ReceptionLogin({ onLogin }) {')
);

const newArrivalResult = `function ArrivalResult({ result, onDismiss }) {
  const { t } = useLanguage();
  
  // Logic from backend: isDue, driverScanned
  // isDue = true/false
  // driverScanned = true/false (did they ride the bus)
  const isDue = result.isDue || false;
  const driverScanned = result.driverScanned || false;
  const student = result.student || {};

  let bgColor = 'bg-green-500'; // Default Green (Scanned + Paid)
  let icon = '✅';
  
  if (driverScanned && isDue) {
    bgColor = 'bg-red-500';
    icon = '❌';
  } else if (!driverScanned && !isDue) {
    bgColor = 'bg-yellow-500';
    icon = '⚠️';
  } else if (!driverScanned && isDue) {
    bgColor = 'bg-red-500';
    icon = '❌';
  }

  return (
    <div className={\`rounded-2xl p-6 text-white shadow-xl \${bgColor}\`}>
      <div className="flex items-center gap-4 mb-4">
        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-3xl">{icon}</div>
        <div>
          <h2 className="text-xl font-bold">{student.name || 'Unknown Student'}</h2>
          <p className="opacity-90">{student.student_id}</p>
        </div>
      </div>
      <div className="bg-white/20 rounded-xl p-4 flex flex-col gap-2">
        {result.duplicate && <div className="font-bold text-lg">Already scanned at gate!</div>}
        {!driverScanned && <div className="font-bold text-yellow-100">⚠️ MISSED DRIVER SCAN</div>}
        {isDue && <div className="font-bold text-red-100 bg-red-900/50 p-2 rounded">❌ FEE OVERDUE</div>}
        {driverScanned && !isDue && <div className="font-bold text-green-100">All clear.</div>}
      </div>
      <button onClick={onDismiss} className="mt-4 w-full bg-white/20 py-3 rounded-xl font-semibold">
        {t('reception.scanNext')}
      </button>
    </div>
  );
}

`;

content = content.replace(oldArrivalResult, newArrivalResult);

fs.writeFileSync('src/pages/ReceptionScanner.jsx', content);
console.log('ReceptionScanner.jsx patched successfully');
