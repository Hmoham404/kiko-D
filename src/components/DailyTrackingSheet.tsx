import React from 'react';
import { ProductionData } from '@/store/useStore';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DailyTrackingSheetProps {
  data: ProductionData[];
}

const DEPARTMENTS = [
  { storeName: 'Injection', displayName: 'INJECTION', colorClass: 'bg-gradient-to-r from-blue-700 to-indigo-850', borderClass: 'border-l-blue-600' },
  { storeName: 'Soudure', displayName: 'US WELDING', colorClass: 'bg-gradient-to-r from-teal-700 to-cyan-850', borderClass: 'border-l-teal-600' },
  { storeName: 'Metallisation', displayName: 'METALLISATION', colorClass: 'bg-gradient-to-r from-indigo-700 to-violet-850', borderClass: 'border-l-indigo-600' },
  { storeName: 'US serigraphie', displayName: 'PRINTING', colorClass: 'bg-gradient-to-r from-violet-700 to-purple-850', borderClass: 'border-l-violet-600' },
  { storeName: 'Assemblage', displayName: 'ASSEMBLAGE', colorClass: 'bg-gradient-to-r from-fuchsia-700 to-pink-850', borderClass: 'border-l-fuchsia-600' },
  { storeName: 'Packaging', displayName: 'PACKAGING', colorClass: 'bg-gradient-to-r from-emerald-700 to-green-850', borderClass: 'border-l-emerald-600' }
];

