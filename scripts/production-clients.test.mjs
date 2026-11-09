import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as XLSX from 'xlsx';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const resolveDependency = createRequire(import.meta.url);
const projectRoot = fileURLToPath(new URL('..', import.meta.url));

// Run the project's TypeScript directly without adding a test dependency.
function loadSource(relativePath, globals = {}, cache = new Map()) {
  const filename = path.resolve(projectRoot, relativePath);
  if (cache.has(filename)) return cache.get(filename).exports;
  const loadedModule = { exports: {} };
  cache.set(filename, loadedModule);
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const localRequire = (id) => {
    if (globals.modules && Object.hasOwn(globals.modules, id)) return globals.modules[id];
    if (id === 'server-only') return {};
    if (id.startsWith('@/')) return loadSource(`src/${id.slice(2)}.ts`, globals, cache);
    return resolveDependency(id);
  };
  new Function('require', 'module', 'exports', 'fetch', 'FileReader', code)(
    localRequire, loadedModule, loadedModule.exports, globals.fetch, globals.FileReader
  );
  return loadedModule.exports;
}

class WorkbookReader {
  readAsBinaryString(file) {
    this.onload({ target: { result: file.binary } });
  }
}

function workbookFile(rows, merges = []) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!merges'] = merges;
  XLSX.utils.book_append_sheet(workbook, sheet, 'Daily Prod');
  return { name: 'Assemblage.xlsx', binary: XLSX.write(workbook, { type: 'binary', bookType: 'xlsx' }) };
}

const headers = ['Date', 'Client', 'Produced Qty', 'Conforme Qty', 'Scrap Qty'];
const { parseExcelFile } = loadSource('src/lib/excelParser.ts', { FileReader: WorkbookReader });
const { getAssemblyClients, getClientQuantities } = loadSource('src/lib/productionClients.ts');
const { getKikoProductionProgress, getKikoPlanStatus } = loadSource('src/lib/kikoProductionProgress.ts');
const {
  buildAssemblyClientTargetKey, getAssemblyClientTarget, getAssemblyWeeklyTotal,
  getAssemblyTargetClients, getAssemblyTargetWeeks, validateAssemblyClientAllocation,
} = loadSource('src/lib/assemblyClientTargets.ts');
const { buildWeeklyTargetOverrideKey, getWeekMetadata } = loadSource('src/lib/weeklyMetrics.ts');

