import * as XLSX from 'xlsx';
import { ProductionData, SubComponentData } from '@/store/useStore';
import { format, getWeek } from 'date-fns';

const parseExcelDate = (dateVal: any): string => {
  if (dateVal instanceof Date) {
    // Add 12 hours offset to push past midnight to solve the 1-day shift bug
    const adjusted = new Date(dateVal.getTime() + 12 * 60 * 60 * 1000);
    return format(adjusted, 'yyyy-MM-dd');
  }
  if (typeof dateVal === 'number') {
    // Convert Excel date serial number to UTC Date object manually to avoid timezone shift
    const date = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
    return date.toISOString().slice(0, 10);
  }
  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
    // Check for DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      const year = dmyMatch[3];
      return `${year}-${month}-${day}`;
    }
    // Try parsing as normal date if it's in standard YYYY-MM-DD
    const parsed = Date.parse(trimmed);
    if (!isNaN(parsed)) {
      return new Date(parsed).toISOString().slice(0, 10);
    }
  }
  return String(dateVal);
};

const cleanNumber = (val: any): number => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  const str = String(val).trim()
    .replace(/\s+/g, '') // remove spaces (e.g. "12 500" -> "12500")
    .replace(/,/g, '.');  // replace comma with dot (e.g. "12,5" -> "12.5")
  const num = Number(str);
  return isNaN(num) ? 0 : num;
};

