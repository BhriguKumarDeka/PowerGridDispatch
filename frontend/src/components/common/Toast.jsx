import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function ToastContainer({ toasts }) {
  return (
    <div className="fixed top-5 right-5 z-[3000] flex flex-col gap-2 max-w-sm pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 50, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.9 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="pointer-events-auto bg-[#181a20] border border-white/20 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 font-mono text-xs"
          >
            <span
              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                toast.type === 'error'
                  ? 'bg-red-400 shadow-[0_0_10px_#f87171]'
                  : toast.type === 'warning'
                  ? 'bg-amber-400'
                  : toast.type === 'success'
                  ? 'bg-emerald-400'
                  : 'bg-white'
              }`}
            />
            <span className="font-semibold text-slate-100">{toast.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
