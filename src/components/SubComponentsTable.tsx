import React from 'react';
import { SubComponentData } from '@/store/useStore';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface SubComponentsTableProps {
  data: SubComponentData[];
}

const COMPONENTS = ['Base', 'Cover', 'Insert'];

export const SubComponentsTable: React.FC<SubComponentsTableProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white border rounded-lg p-8 text-center text-gray-500 shadow-sm border-gray-100">
        Aucune donnée de détail disponible pour l'Injection. Importez le fichier Injection.xlsx pour voir les composants.
      </div>
    );
  }

  // Get unique sorted dates
  const uniqueDates = Array.from(new Set(data.map(d => d.date))).sort();

  const formatNum = (num: number) => new Intl.NumberFormat('fr-FR').format(num);
  const formatPct = (num: number) => `${(num * 100).toFixed(1)}%`;

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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
        <span className="text-sm font-semibold text-gray-700">Détails Injection (Base, Cover, Insert)</span>
        <span className="text-xs text-gray-500">* Comparaison par composant basée sur le target divisé.</span>
      </div>
      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="sticky top-0 z-20">
            <tr className="bg-red-600 text-white font-bold uppercase text-center">
              <th rowSpan={2} className="px-3 py-4 border-r border-red-700 sticky left-0 bg-red-600 z-30 min-w-[120px]">
                Jour / Date
              </th>
              {COMPONENTS.map(comp => (
                <th colSpan={7} key={comp} className="px-2 py-2 border-r border-red-700 text-center">
                  Injection {comp}
                </th>
              ))}
            </tr>
            <tr className="bg-red-50 text-red-900 font-semibold uppercase text-center border-b border-gray-300">
              {COMPONENTS.flatMap(comp => [
                <th key={`${comp}-tgt`} className="px-2 py-2 border-r border-gray-200 text-right min-w-[70px]">Target</th>,
                <th key={`${comp}-prd`} className="px-2 py-2 border-r border-gray-200 text-right min-w-[80px]">Total Prod</th>,
                <th key={`${comp}-cnf`} className="px-2 py-2 border-r border-gray-200 text-right min-w-[80px]">Conform Qty</th>,
                <th key={`${comp}-prg`} className="px-2 py-2 border-r border-gray-200 text-right min-w-[65px]">% progress</th>,
                <th key={`${comp}-gap`} className="px-2 py-2 border-r border-gray-200 text-right min-w-[70px]">Gap</th>,
                <th key={`${comp}-scp`} className="px-2 py-2 border-r border-gray-200 text-right min-w-[60px] text-red-600">Scrap</th>,
                <th key={`${comp}-scr`} className="px-2 py-2 border-r border-red-700 text-right min-w-[60px] text-red-600">%scrap</th>
              ])}
            </tr>
          </thead>
          <tbody>
            {uniqueDates.map((date) => {
              return (
                <tr key={date} className="border-b hover:bg-gray-50 transition-colors bg-white">
                  <td className="px-3 py-3 border-r font-bold text-gray-700 sticky left-0 bg-white z-10 text-center border-b shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] whitespace-nowrap">
                    {formatDateDisplay(date)} <span className="text-[10px] text-gray-400 font-normal">({getDayOfWeek(date)})</span>
                  </td>
                  {COMPONENTS.flatMap(comp => {
                    const item = data.find(d => d.date === date && d.component === comp);
                    
                    // Cumulative Gap = SUM(targets up to this date) - SUM(conform Qty up to this date)
                    const itemsUpToDate = data.filter(d => d.component === comp && d.date <= date);
                    const cumTarget = itemsUpToDate.reduce((sum, d) => sum + d.target, 0);
                    const cumConform = itemsUpToDate.reduce((sum, d) => sum + d.conformQty, 0);
                    const cumGap = cumTarget - cumConform;

                    if (!item) {
                      return [
                        <td key={`${comp}-${date}-tgt`} className="px-2 py-3 border-r border-gray-150 text-right text-gray-300">-</td>,
                        <td key={`${comp}-${date}-prd`} className="px-2 py-3 border-r border-gray-150 text-right text-gray-300">-</td>,
                        <td key={`${comp}-${date}-cnf`} className="px-2 py-3 border-r border-gray-150 text-right text-gray-300">-</td>,
                        <td key={`${comp}-${date}-prg`} className="px-2 py-3 border-r border-gray-150 text-right text-gray-300">-</td>,
                        <td key={`${comp}-${date}-gap`} className="px-2 py-3 border-r border-gray-150 text-right text-gray-300">-</td>,
                        <td key={`${comp}-${date}-scp`} className="px-2 py-3 border-r border-gray-150 text-right text-gray-300">-</td>,
                        <td key={`${comp}-${date}-scr`} className="px-2 py-3 border-r border-red-200 text-right text-gray-300">-</td>
                      ];
                    }

                    const progressColor = item.progress < 0.8 ? 'text-red-600 font-medium' : item.progress >= 1 ? 'text-green-600 font-medium' : 'text-orange-500 font-medium';
                    const scrapColor = item.scrapRate > 0.05 ? 'text-red-600 font-medium animate-pulse' : 'text-gray-700';

                    return [
                      <td key={`${comp}-${date}-tgt`} className="px-2 py-3 border-r border-gray-150 text-right text-gray-700">{formatNum(item.target)}</td>,
                      <td key={`${comp}-${date}-prd`} className="px-2 py-3 border-r border-gray-150 text-right font-medium text-gray-900">{formatNum(item.actualProduction)}</td>,
                      <td key={`${comp}-${date}-cnf`} className="px-2 py-3 border-r border-gray-150 text-right text-green-600 font-medium">{formatNum(item.conformQty)}</td>,
                      <td key={`${comp}-${date}-prg`} className={`px-2 py-3 border-r border-gray-150 text-right ${progressColor}`}>{formatPct(item.progress)}</td>,
                      <td key={`${comp}-${date}-gap`} className={`px-2 py-3 border-r border-gray-150 text-right font-medium ${cumGap > 0 ? 'text-red-500' : 'text-green-600'}`}>{cumGap > 0 ? '+' : ''}{formatNum(cumGap)}</td>,
                      <td key={`${comp}-${date}-scp`} className="px-2 py-3 border-r border-gray-150 text-right text-red-600">{formatNum(item.scrapQty)}</td>,
                      <td key={`${comp}-${date}-scr`} className={`px-2 py-3 border-r border-red-200 text-right ${scrapColor}`}>{formatPct(item.scrapRate)}</td>
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
