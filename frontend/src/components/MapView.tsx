import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { EventItem, PatternSummary, UrbanCategory } from '../types';
import { CATEGORY_MAP } from '../utils/categoryConfig';
import { Layers, Sparkles, MapPin } from 'lucide-react';

// Fix Leaflet default icon issues in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
});

// Helper component to recenter map view
const MapRecenter: React.FC<{ center: [number, number] }> = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 15);
  }, [center, map]);
  return null;
};

interface MapViewProps {
  events: EventItem[];
  patterns: PatternSummary[];
  selectedPatternId: string | null;
  onSelectPattern: (id: string) => void;
  viewMode: 'standard' | 'citytwin';
  setViewMode: (mode: 'standard' | 'citytwin') => void;
  selectedCategories: UrbanCategory[];
}

export const MapView: React.FC<MapViewProps> = ({
  events,
  patterns,
  selectedPatternId,
  onSelectPattern,
  viewMode,
  setViewMode,
  selectedCategories
}) => {
  // Default map center (San Francisco / Configured City Center)
  const defaultCenter: [number, number] = events.length > 0
    ? [events[0].lat, events[0].lon]
    : [37.7749, -122.4194];

  // Filter events by selected category
  const filteredEvents = events.filter(e => selectedCategories.includes(e.category));

  // Custom marker generator
  const createCustomIcon = (category: UrbanCategory, isStandard: boolean) => {
    if (isStandard) {
      // Standard view: plain grey pin
      return L.divIcon({
        className: 'custom-grey-pin',
        html: `<div style="background-color: #64748b; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      });
    }

    const color = CATEGORY_MAP[category]?.hex || '#64748b';
    return L.divIcon({
      className: 'custom-colored-pin',
      html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2.5px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.35);"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });
  };

  return (
    <div className="relative w-full h-full min-h-[500px] rounded-2xl overflow-hidden shadow-inner border border-slate-200">
      
      {/* Top Left View Switch Toggle */}
      <div className="absolute top-4 left-4 z-[1000] bg-white/95 backdrop-blur-md p-1 rounded-xl shadow-lg border border-slate-200 flex items-center space-x-1">
        <button
          onClick={() => setViewMode('standard')}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            viewMode === 'standard'
              ? 'bg-slate-700 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>Standard complaint view</span>
        </button>
        <button
          onClick={() => setViewMode('citytwin')}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            viewMode === 'citytwin'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>CityTwin view</span>
        </button>
      </div>

      {/* Leaflet Map */}
      <MapContainer
        center={defaultCenter}
        zoom={15}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapRecenter center={defaultCenter} />

        {/* Render Event Pins */}
        {filteredEvents.map((ev) => (
          <Marker
            key={ev.event_id}
            position={[ev.lat, ev.lon]}
            icon={createCustomIcon(ev.category, viewMode === 'standard')}
          >
            <Popup className="custom-popup">
              <div className="p-1 max-w-xs">
                <div className="flex items-center space-x-2 mb-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CATEGORY_MAP[ev.category]?.bgColor} ${CATEGORY_MAP[ev.category]?.color}`}>
                    {CATEGORY_MAP[ev.category]?.label || ev.category}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    Sev: {ev.severity}/5
                  </span>
                </div>
                <p className="text-xs text-slate-700 font-normal leading-snug">
                  {ev.description}
                </p>
                <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Submitter: {ev.submitter_id}</span>
                  <span>{new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Render Pulsing Pattern Hotspot Circles in CityTwin View Mode */}
        {viewMode === 'citytwin' && patterns.map((pat) => {
          const isSelected = selectedPatternId === pat.id;
          return (
            <React.Fragment key={pat.id}>
              {/* Highlight Circle */}
              <Circle
                center={[pat.center.lat, pat.center.lon]}
                radius={60}
                pathOptions={{
                  color: isSelected ? '#0284c7' : '#ef4444',
                  fillColor: isSelected ? '#38bdf8' : '#f87171',
                  fillOpacity: isSelected ? 0.35 : 0.25,
                  weight: isSelected ? 3 : 2,
                  dashArray: '6, 6',
                  className: 'pulsing-hotspot'
                }}
                eventHandlers={{
                  click: () => onSelectPattern(pat.id)
                }}
              />
              
              {/* Score Badge Marker at Center */}
              <Marker
                position={[pat.center.lat, pat.center.lon]}
                icon={L.divIcon({
                  className: 'hotspot-score-badge',
                  html: `
                    <div style="
                      background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
                      color: white;
                      font-weight: 700;
                      font-size: 11px;
                      padding: 4px 8px;
                      border-radius: 12px;
                      border: 2px solid white;
                      box-shadow: 0 4px 12px rgba(2, 132, 199, 0.4);
                      white-space: nowrap;
                      cursor: pointer;
                    ">
                      🔥 Pattern Score: ${pat.score}
                    </div>
                  `,
                  iconSize: [110, 26],
                  iconAnchor: [55, 13]
                })}
                eventHandlers={{
                  click: () => onSelectPattern(pat.id)
                }}
              />
            </React.Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
};
