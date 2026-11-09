import { NextResponse } from 'next/server';
import { validateAssemblyClientAllocation } from '@/lib/assemblyClientTargets';
import { loadDashboardSnapshot, persistDashboardSnapshot } from '@/lib/dashboardDataService';

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Requête JSON invalide.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || !('weekKey' in body) || typeof body.weekKey !== 'string' ||
      !('allocations' in body) || !Array.isArray(body.allocations) ||
      ('weeklyTotal' in body && typeof body.weeklyTotal !== 'number') ||
      body.allocations.some((entry: unknown) => !entry || typeof entry !== 'object' ||
        !('client' in entry) || typeof entry.client !== 'string' || !('target' in entry) || typeof entry.target !== 'number')) {
    return NextResponse.json({ error: 'Semaine et objectifs clients requis.' }, { status: 400 });
  }
  try {
    const current = await loadDashboardSnapshot();
    let entries: Record<string, number>;
    try {
      entries = validateAssemblyClientAllocation(current.productionData, current.weeklyTargets, body.weekKey, body.allocations,
        'weeklyTotal' in body ? body.weeklyTotal as number : undefined);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Répartition invalide.' }, { status: 400 });
    }
    const snapshot = await persistDashboardSnapshot({ weeklyTargets: entries });
    return NextResponse.json({ weeklyTargets: snapshot.weeklyTargets });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Sauvegarde impossible.' }, { status: 500 });
  }
}
