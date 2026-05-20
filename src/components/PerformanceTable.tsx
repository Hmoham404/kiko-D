import React from 'react';
import { ProductionData, SubComponentData } from '@/store/useStore';

interface PerformanceTableProps {
  data: ProductionData[];
  subComponentsData: SubComponentData[];
}

export const PerformanceTable: React.FC<PerformanceTableProps> = ({ data, subComponentsData }) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white border rounded-lg p-8 text-center text-gray-500 shadow-sm border-gray-100">
        Aucune donnée disponible pour la période sélectionnée.
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
    const progress = dept.target > 0 ? dept.actualProduction / dept.target : 0;
    const scrapRate = dept.actualProduction > 0 ? dept.scrapQty / dept.actualProduction : 0;
    const gap = dept.target - dept.actualProduction;
    
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
  const globalProgress = globalTarget > 0 ? globalActual / globalTarget : 0;
  const globalScrapRate = globalActual > 0 ? globalScrap / globalActual : 0;
  const globalGap = globalTarget - globalActual;

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
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Conforme</span>;
      case 'orange':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">Moyen</span>;
      case 'critical':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-600 text-white animate-pulse">Critique</span>;
      default:
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Alerte</span>;
    }
  };

  const formatNumber = (num: number) => new Intl.NumberFormat('fr-FR').format(num);
  const formatPercent = (num: number) => `${(num * 100).toFixed(2)}%`;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-500">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
            <tr>
              <th scope="col" className="px-6 py-3 font-bold">Department</th>
              <th scope="col" className="px-6 py-3 font-bold text-right">Target</th>
              <th scope="col" className="px-6 py-3 font-bold text-right">Actual Prod.</th>
              <th scope="col" className="px-6 py-3 font-bold text-right">Conform Qty</th>
              <th scope="col" className="px-6 py-3 font-bold text-right">Gap</th>
              <th scope="col" className="px-6 py-3 font-bold text-right">Progress %</th>
              <th scope="col" className="px-6 py-3 font-bold text-right">Scrap Qty</th>
              <th scope="col" className="px-6 py-3 font-bold text-right">Scrap %</th>
              <th scope="col" className="px-6 py-3 font-bold text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((row, index) => {
              const isGlobal = row.department === 'Global Performance';
              return (
                <tr 
                  key={index} 
                  className={`border-b hover:bg-gray-50 transition-colors ${isGlobal ? 'bg-red-50 font-bold text-gray-900 border-t-2 border-red-200' : 'bg-white'}`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    {row.department}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {formatNumber(row.target)}
                  </td>
                  <td className="px-6 py-4 text-right font-medium">
                    {formatNumber(row.actualProduction)}
                  </td>
                  <td className="px-6 py-4 text-right text-green-600">
                    {formatNumber(row.conformQty)}
                  </td>
                  <td className={`px-6 py-4 text-right ${row.gap > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {row.gap > 0 ? '+' : ''}{formatNumber(row.gap)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end">
                      <span className={`mr-2 ${row.progress < 0.8 ? 'text-red-600 font-bold' : row.progress >= 1 ? 'text-green-600 font-bold' : 'text-orange-500 font-bold'}`}>
                        {formatPercent(row.progress)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-red-600">
                    {formatNumber(row.scrapQty)}
                  </td>
                  <td className="px-6 py-4 text-right font-medium">
                    <span className={row.scrapRate > 0.05 ? 'text-red-600 animate-pulse' : 'text-gray-900'}>
                      {formatPercent(row.scrapRate)}
                    </span>
                  </td>
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