test('Assembly client targets: exact weekly allocation, normalized client keys, explicit zero, and no cross-week fallback', () => {
  const week = getWeekMetadata('2026-11-05').weekKey;
  const nextWeek = getWeekMetadata('2026-11-09').weekKey;
  const data = [
    { ...productionDay('2026-11-05', 100), weekKey: week, weeklyTarget: 50000 },
    { ...productionDay('2026-11-05', 200, 'Assemblage', 'YZA'), weekKey: week, weeklyTarget: 50000 },
    { ...productionDay('2026-11-09', 100, 'Assemblage', 'OTHER'), weekKey: nextWeek, weeklyTarget: 80000 },
  ];
  const totals = { [buildWeeklyTargetOverrideKey('department', 'Assemblage', week)]: 60000 };
  const entries = validateAssemblyClientAllocation(data, totals, week, [{ client: ' kiko ', target: 42000 }, { client: 'YZA', target: 18000 }]);
  assert.equal(getAssemblyWeeklyTotal(data, totals, week), 60000);
  assert.equal(getAssemblyClientTarget(entries, 'KIKO', week), 42000);
  assert.equal(getAssemblyClientTarget(entries, 'YZA', week), 18000);
  assert.equal(getAssemblyClientTarget(entries, 'KIKO', nextWeek), undefined);
  assert.equal(getAssemblyClientTarget(entries, 'OTHER', week), undefined);
  assert.deepEqual(getAssemblyTargetClients(data, entries, week), ['KIKO', 'YZA']);
  assert.deepEqual(getAssemblyTargetWeeks(data, entries), [week, nextWeek]);
  const zero = validateAssemblyClientAllocation(data, totals, week, [{ client: 'KIKO', target: 0 }, { client: 'YZA', target: 60000 }]);
  assert.equal(getAssemblyClientTarget(zero, 'KIKO', week), 0);
  assert.equal(getAssemblyWeeklyTotal(data, { ...totals, [buildWeeklyTargetOverrideKey('department', 'Assemblage', week)]: 0 }, week), 0);
  assert.equal(getAssemblyWeeklyTotal(data, {}, week), 50000);
  assert.notEqual(buildAssemblyClientTargetKey('A::B', week), buildAssemblyClientTargetKey('A', `B::${week}`));
  for (const allocations of [
    [{ client: 'KIKO', target: 60000 }],
    [{ client: 'KIKO', target: 30000 }, { client: ' kiko ', target: 30000 }],
    [{ client: 'KIKO', target: 30000 }, { client: 'UNKNOWN', target: 30000 }],
    [{ client: 'KIKO', target: 41999 }, { client: 'YZA', target: 18000 }],
    [{ client: 'KIKO', target: 42001 }, { client: 'YZA', target: 18000 }],
    [{ client: 'KIKO', target: -1 }, { client: 'YZA', target: 60001 }],
    [{ client: 'KIKO', target: 30000.5 }, { client: 'YZA', target: 29999.5 }],
  ]) assert.throws(() => validateAssemblyClientAllocation(data, totals, week, allocations));
  assert.throws(() => validateAssemblyClientAllocation(data, totals, '2026-11-03__2026-11-08', []), /Semaine invalide/);
  const unassigned = [{ ...productionDay('2026-11-05', 100), weekKey: week, weeklyTarget: 100, clientBreakdown: undefined }];
  assert.deepEqual(getAssemblyTargetClients(unassigned, {}, week), ['']);
  assert.equal(getAssemblyClientTarget(validateAssemblyClientAllocation(unassigned, {}, week, [{client: '', target: 100}]), '', week), 100);
  // Saved plans still participate when a later reimport removes that client's production rows.
  assert.deepEqual(getAssemblyTargetClients(data.filter((row) => row.clientBreakdown[0].client !== 'YZA'), entries, week), ['KIKO', 'YZA']);
});

test('Assembly target API: reject invalid totals before writing, then save only the selected week', async () => {
  const week = getWeekMetadata('2026-11-05').weekKey;
  const snapshot = { productionData: [{ ...productionDay('2026-11-05', 100), weekKey: week, weeklyTarget: 600 }], subComponentsData: [], weeklyTargets: {}, warnings: ['keep'] };
  let writes = 0;
  const { POST } = loadSource('src/app/api/assembly-client-targets/route.ts', { modules: {
    '@/lib/dashboardDataService': {
      loadDashboardSnapshot: async () => snapshot,
      persistDashboardSnapshot: async (payload) => {
        writes++;
        assert.deepEqual(Object.keys(payload), ['weeklyTargets']);
        Object.assign(snapshot.weeklyTargets, payload.weeklyTargets);
        return snapshot;
      },
    },
  } });
  const request = (body) => new Request('http://localhost/api/assembly-client-targets', {method:'POST', body: JSON.stringify(body)});
  for (const body of [null, {}, {weekKey:week, allocations:[{client:'KIKO', target:'600'}]}, {weekKey:week, allocations:[{client:'KIKO', target:599}]}]) {
    assert.equal((await POST(request(body))).status, 400);
  }
  assert.equal(writes, 0);
  const response = await POST(request({weekKey:week, allocations:[{client:'KIKO', target:600}]}));
  assert.equal(response.status, 200);
  assert.equal(writes, 1);
  assert.equal(getAssemblyClientTarget((await response.json()).weeklyTargets, 'KIKO', week), 600);
  // A new total imported meanwhile is checked against the server state.
  snapshot.weeklyTargets[buildWeeklyTargetOverrideKey('department', 'Assemblage', week)] = 700;
  assert.equal((await POST(request({weekKey:week, allocations:[{client:'KIKO', target:600}]}))).status, 400);
  assert.equal(writes, 1);
  const adjustment = await POST(request({weekKey:week, weeklyTotal:63000, allocations:[{client:'KIKO', target:63000}]}));
  assert.equal(adjustment.status, 200);
  const adjusted = (await adjustment.json()).weeklyTargets;
  assert.equal(adjusted[buildWeeklyTargetOverrideKey('department', 'Assemblage', week)], 63000);
  assert.equal(getAssemblyClientTarget(adjusted, 'KIKO', week), 63000);
  assert.equal(writes, 2);
  for (const weeklyTotal of [-1, 63000.5, '63000']) {
    assert.equal((await POST(request({weekKey:week, weeklyTotal, allocations:[{client:'KIKO', target:63000}]}))).status, 400);
  }
  assert.equal(writes, 2);
});

