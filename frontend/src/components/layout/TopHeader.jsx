import React from 'react';
import { motion } from 'framer-motion';
import { Zap, AlertTriangle, Hammer, ShieldCheck } from 'lucide-react';

export function TopHeader({ unackCount, activeCount, onOpenConsole }) {
  return (
    <header className="flex justify-between items-center pb-2">
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
          <Zap className="w-5 h-5 text-white" />
          Karnataka Power Grid Dispatch
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Real-time line break detection & automated restoration verification
        </p>
      </div>

      <div className="flex items-center gap-4">
        {unackCount > 0 ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-semibold bg-red-500/10 text-red-400">
            <AlertTriangle className="w-4 h-4 text-red-400 animate-pulse" />
            <span>{unackCount} NEW LINE ALERTS</span>
          </div>
        ) : activeCount > 0 ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-semibold bg-amber-500/10 text-amber-400">
            <Hammer className="w-4 h-4 text-amber-400" />
            <span>{activeCount} REPAIRS IN PROGRESS</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>ALL LINES OPERATIONAL</span>
          </div>
        )}

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="bg-white text-black font-semibold text-xs px-4 py-2 rounded shadow-md hover:bg-gray-200 transition-colors"
          onClick={() => onOpenConsole('fault')}
        >
          Test & Control Console
        </motion.button>
      </div>
    </header>
  );
}
