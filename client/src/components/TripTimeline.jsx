import React from 'react';

function formatTime(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch (err) {
    return '';
  }
}

function getEventStyle(type) {
  switch (type) {
    case 'trip_started':
      return { icon: '🚌', bg: 'bg-blue-100 text-blue-700 border-blue-300', dot: 'bg-blue-500' };
    case 'bus_reached_stop':
      return { icon: '🛑', bg: 'bg-amber-100 text-amber-800 border-amber-300', dot: 'bg-amber-500' };
    case 'student_boarded':
      return { icon: '📍', bg: 'bg-green-100 text-green-800 border-green-300', dot: 'bg-green-500' };
    case 'reached_college':
      return { icon: '🏫', bg: 'bg-purple-100 text-purple-800 border-purple-300', dot: 'bg-purple-500' };
    case 'student_dropped':
      return { icon: '✅', bg: 'bg-teal-100 text-teal-800 border-teal-300', dot: 'bg-teal-500' };
    default:
      return { icon: '🔹', bg: 'bg-slate-100 text-slate-700 border-slate-300', dot: 'bg-slate-400' };
  }
}

export default function TripTimeline({ events = [] }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 text-left">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <span>📅</span> Today's Trip Timeline
        </h3>
        <span className="text-[11px] font-semibold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full border border-blue-100">
          Live Updates
        </span>
      </div>

      {events.length === 0 ? (
        <div className="py-6 text-center text-slate-400 text-sm space-y-1">
          <div className="text-2xl">⏳</div>
          <p className="font-medium">No trip events recorded yet today.</p>
        </div>
      ) : (
        <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
          {events.map((event, idx) => {
            const style = getEventStyle(event.event_type);
            const timeStr = formatTime(event.timestamp);

            return (
              <div key={idx} className="relative flex items-start justify-between gap-3 group">
                <span className={`absolute -left-6 top-1 w-3 h-3 rounded-full border-2 border-white ring-2 ring-slate-100 ${style.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-800">
                      {style.icon} {event.event_description}
                    </span>
                  </div>
                  {event.location_name && (
                    <span className="inline-block mt-1 text-xs text-slate-500 font-medium bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md">
                      📍 {event.location_name}
                    </span>
                  )}
                </div>
                {timeStr && (
                  <span className="text-xs font-bold text-slate-500 whitespace-nowrap bg-slate-100 px-2 py-1 rounded-lg">
                    {timeStr}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="pt-3 border-t border-slate-100 text-center">
        <p className="text-xs text-slate-400 italic">
          ℹ️ For trip history beyond today, please contact the college office.
        </p>
      </div>
    </div>
  );
}
