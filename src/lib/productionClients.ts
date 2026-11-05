import type { ClientProductionData, ProductionData } from '@/lib/dashboardTypes';

export const normalizeClientName = (value: unknown) =>
  String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleUpperCase('fr-FR');

export const getClientQuantities = (
  item: ProductionData,
  client: string | null
): Pick<ClientProductionData, 'actualProduction' | 'conformQty' | 'scrapQty'> => {
  if (client === null) return item;

  // Older imports have no client information and belong to "Non renseigné".
  if (!item.clientBreakdown?.length) {
    return client === '' ? item : { actualProduction: 0, conformQty: 0, scrapQty: 0 };
  }

  return item.clientBreakdown
    .filter((entry) => normalizeClientName(entry.client) === client)
    .reduce(
      (total, entry) => ({
        actualProduction: total.actualProduction + entry.actualProduction,
        conformQty: total.conformQty + entry.conformQty,
        scrapQty: total.scrapQty + entry.scrapQty,
      }),
      { actualProduction: 0, conformQty: 0, scrapQty: 0 }
    );
};

export const getAssemblyClients = (data: ProductionData[]) => {
  const clients = new Set<string>();
  data.filter((item) => item.department === 'Assemblage').forEach((item) => {
    if (!item.clientBreakdown?.length) {
      clients.add('');
    } else {
      item.clientBreakdown.forEach((entry) => clients.add(normalizeClientName(entry.client)));
    }
  });
  return Array.from(clients).sort((left, right) =>
    left === '' ? 1 : right === '' ? -1 : left.localeCompare(right, 'fr')
  );
};
