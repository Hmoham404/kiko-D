'use client';
import React, { useState, useMemo } from 'react';
import { SubComponentData, useStore } from '@/store/useStore';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight, Target, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { buildWeeklyTargetOverrideKey, getWeeklyCumulativeMetrics, sumWeeklyTargets } from '@/lib/weeklyMetrics';

interface InjectionDayViewProps {
  data: SubComponentData[];
}

const COMPONENT_THEMES: Record<string, { gradient: string; border: string; iconBg: string; label: string; accentText: string }> = {
  Base: {
    gradient: 'from-blue-600 via-blue-700 to-indigo-800',
    border: 'border-blue-500',
    iconBg: 'bg-blue-100 text-blue-700',
    label: 'INJECTION - BASE',
    accentText: 'text-blue-600',
  },
  Cover: {
    gradient: 'from-emerald-600 via-emerald-700 to-green-800',
    border: 'border-emerald-500',
    iconBg: 'bg-emerald-100 text-emerald-700',
    label: 'INJECTION - COVER',
    accentText: 'text-emerald-600',
  },
  Insert: {
    gradient: 'from-purple-600 via-purple-700 to-fuchsia-800',
    border: 'border-purple-500',
    iconBg: 'bg-purple-100 text-purple-700',
    label: 'INJECTION - INSERT',
    accentText: 'text-purple-600',
  },
};

