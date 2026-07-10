'use client';

import React, { startTransition, useMemo, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  BadgeCheck,
  LineChart as LineChartIcon,
  Maximize2,
  ShieldCheck,
  TriangleAlert,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { buildWeeklyTargetOverrideKey, getWeekMetadata } from '@/lib/weeklyMetrics';
import { ProductionData, SubComponentData, useStore } from '@/store/useStore';

interface ExecutiveDailyDashboardProps {
  data: ProductionData[];
  subComponentsData: SubComponentData[];
  availableDates: string[];
  selectedDate: string;
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
  key: 'PLANT' | 'SFG' | 'FG';
  title: string;
  alias: string;
  subtitle: string;
  departments: string[];
  accent: string;
  softAccent: string;
};

type GroupSnapshot = GroupDefinition & {
  day: Metrics;
  cumulative: Metrics;
};

type DailyCurvePoint = {
  day: string;
  target: number;
  actual: number;
  date: string;
  dateLabel: string;
  status: 'green' | 'red';
};

const WORKING_DAYS_PER_WEEK = 6;
const EMPTY_METRICS: Metrics = {
  target: 0,
  actual: 0,
  conform: 0,
  scrap: 0,
  progress: 0,
  gap: 0,
  scrapRate: 0,
};

const DEPARTMENT_LABELS: Record<string, string> = {
  Injection: 'Injection',
  Soudure: 'Soudure',
  'US serigraphie': 'Serigraphie',
  Metallisation: 'Metallisation',
  Assemblage: 'Assemblage',
  Packaging: 'Packaging',
};

const GROUPS: GroupDefinition[] = [
  {
    key: 'PLANT',
    title: 'Performance usine',
    alias: 'OTE',
    subtitle: 'Vue globale production du jour',
    departments: ['Injection', 'Soudure', 'US serigraphie', 'Metallisation', 'Assemblage', 'Packaging'],
    accent: '#123047',
    softAccent: '#e4edf2',
  },
  {
    key: 'SFG',
    title: 'SFG / PSF',
    alias: 'PSF',
    subtitle: 'Injection, soudure, serigraphie et metallisation',
    departments: ['Injection', 'Soudure', 'US serigraphie', 'Metallisation'],
    accent: '#0f8b8d',
    softAccent: '#e0fbfa',
  },
  {
    key: 'FG',
    title: 'FG / PF',
    alias: 'PF',
    subtitle: 'Assemblage et packaging',
    departments: ['Assemblage', 'Packaging'],
    accent: '#ff7a45',
    softAccent: '#fff0e6',
  },
];

const WEEK_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const roundUnits = (value: number) => Math.round(value);
const formatNumber = (value: number) => new Intl.NumberFormat('fr-FR').format(roundUnits(value));
const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;
const formatRatioPercent = (value: number) => `${(value * 100).toFixed(0)}%`;
const getConformTargetRate = (metrics: Metrics) => (metrics.target > 0 ? metrics.conform / metrics.target : 0);
const formatShortDate = (date: string) => {
  try {
    return format(parseISO(date), 'dd/MM', { locale: fr });
  } catch {
    return date;
  }
};

const roundChartMax = (value: number) => {
  if (value <= 0) return 100;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;

  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
};

const buildMetrics = (target: number, actual: number, conform: number, scrap: number): Metrics => ({
  target: roundUnits(target),
  actual: roundUnits(actual),
  conform: roundUnits(conform),
  scrap: roundUnits(scrap),
  progress: target > 0 ? actual / target : 0,
  gap: actual - target,
  scrapRate: actual > 0 ? scrap / actual : 0,
});

const getTone = (progress: number): 'green' | 'orange' | 'red' => {
  if (progress > 0.95) return 'green';
  if (progress >= 0.85) return 'orange';
  return 'red';
};

const getAccentShadow = (accent: string) => `0 28px 64px -42px ${accent}55`;

const SimpleWeeklyTrendChart: React.FC<{ data: DailyCurvePoint[] }> = ({ data }) => {
  if (data.length === 0) {
    return <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-400">Aucune donnee</div>;
  }

  const width = 640;
  const height = 300;
  const padding = { top: 22, right: 20, bottom: 48, left: 58 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxValue = roundChartMax(Math.max(...data.flatMap((point) => [point.target, point.actual]), 0));
  const xStep = data.length > 1 ? plotWidth / (data.length - 1) : 0;
  const yTicks = Array.from({ length: 5 }, (_, index) => Math.round((maxValue / 4) * (4 - index)));

  const getX = (index: number) => padding.left + index * xStep;
  const getY = (value: number) => padding.top + plotHeight - (value / maxValue) * plotHeight;

  const targetPath = data
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${getX(index)} ${getY(point.target)}`)
    .join(' ');

  const actualSegments = data.slice(1).flatMap((point, index) => {
    const previous = data[index];
    const x1 = getX(index);
    const y1 = getY(previous.actual);
    const x2 = getX(index + 1);
    const y2 = getY(point.actual);
    const diff1 = previous.actual - previous.target;
    const diff2 = point.actual - point.target;
    const color1 = diff1 >= 0 ? '#1f9d55' : '#e11d48';
    const color2 = diff2 >= 0 ? '#1f9d55' : '#e11d48';

    if (diff1 === 0 && diff2 === 0) {
      return [{ key: `${previous.date}-${point.date}-flat`, x1, y1, x2, y2, color: '#1f9d55' }];
    }

    if ((diff1 >= 0 && diff2 >= 0) || (diff1 < 0 && diff2 < 0)) {
      return [{ key: `${previous.date}-${point.date}-single`, x1, y1, x2, y2, color: color2 }];
    }

    const ratio = Math.abs(diff1) / (Math.abs(diff1) + Math.abs(diff2));
    const midX = x1 + (x2 - x1) * ratio;
    const midY = y1 + (y2 - y1) * ratio;

    return [
      { key: `${previous.date}-${point.date}-a`, x1, y1, x2: midX, y2: midY, color: color1 },
      { key: `${previous.date}-${point.date}-b`, x1: midX, y1: midY, x2, y2, color: color2 },
    ];
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="img" aria-label="Courbe objectif et realise">
      {yTicks.map((tick) => {
        const y = getY(tick);
        return (
          <g key={`tick-${tick}`}>
            <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#d7e1eb" strokeDasharray="4 4" />
            <text x={padding.left - 12} y={y + 4} textAnchor="end" fontSize="11" fontWeight="800" fill="#64748b">
              {formatNumber(tick)}
            </text>
          </g>
        );
      })}

      <path d={targetPath} fill="none" stroke="#8091a7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

      {actualSegments.map((segment) => (
        <line
          key={segment.key}
          x1={segment.x1}
          y1={segment.y1}
          x2={segment.x2}
          y2={segment.y2}
          stroke={segment.color}
          strokeWidth="4.5"
          strokeLinecap="round"
        />
      ))}

      {data.map((point, index) => (
        <g key={point.date}>
          <text
            x={getX(index)}
            y={Math.max(getY(point.actual) - 12, padding.top + 12)}
            textAnchor="middle"
            fontSize="12"
            fontWeight="900"
            fill={point.status === 'green' ? '#1f9d55' : '#e11d48'}
            stroke="#ffffff"
            strokeWidth="4"
            paintOrder="stroke fill"
          >
            {formatNumber(point.actual)}
          </text>
          <circle
            cx={getX(index)}
            cy={getY(point.actual)}
            r="5"
            fill={point.status === 'green' ? '#1f9d55' : '#e11d48'}
            stroke="#ffffff"
            strokeWidth="2.5"
          />
          <text x={getX(index)} y={height - 14} textAnchor="middle" fontSize="11" fontWeight="800" fill="#475569">
            {point.dateLabel}
          </text>
        </g>
      ))}
    </svg>
  );
};

export const ExecutiveDailyDashboard: React.FC<ExecutiveDailyDashboardProps> = ({
  data,
  subComponentsData,
  availableDates,
  selectedDate,
}) => {
  const weeklyTargets = useStore((state) => state.weeklyTargets);
  const [selectedDepartmentByGroup, setSelectedDepartmentByGroup] = useState<Record<'SFG' | 'FG', string>>({
    SFG: 'ALL',
    FG: 'ALL',
  });
  const [presentationView, setPresentationView] = useState<null | { groupKey: 'SFG' | 'FG'; panel: 'overview' | 'bars' | 'trend' }>(null);

  React.useEffect(() => {
    if (!presentationView) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPresentationView(null);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [presentationView]);

  const injectionSeries = useMemo(() => {
    return availableDates
      .map((date) => {
        const mainItem = data.find((item) => item.department === 'Injection' && item.date === date);
        if (mainItem) return mainItem;

        const subRows = subComponentsData.filter((item) => item.date === date);
        if (subRows.length === 0) return null;

        const { weekKey, weekLabel } = getWeekMetadata(date);
        return {
          department: 'Injection',
          date,
          week: weekLabel,
          weekKey,
          target: subRows.reduce((sum, item) => sum + item.target, 0),
          weeklyTarget: subRows.reduce((sum, item) => sum + item.weeklyTarget, 0),
          actualProduction: subRows.reduce((sum, item) => sum + item.actualProduction, 0),
          conformQty: subRows.reduce((sum, item) => sum + item.conformQty, 0),
          scrapQty: subRows.reduce((sum, item) => sum + item.scrapQty, 0),
          progress: 0,
          gap: 0,
          scrapRate: 0,
          status: 'orange' as const,
        };
      })
      .filter(Boolean) as ProductionData[];
  }, [availableDates, data, subComponentsData]);

  const normalizedData = useMemo(() => {
    const items = new Map<string, ProductionData>();

    data
      .filter((item) => item.department !== 'Injection')
      .forEach((item) => items.set(`${item.department}-${item.date}`, item));

    injectionSeries.forEach((item) => items.set(`${item.department}-${item.date}`, item));

    return Array.from(items.values()).sort((a, b) => a.date.localeCompare(b.date) || a.department.localeCompare(b.department));
  }, [data, injectionSeries]);

  const activeDate = availableDates.includes(selectedDate)
    ? selectedDate
    : availableDates[availableDates.length - 1] ?? '';

  const getDepartmentSeries = (department: string) => normalizedData.filter((item) => item.department === department);

  const getDepartmentItemForDate = (department: string, date: string) =>
    getDepartmentSeries(department).find((item) => item.date === date);

  const getDepartmentWeekReferenceItem = (department: string, date: string) => {
    const exactItem = getDepartmentItemForDate(department, date);
    if (exactItem) return exactItem;

    const weekKey = getWeekMetadata(date).weekKey;
    return getDepartmentSeries(department).find((item) => item.weekKey === weekKey) ?? null;
  };

  const getDepartmentFallbackItem = (department: string, date: string) => {
    const series = getDepartmentSeries(department);
    if (series.length === 0) return null;

    const previousItems = series.filter((item) => item.date < date);
    if (previousItems.length > 0) {
      return previousItems[previousItems.length - 1];
    }

    return series[0] ?? null;
  };

  const getDailyTarget = (department: string, date: string) => {
    const weekKey = getWeekMetadata(date).weekKey;
    const importedWeeklyTarget = weeklyTargets[buildWeeklyTargetOverrideKey('department', department, weekKey)];
    if (importedWeeklyTarget && importedWeeklyTarget > 0) {
      return roundUnits(importedWeeklyTarget / WORKING_DAYS_PER_WEEK);
    }

    const referenceItem = getDepartmentWeekReferenceItem(department, date) ?? getDepartmentFallbackItem(department, date);
    if (!referenceItem) return 0;

    const weeklyTarget =
      weeklyTargets[buildWeeklyTargetOverrideKey('department', department, referenceItem.weekKey)] ??
      referenceItem.weeklyTarget;

    if (weeklyTarget > 0) return roundUnits(weeklyTarget / WORKING_DAYS_PER_WEEK);
    if (referenceItem.target > 0) return roundUnits(referenceItem.target);

    const previousTargetItem = getDepartmentSeries(department)
      .filter((item) => item.target > 0 && item.date <= date)
      .at(-1);
    return roundUnits(previousTargetItem?.target ?? 0);
  };

  const getDepartmentWeeklyTarget = (department: string, weekKey: string) => {
    const importedWeeklyTarget = weeklyTargets[buildWeeklyTargetOverrideKey('department', department, weekKey)];
    if (importedWeeklyTarget && importedWeeklyTarget > 0) {
      return roundUnits(importedWeeklyTarget);
    }

    const series = getDepartmentSeries(department);
    const weekReferenceItem = series.find((item) => item.weekKey === weekKey && item.weeklyTarget > 0);
    if (weekReferenceItem?.weeklyTarget) {
      return roundUnits(weekReferenceItem.weeklyTarget);
    }

    const fallbackItem = [...series]
      .reverse()
      .find((item) => item.weeklyTarget > 0 || item.target > 0);

    if (!fallbackItem) return 0;
    if (fallbackItem.weeklyTarget > 0) return roundUnits(fallbackItem.weeklyTarget);
    return roundUnits(fallbackItem.target * WORKING_DAYS_PER_WEEK);
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
  ) => {
    const metrics = group.departments.map((department) => metricGetter(department, date));

    return buildMetrics(
      metrics.reduce((sum, item) => sum + item.target, 0),
      metrics.reduce((sum, item) => sum + item.actual, 0),
      metrics.reduce((sum, item) => sum + item.conform, 0),
      metrics.reduce((sum, item) => sum + item.scrap, 0)
    );
  };

  const getDisplayedGroup = (group: GroupSnapshot): GroupSnapshot => {
    if (group.key === 'PLANT') return group;
    const selectedDepartment = selectedDepartmentByGroup[group.key];
    const departments =
      !selectedDepartment || selectedDepartment === 'ALL'
        ? group.departments
        : group.departments.filter((department) => department === selectedDepartment);

    return {
      ...group,
      departments,
      day: getGroupMetrics({ ...group, departments }, getDepartmentDailyMetrics, activeDate),
      cumulative: getGroupMetrics({ ...group, departments }, getDepartmentImportedMetrics, activeDate),
    };
  };

  const groupSnapshots: GroupSnapshot[] = GROUPS.map((group) => ({
    ...group,
    day: getGroupMetrics(group, getDepartmentDailyMetrics, activeDate),
    cumulative: getGroupMetrics(group, getDepartmentImportedMetrics, activeDate),
  }));

  const sfgGroup = groupSnapshots.find((group) => group.key === 'SFG') ?? {
    ...GROUPS[1],
    day: EMPTY_METRICS,
    cumulative: EMPTY_METRICS,
  };
  const fgGroup = groupSnapshots.find((group) => group.key === 'FG') ?? {
    ...GROUPS[2],
    day: EMPTY_METRICS,
    cumulative: EMPTY_METRICS,
  };

  const getMetricTextColor = (progress: number) => {
    const tone = getTone(progress);
    if (tone === 'green') return 'text-emerald-600';
    if (tone === 'orange') return 'text-amber-600';
    return 'text-rose-600';
  };
  const updateSelectedDepartment = (groupKey: 'SFG' | 'FG', department: string) => {
    startTransition(() =>
      setSelectedDepartmentByGroup((current) => ({
        ...current,
        [groupKey]: department,
      }))
    );
  };

  const renderDepartmentFilterCard = (
    baseGroup: GroupSnapshot,
    group: GroupSnapshot,
    groupKey: 'SFG' | 'FG',
    className = ''
  ) => {
    const selectedDepartment = selectedDepartmentByGroup[groupKey];
    const activeZones = selectedDepartment === 'ALL' ? baseGroup.departments.length : 1;
    const zoneLabel = activeZones > 1 ? 'zones' : 'zone';

    return (
      <div
        className={`rounded-[1.5rem] border border-slate-200 bg-white px-4 py-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.18)] sm:rounded-[1.7rem] sm:px-5 sm:py-5 ${className}`.trim()}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Choix departement</p>
            <h4 className="mt-2 text-lg font-black text-slate-950">Filtre</h4>
          </div>
          <span
            className="inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]"
            style={{ borderColor: `${group.accent}33`, color: group.accent, backgroundColor: `${group.accent}10` }}
          >
            {activeZones} {zoneLabel}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => updateSelectedDepartment(groupKey, 'ALL')}
            className={`rounded-full border px-3.5 py-2.5 text-xs font-black uppercase tracking-[0.08em] transition ${
              selectedDepartmentByGroup[groupKey] === 'ALL'
                ? 'text-white'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white'
            }`}
            style={
              selectedDepartmentByGroup[groupKey] === 'ALL'
                ? { borderColor: group.accent, backgroundColor: group.accent }
                : undefined
            }
          >
            Tout {baseGroup.key}
          </button>
          {baseGroup.departments.map((department) => {
            const isActive = selectedDepartmentByGroup[groupKey] === department;
            return (
              <button
                key={`${baseGroup.key}-${department}`}
                type="button"
                onClick={() => updateSelectedDepartment(groupKey, department)}
                className={`rounded-full border px-3.5 py-2.5 text-xs font-black uppercase tracking-[0.08em] transition ${
                  isActive
                    ? 'text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white'
                }`}
                style={isActive ? { borderColor: group.accent, backgroundColor: group.accent } : undefined}
              >
                {DEPARTMENT_LABELS[department] ?? department}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderInlineDepartmentFilter = (
    baseGroup: GroupSnapshot,
    group: GroupSnapshot,
    groupKey: 'SFG' | 'FG',
    compact = false
  ) => (
    <div
      className={`flex flex-wrap gap-2 ${compact ? 'mt-3' : 'mt-4'}`}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => updateSelectedDepartment(groupKey, 'ALL')}
        className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] transition ${
          selectedDepartmentByGroup[groupKey] === 'ALL'
            ? 'text-white'
            : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:bg-white'
        }`}
        style={
          selectedDepartmentByGroup[groupKey] === 'ALL'
            ? { borderColor: group.accent, backgroundColor: group.accent }
            : undefined
        }
      >
        Tout {baseGroup.key}
      </button>
      {baseGroup.departments.map((department) => {
        const isActive = selectedDepartmentByGroup[groupKey] === department;

        return (
          <button
            key={`${baseGroup.key}-${department}-inline`}
            type="button"
            onClick={() => updateSelectedDepartment(groupKey, department)}
            className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] transition ${
              isActive
                ? 'text-white'
                : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:bg-white'
            }`}
            style={isActive ? { borderColor: group.accent, backgroundColor: group.accent } : undefined}
          >
            {DEPARTMENT_LABELS[department] ?? department}
          </button>
        );
      })}
    </div>
  );

  const currentWeek = activeDate ? getWeekMetadata(activeDate) : null;
  const orderedWeekKeys = useMemo(() => {
    return Array.from(new Set(normalizedData.map((item) => item.weekKey))).sort();
  }, [normalizedData]);

  const visibleWeekKeys = useMemo(() => {
    if (orderedWeekKeys.length === 0) return [];
    const activeWeekKey = currentWeek?.weekKey;
    const activeIndex = activeWeekKey ? orderedWeekKeys.indexOf(activeWeekKey) : -1;
    const completedWeekKeys = activeIndex >= 0 ? orderedWeekKeys.slice(0, activeIndex) : orderedWeekKeys;
    return completedWeekKeys.slice(-5);
  }, [currentWeek?.weekKey, orderedWeekKeys]);

  const buildWeeklyTrendData = (group: GroupDefinition) =>
    !currentWeek?.weekStart
      ? []
      : Array.from({ length: 7 }, (_, index) => {
          const date = format(addDays(parseISO(currentWeek.weekStart), index), 'yyyy-MM-dd');
          if (date > activeDate) return null;
          const metrics = getGroupMetrics(group, getDepartmentDailyMetrics, date);

          return {
            day: WEEK_LABELS[index],
            target: metrics.target,
            actual: metrics.actual,
            date,
          };
        }).filter(Boolean) as Array<{ day: string; target: number; actual: number; date: string }>;

  const buildRecentWeekBars = (group: GroupDefinition) =>
    visibleWeekKeys.map((weekKey) => {
      const weekRows = normalizedData.filter((item) => item.weekKey === weekKey && group.departments.includes(item.department));
      const target = group.departments.reduce((sum, department) => sum + getDepartmentWeeklyTarget(department, weekKey), 0);
      const actual = weekRows.reduce((sum, item) => sum + item.actualProduction, 0);
      const progress = target > 0 ? actual / target : 0;
      const referenceDate = weekKey.split('__')[0];
      const weekMeta = getWeekMetadata(referenceDate);

      return {
        slot: `W${String(weekMeta.weekNumber).padStart(2, '0')}`,
        week: weekRows[0]?.week ?? weekMeta.weekLabel,
        rangeLabel: `${formatShortDate(weekMeta.weekStart)} - ${formatShortDate(weekMeta.weekEnd)}`,
        target,
        actual,
        progress,
        progressPercent: Number((progress * 100).toFixed(1)),
        percentLabel: formatRatioPercent(progress),
      };
    });

  if (availableDates.length === 0) return null;

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2 xl:gap-6">
        {[sfgGroup, fgGroup].map((baseGroup) => {
          const groupKey = baseGroup.key as 'SFG' | 'FG';
          const group = getDisplayedGroup(baseGroup);
          const selectedDepartment = selectedDepartmentByGroup[groupKey];
          const selectedDepartmentLabel =
            !selectedDepartment || selectedDepartment === 'ALL'
              ? `Tout ${baseGroup.key}`
              : DEPARTMENT_LABELS[selectedDepartment] ?? selectedDepartment;
          const activeZones = selectedDepartment === 'ALL' ? baseGroup.departments.length : 1;
          const conformTargetRate = getConformTargetRate(group.day);
          const isOverviewExpanded =
            presentationView?.groupKey === groupKey && presentationView.panel === 'overview';
          const overviewMetricCards = [
            {
              key: 'conformRate',
              label: 'QTE / OBJECTIF',
              value: formatPercent(conformTargetRate),
              tone: 'text-emerald-700',
              icon: ShieldCheck,
              iconClass: 'text-emerald-600',
              surfaceClass: 'border-emerald-200 bg-[linear-gradient(180deg,#ffffff_0%,#ecfdf5_100%)]',
            },
            {
              key: 'scrapRate',
              label: 'Rebut J-1',
              value: formatPercent(group.day.scrapRate),
              tone: 'text-rose-700',
              icon: TriangleAlert,
              iconClass: 'text-rose-600',
              surfaceClass: 'border-rose-200 bg-[linear-gradient(180deg,#ffffff_0%,#fff1f2_100%)]',
            },
            {
              key: 'conformQty',
              label: 'Qte Conforme',
              value: formatNumber(group.day.conform),
              tone: 'text-slate-950',
              icon: BadgeCheck,
              iconClass: 'text-slate-900',
              surfaceClass: 'border-slate-300 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]',
            },
            {
              key: 'scrapQty',
              label: 'Qte Rebut',
              value: formatNumber(group.day.scrap),
              tone: 'text-rose-700',
              surfaceClass: 'border-rose-200 bg-[linear-gradient(180deg,#ffffff_0%,#fff1f2_100%)]',
            },
          ];

          const renderOverviewPanel = (expanded = false) => (
            <div className={expanded ? 'p-2 sm:p-3' : 'p-3 sm:p-4'}>
              <div className="rounded-[1.6rem] border border-slate-200 bg-[linear-gradient(135deg,#f2fbfd_0%,#ffffff_48%,#f8fafc_100%)] p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.18)] sm:p-5">
                <div
                  className={`${
                    expanded ? 'cursor-default' : 'cursor-zoom-in hover:-translate-y-1 transition duration-300'
                  }`}
                  onClick={
                    expanded
                      ? undefined
                      : () => setPresentationView({ groupKey, panel: 'overview' })
                  }
                  role={expanded ? undefined : 'button'}
                  tabIndex={expanded ? undefined : 0}
                  onKeyDown={
                    expanded
                      ? undefined
                      : (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setPresentationView({ groupKey, panel: 'overview' });
                          }
                        }
                  }
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-white shadow-sm"
                          style={{ backgroundColor: group.accent }}
                        >
                          {group.alias}
                        </span>
                        <span className="inline-flex rounded-full border border-white/80 bg-white/88 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 shadow-sm">
                          {selectedDepartmentLabel}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-[1.9rem] font-black tracking-[-0.05em] text-slate-950 sm:text-[2.2rem]">
                            {group.title}
                          </h3>
                          <p className="mt-2 max-w-xl text-[13px] leading-6 text-slate-600">{baseGroup.subtitle}</p>
                        </div>
                        {!expanded ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setPresentationView({ groupKey, panel: 'overview' });
                            }}
                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white/88 text-slate-500 transition hover:border-slate-300 hover:bg-white hover:text-slate-800"
                            aria-label={`Agrandir ${group.title}`}
                          >
                            <Maximize2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="w-full xl:max-w-[28rem]">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Choix departement</p>
                          <h4 className="mt-1 text-lg font-black text-slate-950">Filtre</h4>
                        </div>
                        <span
                          className="inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]"
                          style={{ borderColor: `${group.accent}33`, color: group.accent, backgroundColor: `${group.accent}10` }}
                        >
                          {activeZones} {activeZones > 1 ? 'zones' : 'zone'}
                        </span>
                      </div>
                      {renderInlineDepartmentFilter(baseGroup, group, groupKey, true)}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-4">
                    {overviewMetricCards.map((card) => {
                      return (
                        <div
                          key={card.key}
                          className={`flex min-h-[7rem] flex-col justify-between rounded-[1.15rem] border px-4 py-3.5 shadow-[0_18px_34px_-26px_rgba(15,23,42,0.18)] ${card.surfaceClass}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-950 sm:text-xs">
                              {card.label}
                            </p>
                            {card.icon ? <card.icon className={`h-4 w-4 shrink-0 ${card.iconClass}`} /> : null}
                          </div>
                          <p className={`text-[1.95rem] font-black tracking-[-0.045em] sm:text-[2.15rem] ${card.tone}`}>
                            {card.value}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-3 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_18px_40px_-34px_rgba(15,23,42,0.16)] sm:mt-4 sm:rounded-[1.7rem]">
                <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] px-4 py-3 sm:px-5">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-700">Tableau unique</p>
                    <h4 className="mt-1 text-lg font-black text-slate-950">Conforme et rebut</h4>
                  </div>
                  <span
                    className="inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]"
                    style={{ borderColor: `${group.accent}33`, color: group.accent, backgroundColor: `${group.accent}10` }}
                  >
                    {selectedDepartmentLabel}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <div className={`${expanded ? 'min-w-[900px]' : 'min-w-[760px]'}`}>
                    <div className="grid grid-cols-[92px_repeat(6,minmax(0,1fr))] bg-slate-100 text-[11px] font-black uppercase tracking-[0.16em] text-slate-800">
                      <div className="px-4 py-2.5">Periode</div>
                      <div className="px-4 py-2.5">Objectif</div>
                      <div className="px-4 py-2.5">Qte totale</div>
                      <div className="px-4 py-2.5">Conforme</div>
                      <div className="px-4 py-2.5">Rebut</div>
                      <div className="px-4 py-2.5">% conforme</div>
                      <div className="px-4 py-2.5">% rebut</div>
                    </div>

                    {[
                      { label: 'J-1', metrics: group.day },
                      { label: 'Cumul', metrics: group.cumulative },
                    ].map((row) => (
                      <div
                        key={`${group.key}-${row.label}`}
                        className="grid grid-cols-[92px_repeat(6,minmax(0,1fr))] border-t border-slate-200 text-[15px] odd:bg-white even:bg-slate-50/70"
                      >
                        <div className="flex items-center px-4 py-3.5 text-base font-black text-slate-950">{row.label}</div>
                        <div className="px-4 py-3.5 font-black text-emerald-700">{formatNumber(row.metrics.target)}</div>
                        <div className="px-4 py-3.5 font-black text-slate-950">
                          {formatNumber(row.metrics.actual)}
                        </div>
                        <div className="px-4 py-3.5 font-black text-slate-950">
                          {formatNumber(row.metrics.conform)}
                        </div>
                        <div className="px-4 py-3.5 font-black text-rose-700">
                          {formatNumber(row.metrics.scrap)}
                        </div>
                        <div className="px-4 py-3.5">
                          <span
                            className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-black text-emerald-700"
                          >
                            {formatPercent(getConformTargetRate(row.metrics))}
                          </span>
                        </div>
                        <div className="px-4 py-3.5">
                          <span
                            className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-sm font-black text-rose-700"
                          >
                            {formatPercent(row.metrics.scrapRate)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );

          return (
            <article
              key={baseGroup.key}
              className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_20px_48px_-40px_rgba(18,48,71,0.3)]"
              style={{ boxShadow: getAccentShadow(group.accent) }}
            >
              {renderOverviewPanel()}

              {isOverviewExpanded ? (
                <div
                  className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/72 p-4 backdrop-blur-md"
                  onClick={() => setPresentationView(null)}
                >
                  <div
                    className="relative w-full max-w-[96rem] rounded-[2rem] border border-white/20 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbfd_100%)] p-4 shadow-[0_45px_140px_-48px_rgba(15,23,42,0.68)] sm:p-6"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setPresentationView(null)}
                        className="absolute right-2 top-2 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white/92 text-slate-500 transition hover:border-slate-300 hover:text-slate-900 sm:right-4 sm:top-4"
                        aria-label="Fermer le mode presentation"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    {renderOverviewPanel(true)}
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2 xl:gap-6">
        {[sfgGroup, fgGroup].map((baseGroup) => {
          const groupKey = baseGroup.key as 'SFG' | 'FG';
          const group = getDisplayedGroup(baseGroup);
          const trendData = buildWeeklyTrendData(group);
          const weekBarsData = buildRecentWeekBars(group);
          const activeWeekTarget = trendData.reduce((sum, item) => sum + item.target, 0);
          const activeWeekActual = trendData.reduce((sum, item) => sum + item.actual, 0);
          const activeWeekProgress = activeWeekTarget > 0 ? activeWeekActual / activeWeekTarget : 0;
          const dailyCurveData: DailyCurvePoint[] = trendData.map((entry) => ({
            ...entry,
            dateLabel: formatShortDate(entry.date),
            status: entry.actual >= entry.target ? 'green' : 'red',
          }));
          const currentWeekLabel = currentWeek
            ? `W${String(currentWeek.weekNumber).padStart(2, '0')}`
            : 'Semaine active';
          const currentWeekRange = currentWeek
            ? `${formatShortDate(currentWeek.weekStart)} - ${formatShortDate(currentWeek.weekEnd)}`
            : '';
          const visibleWeekTitle =
            weekBarsData.length > 0 ? weekBarsData.map((entry) => entry.slot).join(' ') : 'Aucune semaine';
          const isWeekBarsExpanded =
            presentationView?.groupKey === groupKey && presentationView.panel === 'bars';
          const isTrendExpanded =
            presentationView?.groupKey === groupKey && presentationView.panel === 'trend';

          const renderWeekBarsPanel = (expanded = false) => (
            <div
              className={`rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.18)] transition duration-300 ${
                expanded ? 'min-h-[36rem]' : 'cursor-zoom-in hover:-translate-y-1'
              }`}
              onClick={
                expanded
                  ? undefined
                  : () => setPresentationView({ groupKey, panel: 'bars' })
              }
              role={expanded ? undefined : 'button'}
              tabIndex={expanded ? undefined : 0}
              onKeyDown={
                expanded
                  ? undefined
                  : (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setPresentationView({ groupKey, panel: 'bars' });
                      }
                    }
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Semaines recentes</p>
                  <h4 className="mt-1 text-xl font-black tracking-[-0.03em] text-slate-950">{visibleWeekTitle}</h4>
                  {renderInlineDepartmentFilter(baseGroup, group, groupKey, true)}
                </div>
                {!expanded ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setPresentationView({ groupKey, panel: 'bars' });
                    }}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:border-slate-300 hover:bg-white hover:text-slate-800"
                    aria-label="Agrandir la vue des semaines recentes"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--dashboard-neutral-strong)]" />
                  Target
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  Realise bon
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                  Realise sous target
                </span>
              </div>
              <div className={`mt-4 ${expanded ? 'h-[28rem]' : 'h-[17rem]'}`}>
                <div className={`mx-auto h-full w-full ${expanded ? 'max-w-none' : 'max-w-[42rem]'}`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weekBarsData} margin={{ top: 18, right: 8, left: 0, bottom: 0 }} barGap={4} barCategoryGap="36%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--dashboard-grid)" />
                      <XAxis dataKey="slot" tick={{ fontSize: expanded ? 14 : 12, fill: '#475569' }} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={{ fontSize: expanded ? 14 : 12, fill: '#475569' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => formatNumber(Number(value))}
                      />
                      <RechartsTooltip
                        formatter={(value, name, payload) => {
                          const row = payload?.payload;
                          if (name === 'Target') return [formatNumber(Number(value)), `Perf ${row?.percentLabel ?? '-'}`];
                          return [formatNumber(Number(value)), `Perf ${row?.percentLabel ?? '-'}`];
                        }}
                        labelFormatter={(label, payload) => {
                          const week = payload?.[0]?.payload?.week;
                          const range = payload?.[0]?.payload?.rangeLabel;
                          return week ? `${label} - ${week}${range ? ` (${range})` : ''}` : label;
                        }}
                      />
                      <Bar dataKey="target" name="OBJ" fill="var(--dashboard-neutral-strong)" radius={[10, 10, 0, 0]} barSize={expanded ? 42 : 30} />
                      <Bar dataKey="actual" name="Realise" radius={[10, 10, 0, 0]} barSize={expanded ? 42 : 30}>
                        {weekBarsData.map((entry) => (
                          <Cell key={`${group.key}-${entry.slot}`} fill={getTone(entry.progress) === 'green' ? '#1f9d55' : getTone(entry.progress) === 'orange' ? '#f59e0b' : '#e11d48'} />
                        ))}
                        <LabelList
                          dataKey="percentLabel"
                          position="top"
                          className="fill-slate-700"
                          style={{ fontSize: expanded ? 15 : 13, fontWeight: 900 }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          );

          const renderTrendPanel = (expanded = false) => (
            <div
              className={`rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.18)] transition duration-300 ${
                expanded ? 'min-h-[38rem]' : 'cursor-zoom-in hover:-translate-y-1'
              }`}
              onClick={
                expanded
                  ? undefined
                  : () => setPresentationView({ groupKey, panel: 'trend' })
              }
              role={expanded ? undefined : 'button'}
              tabIndex={expanded ? undefined : 0}
              onKeyDown={
                expanded
                  ? undefined
                  : (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setPresentationView({ groupKey, panel: 'trend' });
                      }
                    }
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Courbe semaine active</p>
                  <h4 className="mt-1 text-xl font-black tracking-[-0.03em] text-slate-950">{currentWeekLabel} - Objectif et realise</h4>
                  <p className={`mt-2 text-base font-black ${getMetricTextColor(activeWeekProgress)}`}>
                    {activeWeekActual >= activeWeekTarget ? 'Sur target' : 'Sous target'} - {formatPercent(activeWeekProgress)}
                  </p>
                  {renderInlineDepartmentFilter(baseGroup, group, groupKey, true)}
                </div>
                {!expanded ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setPresentationView({ groupKey, panel: 'trend' });
                    }}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:border-slate-300 hover:bg-white hover:text-slate-800"
                    aria-label="Agrandir la courbe de la semaine active"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--dashboard-neutral-strong)]" />
                  Objectif
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  Point vert {'>='} target
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                  Point rouge {'<'} target
                </span>
              </div>
              <div className={`mt-5 ${expanded ? 'h-[30rem]' : 'h-[22rem]'}`}>
                <SimpleWeeklyTrendChart data={dailyCurveData} />
              </div>
            </div>
          );

          return (
            <article
              key={`${group.key}-curve`}
              className="rounded-[1.8rem] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-6"
              style={{ boxShadow: getAccentShadow(group.accent) }}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl p-3 text-white shadow-sm" style={{ backgroundColor: group.accent }}>
                    <LineChartIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Courbe de suivi</p>
                    <h3 className="mt-1 text-[2.2rem] font-black tracking-[-0.05em] text-slate-950">
                      {selectedDepartmentByGroup[groupKey] === 'ALL'
                        ? group.title
                        : DEPARTMENT_LABELS[selectedDepartmentByGroup[groupKey]] ?? selectedDepartmentByGroup[groupKey]}
                    </h3>
                  </div>
                </div>
              </div>

              <div
                className="mt-4 overflow-hidden rounded-[1.6rem] border border-slate-200 p-4 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.25)] sm:mt-5 sm:rounded-[1.8rem]"
                style={{ background: `linear-gradient(180deg,#ffffff 0%, ${group.softAccent} 100%)` }}
              >
                <div className="mb-4">
                  {renderDepartmentFilterCard(baseGroup, group, groupKey, 'border-white/70 bg-white/88 backdrop-blur-sm')}
                </div>

                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Lecture croquis</p>
                    <h4 className="mt-1 text-xl font-black tracking-[-0.03em] text-slate-950">{visibleWeekTitle} a gauche, {currentWeekLabel} a droite</h4>
                    <p className={`mt-2 text-base font-black ${getMetricTextColor(activeWeekProgress)}`}>
                      {activeWeekActual >= activeWeekTarget ? 'Sur target' : 'Sous target'} - {formatPercent(activeWeekProgress)}
                    </p>
                    {currentWeekRange ? <p className="mt-1 text-xs font-semibold text-slate-500">{currentWeekRange}</p> : null}
                  </div>

                  <div className="grid w-full max-w-[34rem] grid-cols-2 gap-3 sm:grid-cols-3 xl:w-auto xl:grid-cols-5">
                    {weekBarsData.map((entry) => (
                      <div
                        key={`${group.key}-${entry.slot}-summary`}
                        className="flex min-h-[5.2rem] flex-col justify-between rounded-2xl border border-slate-200 bg-white/92 px-4 py-3 text-center shadow-[0_16px_32px_-26px_rgba(15,23,42,0.24)]"
                      >
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{entry.slot}</p>
                        <p className={`mt-1 text-xl font-black tracking-[-0.03em] ${getMetricTextColor(entry.progress)}`}>{entry.percentLabel}</p>
                        <p className="mt-1 text-[11px] font-semibold text-slate-500">{entry.rangeLabel}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-5">
                  {renderWeekBarsPanel()}
                  {renderTrendPanel()}
                </div>
              </div>

              {isWeekBarsExpanded || isTrendExpanded ? (
                <div
                  className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/72 p-4 backdrop-blur-md"
                  onClick={() => setPresentationView(null)}
                >
                  <div
                    className="relative w-full max-w-[92rem] rounded-[2rem] border border-white/20 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbfd_100%)] p-4 shadow-[0_45px_140px_-48px_rgba(15,23,42,0.68)] sm:p-6"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setPresentationView(null)}
                        className="absolute right-2 top-2 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white/92 text-slate-500 transition hover:border-slate-300 hover:text-slate-900 sm:right-4 sm:top-4"
                        aria-label="Fermer le mode presentation"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    {isWeekBarsExpanded ? renderWeekBarsPanel(true) : renderTrendPanel(true)}
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </section>
    </div>
  );
};