test('Assembly W45: CT zero and KIKO 10500 per day revise the weekly total together', () => {
  const week = getWeekMetadata('2026-11-05').weekKey;
  const data = [
    { ...productionDay('2026-11-05', 100, 'Assemblage', 'KIKO'), weekKey:week, weeklyTarget:98340 },
    { ...productionDay('2026-11-05', 100, 'Assemblage', 'CT'), weekKey:week, weeklyTarget:98340 },
  ];
  const totals = { [buildWeeklyTargetOverrideKey('department', 'Assemblage', week)]:98340 };
  const allocations = [{client:'CT', target:0}, {client:'KIKO', target:10500 * 6}];
  assert.throws(() => validateAssemblyClientAllocation(data, totals, week, allocations), /somme/);
  const entries = validateAssemblyClientAllocation(data, totals, week, allocations, 63000);
  assert.equal(getAssemblyWeeklyTotal(data, entries, week), 63000);
  assert.equal(getAssemblyClientTarget(entries, 'CT', week), 0);
  assert.equal(getAssemblyClientTarget(entries, 'KIKO', week) / 6, 10500);
  assert.equal(Object.keys(entries).length, 3);
  assert.equal(getAssemblyClientTarget(entries, 'KIKO', getWeekMetadata('2026-11-09').weekKey), undefined);
});

test('Assembly target dialog: show imported total and disable saving until every client target is filled', () => {
  const week = getWeekMetadata('2026-11-05').weekKey;
  const { AssemblyClientTargetsModal } = loadSource('src/components/AssemblyClientTargetsModal.tsx', { modules: {
    '@/store/useStore': { useStore: () => ({ productionData:[{...productionDay('2026-11-05', 100),weekKey:week,weeklyTarget:600}], weeklyTargets:{}, setWeeklyTargets:()=>{} }) },
  } });
  const html = renderToStaticMarkup(createElement(AssemblyClientTargetsModal, {initialWeekKey:week, onClose:()=>{}}));
  assert.match(html, /role="dialog"/);
  assert.match(html, /Objectif hebdomadaire KIKO/);
  assert.match(html, /Total Assemblage/);
  assert.match(html, /600/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>.*Enregistrer cette semaine/);
});

test('KIKO plan status: above is green, equal orange, below red; neutral without a target', () => {
  assert.equal(getKikoPlanStatus(48013, 52500), 'red');
  assert.equal(getKikoPlanStatus(9499, 10000), 'red');
  assert.equal(getKikoPlanStatus(9999, 10000), 'red');
  assert.equal(getKikoPlanStatus(10000, 10000), 'orange');
  assert.equal(getKikoPlanStatus(10001, 10000), 'green');
  assert.equal(getKikoPlanStatus(10501, 10000), 'green');
  assert.equal(getKikoPlanStatus(0, 0), 'neutral');
});

