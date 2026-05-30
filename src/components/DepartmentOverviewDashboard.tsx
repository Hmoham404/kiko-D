'use client';

import React, { startTransition, useDeferredValue, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AlertTriangle, Factory, Gauge, Target, TrendingUp } from 'lucide-react';
import { KpiCard } from '@/components/KpiCard';
import { ProductionData, SubComponentData } from '@/store/useStore';
import { buildWeeklyTargetOverrideKey, sumWeeklyTargets } from '@/lib/weeklyMetrics';
import { useStore } from '@/store/useStore';

interface DepartmentOverviewDashboardProps {
  data: ProductionData[];
  subComponentsData: SubComponentData[];
}

type SummaryMetrics = {
  target: number;
  actual: number;
  conform: number;
  scrap: number;
  gap: number;
  progress: number;
  scrapRate: number;
};

type SummaryRow = SummaryMetrics & {
  key: string;
  label: string;
};

type DetailRow = {
  key: string;
  dateLabel: string;
  department: string;
  unitOfProduction: string;
  machine: string;
  reference: string;
  target: number;
  actual: number;
  gap: number;
  rate: number;
};

const DEPARTMENT_OPTIONS = [
  { value: 'ALL', label: 'Tous les départements' },
  { value: 'Injection', label: 'Injection' },
  { value: 'Assemblage', label: 'Assemblage' },
  { value: 'US serigraphie', label: 'Sérigraphie' },
  { value: 'Metallisation', label: 'Métallisation' },
  { value: 'Packaging', label: 'Packaging' },
  { value: 'Soudure', label: 'Soudure' },
];

const getDepartmentLabel = (department: string) =>
  DEPARTMENT_OPTIONS.find((option) => option.value === department)?.label ?? department;

const getPerformanceColor = (progress: number): 'green' | 'orange' | 'red' => {
  if (progress > 0.95) return 'green';
  if (progress >= 0.85) return 'orange';
  return 'red';
};

