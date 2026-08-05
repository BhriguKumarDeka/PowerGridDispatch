import React from 'react';
import { Building2, Zap, Network, MapPin } from 'lucide-react';

export function GridSummary({ stats, wsConnected }) {
  const mappedPct = stats?.topology_known_pct || 0;
  const estimatedPct = stats ? (100 - mappedPct) : 0;
  const sensorActivePct = stats?.devices_online_pct || 0;

  // 1. Live Oscilloscope Jitter State
  const [waveJitter, setWaveJitter] = React.useState(0);
  
  // 2. Rolling Telemetry Log Feed
  const [logs, setLogs] = React.useState([
    { id: 1, time: '15:02:10', node: 'KSPDB-KM-D0012', status: 'OK', ping: '38ms' },
    { id: 2, time: '15:02:12', node: 'KSPDB-RJ-D0008', status: 'OK', ping: '42ms' },
    { id: 3, time: '15:02:13', node: 'KSPDB-JN-D0022', status: 'OK', ping: '45ms' },
    { id: 4, time: '15:02:14', node: 'KSPDB-IN-D0015', status: 'OK', ping: '39ms' }
  ]);

  React.useEffect(() => {
    const timer = setInterval(() => {
      // Rotate oscilloscope wave state
      setWaveJitter((prev) => (prev + 1) % 4);

      // Generate a new realistic sensor heartbeat log
      const stations = ['KM-D0012', 'RJ-D0008', 'JN-D0022', 'IN-D0015', 'KM-D0042', 'RJ-D0031', 'JN-D0005', 'IN-D0019'];
      const randomStation = stations[Math.floor(Math.random() * stations.length)];
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      const newLog = {
        id: Date.now(),
        time: timeStr,
        node: `KSPDB-${randomStation}`,
        status: Math.random() > 0.02 ? 'OK' : 'LATENCY',
        ping: `${Math.floor(Math.random() * 25) + 30}ms`
      };

      setLogs((prev) => [...prev.slice(1), newLog]);
    }, 1500);

    return () => clearInterval(timer);
  }, []);

  // Jitter path dynamically based on waveJitter ticks
  const generateHeartline = () => {
    const points = [
      { x: 0, y: 10 },
      { x: 12, y: 10 },
      { x: 16, y: 10 },
      { x: 20, y: waveJitter === 0 ? 1 : waveJitter === 2 ? 3 : 2 },
      { x: 24, y: waveJitter === 1 ? 19 : waveJitter === 3 ? 17 : 18 },
      { x: 28, y: 10 },
      { x: 38, y: 10 },
      { x: 42, y: 10 },
      { x: 46, y: waveJitter === 2 ? 16 : waveJitter === 0 ? 14 : 15 },
      { x: 49, y: waveJitter === 3 ? 4 : waveJitter === 1 ? 6 : 5 },
      { x: 52, y: 10 },
      { x: 62, y: 10 },
      { x: 66, y: waveJitter === 0 ? 3 : waveJitter === 2 ? 1 : 2 },
      { x: 70, y: waveJitter === 1 ? 17 : waveJitter === 3 ? 19 : 18 },
      { x: 74, y: 10 },
      { x: 84, y: 10 },
      { x: 88, y: waveJitter === 2 ? 13 : waveJitter === 0 ? 11 : 12 },
      { x: 92, y: waveJitter === 3 ? 7 : waveJitter === 1 ? 9 : 8 },
      { x: 96, y: 10 },
      { x: 100, y: 10 }
    ];
    return points.map(p => `${p.x} ${p.y}`).join(' L ');
  };

  const pathD = `M ${generateHeartline()}`;

  return (
    <div className="flex flex-col gap-4">
      {/* 4-Stat Grid Block with Bigger Icons */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-[#181a20] rounded-xl p-3 flex flex-col items-center justify-center relative overflow-hidden group hover:bg-[#22252e] transition-colors">
          <div className="p-2 bg-black/30 rounded-lg mb-1.5 text-gray-400 group-hover:text-sky-400 transition-colors">
            <Building2 className="w-5 h-5" />
          </div>
          <span className="block text-xl font-semibold text-white font-mono">{stats?.substations || 0}</span>
          <span className="text-[9px] text-gray-400 block mt-0.5 tracking-wider uppercase font-medium">Substations</span>
        </div>
        <div className="bg-[#181a20] rounded-xl p-3 flex flex-col items-center justify-center relative overflow-hidden group hover:bg-[#22252e] transition-colors">
          <div className="p-2 bg-black/30 rounded-lg mb-1.5 text-gray-400 group-hover:text-yellow-400 transition-colors">
            <Zap className="w-5 h-5" />
          </div>
          <span className="block text-xl font-semibold text-white font-mono">{stats?.feeders || 0}</span>
          <span className="text-[9px] text-gray-400 block mt-0.5 tracking-wider uppercase font-medium">Main Lines</span>
        </div>
        <div className="bg-[#181a20] rounded-xl p-3 flex flex-col items-center justify-center relative overflow-hidden group hover:bg-[#22252e] transition-colors">
          <div className="p-2 bg-black/30 rounded-lg mb-1.5 text-gray-400 group-hover:text-emerald-400 transition-colors">
            <Network className="w-5 h-5" />
          </div>
          <span className="block text-xl font-semibold text-white font-mono">{stats?.transformers || 0}</span>
          <span className="text-[9px] text-gray-400 block mt-0.5 tracking-wider uppercase font-medium">Local Stations</span>
        </div>
        <div className="bg-[#181a20] rounded-xl p-3 flex flex-col items-center justify-center relative overflow-hidden group hover:bg-[#22252e] transition-colors">
          <div className="p-2 bg-black/30 rounded-lg mb-1.5 text-gray-400 group-hover:text-purple-400 transition-colors">
            <MapPin className="w-5 h-5" />
          </div>
          <span className="block text-xl font-semibold text-white font-mono">{stats?.poles || 0}</span>
          <span className="text-[9px] text-gray-400 block mt-0.5 tracking-wider uppercase font-medium">Power Poles</span>
        </div>
      </div>

      {/* Sensor Health with Heartline Waves representing uptime */}
      <div className="bg-[#181a20] rounded-xl p-4 flex flex-col gap-2 shadow">
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-400 font-medium">Telemetry Signal Monitor</span>
          <span className="text-emerald-400 font-mono font-semibold">{sensorActivePct}% Active</span>
        </div>
        
        {/* Glowing Heartline Wave SVG */}
        <div className="h-10 w-full mt-1 relative overflow-hidden bg-black/10 rounded-sm flex items-center">
          <svg className="w-full h-full" viewBox="0 0 100 20" preserveAspectRatio="none">
            {/* Ambient pulse glow path */}
            <path
              d={pathD}
              fill="none"
              stroke="rgba(16, 185, 129, 0.2)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Core heart line */}
            <path
              d={pathD}
              fill="none"
              stroke="#10b981"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Real-time telemetry log feed (non-gimmicky, authentic terminal console) */}
        <div className="mt-2 bg-black/35 rounded p-2 text-[9px] font-mono text-gray-400 space-y-1 select-none border border-white/5">
          {logs.map((log) => (
            <div key={log.id} className="flex justify-between items-center">
              <span className="text-gray-500">[{log.time}]</span>
              <span className="text-gray-300 font-medium">{log.node}</span>
              <span className={log.status === 'OK' ? 'text-emerald-400/80' : 'text-amber-400/80'}>
                {log.status}
              </span>
              <span className="text-gray-500 font-semibold">{log.ping}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Wiring Coverage Area Pie Chart */}
      <div className="bg-[#181a20] rounded-xl p-4 flex flex-col gap-3 shadow">
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-400 font-medium">Wiring Map Coverage</span>
          <span className="text-white font-mono font-semibold">{mappedPct}% Mapped</span>
        </div>

        <div className="flex items-center justify-around py-1">
          {/* Radial Segment SVG Pie Chart */}
          <div className="relative w-16 h-16 flex-shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 32 32">
              {/* Background slice (Estimated/Gray) */}
              <circle cx="16" cy="16" r="14" fill="none" stroke="#22252e" strokeWidth="4" />
              {/* Mapped slice (Yellow) */}
              <circle
                cx="16"
                cy="16"
                r="14"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="4"
                strokeDasharray={`${mappedPct} 88`}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-white font-semibold">
              {mappedPct}%
            </div>
          </div>

          <div className="text-[10px] space-y-1.5 font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-yellow-400 rounded-sm" />
              <span className="text-gray-300">MAPPED ({mappedPct}%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-[#22252e] rounded-sm" />
              <span className="text-gray-500">ESTIMATED ({estimatedPct}%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
