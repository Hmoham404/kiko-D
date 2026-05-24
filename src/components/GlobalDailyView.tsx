'use client';
import React, { useState, useMemo } from 'react';
import { ProductionData, SubComponentData } from '@/store/useStore';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight, Target, CheckCircle, AlertTriangle, Activity, Award } from 'lucide-react';

interface GlobalDailyViewProps {
  data: ProductionData[];
  subComponentsData: SubComponentData[];
}

const DEPARTMENTS = [
  { storeName: 'Injection', displayName: 'INJECTION', color: 'blue' },
  { storeName: 'Soudure', displayName: 'US WELDING', color: 'teal' },
  { storeName: 'Metallisation', displayName: 'METALLISATION', color: 'indigo' },
  { storeName: 'US serigraphie', displayName: 'PRINTING', color: 'violet' },
  { storeName: 'Assemblage', displayName: 'ASSEMBLAGE', color: 'fuchsia' },
  { storeName: 'Packaging', displayName: 'PACKAGING', color: 'emerald' }
];

const FACTORY_GROUPS = [
  {
    key: 'ASSEMBLAGE',
    title: 'FACTORY GLOBAL PERFORMANCE',
    subtitle: 'Assemblage only',
    departments: ['Assemblage'],
  },
  {
    key: 'SFG',
    title: 'FACTORY GLOBAL PERFORMANCE SFG',
    subtitle: 'Injection + Welding + Printing + Metallisation',
    departments: ['Injection', 'Soudure', 'US serigraphie', 'Metallisation'],
  },
];

