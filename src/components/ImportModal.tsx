'use client';

import React, { useState } from 'react';
import { X, Upload, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { parseExcelFile } from '@/lib/excelParser';
import { readJsonResponse } from '@/lib/http';
import { parseTargetSettingsWorkbook } from '@/lib/targetSettingsParser';
import { useStore, ProductionData, SubComponentData } from '@/store/useStore';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEPARTMENTS = [
  {
    name: 'Injection',
    fallbackWeeklyTarget: 12500 * 5,
    fallbackSubTargets: {
      base: Math.round((12500 * 5) / 3),
      cover: Math.round((12500 * 5) / 3),
      insert: Math.round((12500 * 5) / 3),
    },
  },
  { name: 'Soudure', fallbackWeeklyTarget: 4167 * 5 },
  { name: 'Metallisation', fallbackWeeklyTarget: 6700 * 5 },
  { name: 'US serigraphie', fallbackWeeklyTarget: 16700 * 5 },
  { name: 'Assemblage', fallbackWeeklyTarget: 5000 * 5 },
  { name: 'Packaging', fallbackWeeklyTarget: 3333 * 5 },
];

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose }) => {
  const [files, setFiles] = useState<{ [key: string]: File | null }>({});
  const [targetFile, setTargetFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('Import termine avec succes.');
  const setSnapshot = useStore((state) => state.setSnapshot);
  const addProductionData = useStore((state) => state.addProductionData);
  const addSubComponentsData = useStore((state) => state.addSubComponentsData);
  const replaceWeeklyTargets = useStore((state) => state.replaceWeeklyTargets);
  const currentWeeklyTargets = useStore((state) => state.weeklyTargets);

  if (!isOpen) return null;

  const handleFileChange = (dept: string, event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setFiles((prev) => ({ ...prev, [dept]: file }));
      setErrors([]);
    }
  };

  const handleTargetFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setTargetFile(event.target.files[0]);
      setErrors([]);
    }
  };

  const resetModal = () => {
    setSuccess(false);
    setSuccessMessage('Import termine avec succes.');
    setFiles({});
    setTargetFile(null);
    setErrors([]);
  };

  const applyLocalFallback = (
    productionData: ProductionData[],
    subComponentsData: SubComponentData[],
    weeklyTargets: Record<string, number>,
    warnings: string[]
  ) => {
    if (Object.keys(weeklyTargets).length > 0) {
      replaceWeeklyTargets(weeklyTargets);
    }

    addProductionData(productionData, warnings);

    if (subComponentsData.length > 0) {
      addSubComponentsData(subComponentsData);
    }
  };

  const handleImport = async () => {
    setLoading(true);
    setErrors([]);
    setSuccess(false);

    const selectedDepartments = DEPARTMENTS.filter((department) => files[department.name]);
    const hasTargetUpload = Boolean(targetFile);
    const hasProductionUpload = selectedDepartments.length > 0;

    if (!hasTargetUpload && !hasProductionUpload) {
      setErrors(['Veuillez selectionner au moins un fichier de targets ou un fichier de production.']);
      setLoading(false);
      return;
    }

    let targetSettingsWarnings: string[] = [];
    let importedTargets = false;
    let importedWeeklyTargets: Record<string, number> = {};

    if (targetFile) {
      try {
        const { entries, warnings } = parseTargetSettingsWorkbook(await targetFile.arrayBuffer());
        importedWeeklyTargets = entries;
        targetSettingsWarnings = warnings;
        importedTargets = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Chargement du fichier de targets impossible.';
        setErrors([message]);
        setLoading(false);
        return;
      }
    }

    let allData: ProductionData[] = [];
    let allSubComponents: SubComponentData[] = [];
    const newErrors: string[] = [];
    let allWarnings: string[] = [...targetSettingsWarnings];
    const hasExistingWeeklyTargets = Object.keys(currentWeeklyTargets).length > 0;

    if (hasProductionUpload && !hasTargetUpload && !hasExistingWeeklyTargets) {
      allWarnings.push(
        "Aucun fichier de targets n'a ete importe. Des targets de secours par departement ont ete appliquees pour eviter les valeurs a zero."
      );
    }

    for (const department of selectedDepartments) {
      const file = files[department.name];

      if (!file) continue;

      const departmentKeyword = department.name.split(' ')[0].toLowerCase();
      if (!file.name.toLowerCase().includes(departmentKeyword)) {
        allWarnings.push(
          `Le fichier "${file.name}" a ete importe pour "${department.name}", mais son nom ne contient pas "${departmentKeyword}".`
        );
      }

      const result = await parseExcelFile(
        file,
        department.name,
        department.fallbackWeeklyTarget,
        department.name === 'Injection' ? department.fallbackSubTargets : undefined
      );
      if (result.error) {
        newErrors.push(`Erreur pour ${department.name}: ${result.error}`);
        continue;
      }

      if (result.data) {
        allData = [...allData, ...result.data];
      }

      if (result.subComponentsData) {
        allSubComponents = [...allSubComponents, ...result.subComponentsData];
      }

      if (result.warnings) {
        allWarnings = [...allWarnings, ...result.warnings];
      }
    }

    if (newErrors.length > 0) {
      setErrors(newErrors);
      setLoading(false);
      return;
    }

    if (hasProductionUpload && allData.length === 0) {
      setErrors(['Aucune donnee valide trouvee dans les fichiers importes.']);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/dashboard-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productionData: allData,
          subComponentsData: allSubComponents,
          weeklyTargets: importedWeeklyTargets,
          warnings: allWarnings,
        }),
      });

      const payload = (await readJsonResponse<{
        error?: string;
        snapshot?: {
          productionData: ProductionData[];
          subComponentsData: SubComponentData[];
          weeklyTargets: Record<string, number>;
          warnings: string[];
        };
      }>(response)) ?? null;

      if (response.ok && !payload?.snapshot) {
        applyLocalFallback(allData, allSubComponents, importedWeeklyTargets, allWarnings);

        setSuccessMessage(
          "Donnees chargees dans le dashboard, mais la reponse serveur etait vide. Verifiez la synchronisation Supabase."
        );
        setSuccess(true);
        setLoading(false);

        window.setTimeout(() => {
          onClose();
          resetModal();
        }, 2200);
        return;
      }

      if (!response.ok || !payload?.snapshot) {
        applyLocalFallback(allData, allSubComponents, importedWeeklyTargets, allWarnings);

        setSuccessMessage(
          payload?.error
            ? `Donnees chargees dans le dashboard localement. Synchronisation serveur a verifier: ${payload.error}`
            : 'Donnees chargees dans le dashboard localement. Synchronisation serveur a verifier.'
        );
        setSuccess(true);
        setLoading(false);

        window.setTimeout(() => {
          onClose();
          resetModal();
        }, 2400);
        return;
      }

      setSnapshot(payload.snapshot);
    } catch (error) {
      applyLocalFallback(allData, allSubComponents, importedWeeklyTargets, allWarnings);

      const message = error instanceof Error ? error.message : 'Erreur reseau pendant la sauvegarde.';
      setSuccessMessage(`Donnees chargees dans le dashboard localement. Synchronisation serveur a verifier: ${message}`);
      setSuccess(true);
      setLoading(false);

      window.setTimeout(() => {
        onClose();
        resetModal();
      }, 2400);
      return;
    }

    if (importedTargets && hasProductionUpload) {
      setSuccessMessage('Donnees de production et targets hebdomadaires importees avec succes.');
    } else if (importedTargets) {
      setSuccessMessage('Targets hebdomadaires importees avec succes.');
    } else {
      setSuccessMessage('Donnees de production importees avec succes.');
    }
    setSuccess(true);
    setLoading(false);

    window.setTimeout(() => {
      onClose();
      resetModal();
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border-t-4 border-red-600 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 p-6">
          <h2 className="flex items-center text-xl font-bold text-gray-800">
            <Upload className="mr-2 h-5 w-5 text-red-600" />
            Importer les fichiers Daily Prod
          </h2>
          <button onClick={onClose} className="text-gray-400 transition-colors hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6 rounded-xl border border-red-100 bg-red-50/70 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Les targets ne se saisissent plus manuellement.</p>
            <p className="mt-1">
              Importez ici votre fichier de targets puis vos fichiers de production. L&apos;application ne depend plus du
              {' '}
              <span className="font-mono font-semibold text-red-700">dossier public</span>.
            </p>
          </div>

          <p className="mb-6 text-sm text-gray-500">
            Vous pouvez importer un fichier de targets seul, des fichiers de production seuls, ou les deux ensemble.
            Si aucun fichier de targets n&apos;est fourni, un target de secours par departement sera calcule
            automatiquement.
          </p>

          <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex min-w-[180px] items-center font-medium text-gray-700">
                <FileSpreadsheet className="mr-2 h-4 w-4 text-gray-400" />
                Fichier de targets
              </div>
              <div className="w-full flex-1">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleTargetFileChange}
                  className="block w-full cursor-pointer text-sm text-gray-500 file:mr-4 file:rounded-full file:border-0 file:bg-red-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-red-700 hover:file:bg-red-100"
                />
              </div>
              {targetFile && <CheckCircle className="hidden h-5 w-5 text-green-500 sm:block" />}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Exemple attendu: <span className="font-semibold text-slate-700">Target Settings.xlsx</span>
            </p>
          </div>

          <div className="space-y-4">
            {DEPARTMENTS.map((department) => (
              <div
                key={department.name}
                className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 transition-colors hover:border-red-300"
              >
                <div className="flex flex-col items-center gap-4 sm:flex-row">
                  <div className="flex min-w-[150px] flex-1 items-center font-medium text-gray-700">
                    <FileSpreadsheet className="mr-2 h-4 w-4 text-gray-400" />
                    {department.name}
                  </div>

                  <div className="w-full flex-1">
                    <input
                      type="file"
                      accept=".xlsx, .xls"
                      onChange={(event) => handleFileChange(department.name, event)}
                      className="block w-full cursor-pointer text-sm text-gray-500 file:mr-4 file:rounded-full file:border-0 file:bg-red-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-red-700 hover:file:bg-red-100"
                    />
                  </div>

                  {files[department.name] && <CheckCircle className="hidden h-5 w-5 text-green-500 sm:block" />}
                </div>
              </div>
            ))}
          </div>

          {errors.length > 0 && (
            <div className="mt-6 space-y-2 rounded border-l-4 border-red-500 bg-red-50 p-4 text-sm text-red-700">
              <div className="flex items-center font-bold">
                <AlertCircle className="mr-2 h-4 w-4" />
                Erreurs detectees
              </div>
              <ul className="list-disc pl-5">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {success && (
            <div className="mt-6 flex items-center rounded border-l-4 border-green-500 bg-green-50 p-4 text-sm text-green-700">
              <CheckCircle className="mr-2 h-5 w-5" />
              {successMessage}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 rounded-b-xl border-t border-gray-100 bg-gray-50 p-6">
          <button
            onClick={() => {
              onClose();
              resetModal();
            }}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            onClick={handleImport}
            disabled={loading}
            className="flex items-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Traitement...' : 'Importer les donnees'}
          </button>
        </div>
      </div>
    </div>
  );
};
