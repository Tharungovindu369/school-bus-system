import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import toast from 'react-hot-toast';
import { api } from '../api';
import { formatBusNumber } from '../utils';
import Spinner from './Spinner';

export default function StudentLookup({ auth }) {
  const [scanning, setScanning] = useState(false);
  const [studentIdInput, setStudentIdInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  
  const html5QrRef = useRef(null);

  useEffect(() => {
    return () => {
      if (html5QrRef.current?.isScanning) {
        html5QrRef.current.stop().catch(console.error);
      }
    };
  }, []);

  const startScanner = async () => {
    setScanning(true);
    setResult(null);
    await new Promise((r) => setTimeout(r, 100)); // wait for DOM element
    const scanner = new Html5Qrcode('lookup-qr-reader');
    html5QrRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        handleScan,
        () => {}
      );
    } catch {
      toast.error('Could not start camera. Check permissions.');
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    if (html5QrRef.current?.isScanning) {
      await html5QrRef.current.stop();
    }
    html5QrRef.current = null;
    setScanning(false);
  };

  const handleScan = (decodedText) => {
    if (html5QrRef.current) {
      html5QrRef.current.stop().catch(console.error);
      setScanning(false);
    }
    const match = decodedText.match(/ID:\s*([S\d]+)/);
    if (match) {
      fetchStudentDetails(match[1]);
    } else {
      fetchStudentDetails(decodedText.trim());
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!studentIdInput.trim()) return;
    fetchStudentDetails(studentIdInput.trim().toUpperCase());
  };

  const fetchStudentDetails = async (id) => {
    setLoading(true);
    setResult(null);
    try {
      const data = await api.getStudentLookup(id, auth);
      setResult(data);
      toast.success('Student details retrieved');
    } catch (err) {
      toast.error(err.message || 'Failed to fetch student details');
    } finally {
      setLoading(false);
      setStudentIdInput('');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="font-bold text-xl mb-4 text-slate-800">Scan to Identify</h2>
        <p className="text-slate-500 mb-6 text-sm">
          Scan a student's ID card or enter their ID manually to view their full details and recent scan history. 
          <strong> Note: This does not log attendance.</strong>
        </p>

        {!scanning ? (
          <div className="flex gap-4">
            <button
              onClick={startScanner}
              className="flex-1 bg-primary text-white font-bold py-3 rounded-xl shadow hover:bg-primary/90 flex items-center justify-center gap-2"
            >
              📷 Start Camera Scanner
            </button>
            <form onSubmit={handleManualSubmit} className="flex-1 flex gap-2">
              <input
                type="text"
                placeholder="Or Enter ID (e.g. S0001)"
                value={studentIdInput}
                onChange={(e) => setStudentIdInput(e.target.value)}
                className="flex-1 border border-slate-300 rounded-xl px-4 py-3 outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={loading || !studentIdInput.trim()}
                className="bg-slate-800 text-white font-bold py-3 px-6 rounded-xl shadow hover:bg-slate-700 disabled:opacity-50"
              >
                Lookup
              </button>
            </form>
          </div>
        ) : (
          <div>
            <div id="lookup-qr-reader" className="w-full max-w-md mx-auto rounded-xl overflow-hidden shadow-lg border-4 border-slate-800 mb-4"></div>
            <button
              onClick={stopScanner}
              className="w-full bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 shadow"
            >
              Stop Scanner
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex justify-center p-12 bg-white rounded-xl shadow"><Spinner size="lg" /></div>
      )}

      {result && !loading && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className={`p-6 text-white ${result.student.calculated_fee_status === 'PAID' ? 'bg-paid' : 'bg-due'}`}>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-bold">{result.student.name}</h3>
                <p className="text-white/80 mt-1">{result.student.student_id} • Class {result.student.class}</p>
              </div>
              <div className="bg-white/20 px-4 py-2 rounded-lg font-bold text-lg">
                {result.student.calculated_fee_status}
              </div>
            </div>
          </div>
          
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-bold text-slate-800 border-b pb-2">Student Information</h4>
              <div className="grid grid-cols-2 gap-y-3 text-sm">
                <div className="text-slate-500">Assigned Bus:</div>
                <div className="font-semibold">{formatBusNumber(result.student.bus_number)}</div>
                
                <div className="text-slate-500">Stop Name:</div>
                <div className="font-semibold">{result.student.stop_name || '-'}</div>
                
                <div className="text-slate-500">Parent Name:</div>
                <div className="font-semibold">{result.student.parent_name || '-'}</div>
                
                <div className="text-slate-500">WhatsApp:</div>
                <div className="font-semibold">{result.student.parent_whatsapp || '-'}</div>
                
                <div className="text-slate-500">Fee Paid Until:</div>
                <div className="font-semibold">{result.student.fee_paid_until || 'No valid date'}</div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-bold text-slate-800 border-b pb-2">Last 5 Scans</h4>
              {result.history && result.history.length > 0 ? (
                <div className="space-y-3">
                  {result.history.map((record, i) => (
                    <div key={i} className="bg-slate-50 p-3 rounded-lg text-sm border border-slate-100 flex justify-between items-center">
                      <div>
                        <span className="font-semibold capitalize text-slate-700 mr-2">
                          {(record.scan_type || 'boarding').replace('_', ' ')}
                        </span>
                        <span className="text-slate-500">
                          {formatBusNumber(record.actual_bus || record.bus_number)}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-slate-800 font-medium">{record.date}</div>
                        <div className="text-slate-500 text-xs">{record.boarded_at || record.dropoff_time || record.arrival_time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm italic p-4 bg-slate-50 rounded-lg text-center">No scan history available</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
