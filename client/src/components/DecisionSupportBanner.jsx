import React from 'react';
import { Info } from 'lucide-react';

const DecisionSupportBanner = ({ isDemo = true, modelName = null, compact = false }) => {
  return (
    <div
      className={`rounded-2xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-100 flex items-start gap-3 ${
        compact ? 'px-4 py-3 text-xs' : 'px-5 py-4 text-sm'
      }`}
    >
      <Info size={compact ? 16 : 18} className="text-indigo-300 shrink-0 mt-0.5" />
      <div className="space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-white">Decision-Support Notice</span>
          {isDemo && (
            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/30 text-amber-200 text-[10px] font-bold uppercase tracking-wider">
              Demo Model (Synthetic Data)
            </span>
          )}
          {modelName && (
            <span className="px-2 py-0.5 rounded-md bg-white/10 text-indigo-200 text-[10px] font-medium">
              {modelName}
            </span>
          )}
        </div>
        <p className="text-indigo-200/80 leading-relaxed">
          Risk categories and highlighted academic indicators show statistical associations from available records to assist early human support — they are not proof of causation or final academic judgments.
        </p>
      </div>
    </div>
  );
};

export default DecisionSupportBanner;