function productionDay(date, quantity, department = 'Assemblage', client = 'KIKO') {
  return {
    date, department, actualProduction: quantity + 999,
    conformQty: quantity, scrapQty: 10,
    clientBreakdown: [{ client, actualProduction: quantity + 10, conformQty: quantity, scrapQty: 10 }],
  };
}

test('KIKO progress: accumulate conforming quantity day by day, excluding future dates and other clients/departments', () => {
  const data = [
    productionDay('2026-11-01', 10_000),
    productionDay('2026-11-02', 15_000),
    productionDay('2026-11-03', 20_000),
    productionDay('2026-11-02', 50_000, 'Assemblage', 'YZA'),
    productionDay('2026-11-02', 70_000, 'Packaging'),
    { date: '2026-11-02', department: 'Assemblage', actualProduction: 80_000 },
  ];
  const firstDay = getKikoProductionProgress(data, '2026-11-01');
  const secondDay = getKikoProductionProgress(data, '2026-11-02');
  assert.equal(firstDay.cumulative, 10_000);
  assert.equal(secondDay.cumulative, 25_000);
  assert.equal(secondDay.dailyQuantity, 15_000);
  assert.equal(secondDay.remainingTotal, 325_000);
  assert.equal(secondDay.remainingMilestone, 240_000);
  assert.equal(secondDay.history.at(-1).cumulative, 25_000);
  const missingDay = getKikoProductionProgress(data, '2026-11-04');
  assert.equal(missingDay.dailyQuantity, 0);
  assert.equal(missingDay.cumulative, 45_000);
});

test('KIKO plan: count each active KIKO date once, including scrap-only days, excluding idle days and gaps', () => {
  const day = (date, produced, conform, scrap) => ({
    ...productionDay(date, produced),
    clientBreakdown: [{ client: 'KIKO', actualProduction: produced, conformQty: conform, scrapQty: scrap }],
  });
  const data = [
    day('2026-10-25', 500, 490, 10),
    day('2026-10-26', 12000, 11000, 1000),
    day('2026-10-26', 2000, 1800, 200),
    day('2026-10-27', 0, 0, 0),
    productionDay('2026-10-28', 15000, 'Assemblage', 'YZA'),
    productionDay('2026-10-28', 15000, 'Injection'),
    day('2026-10-30', 100, 0, 100),
    day('2026-11-01', 10000, 9000, 1000),
  ];
  const result = getKikoProductionProgress(data, '2026-10-31');
  assert.equal(result.cumulative, 12800);
  assert.equal(result.dailyQuantity, 0);
  assert.equal(result.workingDays, 2);
  assert.equal(result.plannedCumulative, 21000);
  assert.equal(result.variance, -8200);
  assert.deepEqual(result.history.map(({date, cumulative, plannedCumulative}) => ({date, cumulative, plannedCumulative})), [
    {date:'2026-10-26', cumulative:12800, plannedCumulative:10500},
    {date:'2026-10-27', cumulative:12800, plannedCumulative:10500},
    {date:'2026-10-30', cumulative:12800, plannedCumulative:21000},
  ]);
  const sunday = getKikoProductionProgress(data, '2026-11-01');
  assert.equal(sunday.workingDays, 3);
  assert.equal(sunday.plannedCumulative, 31500);
  assert.equal(sunday.dailyQuantity, 9000);
  const empty = getKikoProductionProgress([], '2026-11-01');
  assert.equal(empty.plannedCumulative, 0);
  assert.equal(empty.variance, 0);
});