export const InjectionDayView: React.FC<InjectionDayViewProps> = ({ data }) => {
  const weeklyTargets = useStore((state) => state.weeklyTargets);
  const availableDates = useMemo(() => Array.from(new Set(data.map((item) => item.date))).sort(), [data]);
  const [selectedDate, setSelectedDate] = useState<string>(availableDates.length > 0 ? availableDates[availableDates.length - 1] : '');

  const currentIndex = availableDates.indexOf(selectedDate);
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < availableDates.length - 1;

  const goPrev = () => {
    if (canGoPrev) setSelectedDate(availableDates[currentIndex - 1]);
  };

  const goNext = () => {
    if (canGoNext) setSelectedDate(availableDates[currentIndex + 1]);
  };

  const dayData = useMemo(() => (selectedDate ? data.filter((item) => item.date === selectedDate) : []), [data, selectedDate]);
  const formatNum = (num: number) => new Intl.NumberFormat('fr-FR').format(num);
  const formatPct = (num: number) => `${(num * 100).toFixed(1)}%`;

  const formatDateDisplay = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'EEEE dd MMMM yyyy', { locale: fr });
    } catch {
      return dateStr;
    }
  };

  const formatDateShort = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'dd/MM/yyyy');
    } catch {
      return dateStr;
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (availableDates.includes(value)) {
      setSelectedDate(value);
      return;
    }

    const nearest = availableDates.reduce((prev, curr) =>
      Math.abs(new Date(curr).getTime() - new Date(value).getTime()) < Math.abs(new Date(prev).getTime() - new Date(value).getTime()) ? curr : prev
    );
    setSelectedDate(nearest);
  };

  const globalSummary = useMemo(() => {
    return ['Base', 'Cover', 'Insert'].map((component) => {
      const items = data.filter((item) => item.component === component);
      const target = sumWeeklyTargets(
        items,
        () => component,
        (item) => weeklyTargets[buildWeeklyTargetOverrideKey('component', item.component, item.weekKey)] ?? item.weeklyTarget
      );
      const actual = items.reduce((sum, item) => sum + item.actualProduction, 0);
      const conform = items.reduce((sum, item) => sum + item.conformQty, 0);
      const scrap = items.reduce((sum, item) => sum + item.scrapQty, 0);
      const progress = target > 0 ? conform / target : 0;
      const scrapRate = actual > 0 ? scrap / actual : 0;
      return { comp: component, target, actual, conform, scrap, progress, scrapRate };
    });
  }, [data, weeklyTargets]);

  const getStatusIcon = (progress: number) => {
    if (progress >= 1) return <CheckCircle className="w-5 h-5 text-emerald-500" />;
    if (progress >= 0.8) return <AlertTriangle className="w-5 h-5 text-amber-500" />;
    return <XCircle className="w-5 h-5 text-red-500" />;
  };

  const getProgressBarColor = (progress: number) => {
    if (progress >= 1) return 'bg-emerald-500';
    if (progress >= 0.8) return 'bg-amber-500';
    return 'bg-red-500';
  };

  if (!data || data.length === 0) {
    return (
      <div className="bg-white/80 backdrop-blur-md border border-slate-100 rounded-2xl p-12 text-center text-slate-500 shadow-xl max-w-lg mx-auto">
        <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <CalendarDays className="w-8 h-8 text-purple-400" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">Aucune donnee Injection</h3>
        <p className="text-sm text-slate-400">Importez le fichier Injection.xlsx pour voir les sous-composants par jour.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white/90 backdrop-blur-lg rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
        <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-7 bg-purple-500 rounded-full animate-pulse"></div>
              <div>
                <span className="text-sm font-extrabold tracking-widest uppercase bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                  Vue Injection par Jour
                </span>
                <p className="text-[10px] text-slate-400 font-semibold tracking-wide uppercase mt-0.5">Suivi cumule de la semaine</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button onClick={goPrev} disabled={!canGoPrev} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 border border-white/10">
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="relative flex items-center">
                <CalendarDays className="w-4 h-4 text-purple-300 absolute left-3 pointer-events-none" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={handleDateChange}
                  min={availableDates[0]}
                  max={availableDates[availableDates.length - 1]}
                  className="pl-9 pr-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-purple-400 transition-all duration-200 cursor-pointer hover:bg-white/15 [color-scheme:dark]"
                />
              </div>

              <button onClick={goNext} disabled={!canGoNext} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 border border-white/10">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CalendarDays className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-bold text-purple-900 capitalize">{formatDateDisplay(selectedDate)}</span>
          </div>
          <span className="text-xs text-purple-500 font-semibold bg-purple-100 px-3 py-1 rounded-full border border-purple-200">
            Jour {currentIndex + 1} / {availableDates.length}
          </span>
        </div>

        <div className="px-5 py-3 bg-white/80 border-b border-slate-100 overflow-x-auto scrollbar-thin">
          <div className="flex space-x-2 min-w-max">
            {availableDates.map((date) => (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 whitespace-nowrap border ${
                  date === selectedDate ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-200' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700'
                }`}
              >
                {formatDateShort(date)}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5">
          {dayData.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-7 h-7 text-slate-400" />
              </div>
              <p className="text-slate-500 font-semibold text-sm">Aucune donnee pour cette date</p>
              <p className="text-slate-400 text-xs mt-1">Essayez une autre date avec le calendrier ci-dessus</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {['Base', 'Cover', 'Insert'].map((component) => {
                const item = dayData.find((entry) => entry.component === component);
                const theme = COMPONENT_THEMES[component];

                if (!item) {
                  return (
                    <div key={component} className="rounded-xl border-2 border-dashed border-slate-200 p-6 text-center bg-slate-50/50">
                      <p className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-1">{theme.label}</p>
                      <p className="text-slate-300 text-sm">Pas de donnees</p>
                    </div>
                  );
                }

                const metrics = getWeeklyCumulativeMetrics(
                  data.filter((entry) => entry.component === component),
                  selectedDate,
                  (entry) => weeklyTargets[buildWeeklyTargetOverrideKey('component', entry.component, entry.weekKey)] ?? entry.weeklyTarget
                );

                return (
                  <div key={component} className={`rounded-2xl border-l-4 ${theme.border} bg-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden`}>
                    <div className={`px-5 py-3 bg-gradient-to-r ${theme.gradient} text-white`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black tracking-widest uppercase drop-shadow-md">{theme.label}</span>
                        {getStatusIcon(metrics.progress)}
                      </div>
                    </div>

                    <div className="p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Progress</p>
                          <p className={`text-3xl font-black ${theme.accentText} font-mono tracking-tight`}>{formatPct(metrics.progress)}</p>
                        </div>
                        <div className={`w-14 h-14 rounded-xl ${theme.iconBg} flex items-center justify-center`}>
                          <Target className="w-7 h-7" />
                        </div>
                      </div>

                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div className={`${getProgressBarColor(metrics.progress)} h-full rounded-full transition-all duration-500`} style={{ width: `${Math.min(metrics.progress * 100, 100)}%` }}></div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Obj. semaine</p>
                          <p className="text-lg font-black text-slate-800 font-mono">{formatNum(metrics.weeklyTarget)}</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Prod cumulee</p>
                          <p className="text-lg font-black text-slate-800 font-mono">{formatNum(metrics.actualProduction)}</p>
                        </div>
                        <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                          <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-wider">Conform cumule</p>
                          <p className="text-lg font-black text-emerald-700 font-mono">{formatNum(metrics.conformQty)}</p>
                        </div>
                        <div className={`rounded-lg p-3 border ${metrics.scrapRate > 0.05 ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                          <p className={`text-[9px] font-bold uppercase tracking-wider ${metrics.scrapRate > 0.05 ? 'text-red-500' : 'text-slate-400'}`}>Scrap cumule</p>
                          <p className={`text-lg font-black font-mono ${metrics.scrapRate > 0.05 ? 'text-red-600' : 'text-slate-800'}`}>{formatNum(metrics.scrapQty)}</p>
                          <p className={`text-[10px] font-bold ${metrics.scrapRate > 0.05 ? 'text-red-500' : 'text-slate-400'}`}>{formatPct(metrics.scrapRate)}</p>
                        </div>
                      </div>

                      <div className={`rounded-lg p-3 border ${metrics.gap > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={`text-[9px] font-bold uppercase tracking-wider ${metrics.gap > 0 ? 'text-red-500' : 'text-emerald-500'}`}>Gap cumule</p>
                            <p className={`text-xl font-black font-mono ${metrics.gap > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{metrics.gap > 0 ? '+' : ''}{formatNum(metrics.gap)}</p>
                          </div>
                          <div className={`text-xs font-bold px-2 py-1 rounded-full ${metrics.gap > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {formatNum(metrics.conformQty)} / {formatNum(metrics.weeklyTarget)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white/90 backdrop-blur-lg rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
        <div className="px-5 py-4 bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-900 text-white flex items-center space-x-3">
          <div className="w-2 h-5 bg-purple-400 rounded-full"></div>
          <span className="text-xs font-extrabold tracking-widest uppercase bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
            Resume Global Injection - Toutes Dates
          </span>
        </div>
        <div className="p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white font-bold uppercase text-center">
                  <th className="px-5 py-3 text-left font-black tracking-wider text-[10px] rounded-l-lg">Composant</th>
                  <th className="px-4 py-3 text-right font-black tracking-wider text-[10px]">Obj. semaine</th>
                  <th className="px-4 py-3 text-right font-black tracking-wider text-[10px]">Actual Prod</th>
                  <th className="px-4 py-3 text-right font-black tracking-wider text-[10px] text-emerald-300">Conform Qty</th>
                  <th className="px-4 py-3 text-center font-black tracking-wider text-[10px]">Progress %</th>
                  <th className="px-4 py-3 text-right font-black tracking-wider text-[10px] text-red-300">Scrap</th>
                  <th className="px-4 py-3 text-right font-black tracking-wider text-[10px] text-red-300 rounded-r-lg">Scrap %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {globalSummary.map((row, index) => {
                  const theme = COMPONENT_THEMES[row.comp];
                  let progressBg = 'bg-red-50 text-red-700 border-red-200';
                  let barColor = 'bg-red-500';

                  if (row.progress >= 1) {
                    progressBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                    barColor = 'bg-emerald-500';
                  } else if (row.progress >= 0.8) {
                    progressBg = 'bg-amber-50 text-amber-700 border-amber-200';
                    barColor = 'bg-amber-500';
                  }

                  return (
                    <tr key={row.comp} className={`transition-colors duration-150 ${index % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/40 hover:bg-slate-50'}`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center space-x-2">
                          <div className={`w-2 h-5 rounded-full bg-gradient-to-b ${theme.gradient}`}></div>
                          <span className="font-bold text-slate-800">{theme.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold text-slate-600 font-mono">{formatNum(row.target)}</td>
                      <td className="px-4 py-3.5 text-right font-bold text-slate-800 font-mono">{formatNum(row.actual)}</td>
                      <td className="px-4 py-3.5 text-right font-extrabold text-emerald-600 font-mono">{formatNum(row.conform)}</td>
                      <td className="px-4 py-3.5 text-center font-mono">
                        <div className="flex flex-col items-center max-w-[110px] mx-auto">
                          <span className={`inline-flex px-2 py-0.5 rounded border text-[11px] font-extrabold shadow-sm ${progressBg}`}>{formatPct(row.progress)}</span>
                          <div className="w-full bg-slate-200/50 h-1.5 rounded-full mt-1.5 overflow-hidden">
                            <div className={`${barColor} h-full rounded-full`} style={{ width: `${Math.min(row.progress * 100, 100)}%` }}></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-red-600 font-mono">{formatNum(row.scrap)}</td>
                      <td className="px-4 py-3.5 text-right font-semibold text-slate-700 font-mono">
                        <span className={row.scrapRate > 0.05 ? 'text-red-600 font-extrabold animate-pulse' : ''}>{formatPct(row.scrapRate)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
