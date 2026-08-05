import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, ShieldAlert, Calendar, RefreshCw } from 'lucide-react';

export function SimulatorModal({
  show,
  onClose,
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
  if (!show) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[2000] flex items-center justify-center p-6" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="w-full max-w-2xl bg-[#16171a] shadow-2xl rounded-2xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-start p-6 bg-[#181a20]/60">
            <div>
              <span className="text-[10px] font-bold text-slate-500 font-mono tracking-wider">CONTROL CONSOLE</span>
              <h2 className="text-lg font-black text-white mt-0.5">Grid Simulator & Maintenance Manager</h2>
            </div>
            <button
              className="bg-[#181a20] text-slate-400 hover:text-white p-2 rounded transition-colors"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-2 px-6 pt-3 bg-[#16171a]">
            <button
              className={`pb-2 px-3 text-xs font-bold transition-all relative ${
                simTab === 'fault' ? 'text-white' : 'text-slate-400 hover:text-white'
              }`}
              onClick={() => setSimTab('fault')}
            >
              Simulate Line Break
              {simTab === 'fault' && (
                <motion.div layoutId="simTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
              )}
            </button>
            <button
              className={`pb-2 px-3 text-xs font-bold transition-all relative ${
                simTab === 'noise' ? 'text-white' : 'text-slate-400 hover:text-white'
              }`}
              onClick={() => setSimTab('noise')}
            >
              Simulate Sensor Error
              {simTab === 'noise' && (
                <motion.div layoutId="simTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
              )}
            </button>
            <button
              className={`pb-2 px-3 text-xs font-bold transition-all relative ${
                simTab === 'outages' ? 'text-white' : 'text-slate-400 hover:text-white'
              }`}
              onClick={() => setSimTab('outages')}
            >
              Planned Maintenance
              {simTab === 'outages' && (
                <motion.div layoutId="simTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
              )}
            </button>
          </div>

          <div className="p-6 space-y-4">
            {simMessage && (
              <div className="bg-[#181a20] p-3 rounded-lg text-xs font-mono text-white flex gap-2 items-center">
                <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin flex-shrink-0" />
                <span>{simMessage}</span>
              </div>
            )}

            {simTab === 'fault' && (
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-400 uppercase font-mono tracking-wider">Simulate Overhead Line Break</div>
                <div className="flex flex-col gap-1 text-xs">
                  <label className="text-slate-400 mb-0.5">Failure Type</label>
                  <select
                    className="bg-[#181a20] text-white p-2.5 rounded font-mono border-0 focus:ring-0 focus:outline-none"
                    value={faultType}
                    onChange={(e) => setFaultType(e.target.value)}
                  >
                    <option value="span">Broken Wire Between Poles (Mid-line failure)</option>
                    <option value="dt">Power Station Failure (Entire station dark)</option>
                    <option value="feeder">Main Line Failure (Entire area dark)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1 text-xs">
                  <label className="text-slate-400 mb-0.5">Target Pole or Station ID</label>
                  <input
                    type="text"
                    className="bg-[#181a20] text-white p-2.5 rounded font-mono border-0 focus:ring-0 focus:outline-none"
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    placeholder="e.g. P-000005, D-0001, or F-01-01"
                  />
                </div>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-red-500 text-black font-extrabold text-xs py-3 rounded hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center gap-1.5"
                  onClick={onInjectFault}
                >
                  <Play className="w-4 h-4" />
                  Simulate Line Break Telemetry
                </motion.button>
              </div>
            )}

            {simTab === 'noise' && (
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-400 uppercase font-mono tracking-wider">Simulate Sensor Fault or Noise</div>
                <div className="flex flex-col gap-1 text-xs">
                  <label className="text-slate-400 mb-0.5">Noise Mode</label>
                  <select
                    className="bg-[#181a20] text-white p-2.5 rounded font-mono border-0 focus:ring-0 focus:outline-none"
                    value={noiseType}
                    onChange={(e) => setNoiseType(e.target.value)}
                  >
                    <option value="dead_sensor">Sensor Error (Pole dark with live children)</option>
                    <option value="scheduled_outage">Planned Maintenance Window</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1 text-xs">
                  <label className="text-slate-400 mb-0.5">Target Pole or Line ID</label>
                  <input
                    type="text"
                    className="bg-[#181a20] text-white p-2.5 rounded font-mono border-0 focus:ring-0 focus:outline-none"
                    value={noiseTarget}
                    onChange={(e) => setNoiseTarget(e.target.value)}
                    placeholder="e.g. P-000010 or F-01-01"
                  />
                </div>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-[#181a20] text-white font-extrabold text-xs py-3 rounded hover:bg-[#22252e] transition-colors flex items-center justify-center gap-1.5"
                  onClick={onInjectNoise}
                >
                  <ShieldAlert className="w-4 h-4 text-slate-400" />
                  Inject Sensor Error Signal
                </motion.button>
              </div>
            )}

            {simTab === 'outages' && (
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-400 uppercase font-mono tracking-wider">Schedule Planned Maintenance Outage</div>
                <div className="flex flex-col gap-1 text-xs">
                  <label className="text-slate-400 mb-0.5">Outage Scope</label>
                  <select
                    className="bg-[#181a20] text-white p-2.5 rounded font-mono border-0 focus:ring-0 focus:outline-none"
                    value={outageScope}
                    onChange={(e) => setOutageScope(e.target.value)}
                  >
                    <option value="feeder">Main Line (11kV Feeder)</option>
                    <option value="dt">Local Power Station (DT)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1 text-xs">
                  <label className="text-slate-400 mb-0.5">Target ID</label>
                  <input
                    type="text"
                    className="bg-[#181a20] text-white p-2.5 rounded font-mono border-0 focus:ring-0 focus:outline-none"
                    value={outageTarget}
                    onChange={(e) => setOutageTarget(e.target.value)}
                    placeholder="e.g. F-01-01 or D-0001"
                  />
                </div>
                <div className="flex flex-col gap-1 text-xs">
                  <label className="text-slate-400 mb-0.5">Duration (Minutes)</label>
                  <input
                    type="number"
                    className="bg-[#181a20] text-white p-2.5 rounded font-mono border-0 focus:ring-0 focus:outline-none"
                    value={outageDuration}
                    onChange={(e) => setOutageDuration(Number(e.target.value))}
                  />
                </div>
                <div className="flex flex-col gap-1 text-xs">
                  <label className="text-slate-400 mb-0.5">Maintenance Description</label>
                  <input
                    type="text"
                    className="bg-[#181a20] text-white p-2.5 rounded font-mono border-0 focus:ring-0 focus:outline-none"
                    value={outageReason}
                    onChange={(e) => setOutageReason(e.target.value)}
                  />
                </div>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-[#181a20] text-white font-extrabold text-xs py-3 rounded hover:bg-[#22252e] transition-colors flex items-center justify-center gap-1.5"
                  onClick={onCreateOutage}
                >
                  <Calendar className="w-4 h-4 text-slate-400" />
                  Save Planned Maintenance Window
                </motion.button>
              </div>
            )}

            <div className="pt-4 flex justify-between items-center">
              <button
                className="text-xs font-bold text-red-400 bg-red-500/10 px-3 py-2 rounded hover:bg-red-500/20 transition-colors"
                onClick={onResetSystem}
              >
                Reset System Baseline
              </button>
              <button
                className="bg-[#181a20] text-slate-300 px-4 py-2 rounded text-xs font-bold hover:text-white transition-colors"
                onClick={onClose}
              >
                Close Console
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