test('KIKO progress: start on October 26 inclusive and exclude earlier production from all totals', () => {
  const data = [
    productionDay('2026-10-25', 400_000),
    productionDay('2026-10-26', 10_000),
    productionDay('2026-10-27', 15_000),
  ];
  const beforeStart = getKikoProductionProgress(data, '2026-10-25');
  assert.equal(beforeStart.cumulative, 0);
  assert.equal(beforeStart.dailyQuantity, 0);
  assert.equal(beforeStart.hasClientData, false);
  const firstDay = getKikoProductionProgress(data, '2026-10-26');
  assert.equal(firstDay.cumulative, 10_000);
  assert.equal(firstDay.dailyQuantity, 10_000);
  const secondDay = getKikoProductionProgress(data, '2026-10-27');
  assert.equal(secondDay.cumulative, 25_000);
  assert.equal(secondDay.producedByDeadline, 25_000);
  assert.equal(secondDay.remainingTotal, 325_000);
  assert.equal(secondDay.milestoneReachedOn, null);
  assert.equal(secondDay.totalReachedOn, null);
  assert.deepEqual(secondDay.history.map((day) => day.date), ['2026-10-26', '2026-10-27']);
});

test('KIKO progress: milestone and total completion dates persist, with no negative remaining quantity', () => {
  const data = [
    productionDay('2026-11-01', 260_000),
    productionDay('2026-11-02', 5_000),
    productionDay('2026-11-03', 100_000),
  ];
  const progress = getKikoProductionProgress(data, '2026-11-03');
  assert.equal(progress.cumulative, 365_000);
  assert.equal(progress.milestoneReachedOn, '2026-11-02');
  assert.equal(progress.totalReachedOn, '2026-11-03');
  assert.equal(progress.remainingMilestone, 0);
  assert.equal(progress.remainingTotal, 0);
  assert.ok(progress.totalProgress > 1);
});

test('KIKO progress: distinguish production by the deadline from late completion', () => {
  const data = [productionDay('2026-12-19', 250_000), productionDay('2026-12-20', 100_000)];
  const before = getKikoProductionProgress(data, '2026-12-18');
  assert.equal(before.daysUntilDeadline, 1);
  assert.equal(before.cumulative, 0);
  const deadline = getKikoProductionProgress(data, '2026-12-19');
  assert.equal(deadline.producedByDeadline, 250_000);
  assert.equal(deadline.isPastDeadline, false);
  const after = getKikoProductionProgress(data, '2026-12-20');
  assert.equal(after.cumulative, 350_000);
  assert.equal(after.producedByDeadline, 250_000);
  assert.equal(after.daysUntilDeadline, 0);
  assert.equal(after.isPastDeadline, true);
  assert.equal(after.totalReachedOn, '2026-12-20');
});

test('KIKO progress: show an empty result until client-tagged data is imported', () => {
  const progress = getKikoProductionProgress([
    { date: '2026-11-01', department: 'Assemblage', actualProduction: 265_000 },
  ], '2026-11-01');
  assert.equal(progress.cumulative, 0);
  assert.equal(progress.hasClientData, false);
  assert.equal(progress.totalProgress, 0);
  assert.equal(progress.milestoneReachedOn, null);
});

test('KIKO progress component: render real cumulative quantities and accessible completion state', () => {
  const { KikoProductionProgress } = loadSource('src/components/KikoProductionProgress.tsx');
  const html = renderToStaticMarkup(createElement(KikoProductionProgress, {
    data: [productionDay('2026-11-01', 265_000), productionDay('2026-11-02', 100_000)],
    selectedDate: '2026-11-02',
  }));
  assert.match(html, /role="progressbar"/);
  assert.match(html, /aria-valuemax="350000"/);
  assert.match(html, /aria-valuenow="350000"/);
  assert.match(html, /365\s000/);
  assert.match(html, /104,3 %/);
  assert.match(html, /Palier atteint le 01\/11\/2026/);
  assert.match(html, /Objectif total atteint le 02\/11\/2026/);
  assert.match(html, /19\/12\/2026/);
  assert.match(html, /26\/10\/2026/);
  assert.match(html, /Qté conforme \/ jour/);
  assert.match(html, /Cumul conforme \/ planifié/);
  assert.match(html, /Planifié : 21\s000/);
  assert.match(html, /10\s500 pièces × 2 jours/);
  assert.doesNotMatch(html, /NaN|Infinity/);
});

