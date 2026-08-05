import React from 'react';
import { motion } from 'framer-motion';
import { Play, ShieldAlert, Calendar, RefreshCw, ZapOff } from 'lucide-react';

export function SandboxPanel({
  simTab,
  setSimTab,
  simMessage,
  faultType,
  setFaultType,
  targetId,
  setTargetId,
  noiseType,
  setNoiseType,
  noiseTarget,
  setNoiseTarget,
  outageScope,
  setOutageScope,
  outageTarget,
  setOutageTarget,
  outageDuration,
  setOutageDuration,
  outageReason,
  setOutageReason,
  onInjectFault,
  onInjectNoise,
  onCreateOutage,
  onResetSystem,
}) {
  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Sandbox Sub-Tab Switcher */}
      <div className="flex bg-[#1f2128]/50 p-0.5 rounded-lg border border-white/5 flex-shrink-0">
        <button
          className={`flex-1 py-1.5 text-center text-[10px] font-bold rounded-md tracking-wider transition-all ${
            simTab === 'fault' ? 'bg-[#2a2d37] text-white' : 'text-gray-400 hover:text-white'
          }`}
          onClick={() => setSimTab('fault')}
        >
          BREAK
        </button>
        <button
          className={`flex-1 py-1.5 text-center text-[10px] font-bold rounded-md tracking-wider transition-all ${
            simTab === 'noise' ? 'bg-[#2a2d37] text-white' : 'text-gray-400 hover:text-white'
          }`}
          onClick={() => setSimTab('noise')}
        >
          ERROR
        </button>
        <button
          className={`flex-1 py-1.5 text-center text-[10px] font-bold rounded-md tracking-wider transition-all ${
            simTab === 'outages' ? 'bg-[#2a2d37] text-white' : 'text-gray-400 hover:text-white'
          }`}
          onClick={() => setSimTab('outages')}
        >
          SHED
        </button>
      </div>

      {/* Simulator Message Log */}
      {simMessage && (
        <div className="bg-[#1c1d24] p-3 rounded-lg border border-white/5 text-[11px] font-mono text-slate-300 flex gap-2 items-start flex-shrink-0">
          <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin flex-shrink-0 mt-0.5" />
          <span className="break-all">{simMessage}</span>
        </div>
      )}

      {/* Sandbox Panel Scrollable Body */}
      <div className="flex-1 overflow-y-auto pr-0.5 space-y-4 min-h-0 text-xs">
        {simTab === 'fault' && (
          <div className="space-y-3">
            <span className="text-[10px] font-bold text-slate-500 font-mono tracking-wider block">INJECT OVERHEAD LINE BREAK</span>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-gray-400 font-medium">Fault Hierarchy Level</label>
              <select
                className="bg-[#1c1d24] text-white p-2 rounded-lg border border-white/5 focus:outline-none font-mono text-[11px]"
                value={faultType}
                onChange={(e) => setFaultType(e.target.value)}
              >
                <option value="span">Span Failure (Mid-line Break)</option>
                <option value="dt">Transformer Failure (DT Outage)</option>
                <option value="feeder">Substation Failure (Feeder Outage)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-gray-400 font-medium">Target ID</label>
              <input
                type="text"
                className="bg-[#1c1d24] text-white p-2 rounded-lg border border-white/5 focus:outline-none font-mono text-[11px]"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                placeholder="e.g. P-000005, D-0001, or F-01-01"
              />
            </div>

            <motion.button
              whileTap={{ scale: 0.98 }}
              className="w-full bg-red-500/10 text-red-400 border border-red-500/20 font-bold py-2.5 rounded-lg hover:bg-red-500 hover:text-black hover:border-transparent transition-all flex items-center justify-center gap-1.5"
              onClick={onInjectFault}
            >
              <ZapOff className="w-3.5 h-3.5" />
              Simulate Outage Telemetry
            </motion.button>
          </div>
        )}

        {simTab === 'noise' && (
          <div className="space-y-3">
            <span className="text-[10px] font-bold text-slate-500 font-mono tracking-wider block">INJECT TELEMETRY NOISE</span>

            <div className="flex flex-col gap-1.5">
              <label className="text-gray-400 font-medium">Noise Simulation Mode</label>
              <select
                className="bg-[#1c1d24] text-white p-2 rounded-lg border border-white/5 focus:outline-none font-mono text-[11px]"
                value={noiseType}
                onChange={(e) => setNoiseType(e.target.value)}
              >
                <option value="dead_sensor">Dead Sensor (Isolated Dark Pole)</option>
                <option value="scheduled_outage">Device Telemetry Failure</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-gray-400 font-medium">Target ID</label>
              <input
                type="text"
                className="bg-[#1c1d24] text-white p-2 rounded-lg border border-white/5 focus:outline-none font-mono text-[11px]"
                value={noiseTarget}
                onChange={(e) => setNoiseTarget(e.target.value)}
                placeholder="e.g. P-000010 or F-01-01"
              />
            </div>

            <motion.button
              whileTap={{ scale: 0.98 }}
              className="w-full bg-[#2a2d37] text-white font-bold py-2.5 rounded-lg hover:bg-white hover:text-black transition-all flex items-center justify-center gap-1.5 border border-white/5"
              onClick={onInjectNoise}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Simulate Sensor Error
            </motion.button>
          </div>
        )}

        {simTab === 'outages' && (
          <div className="space-y-3">
            <span className="text-[10px] font-bold text-slate-500 font-mono tracking-wider block">SCHEDULE PLANNED SHEDDING</span>

            <div className="flex flex-col gap-1.5">
              <label className="text-gray-400 font-medium">Outage Scope</label>
              <select
                className="bg-[#1c1d24] text-white p-2 rounded-lg border border-white/5 focus:outline-none font-mono text-[11px]"
                value={outageScope}
                onChange={(e) => setOutageScope(e.target.value)}
              >
                <option value="feeder">11kV Feeder Scope</option>
                <option value="dt">Transformer (DT) Scope</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-gray-400 font-medium">Target ID</label>
              <input
                type="text"
                className="bg-[#1c1d24] text-white p-2 rounded-lg border border-white/5 focus:outline-none font-mono text-[11px]"
                value={outageTarget}
                onChange={(e) => setOutageTarget(e.target.value)}
                placeholder="e.g. F-01-01 or D-0001"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-gray-400 font-medium">Duration (Minutes)</label>
              <input
                type="number"
                className="bg-[#1c1d24] text-white p-2 rounded-lg border border-white/5 focus:outline-none font-mono text-[11px]"
                value={outageDuration}
                onChange={(e) => setOutageDuration(Number(e.target.value))}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-gray-400 font-medium">Maintenance Reason</label>
              <input
                type="text"
                className="bg-[#1c1d24] text-white p-2 rounded-lg border border-white/5 focus:outline-none font-mono text-[11px]"
                value={outageReason}
                onChange={(e) => setOutageReason(e.target.value)}
              />
            </div>

            <motion.button
              whileTap={{ scale: 0.98 }}
              className="w-full bg-[#2a2d37] text-white font-bold py-2.5 rounded-lg hover:bg-white hover:text-black transition-all flex items-center justify-center gap-1.5 border border-white/5"
              onClick={onCreateOutage}
            >
              <Calendar className="w-3.5 h-3.5" />
              Save Maintenance Outage
            </motion.button>
          </div>
        )}
      </div>

      {/* Baseline Operations */}
      <div className="pt-3 border-t border-white/5 flex-shrink-0 flex gap-2">
        <button
          className="flex-1 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-black font-semibold py-2 rounded-lg transition-all text-[11px]"
          onClick={onResetSystem}
        >
          Reset Baseline
        </button>
      </div>
    </div>
  );
}
