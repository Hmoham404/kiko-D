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
const { getKikoProductionProgress } = loadSource('src/lib/kikoProductionProgress.ts');

function productionDay(date, quantity, department = 'Assemblage', client = 'KIKO') {
  return {
    date, department, actualProduction: quantity + 999,
    conformQty: quantity - 10, scrapQty: 10,
    clientBreakdown: [{ client, actualProduction: quantity, conformQty: quantity - 10, scrapQty: 10 }],
  };
}

test('KIKO progress: accumulate Produced Qty day by day, excluding future dates and other clients/departments', () => {
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
  const metadataRows = new Map([['warnings', ['Existing warning']]]);
  const calls = [];
  const fakeFetch = async (url, options) => {
    const table = url.pathname.split('/').at(-1);
    calls.push({ table, method: options.method, query: Object.fromEntries(url.searchParams) });
    if (options.method === 'POST') {
      for (const row of JSON.parse(options.body)) {
        if (table === 'production_reports') productionRows.set(`${row.department}:${row.report_date}`, row);
        if (table === 'dashboard_metadata') metadataRows.set(row.meta_key, row.meta_value);
      }
      return new Response(null, { status: 201 });
    }
    if (options.method === 'DELETE') {
      if (table === 'production_reports') productionRows.clear();
      if (table === 'dashboard_metadata') metadataRows.clear();
      return new Response(null, { status: 204 });
    }
    const rows = table === 'production_reports' ? Array.from(productionRows.values())
      : table === 'dashboard_metadata' ? Array.from(metadataRows, ([meta_key, meta_value]) => ({ meta_key, meta_value }))
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

    const updatedDay = { ...parsed.data[0], actualProduction: 60, conformQty: 55, scrapQty: 5, clientBreakdown: [
      { client: 'YZA', actualProduction: 60, conformQty: 55, scrapQty: 5 },
    ] };
    snapshot = await service.persistDashboardSnapshot({ productionData: [updatedDay] });
    assert.equal(snapshot.productionData.length, 2);
    assert.equal(getClientQuantities(snapshot.productionData[0], 'KIKO').actualProduction, 0);
    assert.equal(getClientQuantities(snapshot.productionData[1], 'YZA').actualProduction, 80);

    const { clientBreakdown: ignored, ...oldFormat } = updatedDay;
    void ignored;
    snapshot = await service.persistDashboardSnapshot({ productionData: [oldFormat] });
    assert.equal(getClientQuantities(snapshot.productionData[0], 'YZA').actualProduction, 0);
    assert.equal(getClientQuantities(snapshot.productionData[0], '').actualProduction, 60);

    await service.clearDashboardSnapshot();
    assert.equal(metadataRows.size, 0);
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
    assert.equal(getKikoProductionProgress(imported.productionData, '2026-11-05').cumulative, 180);
    assert.deepEqual(imported.warnings, ['Import warning']);

    const reloaded = await service.loadDashboardSnapshot();
    assert.equal(getKikoProductionProgress(reloaded.productionData, '2026-11-05').cumulative, 180);
    assert.equal(snapshotRows.size, 4);
    await service.persistDashboardSnapshot({ productionData: [parsed.data[0]] });
    assert.equal(snapshotRows.size, 4);
    assert.equal(getKikoProductionProgress((await service.loadDashboardSnapshot()).productionData, '2026-11-05').cumulative, 180);

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
