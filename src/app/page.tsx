'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { AlertTriangle, DatabaseZap, FileSpreadsheet, RefreshCw, RotateCcw } from 'lucide-react';
import { readJsonResponse } from '@/lib/http';
import { useStore } from '@/store/useStore';
import { DepartmentPdfExportButton } from '@/components/DepartmentPdfExportButton';
import { ImportModal } from '@/components/ImportModal';
import { ExecutiveDailyDashboard } from '@/components/ExecutiveDailyDashboard';

const ACCESS_CODE = 'myc@2026';

export default function DashboardPage() {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [showWarnings, setShowWarnings] = useState(true);
  const [isSyncing, setIsSyncing] = React.useState(true);
  const [isRebuildingServer, setIsRebuildingServer] = React.useState(false);
  const [isResettingServer, setIsResettingServer] = React.useState(false);
  const [hasLoadedServerSnapshot, setHasLoadedServerSnapshot] = React.useState(false);
  const [syncError, setSyncError] = React.useState<string | null>(null);
  const { productionData, subComponentsData, weeklyTargets, warnings, setSnapshot, clearData } = useStore();

  const [mounted, setMounted] = React.useState(() => useStore.persist.hasHydrated());
  React.useEffect(() => {
    return useStore.persist.onFinishHydration(() => {
      setMounted(true);
    });
  }, []);

  const syncFromServer = React.useEffectEvent(async () => {
    setIsSyncing(true);
    setSyncError(null);

    try {
      const response = await fetch('/api/dashboard-data', { cache: 'no-store' });
      const payload = (await readJsonResponse<{
        error?: string;
        snapshot?: {
          productionData: typeof productionData;
          subComponentsData: typeof subComponentsData;
          weeklyTargets: Record<string, number>;
          warnings: string[];
        };
      }>(response)) ?? null;

      if (!response.ok || !payload?.snapshot) {
        throw new Error(payload?.error ?? 'Chargement serveur impossible.');
      }

      setSnapshot(payload.snapshot);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Chargement impossible.');
    } finally {
      setHasLoadedServerSnapshot(true);
      setIsSyncing(false);
    }
  });

  const rebuildServerSnapshot = React.useEffectEvent(async () => {
    if (productionData.length === 0 && subComponentsData.length === 0 && Object.keys(weeklyTargets).length === 0) {
      setSyncError("Aucune donnee locale a reenregistrer dans la base.");
      return;
    }

    setIsRebuildingServer(true);
    setSyncError(null);

    try {
      const response = await fetch('/api/dashboard-data', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productionData,
          subComponentsData,
          weeklyTargets,
          warnings,
        }),
      });

      const payload = (await readJsonResponse<{
        error?: string;
        snapshot?: {
          productionData: typeof productionData;
          subComponentsData: typeof subComponentsData;
          weeklyTargets: Record<string, number>;
          warnings: string[];
        };
      }>(response)) ?? null;

      if (!response.ok || !payload?.snapshot) {
        throw new Error(payload?.error ?? 'Reenregistrement serveur impossible.');
      }

      setSnapshot(payload.snapshot);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Reenregistrement impossible.');
    } finally {
      setIsRebuildingServer(false);
    }
  });

  const resetServerSnapshot = React.useEffectEvent(async () => {
    const confirmed = window.confirm(
      'Cette action va vider les donnees du dashboard dans la base et localement. Continuer ?'
    );

    if (!confirmed) {
      return;
    }

    setIsResettingServer(true);
    setSyncError(null);

    try {
      const response = await fetch('/api/dashboard-data', {
        method: 'DELETE',
      });

      const payload = (await readJsonResponse<{
        error?: string;
        snapshot?: {
          productionData: typeof productionData;
          subComponentsData: typeof subComponentsData;
          weeklyTargets: Record<string, number>;
          warnings: string[];
        };
      }>(response)) ?? null;

      if (!response.ok || !payload?.snapshot) {
        throw new Error(payload?.error ?? 'Reset serveur impossible.');
      }

      clearData();
      setSnapshot(payload.snapshot);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Reset impossible.');
    } finally {
      setIsResettingServer(false);
    }
  });

  React.useEffect(() => {
    if (!mounted) return;
    const syncHandle = window.setTimeout(() => {
      void syncFromServer();
    }, 0);

    return () => window.clearTimeout(syncHandle);
  }, [mounted]);

  const requestActionCode = React.useCallback((actionLabel: string) => {
    const enteredCode = window.prompt(`Entrez le code pour "${actionLabel}"`);

    if (enteredCode === null) {
      return false;
    }

    if (enteredCode.trim() !== ACCESS_CODE) {
      setSyncError('Code incorrect. Utilisez le code autorise pour acceder a cette action.');
      return false;
    }

    return true;
  }, []);

  const secureAction = React.useCallback(
    async (actionLabel: string, action: () => Promise<void> | void) => {
      if (!requestActionCode(actionLabel)) {
        return;
      }

      await action();
    },
    [requestActionCode]
  );

  const actionCardClass =
    'group relative flex min-h-[5.9rem] min-w-[10.75rem] flex-col justify-between overflow-hidden rounded-[1.5rem] border px-4 py-3 text-left shadow-[0_20px_38px_-30px_rgba(15,23,42,0.35)] transition duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60';

  if (!mounted || (!hasLoadedServerSnapshot && isSyncing)) {
    return (
      <div className="relative min-h-screen bg-cover bg-center bg-fixed" style={{ backgroundImage: 'url("/BACK VIEW (1).png")' }}>
        <div className="absolute inset-0 z-0 bg-[var(--dashboard-page-overlay)] backdrop-blur-[1px]" />
        <div className="relative z-10 flex min-h-screen items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-b-[var(--dashboard-primary)] border-t-[var(--dashboard-primary)]" />
            <p className="text-sm font-semibold text-slate-700">Synchronisation des donnees centralisees...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-cover bg-center bg-fixed" style={{ backgroundImage: 'url("/BACK VIEW (1).png")' }}>
      <div className="absolute inset-0 z-0 bg-[var(--dashboard-page-overlay)] backdrop-blur-[1px]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-72 bg-[radial-gradient(circle_at_top,rgba(22,50,79,0.16),transparent_58%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-72 bg-[radial-gradient(circle_at_bottom,rgba(242,138,73,0.16),transparent_54%)]" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="sticky top-0 z-50 border-b border-white/50 bg-white/78 shadow-[0_20px_40px_-32px_rgba(16,40,63,0.55)] backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-[110rem] flex-col items-center gap-4 px-2 py-4 sm:px-4 lg:px-6">
            <div className="flex w-full flex-col items-center justify-center gap-4 text-center lg:flex-row lg:items-center lg:justify-center lg:text-left">
              <div className="dashboard-logo-frame relative flex items-center gap-3 overflow-hidden rounded-[1.6rem] border border-white/70 bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(243,247,251,0.92))] px-5 py-4 shadow-[0_22px_48px_-34px_rgba(16,40,63,0.42)]">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(214,69,93,0.14),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(18,48,71,0.12),transparent_48%)]" />
                <div className="relative z-10 flex h-14 w-20 items-center justify-center rounded-[1.15rem] border border-white/90 bg-white/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_14px_26px_-22px_rgba(15,23,42,0.48)]">
                  <Image
                    src="/logo myc.jpg"
                    alt="MYC Beauty"
                    width={170}
                    height={48}
                    className="h-10 w-auto rounded-md object-contain drop-shadow-[0_12px_20px_rgba(19,48,77,0.18)]"
                  />
                </div>
                <div className="relative z-10 flex flex-col">
                  <p className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400">MYC identity</p>
                  <p className="mt-1 text-sm font-black tracking-[0.04em] text-slate-800">Beauty Manufacturing</p>
                </div>
              </div>

              <div className="flex max-w-[36rem] flex-col items-center lg:items-start">
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Manufacturing cockpit</p>
                <h1 className="bg-[linear-gradient(135deg,#0d2237,#c53b53)] bg-clip-text text-2xl font-black leading-tight tracking-tight text-transparent sm:text-[2rem]">
                  MYC Production Dashboard
                </h1>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Performance par departement et par ligne
                </p>
              </div>
            </div>

            <div className="grid w-full max-w-[66rem] auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {productionData.length > 0 && (
                <>
                  <div className="dashboard-shell-panel flex min-h-[5.9rem] min-w-[10.75rem] flex-col justify-between rounded-[1.5rem] border border-white/60 px-4 py-3 shadow-[0_20px_38px_-30px_rgba(15,23,42,0.28)]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Base</p>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Systeme central</p>
                      </div>
                      <DatabaseZap className="h-4 w-4 text-[var(--dashboard-primary)]" />
                    </div>
                    <div className="flex items-end justify-between gap-3">
                      <span className="text-base font-black text-slate-800">
                        {isResettingServer ? 'Reset...' : isRebuildingServer ? 'Sync...' : 'Active'}
                      </span>
                      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-600">
                        live
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => void secureAction('Recharger la base', rebuildServerSnapshot)}
                    disabled={isSyncing || isRebuildingServer || isResettingServer}
                    className={`${actionCardClass} border-slate-200 bg-white hover:border-[var(--dashboard-accent-red)] hover:text-[var(--dashboard-accent-red-strong)]`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Sync</p>
                        <p className="mt-2 text-sm font-black text-slate-800">Recharger</p>
                      </div>
                      <RefreshCw className={`h-4 w-4 ${isSyncing || isRebuildingServer ? 'animate-spin' : ''}`} />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      Mise a jour serveur
                    </span>
                  </button>

                  <button
                    onClick={() => void secureAction('Reset de la base', resetServerSnapshot)}
                    disabled={isSyncing || isRebuildingServer || isResettingServer}
                    className={`${actionCardClass} border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-400">Secure</p>
                        <p className="mt-2 text-sm font-black">Reset</p>
                      </div>
                      <RotateCcw className={`h-4 w-4 ${isResettingServer ? 'animate-spin' : ''}`} />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-400">
                      Action protegee
                    </span>
                  </button>

                  <DepartmentPdfExportButton data={productionData} />
                </>
              )}
              <button
                onClick={() =>
                  void secureAction('Importer des donnees', () => {
                    setIsImportModalOpen(true);
                  })
                }
                className={`${actionCardClass} border-[#b9344d] bg-[linear-gradient(135deg,#d6455d,#b9344d)] text-white hover:brightness-105`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/70">Upload</p>
                    <p className="mt-2 text-sm font-black">Importer Daily Prod</p>
                  </div>
                  <FileSpreadsheet className="h-4 w-4" />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/72">
                  Acces securise
                </span>
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto flex-grow w-full max-w-[110rem] px-2 py-6 sm:px-4 lg:px-6">
          {syncError && (
            <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm">
              Synchronisation serveur indisponible. Affichage des donnees locales si disponibles.
              {' '}
              <span className="font-semibold">{syncError}</span>
            </div>
          )}

          {productionData.length === 0 ? (
            <div className="dashboard-shell-panel flex flex-col items-center justify-center rounded-[2rem] py-20">
              <div className="mb-6 rounded-full bg-[linear-gradient(135deg,color-mix(in_srgb,var(--dashboard-primary)_14%,white),white)] p-6 shadow-inner">
                <FileSpreadsheet className="h-16 w-16 text-[var(--dashboard-primary)]" />
              </div>
              <h2 className="mb-2 text-3xl font-black tracking-tight text-slate-900">Aucune donnee de production</h2>
              <p className="mb-8 max-w-md text-center text-slate-500">
                Importez les fichiers Excel de chaque departement et, si besoin, votre fichier de targets depuis la
                fenetre d&apos;import.
                {' '}
                <span className="font-semibold text-slate-700">Aucune dependance au dossier public.</span>
              </p>
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center rounded-2xl bg-[linear-gradient(135deg,#d6455d,#b9344d)] px-6 py-3 font-black text-white shadow-[0_18px_36px_-18px_rgba(185,52,77,0.9)] transition hover:-translate-y-0.5"
              >
                <FileSpreadsheet className="mr-2 h-5 w-5" />
                Importer des donnees
              </button>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in duration-500">
              {showWarnings && warnings.length > 0 && (
                <div className="dashboard-shell-panel animate-in slide-in-from-top rounded-[1.6rem] border-l-4 border-[var(--dashboard-warning)] bg-[color-mix(in_srgb,var(--dashboard-warning)_14%,white)] p-4 duration-300">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start">
                      <AlertTriangle className="h-5 w-5 text-[var(--dashboard-warning)]" aria-hidden="true" />
                      <div className="ml-3 flex-1">
                        <h3 className="text-sm font-bold text-[var(--dashboard-primary-strong)]">
                          Alertes qualite / coherence des donnees ({warnings.length})
                        </h3>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-700">
                          {warnings.map((warning, index) => (
                            <li key={index}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowWarnings(false)}
                      className="text-[var(--dashboard-warning)] transition-colors hover:text-[var(--dashboard-primary-strong)]"
                    >
                      Masquer
                    </button>
                  </div>
                </div>
              )}

              <div className="animate-in fade-in duration-300">
                <ExecutiveDailyDashboard data={productionData} subComponentsData={subComponentsData} />
              </div>
            </div>
          )}
        </main>

        <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />
      </div>
    </div>
  );
}
