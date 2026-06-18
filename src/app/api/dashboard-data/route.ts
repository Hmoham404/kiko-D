import { NextResponse } from 'next/server';

import { clearDashboardSnapshot, loadDashboardSnapshot, persistDashboardSnapshot, replaceDashboardSnapshot } from '@/lib/dashboardDataService';
import type { DashboardSnapshot, ProductionData, SubComponentData } from '@/lib/dashboardTypes';

type ImportPayload = {
  productionData?: ProductionData[];
  subComponentsData?: SubComponentData[];
  weeklyTargets?: Record<string, number>;
  warnings?: string[];
};

const emptySnapshot: DashboardSnapshot = {
  productionData: [],
  subComponentsData: [],
  weeklyTargets: {},
  warnings: [],
};

const sanitizeWeeklyTargets = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [key, Number(entryValue ?? 0)])
  );
};

const sanitizeWarnings = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((warning) => String(warning)).filter(Boolean);
};

export async function GET() {
  try {
    const snapshot = await loadDashboardSnapshot();
    return NextResponse.json({ snapshot });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Chargement impossible.';
    return NextResponse.json({ snapshot: emptySnapshot, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ImportPayload;
    const snapshot = await persistDashboardSnapshot({
      productionData: Array.isArray(body.productionData) ? body.productionData : [],
      subComponentsData: Array.isArray(body.subComponentsData) ? body.subComponentsData : [],
      weeklyTargets: sanitizeWeeklyTargets(body.weeklyTargets),
      warnings: sanitizeWarnings(body.warnings),
    });

    return NextResponse.json({ snapshot });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sauvegarde impossible.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as ImportPayload;
    const snapshot = await replaceDashboardSnapshot({
      productionData: Array.isArray(body.productionData) ? body.productionData : [],
      subComponentsData: Array.isArray(body.subComponentsData) ? body.subComponentsData : [],
      weeklyTargets: sanitizeWeeklyTargets(body.weeklyTargets),
      warnings: sanitizeWarnings(body.warnings),
    });

    return NextResponse.json({ snapshot });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Resynchronisation impossible.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const snapshot = await clearDashboardSnapshot();
    return NextResponse.json({ snapshot });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Reset impossible.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