export const DailyTrackingSheet: React.FC<DailyTrackingSheetProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white/80 backdrop-blur-md border border-slate-100 rounded-2xl p-12 text-center text-slate-500 shadow-xl max-w-lg mx-auto">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H3a2 2 0 002-2V5a2 2 0 00-2-2h9l2 2h6a2 2 0 012 2v12a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">Aucune donnée disponible</h3>
        <p className="text-sm text-slate-400">Veuillez importer un fichier Excel pour commencer.</p>
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
              Vue Journalière Premium
            </span>
            <p className="text-[10px] text-slate-400 font-semibold tracking-wide uppercase mt-0.5">Style Tableur d'Origine Réinventé</p>
          </div>
        </div>
        <span className="text-xs text-slate-400 font-medium px-3 py-1 bg-white/5 rounded-full border border-white/10 backdrop-blur-sm">
          💡 Performance basée sur <span className="text-green-400 font-bold">Conform Qty / Target</span>
        </span>
      </div>
      
      <div className="overflow-x-auto max-h-[650px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="sticky top-0 z-20 shadow-[0_4px_10px_rgba(0,0,0,0.05)]">
            {/* Main Header Row */}
            <tr className="bg-slate-900 text-white font-bold uppercase text-center border-b border-slate-850">
              <th className="px-4 py-5 border border-slate-800 sticky left-0 bg-slate-950 z-30 min-w-[140px] text-center tracking-wider font-black text-xs shadow-[2px_0_5px_rgba(0,0,0,0.2)]">
                JOUR / DATE
              </th>
              {DEPARTMENTS.map(dept => (
                <th 
                  colSpan={7} 
                  key={dept.storeName} 
                  className={`px-2 py-3 border border-slate-800 text-center tracking-widest font-black text-xs text-white ${dept.colorClass}`}
                >
                  <span className="drop-shadow-md">{dept.displayName}</span>
                </th>
              ))}
            </tr>
            
            {/* Sub-Header Row */}
            <tr className="bg-slate-50 text-slate-700 font-bold uppercase text-center border-b border-slate-200">
              <th className="px-4 py-3 border-r border-slate-200 sticky left-0 bg-slate-50 z-10"></th>
              {DEPARTMENTS.flatMap(dept => [
                <th key={`${dept.storeName}-tgt`} className="px-2 py-3 border-r border-slate-200 text-center min-w-[85px] text-[9px] text-slate-500 font-black tracking-wider">TARGET</th>,
                <th key={`${dept.storeName}-prd`} className="px-2 py-3 border-r border-slate-200 text-center min-w-[90px] text-[9px] text-slate-500 font-black tracking-wider">TOTAL PROD</th>,
                <th key={`${dept.storeName}-cnf`} className="px-2 py-3 border-r border-slate-200 text-center min-w-[95px] text-[9px] text-slate-500 font-black tracking-wider">CONFORM QTY</th>,
                <th key={`${dept.storeName}-prg`} className="px-2 py-3 border-r border-slate-200 text-center min-w-[95px] text-[9px] text-slate-500 font-black tracking-wider">% PROGRESS</th>,
                <th key={`${dept.storeName}-gap`} className="px-2 py-3 border-r border-slate-200 text-center min-w-[90px] text-[9px] text-slate-500 font-black tracking-wider">GAP</th>,
                <th key={`${dept.storeName}-scp`} className="px-2 py-3 border-r border-slate-200 text-center min-w-[85px] text-[9px] text-red-500 font-black tracking-wider">SCRAP</th>,
                <th key={`${dept.storeName}-scr`} className="px-2 py-3 border-r border-slate-300 text-center min-w-[85px] text-[9px] text-red-500 font-black tracking-wider">% SCRAP</th>
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
                  
                  {DEPARTMENTS.flatMap(dept => {
                    const item = data.find(d => d.date === date && d.department === dept.storeName);
                    
                    // Cumulative Gap = SUM(targets up to this date) - SUM(conform Qty up to this date)
                    const itemsUpToDate = data.filter(d => d.department === dept.storeName && d.date <= date);
                    const cumTarget = itemsUpToDate.reduce((sum, d) => sum + d.target, 0);
                    const cumConform = itemsUpToDate.reduce((sum, d) => sum + d.conformQty, 0);
                    const cumGap = cumTarget - cumConform;

                    if (!item) {
                      return [
                        <td key={`${dept.storeName}-${date}-tgt`} className="px-3 py-3 border-r border-slate-100 text-center text-slate-300 font-mono">-</td>,
                        <td key={`${dept.storeName}-${date}-prd`} className="px-3 py-3 border-r border-slate-100 text-center text-slate-300 font-mono">-</td>,
                        <td key={`${dept.storeName}-${date}-cnf`} className="px-3 py-3 border-r border-slate-100 text-center text-slate-300 font-mono">-</td>,
                        <td key={`${dept.storeName}-${date}-prg`} className="px-3 py-3 border-r border-slate-100 text-center text-slate-300 font-mono">-</td>,
                        <td key={`${dept.storeName}-${date}-gap`} className="px-3 py-3 border-r border-slate-100 text-center text-slate-300 font-mono">-</td>,
                        <td key={`${dept.storeName}-${date}-scp`} className="px-3 py-3 border-r border-slate-100 text-center text-slate-300 font-mono">-</td>,
                        <td key={`${dept.storeName}-${date}-scr`} className="px-3 py-3 border-r border-slate-300 text-center text-slate-300 font-mono">-</td>
                      ];
                    }

                    const progressVal = item.target > 0 ? (item.conformQty / item.target) : 0;
                    
                    // Premium styling based on performance
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
                      <td key={`${dept.storeName}-${date}-tgt`} className="px-3 py-3 border-r border-slate-100 text-right text-slate-600 font-semibold font-mono">
                        {formatNum(item.target)}
                      </td>,
                      /* Total Prod */
                      <td key={`${dept.storeName}-${date}-prd`} className="px-3 py-3 border-r border-slate-100 text-right font-bold text-slate-800 font-mono">
                        {formatNum(item.actualProduction)}
                      </td>,
                      /* Conform Qty */
                      <td key={`${dept.storeName}-${date}-cnf`} className="px-3 py-3 border-r border-slate-200 text-right text-emerald-600 font-extrabold font-mono bg-emerald-50/20">
                        {formatNum(item.conformQty)}
                      </td>,
                      /* % Progress */
                      <td key={`${dept.storeName}-${date}-prg`} className="px-3 py-3 border-r border-slate-100 text-center font-mono">
                        <div className={`inline-flex flex-col items-center justify-center px-2 py-1 rounded-md border ${progressBg} font-extrabold w-full shadow-sm`}>
                          <span>{formatPct(progressVal)}</span>
                          <div className="w-full bg-slate-200 h-1 rounded-full mt-1 overflow-hidden">
                            <div className={`${progressBarColor} h-1 rounded-full`} style={{ width: `${Math.min(progressVal * 100, 100)}%` }}></div>
                          </div>
                        </div>
                      </td>,
                      /* Gap */
                      <td key={`${dept.storeName}-${date}-gap`} className="px-3 py-3 border-r border-slate-100 text-center font-mono">
                        <span className={`inline-block px-2 py-0.5 rounded border ${gapBg} font-extrabold shadow-sm`}>
                          {gapSign}{formatNum(cumGap)}
                        </span>
                      </td>,
                      /* Scrap */
                      <td key={`${dept.storeName}-${date}-scp`} className="px-3 py-3 border-r border-slate-100 text-right text-red-600 font-bold font-mono bg-red-50/10">
                        {formatNum(item.scrapQty)}
                      </td>,
                      /* % Scrap */
                      <td key={`${dept.storeName}-${date}-scr`} className="px-3 py-3 border-r border-slate-300 text-right text-slate-500 font-medium font-mono">
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
