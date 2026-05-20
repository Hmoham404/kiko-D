import { create } from 'zustand';

export interface ProductionData {
  department: string;
  date: string;
  week: string;
  shift?: string;
  partNumber?: string;
  target: number;
  actualProduction: number;
  conformQty: number;
  scrapQty: number;
  progress: number;
  gap: number;
  scrapRate: number;
  status: 'green' | 'orange' | 'red' | 'critical';
}

export interface SubComponentData {
  component: string;
  date: string;
  target: number;
  actualProduction: number;
  conformQty: number;
  scrapQty: number;
  progress: number;
  gap: number;
  scrapRate: number;
  status: string;
}

interface AppState {
  productionData: ProductionData[];
  subComponentsData: SubComponentData[];
  warnings: string[];
  addProductionData: (data: ProductionData[], warnings?: string[]) => void;
  addSubComponentsData: (data: SubComponentData[]) => void;
  clearData: () => void;
}

export const useStore = create<AppState>((set) => ({
  productionData: [],
  subComponentsData: [],
  warnings: [],
  addProductionData: (data, newWarnings) => set((state) => {
    const newData = [...state.productionData];
    data.forEach(newItem => {
      const existingIndex = newData.findIndex(
        d => d.department === newItem.department && d.date === newItem.date
      );
      if (existingIndex >= 0) {
        newData[existingIndex] = newItem;
      } else {
        newData.push(newItem);
      }
    });
    
    // Add unique warnings
    const combinedWarnings = [...state.warnings];
    if (newWarnings) {
      newWarnings.forEach(w => {
        if (!combinedWarnings.includes(w)) {
          combinedWarnings.push(w);
        }
      });
    }

    return { productionData: newData, warnings: combinedWarnings };
  }),
  addSubComponentsData: (data) => set((state) => {
    const newData = [...state.subComponentsData];
    data.forEach(newItem => {
      const existingIndex = newData.findIndex(
        d => d.component === newItem.component && d.date === newItem.date
      );
      if (existingIndex >= 0) {
        newData[existingIndex] = newItem;
      } else {
        newData.push(newItem);
      }
    });
    return { subComponentsData: newData };
  }),
  clearData: () => set({ productionData: [], subComponentsData: [], warnings: [] }),
}));
