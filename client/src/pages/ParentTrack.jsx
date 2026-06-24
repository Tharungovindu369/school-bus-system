import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import { formatBusNumber } from '../utils';
import Spinner from '../components/Spinner';
import BusMap from '../components/BusMap';

export default function ParentTrack() {
  const { bus_number } = useParams();
  const [bus, setBus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadBus = useCallback(async () => {
    try {
      const data = await api.getBus(bus_number);
      setBus(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Bus not found');
    } finally {
      setLoading(false);
    }
  }, [bus_number]);

  useEffect(() => {
    loadBus();
    const interval = setInterval(loadBus, 30000);
    return () => clearInterval(interval);
  }, [loadBus]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <p className="text-due text-lg font-semibold mb-4">{error}</p>
        <Link to="/" className="text-primary font-semibold">← Back Home</Link>
      </div>
    );
  }

  const lastUpdated = bus.last_updated
    ? new Date(bus.last_updated).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    : 'Not available';

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="bg-primary text-white p-4 shadow">
        <Link to="/" className="text-blue-200 text-sm">← Home</Link>
        <h1 className="text-2xl font-bold mt-1">Track {formatBusNumber(bus.bus_number)}</h1>        <p className="text-blue-100 text-sm">Driver: {bus.driver_name || 'N/A'}</p>
        <p className="text-blue-200 text-xs mt-1">Last updated: {lastUpdated}</p>
      </div>

      <div className="p-4">
        <BusMap
          buses={[bus]}
          highlightBus={bus_number}
          height={400}
          className="w-full shadow-lg"
        />

        <div className="mt-4 bg-white rounded-xl shadow p-4">
          <h2 className="font-bold text-lg mb-3">
            Boarded Today ({bus.boardedToday?.length || 0})
          </h2>
          {bus.boardedToday?.length ? (
            <ul className="divide-y">
              {bus.boardedToday.map((s, i) => (
                <li key={i} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{s.student_name}</p>
                    <p className="text-sm text-slate-500">{s.stop_name}</p>
                  </div>
                  <span className="text-sm text-slate-400">{s.boarded_at}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-400 text-center py-4">No students boarded yet today</p>
          )}
        </div>

        <div className="mt-4 bg-white rounded-xl shadow p-4">
          <h2 className="font-bold text-lg mb-3">
            Dropped Off Today ({bus.droppedToday?.length || 0})
          </h2>
          {bus.droppedToday?.length ? (
            <ul className="divide-y">
              {bus.droppedToday.map((s, i) => (
                <li key={i} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{s.student_name}</p>
                    <p className="text-sm text-slate-500">{s.stop_name}</p>
                  </div>
                  <span className="text-sm text-slate-400">{s.dropoff_time}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-400 text-center py-4">No drop-offs yet today</p>
          )}
        </div>

        <div className="mt-4 bg-blue-50 rounded-xl p-4 text-sm text-slate-600 text-center">          Location refreshes automatically every 30 seconds
        </div>
      </div>
    </div>
  );
}
