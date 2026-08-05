import React from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Users, Activity, CheckCircle2 } from 'lucide-react';
import { StatusBadge } from '../common/Badge';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom power station icons with radial glow, zero borders
const mappedStationIcon = new L.DivIcon({
  className: 'custom-station-mapped',
  html: `
    <div class="flex items-center justify-center w-6 h-6 rounded-full bg-[#181a20] shadow-[0_0_12px_rgba(251,191,36,0.5)]">
      <svg viewBox="0 0 24 24" fill="currentColor" class="w-3.5 h-3.5 text-yellow-400">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const estimatedStationIcon = new L.DivIcon({
  className: 'custom-station-estimated',
  html: `
    <div class="flex items-center justify-center w-6 h-6 rounded-full bg-[#181a20] shadow-[0_0_8px_rgba(100,116,139,0.25)] border border-gray-800">
      <svg viewBox="0 0 24 24" fill="currentColor" class="w-3.5 h-3.5 text-gray-500">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const substationIcon = new L.DivIcon({
  className: 'custom-substation',
  html: `
    <div class="flex items-center justify-center w-7 h-7 rounded-lg bg-[#181a20] shadow-[0_0_12px_rgba(56,189,248,0.45)] border border-sky-500/25">
      <svg viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5" class="w-4 h-4">
        <rect x="3" y="11" width="18" height="10" rx="2" />
        <path d="M7 11V6a3 3 0 0 1 6 0v5" />
        <path d="M17 11V8a3 3 0 0 0-6 0v5" />
      </svg>
    </div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const redFaultIcon = new L.DivIcon({
  className: 'custom-fault-icon',
  html: `
    <div class="pulse-marker-ring flex items-center justify-center w-8 h-8 rounded-full bg-red-950/70 shadow-[0_0_16px_rgba(248,113,113,0.45)]">
      <div class="flex items-center justify-center w-5 h-5 rounded-full bg-red-500">
        <svg viewBox="0 0 24 24" fill="currentColor" class="w-3.5 h-3.5 text-black">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      </div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

export function GridMap({ transformers, tickets, substations = [], onSelectTicket }) {
  const [showSubstations, setShowSubstations] = React.useState(true);
  const [showMainLines, setShowMainLines] = React.useState(true);
  const [showTransformers, setShowTransformers] = React.useState(true);
  const [showIncidents, setShowIncidents] = React.useState(true);

  const renderTimeline = (t) => {
    const steps = [
      { key: 'detected', label: 'Alert Detected', time: t.detected_at },
      { key: 'acknowledged', label: 'Operator Acknowledged', time: t.acknowledged_at },
      { key: 'crew_assigned', label: 'Crew Dispatched', time: t.crew_assigned_at },
      { key: 'resolved', label: 'Repair Completed', time: t.resolved_at },
    ];
    return (
      <div className="flex flex-col gap-2 border-t border-white/5 pt-3 mt-3">
        <span className="text-[9px] text-gray-500 font-mono font-semibold tracking-wider">INCIDENT TIMELINE</span>
        <div className="flex flex-col gap-1.5 pl-1">
          {steps.map((step, idx) => (
            <div key={step.key} className="flex items-center gap-2 relative">
               {idx !== steps.length - 1 && (
                 <div className="absolute left-[3px] top-[10px] w-[1px] h-3 bg-gray-700" />
               )}
               <div className={`w-1.5 h-1.5 rounded-full z-10 ${step.time ? 'bg-emerald-500 shadow-[0_0_4px_#10b981]' : 'bg-gray-700'}`} />
               <div className="flex justify-between flex-1 items-center">
                 <span className={`text-[10px] ${step.time ? 'text-gray-200' : 'text-gray-600'}`}>{step.label}</span>
                 {step.time && <span className="text-[9px] text-gray-400 font-mono">{new Date(step.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
               </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-[#16171a] rounded-2xl p-4 flex flex-col flex-[2] relative overflow-hidden shadow-lg">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-sm font-semibold text-white tracking-wide">Live Grid Map — Bangalore Region</h2>
        <div className="text-[10px] bg-[#090a0f]/80 text-gray-300 px-2.5 py-1 rounded font-mono font-semibold tracking-wider">
          {transformers.length} LOCAL STATIONS MONITORED
        </div>
      </div>

      <div className="flex-1 rounded-xl overflow-hidden relative shadow-inner">
        {/* Map Layers Filter Controller Overlay */}
        <div className="absolute top-4 right-4 z-[1000] bg-[#16171a]/95 backdrop-blur-md rounded-lg p-3 flex flex-col gap-2 text-[10px] font-semibold text-gray-300 shadow-xl border border-white/5">
          <span className="text-[9px] uppercase tracking-wider text-gray-500 font-mono font-bold border-b border-white/5 pb-1 mb-1">MAP FILTERS</span>
          <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
            <input type="checkbox" checked={showSubstations} onChange={() => setShowSubstations(!showSubstations)} className="rounded bg-gray-800 border-0 text-sky-500 focus:ring-0 accent-sky-500 w-3 h-3" />
            Substations
          </label>
          <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
            <input type="checkbox" checked={showMainLines} onChange={() => setShowMainLines(!showMainLines)} className="rounded bg-gray-800 border-0 text-yellow-500 focus:ring-0 accent-yellow-500 w-3 h-3" />
            Feeder Lines
          </label>
          <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
            <input type="checkbox" checked={showTransformers} onChange={() => setShowTransformers(!showTransformers)} className="rounded bg-gray-800 border-0 text-yellow-500 focus:ring-0 accent-yellow-500 w-3 h-3" />
            Local Stations
          </label>
          <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
            <input type="checkbox" checked={showIncidents} onChange={() => setShowIncidents(!showIncidents)} className="rounded bg-gray-800 border-0 text-red-500 focus:ring-0 accent-red-500 w-3 h-3" />
            Active Faults
          </label>
        </div>

        <MapContainer
          center={[12.968, 77.594]}
          zoom={13}
          className="w-full h-full bg-[#090a0f]"
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; CARTO'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          {/* Render Power Main Lines (Feeders) */}
          {showMainLines && transformers.map((tx) => {
            if (!tx.lat || !tx.lon || !tx.feeder_id) return null;
            const subId = `SS-${tx.feeder_id.split('-')[1]}`;
            const parentSub = substations.find(s => s.id === subId);
            if (!parentSub || !parentSub.lat || !parentSub.lon) return null;

            return (
              <Polyline
                key={`line-${tx.id}`}
                positions={[[parentSub.lat, parentSub.lon], [tx.lat, tx.lon]]}
                color={tx.has_known_topology ? "#fbbf24" : "#475569"}
                weight={tx.has_known_topology ? 1.2 : 0.8}
                opacity={0.35}
                dashArray={tx.has_known_topology ? "none" : "3, 6"}
              />
            );
          })}

          {/* Render Substations */}
          {showSubstations && substations.map((sub, i) => 
            sub.lat && sub.lon ? (
              <Marker
                key={sub.id || i}
                position={[sub.lat, sub.lon]}
                icon={substationIcon}
              >
                <Tooltip>
                  <div className="p-1 font-sans text-xs">
                    <div className="font-semibold text-sky-400 mb-0.5 uppercase tracking-wide">Main Substation</div>
                    <div className="font-medium text-white">{sub.name} ({sub.id})</div>
                    <div className="text-[10px] text-gray-400 font-mono mt-0.5">{sub.lat.toFixed(4)}°, {sub.lon.toFixed(4)}°</div>
                  </div>
                </Tooltip>
              </Marker>
            ) : null
          )}

          {/* Render Local Stations (Transformers) */}
          {showTransformers && transformers.map((tx, i) =>
            tx.lat && tx.lon ? (
              <Marker
                key={tx.id || i}
                position={[tx.lat, tx.lon]}
                icon={tx.has_known_topology ? mappedStationIcon : estimatedStationIcon}
              >
                <Tooltip>
                  <div className="p-1 font-sans text-xs">
                    <div className="font-semibold text-white mb-1">Station {tx.id}</div>
                    <div className="text-gray-300">{tx.feeder_id} • {tx.capacity_kva} kVA</div>
                    <div className="text-gray-400 text-[10px] mt-0.5 font-mono">{tx.has_known_topology ? 'Mapped Wiring' : 'GPS Estimated'}</div>
                  </div>
                </Tooltip>
              </Marker>
            ) : null
          )}

          {/* Render Active Incidents */}
          {showIncidents && tickets.map((t) =>
            t.fault_location_lat && t.fault_location_lon && t.status !== 'closed' ? (
              <Marker
                key={`fault-${t.id}`}
                position={[t.fault_location_lat, t.fault_location_lon]}
                icon={redFaultIcon}
                eventHandlers={{ click: () => onSelectTicket(t) }}
              >
                {/* Real-time Hover Tooltip */}
                <Tooltip>
                  <div className="p-1 font-sans text-xs space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={t.status} />
                      <span className="font-semibold text-white font-mono">#{t.id}</span>
                    </div>
                    <div className="font-medium text-white pt-1">{t.title}</div>
                    <div className="text-[10px] text-gray-400 font-mono">
                      {t.affected_pole_count} poles affected • {Math.round(t.confidence * 100)}% confidence
                    </div>
                  </div>
                </Tooltip>

                <Popup>
                  <div className="p-1 font-sans text-xs space-y-3">
                    <div className="flex justify-between items-center">
                      <StatusBadge status={t.status} />
                      <span className="text-[10px] font-mono text-gray-400">TICKET #{t.id}</span>
                    </div>
                    
                    <div className="font-semibold text-white text-sm leading-snug">{t.title}</div>
                    
                    {/* Visual metadata ribbon */}
                    <div className="grid grid-cols-1 gap-1.5 text-gray-300 text-[11px] bg-black/30 p-2 rounded">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                        <span>{t.fault_location_lat.toFixed(4)}°, {t.fault_location_lon.toFixed(4)}° <span className="text-gray-500">({t.pincode || '560078'})</span></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                        <span>{t.affected_pole_count} Downstream Poles Affected</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                        <span>{Math.round(t.confidence * 100)}% Accuracy Confidence</span>
                      </div>
                    </div>

                    {renderTimeline(t)}

                    <button
                      className="w-full bg-white text-black font-semibold text-xs py-1.5 rounded hover:bg-gray-200 transition-colors mt-2"
                      onClick={() => onSelectTicket(t)}
                    >
                      Inspect Ticket Details
                    </button>
                  </div>
                </Popup>
              </Marker>
            ) : null
          )}
        </MapContainer>

        {/* Legend block */}
        <div className="absolute bottom-4 left-4 z-[1000] bg-[#16171a]/95 backdrop-blur-md rounded-lg px-3 py-2 flex flex-wrap gap-x-4 gap-y-1.5 text-[9px] font-mono text-gray-300 shadow-xl border border-white/5 max-w-[90%]">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-red-950 flex items-center justify-center shadow-[0_0_4px_#f87171]">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            </span>
            Active Fault
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-lg bg-[#181a20] flex items-center justify-center border border-sky-500/20">
              <span className="w-1.5 h-1.5 rounded bg-sky-400" />
            </span>
            Substation
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 border-t border-dashed border-yellow-400" />
            Feeder Line
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-[#181a20] flex items-center justify-center shadow-[0_0_4px_rgba(251,191,36,0.3)]">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
            </span>
            Mapped Station
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-[#181a20] flex items-center justify-center border border-gray-800">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
            </span>
            Estimated Station
          </div>
        </div>
      </div>
    </div>
  );
}
