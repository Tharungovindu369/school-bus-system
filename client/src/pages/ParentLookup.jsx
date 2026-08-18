import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { api } from '../api';
import Spinner from '../components/Spinner';
import BusMap from '../components/BusMap';
import TripTimeline from '../components/TripTimeline';
import { getFeeStatusDetails } from '../utils';
import { getMessagingInstance } from '../firebase';
import { getToken, onMessage } from 'firebase/messaging';

import { useLanguage } from '../contexts/LanguageContext';

export default function ParentLookup() {
  const [studentId, setStudentId] = useState(localStorage.getItem('parent_studentId') || '');
  const [last4, setLast4] = useState(localStorage.getItem('parent_last4') || '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [bus, setBus] = useState(null);
  const [timelineEvents, setTimelineEvents] = useState([]);
  const { lang, toggleLang, t } = useLanguage();

  useEffect(() => {
    let unsubscribe = null;
    const setupForegroundListener = async () => {
      const messaging = await getMessagingInstance();
      if (messaging) {
        unsubscribe = onMessage(messaging, (payload) => {
          console.log('[ParentLookup] Foreground message received:', payload);
          toast.success(
            <div className="text-left font-sans">
              <p className="font-bold text-sm text-slate-800">{payload.notification?.title || 'Notification'}</p>
              <p className="text-xs text-slate-600 mt-0.5">{payload.notification?.body || ''}</p>
            </div>,
            { duration: 6000, position: 'top-center' }
          );
        });
      }
    };
    setupForegroundListener();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsGranted, setNotificationsGranted] = useState(false);

  const isIOS = typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = typeof window !== 'undefined' && (window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches);
  const showIosBanner = isIOS && !isStandalone;

  useEffect(() => {
    if (result) {
      setNotificationsGranted(
        'Notification' in window &&
        Notification.permission === 'granted' &&
        localStorage.getItem(`fcm_saved_${result.student_id}`) === 'true'
      );
    }
  }, [result]);

  const enableNotifications = async () => {
    if (!('Notification' in window)) {
      toast.error('This browser does not support notifications');
      return;
    }
    setNotificationsLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const messaging = await getMessagingInstance();
        if (!messaging) {
          throw new Error('This browser or context does not support Firebase Messaging APIs');
        }
        const registration = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Service Worker registration timeout. Please ensure you are accessing via HTTPS and using a real browser like Chrome or Safari, not an in-app webview (like WhatsApp).')), 6000)
          )
        ]);
        const token = await getToken(messaging, {
          serviceWorkerRegistration: registration,
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
        });
        
        if (token) {
          const response = await fetch(`/api/students/${result.student_id}/fcm-token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fcmToken: token })
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              setNotificationsGranted(true);
              localStorage.setItem(`fcm_saved_${result.student_id}`, 'true');
              toast.success('🔔 Notifications enabled successfully!');
            } else {
              throw new Error(data.error || 'Server rejected token save');
            }
          } else {
            throw new Error(`Server returned status ${response.status}`);
          }
        } else {
          throw new Error('No token returned from Firebase');
        }
      } else {
        toast.error('Permission not granted for notifications');
      }
    } catch (err) {
      console.error('Error enabling notifications:', err);
      toast.error(`Error enabling notifications: ${err.message || err}`);
    } finally {
      setNotificationsLoading(false);
    }
  };

  useEffect(() => {
    // If we have saved credentials but no result yet, automatically look up on mount
    if (studentId && last4 && !result && !loading) {
      handleLookup(new Event('submit'));
    }
  }, []); // Only on mount

  useEffect(() => {
    let interval;
    if (result && studentId && last4) {
      let isVisible = !document.hidden;

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
            // Re-fetch timeline
            if (data.student.student_id) {
              const timelineData = await api.getTodayTimeline(data.student.student_id);
              if (timelineData.success) {
                setTimelineEvents(timelineData.events || []);
              }
            }
          }
        } catch (err) {
          console.error(err);
        }
      };

      const startPolling = (intervalDuration) => {
        if (interval) clearInterval(interval);
        interval = setInterval(fetchData, intervalDuration);
      };

      // Set initial polling based on current visibility state
      startPolling(isVisible ? 10000 : 45000);

      const handleVisibilityChange = () => {
        const nextVisible = !document.hidden;
        if (nextVisible !== isVisible) {
          isVisible = nextVisible;
          console.log(`[ParentLookup] Tab visibility changed: ${isVisible ? 'VISIBLE (10s)' : 'HIDDEN (45s)'}`);
          if (isVisible) {
            // Immediately fetch one tick, then resume fast polling (10s)
            fetchData();
            startPolling(10000);
          } else {
            // Slow down polling to 45s
            startPolling(45000);
          }
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      // Fetch initial bus & timeline data
      if (result.bus_number) {
        api.getBus(result.bus_number).then(setBus).catch(console.error);
      }
      if (result.student_id) {
        api.getTodayTimeline(result.student_id).then(res => res.success && setTimelineEvents(res.events || [])).catch(console.error);
      }
      
      return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [result?.student_id, result?.bus_number, studentId, last4]);

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
        if (data.student.student_id) {
          api.getTodayTimeline(data.student.student_id).then(res => res.success && setTimelineEvents(res.events || [])).catch(console.error);
        }
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
    setTimelineEvents([]);
    setStudentId('');
    setLast4('');
    localStorage.removeItem('parent_studentId');
    localStorage.removeItem('parent_last4');
  };



  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 relative">
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
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden p-6 space-y-6">
            {showIosBanner && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs font-semibold text-slate-700 text-left">
                ℹ️ <strong>For notifications on iPhone:</strong> tap the Share button in Safari, select <strong>"Add to Home Screen"</strong>, then open the app from your home screen to enable notifications.
              </div>
            )}

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Push Notifications
                  </span>
                  <span className="text-sm font-semibold text-slate-700">
                    {notificationsGranted ? '✅ Enabled on this device' : 'Get notified when child scans'}
                  </span>
                </div>
                {!notificationsGranted && (
                  <button
                    onClick={enableNotifications}
                    disabled={notificationsLoading}
                    className="bg-primary hover:bg-blue-700 text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    {notificationsLoading ? <Spinner size="sm" /> : '🔔 Enable'}
                  </button>
                )}
              </div>
            </div>

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

              {(() => {
                const details = getFeeStatusDetails(result);
                if (details.status === 'EXPIRED') {
                  return (
                    <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-left flex items-start gap-3">
                      <span className="text-xl">🔴</span>
                      <div>
                        <span className="text-xs font-bold text-red-600 uppercase tracking-wider block mb-1">
                          Fee Alert
                        </span>
                        <span className="text-sm font-semibold text-red-800">
                          {t('parent.feeExpired')}
                        </span>
                      </div>
                    </div>
                  );
                } else if (details.status === 'EXPIRING_SOON') {
                  return (
                    <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-left flex items-start gap-3">
                      <span className="text-xl">⚠️</span>
                      <div>
                        <span className="text-xs font-bold text-amber-600 uppercase tracking-wider block mb-1">
                          Fee Notice
                        </span>
                        <span className="text-sm font-semibold text-amber-800">
                          {t('parent.feeExpiringSoon')}
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {bus && (
                <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 text-left space-y-2.5 animate-fadeIn">
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider block">
                    🚌 Route Stop Status
                  </span>
                  
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="px-2 py-0.5 bg-green-100 text-green-800 text-[10px] font-bold rounded uppercase tracking-wide">
                      Last Crossed
                    </span>
                    <span className="font-extrabold text-slate-800">
                      {bus.current_stop || 'None yet'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-base text-slate-800 pt-1 border-t border-blue-100/50">
                    <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded uppercase tracking-wide">
                      Next Stop
                    </span>
                    <span className="font-extrabold text-blue-900">
                      {bus.next_stop || 'Depot'}
                    </span>
                  </div>
                </div>
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

              <div className="mb-6">
                <TripTimeline events={timelineEvents} />
              </div>
              
              <button
                onClick={handleReset}
                className="w-full bg-slate-200 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-300 transition"
              >
                {t('parent.checkAnotherBtn')}
              </button>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
