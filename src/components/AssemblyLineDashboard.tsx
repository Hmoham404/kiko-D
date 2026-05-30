'use client';

import React, { useRef, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarDays, Save, Target, TrendingUp } from 'lucide-react';
import { KpiCard } from '@/components/KpiCard';
import { ProductionData, useStore } from '@/store/useStore';
import { buildWeeklyTargetOverrideKey } from '@/lib/weeklyMetrics';

interface AssemblyLineDashboardProps {
  data: ProductionData[];
}

type AssemblyMetrics = {
  target: number;
  actual: number;
  conform: number;
  gap: number;
  rate: number;
};

const formatNumber = (value: number) => new Intl.NumberFormat('fr-FR').format(Math.round(value));
const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;
const formatTooltipNumber = (value: unknown) =>
  formatNumber(Number(Array.isArray(value) ? value[0] ?? 0 : value ?? 0));

const formatDateLabel = (date: string) => {
  try {
    return format(parseISO(date), 'dd/MM/yyyy', { locale: fr });
  } catch {
    return date;
  }
};

const formatMonthLabel = (monthKey: string) => {
  if (!monthKey) return '-';

  try {
    return format(parseISO(`${monthKey}-01`), 'MMMM yyyy', { locale: fr });
  } catch {
    return monthKey;
  }
};

const getPerformanceColor = (progress: number): 'green' | 'orange' | 'red' => {
  if (progress > 0.95) return 'green';
  if (progress >= 0.85) return 'orange';
  return 'red';
};

