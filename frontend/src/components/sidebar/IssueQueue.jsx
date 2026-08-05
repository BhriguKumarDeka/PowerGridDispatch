import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StatusBadge, PriorityBadge } from '../common/Badge';
import { MapPin, Users, Radio } from 'lucide-react';

export function IssueCard({ issue, isSelected, onSelect, onStatusTransition, onRepair }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`group relative overflow-hidden rounded-xl p-4 cursor-pointer transition-all duration-300 ${
        isSelected 
          ? 'bg-gradient-to-b from-[#1e2129] to-[#15171d] shadow-lg border border-gray-600/50' 
          : 'bg-[#15171d] hover:bg-[#1a1d24] border border-white/5 hover:border-white/10'
      }`}
      onClick={() => onSelect(issue)}
    >
      {/* Selection Glow / Accent */}
      {isSelected && (
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      )}

      {/* Header: ID, Badges */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex flex-col flex-1">
          <div className="flex justify-between items-center w-full mb-1">
            <span className="text-[10px] text-gray-500 font-mono font-semibold tracking-wider">TICKET #{issue.id}</span>
            <div className="flex gap-1.5">
              <PriorityBadge faultType={issue.fault_type} />
              <StatusBadge status={issue.status} />
            </div>
          </div>
          <div className="font-medium text-[13px] text-gray-200 leading-snug pr-2 mt-1">{issue.title}</div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-y-2.5 gap-x-2 text-[10px] text-gray-400 font-mono mb-4 pt-1">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-gray-600" />
          <span className="truncate">{issue.pincode || '560078'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Radio className="w-3.5 h-3.5 text-gray-600" />
          <span className="truncate">{issue.dt_id}</span>
        </div>
        <div className="flex items-center gap-1.5 col-span-2">
          <Users className="w-3.5 h-3.5 text-gray-600" />
          <span>{issue.affected_pole_count} Downstream Poles Affected</span>
        </div>
      </div>

      {/* Action buttons with elegant tinted borders */}
      <div className="flex flex-col pt-3 border-t border-white/5" onClick={(e) => e.stopPropagation()}>
        {issue.status === 'detected' && (
          <motion.button
            whileTap={{ scale: 0.98 }}
            className="w-full py-1.5 px-3 text-[11px] font-semibold tracking-wide rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white transition-colors"
            onClick={() => onStatusTransition(issue.id, 'acknowledged')}
          >
            Acknowledge Alert
          </motion.button>
        )}
        {issue.status === 'acknowledged' && (
          <motion.button
            whileTap={{ scale: 0.98 }}
            className="w-full py-1.5 px-3 text-[11px] font-semibold tracking-wide rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500 hover:text-black transition-colors"
            onClick={() => onStatusTransition(issue.id, 'crew_assigned')}
          >
            Dispatch Field Crew
          </motion.button>
        )}
        {issue.status === 'crew_assigned' && (
          <motion.button
            whileTap={{ scale: 0.98 }}
            className="w-full py-1.5 px-3 text-[11px] font-semibold tracking-wide rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500 hover:text-black transition-colors"
            onClick={() => onStatusTransition(issue.id, 'resolved')}
          >
            Mark Repair Fixed
          </motion.button>
        )}
        {issue.status === 'resolved' && (
          <motion.button
            whileTap={{ scale: 0.98 }}
            className="w-full py-1.5 px-3 text-[11px] font-semibold tracking-wide rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-black transition-colors"
            onClick={() => onRepair(issue.id)}
          >
            Verify Power Line
          </motion.button>
        )}
        {issue.status === 'verified' && (
          <motion.button
            whileTap={{ scale: 0.98 }}
            className="w-full py-1.5 px-3 text-[11px] font-semibold tracking-wide rounded bg-gray-700/30 text-gray-300 border border-gray-600/50 hover:bg-gray-700 hover:text-white transition-colors"
            onClick={() => onStatusTransition(issue.id, 'closed')}
          >
            Archive Ticket
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

export function IssueQueue({
  tickets,
  selectedTicket,
  ticketFilter,
  setTicketFilter,
  unackCount,
  onSelectTicket,
  onStatusTransition,
  onRepairTicket,
}) {
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredTickets = tickets.filter((t) => {
    // 1. Filter by Status Tab
    if (ticketFilter === 'active') {
      // Pending / Active states
      if (t.status === 'closed' || t.status === 'verified') return false;
    } else if (ticketFilter === 'closed') {
      // Solved History / Archive states
      if (t.status !== 'closed' && t.status !== 'verified') return false;
    }
    
    // 2. Filter by Search Query
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchId = String(t.id).includes(q);
      const matchTitle = t.title ? t.title.toLowerCase().includes(q) : false;
      const matchPincode = t.pincode ? t.pincode.toLowerCase().includes(q) : false;
      const matchStation = t.dt_id ? t.dt_id.toLowerCase().includes(q) : false;
      const matchLine = t.feeder_id ? t.feeder_id.toLowerCase().includes(q) : false;
      
      return matchId || matchTitle || matchPincode || matchStation || matchLine;
    }

    return true;
  });

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Search Input Bar */}
      <div className="relative mb-3 flex-shrink-0">
        <input
          type="text"
          placeholder="Search tickets, pincodes, stations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#181a20] text-xs text-white pl-3 pr-8 py-2 rounded outline-none focus:bg-[#22252e] transition-colors font-mono"
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-white text-[10px]"
          >
            ✕
          </button>
        )}
      </div>

      {/* Tabs list (Pending, Solved History, All) */}
      <div className="flex gap-1.5 mb-3 flex-shrink-0">
        <button
          className={`flex-1 py-1.5 text-[10px] tracking-wider font-semibold uppercase rounded transition-colors ${
            ticketFilter === 'active' ? 'bg-white text-black shadow' : 'bg-[#181a20] text-gray-400 hover:bg-[#22252e]'
          }`}
          onClick={() => setTicketFilter('active')}
        >
          Pending ({tickets.filter((t) => t.status !== 'closed' && t.status !== 'verified').length})
        </button>
        <button
          className={`flex-1 py-1.5 text-[10px] tracking-wider font-semibold uppercase rounded transition-colors ${
            ticketFilter === 'closed' ? 'bg-white text-black shadow' : 'bg-[#181a20] text-gray-400 hover:bg-[#22252e]'
          }`}
          onClick={() => setTicketFilter('closed')}
        >
          Solved ({tickets.filter((t) => t.status === 'closed' || t.status === 'verified').length})
        </button>
        <button
          className={`flex-1 py-1.5 text-[10px] tracking-wider font-semibold uppercase rounded transition-colors ${
            ticketFilter === 'all' ? 'bg-white text-black shadow' : 'bg-[#181a20] text-gray-400 hover:bg-[#22252e]'
          }`}
          onClick={() => setTicketFilter('all')}
        >
          All ({tickets.length})
        </button>
      </div>

      {/* List content area */}
      <div className="flex flex-col gap-3 overflow-y-auto flex-1 pr-1">
        <AnimatePresence>
          {filteredTickets.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-500 rounded font-mono bg-[#181a20]/50">
              No matching tickets found
            </div>
          ) : (
            filteredTickets.map((t) => (
              <IssueCard
                key={t.id}
                issue={t}
                isSelected={selectedTicket?.id === t.id}
                onSelect={onSelectTicket}
                onStatusTransition={onStatusTransition}
                onRepair={onRepairTicket}
              />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
