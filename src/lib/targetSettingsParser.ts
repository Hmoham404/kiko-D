import { addDays, format, startOfWeek } from 'date-fns';
import * as XLSX from 'xlsx';
import { buildWeeklyTargetOverrideKey, getWeekMetadata } from '@/lib/weeklyMetrics';

const DEPARTMENT_ROW_MAP: Record<string, string> = {
  assemblage: 'Assemblage',
  injection: 'Injection',
  metallisation: 'Metallisation',
  packaging: 'Packaging',
  serigraphie: 'US serigraphie',
  soudure: 'Soudure',
};

const COMPONENT_ROW_MAP: Record<string, string> = {
  'injection base': 'Base',
  'injection cover': 'Cover',
  'injection insert': 'Insert',
};

type TargetSettingsParseResult = {
  entries: Record<string, number>;
  warnings: string[];
};

type WeekColumn = {
  columnIndex: number;
  rawLabel: string;
  weekKey: string;
  normalizedWeekLabel: string;
};

const normalizeText = (value: unknown) =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const cleanNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;

  const normalized = String(value)
    .trim()
    .replace(/\s+/g, '')
    .replace(/,/g, '.');
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const getIsoWeekStart = (weekYear: number, weekNumber: number) => {
  const fourthOfJanuary = new Date(weekYear, 0, 4);
  const firstWeekStart = startOfWeek(fourthOfJanuary, { weekStartsOn: 1 });
  return addDays(firstWeekStart, (weekNumber - 1) * 7);
};

const resolveWorkbookYear = (rows: unknown[][]) => {
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 12); rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
      if (normalizeText(row[columnIndex]) !== 'year') continue;

      const candidate = Number(row[columnIndex + 1]);
      if (Number.isFinite(candidate) && candidate > 2000) {
        return candidate;
      }
    }
  }

  return new Date().getFullYear();
};

const buildWeekColumns = (headerRow: unknown[], workbookYear: number, warnings: string[]) => {
  const weekColumns: WeekColumn[] = [];
  let previousWeekStart: Date | null = null;

  for (let columnIndex = 1; columnIndex < headerRow.length; columnIndex += 1) {
    const rawLabel = String(headerRow[columnIndex] ?? '').trim();
    const match = rawLabel.match(/w\s*0?(\d{1,2})/i);

    if (!match) continue;

    let weekStart: Date;
    if (!previousWeekStart) {
      weekStart = getIsoWeekStart(workbookYear, Number(match[1]));
    } else {
      const expectedNextWeekStart = addDays(previousWeekStart, 7);
      const expectedMetadata = getWeekMetadata(format(expectedNextWeekStart, 'yyyy-MM-dd'));
      const expectedLabel = `W${String(expectedMetadata.weekNumber).padStart(2, '0')}`;
      const normalizedRaw = `W${String(Number(match[1])).padStart(2, '0')}`;

      weekStart = expectedNextWeekStart;
      if (normalizedRaw !== expectedLabel) {
        warnings.push(
          `Semaine ${rawLabel || '(vide)'} normalisee en ${expectedLabel} dans Target Settings.xlsx pour conserver une suite hebdomadaire continue.`
        );
      }
    }

    previousWeekStart = weekStart;
    const metadata = getWeekMetadata(format(weekStart, 'yyyy-MM-dd'));
    weekColumns.push({
      columnIndex,
      rawLabel,
      weekKey: metadata.weekKey,
      normalizedWeekLabel: `W${String(metadata.weekNumber).padStart(2, '0')}`,
    });
  }

  return weekColumns;
};

export const parseTargetSettingsWorkbook = (workbookSource: ArrayBuffer): TargetSettingsParseResult => {
  const workbook = XLSX.read(workbookSource, { type: 'array' });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error('Le fichier de targets est vide.');
  }

  const worksheet = workbook.Sheets[sheetName];
  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });

  if (rawRows.length === 0) {
    throw new Error('Le fichier de targets ne contient aucune donnee exploitable.');
  }

  const warnings: string[] = [];
  const workbookYear = resolveWorkbookYear(rawRows);
  const headerRowIndex = rawRows.findIndex((row) => normalizeText(row?.[0]) === 'department');

  if (headerRowIndex === -1) {
    throw new Error("Impossible de trouver la ligne d'entete Department dans le fichier de targets.");
  }

  const weekColumns = buildWeekColumns(rawRows[headerRowIndex] ?? [], workbookYear, warnings);

  if (weekColumns.length === 0) {
    throw new Error("Impossible de trouver les colonnes de semaines dans le fichier de targets.");
  }

  const entries: Record<string, number> = {};
  const unknownRows = new Set<string>();

  for (let rowIndex = headerRowIndex + 1; rowIndex < rawRows.length; rowIndex += 1) {
    const row = rawRows[rowIndex] ?? [];
    const rawEntity = String(row[0] ?? '').trim();
    const normalizedEntity = normalizeText(rawEntity);

    if (!normalizedEntity) continue;

    const department = DEPARTMENT_ROW_MAP[normalizedEntity];
    const component = COMPONENT_ROW_MAP[normalizedEntity];

    if (!department && !component) {
      unknownRows.add(rawEntity);
      continue;
    }

    weekColumns.forEach(({ columnIndex, weekKey }) => {
      const value = cleanNumber(row[columnIndex]);

      if (department) {
        entries[buildWeeklyTargetOverrideKey('department', department, weekKey)] = value;
      }

      if (component) {
        entries[buildWeeklyTargetOverrideKey('component', component, weekKey)] = value;
      }
    });
  }

  if (unknownRows.size > 0) {
    warnings.push(`Lignes ignorees dans Target Settings.xlsx: ${Array.from(unknownRows).join(', ')}.`);
  }

  return { entries, warnings };
};
