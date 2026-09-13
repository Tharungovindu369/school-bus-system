import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatBusNumber, busesMatch } from '../utils';
import Spinner from './Spinner';

// Ensure window.L is available globally
if (typeof window !== 'undefined' && !window.L) {
  window.L = L;
}

// Configure Leaflet default icons to cdnjs fallback to prevent 404 image errors
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const DEFAULT_CENTER = [16.7375, 78.0017]; // Prathibha Jr College, Mahabubnagar, Telangana

const TILE_LAYERS = {
  roadmap: {
    id: 'roadmap',
    name: 'Map',
    icon: '🗺️',
    url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    subdomains: '0123',
    maxZoom: 20,
    attribution: '&copy; Google Maps',
  },
  satellite: {
    id: 'satellite',
    name: 'Satellite',
    icon: '🛰️',
    url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    subdomains: '0123',
    maxZoom: 20,
    attribution: '&copy; Google Maps',
  },
  osm: {
    id: 'osm',
    name: 'OSM',
    icon: '🌐',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: 'abc',
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap',
  },
};

export default function BusMap({
  buses = [],
  center,
  zoom = 12,
  highlightBus = null,
  className = '',
  height = 400,
}) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const tileLayerRef = useRef(null);
  const markersLayer = useRef(null);
  const collegeLayer = useRef(null);
  const hasInitiallyCentered = useRef(false);
  const userInteracted = useRef(false);
  const lastHighlightBus = useRef(highlightBus);
  const [mapType, setMapType] = useState('roadmap');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  // Reset interaction state if highlightBus prop changes
  useEffect(() => {
    if (lastHighlightBus.current !== highlightBus) {
      lastHighlightBus.current = highlightBus;
      userInteracted.current = false;
      hasInitiallyCentered.current = false;
    }
  }, [highlightBus]);

  // Dynamic Tile Switching (Google Roadmap vs Satellite vs OSM)
  useEffect(() => {
    if (!mapInstance.current) return;
    const map = mapInstance.current;
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    const provider = TILE_LAYERS[mapType] || TILE_LAYERS.roadmap;
    tileLayerRef.current = L.tileLayer(provider.url, {
      maxZoom: provider.maxZoom,
      subdomains: provider.subdomains,
      attribution: provider.attribution,
    }).addTo(map);
  }, [mapType]);

  // 1. Initialize Map
  useEffect(() => {
    if (!mapRef.current) return;
    if (mapInstance.current) return;

    try {
      const mapCenter = center ? [center.lat, center.lng] : DEFAULT_CENTER;
      const map = L.map(mapRef.current, {
        zoomControl: true,
        attributionControl: false,
        scrollWheelZoom: true,
        touchZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        dragging: true,
      }).setView(mapCenter, zoom);

      // Track user drag and zoom so live polling doesn't override parent's chosen zoom
      map.on('dragstart zoomstart', () => {
        userInteracted.current = true;
      });

      // Google Maps Roadmap tiles (most up-to-date, recognizable roads/colonies in India)
      const provider = TILE_LAYERS.roadmap;
      tileLayerRef.current = L.tileLayer(provider.url, {
        maxZoom: provider.maxZoom,
        subdomains: provider.subdomains,
        attribution: provider.attribution,
      }).addTo(map);

      // College anchor marker (Prathibha Junior College)
      collegeLayer.current = L.layerGroup().addTo(map);
      const collegeIcon = L.divIcon({
        className: 'custom-college-marker',
        html: `
          <div style="background:#1e3a8a; color:white; padding:3px 8px; border-radius:12px; font-weight:bold; font-size:11px; border:2px solid #fbbf24; box-shadow:0 3px 8px rgba(0,0,0,0.3); display:flex; align-items:center; gap:4px; white-space:nowrap;">
            <span>🏫</span>
            <span>Prathibha College</span>
          </div>
        `,
        iconSize: [120, 26],
        iconAnchor: [60, 13],
      });
      L.marker(DEFAULT_CENTER, { icon: collegeIcon })
        .bindPopup(`<strong>🏫 Prathibha Junior College</strong><br/>Central Campus & Bus Depot`)
        .addTo(collegeLayer.current);

      markersLayer.current = L.layerGroup().addTo(map);
      mapInstance.current = map;
      setReady(true);

      // Multiple sizing ticks to eliminate blank grey box
      setTimeout(() => map.invalidateSize(), 50);
      setTimeout(() => map.invalidateSize(), 200);
      setTimeout(() => map.invalidateSize(), 600);
    } catch (err) {
      console.error('Leaflet initialization error:', err);
      setError(err.message || 'Failed to initialize map');
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
        markersLayer.current = null;
        collegeLayer.current = null;
      }
    };
  }, [center, zoom]);

  // 2. ResizeObserver to permanently fix tab switching grey box
  useEffect(() => {
    if (!mapRef.current) return;
    const ro = new ResizeObserver(() => {
      if (mapInstance.current) {
        mapInstance.current.invalidateSize();
      }
    });
    ro.observe(mapRef.current);
    return () => ro.disconnect();
  }, []);

  // 3. Render Bus Markers
  useEffect(() => {
    if (!ready || !mapInstance.current || !markersLayer.current) return;

    const map = mapInstance.current;
    const layer = markersLayer.current;
    layer.clearLayers();

    const latLngs = [DEFAULT_CENTER];

    (buses || []).forEach((bus) => {
      const lat = parseFloat(bus.latitude || bus.current_lat || bus.lat);
      const lng = parseFloat(bus.longitude || bus.current_lng || bus.lng);
      if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return;

      const isHighlight = highlightBus && busesMatch(bus.bus_number, highlightBus);
      const isRunning = ['morning_running', 'return_running'].includes(bus.current_status);
      const lastUpdate = bus.last_updated ? new Date(bus.last_updated).getTime() : 0;
      const isRecent = (Date.now() - lastUpdate) < 45 * 60 * 1000;
      const isActiveNow = isRunning && isRecent;

      const markerColor = isHighlight
        ? '#dc2626'
        : isActiveNow
          ? '#10b981'
          : '#64748b';

      const busLabel = formatBusNumber(bus.bus_number);
      const statusText = isActiveNow
        ? (bus.current_status === 'return_running' ? 'Return Route 🔄' : 'Morning Route 🟢')
        : 'Parked / Depot 🅿️';

      const busDivIcon = L.divIcon({
        className: 'custom-bus-marker',
        html: `
          <div style="position:relative; display:flex; flex-direction:column; align-items:center;">
            ${isActiveNow ? '<div style="position:absolute; width:34px; height:34px; background:' + markerColor + '; opacity:0.4; border-radius:50%; animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite; top:-4px;"></div>' : ''}
            <div style="width:26px; height:26px; background:${markerColor}; border:2px solid #ffffff; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 6px rgba(0,0,0,0.35); color:white; font-size:12px;">
              🚌
            </div>
            <div style="background:#0f172a; color:#ffffff; font-weight:800; font-size:10px; padding:1px 5px; border-radius:6px; margin-top:2px; white-space:nowrap; box-shadow:0 1px 3px rgba(0,0,0,0.3);">
              ${busLabel}
            </div>
          </div>
        `,
        iconSize: [40, 48],
        iconAnchor: [20, 24],
      });

      const marker = L.marker([lat, lng], { icon: busDivIcon });

      const lastSeenText = bus.last_updated
        ? new Date(bus.last_updated).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })
        : 'N/A';

      marker.bindPopup(`
        <div style="min-width:160px; font-family:sans-serif; text-align:left;">
          <div style="font-weight:bold; font-size:14px; margin-bottom:2px; color:#0f172a;">
            🚌 ${busLabel}
          </div>
          <div style="font-size:11px; font-weight:700; color:${isActiveNow ? '#059669' : '#64748b'}; margin-bottom:6px;">
            ${statusText}
          </div>
          <div style="font-size:11px; color:#334155; line-height:1.4;">
            <strong>Driver:</strong> ${bus.driver_name || 'Not assigned'}<br/>
            ${bus.current_stop ? `<strong>Last Stop:</strong> ${bus.current_stop}<br/>` : ''}
            ${bus.next_stop ? `<strong>Next Stop:</strong> ${bus.next_stop}<br/>` : ''}
            <strong>Updated:</strong> ${lastSeenText}
          </div>
        </div>
      `);

      marker.addTo(layer);
      latLngs.push([lat, lng]);
    });

    if (highlightBus) {
      const target = (buses || []).find((b) => busesMatch(b.bus_number, highlightBus));
      if (target) {
        const tLat = parseFloat(target.latitude || target.current_lat || target.lat);
        const tLng = parseFloat(target.longitude || target.current_lng || target.lng);
        if (!isNaN(tLat) && !isNaN(tLng) && tLat !== 0) {
          if (!hasInitiallyCentered.current) {
            // First load: center on bus at comfortable zoom
            map.setView([tLat, tLng], 15);
            hasInitiallyCentered.current = true;
          } else if (!userInteracted.current) {
            // Live update: smoothly pan to new coordinates WITHOUT overriding parent's zoom!
            map.panTo([tLat, tLng], { animate: true, duration: 0.8 });
          }
          return;
        }
      }
    }

    // Admin fleet view: only fit bounds once on initial load
    if (!hasInitiallyCentered.current) {
      if (latLngs.length > 1) {
        map.fitBounds(latLngs, { padding: [40, 40], maxZoom: 15 });
      } else {
        map.setView(DEFAULT_CENTER, zoom);
      }
      hasInitiallyCentered.current = true;
    }
  }, [buses, highlightBus, ready, zoom]);

  const handleRecenter = () => {
    if (!mapInstance.current) return;
    const map = mapInstance.current;
    userInteracted.current = false;

    if (highlightBus) {
      const target = (buses || []).find((b) => busesMatch(b.bus_number, highlightBus));
      if (target) {
        const tLat = parseFloat(target.latitude || target.current_lat || target.lat);
        const tLng = parseFloat(target.longitude || target.current_lng || target.lng);
        if (!isNaN(tLat) && !isNaN(tLng) && tLat !== 0) {
          map.flyTo([tLat, tLng], 16, { duration: 0.8 });
          return;
        }
      }
    }

    const latLngs = [DEFAULT_CENTER];
    (buses || []).forEach((b) => {
      const lat = parseFloat(b.latitude || b.current_lat || b.lat);
      const lng = parseFloat(b.longitude || b.current_lng || b.lng);
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0) latLngs.push([lat, lng]);
    });
    if (latLngs.length > 1) {
      map.flyToBounds(latLngs, { padding: [40, 40], maxZoom: 15, duration: 0.8 });
    } else {
      map.flyTo(DEFAULT_CENTER, zoom, { duration: 0.8 });
    }
  };

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

      {ready && (
        <div className="absolute top-3 right-3 z-[500] flex items-center gap-2">
          {/* Map Layer Switcher: Google Road vs Satellite */}
          <div className="bg-white/95 backdrop-blur-sm p-0.5 rounded-xl shadow-md border border-slate-200 flex items-center">
            <button
              type="button"
              onClick={() => setMapType('roadmap')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                mapType === 'roadmap'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🗺️ Map
            </button>
            <button
              type="button"
              onClick={() => setMapType('satellite')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                mapType === 'satellite'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🛰️ Satellite
            </button>
          </div>

          {/* Follow / Recenter button */}
          <button
            type="button"
            onClick={handleRecenter}
            className="bg-white/95 hover:bg-white active:scale-95 text-slate-800 text-xs font-bold px-3 py-1.5 rounded-xl shadow-md border border-slate-200 flex items-center gap-1.5 transition cursor-pointer"
            title="Recenter Map"
          >
            <span>🎯</span>
            <span>{highlightBus ? 'Follow Bus' : 'Recenter'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
