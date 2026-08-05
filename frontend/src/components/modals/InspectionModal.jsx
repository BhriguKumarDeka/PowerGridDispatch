import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StatusBadge } from '../common/Badge';
import { X, MapPin, Radio, Activity, Users, FileText, ChevronRight } from 'lucide-react';

export function InspectionModal({ ticket, onClose, onStatusTransition, onRepairTicket, onGenerateAi, loadingAi }) {
  if (!ticket) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[2000] flex items-center justify-center p-6" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="w-full max-w-lg bg-[#16171a] shadow-2xl rounded-xl max-h-[85vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Ticket Branding */}
          <div className="flex justify-between items-center px-6 py-4 bg-[#181a20]/80">
            <div className="flex items-center gap-3">
              <span className="text-[10px] bg-white/5 text-gray-400 px-2 py-0.5 rounded-sm font-mono tracking-wider">
                TICKET #{ticket.id}
              </span>
              <StatusBadge status={ticket.status} />
            </div>
            <button
              className="text-gray-400 hover:text-white p-1 rounded transition-colors"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto space-y-5 flex-1">
            {/* Visual Ticket Title */}
            <div>
              <span className="text-[10px] text-red-400 font-mono tracking-widest uppercase block mb-1">
                {ticket.fault_type === 'feeder' ? 'Main Grid Failure' : ticket.fault_type === 'dt' ? 'Station Issue' : 'Broken Overhead Wire'}
              </span>
              <h2 className="text-lg font-semibold text-white tracking-tight leading-snug">
                {ticket.title}
              </h2>
            </div>

            {/* Wire Break Flow Section */}
            <div className="bg-[#181a20] p-4 rounded-lg flex items-center justify-between">
              <div className="text-center flex-1">
                <span className="block text-[10px] text-gray-500 font-mono">LIVE POLE</span>
                <span className="text-sm font-semibold text-emerald-400 font-mono mt-0.5 block">{ticket.fault_span_from_pole_id || 'Station Source'}</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-600 animate-pulse" />
              <div className="text-center flex-1">
                <span className="block text-[10px] text-gray-500 font-mono">DARK POLE</span>
                <span className="text-sm font-semibold text-red-400 font-mono mt-0.5 block">{ticket.fault_span_to_pole_id || 'Dark Pole'}</span>
              </div>
            </div>

            {/* Grid Metrics Ribbon */}
            <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
              <div className="flex items-center gap-2.5 text-gray-300">
                <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <span>{ticket.fault_location_lat.toFixed(4)}°, {ticket.fault_location_lon.toFixed(4)}° <span className="text-gray-500">({ticket.pincode || '560078'})</span></span>
              </div>
              <div className="flex items-center gap-2.5 text-gray-300">
                <Radio className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <span className="font-mono">{ticket.dt_id} <span className="text-gray-500">/</span> {ticket.feeder_id}</span>
              </div>
              <div className="flex items-center gap-2.5 text-gray-300">
                <Users className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <span>{ticket.affected_pole_count} Downstream Poles Dark</span>
              </div>
              <div className="flex items-center gap-2.5 text-gray-300">
                <Activity className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <span>{Math.round(ticket.confidence * 100)}% Accuracy <span className="text-gray-500">({ticket.topology_source === 'known' ? 'Mapped' : 'Estimated'})</span></span>
              </div>
            </div>

            {/* Proof text */}
            <div className="text-xs text-gray-400 leading-relaxed border-t border-white/5 pt-4">
              {ticket.confidence_reason}
            </div>

            {/* Groq summary */}
            {ticket.ai_summary ? (
              <div className="bg-emerald-500/5 p-4 rounded-lg space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-mono tracking-wider uppercase">
                  <FileText className="w-3.5 h-3.5" />
                  Field Dispatch Brief
                </div>
                <div className="text-xs text-gray-200 leading-relaxed font-mono">
                  {ticket.ai_summary}
                </div>
              </div>
            ) : (
              <motion.button
                whileTap={{ scale: 0.98 }}
                className="w-full bg-white/5 text-gray-200 hover:text-white font-semibold text-xs py-2.5 rounded transition-colors"
                onClick={() => onGenerateAi(ticket.id)}
                disabled={loadingAi}
              >
                {loadingAi ? 'Writing Handoff Brief...' : 'Generate Handoff Brief (Groq AI)'}
              </motion.button>
            )}
          </div>

          {/* Action footer */}
          <div className="p-4 bg-[#181a20]/60 flex justify-end">
            {ticket.status === 'detected' && (
              <button className="w-full py-2.5 text-xs font-semibold rounded bg-red-500 text-black hover:bg-red-600 hover:text-white transition-colors" onClick={() => onStatusTransition(ticket.id, 'acknowledged')}>
                Accept Line Alert
              </button>
            )}
            {ticket.status === 'acknowledged' && (
              <button className="w-full py-2.5 text-xs font-semibold rounded bg-amber-400 text-black hover:bg-amber-500 hover:text-white transition-colors" onClick={() => onStatusTransition(ticket.id, 'crew_assigned')}>
                Dispatch Repair Crew
              </button>
            )}
            {ticket.status === 'crew_assigned' && (
              <button className="w-full py-2.5 text-xs font-semibold rounded bg-sky-400 text-black hover:bg-sky-500 hover:text-white transition-colors" onClick={() => onStatusTransition(ticket.id, 'resolved')}>
                Confirm Repair Completed
              </button>
            )}
            {ticket.status === 'resolved' && (
              <button className="w-full py-2.5 text-xs font-semibold rounded bg-emerald-400 text-black hover:bg-emerald-500 hover:text-white transition-colors" onClick={() => onRepairTicket(ticket.id)}>
                Verify Line Restoration
              </button>
            )}
            {ticket.status === 'verified' && (
              <button className="w-full py-2.5 text-xs font-semibold rounded bg-[#181a20] text-white hover:bg-[#22252e] transition-colors" onClick={() => onStatusTransition(ticket.id, 'closed')}>
                Archive Closed Ticket
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