export const AssemblyLineDashboard: React.FC<AssemblyLineDashboardProps> = ({ data }) => {
  const assemblyData = data
    .filter((item) => item.department === 'Assemblage')
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  const weeklyTargets = useStore((state) => state.weeklyTargets);
  const setWeeklyTarget = useStore((state) => state.setWeeklyTarget);
  const targetInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedDate, setSelectedDate] = useState<string>(assemblyData[assemblyData.length - 1]?.date ?? '');
  const activeDate = assemblyData.some((item) => item.date === selectedDate)
    ? selectedDate
    : assemblyData[assemblyData.length - 1]?.date ?? '';
  const activeItem = assemblyData.find((item) => item.date === activeDate);
  const activeWeekKey = activeItem?.weekKey ?? '';
  const activeTargetKey = activeWeekKey ? buildWeeklyTargetOverrideKey('department', 'Assemblage', activeWeekKey) : '';
  const currentWeeklyTarget = activeItem
    ? weeklyTargets[activeTargetKey] ?? activeItem.weeklyTarget
    : 0;

  const getDailyTarget = (item: ProductionData) => {
    const override = weeklyTargets[buildWeeklyTargetOverrideKey('department', 'Assemblage', item.weekKey)];
    const weeklyTarget = override ?? item.weeklyTarget;
    if (weeklyTarget > 0) {
      return Math.round(weeklyTarget / 6);
    }
    return item.target;
  };

  const buildMetrics = (items: ProductionData[]): AssemblyMetrics => {
    const target = items.reduce((sum, item) => sum + getDailyTarget(item), 0);
    const actual = items.reduce((sum, item) => sum + item.actualProduction, 0);
    const conform = items.reduce((sum, item) => sum + item.conformQty, 0);

    return {
      target,
      actual,
      conform,
      gap: actual - target,
      rate: target > 0 ? actual / target : 0,
    };
  };

  const globalMetrics = buildMetrics(assemblyData);
  const dailyMetrics = activeItem
    ? {
        target: getDailyTarget(activeItem),
        actual: activeItem.actualProduction,
        conform: activeItem.conformQty,
        gap: activeItem.actualProduction - getDailyTarget(activeItem),
        rate: getDailyTarget(activeItem) > 0 ? activeItem.actualProduction / getDailyTarget(activeItem) : 0,
      }
    : { target: 0, actual: 0, conform: 0, gap: 0, rate: 0 };

  const activeMonthKey = activeDate ? activeDate.slice(0, 7) : '';
  const monthlyItems = assemblyData.filter((item) => item.date.startsWith(activeMonthKey));
  const monthlyMetrics = buildMetrics(monthlyItems);

  const cumulativeMonthChart = monthlyItems.reduce<
    Array<{ date: string; cumulativeTarget: number; cumulativeActual: number }>
  >((rows, item) => {
    const previous = rows[rows.length - 1];
    const cumulativeTarget = (previous?.cumulativeTarget ?? 0) + getDailyTarget(item);
    const cumulativeActual = (previous?.cumulativeActual ?? 0) + item.actualProduction;

    rows.push({
      date: formatDateLabel(item.date),
      cumulativeTarget,
      cumulativeActual,
    });

    return rows;
  }, []);

  const dailyTrendChart = monthlyItems.map((item) => ({
    date: formatDateLabel(item.date),
    target: getDailyTarget(item),
    actual: item.actualProduction,
  }));

  const groupedByMonth = new Map<string, ProductionData[]>();
  assemblyData.forEach((item) => {
    const monthKey = item.date.slice(0, 7);
    const existing = groupedByMonth.get(monthKey) ?? [];
    existing.push(item);
    groupedByMonth.set(monthKey, existing);
  });

  const monthlySummaryRows = Array.from(groupedByMonth.entries())
    .map(([monthKey, items]) => ({
      monthKey,
      label: formatMonthLabel(monthKey),
      ...buildMetrics(items),
    }))
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));

  const detailedRows = assemblyData
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((item) => {
      const target = getDailyTarget(item);
      const actual = item.actualProduction;

      return {
        key: item.date,
        date: formatDateLabel(item.date),
        machine: item.machine || item.shift || '-',
        reference: item.partNumber || '-',
        target,
        actual,
        gap: actual - target,
        rate: target > 0 ? actual / target : 0,
      };
    });

  if (assemblyData.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <h3 className="text-xl font-black text-slate-900">Aucune donnée Assemblage</h3>
        <p className="mt-2 text-sm text-slate-500">Importez les fichiers de production pour afficher la ligne Assemblage.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Ligne Assemblage</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              Dashboard Assemblage: jour, global, cumulé et mensuel
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Le cumul mensuel repart à zéro au début de chaque mois et conserve le suivi quotidien avec une colonne
              target sur chaque ligne.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Date</span>
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <CalendarDays className="h-4 w-4 text-[var(--dashboard-primary)]" />
                <input
                  type="date"
                  value={activeDate}
                  min={assemblyData[0]?.date}
                  max={assemblyData[assemblyData.length - 1]?.date}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none"
                />
              </div>
            </label>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                Objectif assemblage à régler
              </span>
              <div className="mt-2 flex gap-2">
                <input
                  key={activeWeekKey}
                  ref={targetInputRef}
                  type="number"
                  min="0"
                  defaultValue={currentWeeklyTarget ? String(currentWeeklyTarget) : ''}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none"
                />
                <button
                  onClick={() => {
                    if (!activeWeekKey) return;
                    setWeeklyTarget(activeTargetKey, Number(targetInputRef.current?.value || 0));
                  }}
                  className="inline-flex items-center justify-center rounded-xl bg-[var(--dashboard-primary)] px-4 py-2 text-sm font-black text-white transition hover:brightness-110"
                >
                  <Save className="mr-2 h-4 w-4" />
                  Enregistrer
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Semaine active: <span className="font-bold text-slate-700">{activeItem?.week ?? '-'}</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Objectif du jour" value={formatNumber(dailyMetrics.target)} icon={Target} color="gray" />
        <KpiCard title="Réalisé du jour" value={formatNumber(dailyMetrics.actual)} icon={TrendingUp} color={getPerformanceColor(dailyMetrics.rate)} />
        <KpiCard title="Cumul mensuel" value={formatPercent(monthlyMetrics.rate)} icon={Target} color={getPerformanceColor(monthlyMetrics.rate)} />
        <KpiCard title="Vision globale" value={formatPercent(globalMetrics.rate)} icon={TrendingUp} color={getPerformanceColor(globalMetrics.rate)} />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
        <div className="mb-5">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Partie graphique</p>
          <h3 className="mt-1 text-2xl font-black text-slate-950">Graphique Objectif mensuel vs Réalisé mensuel</h3>
          <p className="mt-2 text-sm text-slate-600">
            Lecture visuelle du cumul sur le mois en cours avec plus d&apos;espace pour la courbe.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="h-[26rem]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cumulativeMonthChart} margin={{ top: 28, right: 36, left: 20, bottom: 28 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--dashboard-grid)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                <RechartsTooltip formatter={(value) => formatTooltipNumber(value)} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: 12 }} />
                <Line
                  type="monotone"
                  dataKey="cumulativeTarget"
                  name="Target cumulé"
                  stroke="var(--dashboard-neutral-strong)"
                  strokeWidth={3}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="cumulativeActual"
                  name="Réalisé cumulé"
                  stroke="var(--dashboard-primary)"
                  strokeWidth={3}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
        <div className="mb-5">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Autre partie courbe</p>
          <h3 className="mt-1 text-2xl font-black text-slate-950">Courbe journalière Target vs Réalisé</h3>
          <p className="mt-2 text-sm text-slate-600">
            Cette partie montre la courbe jour par jour pour mieux suivre l&apos;évolution de la ligne Assemblage.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="h-[24rem]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyTrendChart} margin={{ top: 24, right: 36, left: 20, bottom: 28 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--dashboard-grid)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                <RechartsTooltip formatter={(value) => formatTooltipNumber(value)} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: 12 }} />
                <Line
                  type="monotone"
                  dataKey="target"
                  name="Target jour"
                  stroke="var(--dashboard-neutral-strong)"
                  strokeWidth={3}
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  name="Réalisé jour"
                  stroke="var(--dashboard-secondary)"
                  strokeWidth={3}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Synthèse active</p>
            <h3 className="mt-1 text-xl font-black text-slate-950">Jour, global, cumul mensuel</h3>
          </div>

          <div className="space-y-4">
            {[
              { label: 'Par jour', metrics: dailyMetrics },
              { label: 'Global', metrics: globalMetrics },
              { label: `Mois ${formatMonthLabel(activeMonthKey)}`, metrics: monthlyMetrics },
            ].map(({ label, metrics }) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-slate-900">{label}</p>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${
                      getPerformanceColor(metrics.rate) === 'green'
                        ? 'bg-emerald-100 text-emerald-700'
                        : getPerformanceColor(metrics.rate) === 'orange'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {formatPercent(metrics.rate)}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-slate-400">Target</p>
                    <p className="font-black text-slate-900">{formatNumber(metrics.target)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Réalisé</p>
                    <p className="font-black text-slate-900">{formatNumber(metrics.actual)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Écart</p>
                    <p className={`font-black ${metrics.gap >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {metrics.gap > 0 ? '+' : ''}
                      {formatNumber(metrics.gap)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Conforme</p>
                    <p className="font-black text-slate-900">{formatNumber(metrics.conform)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Repères</p>
            <h3 className="mt-1 text-xl font-black text-slate-950">Lecture rapide mois et jour</h3>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Mois actif</p>
              <p className="mt-2 text-2xl font-black text-slate-900 capitalize">{formatMonthLabel(activeMonthKey)}</p>
              <p className="mt-2 text-sm text-slate-600">
                Objectif {formatNumber(monthlyMetrics.target)} / Réalisé {formatNumber(monthlyMetrics.actual)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Jour actif</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{formatDateLabel(activeDate)}</p>
              <p className="mt-2 text-sm text-slate-600">
                Target {formatNumber(dailyMetrics.target)} / Réalisé {formatNumber(dailyMetrics.actual)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
        <div className="mb-4">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Tableau mois</p>
          <h3 className="mt-1 text-xl font-black text-slate-950">Cumul mensuel avec remise à zéro à chaque début de mois</h3>
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                <th className="px-4 py-3">Mois</th>
                <th className="px-4 py-3 text-right">Objectif total</th>
                <th className="px-4 py-3 text-right">Réalisé total</th>
                <th className="px-4 py-3 text-right">Écart</th>
                <th className="px-4 py-3 text-right">Taux</th>
              </tr>
            </thead>
            <tbody>
              {monthlySummaryRows.map((row) => (
                <tr key={row.monthKey} className="border-b border-slate-100">
                  <td className="px-4 py-3 font-black text-slate-900 capitalize">{row.label}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700">{formatNumber(row.target)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700">{formatNumber(row.actual)}</td>
                  <td className={`px-4 py-3 text-right font-black ${row.gap >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {row.gap > 0 ? '+' : ''}
                    {formatNumber(row.gap)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${
                        getPerformanceColor(row.rate) === 'green'
                          ? 'bg-emerald-100 text-emerald-700'
                          : getPerformanceColor(row.rate) === 'orange'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {formatPercent(row.rate)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
        <div className="mb-4">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Tableau jours</p>
          <h3 className="mt-1 text-xl font-black text-slate-950">Tableau détaillé Assemblage avec colonne Target</h3>
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Département</th>
                <th className="px-4 py-3">Unité de prod</th>
                <th className="px-4 py-3">Machine</th>
                <th className="px-4 py-3">Référence</th>
                <th className="px-4 py-3 text-right">Target</th>
                <th className="px-4 py-3 text-right">Réalisé</th>
                <th className="px-4 py-3 text-right">Écart</th>
                <th className="px-4 py-3 text-right">Taux</th>
              </tr>
            </thead>
            <tbody>
              {detailedRows.map((row) => (
                <tr key={row.key} className="border-b border-slate-100">
                  <td className="px-4 py-3 font-semibold text-slate-600">{row.date}</td>
                  <td className="px-4 py-3 font-black text-slate-900">Assemblage</td>
                  <td className="px-4 py-3 text-slate-600">Ligne Assemblage</td>
                  <td className="px-4 py-3 text-slate-600">{row.machine}</td>
                  <td className="px-4 py-3 text-slate-600">{row.reference}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700">{formatNumber(row.target)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700">{formatNumber(row.actual)}</td>
                  <td className={`px-4 py-3 text-right font-black ${row.gap >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {row.gap > 0 ? '+' : ''}
                    {formatNumber(row.gap)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${
                        getPerformanceColor(row.rate) === 'green'
                          ? 'bg-emerald-100 text-emerald-700'
                          : getPerformanceColor(row.rate) === 'orange'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {formatPercent(row.rate)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
