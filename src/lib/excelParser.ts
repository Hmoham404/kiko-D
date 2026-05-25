import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ProductionData, SubComponentData } from '@/store/useStore';
import { getWeekMetadata } from '@/lib/weeklyMetrics';

const WORKING_DAYS_PER_WEEK = 6;
const roundUnits = (value: number) => Math.round(value);

const parseExcelDate = (dateVal: unknown): string => {
  if (dateVal instanceof Date) {
    const adjusted = new Date(dateVal.getTime() + 12 * 60 * 60 * 1000);
    return format(adjusted, 'yyyy-MM-dd');
  }

  if (typeof dateVal === 'number') {
    const date = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
    return date.toISOString().slice(0, 10);
  }

  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
    const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);

    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      const year = dmyMatch[3];
      return `${year}-${month}-${day}`;
    }

    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString().slice(0, 10);
    }
  }

  return String(dateVal);
};

const cleanNumber = (val: unknown): number => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;

  const str = String(val)
    .trim()
    .replace(/\s+/g, '')
    .replace(/,/g, '.');

  const num = Number(str);
  return Number.isNaN(num) ? 0 : num;
};

const buildWeeklyTargetsMap = (targetsByWeekAndDate: Record<string, Record<string, number>>) => {
  return Object.fromEntries(
    Object.entries(targetsByWeekAndDate).map(([weekKey, dateTargets]) => [
      weekKey,
      Object.values(dateTargets).reduce((sum, value) => sum + value, 0),
    ])
  );
};

type ParsedMainAccumulator = ProductionData;
type ParsedSubAccumulator = SubComponentData;

