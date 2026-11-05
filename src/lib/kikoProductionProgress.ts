import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { ProductionData } from '@/lib/dashboardTypes';
import { getClientQuantities } from '@/lib/productionClients';

export const KIKO_PRODUCTION_PLAN = {
  startDate: '2026-10-26',
  total: 350_000,
  milestone: 265_000,
  deadline: '2026-12-19',
} as const;

export const getKikoProductionProgress = (data: ProductionData[], asOfDate: string) => {
  const quantitiesByDate = new Map<string, number>();
  for (const item of data) {
    if (item.department !== 'Assemblage' || item.date < KIKO_PRODUCTION_PLAN.startDate || item.date > asOfDate) continue;
    const hasKiko = item.clientBreakdown?.some((entry) => entry.client.trim().toUpperCase() === 'KIKO');
    if (!hasKiko) continue;
    const quantity = getClientQuantities(item, 'KIKO').actualProduction;
    quantitiesByDate.set(item.date, (quantitiesByDate.get(item.date) ?? 0) + quantity);
  }

  let cumulative = 0;
  let producedByDeadline = 0;
  let milestoneReachedOn: string | null = null;
  let totalReachedOn: string | null = null;
  const history: Array<{ date: string; quantity: number; cumulative: number }> = [];
  for (const [date, quantity] of Array.from(quantitiesByDate).sort(([left], [right]) => left.localeCompare(right))) {
    cumulative += quantity;
    if (date <= KIKO_PRODUCTION_PLAN.deadline) producedByDeadline += quantity;
    if (!milestoneReachedOn && cumulative >= KIKO_PRODUCTION_PLAN.milestone) milestoneReachedOn = date;
    if (!totalReachedOn && cumulative >= KIKO_PRODUCTION_PLAN.total) totalReachedOn = date;
    history.push({ date, quantity, cumulative });
  }

  return {
    cumulative,
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
