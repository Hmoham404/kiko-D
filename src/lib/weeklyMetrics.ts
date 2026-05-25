import { addDays, format, getISOWeek, getISOWeekYear, parseISO, startOfWeek } from 'date-fns';

type WeeklyItem = {
  date: string;
  weekKey: string;
  weeklyTarget?: number;
  actualProduction: number;
  conformQty: number;
  scrapQty: number;
};

export type WeeklyTargetScope = 'department' | 'component';
export type WeeklyTargetOverrides = Record<string, number>;

export const getWeekMetadata = (dateStr: string) => {
  try {
    const date = parseISO(dateStr);
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 5);
    const weekNumber = getISOWeek(weekStart);
    const weekYear = getISOWeekYear(weekStart);
    return {
      weekKey: `${format(weekStart, 'yyyy-MM-dd')}__${format(weekEnd, 'yyyy-MM-dd')}`,
      weekLabel: `W${String(weekNumber).padStart(2, '0')} ${format(weekStart, 'dd/MM')} - ${format(weekEnd, 'dd/MM')}`,
      weekStart: format(weekStart, 'yyyy-MM-dd'),
      weekEnd: format(weekEnd, 'yyyy-MM-dd'),
      weekNumber,
      weekYear,
    };
  } catch {
    return {
      weekKey: 'unknown-week',
      weekLabel: 'W--',
      weekStart: '',
      weekEnd: '',
      weekNumber: 0,
      weekYear: 0,
    };
  }
};

export const buildWeeklyTargetOverrideKey = (scope: WeeklyTargetScope, entity: string, weekKey: string) => {
  return `${scope}::${entity}::${weekKey}`;
};

export const getWeeklyTargetOverride = (
  overrides: WeeklyTargetOverrides,
  scope: WeeklyTargetScope,
  entity: string,
  weekKey: string
) => {
  return overrides[buildWeeklyTargetOverrideKey(scope, entity, weekKey)];
};

export const sumWeeklyTargets = <T extends { weekKey: string; weeklyTarget?: number }>(
  items: T[],
  scopeKey: (item: T) => string = () => 'global',
  targetValue: (item: T) => number = (item) => item.weeklyTarget ?? 0
) => {
  const seen = new Set<string>();

  return items.reduce((sum, item) => {
    const weeklyTarget = targetValue(item);
    const key = `${scopeKey(item)}::${item.weekKey}`;

    if (weeklyTarget <= 0 || seen.has(key)) {
      return sum;
    }

    seen.add(key);
    return sum + weeklyTarget;
  }, 0);
};

export const getWeekTargetForItems = <T extends { weeklyTarget?: number }>(
  items: T[],
  targetValue: (item: T) => number = (item) => item.weeklyTarget ?? 0
) => {
  const referenceItem = items.find((item) => targetValue(item) > 0);
  return referenceItem ? targetValue(referenceItem) : 0;
};

export const getWeeklyCumulativeMetrics = <T extends WeeklyItem>(
  items: T[],
  date: string,
  targetValue: (item: T) => number = (item) => item.weeklyTarget ?? 0
) => {
  const fallbackWeek = getWeekMetadata(date).weekKey;
  const referenceItem = items.find((item) => item.date === date);
  const weekKey = referenceItem?.weekKey ?? fallbackWeek;
  const weekItems = items.filter((item) => item.weekKey === weekKey);
  const weeklyTarget = getWeekTargetForItems(weekItems, targetValue);
  const itemsUpToDate = weekItems.filter((item) => item.date <= date);
  const actualProduction = itemsUpToDate.reduce((sum, item) => sum + item.actualProduction, 0);
  const conformQty = itemsUpToDate.reduce((sum, item) => sum + item.conformQty, 0);
  const scrapQty = itemsUpToDate.reduce((sum, item) => sum + item.scrapQty, 0);
  const progress = weeklyTarget > 0 ? conformQty / weeklyTarget : 0;
  const gap = weeklyTarget - conformQty;
  const scrapRate = actualProduction > 0 ? scrapQty / actualProduction : 0;

  return {
    weekKey,
    weeklyTarget,
    actualProduction,
    conformQty,
    scrapQty,
    progress,
    gap,
    scrapRate,
  };
};
