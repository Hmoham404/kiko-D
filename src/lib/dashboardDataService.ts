import 'server-only';

import { createHash } from 'node:crypto';
import type { ClientProductionData, DashboardSnapshot, ProductionData, ProductionStatus, SubComponentData } from '@/lib/dashboardTypes';
import { normalizeClientName } from '@/lib/productionClients';

type SupabaseMetadataRow = {
  meta_key: string;
  meta_value: unknown;
};

type SupabaseWeeklyTargetRow = {
  target_key: string;
  value: number;
};

type SupabaseProductionRow = {
  report_date: string;
  department: string;
  week_label: string;
  week_key: string;
  shift: string | null;
  part_number: string | null;
  machine: string | null;
  unit_of_production: string | null;
  target: number;
  weekly_target: number;
  actual_production: number;
  conform_qty: number;
  scrap_qty: number;
  progress: number;
  gap: number;
  scrap_rate: number;
  status: string;
};

type SupabaseSubComponentRow = {
  report_date: string;
  component: string;
  week_key: string;
  machine: string | null;
  reference: string | null;
  unit_of_production: string | null;
  cover_code: string | null;
  target: number;
  weekly_target: number;
  actual_production: number;
  conform_qty: number;
  scrap_qty: number;
  progress: number;
  gap: number;
  scrap_rate: number;
  status: string;
};

type PersistPayload = {
  productionData?: ProductionData[];
  subComponentsData?: SubComponentData[];
  weeklyTargets?: Record<string, number>;
  warnings?: string[];
};

const VALID_STATUSES: ProductionStatus[] = ['green', 'orange', 'red', 'critical'];
// Keep daily department totals in production_reports and the client detail in
// JSON metadata storage. Older databases use dashboard_snapshots instead.
const ASSEMBLY_CLIENTS_PREFIX = 'assembly_clients::';
const SNAPSHOT_METADATA_FILTER = '(meta_key.eq.warnings,meta_key.like.assembly_clients::*)';
const LEGACY_METADATA_KIND = 'production-dashboard-metadata';

const toNumber = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toInteger = (value: unknown) => Math.round(toNumber(value));

const normalizeSupabaseProjectUrl = (value: string) =>
  value
    .trim()
    .replace(/\/rest\/v1\/?$/i, '')
    .replace(/\/+$/g, '');

const getSupabaseConfig = () => {
  const rawUrl =
    process.env.SUPABASE_PROJECT_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.VITE_SUPABASE_URL ??
    '';
  const apiKey =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY ??
    '';

  if (!rawUrl || !apiKey) {
    throw new Error(
      'Configuration Supabase manquante. Definissez SUPABASE_PROJECT_URL et SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY), ou SUPABASE_PUBLISHABLE_KEY avec les policies RLS adequates, dans .env.local.'
    );
  }

  const projectUrl = normalizeSupabaseProjectUrl(rawUrl);
  return {
    restUrl: `${projectUrl}/rest/v1`,
    apiKey,
  };
};

