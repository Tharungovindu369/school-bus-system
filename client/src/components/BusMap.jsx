import { useEffect, useRef, useState } from 'react';
import { formatBusNumber, busesMatch, busNumberKey } from '../utils';
import Spinner from './Spinner';

const DEFAULT_CENTER = [16.7375, 78.0017]; // Mahabubnagar, Telangana
const OSM_TILE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

function waitForLeaflet(maxAttempts = 50) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      if (window.L) return resolve(window.L);
      attempts += 1;
      if (attempts >= maxAttempts) return reject(new Error('Leaflet failed to load'));
      setTimeout(check, 100);
    };
    check();
  });
}

export default function BusMap({
  buses,
  center,
  zoom = 12,
  highlightBus = null,
  className = '',
  height = 400,
}) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersLayer = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const L = await waitForLeaflet();
        if (cancelled || !mapRef.current || mapInstance.current) return;

        const mapCenter = center ? [center.lat, center.lng] : DEFAULT_CENTER;
        const map = L.map(mapRef.current, { zoomControl: true }).setView(mapCenter, zoom);

        L.tileLayer(OSM_TILE, {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);

        markersLayer.current = L.layerGroup().addTo(map);
        mapInstance.current = map;
        setReady(true);

        setTimeout(() => map.invalidateSize(), 100);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load map');
      }
    })();

    return () => {
      cancelled = true;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
        markersLayer.current = null;
      }
    };
  }, [center, zoom]);

  useEffect(() => {
    if (!ready || !mapInstance.current || !markersLayer.current || !window.L) return;

    const L = window.L;
    const map = mapInstance.current;
    const layer = markersLayer.current;

    layer.clearLayers();

    const validBuses = (buses || []).filter((b) => {
      const lat = parseFloat(b.current_lat);
      const lng = parseFloat(b.current_lng);
      if (isNaN(lat) || isNaN(lng)) return false;

      // Only show buses that are actively running and updated within the last 30 minutes
      if (!b.last_updated) return false;
      const lastUpdate = new Date(b.last_updated).getTime();
      const isRecent = (Date.now() - lastUpdate) < 30 * 60 * 1000;
      const isRunning = ['morning_running', 'return_running'].includes(b.current_status);
      return isRunning && isRecent;
    });

    const latLngs = [];

    validBuses.forEach((bus) => {
      const lat = parseFloat(bus.current_lat);
      const lng = parseFloat(bus.current_lng);
      const isHighlight = highlightBus && busesMatch(bus.bus_number, highlightBus);

      const marker = L.circleMarker([lat, lng], {
        radius: isHighlight ? 14 : 10,
        fillColor: isHighlight ? '#dc2626' : '#2563eb',
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9,
      });

      marker.bindPopup(
        `<div style="min-width:120px">
          <strong>${formatBusNumber(bus.bus_number)}</strong><br/>
          ${bus.driver_name || 'Driver not assigned'}
        </div>`
      );

      marker.bindTooltip(busNumberKey(bus.bus_number), {
        permanent: true,
        direction: 'top',
        offset: [0, -10],
        className: 'bus-marker-label',
      });

      marker.addTo(layer);
      latLngs.push([lat, lng]);
    });

    if (highlightBus && validBuses.length) {
      const bus = validBuses.find((b) => busesMatch(b.bus_number, highlightBus));
      if (bus) {
        map.setView([parseFloat(bus.current_lat), parseFloat(bus.current_lng)], 14);
      }
    } else if (latLngs.length > 1) {
      map.fitBounds(latLngs, { padding: [40, 40] });
    } else if (latLngs.length === 1) {
      map.setView(latLngs[0], 14);
    } else {
      map.setView(DEFAULT_CENTER, zoom);
    }

    setTimeout(() => map.invalidateSize(), 50);
  }, [buses, highlightBus, ready, zoom]);

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-red-50 rounded-xl p-6 text-red-600 ${className}`}
        style={{ width: '100%', height }}
      >
        {error}
      </div>
    );
  }

  return (
    <div className={`relative rounded-xl overflow-hidden ${className}`} style={{ width: '100%', height }}>
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-10">
          <Spinner />
        </div>
      )}
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
