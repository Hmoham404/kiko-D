export type ProductionStatus = 'green' | 'orange' | 'red' | 'critical';

export interface ClientProductionData {
  client: string;
  actualProduction: number;
  conformQty: number;
  scrapQty: number;
}

export interface ProductionData {
  department: string;
  date: string;
  week: string;
  weekKey: string;
  shift?: string;
  partNumber?: string;
  machine?: string;
  unitOfProduction?: string;
  clientBreakdown?: ClientProductionData[];
  target: number;
  weeklyTarget: number;
  actualProduction: number;
  conformQty: number;
  scrapQty: number;
  progress: number;
  gap: number;
  scrapRate: number;
  status: ProductionStatus;
}

export interface SubComponentData {
  component: string;
  date: string;
  weekKey: string;
  machine?: string;
  reference?: string;
  unitOfProduction?: string;
  coverCode?: string;
  target: number;
  weeklyTarget: number;
  actualProduction: number;
  conformQty: number;
  scrapQty: number;
  progress: number;
  gap: number;
  scrapRate: number;
  status: ProductionStatus | string;
}

export interface DashboardSnapshot {
  productionData: ProductionData[];
  subComponentsData: SubComponentData[];
  weeklyTargets: Record<string, number>;
  warnings: string[];
}
