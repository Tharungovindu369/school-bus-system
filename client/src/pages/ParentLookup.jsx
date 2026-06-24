import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { api } from '../api';
import Spinner from '../components/Spinner';
import BusMap from '../components/BusMap';

import { useLanguage } from '../contexts/LanguageContext';

export default function ParentLookup() {
  const [studentId, setStudentId] = useState(localStorage.getItem('parent_studentId') || '');
  const [last4, setLast4] = useState(localStorage.getItem('parent_last4') || '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [bus, setBus] = useState(null);
  const { lang, toggleLang, t } = useLanguage();

  useEffect(() => {
    // If we have saved credentials but no result yet, automatically look up on mount
    if (studentId && last4 && !result && !loading) {
      handleLookup(new Event('submit'));
    }
  }, []); // Only on mount

  useEffect(() => {
    let interval;
    if (result && studentId && last4) {
      const fetchData = async () => {
        try {
          // Re-fetch student status
          const data = await api.lookupStudent(studentId, last4);
          if (data.success) {
            setResult(data.student);
            // Re-fetch bus
            if (data.student.bus_number) {
              const busData = await api.getBus(data.student.bus_number);
              setBus(busData);
            }
          }
        } catch (err) {
          console.error(err);
        }
      };
      // Fetch initial bus data since lookupStudent only returned student initially
      if (!bus && result.bus_number) {
        api.getBus(result.bus_number).then(setBus).catch(console.error);
      }
      
      interval = setInterval(fetchData, 10000); // Check every 10 seconds for real-time feel
    }
    return () => clearInterval(interval);
  }, [result?.bus_number, studentId, last4]); // intentionally not including 'bus' or 'result' as whole object to avoid infinite loops

  const showMap = bus && (bus.current_status === 'morning_running' || bus.current_status === 'return_running');

  const handleLookup = async (e) => {
    e?.preventDefault();
    if (!studentId || !last4) {
      toast.error(t.errorBoth);
      return;
    }

    setLoading(true);

    try {
      const data = await api.lookupStudent(studentId, last4);
      if (data.success) {
        setResult(data.student);
        localStorage.setItem('parent_studentId', studentId);
        localStorage.setItem('parent_last4', last4);
      }
    } catch (err) {
      if (err.message && err.message.includes('Too many')) {
        toast.error(err.message);
      } else {
        toast.error(t.errorNotFound);
      }
      localStorage.removeItem('parent_studentId');
      localStorage.removeItem('parent_last4');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setBus(null);
    setStudentId('');
    setLast4('');
    localStorage.removeItem('parent_studentId');
    localStorage.removeItem('parent_last4');
  };



  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 relative">
      <button 
        onClick={toggleLang}
        className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full font-bold transition"
      >
        {lang === 'en' ? 'తెలుగు' : 'English'}
      </button>

      <div className="w-full max-w-md mt-10">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🚌</div>
          <h1 className="text-3xl font-bold text-white">{t('parent.title')}</h1>
          <p className="text-blue-200 mt-2">{t('parent.subtitle')}</p>
        </div>

        {!result ? (
          <form onSubmit={handleLookup} className="bg-white rounded-2xl shadow-xl p-6 space-y-5">
            <div className="bg-blue-50 border border-blue-100 text-blue-800 text-sm p-3 rounded-xl mb-2 text-center">
              {t('parent.infoText')}
            </div>
            <div>
              <label className="text-slate-700 text-sm font-bold block mb-2">{t('parent.studentIdLabel')}</label>
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value.toUpperCase())}
                className="w-full p-4 rounded-xl text-lg border border-slate-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                placeholder={t('parent.studentIdPlaceholder')}
                required
              />
            </div>
            <div>
              <label className="text-slate-700 text-sm font-bold block mb-2">{t('parent.phoneLabel')}</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={last4}
                onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))}
                className="w-full p-4 rounded-xl text-2xl text-center tracking-widest border border-slate-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                placeholder="••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white font-bold py-4 rounded-xl text-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition"
            >
              {loading ? <Spinner size="sm" /> : t('parent.checkStatusBtn')}
            </button>
          </form>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className={`p-6 text-white text-center ${result.status.includes('Not yet') ? 'bg-slate-500' : result.status.includes('Boarded') ? 'bg-green-600' : 'bg-blue-600'}`}>
              <div className="text-4xl mb-3">{result.status.includes('Not yet') ? '⏳' : result.status.includes('Boarded') ? '✅' : '🏠'}</div>
              <h2 className="text-2xl font-bold mb-1">{result.name}</h2>
              <p className="opacity-90">{result.class} • {result.bus_number}</p>
            </div>
            
            <div className="p-6 bg-slate-50 text-center">
              <p className="text-xl font-bold text-slate-800 mb-2">{t('parent.statusMap.' + result.status) || result.status}</p>
              {result.last_updated && (
                <p className="text-sm text-slate-500 mb-6">{t('parent.lastUpdated')} {new Date(result.last_updated).toLocaleString('en-IN')}</p>
              )}

              {showMap && (
                <div className="mb-6 border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-blue-50 text-blue-800 text-xs font-bold uppercase tracking-wider py-2 px-3 flex justify-between items-center">
                    <span>{t('parent.liveLocation')}</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> {bus.driver_name}</span>
                  </div>
                  <BusMap buses={[bus]} highlightBus={bus.bus_number} height={300} className="w-full" />
                </div>
              )}
              
              <button
                onClick={handleReset}
                className="w-full bg-slate-200 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-300 transition"
              >
                {t('parent.checkAnotherBtn')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
