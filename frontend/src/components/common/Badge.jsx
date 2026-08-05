import React from 'react';

export function StatusBadge({ status }) {
  const getStatusColor = (s) => {
    switch (s) {
      case 'detected':
        return { text: 'text-red-400', bg: 'bg-red-500/10', dot: 'bg-red-400' };
      case 'acknowledged':
        return { text: 'text-amber-400', bg: 'bg-amber-500/10', dot: 'bg-amber-400' };
      case 'crew_assigned':
        return { text: 'text-sky-400', bg: 'bg-sky-500/10', dot: 'bg-sky-400' };
      case 'resolved':
        return { text: 'text-amber-400', bg: 'bg-amber-500/10', dot: 'bg-amber-400' };
      case 'verified':
        return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', dot: 'bg-emerald-400' };
      case 'closed':
        return { text: 'text-neutral-400', bg: 'bg-neutral-500/10', dot: 'bg-neutral-400' };
      default:
        return { text: 'text-neutral-300', bg: 'bg-neutral-700/20', dot: 'bg-neutral-300' };
    }
  };

  const getFriendlyStatusLabel = (s) => {
    switch (s) {
      case 'detected': return 'NEW ALERT';
      case 'acknowledged': return 'ACCEPTED';
      case 'crew_assigned': return 'DISPATCHED';
      case 'resolved': return 'REPAIRED';
      case 'verified': return 'VERIFIED';
      case 'closed': return 'CLOSED';
      default: return (s || '').toUpperCase();
    }
  };

  const colors = getStatusColor(status);

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-mono font-bold tracking-widest rounded-sm ${colors.bg} ${colors.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot} animate-pulse`} />
      {getFriendlyStatusLabel(status)}
    </span>
  );
}

export function PriorityBadge({ faultType }) {
  const getPriorityInfo = (type) => {
    if (type === 'feeder') {
      return { label: 'CRITICAL', text: 'text-red-400', bg: 'bg-red-500/10' };
    }
    if (type === 'dt') {
      return { label: 'STATION FAILURE', text: 'text-amber-400', bg: 'bg-amber-500/10' };
    }
    return { label: 'WIRE BREAK', text: 'text-neutral-300', bg: 'bg-neutral-800/30' };
  };

  const info = getPriorityInfo(faultType);
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono font-bold tracking-widest rounded-sm ${info.bg} ${info.text}`}>
      {info.label}
    </span>
  );
}

