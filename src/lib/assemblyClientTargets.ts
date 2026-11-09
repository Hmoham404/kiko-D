import type { ProductionData } from '@/lib/dashboardTypes';
import { getAssemblyClients, normalizeClientName } from '@/lib/productionClients';
import { buildWeeklyTargetOverrideKey, getWeekMetadata } from '@/lib/weeklyMetrics';

const CLIENT_TARGET_PREFIX = 'assembly-client::';
export const ASSEMBLY_WORKING_DAYS_PER_WEEK = 6;

export const buildAssemblyClientTargetKey = (client: string, weekKey: string) =>
  `${CLIENT_TARGET_PREFIX}${encodeURIComponent(normalizeClientName(client))}::${weekKey}`;

export const getAssemblyClientTarget = (targets: Record<string, number>, client: string, weekKey: string) =>
  targets[buildAssemblyClientTargetKey(client, weekKey)];

export const getAssemblyWeeklyTotal = (data: ProductionData[], targets: Record<string, number>, weekKey: string) =>
  targets[buildWeeklyTargetOverrideKey('department', 'Assemblage', weekKey)] ??
  data.find((item) => item.department === 'Assemblage' && item.weekKey === weekKey)?.weeklyTarget ?? 0;

export const getAssemblyTargetClients = (data: ProductionData[], targets: Record<string, number>, weekKey: string) => {
  const clients = new Set(getAssemblyClients(data.filter((item) => item.weekKey === weekKey)));
  for (const key of Object.keys(targets)) {
    if (!key.startsWith(CLIENT_TARGET_PREFIX) || !key.endsWith(`::${weekKey}`)) continue;
    try {
      clients.add(decodeURIComponent(key.slice(CLIENT_TARGET_PREFIX.length, -(`::${weekKey}`).length)));
    } catch { /* Ignore unrelated, malformed legacy keys. */ }
  }
  return Array.from(clients).sort((a, b) => a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'fr'));
};

export const getAssemblyTargetWeeks = (data: ProductionData[], targets: Record<string, number>) => {
  const weeks = new Set(data.filter((item) => item.department === 'Assemblage').map((item) => item.weekKey));
  const departmentPrefix = buildWeeklyTargetOverrideKey('department', 'Assemblage', '');
  for (const key of Object.keys(targets)) {
    if (key.startsWith(departmentPrefix)) weeks.add(key.slice(departmentPrefix.length));
    if (key.startsWith(CLIENT_TARGET_PREFIX)) weeks.add(key.slice(key.lastIndexOf('::') + 2));
  }
  return Array.from(weeks).filter((week) => /^\d{4}-\d{2}-\d{2}__\d{4}-\d{2}-\d{2}$/.test(week)).sort();
};

export const validateAssemblyClientAllocation = (
  data: ProductionData[],
  targets: Record<string, number>,
  weekKey: string,
  allocations: Array<{ client: string; target: number }>,
  weeklyTotal?: number,
) => {
  if (!/^\d{4}-\d{2}-\d{2}__\d{4}-\d{2}-\d{2}$/.test(weekKey) ||
      getWeekMetadata(weekKey.split('__')[0]).weekKey !== weekKey) {
    throw new Error('Semaine invalide.');
  }
  const expectedClients = getAssemblyTargetClients(data, targets, weekKey);
  if (expectedClients.length === 0) throw new Error('Importez les données Assemblage de cette semaine avant de répartir les objectifs.');
  const clients = allocations.map((entry) => normalizeClientName(entry.client));
  if (new Set(clients).size !== clients.length || clients.length !== expectedClients.length ||
      expectedClients.some((client) => !clients.includes(client))) {
    throw new Error('Renseignez une seule fois chaque client de la semaine.');
  }
  if (allocations.some((entry) => !Number.isSafeInteger(entry.target) || entry.target < 0)) {
    throw new Error('Chaque objectif doit être un nombre entier positif ou nul.');
  }
  const total = weeklyTotal ?? getAssemblyWeeklyTotal(data, targets, weekKey);
  if (!Number.isSafeInteger(total) || total < 0) {
    throw new Error('Le total hebdomadaire doit être un nombre entier positif ou nul.');
  }
  if (allocations.reduce((sum, entry) => sum + entry.target, 0) !== total) {
    throw new Error('La somme des objectifs clients doit être égale au total Assemblage de la semaine.');
  }
  return {
    ...Object.fromEntries(allocations.map((entry) => [buildAssemblyClientTargetKey(entry.client, weekKey), entry.target])),
    ...(weeklyTotal === undefined ? {} : { [buildWeeklyTargetOverrideKey('department', 'Assemblage', weekKey)]: weeklyTotal }),
  };
};
