import React from 'react';

export const ProgressBar: React.FC<{ current: number; total: number; label: string; colorClass?: string }> = ({ 
  current, 
  total, 
  label,
  colorClass = "bg-yellow-400" 
}) => {
  const percentage = Math.min(100, Math.max(0, (current / total) * 100));
  
  return (
    <div className="w-full">
      <div className="flex justify-between mb-1">
        <span className="text-sm font-bold text-slate-700">{label}</span>
        <span className="text-sm font-bold text-slate-500">{current}/{total}</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden border border-slate-300">
        <div 
          className={`h-4 rounded-full ${colorClass} transition-all duration-1000 ease-out`}
          style={{ width: `${percentage}%` }}
        >
            <div className="w-full h-full opacity-30 bg-[linear-gradient(45deg,rgba(255,255,255,.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,.15)_50%,rgba(255,255,255,.15)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]"></div>
        </div>
      </div>
    </div>
  );
};