export const GlobalDailyView: React.FC<GlobalDailyViewProps> = ({ data, subComponentsData }) => {
  const [groupFilter, setGroupFilter] = useState<'all' | 'ASSEMBLAGE' | 'SFG'>('ASSEMBLAGE');

  const availableDates = useMemo(() => {
    const dates = new Set([...data.map(d => d.date), ...subComponentsData.map(s => s.date)]);
    return Array.from(dates).sort();
  }, [data, subComponentsData]);

  const [selectedDate, setSelectedDate] = useState<string>(
    availableDates.length > 0 ? availableDates[availableDates.length - 1] : ''
  );

  const currentIndex = availableDates.indexOf(selectedDate);
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < availableDates.length - 1;

  const getDayData = (deptName: string) => {
    let item = data.find(d => d.date === selectedDate && d.department === deptName);
    
    // Fallback for Injection
    if (!item && deptName === 'Injection') {
      const subs = subComponentsData.filter(s => s.date === selectedDate);
      if (subs.length > 0) {
        const target = subs.reduce((sum, s) => sum + s.target, 0);
        const conform = subs.reduce((sum, s) => sum + s.conformQty, 0);
        const progress = target > 0 ? conform / target : 0;

        item = {
          department: 'Injection',
          date: selectedDate,
          target: target,
          actualProduction: subs.reduce((sum, s) => sum + s.actualProduction, 0),
          conformQty: conform,
          scrapQty: subs.reduce((sum, s) => sum + s.scrapQty, 0),
          progress: progress,
          gap: target - conform,
          scrapRate: 0,
          status: progress < 0.8 ? 'critical' : progress < 1 ? 'orange' : 'green',
          week: ''
        } as ProductionData;
        item.scrapRate = item.actualProduction > 0 ? item.scrapQty / item.actualProduction : 0;
      }
    }
    return item;
  };

  const getFactoryGroupData = (group: typeof FACTORY_GROUPS[number]) => {
    const groupData = group.departments.map(deptName => getDayData(deptName)).filter(Boolean) as ProductionData[];
    if (groupData.length === 0) return null;

    const totalTarget = groupData.reduce((sum, d) => sum + d.target, 0);
    const totalActual = groupData.reduce((sum, d) => sum + d.actualProduction, 0);
    const totalConform = groupData.reduce((sum, d) => sum + d.conformQty, 0);
    const totalScrap = groupData.reduce((sum, d) => sum + d.scrapQty, 0);
    const progress = totalTarget > 0 ? totalConform / totalTarget : 0;

    return {
      department: group.key,
      date: selectedDate,
      target: totalTarget,
      actualProduction: totalActual,
      conformQty: totalConform,
      scrapQty: totalScrap,
      progress,
      gap: totalTarget - totalConform,
      scrapRate: totalActual > 0 ? totalScrap / totalActual : 0,
      status: progress < 0.8 ? 'critical' : progress < 1 ? 'orange' : 'green',
      week: '',
    } as ProductionData;
  };

  const formatNum = (num: number) => new Intl.NumberFormat('fr-FR').format(num);
  const visibleFactoryGroups = FACTORY_GROUPS.filter(group => groupFilter === 'all' || group.key === groupFilter);

  if (availableDates.length === 0) return null;

  return (
    <div className="space-y-6">
      {/* Date Selector Navigation */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <button 
          onClick={() => canGoPrev && setSelectedDate(availableDates[currentIndex - 1])}
          disabled={!canGoPrev}
          className={`p-2 rounded-full transition-all ${canGoPrev ? 'hover:bg-slate-100 text-slate-700' : 'text-slate-200 cursor-not-allowed'}`}
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <div className="flex flex-col items-center">
          <div className="flex items-center space-x-4 bg-slate-50 px-6 py-3 rounded-2xl border border-slate-200 shadow-inner group transition-all hover:border-red-300 relative">
            <CalendarDays className="w-8 h-8 text-red-600 group-hover:scale-110 transition-transform pointer-events-none" />
            <div className="flex flex-col cursor-pointer" onClick={() => (document.getElementById('date-picker-hidden') as HTMLInputElement)?.showPicker()}>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">Date de production</span>
              <span className="text-2xl font-black text-slate-800 tracking-tight pb-1 px-1 border-b-4 border-red-500/20 group-hover:border-red-500 transition-colors">
                {selectedDate ? format(parseISO(selectedDate), 'EEEE dd MMMM yyyy', { locale: fr }).toUpperCase() : 'CHOISIR UNE DATE'}
              </span>
            </div>
            <input 
              id="date-picker-hidden"
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="absolute opacity-0 w-0 h-0 pointer-events-none"
            />
          </div>
          <div className="flex space-x-2 mt-4">
            {availableDates.slice(-10).map(date => (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={`h-3 rounded-full transition-all ${date === selectedDate ? 'bg-red-600 w-10 shadow-lg shadow-red-200' : 'bg-slate-200 w-3 hover:bg-slate-300'}`}
              />
            ))}
          </div>
        </div>

        <button 
          onClick={() => canGoNext && setSelectedDate(availableDates[currentIndex + 1])}
          disabled={!canGoNext}
          className={`p-2 rounded-full transition-all ${canGoNext ? 'hover:bg-slate-100 text-slate-700' : 'text-slate-200 cursor-not-allowed'}`}
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Factory Performance Cards */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Factory View</p>
            <p className="text-sm font-semibold text-slate-700">Filtrer la performance globale</p>
          </div>
          <div className="inline-flex rounded-xl border border-slate-200 p-1 bg-slate-50">
            <button
              onClick={() => setGroupFilter('ASSEMBLAGE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors ${
                groupFilter === 'ASSEMBLAGE' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white'
              }`}
            >
              Assemblage Only
            </button>
            <button
              onClick={() => setGroupFilter('SFG')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors ${
                groupFilter === 'SFG' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white'
              }`}
            >
              SFG
            </button>
            <button
              onClick={() => setGroupFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors ${
                groupFilter === 'all' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white'
              }`}
            >
              Tous
            </button>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.18em] mb-2">Légende Statut</p>
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-700">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
              Excellent (≥ 100%)
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
              À surveiller (80% - 99.9%)
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500"></span>
              Critique (&lt; 80%)
            </span>
          </div>
        </div>

        <div className={`grid grid-cols-1 gap-6 ${visibleFactoryGroups.length > 1 ? 'xl:grid-cols-2' : ''}`}>
        {visibleFactoryGroups.map(group => {
          const item = getFactoryGroupData(group);
          if (!item) return null;

          const progress = item.progress * 100;
          const isCritical = progress < 80;
          const isSuccess = progress >= 100;
          
          return (
            <div key={group.key} className={`rounded-3xl shadow-2xl border overflow-hidden hover:scale-[1.01] transition-all duration-300 group ${
              isCritical ? 'bg-red-50/50 border-red-200' : 
              isSuccess ? 'bg-emerald-50/50 border-emerald-200' : 
              'bg-slate-900 border-slate-800'
            }`}>
              <div className={`p-6 text-white relative overflow-hidden ${
                isCritical ? 'bg-gradient-to-r from-red-600 to-red-900' :
                isSuccess ? 'bg-gradient-to-r from-emerald-600 to-emerald-900' :
                'bg-gradient-to-r from-slate-800 to-slate-950'
              }`}>
                <div className="relative z-10 flex justify-between items-center">
                  <div>
                    <h3 className="text-2xl font-black tracking-widest uppercase italic">{group.title}</h3>
                    <p className={`text-xs font-bold opacity-80 uppercase tracking-tighter mt-1 ${
                      isCritical ? 'text-red-100' : 'text-slate-300'
                    }`}>{group.subtitle}</p>
                  </div>
                  <Award className="w-10 h-10 text-white animate-bounce-slow" />
                </div>
                <div className="absolute -right-10 -bottom-10 bg-white/10 w-40 h-40 rounded-full blur-3xl"></div>
              </div>
              
              <div className={`p-8 grid grid-cols-1 md:grid-cols-4 gap-8 items-center backdrop-blur-xl ${
                isCritical ? 'bg-red-50/20' : isSuccess ? 'bg-emerald-50/20' : 'bg-slate-900/50'
              }`}>
                {/* Main Progress Circle/Stat */}
                <div className={`flex flex-col items-center justify-center p-6 rounded-2xl border ${
                  isCritical ? 'bg-white border-red-200 shadow-sm' :
                  isSuccess ? 'bg-white border-emerald-200 shadow-sm' :
                  'bg-white/5 border-white/10'
                }`}>
                  <span className={`text-5xl font-black mb-1 ${
                    isCritical ? 'text-red-600' : 
                    isSuccess ? 'text-emerald-600' : 
                    'text-amber-400'
                  }`}>
                    {(item.progress * 100).toFixed(1)}%
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${
                    isCritical || isSuccess ? 'text-slate-500' : 'text-slate-400'
                  }`}>Efficacité Globale</span>
                </div>

                <div className="space-y-4 md:col-span-3">
                  <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${
                    isCritical || isSuccess ? 'text-slate-800' : 'text-white'
                  }`}>
                    <div className={`p-4 rounded-xl border ${
                      isCritical ? 'bg-white border-red-100' : 
                      isSuccess ? 'bg-white border-emerald-100' : 
                      'bg-white/5 border-white/10'
                    }`}>
                      <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Total Target</p>
                      <p className="text-xl font-black">{formatNum(item.target)}</p>
                    </div>
                    <div className={`p-4 rounded-xl border ${
                      isCritical ? 'bg-white border-red-100' : 
                      isSuccess ? 'bg-white border-emerald-100' : 
                      'bg-white/5 border-white/10'
                    }`}>
                      <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Total Conform</p>
                      <p className="text-xl font-black">{formatNum(item.conformQty)}</p>
                    </div>
                    <div className={`p-4 rounded-xl border ${
                      isCritical ? 'bg-white border-red-100' : 
                      isSuccess ? 'bg-white border-emerald-100' : 
                      'bg-white/5 border-white/10'
                    }`}>
                      <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Total Gap</p>
                      <p className={`text-xl font-black ${
                        item.gap <= 0 ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {item.gap > 0 ? `-${formatNum(item.gap)}` : `+${formatNum(Math.abs(item.gap))}`}
                      </p>
                    </div>
                    <div className={`p-4 rounded-xl border ${
                      isCritical ? 'bg-white border-red-100' : 
                      isSuccess ? 'bg-white border-emerald-100' : 
                      'bg-white/5 border-white/10'
                    }`}>
                      <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Scrap Rate</p>
                      <p className={`text-xl font-black ${(item.scrapRate * 100) > 5 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {(item.scrapRate * 100).toFixed(2)}%
                      </p>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className={`h-4 rounded-full overflow-hidden p-0.5 border ${
                    isCritical ? 'bg-red-100 border-red-200' : 
                    isSuccess ? 'bg-emerald-100 border-emerald-200' : 
                    'bg-white/5 border-white/10'
                  }`}>
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${
                        isSuccess ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 
                        progress >= 80 ? 'bg-gradient-to-r from-amber-600 to-amber-400' : 
                        'bg-gradient-to-r from-red-600 to-red-400'
                      }`}
                      style={{ width: `${Math.min(100, progress)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        </div>
      </div>

      {/* Grid of Department Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {DEPARTMENTS.map(dept => {
          const item = getDayData(dept.storeName);
          if (!item) return null;

          const progress = item.progress * 100;
          const statusColor = progress >= 100 ? 'text-emerald-600' : progress >= 80 ? 'text-amber-600' : 'text-red-600';
          const bgColor = progress >= 100 ? 'bg-emerald-50' : progress >= 80 ? 'bg-amber-50' : 'bg-red-50';

          const borderColor = progress >= 100 ? 'border-emerald-200' : progress >= 80 ? 'border-amber-200' : 'border-red-200';

          return (
            <div key={dept.storeName} className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden hover:scale-[1.02] transition-all duration-300 group">
              <div className={`p-5 bg-gradient-to-br ${
                dept.color === 'blue' ? 'from-blue-600 via-blue-700 to-indigo-900' :
                dept.color === 'teal' ? 'from-teal-600 via-teal-700 to-cyan-900' :
                dept.color === 'indigo' ? 'from-indigo-600 via-indigo-700 to-violet-900' :
                dept.color === 'violet' ? 'from-violet-600 via-violet-700 to-purple-900' :
                dept.color === 'fuchsia' ? 'from-fuchsia-600 via-fuchsia-700 to-pink-900' :
                'from-emerald-600 via-emerald-700 to-green-900'
              } text-white relative overflow-hidden`}>
                <div className="relative z-10 flex justify-between items-center">
                  <h3 className="text-xl font-black tracking-widest uppercase italic">{dept.displayName}</h3>
                  <Activity className="w-6 h-6 opacity-40 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="absolute -right-4 -bottom-4 bg-white/10 w-24 h-24 rounded-full blur-2xl"></div>
              </div>

              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Target</p>
                    <div className="flex items-center text-slate-800">
                      <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center mr-3 border border-slate-100">
                        <Target className="w-4 h-4 text-slate-400" />
                      </div>
                      <span className="text-2xl font-black font-mono">{formatNum(item.target)}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Conform</p>
                    <div className="flex items-center text-slate-800">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center mr-3 border border-emerald-100">
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                      </div>
                      <span className="text-2xl font-black font-mono text-emerald-600">{formatNum(item.conformQty)}</span>
                    </div>
                  </div>
                </div>

                <div className={`p-6 rounded-2xl ${bgColor} border-2 ${borderColor} shadow-inner flex items-center justify-between group-hover:shadow-md transition-all`}>
                  <div>
                    <p className={`text-[11px] font-black uppercase tracking-[0.2em] ${statusColor} mb-2`}>Performance</p>
                    <span className={`text-4xl font-black ${statusColor} drop-shadow-sm`}>{progress.toFixed(1)}%</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Statut Gap</p>
                    <span className={`text-xl font-black px-3 py-1 rounded-lg bg-white/60 border ${item.gap <= 0 ? 'text-emerald-600 border-emerald-100' : 'text-red-600 border-red-100'}`}>
                      {item.gap > 0 ? `+${formatNum(item.gap)}` : formatNum(item.gap)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 pt-4 border-t border-slate-100 gap-4">
                  <div className="flex items-center text-red-600 font-black text-sm">
                    <AlertTriangle className="w-5 h-5 mr-2" />
                    <span>SCRAP: {formatNum(item.scrapQty)}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Scrap Rate</p>
                    <span className="text-slate-700 font-black">{(item.scrapRate * 100).toFixed(2)}%</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
