'use client';
import React, { useState } from 'react';
import { X, Upload, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { parseExcelFile } from '@/lib/excelParser';
import { useStore, ProductionData, SubComponentData } from '@/store/useStore';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEPARTMENTS = [
  { name: 'Injection', defaultTarget: 12500 },
  { name: 'Soudure', defaultTarget: 4167 },
  { name: 'Metallisation', defaultTarget: 6700 },
  { name: 'US serigraphie', defaultTarget: 16700 },
  { name: 'Assemblage', defaultTarget: 5000 },
  { name: 'Packaging', defaultTarget: 3333 }
];

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose }) => {
  const [files, setFiles] = useState<{ [key: string]: File | null }>({});
  const [targets, setTargets] = useState<{ [key: string]: number }>(
    Object.fromEntries(DEPARTMENTS.map(d => [d.name, d.defaultTarget]))
  );
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);
  const addProductionData = useStore(state => state.addProductionData);
  const addSubComponentsData = useStore(state => state.addSubComponentsData);

  if (!isOpen) return null;

  const handleFileChange = (dept: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFiles(prev => ({ ...prev, [dept]: file }));
      setErrors([]); 
    }
  };

  const handleTargetChange = (dept: string, val: string) => {
    const num = Number(val);
    setTargets(prev => ({ ...prev, [dept]: isNaN(num) ? 0 : num }));
  };

  const handleImport = async () => {
    setLoading(true);
    setErrors([]);
    setSuccess(false);
    
    let allData: ProductionData[] = [];
    let newErrors: string[] = [];
    let allWarnings: string[] = [];
    let allSubComponents: SubComponentData[] = [];

    const deptsToProcess = DEPARTMENTS.filter(d => files[d.name]);

    if (deptsToProcess.length === 0) {
        setErrors(["Veuillez sélectionner au moins un fichier à importer."]);
        setLoading(false);
        return;
    }

    for (const deptObj of deptsToProcess) {
      const file = files[deptObj.name]!;
      const deptName = deptObj.name;
      const target = targets[deptName];
      
      const deptKeyWord = deptName.split(' ')[0].toLowerCase();
      if (!file.name.toLowerCase().includes(deptKeyWord)) {
         newErrors.push(`Attention : Le fichier "${file.name}" ne semble pas correspondre au département "${deptName}". Vérifiez que vous avez sélectionné le bon fichier.`);
      }

      const result = await parseExcelFile(file, deptName, target);
      if (result.error) {
        newErrors.push(`Erreur pour ${deptName}: ${result.error}`);
      } else {
        if (result.data) {
          allData = [...allData, ...result.data];
        }
        if (result.warnings) {
          allWarnings = [...allWarnings, ...result.warnings];
        }
        if (result.subComponentsData) {
          allSubComponents = [...allSubComponents, ...result.subComponentsData];
        }
      }
    }

    if (newErrors.length > 0) {
      setErrors(newErrors);
      setLoading(false);
      return;
    }

    if (allData.length > 0) {
      addProductionData(allData, allWarnings);
      if (allSubComponents.length > 0) {
        addSubComponentsData(allSubComponents);
      }
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setFiles({});
      }, 2000);
    } else {
      setErrors(["Aucune donnée valide trouvée dans les fichiers."]);
    }

    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border-t-4 border-red-600">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 flex items-center">
            <Upload className="w-5 h-5 mr-2 text-red-600" />
            Importer les fichiers Daily Prod
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-gray-500 mb-6">
            Sélectionnez les fichiers Excel correspondant à chaque département. Vérifiez également le Target journalier.
          </p>

          <div className="space-y-4">
            {DEPARTMENTS.map((dept) => (
              <div key={dept.name} className="flex flex-col sm:flex-row items-center p-3 border rounded-lg border-gray-200 hover:border-red-300 transition-colors bg-gray-50 gap-4">
                <div className="flex-1 font-medium text-gray-700 flex items-center min-w-[150px]">
                  <FileSpreadsheet className="w-4 h-4 mr-2 text-gray-400" />
                  {dept.name}
                </div>
                <div className="flex flex-col items-start min-w-[120px]">
                  <label className="text-xs text-gray-500 mb-1">Target Journalier</label>
                  <input
                    type="number"
                    value={targets[dept.name]}
                    onChange={(e) => handleTargetChange(dept.name, e.target.value)}
                    className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-red-500 focus:ring-red-500 border p-1.5"
                  />
                </div>
                <div className="flex-2 w-full">
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={(e) => handleFileChange(dept.name, e)}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-full file:border-0
                      file:text-sm file:font-semibold
                      file:bg-red-50 file:text-red-700
                      hover:file:bg-red-100 cursor-pointer"
                  />
                </div>
                {files[dept.name] && (
                  <CheckCircle className="w-5 h-5 text-green-500 ml-2 hidden sm:block" />
                )}
              </div>
            ))}
          </div>

          {errors.length > 0 && (
            <div className="mt-6 p-4 bg-red-50 border-l-4 border-red-500 rounded text-sm text-red-700 space-y-2">
              <div className="font-bold flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" />
                Erreurs détectées
              </div>
              <ul className="list-disc pl-5">
                {errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {success && (
            <div className="mt-6 p-4 bg-green-50 border-l-4 border-green-500 rounded text-sm text-green-700 flex items-center">
              <CheckCircle className="w-5 h-5 mr-2" />
              Données importées avec succès ! Mise à jour du dashboard...
            </div>
          )}
        </div>

        <div className="flex items-center justify-end p-6 border-t border-gray-100 bg-gray-50 rounded-b-xl gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            onClick={handleImport}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {loading ? 'Traitement...' : 'Importer les données'}
          </button>
        </div>
      </div>
    </div>
  );
};