const getPerformanceLabel = (progress: number) => {
  if (progress > 0.95) return 'Très bon';
  if (progress >= 0.85) return 'À surveiller';
  return 'Action requise';
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

const buildMetrics = (items: ProductionData[], weeklyTargets: Record<string, number>): SummaryMetrics => {
  const target = sumWeeklyTargets(
    items,
    (item) => item.department,
    (item) => weeklyTargets[buildWeeklyTargetOverrideKey('department', item.department, item.weekKey)] ?? item.weeklyTarget
  );
  const actual = items.reduce((sum, item) => sum + item.actualProduction, 0);
  const conform = items.reduce((sum, item) => sum + item.conformQty, 0);
  const scrap = items.reduce((sum, item) => sum + item.scrapQty, 0);

  return {
    target,
    actual,
    conform,
    scrap,
    gap: actual - target,
    progress: target > 0 ? actual / target : 0,
    scrapRate: actual > 0 ? scrap / actual : 0,
  };
};

export const DepartmentOverviewDashboard: React.FC<DepartmentOverviewDashboardProps> = ({
  data,
  subComponentsData,
}) => {
  const weeklyTargets = useStore((state) => state.weeklyTargets);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');
  const deferredDepartment = useDeferredValue(selectedDepartment);

  const summaryRows = useMemo<SummaryRow[]>(() => {
    const grouped = new Map<string, ProductionData[]>();

    data.forEach((item) => {
      const existing = grouped.get(item.department) ?? [];
      existing.push(item);
      grouped.set(item.department, existing);
    });

    return Array.from(grouped.entries())
      .map(([department, items]) => ({
        key: department,
        label: getDepartmentLabel(department),
        ...buildMetrics(items, weeklyTargets),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [data, weeklyTargets]);

  const filteredData = useMemo(() => {
    if (deferredDepartment === 'ALL') return data;
    return data.filter((item) => item.department === deferredDepartment);
  }, [data, deferredDepartment]);

  const selectedSummary = useMemo(() => {
    if (deferredDepartment === 'ALL') {
      return {
        key: 'ALL',
        label: 'Tous les départements',
        ...buildMetrics(data, weeklyTargets),
      };
    }

    return (
      summaryRows.find((row) => row.key === deferredDepartment) ?? {
        key: deferredDepartment,
        label: getDepartmentLabel(deferredDepartment),
        target: 0,
        actual: 0,
        conform: 0,
        scrap: 0,
        gap: 0,
        progress: 0,
        scrapRate: 0,
      }
    );
  }, [data, deferredDepartment, summaryRows, weeklyTargets]);

  const chartData = useMemo(() => {
    if (deferredDepartment === 'ALL') {
      return summaryRows.map((row) => ({
        name: row.label,
        target: row.target,
        actual: row.actual,
      }));
    }

    if (deferredDepartment === 'Injection' && subComponentsData.length > 0) {
      const grouped = new Map<string, SubComponentData[]>();

      subComponentsData.forEach((item) => {
        const existing = grouped.get(item.component) ?? [];
        existing.push(item);
        grouped.set(item.component, existing);
      });

      return Array.from(grouped.entries()).map(([component, items]) => ({
        name: component,
        target: sumWeeklyTargets(
          items,
          () => component,
          (item) => weeklyTargets[buildWeeklyTargetOverrideKey('component', item.component, item.weekKey)] ?? item.weeklyTarget
        ),
        actual: items.reduce((sum, item) => sum + item.actualProduction, 0),
      }));
    }

    return filteredData
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((item) => ({
        name: formatDateLabel(item.date),
        target: item.target,
        actual: item.actualProduction,
      }));
  }, [deferredDepartment, filteredData, subComponentsData, summaryRows, weeklyTargets]);

  const detailRows = useMemo<DetailRow[]>(() => {
    if (deferredDepartment === 'ALL') {
      return summaryRows.map((row) => ({
        key: row.key,
        dateLabel: 'Cumul importé',
        department: row.label,
        unitOfProduction: row.label,
        machine: '-',
        reference: '-',
        target: row.target,
        actual: row.actual,
        gap: row.gap,
        rate: row.progress,
      }));
    }

    if (deferredDepartment === 'Injection' && subComponentsData.length > 0) {
      return subComponentsData
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date) || a.component.localeCompare(b.component))
        .map((item) => ({
          key: `${item.component}-${item.date}`,
          dateLabel: formatDateLabel(item.date),
          department: 'Injection',
          unitOfProduction: item.unitOfProduction || item.component,
          machine: item.machine || '-',
          reference: item.reference || item.coverCode || item.component,
          target: item.target,
          actual: item.actualProduction,
          gap: item.actualProduction - item.target,
          rate: item.target > 0 ? item.actualProduction / item.target : 0,
        }));
    }

    return filteredData
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((item) => ({
        key: `${item.department}-${item.date}`,
        dateLabel: formatDateLabel(item.date),
        department: getDepartmentLabel(item.department),
        unitOfProduction: item.unitOfProduction || getDepartmentLabel(item.department),
        machine: item.machine || item.shift || '-',
        reference: item.partNumber || '-',
        target: item.target,
        actual: item.actualProduction,
        gap: item.actualProduction - item.target,
        rate: item.target > 0 ? item.actualProduction / item.target : 0,
      }));
  }, [deferredDepartment, filteredData, subComponentsData, summaryRows]);

  const alerts = useMemo(() => {
    const results: Array<{ tone: 'green' | 'orange' | 'red'; message: string }> = [];

    if (selectedSummary.target === 0) {
      results.push({
        tone: 'orange',
        message: 'Aucun objectif exploitable détecté pour ce périmètre. Vérifiez les targets importés.',
      });
      return results;
    }

    if (selectedSummary.progress <= 0.85) {
      results.push({
        tone: 'red',
        message: `Le taux de réalisation est à ${formatPercent(selectedSummary.progress)}. Une action corrective est nécessaire.`,
      });
    } else if (selectedSummary.progress <= 0.95) {
      results.push({
        tone: 'orange',
        message: `La performance est à ${formatPercent(selectedSummary.progress)}. Le département est à surveiller.`,
      });
    } else {
      results.push({
        tone: 'green',
        message: `La performance est à ${formatPercent(selectedSummary.progress)}. L'objectif est quasiment atteint ou dépassé.`,
      });
    }

    if (selectedSummary.gap < 0) {
      results.push({
        tone: 'red',
        message: `Écart négatif de ${formatNumber(Math.abs(selectedSummary.gap))} pièces par rapport à l'objectif.`,
      });
    }

    if (selectedSummary.scrapRate > 0.05) {
      results.push({
        tone: 'orange',
        message: `Le taux de rebut atteint ${formatPercent(selectedSummary.scrapRate)}. Un suivi qualité est recommandé.`,
      });
    }

    if (deferredDepartment === 'ALL') {
      const criticalDepartments = summaryRows.filter((row) => row.progress < 0.85).map((row) => row.label);
      if (criticalDepartments.length > 0) {
        results.push({
          tone: 'red',
          message: `Départements critiques: ${criticalDepartments.join(', ')}.`,
        });
      }
    }

    return results;
  }, [deferredDepartment, selectedSummary, summaryRows]);

  if (data.length === 0) return null;

  const performanceColor = getPerformanceColor(selectedSummary.progress);
  const performanceLabel = getPerformanceLabel(selectedSummary.progress);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
              Vue d&apos;ensemble par département
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              Department Performance Overview
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Filtrez un département puis suivez les KPI clés, l&apos;écart objectif vs réalisé et les alertes de
              performance.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Département</span>
              <select
                value={selectedDepartment}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  startTransition(() => setSelectedDepartment(nextValue));
                }}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none transition focus:border-[var(--dashboard-primary)]"
              >
                {DEPARTMENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
                {summaryRows
                  .filter((row) => !DEPARTMENT_OPTIONS.some((option) => option.value === row.key))
                  .map((row) => (
                    <option key={row.key} value={row.key}>
                      {row.label}
                    </option>
                  ))}
              </select>
            </label>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Score performance</span>
              <div className="mt-2 flex items-center gap-3">
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ${
                    performanceColor === 'green'
                      ? 'bg-emerald-100 text-emerald-700'
                      : performanceColor === 'orange'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  {performanceLabel}
                </span>
                <span className="text-2xl font-black text-slate-900">{formatPercent(selectedSummary.progress)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Performance" value={formatPercent(selectedSummary.progress)} icon={Gauge} color={performanceColor} />
        <KpiCard title="Objectif" value={formatNumber(selectedSummary.target)} icon={Target} color="gray" />
        <KpiCard title="Réalisé" value={formatNumber(selectedSummary.actual)} icon={TrendingUp} color={selectedSummary.actual >= selectedSummary.target ? 'green' : 'orange'} />
        <KpiCard
          title="Écart"
          value={`${selectedSummary.gap > 0 ? '+' : ''}${formatNumber(selectedSummary.gap)}`}
          icon={Factory}
          color={selectedSummary.gap >= 0 ? 'green' : 'red'}
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Objectif vs Réalisé</p>
            <h3 className="mt-1 text-xl font-black text-slate-950">
              {deferredDepartment === 'ALL' ? 'Comparatif par département' : 'Target Quantity vs Actual Quantity'}
            </h3>
          </div>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--dashboard-grid)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                <RechartsTooltip formatter={(value) => formatTooltipNumber(value)} />
                <Legend iconType="circle" />
                <Bar dataKey="target" name="Objectif" fill="var(--dashboard-neutral)" radius={[8, 8, 0, 0]} />
                <Bar dataKey="actual" name="Réalisé" fill="var(--dashboard-primary)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Lecture rapide</p>
            <h3 className="mt-1 text-xl font-black text-slate-950">Objectif vs Réalisé</h3>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full text-sm">
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="px-4 py-3 font-semibold text-slate-500">Objectif</td>
                  <td className="px-4 py-3 text-right font-black text-slate-900">{formatNumber(selectedSummary.target)} pièces</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="px-4 py-3 font-semibold text-slate-500">Réalisé</td>
                  <td className="px-4 py-3 text-right font-black text-slate-900">{formatNumber(selectedSummary.actual)} pièces</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="px-4 py-3 font-semibold text-slate-500">Écart</td>
                  <td className={`px-4 py-3 text-right font-black ${selectedSummary.gap >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {selectedSummary.gap > 0 ? '+' : ''}
                    {formatNumber(selectedSummary.gap)} pièces
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-slate-500">Taux de réalisation</td>
                  <td className="px-4 py-3 text-right font-black text-slate-900">{formatPercent(selectedSummary.progress)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Conforme</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{formatNumber(selectedSummary.conform)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Taux de rebut</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{formatPercent(selectedSummary.scrapRate)}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Tableau détaillé</p>
          <h3 className="mt-1 text-xl font-black text-slate-950">Ligne, machine, référence et résultats</h3>
        </div>

        <div className="overflow-x-auto">
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
              {detailRows.map((row) => (
                <tr key={row.key} className="border-b border-slate-100">
                  <td className="px-4 py-3 font-semibold text-slate-600">{row.dateLabel}</td>
                  <td className="px-4 py-3 font-black text-slate-900">{row.department}</td>
                  <td className="px-4 py-3 text-slate-600">{row.unitOfProduction}</td>
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

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-[var(--dashboard-warning)]" />
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Analyse des écarts</p>
            <h3 className="mt-1 text-xl font-black text-slate-950">Alertes et points de vigilance</h3>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {alerts.map((alert, index) => (
            <div
              key={`${alert.message}-${index}`}
              className={`rounded-2xl border px-4 py-4 ${
                alert.tone === 'green'
                  ? 'border-emerald-200 bg-emerald-50'
                  : alert.tone === 'orange'
                    ? 'border-amber-200 bg-amber-50'
                    : 'border-rose-200 bg-rose-50'
              }`}
            >
              <p
                className={`text-sm font-semibold ${
                  alert.tone === 'green'
                    ? 'text-emerald-800'
                    : alert.tone === 'orange'
                      ? 'text-amber-800'
                      : 'text-rose-800'
                }`}
              >
                {alert.message}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