test('Excel: preserve clients sharing a date, normalize names and keep totals unchanged', async () => {
  const result = await parseExcelFile(workbookFile([
    headers,
    ['21/05/2026', ' Kiko ', 100, 90, 10],
    ['21/05/2026', 'KIKO', 50, 45, 5],
    ['21/05/2026', 'YZA', 200, 180, 20],
    ['21/05/2026', '', 25, 20, 5],
    ['22/05/2026', 'YZA', 80, 75, 5],
  ]), 'Assemblage', 600);
  assert.equal(result.error, undefined);
  assert.equal(result.data.length, 2);
  const day = result.data[0];
  assert.equal(day.actualProduction, 375);
  assert.equal(day.target, 100);
  assert.deepEqual(getAssemblyClients(result.data), ['KIKO', 'YZA', '']);
  assert.deepEqual(getClientQuantities(day, 'KIKO'), { actualProduction: 150, conformQty: 135, scrapQty: 15 });
  assert.deepEqual(getClientQuantities(day, ''), { actualProduction: 25, conformQty: 20, scrapQty: 5 });
  assert.deepEqual(getClientQuantities(result.data[1], 'KIKO'), { actualProduction: 0, conformQty: 0, scrapQty: 0 });
  assert.equal(getClientQuantities(day, null).actualProduction, 375);
  assert.equal(day.clientBreakdown.reduce((sum, entry) => sum + entry.actualProduction, 0), day.actualProduction);
});

test('Excel: missing Client remains importable and other departments keep their totals', async () => {
  const file = workbookFile([
    ['Date', 'Produced Qty', 'Conforme Qty', 'Scrap Qty'],
    ['21/05/2026', 100, 90, 10],
  ]);
  const assembly = await parseExcelFile(file, 'Assemblage', 600);
  assert.equal(assembly.data[0].clientBreakdown[0].client, '');
  assert.equal(getClientQuantities(assembly.data[0], '').actualProduction, 100);
  const packaging = await parseExcelFile(file, 'Packaging', 600);
  assert.equal(packaging.data[0].clientBreakdown, undefined);
  assert.equal(packaging.data[0].actualProduction, 100);
});

test('Excel: merged client cells are read; ordinary blank cells are not guessed', async () => {
  const result = await parseExcelFile(workbookFile([
    headers,
    ['21/05/2026', 'KIKO', 100, 90, 10],
    ['22/05/2026', undefined, 50, 45, 5],
    ['23/05/2026', undefined, 25, 20, 5],
  ], [{ s: { r: 1, c: 1 }, e: { r: 2, c: 1 } }]), 'Assemblage', 600);
  assert.equal(result.data[1].clientBreakdown[0].client, 'KIKO');
  assert.equal(result.data[2].clientBreakdown[0].client, '');
});

test('legacy data belongs to Non renseigné and never leaks into a named client', () => {
  const item = { department: 'Assemblage', actualProduction: 40, conformQty: 35, scrapQty: 5 };
  assert.deepEqual(getAssemblyClients([item]), ['']);
  assert.equal(getClientQuantities(item, '').actualProduction, 40);
  assert.equal(getClientQuantities(item, 'KIKO').actualProduction, 0);
});