export const parseExcelFile = async (
  file: File, 
  expectedDepartment: string, 
  manualTarget: number
): Promise<{ 
  data?: ProductionData[], 
  error?: string, 
  warnings?: string[],
  subComponentsData?: SubComponentData[]
}> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        
        // Parse Main Sheet
        const mainSheetName = workbook.SheetNames[0];
        const mainWorksheet = workbook.Sheets[mainSheetName];
        
        const mainRawData: any[][] = XLSX.utils.sheet_to_json(mainWorksheet, { header: 1 });
        
        if (mainRawData.length === 0) {
            return resolve({ error: `Le fichier ${file.name} est vide ou mal formaté.` });
        }

        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(20, mainRawData.length); i++) {
            const row = mainRawData[i];
            if (row && row.some(cell => typeof cell === 'string' && cell.toLowerCase().includes('date'))) {
                headerRowIndex = i;
                break;
            }
        }

        if (headerRowIndex === -1) {
            return resolve({ error: `Impossible de trouver les colonnes dans ${file.name}.` });
        }

        const headers = mainRawData[headerRowIndex].map(h => typeof h === 'string' ? h.toLowerCase().trim().replace(/[\r\n]+/g, ' ') : '');
        
        const dateIdx = headers.findIndex(h => h === 'date' || h.startsWith('date'));
        const prodIdx = headers.findIndex(h => h.includes('produced') || h.includes('total prod') || h.includes('production'));
        const conformIdx = headers.findIndex(h => h.includes('conforme') || h.includes('conform') || h.includes('ok') || h.includes('bon'));
        const scrapIdx = headers.findIndex(h => h.includes('scrap') || h.includes('scrab') || h.includes('rebut') || h.includes('dechet'));
        const targetIdx = headers.findIndex(h => h.includes('target') || h.includes('objectif') || h.includes('cible'));

        if (dateIdx === -1 || prodIdx === -1) {
             return resolve({ error: `Colonnes Date ou Production manquantes dans ${file.name}.` });
        }

        const aggregatedByDate: Record<string, ProductionData> = {};
        const warnings: string[] = [];

        for (let i = headerRowIndex + 1; i < mainRawData.length; i++) {
            const row = mainRawData[i];
            if (!row || row.length === 0) continue;

            const dateVal = row[dateIdx];
            if (!dateVal) continue;

            const formattedDate = parseExcelDate(dateVal);

            let actualProduction = cleanNumber(row[prodIdx]);
            const conformQty = cleanNumber(row[conformIdx]);
            const scrapQty = cleanNumber(row[scrapIdx]);
            const rowTarget = targetIdx !== -1 && row[targetIdx] !== undefined && row[targetIdx] !== null && String(row[targetIdx]).trim() !== ''
                ? cleanNumber(row[targetIdx])
                : manualTarget;

            if (actualProduction === 0 && conformQty === 0 && scrapQty === 0) {
                continue;
            }

            // Inconsistency detection
            if (conformQty > actualProduction) {
                const warnMsg = `Attention : Conforme Qty (${conformQty}) supérieur à Total Production (${actualProduction}) pour ${expectedDepartment} le ${formattedDate}.`;
                if (!warnings.includes(warnMsg)) {
                    warnings.push(warnMsg);
                }
                // Auto-correct
                actualProduction = conformQty + scrapQty;
            }

            let week = '';
            try {
                const d = new Date(formattedDate);
                week = `W${getWeek(d)}`;
            } catch {
                week = 'W--';
            }

            if (!aggregatedByDate[formattedDate]) {
                aggregatedByDate[formattedDate] = {
                    department: expectedDepartment,
                    date: formattedDate,
                    week: week,
                    target: rowTarget, 
                    actualProduction: 0,
                    conformQty: 0,
                    scrapQty: 0,
                    progress: 0,
                    gap: 0,
                    scrapRate: 0,
                    status: 'red'
                };
            }

            aggregatedByDate[formattedDate].actualProduction += actualProduction;
            aggregatedByDate[formattedDate].conformQty += conformQty;
            aggregatedByDate[formattedDate].scrapQty += scrapQty;
        }

        const parsedData = Object.values(aggregatedByDate).map(data => {
            let progress = 0;
            if (data.target > 0) {
                progress = data.actualProduction / data.target;
            }

            let scrapRate = 0;
            if (data.actualProduction > 0) {
                scrapRate = data.scrapQty / data.actualProduction;
            }

            const gap = data.target - data.actualProduction; 

            let status: ProductionData['status'] = 'red';
            if (scrapRate > 0.05) {
                status = 'critical';
            } else if (progress >= 1 && scrapRate <= 0.02) {
                status = 'green';
            } else if (progress >= 0.8 && progress < 1) {
                status = 'orange';
            }

            return { ...data, progress, scrapRate, gap, status };
        });
        
        if (parsedData.length === 0) {
             return resolve({ error: `Aucune donnée trouvée dans le fichier ${file.name}.` });
        }

        // Parse Sub-sheets for Injection if they exist
        let subComponentsData: SubComponentData[] = [];
        if (expectedDepartment === 'Injection') {
            const subSheets = ['Base', 'Cover', 'Insert'];
            subSheets.forEach(sheetName => {
                if (workbook.SheetNames.includes(sheetName)) {
                    const ws = workbook.Sheets[sheetName];
                    const rawSubData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
                    
                    let subHeaderIdx = -1;
                    for (let i = 0; i < Math.min(20, rawSubData.length); i++) {
                        const r = rawSubData[i];
                        if (r && r.some(c => typeof c === 'string' && c.toLowerCase().includes('date'))) {
                            subHeaderIdx = i;
                            break;
                        }
                    }

                    if (subHeaderIdx !== -1) {
                        const subHeaders = rawSubData[subHeaderIdx].map(h => typeof h === 'string' ? h.toLowerCase().trim().replace(/[\r\n]+/g, ' ') : '');
                        const sDateIdx = subHeaders.findIndex(h => h === 'date' || h.startsWith('date'));
                        const sProdIdx = subHeaders.findIndex(h => h.includes('produced') || h.includes('total prod') || h.includes('production'));
                        const sConformIdx = subHeaders.findIndex(h => h.includes('conforme') || h.includes('conform') || h.includes('ok') || h.includes('bon'));
                        const sScrapIdx = subHeaders.findIndex(h => h.includes('scrap') || h.includes('scrab') || h.includes('rebut') || h.includes('dechet'));
                        const sTargetIdx = subHeaders.findIndex(h => h.includes('target') || h.includes('objectif') || h.includes('cible'));

                        if (sDateIdx !== -1 && sProdIdx !== -1) {
                            const subAgg: Record<string, SubComponentData> = {};

                            for (let i = subHeaderIdx + 1; i < rawSubData.length; i++) {
                                const r = rawSubData[i];
                                if (!r || r.length === 0) continue;
                                const dateVal = r[sDateIdx];
                                if (!dateVal) continue;

                                const formattedDate = parseExcelDate(dateVal);

                                let actualProduction = cleanNumber(r[sProdIdx]);
                                const conformQty = cleanNumber(r[sConformIdx]);
                                const scrapQty = cleanNumber(r[sScrapIdx]);
                                const rowSubTarget = sTargetIdx !== -1 && r[sTargetIdx] !== undefined && r[sTargetIdx] !== null && String(r[sTargetIdx]).trim() !== ''
                                    ? cleanNumber(r[sTargetIdx])
                                    : Math.round(manualTarget / 3);

                                if (actualProduction === 0 && conformQty === 0 && scrapQty === 0) {
                                    continue;
                                }

                                if (conformQty > actualProduction) {
                                    actualProduction = conformQty + scrapQty;
                                }

                                if (!subAgg[formattedDate]) {
                                    subAgg[formattedDate] = {
                                        component: sheetName,
                                        date: formattedDate,
                                        target: rowSubTarget,
                                        actualProduction: 0,
                                        conformQty: 0,
                                        scrapQty: 0,
                                        progress: 0,
                                        gap: 0,
                                        scrapRate: 0,
                                        status: 'red'
                                    };
                                }

                                subAgg[formattedDate].actualProduction += actualProduction;
                                subAgg[formattedDate].conformQty += conformQty;
                                subAgg[formattedDate].scrapQty += scrapQty;
                            }

                            Object.values(subAgg).forEach(item => {
                                let progress = 0;
                                if (item.target > 0) {
                                    progress = item.actualProduction / item.target;
                                }
                                let scrapRate = 0;
                                if (item.actualProduction > 0) {
                                    scrapRate = item.scrapQty / item.actualProduction;
                                }
                                const gap = item.target - item.actualProduction;
                                item.progress = progress;
                                item.scrapRate = scrapRate;
                                item.gap = gap;
                                item.status = scrapRate > 0.05 ? 'critical' : progress >= 1 ? 'green' : 'orange';
                                subComponentsData.push(item);
                            });
                        }
                    }
                }
            });
        }

        resolve({ data: parsedData, warnings, subComponentsData });
      } catch (err) {
        resolve({ error: `Erreur inattendue.` });
      }
    };
    reader.onerror = () => resolve({ error: 'Erreur de lecture' });
  });
};
