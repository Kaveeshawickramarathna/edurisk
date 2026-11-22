import React from 'react';

const RISK_STYLES = {
  HIGH: 'bg-red-500/15 text-red-300 border-red-500/30',
  MEDIUM: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  LOW: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  UNASSESSED: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
};

const STATUS_STYLES = {
  PENDING: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  IN_PROGRESS: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  COMPLETED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  FOLLOW_UP_NEEDED: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

export const RiskBadge = ({ level = 'UNASSESSED', probability = null }) => {
  const key = (level || 'UNASSESSED').toUpperCase();
  const style = RISK_STYLES[key] || RISK_STYLES.UNASSESSED;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${style}`}>
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          key === 'HIGH'
            ? 'bg-red-400'
            : key === 'MEDIUM'
            ? 'bg-amber-400'
            : key === 'LOW'
            ? 'bg-emerald-400'
            : 'bg-slate-400'
        }`}
      />
      {key}
      {probability !== null && probability !== undefined && key !== 'UNASSESSED' && (
        <span className="opacity-80">({Math.round(Number(probability) * 100)}%)</span>
      )}
    </span>
  );
};

export const StatusBadge = ({ status = 'PENDING' }) => {
  const style = STATUS_STYLES[status] || STATUS_STYLES.PENDING;
  const label = String(status).replace(/_/g, ' ');
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${style}`}>
      {label}
    </span>
  );
};