test('Supabase: persist/reload client detail, preserve other days and clear stale detail on reimport', async () => {
  const productionRows = new Map();
  const weeklyTargetRows = new Map();
  const metadataRows = new Map([['warnings', ['Existing warning']]]);
  const calls = [];
  const fakeFetch = async (url, options) => {
    const table = url.pathname.split('/').at(-1);
    calls.push({ table, method: options.method, query: Object.fromEntries(url.searchParams) });
    if (options.method === 'POST') {
      for (const row of JSON.parse(options.body)) {
        if (table === 'production_reports') productionRows.set(`${row.department}:${row.report_date}`, row);
        if (table === 'dashboard_metadata') metadataRows.set(row.meta_key, row.meta_value);
        if (table === 'weekly_targets') weeklyTargetRows.set(row.target_key, row.value);
      }
      return new Response(null, { status: 201 });
    }
    if (options.method === 'DELETE') {
      if (table === 'production_reports') productionRows.clear();
      if (table === 'dashboard_metadata') metadataRows.clear();
      if (table === 'weekly_targets') weeklyTargetRows.clear();
      return new Response(null, { status: 204 });
    }
    const rows = table === 'production_reports' ? Array.from(productionRows.values())
      : table === 'dashboard_metadata' ? Array.from(metadataRows, ([meta_key, meta_value]) => ({ meta_key, meta_value }))
      : table === 'weekly_targets' ? Array.from(weeklyTargetRows, ([target_key, value]) => ({ target_key, value }))
        : [];
    return Response.json(rows);
  };
  const savedUrl = process.env.SUPABASE_PROJECT_URL;
  const savedKey = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_PROJECT_URL = 'https://example.test';
  process.env.SUPABASE_SECRET_KEY = 'test-key';
  try {
    const service = loadSource('src/lib/dashboardDataService.ts', { fetch: fakeFetch });
    const parsed = await parseExcelFile(workbookFile([
      headers,
      ['21/05/2026', 'KIKO', 100, 90, 10],
      ['22/05/2026', 'YZA', 80, 75, 5],
    ]), 'Assemblage', 600);
    let snapshot = await service.persistDashboardSnapshot({ productionData: parsed.data });
    assert.equal(getClientQuantities(snapshot.productionData[0], 'KIKO').actualProduction, 100);
    assert.deepEqual(snapshot.warnings, ['Existing warning']);
    assert.equal(metadataRows.size, 3);
    const weekKey = parsed.data[0].weekKey;
    const clientTargets = validateAssemblyClientAllocation(parsed.data, {}, weekKey, [
      { client: 'KIKO', target: 400 }, { client: 'YZA', target: 200 },
    ]);
    await service.persistDashboardSnapshot({ weeklyTargets: clientTargets });
    assert.equal(getAssemblyClientTarget((await service.loadDashboardSnapshot()).weeklyTargets, 'KIKO', weekKey), 400);

    const updatedDay = { ...parsed.data[0], actualProduction: 60, conformQty: 55, scrapQty: 5, clientBreakdown: [
      { client: 'YZA', actualProduction: 60, conformQty: 55, scrapQty: 5 },
    ] };
    snapshot = await service.persistDashboardSnapshot({ productionData: [updatedDay] });
    assert.equal(snapshot.productionData.length, 2);
    assert.equal(getClientQuantities(snapshot.productionData[0], 'KIKO').actualProduction, 0);
    assert.equal(getClientQuantities(snapshot.productionData[1], 'YZA').actualProduction, 80);
    assert.equal(getAssemblyClientTarget(snapshot.weeklyTargets, 'KIKO', weekKey), 400);
    await service.persistDashboardSnapshot({ weeklyTargets: { [buildWeeklyTargetOverrideKey('department', 'Assemblage', weekKey)]: 800 } });
    assert.equal(getAssemblyClientTarget((await service.loadDashboardSnapshot()).weeklyTargets, 'YZA', weekKey), 200);

    const { clientBreakdown: ignored, ...oldFormat } = updatedDay;
    void ignored;
    snapshot = await service.persistDashboardSnapshot({ productionData: [oldFormat] });
    assert.equal(getClientQuantities(snapshot.productionData[0], 'YZA').actualProduction, 0);
    assert.equal(getClientQuantities(snapshot.productionData[0], '').actualProduction, 60);

    await service.clearDashboardSnapshot();
    assert.equal(metadataRows.size, 0);
    assert.equal(weeklyTargetRows.size, 0);
    const deletion = calls.find((call) => call.table === 'dashboard_metadata' && call.method === 'DELETE');
    assert.match(deletion.query.or, /assembly_clients/);
  } finally {
    if (savedUrl === undefined) delete process.env.SUPABASE_PROJECT_URL;
    else process.env.SUPABASE_PROJECT_URL = savedUrl;
    if (savedKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = savedKey;
  }
});

test('Supabase: retain KIKO imports when dashboard_metadata is absent and legacy snapshot storage exists', async () => {
  const productionRows = new Map();
  const snapshotRows = new Map([['existing-snapshot', { id: 'existing-snapshot', payload: {} }]]);
  const kind = 'production-dashboard-metadata';
  const fakeFetch = async (url, options) => {
    const table = url.pathname.split('/').at(-1);
    if (table === 'dashboard_metadata') {
      return Response.json({ code: 'PGRST205', message: "Could not find the table 'public.dashboard_metadata' in the schema cache" }, { status: 404 });
    }
    if (table === 'dashboard_snapshots') {
      if (options.method === 'POST') {
        assert.equal(url.searchParams.get('on_conflict'), 'id');
        for (const row of JSON.parse(options.body)) {
          assert.match(row.id, /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
          assert.equal(row.payload.kind, kind);
          snapshotRows.set(row.id, row);
        }
        return new Response(null, { status: 201 });
      }
      assert.equal(url.searchParams.get('payload->>kind'), `eq.${kind}`);
      if (options.method === 'DELETE') {
        for (const [id, row] of snapshotRows) if (row.payload.kind === kind) snapshotRows.delete(id);
        return new Response(null, { status: 204 });
      }
      return Response.json(Array.from(snapshotRows.values()).filter((row) => row.payload.kind === kind));
    }
    if (options.method === 'POST') {
      if (table === 'production_reports') {
        for (const row of JSON.parse(options.body)) productionRows.set(`${row.department}:${row.report_date}`, row);
      }
      return new Response(null, { status: 201 });
    }
    if (options.method === 'DELETE') {
      if (table === 'production_reports') productionRows.clear();
      return new Response(null, { status: 204 });
    }
    return Response.json(table === 'production_reports' ? Array.from(productionRows.values()) : []);
  };
  const savedUrl = process.env.SUPABASE_PROJECT_URL;
  const savedKey = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_PROJECT_URL = 'https://example.test';
  process.env.SUPABASE_SECRET_KEY = 'test-key';
  try {
    const service = loadSource('src/lib/dashboardDataService.ts', { fetch: fakeFetch });
    const parsed = await parseExcelFile(workbookFile([
      headers,
      ['26/10/2026', 'KIKO', 100, 90, 10],
      ['04/11/2026', 'KIKO', 80, 75, 5],
    ]), 'Assemblage', 600);
    const imported = await service.persistDashboardSnapshot({ productionData: parsed.data, warnings: ['Import warning'] });
    assert.equal(getKikoProductionProgress(imported.productionData, '2026-11-05').cumulative, 165);
    assert.deepEqual(imported.warnings, ['Import warning']);

    const reloaded = await service.loadDashboardSnapshot();
    assert.equal(getKikoProductionProgress(reloaded.productionData, '2026-11-05').cumulative, 165);
    assert.equal(snapshotRows.size, 4);
    await service.persistDashboardSnapshot({ productionData: [parsed.data[0]] });
    assert.equal(snapshotRows.size, 4);
    assert.equal(getKikoProductionProgress((await service.loadDashboardSnapshot()).productionData, '2026-11-05').cumulative, 165);

    await service.clearDashboardSnapshot();
    assert.equal(snapshotRows.size, 1);
    assert.deepEqual(snapshotRows.get('existing-snapshot').payload, {});
  } finally {
    if (savedUrl === undefined) delete process.env.SUPABASE_PROJECT_URL;
    else process.env.SUPABASE_PROJECT_URL = savedUrl;
    if (savedKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = savedKey;
  }
});
