import React from 'react';
import { motion } from 'framer-motion';
import { Grid, AlertTriangle, Calendar, Cpu } from 'lucide-react';

export function NavSidebar({ activeNav, setActiveNav, unackCount, status, wsConnected, onOpenConsole }) {
  return (
    <nav className="w-18 bg-[#111318] flex flex-col items-center py-5 flex-shrink-0 z-50 shadow-2xl">
      <div className="mb-8">
        <div className="w-11 h-11 bg-white text-black font-mono font-semibold text-xs rounded flex items-center justify-center tracking-wider shadow-lg">
          KSPDB
        </div>
      </div>

      <div className="flex flex-col gap-4 w-full items-center">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`w-12 h-12 rounded flex flex-col items-center justify-center relative transition-colors ${
            activeNav === 'dashboard'
              ? 'bg-[#22252e] text-white shadow-md'
              : 'text-gray-400 hover:bg-[#181a20] hover:text-white'
          }`}
          onClick={() => setActiveNav('dashboard')}
          title="Grid Dashboard"
        >
          <Grid className="w-5 h-5" />
          <span className="text-[9px] font-semibold mt-0.5">Grid</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`w-12 h-12 rounded flex flex-col items-center justify-center relative transition-colors ${
            activeNav === 'incidents'
              ? 'bg-[#22252e] text-white shadow-md'
              : 'text-gray-400 hover:bg-[#181a20] hover:text-white'
          }`}
          onClick={() => {
            setActiveNav('incidents');
            // Proactively switch view
          }}
          title="Line Issues"
        >
          <AlertTriangle className="w-5 h-5" />
          <span className="text-[9px] font-semibold mt-0.5">Issues</span>
          {unackCount > 0 && (
            <span className="absolute top-1 right-1 bg-red-500 text-black text-[9px] font-semibold w-4.5 h-4 flex items-center justify-center rounded-sm">
              {unackCount}
            </span>
          )}
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`w-12 h-12 rounded flex flex-col items-center justify-center relative transition-colors ${
            activeNav === 'outages'
              ? 'bg-[#22252e] text-white shadow-md'
              : 'text-gray-400 hover:bg-[#181a20] hover:text-white'
          }`}
          onClick={() => onOpenConsole('outages')}
          title="Planned Maintenance"
        >
          <Calendar className="w-5 h-5" />
          <span className="text-[9px] font-semibold mt-0.5">Outages</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`w-12 h-12 rounded flex flex-col items-center justify-center relative transition-colors ${
            activeNav === 'simulator'
              ? 'bg-[#22252e] text-white shadow-md'
              : 'text-gray-400 hover:bg-[#181a20] hover:text-white'
          }`}
          onClick={() => onOpenConsole('fault')}
          title="Control & Simulator"
        >
          <Cpu className="w-5 h-5" />
          <span className="text-[9px] font-semibold mt-0.5">Console</span>
        </motion.button>
      </div>

      <div className="mt-auto">
        <div
          className={`w-2.5 h-2.5 rounded-sm ${
            status === 'connected' ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-red-500'
          }`}
          title={wsConnected ? 'Realtime Live' : 'Polling'}
        />
      </div>
    </nav>
  );
}
