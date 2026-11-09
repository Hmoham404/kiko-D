import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { ProductionData } from '@/lib/dashboardTypes';
import { getClientQuantities } from '@/lib/productionClients';

export const KIKO_PRODUCTION_PLAN = {
  startDate: '2026-10-26',
  total: 350_000,
  milestone: 265_000,
  deadline: '2026-12-19',
  dailyTarget: 10_500,
} as const;

export const getKikoPlanStatus = (conform: number, planned: number): 'neutral' | 'green' | 'orange' | 'red' => {
  if (planned <= 0) return 'neutral';
  if (conform > planned) return 'green';
  if (conform === planned) return 'orange';
  return 'red';
};

export const getKikoProductionProgress = (data: ProductionData[], asOfDate: string) => {
  const quantitiesByDate = new Map<string, number>();
  const workingDates = new Set<string>();
  for (const item of data) {
    if (item.department !== 'Assemblage' || item.date < KIKO_PRODUCTION_PLAN.startDate || item.date > asOfDate) continue;
    const hasKiko = item.clientBreakdown?.some((entry) => entry.client.trim().toUpperCase() === 'KIKO');
    if (!hasKiko) continue;
    const quantities = getClientQuantities(item, 'KIKO');
    quantitiesByDate.set(item.date, (quantitiesByDate.get(item.date) ?? 0) + quantities.conformQty);
    if (quantities.actualProduction > 0 || quantities.conformQty > 0 || quantities.scrapQty > 0) {
      workingDates.add(item.date);
    }
  }

  let cumulative = 0;
  let producedByDeadline = 0;
  let milestoneReachedOn: string | null = null;
  let totalReachedOn: string | null = null;
  let plannedCumulative = 0;
  const history: Array<{ date: string; quantity: number; cumulative: number; plannedCumulative: number }> = [];
  for (const [date, quantity] of Array.from(quantitiesByDate).sort(([left], [right]) => left.localeCompare(right))) {
    cumulative += quantity;
    if (workingDates.has(date)) plannedCumulative += KIKO_PRODUCTION_PLAN.dailyTarget;
    if (date <= KIKO_PRODUCTION_PLAN.deadline) producedByDeadline += quantity;
    if (!milestoneReachedOn && cumulative >= KIKO_PRODUCTION_PLAN.milestone) milestoneReachedOn = date;
    if (!totalReachedOn && cumulative >= KIKO_PRODUCTION_PLAN.total) totalReachedOn = date;
    history.push({ date, quantity, cumulative, plannedCumulative });
  }

  return {
    cumulative,
    plannedCumulative,
    workingDays: workingDates.size,
    variance: cumulative - plannedCumulative,
    planStatus: getKikoPlanStatus(cumulative, plannedCumulative),
    dailyQuantity: quantitiesByDate.get(asOfDate) ?? 0,
    producedByDeadline,
    totalProgress: cumulative / KIKO_PRODUCTION_PLAN.total,
    milestoneProgress: cumulative / KIKO_PRODUCTION_PLAN.milestone,
    remainingTotal: Math.max(0, KIKO_PRODUCTION_PLAN.total - cumulative),
    remainingMilestone: Math.max(0, KIKO_PRODUCTION_PLAN.milestone - cumulative),
    daysUntilDeadline: asOfDate
      ? Math.max(0, differenceInCalendarDays(parseISO(KIKO_PRODUCTION_PLAN.deadline), parseISO(asOfDate)))
      : 0,
    isPastDeadline: asOfDate > KIKO_PRODUCTION_PLAN.deadline,
    milestoneReachedOn,
    totalReachedOn,
    hasClientData: history.length > 0,
    history,
  };
};