export const parseExcelFile = async (
  file: File,
  expectedDepartment: string,
  manualWeeklyTarget: number,
  subTargets?: { base: number; cover: number; insert: number }
): Promise<{
  data?: ProductionData[];
  error?: string;
  warnings?: string[];
  subComponentsData?: SubComponentData[];
}> => {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target?.result, { type: 'binary', cellDates: true });
        const warningSet = new Set<string>();

        const mainSheetName = workbook.SheetNames[0];
        const mainWorksheet = workbook.Sheets[mainSheetName];
        const mainRawData: unknown[][] = XLSX.utils.sheet_to_json(mainWorksheet, { header: 1 });

        if (mainRawData.length === 0) {
          resolve({ error: `Le fichier ${file.name} est vide ou mal formate.` });
          return;
        }

        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(20, mainRawData.length); i += 1) {
          const row = mainRawData[i];
          if (row && row.some((cell) => typeof cell === 'string' && cell.toLowerCase().includes('date'))) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) {
          resolve({ error: `Impossible de trouver les colonnes dans ${file.name}.` });
          return;
        }

        const headers = mainRawData[headerRowIndex].map((header) =>
          typeof header === 'string' ? header.toLowerCase().trim().replace(/[\r\n]+/g, ' ') : ''
        );

        const dateIdx = headers.findIndex((header) => header === 'date' || header.startsWith('date'));
        const prodIdx = headers.findIndex(
          (header) => header.includes('produced') || header.includes('total prod') || header.includes('production')
        );
        const conformIdx = headers.findIndex(
          (header) => header.includes('conforme') || header.includes('conform') || header.includes('ok') || header.includes('bon')
        );
        const scrapIdx = headers.findIndex(
          (header) => header.includes('scrap') || header.includes('scrab') || header.includes('rebut') || header.includes('dechet')
        );
        const targetIdx = headers.findIndex(
          (header) => header.includes('target') || header.includes('objectif') || header.includes('cible')
        );

        if (dateIdx === -1 || prodIdx === -1) {
          resolve({ error: `Colonnes Date ou Production manquantes dans ${file.name}.` });
          return;
        }

        const aggregatedByDate: Record<string, ParsedMainAccumulator> = {};
        const weeklyDateTargets: Record<string, Record<string, number>> = {};

        let emptyConsecutiveCount = 0;
        for (let i = headerRowIndex + 1; i < mainRawData.length; i += 1) {
          const row = mainRawData[i];

          if (!row || row.length === 0 || !row[dateIdx]) {
            emptyConsecutiveCount += 1;
            if (emptyConsecutiveCount > 100) break;
            continue;
          }

          emptyConsecutiveCount = 0;

          const formattedDate = parseExcelDate(row[dateIdx]);
          const { weekKey, weekLabel } = getWeekMetadata(formattedDate);
          let actualProduction = cleanNumber(row[prodIdx]);
          const conformQty = cleanNumber(row[conformIdx]);
          const scrapQty = cleanNumber(row[scrapIdx]);
          const rowDailyTarget =
            targetIdx !== -1 && row[targetIdx] !== undefined && row[targetIdx] !== null && String(row[targetIdx]).trim() !== ''
              ? cleanNumber(row[targetIdx])
              : 0;

          if (actualProduction === 0 && conformQty === 0 && scrapQty === 0) {
            continue;
          }

          if (conformQty > actualProduction) {
            warningSet.add(
              `Attention : Conforme Qty (${conformQty}) superieur a Total Production (${actualProduction}) pour ${expectedDepartment} le ${formattedDate}.`
            );
            actualProduction = conformQty + scrapQty;
          }

          if (!aggregatedByDate[formattedDate]) {
            aggregatedByDate[formattedDate] = {
              department: expectedDepartment,
              date: formattedDate,
              week: weekLabel,
              weekKey,
              target: 0,
              weeklyTarget: 0,
              actualProduction: 0,
              conformQty: 0,
              scrapQty: 0,
              progress: 0,
              gap: 0,
              scrapRate: 0,
              status: 'red',
            };
          }

          if (rowDailyTarget > 0) {
            const existingDailyTarget = weeklyDateTargets[weekKey]?.[formattedDate];
            if (!weeklyDateTargets[weekKey]) {
              weeklyDateTargets[weekKey] = {};
            }

            if (existingDailyTarget !== undefined && existingDailyTarget !== rowDailyTarget) {
              warningSet.add(
                `Targets differents detectes pour ${expectedDepartment} le ${formattedDate}. La premiere valeur du fichier a ete conservee.`
              );
            } else if (existingDailyTarget === undefined) {
              weeklyDateTargets[weekKey][formattedDate] = rowDailyTarget;
              aggregatedByDate[formattedDate].target = rowDailyTarget;
            }
          }

          aggregatedByDate[formattedDate].actualProduction += actualProduction;
          aggregatedByDate[formattedDate].conformQty += conformQty;
          aggregatedByDate[formattedDate].scrapQty += scrapQty;
        }

        const mainItems = Object.values(aggregatedByDate);
        if (mainItems.length === 0) {
          resolve({ error: `Aucune donnee trouvee dans le fichier ${file.name}.` });
          return;
        }

        const weeklyTargetsFromSheet = buildWeeklyTargetsMap(weeklyDateTargets);
        const parsedData = mainItems.map((item) => {
          const weeklyTarget = weeklyTargetsFromSheet[item.weekKey] > 0 ? weeklyTargetsFromSheet[item.weekKey] : manualWeeklyTarget;
          const dailyTarget = weeklyTarget > 0 ? roundUnits(weeklyTarget / WORKING_DAYS_PER_WEEK) : roundUnits(item.target);
          const progress = dailyTarget > 0 ? item.actualProduction / dailyTarget : 0;
          const scrapRate = item.actualProduction > 0 ? item.scrapQty / item.actualProduction : 0;
          const gap = dailyTarget - item.actualProduction;

          let status: ProductionData['status'] = 'red';
          if (scrapRate > 0.05) {
            status = 'critical';
          } else if (progress >= 1 && scrapRate <= 0.02) {
            status = 'green';
          } else if (progress >= 0.8) {
            status = 'orange';
          }

          return {
            ...item,
            target: dailyTarget,
            weeklyTarget,
            progress,
            gap,
            scrapRate,
            status,
          };
        });

        let subComponentsData: SubComponentData[] = [];

        if (expectedDepartment === 'Injection') {
          const subSheets = ['Base', 'Cover', 'Insert'];

          subSheets.forEach((sheetName) => {
            if (!workbook.SheetNames.includes(sheetName)) {
              return;
            }

            const worksheet = workbook.Sheets[sheetName];
            const rawSubData: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            let subHeaderIdx = -1;
            for (let i = 0; i < Math.min(20, rawSubData.length); i += 1) {
              const row = rawSubData[i];
              if (row && row.some((cell) => typeof cell === 'string' && cell.toLowerCase().includes('date'))) {
                subHeaderIdx = i;
                break;
              }
            }

            if (subHeaderIdx === -1) {
              return;
            }

            const subHeaders = rawSubData[subHeaderIdx].map((header) =>
              typeof header === 'string' ? header.toLowerCase().trim().replace(/[\r\n]+/g, ' ') : ''
            );

            const sDateIdx = subHeaders.findIndex((header) => header === 'date' || header.startsWith('date'));
            const sProdIdx = subHeaders.findIndex(
              (header) => header.includes('produced') || header.includes('total prod') || header.includes('production')
            );
            const sConformIdx = subHeaders.findIndex(
              (header) => header.includes('conforme') || header.includes('conform') || header.includes('ok') || header.includes('bon')
            );
            const sScrapIdx = subHeaders.findIndex(
              (header) => header.includes('scrap') || header.includes('scrab') || header.includes('rebut') || header.includes('dechet')
            );
            const sTargetIdx = subHeaders.findIndex(
              (header) => header.includes('target') || header.includes('objectif') || header.includes('cible')
            );

            if (sDateIdx === -1 || sProdIdx === -1) {
              return;
            }

            const subAggregatedByDate: Record<string, ParsedSubAccumulator> = {};
            const subWeeklyDateTargets: Record<string, Record<string, number>> = {};
            let emptyConsecutiveSub = 0;

            for (let i = subHeaderIdx + 1; i < rawSubData.length; i += 1) {
              const row = rawSubData[i];

              if (!row || row.length === 0 || !row[sDateIdx]) {
                emptyConsecutiveSub += 1;
                if (emptyConsecutiveSub > 100) break;
                continue;
              }

              emptyConsecutiveSub = 0;

              const formattedDate = parseExcelDate(row[sDateIdx]);
              const { weekKey } = getWeekMetadata(formattedDate);
              let actualProduction = cleanNumber(row[sProdIdx]);
              const conformQty = cleanNumber(row[sConformIdx]);
              const scrapQty = cleanNumber(row[sScrapIdx]);

              let defaultWeeklySubTarget = Math.round(manualWeeklyTarget / 3);
              if (subTargets) {
                if (sheetName.toLowerCase() === 'base') defaultWeeklySubTarget = subTargets.base;
                if (sheetName.toLowerCase() === 'cover') defaultWeeklySubTarget = subTargets.cover;
                if (sheetName.toLowerCase() === 'insert') defaultWeeklySubTarget = subTargets.insert;
              }

              const rowDailyTarget =
                sTargetIdx !== -1 && row[sTargetIdx] !== undefined && row[sTargetIdx] !== null && String(row[sTargetIdx]).trim() !== ''
                  ? cleanNumber(row[sTargetIdx])
                  : 0;

              if (actualProduction === 0 && conformQty === 0 && scrapQty === 0) {
                continue;
              }

              if (conformQty > actualProduction) {
                actualProduction = conformQty + scrapQty;
              }

              if (!subAggregatedByDate[formattedDate]) {
                subAggregatedByDate[formattedDate] = {
                  component: sheetName,
                  date: formattedDate,
                  weekKey,
                  target: 0,
                  weeklyTarget: 0,
                  actualProduction: 0,
                  conformQty: 0,
                  scrapQty: 0,
                  progress: 0,
                  gap: 0,
                  scrapRate: 0,
                  status: 'red',
                };
              }

              if (rowDailyTarget > 0) {
                if (!subWeeklyDateTargets[weekKey]) {
                  subWeeklyDateTargets[weekKey] = {};
                }

                if (subWeeklyDateTargets[weekKey][formattedDate] === undefined) {
                  subWeeklyDateTargets[weekKey][formattedDate] = rowDailyTarget;
                  subAggregatedByDate[formattedDate].target = rowDailyTarget;
                }
              }

              subAggregatedByDate[formattedDate].actualProduction += actualProduction;
              subAggregatedByDate[formattedDate].conformQty += conformQty;
              subAggregatedByDate[formattedDate].scrapQty += scrapQty;
              subAggregatedByDate[formattedDate].weeklyTarget = defaultWeeklySubTarget;
            }

            const subItems = Object.values(subAggregatedByDate);
            const subWeeklyTargetsFromSheet = buildWeeklyTargetsMap(subWeeklyDateTargets);

            subItems.forEach((item) => {
              const fallbackWeeklyTarget = item.weeklyTarget;
              const weeklyTarget =
                subWeeklyTargetsFromSheet[item.weekKey] > 0 ? subWeeklyTargetsFromSheet[item.weekKey] : fallbackWeeklyTarget;
              const dailyTarget = weeklyTarget > 0 ? roundUnits(weeklyTarget / WORKING_DAYS_PER_WEEK) : roundUnits(item.target);
              const progress = dailyTarget > 0 ? item.actualProduction / dailyTarget : 0;
              const scrapRate = item.actualProduction > 0 ? item.scrapQty / item.actualProduction : 0;
              const gap = dailyTarget - item.actualProduction;

              item.target = dailyTarget;
              item.weeklyTarget = weeklyTarget;
              item.progress = progress;
              item.scrapRate = scrapRate;
              item.gap = gap;
              item.status = scrapRate > 0.05 ? 'critical' : progress >= 1 ? 'green' : progress >= 0.8 ? 'orange' : 'red';
            });

            subComponentsData = [...subComponentsData, ...subItems];
          });
        }

        resolve({ data: parsedData, warnings: Array.from(warningSet), subComponentsData });
      } catch {
        resolve({ error: 'Erreur inattendue.' });
      }
    };

    reader.onerror = () => resolve({ error: 'Erreur de lecture' });
    reader.readAsBinaryString(file);
  });
};
