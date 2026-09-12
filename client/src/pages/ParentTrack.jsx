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

    let eventSource = null;
    try {
      eventSource = new EventSource(`/api/bus/${encodeURIComponent(bus_number)}/stream`);
      eventSource.onmessage = (event) => {
        try {
          const update = JSON.parse(event.data);
          setBus((prev) => (prev ? { ...prev, ...update } : update));
        } catch (_) {}
      };
    } catch (_) {}

    const interval = setInterval(loadBus, 25000);
    return () => {
      clearInterval(interval);
      if (eventSource) eventSource.close();
    };
  }, [bus_number, loadBus]);

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
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-bold text-lg text-slate-800">
              Students Boarded Today ({bus.boardedToday?.length || 0})
            </h2>
            <span className="text-xs bg-green-100 text-green-800 font-semibold px-2 py-0.5 rounded-full">
              {bus.boardedToday?.length || 0} Boarded
            </span>
          </div>
          <p className="text-xs text-slate-400 mb-3">Individual names are masked for student privacy & safety</p>
          {bus.boardedToday?.length ? (
            <ul className="divide-y divide-slate-100">
              {bus.boardedToday.map((s, i) => (
                <li key={i} className="py-2.5 flex justify-between items-center text-sm">
                  <div>
                    <p className="font-medium text-slate-700">{s.student_name}</p>
                    <p className="text-xs text-slate-500">{s.stop_name}</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-400 bg-slate-50 px-2 py-1 rounded">{s.boarded_at}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-400 text-center py-4 text-sm">No students boarded yet today</p>
          )}
        </div>

        <div className="mt-4 bg-white rounded-xl shadow p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-bold text-lg text-slate-800">
              Dropped Off Today ({bus.droppedToday?.length || 0})
            </h2>
            <span className="text-xs bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full">
              {bus.droppedToday?.length || 0} Dropped
            </span>
          </div>
          {bus.droppedToday?.length ? (
            <ul className="divide-y divide-slate-100">
              {bus.droppedToday.map((s, i) => (
                <li key={i} className="py-2.5 flex justify-between items-center text-sm">
                  <div>
                    <p className="font-medium text-slate-700">{s.student_name}</p>
                    <p className="text-xs text-slate-500">{s.stop_name}</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-400 bg-slate-50 px-2 py-1 rounded">{s.dropoff_time}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-400 text-center py-4 text-sm">No drop-offs yet today</p>
          )}
        </div>

        <div className="mt-4 bg-blue-50 rounded-xl p-4 text-sm text-slate-600 text-center font-medium">
          ⚡ Live bus location updates in real time
        </div>
      </div>
    </div>
  );
}