const buildHeaders = (extraHeaders?: HeadersInit) => {
  const { apiKey } = getSupabaseConfig();
  const isJwtKey = apiKey.includes('.');

  return {
    apikey: apiKey,
    ...(isJwtKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
};

const fetchFromSupabase = async <T>(
  table: string,
  options?: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    query?: Record<string, string>;
    body?: unknown;
    headers?: HeadersInit;
  }
) => {
  const { restUrl } = getSupabaseConfig();
  const url = new URL(`${restUrl}/${table}`);

  Object.entries(options?.query ?? {}).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url, {
    method: options?.method ?? 'GET',
    headers: buildHeaders(options?.headers),
    body: options?.body === undefined ? undefined : JSON.stringify(options.body),
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase ${table} ${response.status}: ${errorText}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  const rawText = await response.text();

  if (!rawText.trim()) {
    return null as T;
  }

  try {
    return JSON.parse(rawText) as T;
  } catch {
    throw new Error(
      `Supabase ${table} a renvoye une reponse non JSON ou incomplete.`
    );
  }
};

const clearSupabaseTable = async (table: string, filter: Record<string, string>) => {
  await fetchFromSupabase<null>(table, {
    method: 'DELETE',
    query: filter,
    headers: { Prefer: 'return=minimal' },
  });
};

const normalizeStatus = (status: string): ProductionStatus =>
  VALID_STATUSES.includes(status as ProductionStatus) ? (status as ProductionStatus) : 'red';

const isMissingTableError = (error: unknown, tableName: string) => {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes('PGRST205') && error.message.includes(`'public.${tableName}'`);
};

const loadSnapshotMetadata = async (): Promise<SupabaseMetadataRow[]> => {
  try {
    return await fetchFromSupabase<SupabaseMetadataRow[]>('dashboard_metadata', {
      query: { select: 'meta_key,meta_value', or: SNAPSHOT_METADATA_FILTER },
    });
  } catch (error) {
    if (!isMissingTableError(error, 'dashboard_metadata')) throw error;
    try {
      const rows = await fetchFromSupabase<Array<{ payload: SupabaseMetadataRow }>>('dashboard_snapshots', {
        query: { select: 'payload', 'payload->>kind': `eq.${LEGACY_METADATA_KIND}` },
      });
      return rows.map((row) => row.payload);
    } catch (fallbackError) {
      if (isMissingTableError(fallbackError, 'dashboard_snapshots')) return [];
      throw fallbackError;
    }
  }
};

const persistSnapshotMetadata = async (rows: SupabaseMetadataRow[]) => {
  try {
    await fetchFromSupabase('dashboard_metadata', {
      method: 'POST',
      query: { on_conflict: 'meta_key' },
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: rows,
    });
  } catch (error) {
    if (!isMissingTableError(error, 'dashboard_metadata')) throw error;
    await fetchFromSupabase('dashboard_snapshots', {
      method: 'POST',
      query: { on_conflict: 'id' },
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: rows.map((row) => {
        // A stable UUID works with both text and UUID snapshot identifiers.
        // Each day has its own record; unrelated snapshots are untouched.
        const hash = createHash('sha256').update(`${LEGACY_METADATA_KIND}:${row.meta_key}`).digest('hex');
        const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-8${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
        return {
          id,
          payload: { kind: LEGACY_METADATA_KIND, ...row },
          updated_at: new Date().toISOString(),
        };
      }),
    });
  }
};

const clearSnapshotMetadata = async () => {
  try {
    await clearSupabaseTable('dashboard_metadata', { or: SNAPSHOT_METADATA_FILTER });
  } catch (error) {
    if (!isMissingTableError(error, 'dashboard_metadata')) throw error;
    try {
      await clearSupabaseTable('dashboard_snapshots', { 'payload->>kind': `eq.${LEGACY_METADATA_KIND}` });
    } catch (fallbackError) {
      if (!isMissingTableError(fallbackError, 'dashboard_snapshots')) throw fallbackError;
    }
  }
};

const mapProductionRowToItem = (row: SupabaseProductionRow): ProductionData => ({
  department: row.department,
  date: row.report_date,
  week: row.week_label,
  weekKey: row.week_key,
  shift: row.shift ?? undefined,
  partNumber: row.part_number ?? undefined,
  machine: row.machine ?? undefined,
  unitOfProduction: row.unit_of_production ?? undefined,
  target: toNumber(row.target),
  weeklyTarget: toInteger(row.weekly_target),
  actualProduction: toInteger(row.actual_production),
  conformQty: toInteger(row.conform_qty),
  scrapQty: toInteger(row.scrap_qty),
  progress: toNumber(row.progress),
  gap: toNumber(row.gap),
  scrapRate: toNumber(row.scrap_rate),
  status: normalizeStatus(row.status),
});

const mapSubComponentRowToItem = (row: SupabaseSubComponentRow): SubComponentData => ({
  component: row.component,
  date: row.report_date,
  weekKey: row.week_key,
  machine: row.machine ?? undefined,
  reference: row.reference ?? undefined,
  unitOfProduction: row.unit_of_production ?? undefined,
  coverCode: row.cover_code ?? undefined,
  target: toNumber(row.target),
  weeklyTarget: toInteger(row.weekly_target),
  actualProduction: toInteger(row.actual_production),
  conformQty: toInteger(row.conform_qty),
  scrapQty: toInteger(row.scrap_qty),
  progress: toNumber(row.progress),
  gap: toNumber(row.gap),
  scrapRate: toNumber(row.scrap_rate),
  status: row.status || 'red',
});

const mapProductionItemToRow = (item: ProductionData): SupabaseProductionRow => ({
  report_date: item.date,
  department: item.department,
  week_label: item.week,
  week_key: item.weekKey,
  shift: item.shift ?? null,
  part_number: item.partNumber ?? null,
  machine: item.machine ?? null,
  unit_of_production: item.unitOfProduction ?? null,
  target: toInteger(item.target),
  weekly_target: toInteger(item.weeklyTarget),
  actual_production: toInteger(item.actualProduction),
  conform_qty: toInteger(item.conformQty),
  scrap_qty: toInteger(item.scrapQty),
  progress: toNumber(item.progress),
  gap: toNumber(item.gap),
  scrap_rate: toNumber(item.scrapRate),
  status: normalizeStatus(item.status),
});

const mapSubComponentItemToRow = (item: SubComponentData): SupabaseSubComponentRow => ({
  report_date: item.date,
  component: item.component,
  week_key: item.weekKey,
  machine: item.machine ?? null,
  reference: item.reference ?? null,
  unit_of_production: item.unitOfProduction ?? null,
  cover_code: item.coverCode ?? null,
  target: toInteger(item.target),
  weekly_target: toInteger(item.weeklyTarget),
  actual_production: toInteger(item.actualProduction),
  conform_qty: toInteger(item.conformQty),
  scrap_qty: toInteger(item.scrapQty),
  progress: toNumber(item.progress),
  gap: toNumber(item.gap),
  scrap_rate: toNumber(item.scrapRate),
  status: String(item.status || 'red'),
});

const parseWarnings = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((warning) => String(warning)).filter(Boolean);
};

const parseClientBreakdown = (value: unknown): ClientProductionData[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => entry && typeof entry === 'object').map((entry) => ({
    client: normalizeClientName(entry.client),
    actualProduction: toInteger(entry.actualProduction),
    conformQty: toInteger(entry.conformQty),
    scrapQty: toInteger(entry.scrapQty),
  }));
};

export const loadDashboardSnapshot = async (): Promise<DashboardSnapshot> => {
  const [productionRows, subComponentRows, weeklyTargetRows, metadataRows] = await Promise.all([
    fetchFromSupabase<SupabaseProductionRow[]>('production_reports', {
      query: { select: '*' },
    }),
    fetchFromSupabase<SupabaseSubComponentRow[]>('sub_component_reports', {
      query: { select: '*' },
    }),
    fetchFromSupabase<SupabaseWeeklyTargetRow[]>('weekly_targets', {
      query: { select: 'target_key,value' },
    }),
    loadSnapshotMetadata(),
  ]);

  const metadata = new Map(metadataRows.map((row) => [row.meta_key, row.meta_value]));
  const productionData = productionRows
    .map(mapProductionRowToItem)
    .map((item) => {
      const detail = metadata.get(`${ASSEMBLY_CLIENTS_PREFIX}${item.date}`);
      return item.department === 'Assemblage' && detail !== undefined
        ? { ...item, clientBreakdown: parseClientBreakdown(detail) }
        : item;
    })
    .sort((left, right) => left.date.localeCompare(right.date) || left.department.localeCompare(right.department));
  const subComponentsData = subComponentRows
    .map(mapSubComponentRowToItem)
    .sort((left, right) => left.date.localeCompare(right.date) || left.component.localeCompare(right.component));
  const weeklyTargets = Object.fromEntries(
    weeklyTargetRows.map((row) => [row.target_key, toNumber(row.value)])
  );
  const warnings = parseWarnings(metadata.get('warnings'));

  return {
    productionData,
    subComponentsData,
    weeklyTargets,
    warnings,
  };
};

export const persistDashboardSnapshot = async (payload: PersistPayload) => {
  const writes: Array<Promise<unknown>> = [];
  const assemblyItems = payload.productionData?.filter((item) => item.department === 'Assemblage') ?? [];
  const metadataRows: SupabaseMetadataRow[] = assemblyItems.map((item) => ({
    meta_key: `${ASSEMBLY_CLIENTS_PREFIX}${item.date}`,
    meta_value: parseClientBreakdown(item.clientBreakdown),
  }));
  if (payload.warnings) {
    metadataRows.push({ meta_key: 'warnings', meta_value: payload.warnings });
  }
  if (metadataRows.length > 0) {
    // Do not import totals if the corresponding client detail cannot be saved.
    await persistSnapshotMetadata(metadataRows);
  }

  if (payload.productionData && payload.productionData.length > 0) {
    writes.push(
      fetchFromSupabase('production_reports', {
        method: 'POST',
        query: { on_conflict: 'report_date,department' },
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: payload.productionData.map(mapProductionItemToRow),
      })
    );
  }

  if (payload.subComponentsData && payload.subComponentsData.length > 0) {
    writes.push(
      fetchFromSupabase('sub_component_reports', {
        method: 'POST',
        query: { on_conflict: 'report_date,component' },
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: payload.subComponentsData.map(mapSubComponentItemToRow),
      })
    );
  }

  if (payload.weeklyTargets && Object.keys(payload.weeklyTargets).length > 0) {
    writes.push(
      fetchFromSupabase('weekly_targets', {
        method: 'POST',
        query: { on_conflict: 'target_key' },
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: Object.entries(payload.weeklyTargets).map(([target_key, value]) => ({
          target_key,
          value: toInteger(value),
        })),
      })
    );
  }

  await Promise.all(writes);
  return loadDashboardSnapshot();
};

export const replaceDashboardSnapshot = async (payload: PersistPayload) => {
  await Promise.all([
    clearSupabaseTable('production_reports', { id: 'not.is.null' }),
    clearSupabaseTable('sub_component_reports', { id: 'not.is.null' }),
    clearSupabaseTable('weekly_targets', { id: 'not.is.null' }),
    clearSnapshotMetadata(),
  ]);

  return persistDashboardSnapshot(payload);
};

export const clearDashboardSnapshot = async () => {
  await Promise.all([
    clearSupabaseTable('production_reports', { id: 'not.is.null' }),
    clearSupabaseTable('sub_component_reports', { id: 'not.is.null' }),
    clearSupabaseTable('weekly_targets', { id: 'not.is.null' }),
    clearSnapshotMetadata(),
  ]);

  return {
    productionData: [],
    subComponentsData: [],
    weeklyTargets: {},
    warnings: [],
  } satisfies DashboardSnapshot;
};
