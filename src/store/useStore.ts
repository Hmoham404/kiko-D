import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import type { DashboardSnapshot, ProductionData, SubComponentData } from '@/lib/dashboardTypes';

export type { ProductionData, SubComponentData } from '@/lib/dashboardTypes';

interface AppState {
  productionData: ProductionData[];
  subComponentsData: SubComponentData[];
  weeklyTargets: Record<string, number>;
  warnings: string[];
  addProductionData: (data: ProductionData[], warnings?: string[]) => void;
  addSubComponentsData: (data: SubComponentData[]) => void;
  setSnapshot: (snapshot: DashboardSnapshot) => void;
  setWeeklyTarget: (key: string, value: number) => void;
  setWeeklyTargets: (entries: Record<string, number>) => void;
  replaceWeeklyTargets: (entries: Record<string, number>) => void;
  removeWarning: (warning: string) => void;
  clearData: () => void;
}

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      productionData: [],
      subComponentsData: [],
      weeklyTargets: {},
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
      setSnapshot: (snapshot) => set({
        productionData: snapshot.productionData,
        subComponentsData: snapshot.subComponentsData,
        weeklyTargets: snapshot.weeklyTargets,
        warnings: snapshot.warnings,
      }),
      setWeeklyTarget: (key, value) => set((state) => ({
        weeklyTargets: {
          ...state.weeklyTargets,
          [key]: value,
        },
      })),
      setWeeklyTargets: (entries) => set((state) => ({
        weeklyTargets: {
          ...state.weeklyTargets,
          ...entries,
        },
      })),
      replaceWeeklyTargets: (entries) => set({
        weeklyTargets: entries,
      }),
      removeWarning: (warning) => set((state) => ({
        warnings: state.warnings.filter(w => w !== warning),
      })),
      clearData: () => set({ productionData: [], subComponentsData: [], weeklyTargets: {}, warnings: [] }),
    }),
    {
      name: 'kiko-dashboard-storage-v2',
      storage: createJSONStorage(() => (typeof window === 'undefined' ? noopStorage : localStorage)),
    }
  )
);
