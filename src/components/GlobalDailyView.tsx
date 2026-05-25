'use client';

import React, { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { ProductionData, SubComponentData, useStore } from '@/store/useStore';
import { buildWeeklyTargetOverrideKey, getWeekMetadata } from '@/lib/weeklyMetrics';

interface GlobalDailyViewProps {
  data: ProductionData[];
  subComponentsData: SubComponentData[];
}

type Metrics = {
  target: number;
  actual: number;
  conform: number;
  scrap: number;
  progress: number;
  gap: number;
  scrapRate: number;
};

type GroupDefinition = {
  key: 'GLOBAL' | 'FG' | 'SFG';
  title: string;
  subtitle: string;
  departments: string[];
  accent: string;
};

const DEPARTMENTS = [
  { storeName: 'Injection', displayName: 'INJECTION' },
  { storeName: 'Soudure', displayName: 'US WELDING' },
  { storeName: 'Metallisation', displayName: 'METALLISATION' },
  { storeName: 'US serigraphie', displayName: 'PRINTING' },
  { storeName: 'Assemblage', displayName: 'ASSEMBLAGE' },
  { storeName: 'Packaging', displayName: 'PACKAGING' },
];

const FACTORY_GROUPS: GroupDefinition[] = [
  {
    key: 'GLOBAL',
    title: 'GLOBAL',
    subtitle: 'Vue globale usine',
    departments: DEPARTMENTS.map((department) => department.storeName),
    accent: 'bg-slate-900',
  },
  {
    key: 'FG',
    title: 'FG',
    subtitle: 'ligne assemblage',
    departments: ['Assemblage'],
    accent: 'bg-[#d86f3d]',
  },
  {
    key: 'SFG',
    title: 'SFG',
    subtitle: 'Injection + Welding + Printing + Metallisation',
    departments: ['Injection', 'Soudure', 'US serigraphie', 'Metallisation'],
    accent: 'bg-[#2f6178]',
  },
];

const EMPTY_METRICS: Metrics = {
  target: 0,
  actual: 0,
  conform: 0,
  scrap: 0,
  progress: 0,
  gap: 0,
  scrapRate: 0,
};

const WORKING_DAYS_PER_WEEK = 6;

const roundUnits = (value: number) => Math.round(value);

const buildMetrics = (target: number, actual: number, conform: number, scrap: number): Metrics => ({
  target: roundUnits(target),
  actual: roundUnits(actual),
  conform: roundUnits(conform),
  scrap: roundUnits(scrap),
  progress: target > 0 ? conform / target : 0,
  gap: conform - target,
  scrapRate: actual > 0 ? scrap / actual : 0,
});

export const GlobalDailyView: React.FC<GlobalDailyViewProps> = ({ data, subComponentsData }) => {
  const weeklyTargets = useStore((state) => state.weeklyTargets);

  const availableDates = useMemo(() => {
    const dates = new Set([...data.map((item) => item.date), ...subComponentsData.map((item) => item.date)]);
    return Array.from(dates).filter(Boolean).sort();
  }, [data, subComponentsData]);

  const injectionSeries = useMemo(() => {
    return availableDates
      .map((date) => {
        const mainItem = data.find((item) => item.department === 'Injection' && item.date === date);
        if (mainItem) return mainItem;

        const subsForDate = subComponentsData.filter((item) => item.date === date);
        if (subsForDate.length === 0) return null;

        const { weekKey, weekLabel } = getWeekMetadata(date);
        return {
          department: 'Injection',
          date,
          week: weekLabel,
          weekKey,
          target: subsForDate.reduce((sum, item) => sum + item.target, 0),
          weeklyTarget: subsForDate.reduce((sum, item) => sum + item.weeklyTarget, 0),
          actualProduction: subsForDate.reduce((sum, item) => sum + item.actualProduction, 0),
          conformQty: subsForDate.reduce((sum, item) => sum + item.conformQty, 0),
          scrapQty: subsForDate.reduce((sum, item) => sum + item.scrapQty, 0),
          progress: 0,
          gap: 0,
          scrapRate: 0,
          status: 'orange' as const,
        };
      })
      .filter(Boolean) as ProductionData[];
  }, [availableDates, data, subComponentsData]);

  const [selectedDate, setSelectedDate] = useState<string>(
    availableDates.length > 0 ? availableDates[availableDates.length - 1] : ''
  );

  const activeDate = availableDates.includes(selectedDate)
    ? selectedDate
    : availableDates[availableDates.length - 1] ?? '';
  const currentIndex = availableDates.indexOf(activeDate);
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex >= 0 && currentIndex < availableDates.length - 1;

  const getDepartmentSeries = (department: string) => {
    if (department === 'Injection') return injectionSeries;
    return data.filter((item) => item.department === department);
  };

  const getDepartmentItemForDate = (department: string, date: string) => {
    return getDepartmentSeries(department).find((item) => item.date === date);
  };

  const getDepartmentWeekReferenceItem = (department: string, date: string) => {
    const exactItem = getDepartmentItemForDate(department, date);
    if (exactItem) return exactItem;

    const weekKey = getWeekMetadata(date).weekKey;
    return getDepartmentSeries(department).find((item) => item.weekKey === weekKey) ?? null;
  };

  const getWeeklyTarget = (department: string, weekKey: string, fallbackWeeklyTarget: number) => {
    return weeklyTargets[buildWeeklyTargetOverrideKey('department', department, weekKey)] ?? fallbackWeeklyTarget;
  };

  const getDailyTarget = (department: string, date: string) => {
    const referenceItem = getDepartmentWeekReferenceItem(department, date);
    if (!referenceItem) return 0;

    const weeklyTarget = getWeeklyTarget(department, referenceItem.weekKey, referenceItem.weeklyTarget);
    if (weeklyTarget > 0) return roundUnits(weeklyTarget / WORKING_DAYS_PER_WEEK);
    return roundUnits(referenceItem.target);
  };

  const getDepartmentDailyMetrics = (department: string, date: string): Metrics => {
    const item = getDepartmentItemForDate(department, date);
    const target = getDailyTarget(department, date);

    if (!item) {
      return buildMetrics(target, 0, 0, 0);
    }

    return buildMetrics(target, item.actualProduction, item.conformQty, item.scrapQty);
  };

  const getDepartmentImportedMetrics = (department: string, date: string): Metrics => {
    const items = getDepartmentSeries(department).filter((item) => item.date <= date);
    if (items.length === 0) return EMPTY_METRICS;

    const target = items.reduce((sum, item) => sum + getDailyTarget(department, item.date), 0);
    const actual = items.reduce((sum, item) => sum + item.actualProduction, 0);
    const conform = items.reduce((sum, item) => sum + item.conformQty, 0);
    const scrap = items.reduce((sum, item) => sum + item.scrapQty, 0);

    return buildMetrics(target, actual, conform, scrap);
  };

  const getGroupMetrics = (
    group: GroupDefinition,
    metricGetter: (department: string, date: string) => Metrics,
    date: string
  ): Metrics => {
    const metrics = group.departments.map((department) => metricGetter(department, date));

    const target = metrics.reduce((sum, item) => sum + item.target, 0);
    const actual = metrics.reduce((sum, item) => sum + item.actual, 0);
    const conform = metrics.reduce((sum, item) => sum + item.conform, 0);
    const scrap = metrics.reduce((sum, item) => sum + item.scrap, 0);

    return buildMetrics(target, actual, conform, scrap);
  };

  const recentDates = currentIndex >= 0 ? availableDates.slice(Math.max(0, currentIndex - 6), currentIndex + 1) : [];
  const groupsWithMetrics = FACTORY_GROUPS.map((group) => ({
    ...group,
    day: getGroupMetrics(group, getDepartmentDailyMetrics, activeDate),
    global: getGroupMetrics(group, getDepartmentImportedMetrics, activeDate),
    history: recentDates.map((date) => ({
      date,
      metrics: getGroupMetrics(group, getDepartmentDailyMetrics, date),
    })),
  }));
  const overallMetrics = groupsWithMetrics.find((group) => group.key === 'GLOBAL');
  const visibleGroups = groupsWithMetrics.filter((group) => group.key !== 'GLOBAL');

  const departmentRows = DEPARTMENTS.map((department) => ({
    ...department,
    day: getDepartmentDailyMetrics(department.storeName, activeDate),
    global: getDepartmentImportedMetrics(department.storeName, activeDate),
  }));

  const formatNum = (num: number) => new Intl.NumberFormat('fr-FR').format(num);
  const formatPct = (num: number) => `${(num * 100).toFixed(1)}%`;

  if (availableDates.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <button
            onClick={() => canGoPrev && setSelectedDate(availableDates[currentIndex - 1])}
            disabled={!canGoPrev}
            className={`rounded-full p-2 transition-all ${canGoPrev ? 'text-slate-700 hover:bg-slate-100' : 'cursor-not-allowed text-slate-200'}`}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="flex flex-col items-center">
            <div className="relative flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-6 py-3 shadow-inner">
              <CalendarDays className="h-7 w-7 text-[var(--dashboard-primary)]" />
              <div
                className="flex cursor-pointer flex-col"
                onClick={() => (document.getElementById('meeting-date-picker') as HTMLInputElement | null)?.showPicker()}
              >
                <span className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Date de production
                </span>
                <span className="border-b-4 border-slate-200 px-1 pb-1 text-2xl font-black tracking-tight text-slate-800">
                  {activeDate ? format(parseISO(activeDate), 'EEEE dd MMMM yyyy', { locale: fr }).toUpperCase() : 'CHOISIR UNE DATE'}
                </span>
              </div>
              <input
                id="meeting-date-picker"
                type="date"
                value={activeDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="pointer-events-none absolute h-0 w-0 opacity-0"
              />
            </div>

            <div className="mt-4 flex space-x-2">
              {availableDates.slice(-10).map((date) => (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={`h-3 rounded-full transition-all ${
                    date === activeDate ? 'w-10 bg-[var(--dashboard-primary)] shadow-lg shadow-slate-300' : 'w-3 bg-slate-200 hover:bg-slate-300'
                  }`}
                />
              ))}
            </div>
          </div>

          <button
            onClick={() => canGoNext && setSelectedDate(availableDates[currentIndex + 1])}
            disabled={!canGoNext}
            className={`rounded-full p-2 transition-all ${canGoNext ? 'text-slate-700 hover:bg-slate-100' : 'cursor-not-allowed text-slate-200'}`}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-black uppercase tracking-[0.24em] text-slate-950">Meeting View Premium</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Executive Factory Review</h2>
            <p className="mt-3 text-sm font-medium leading-6 text-slate-950">
              Lecture directe pour reunion: vue globale, bloc FG, bloc SFG, avancement du jour et global importe.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 lg:min-w-[320px]">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-950">Cumul importe</p>
            <p className="mt-1 text-sm font-semibold text-slate-950">
              Du premier jour importe jusqu&apos;au {activeDate ? format(parseISO(activeDate), 'dd/MM/yyyy') : '-'}
            </p>
            <p className="mt-3 text-sm text-slate-700">
              Le calcul part uniquement des jours reellement importes et du travail reellement realise.
            </p>
            {overallMetrics && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Global jour</p>
                  <p className="mt-1 text-2xl font-black text-slate-950">{formatPct(overallMetrics.day.progress)}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-600">
                    Conforme {formatNum(overallMetrics.day.conform)}
                  </p>
                </div>
                <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Global importe</p>
                  <p className="mt-1 text-2xl font-black text-slate-950">{formatPct(overallMetrics.global.progress)}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-600">
                    Conforme {formatNum(overallMetrics.global.conform)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {visibleGroups.map((group) => (
          <div key={group.key} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className={`px-5 py-4 text-white ${group.accent}`}>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/75">{group.subtitle}</p>
              <h3 className="mt-1 text-2xl font-black tracking-[0.08em]">{group.title}</h3>
            </div>

            <div className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Jour selectionne</p>
                  <p className="mt-2 text-3xl font-black text-slate-900">{formatPct(group.day.progress)}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-600">
                    Conforme {formatNum(group.day.conform)} / Obj {formatNum(group.day.target)}
                  </p>
                  <p className={`mt-1 text-sm font-black ${group.day.gap >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    Gap {group.day.gap > 0 ? '+' : ''}{formatNum(group.day.gap)}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Global importe</p>
                  <p className="mt-2 text-3xl font-black text-slate-900">{formatPct(group.global.progress)}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-600">
                    Conforme {formatNum(group.global.conform)} / Obj {formatNum(group.global.target)}
                  </p>
                  <p className={`mt-1 text-sm font-black ${group.global.gap >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    Gap {group.global.gap > 0 ? '+' : ''}{formatNum(group.global.gap)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Scrap jour</p>
                  <p className="mt-1 text-xl font-black text-slate-900">{formatNum(group.day.scrap)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">% Scrap jour</p>
                  <p className="mt-1 text-xl font-black text-slate-900">{formatPct(group.day.scrapRate)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Scrap global</p>
                  <p className="mt-1 text-xl font-black text-slate-900">{formatNum(group.global.scrap)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">% Scrap global</p>
                  <p className="mt-1 text-xl font-black text-slate-900">{formatPct(group.global.scrapRate)}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Travail realise par jour</p>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                    {recentDates.length} jours importes
                  </p>
                </div>
                <div className="space-y-2">
                  {group.history.map((entry) => (
                    <div key={`${group.key}-${entry.date}`} className="grid grid-cols-[64px_minmax(0,1fr)_56px] items-center gap-3">
                      <span className="text-xs font-bold text-slate-500">{format(parseISO(entry.date), 'dd/MM')}</span>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`h-full rounded-full ${group.accent}`}
                          style={{ width: `${Math.min(entry.metrics.progress * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-right text-xs font-black text-slate-700">{formatPct(entry.metrics.progress)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Detail departements</p>
          <h3 className="mt-1 text-xl font-black text-slate-950">Par jour et en global</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                <th className="px-4 py-3">Departement</th>
                <th className="px-4 py-3 text-right">Perf jour</th>
                <th className="px-4 py-3 text-right">Conforme jour</th>
                <th className="px-4 py-3 text-right">Scrap jour</th>
                <th className="px-4 py-3 text-right">% Scrap jour</th>
                <th className="px-4 py-3 text-right">Perf globale</th>
                <th className="px-4 py-3 text-right">Conforme global</th>
                <th className="px-4 py-3 text-right">Scrap global</th>
                <th className="px-4 py-3 text-right">% Scrap global</th>
                <th className="px-4 py-3 text-right">Gap global</th>
              </tr>
            </thead>
            <tbody>
              {departmentRows.map((department) => (
                <tr key={department.storeName} className="border-b border-slate-100 text-sm">
                  <td className="px-4 py-3 font-black text-slate-900">{department.displayName}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700">{formatPct(department.day.progress)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700">{formatNum(department.day.conform)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700">{formatNum(department.day.scrap)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700">{formatPct(department.day.scrapRate)}</td>
                  <td className="px-4 py-3 text-right font-black text-slate-900">{formatPct(department.global.progress)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700">{formatNum(department.global.conform)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700">{formatNum(department.global.scrap)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700">{formatPct(department.global.scrapRate)}</td>
                  <td className={`px-4 py-3 text-right font-black ${department.global.gap >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {department.global.gap > 0 ? '+' : ''}{formatNum(department.global.gap)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
