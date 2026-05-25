'use client';
import React, { useMemo, useState } from 'react';
import { X, CalendarRange, Save } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { buildWeeklyTargetOverrideKey, getWeekMetadata } from '@/lib/weeklyMetrics';

interface WeeklyTargetsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type WeeklyTargetField = {
  key: string;
  scope: 'department' | 'component';
  entity: string;
  weekKey: string;
  weekLabel: string;
  defaultValue: number;
};

export const WeeklyTargetsModal: React.FC<WeeklyTargetsModalProps> = ({ isOpen, onClose }) => {
  const { productionData, subComponentsData, weeklyTargets, setWeeklyTargets } = useStore();

  const fields = useMemo(() => {
    const departmentFields = new Map<string, WeeklyTargetField>();
    const componentFields = new Map<string, WeeklyTargetField>();

    productionData.forEach((item) => {
      const key = buildWeeklyTargetOverrideKey('department', item.department, item.weekKey);
      if (!departmentFields.has(key)) {
        departmentFields.set(key, {
          key,
          scope: 'department',
          entity: item.department,
          weekKey: item.weekKey,
          weekLabel: item.week || getWeekMetadata(item.date).weekLabel,
          defaultValue: item.weeklyTarget,
        });
      }
    });

    subComponentsData.forEach((item) => {
      const key = buildWeeklyTargetOverrideKey('component', item.component, item.weekKey);
      if (!componentFields.has(key)) {
        componentFields.set(key, {
          key,
          scope: 'component',
          entity: item.component,
          weekKey: item.weekKey,
          weekLabel: getWeekMetadata(item.date).weekLabel,
          defaultValue: item.weeklyTarget,
        });
      }
    });

    return {
      departments: Array.from(departmentFields.values()).sort((a, b) => `${a.entity}${a.weekKey}`.localeCompare(`${b.entity}${b.weekKey}`)),
      components: Array.from(componentFields.values()).sort((a, b) => `${a.entity}${a.weekKey}`.localeCompare(`${b.entity}${b.weekKey}`)),
    };
  }, [productionData, subComponentsData]);

  const [localValues, setLocalValues] = useState<Record<string, number>>({});

  if (!isOpen) return null;

  const getFieldValue = (field: WeeklyTargetField) => {
    return localValues[field.key] ?? weeklyTargets[field.key] ?? field.defaultValue ?? 0;
  };

  const renderSection = (title: string, entries: WeeklyTargetField[]) => {
    if (entries.length === 0) return null;

    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">{title}</h3>
          <p className="text-xs text-slate-500">Chaque target est applique seulement a la semaine concernee, du lundi au samedi.</p>
        </div>

        <div className="space-y-3">
          {entries.map((field) => (
            <div key={field.key} className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr_180px] gap-3 items-center rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">{field.entity}</p>
                <p className="text-xs text-slate-500">{field.weekLabel}</p>
              </div>
              <div className="text-xs font-medium text-slate-500">
                Semaine: <span className="font-semibold text-slate-700">{field.weekKey.replace('__', ' -> ')}</span>
              </div>
              <input
                type="number"
                value={getFieldValue(field)}
                onChange={(e) =>
                  setLocalValues((prev) => ({
                    ...prev,
                    [field.key]: Number(e.target.value) || 0,
                  }))
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <CalendarRange className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Configurer les targets par semaine</h2>
              <p className="text-sm text-slate-500">Semaine usine: lundi a samedi</p>
            </div>
          </div>

          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-8 px-6 py-6">
          {renderSection('Departements', fields.departments)}
          {renderSection('Injection - Composants', fields.components)}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Annuler
          </button>
          <button
            onClick={() => {
              const nextValues = Object.fromEntries(
                [...fields.departments, ...fields.components].map((field) => [field.key, getFieldValue(field)])
              );
              setWeeklyTargets(nextValues);
              onClose();
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            <Save className="h-4 w-4" />
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
};
