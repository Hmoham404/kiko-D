import React from 'react';
import { ProductionData, SubComponentData } from '@/store/useStore';

interface PerformanceTableProps {
  data: ProductionData[];
  subComponentsData: SubComponentData[];
}

export const PerformanceTable: React.FC<PerformanceTableProps> = ({ data, subComponentsData }) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white/80 backdrop-blur-md border border-slate-100 rounded-2xl p-12 text-center text-slate-500 shadow-xl max-w-lg mx-auto">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H3a2 2 0 002-2V5a2 2 0 00-2-2h9l2 2h6a2 2 0 012 2v12a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">Aucune donnée disponible</h3>
        <p className="text-sm text-slate-400">Veuillez importer des données de production.</p>
      </div>
    );
  }

  // Aggregate data by department
  // Filter out the aggregated Injection department from the main data 
  // since we will display its 3 components instead.
  const filteredData = data.filter(d => d.department !== 'Injection');

  const aggregatedData = filteredData.reduce((acc, curr) => {
    if (!acc[curr.department]) {
      acc[curr.department] = {
        department: curr.department,
        target: 0,
        actualProduction: 0,
        conformQty: 0,
        scrapQty: 0,
      };
    }
    acc[curr.department].target += curr.target;
    acc[curr.department].actualProduction += curr.actualProduction;
    acc[curr.department].conformQty += curr.conformQty;
    acc[curr.department].scrapQty += curr.scrapQty;
    return acc;
  }, {} as Record<string, any>);

  // Add sub-components of Injection
  if (subComponentsData && subComponentsData.length > 0) {
    const subAggregated = subComponentsData.reduce((acc, curr) => {
      // Standardize sheet component names to Base, Cover, Insert
      const compName = curr.component.charAt(0).toUpperCase() + curr.component.slice(1).toLowerCase().trim();
      const displayName = `Injection (${compName})`;
      if (!acc[displayName]) {
        acc[displayName] = {
          department: displayName,
          target: 0,
          actualProduction: 0,
          conformQty: 0,
          scrapQty: 0,
        };
      }
      acc[displayName].target += curr.target;
      acc[displayName].actualProduction += curr.actualProduction;
      acc[displayName].conformQty += curr.conformQty;
      acc[displayName].scrapQty += curr.scrapQty;
      return acc;
    }, {} as Record<string, any>);

    Object.assign(aggregatedData, subAggregated);
  } else {
    // Fallback: if no subComponentsData is loaded, keep the aggregated Injection department!
    const injectionData = data.filter(d => d.department === 'Injection');
    if (injectionData.length > 0) {
      const injAgg = injectionData.reduce((acc, curr) => {
        if (!acc['Injection']) {
          acc['Injection'] = {
            department: 'Injection',
            target: 0,
            actualProduction: 0,
            conformQty: 0,
            scrapQty: 0,
          };
        }
        acc['Injection'].target += curr.target;
        acc['Injection'].actualProduction += curr.actualProduction;
        acc['Injection'].conformQty += curr.conformQty;
        acc['Injection'].scrapQty += curr.scrapQty;
        return acc;
      }, {} as Record<string, any>);
      Object.assign(aggregatedData, injAgg);
    }
  }

  const deptOrder = [
    'Injection (Base)',
    'Injection (Cover)',
    'Injection (Insert)',
    'Injection', // fallback
    'Soudure',
    'Metallisation',
    'US serigraphie',
    'Assemblage',
    'Packaging'
  ];

  let tableData = Object.values(aggregatedData).map((dept: any) => {
    // Corrected to Conform Qty / Target for consistency
    const progress = dept.target > 0 ? dept.conformQty / dept.target : 0;
    const scrapRate = dept.actualProduction > 0 ? dept.scrapQty / dept.actualProduction : 0;
    const gap = dept.target - dept.conformQty; // Target vs Conform Qty gap as requested
    
    let status = 'red';
    if (scrapRate > 0.05) status = 'critical';
    else if (progress >= 1 && scrapRate <= 0.02) status = 'green';
    else if (progress >= 0.8 && progress < 1) status = 'orange';

    return { ...dept, progress, scrapRate, gap, status };
  });

  // Sort according to deptOrder
  tableData.sort((a, b) => {
    const idxA = deptOrder.indexOf(a.department);
    const idxB = deptOrder.indexOf(b.department);
    return (idxA > -1 ? idxA : 99) - (idxB > -1 ? idxB : 99);
  });

  // Calculate Global Performance
  const globalTarget = tableData.reduce((sum, d) => sum + d.target, 0);
  const globalActual = tableData.reduce((sum, d) => sum + d.actualProduction, 0);
  const globalConform = tableData.reduce((sum, d) => sum + d.conformQty, 0);
  const globalScrap = tableData.reduce((sum, d) => sum + d.scrapQty, 0);
  
  // Corrected to Conform Qty / Target globally
  const globalProgress = globalTarget > 0 ? globalConform / globalTarget : 0;
  const globalScrapRate = globalActual > 0 ? globalScrap / globalActual : 0;
  const globalGap = globalTarget - globalConform;

  let globalStatus = 'red';
  if (globalScrapRate > 0.05) globalStatus = 'critical';
  else if (globalProgress >= 1 && globalScrapRate <= 0.02) globalStatus = 'green';
  else if (globalProgress >= 0.8 && globalProgress < 1) globalStatus = 'orange';

  tableData.push({
    department: 'Global Performance',
    target: globalTarget,
    actualProduction: globalActual,
    conformQty: globalConform,
    scrapQty: globalScrap,
    progress: globalProgress,
    scrapRate: globalScrapRate,
    gap: globalGap,
    status: globalStatus
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'green':
        return (
          <span className="inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse"></span>
            Conforme
          </span>
        );
      case 'orange':
        return (
          <span className="inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mr-1.5 animate-pulse"></span>
            Moyen
          </span>
        );
      case 'critical':
        return (
          <span className="inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-full bg-red-600 text-white animate-pulse shadow-sm shadow-red-300">
            <span className="w-1.5 h-1.5 bg-white rounded-full mr-1.5 animate-ping"></span>
            Critique
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-full bg-rose-100 text-rose-800 border border-rose-200">
            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full mr-1.5 animate-pulse"></span>
            Alerte
          </span>
        );
    }
  };

  const formatNumber = (num: number) => new Intl.NumberFormat('fr-FR').format(num);
  const formatPercent = (num: number) => `${(num * 100).toFixed(1)}%`;

  return (
    <div className="bg-white/90 backdrop-blur-lg rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden transition-all duration-300 hover:shadow-2xl">
      {/* Premium Header */}
      <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-850 text-white">
        <div className="flex items-center space-x-3">
          <div className="w-3 h-7 bg-red-500 rounded-full animate-pulse"></div>
          <div>
            <span className="text-sm font-extrabold tracking-widest uppercase bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              Synthèse Performance par Département
            </span>
            <p className="text-[10px] text-slate-400 font-semibold tracking-wide uppercase mt-0.5">Vue globale consolidée</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white font-bold uppercase text-center border-b border-slate-800">
              <th className="px-6 py-4 text-left font-black tracking-wider text-[10px] text-slate-300">DEPARTMENT</th>
              <th className="px-6 py-4 text-right font-black tracking-wider text-[10px] text-slate-300">TARGET</th>
              <th className="px-6 py-4 text-right font-black tracking-wider text-[10px] text-slate-300">ACTUAL PROD.</th>
              <th className="px-6 py-4 text-right font-black tracking-wider text-[10px] text-emerald-300">CONFORM QTY</th>
              <th className="px-6 py-4 text-right font-black tracking-wider text-[10px] text-slate-300">GAP</th>
              <th className="px-6 py-4 text-center font-black tracking-wider text-[10px] text-slate-300">PROGRESS %</th>
              <th className="px-6 py-4 text-right font-black tracking-wider text-[10px] text-red-300">SCRAP QTY</th>
              <th className="px-6 py-4 text-right font-black tracking-wider text-[10px] text-red-300">SCRAP %</th>
              <th className="px-6 py-4 text-center font-black tracking-wider text-[10px] text-slate-300">STATUS</th>
            </tr>
          </thead>
          
          <tbody className="divide-y divide-slate-100">
            {tableData.map((row, index) => {
              const isGlobal = row.department === 'Global Performance';
              
              let progressBg = 'bg-red-50 text-red-700 border-red-200';
              let progressBarColor = 'bg-red-500';
              if (row.progress >= 1.0) {
                progressBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                progressBarColor = 'bg-emerald-500';
              } else if (row.progress >= 0.8) {
                progressBg = 'bg-amber-50 text-amber-700 border-amber-200';
                progressBarColor = 'bg-amber-500';
              }

              let gapBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
              let gapSign = '';
              if (row.gap > 0) {
                gapBg = 'bg-red-50 text-red-700 border-red-200';
                gapSign = '+';
              }

              return (
                <tr 
                  key={index} 
                  className={`transition-colors duration-150 ${
                    isGlobal 
                      ? 'bg-gradient-to-r from-slate-900 to-indigo-950 font-black text-white border-t-2 border-indigo-500 hover:from-slate-950 hover:to-indigo-900' 
                      : index % 2 === 0 
                        ? 'bg-white hover:bg-slate-50/80' 
                        : 'bg-slate-50/40 hover:bg-slate-50/85'
                  }`}
                >
                  {/* Department */}
                  <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-900">
                    <span className={isGlobal ? 'text-white tracking-wider font-extrabold text-sm' : 'text-slate-800'}>
                      {row.department}
                    </span>
                  </td>
                  
                  {/* Target */}
                  <td className={`px-6 py-4 text-right font-semibold font-mono ${isGlobal ? 'text-slate-200' : 'text-slate-600'}`}>
                    {formatNumber(row.target)}
                  </td>
                  
                  {/* Actual Prod */}
                  <td className={`px-6 py-4 text-right font-bold font-mono ${isGlobal ? 'text-white' : 'text-slate-800'}`}>
                    {formatNumber(row.actualProduction)}
                  </td>
                  
                  {/* Conform Qty */}
                  <td className={`px-6 py-4 text-right font-extrabold font-mono bg-emerald-50/10 ${isGlobal ? 'text-emerald-400' : 'text-emerald-600'}`}>
                    {formatNumber(row.conformQty)}
                  </td>
                  
                  {/* Gap */}
                  <td className="px-6 py-4 text-right font-mono">
                    <span className={`inline-block px-2 py-0.5 rounded border font-bold ${isGlobal ? 'bg-white/10 border-white/20 text-white' : gapBg}`}>
                      {gapSign}{formatNumber(row.gap)}
                    </span>
                  </td>
                  
                  {/* Progress % */}
                  <td className="px-6 py-4 font-mono">
                    <div className="flex flex-col items-center max-w-[120px] mx-auto">
                      <span className={`inline-flex px-2 py-0.5 rounded border text-[11px] font-extrabold shadow-sm ${isGlobal ? 'bg-white/15 border-white/25 text-white' : progressBg}`}>
                        {formatPercent(row.progress)}
                      </span>
                      <div className="w-full bg-slate-200/50 h-1.5 rounded-full mt-1.5 overflow-hidden">
                        <div className={`${isGlobal ? 'bg-indigo-400' : progressBarColor} h-full rounded-full`} style={{ width: `${Math.min(row.progress * 100, 100)}%` }}></div>
                      </div>
                    </div>
                  </td>
                  
                  {/* Scrap Qty */}
                  <td className={`px-6 py-4 text-right font-bold font-mono bg-red-50/5 ${isGlobal ? 'text-red-400' : 'text-red-600'}`}>
                    {formatNumber(row.scrapQty)}
                  </td>
                  
                  {/* Scrap % */}
                  <td className={`px-6 py-4 text-right font-semibold font-mono ${isGlobal ? 'text-slate-200' : 'text-slate-700'}`}>
                    <span className={row.scrapRate > 0.05 && !isGlobal ? 'text-red-600 font-extrabold animate-pulse' : ''}>
                      {formatPercent(row.scrapRate)}
                    </span>
                  </td>
                  
                  {/* Status */}
                  <td className="px-6 py-4 text-center">
                    {getStatusBadge(row.status)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
