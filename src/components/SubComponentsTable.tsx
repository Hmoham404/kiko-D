import React from 'react';
import { SubComponentData } from '@/store/useStore';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface SubComponentsTableProps {
  data: SubComponentData[];
}

const COMPONENTS = [
  { name: 'Base', colorClass: 'bg-gradient-to-r from-blue-700 to-indigo-850' },
  { name: 'Cover', colorClass: 'bg-gradient-to-r from-emerald-700 to-green-850' },
  { name: 'Insert', colorClass: 'bg-gradient-to-r from-purple-700 to-fuchsia-850' }
];

export const SubComponentsTable: React.FC<SubComponentsTableProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white/80 backdrop-blur-md border border-slate-100 rounded-2xl p-12 text-center text-slate-500 shadow-xl max-w-lg mx-auto">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">Aucune donnée de sous-composants</h3>
        <p className="text-sm text-slate-400">Importez le fichier Injection.xlsx pour voir les composants.</p>
      </div>
    );
  }

  // Get unique sorted dates
  const uniqueDates = Array.from(new Set(data.map(d => d.date))).sort();

  const formatNum = (num: number) => {
    return new Intl.NumberFormat('fr-FR').format(num);
  };

  const formatPct = (num: number) => {
    return `${(num * 100).toFixed(1)}%`;
  };

  const formatDateDisplay = (dateStr: string) => {
    try {
      const date = parseISO(dateStr);
      return format(date, 'dd/MM/yyyy');
    } catch {
      return dateStr;
    }
  };

  const getDayOfWeek = (dateStr: string) => {
    try {
      const date = parseISO(dateStr);
      return format(date, 'eee', { locale: fr });
    } catch {
      return '';
    }
  };

  return (
    <div className="bg-white/90 backdrop-blur-lg rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden transition-all duration-300 hover:shadow-2xl">
      {/* Premium Header */}
      <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-850 text-white">
        <div className="flex items-center space-x-3">
          <div className="w-3 h-7 bg-red-500 rounded-full animate-pulse"></div>
          <div>
            <span className="text-sm font-extrabold tracking-widest uppercase bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              Détails Injection (Base, Cover, Insert)
            </span>
            <p className="text-[10px] text-slate-400 font-semibold tracking-wide uppercase mt-0.5"> breakdowns par sous-composants </p>
          </div>
        </div>
        <span className="text-xs text-slate-400 font-medium px-3 py-1 bg-white/5 rounded-full border border-white/10 backdrop-blur-sm">
          💡 Basé sur <span className="text-green-400 font-bold">Conform Qty / Target</span>
        </span>
      </div>
      
      <div className="overflow-x-auto max-h-[650px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="sticky top-0 z-20 shadow-[0_4px_10px_rgba(0,0,0,0.05)]">
            {/* Main Header Row */}
            <tr className="bg-slate-900 text-white font-bold uppercase text-center border-b border-slate-850">
              <th className="px-4 py-5 border border-slate-800 sticky left-0 bg-slate-950 z-30 min-w-[140px] text-center tracking-wider font-black text-xs shadow-[4px_0_8px_rgba(0,0,0,0.2)]">
                JOUR / DATE
              </th>
              {COMPONENTS.map(comp => (
                <th 
                  colSpan={7} 
                  key={comp.name} 
                  className={`px-2 py-3 border border-slate-800 text-center tracking-widest font-black text-xs text-white ${comp.colorClass}`}
                >
                  <span className="drop-shadow-md">INJECTION ({comp.name.toUpperCase()})</span>
                </th>
              ))}
            </tr>
            
            {/* Sub-Header Row */}
            <tr className="bg-slate-50 text-slate-700 font-bold uppercase text-center border-b border-slate-200">
              <th className="px-4 py-3 border-r border-slate-200 sticky left-0 bg-slate-50 z-10"></th>
              {COMPONENTS.flatMap(comp => [
                <th key={`${comp.name}-tgt`} className="px-2 py-3 border-r border-slate-200 text-center min-w-[85px] text-[9px] text-slate-500 font-black tracking-wider">TARGET</th>,
                <th key={`${comp.name}-prd`} className="px-2 py-3 border-r border-slate-200 text-center min-w-[90px] text-[9px] text-slate-500 font-black tracking-wider">TOTAL PROD</th>,
                <th key={`${comp.name}-cnf`} className="px-2 py-3 border-r border-slate-200 text-center min-w-[95px] text-[9px] text-slate-500 font-black tracking-wider">CONFORM QTY</th>,
                <th key={`${comp.name}-prg`} className="px-2 py-3 border-r border-slate-200 text-center min-w-[95px] text-[9px] text-slate-500 font-black tracking-wider">% PROGRESS</th>,
                <th key={`${comp.name}-gap`} className="px-2 py-3 border-r border-slate-200 text-center min-w-[90px] text-[9px] text-slate-500 font-black tracking-wider">GAP</th>,
                <th key={`${comp.name}-scp`} className="px-2 py-3 border-r border-slate-200 text-center min-w-[85px] text-[9px] text-red-500 font-black tracking-wider">SCRAP</th>,
                <th key={`${comp.name}-scr`} className="px-2 py-3 border-r border-slate-300 text-center min-w-[85px] text-[9px] text-red-500 font-black tracking-wider">% SCRAP</th>
              ])}
            </tr>
          </thead>
          
          <tbody>
            {uniqueDates.map((date, rIdx) => {
              const isEven = rIdx % 2 === 0;
              return (
                <tr 
                  key={date} 
                  className={`border-b border-slate-100 hover:bg-indigo-50/30 transition-colors duration-200 ${isEven ? 'bg-white' : 'bg-slate-50/50'}`}
                >
                  {/* Sticky Date Column */}
                  <td className="px-4 py-3 border-r border-slate-200 font-extrabold text-slate-800 sticky left-0 bg-white z-10 text-center whitespace-nowrap shadow-[4px_0_8px_-3px_rgba(0,0,0,0.1)]">
                    <span className="bg-slate-100 text-slate-800 px-2 py-1 rounded-md text-[11px] border border-slate-200/60 inline-block font-mono">
                      {formatDateDisplay(date)}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold lowercase tracking-wide block mt-1">
                      {getDayOfWeek(date)}
                    </span>
                  </td>
                  
                  {COMPONENTS.flatMap(comp => {
                    const item = data.find(d => d.date === date && d.component === comp.name);
                    
                    // Cumulative Gap = SUM(targets up to this date) - SUM(conform Qty up to this date)
                    const itemsUpToDate = data.filter(d => d.component === comp.name && d.date <= date);
                    const cumTarget = itemsUpToDate.reduce((sum, d) => sum + d.target, 0);
                    const cumConform = itemsUpToDate.reduce((sum, d) => sum + d.conformQty, 0);
                    const cumGap = cumTarget - cumConform;

                    if (!item) {
                      return [
                        <td key={`${comp.name}-${date}-tgt`} className="px-3 py-3 border-r border-slate-100 text-center text-slate-300 font-mono">-</td>,
                        <td key={`${comp.name}-${date}-prd`} className="px-3 py-3 border-r border-slate-100 text-center text-slate-300 font-mono">-</td>,
                        <td key={`${comp.name}-${date}-cnf`} className="px-3 py-3 border-r border-slate-100 text-center text-slate-300 font-mono">-</td>,
                        <td key={`${comp.name}-${date}-prg`} className="px-3 py-3 border-r border-slate-100 text-center text-slate-300 font-mono">-</td>,
                        <td key={`${comp.name}-${date}-gap`} className="px-3 py-3 border-r border-slate-100 text-center text-slate-300 font-mono">-</td>,
                        <td key={`${comp.name}-${date}-scp`} className="px-3 py-3 border-r border-slate-100 text-center text-slate-300 font-mono">-</td>,
                        <td key={`${comp.name}-${date}-scr`} className="px-3 py-3 border-r border-slate-300 text-center text-slate-300 font-mono">-</td>
                      ];
                    }

                    const progressVal = item.target > 0 ? (item.conformQty / item.target) : 0;
                    
                    let progressBg = 'bg-red-50 text-red-700 border-red-200';
                    let progressBarColor = 'bg-red-500';
                    if (progressVal >= 1.0) {
                      progressBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                      progressBarColor = 'bg-emerald-500';
                    } else if (progressVal >= 0.8) {
                      progressBg = 'bg-amber-50 text-amber-700 border-amber-200';
                      progressBarColor = 'bg-amber-500';
                    }

                    let gapBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                    let gapSign = '';
                    if (cumGap > 0) {
                      gapBg = 'bg-red-50 text-red-700 border-red-200';
                      gapSign = '+';
                    }

                    return [
                      /* Target */
                      <td key={`${comp.name}-${date}-tgt`} className="px-3 py-3 border-r border-slate-100 text-right text-slate-600 font-semibold font-mono">
                        {formatNum(item.target)}
                      </td>,
                      /* Total Prod */
                      <td key={`${comp.name}-${date}-prd`} className="px-3 py-3 border-r border-slate-100 text-right font-bold text-slate-800 font-mono">
                        {formatNum(item.actualProduction)}
                      </td>,
                      /* Conform Qty */
                      <td key={`${comp.name}-${date}-cnf`} className="px-3 py-3 border-r border-slate-200 text-right text-emerald-600 font-extrabold font-mono bg-emerald-50/20">
                        {formatNum(item.conformQty)}
                      </td>,
                      /* % Progress */
                      <td key={`${comp.name}-${date}-prg`} className="px-3 py-3 border-r border-slate-100 text-center font-mono">
                        <div className={`inline-flex flex-col items-center justify-center px-2 py-1 rounded-md border ${progressBg} font-extrabold w-full shadow-sm`}>
                          <span>{formatPct(progressVal)}</span>
                          <div className="w-full bg-slate-200 h-1 rounded-full mt-1 overflow-hidden">
                            <div className={`${progressBarColor} h-1 rounded-full`} style={{ width: `${Math.min(progressVal * 100, 100)}%` }}></div>
                          </div>
                        </div>
                      </td>,
                      /* Gap */
                      <td key={`${comp.name}-${date}-gap`} className="px-3 py-3 border-r border-slate-100 text-center font-mono">
                        <span className={`inline-block px-2 py-0.5 rounded border ${gapBg} font-extrabold shadow-sm`}>
                          {gapSign}{formatNum(cumGap)}
                        </span>
                      </td>,
                      /* Scrap */
                      <td key={`${comp.name}-${date}-scp`} className="px-3 py-3 border-r border-slate-100 text-right text-red-600 font-bold font-mono bg-red-50/10">
                        {formatNum(item.scrapQty)}
                      </td>,
                      /* % Scrap */
                      <td key={`${comp.name}-${date}-scr`} className="px-3 py-3 border-r border-slate-300 text-right text-slate-500 font-medium font-mono">
                        <span className={item.scrapRate > 0.05 ? 'text-red-600 font-bold animate-pulse' : ''}>
                          {formatPct(item.scrapRate)}
                        </span>
                      </td>
                    ];
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
