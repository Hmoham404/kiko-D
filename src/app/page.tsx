'use client';

import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import Image from 'next/image';
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, FileSpreadsheet, RotateCcw } from 'lucide-react';
import { readJsonResponse } from '@/lib/http';
import { useStore } from '@/store/useStore';
import { ImportModal } from '@/components/ImportModal';
import { ExecutiveDailyDashboard } from '@/components/ExecutiveDailyDashboard';

const ACCESS_CODE = 'myc@2026';
const formatFullDate = (date: string) => {
  try {
    return format(parseISO(date), 'EEEE dd MMMM yyyy', { locale: fr });
  } catch {
    return date;
  }
};

export default function DashboardPage() {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [showWarnings, setShowWarnings] = useState(true);
  const [isSyncing, setIsSyncing] = React.useState(true);
  const [isResettingServer, setIsResettingServer] = React.useState(false);
  const [hasLoadedServerSnapshot, setHasLoadedServerSnapshot] = React.useState(false);
  const [syncError, setSyncError] = React.useState<string | null>(null);
  const { productionData, subComponentsData, warnings, setSnapshot, clearData } = useStore();

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

  const availableDates = React.useMemo(() => {
    const dates = new Set([...productionData.map((item) => item.date), ...subComponentsData.map((item) => item.date)]);
    return Array.from(dates).filter(Boolean).sort();
  }, [productionData, subComponentsData]);

  const [selectedDate, setSelectedDate] = React.useState('');

  const activeDate = availableDates.includes(selectedDate)
    ? selectedDate
    : availableDates[availableDates.length - 1] ?? '';
  const activeDateIndex = availableDates.indexOf(activeDate);
  const canGoToPreviousDate = activeDateIndex > 0;
  const canGoToNextDate = activeDateIndex >= 0 && activeDateIndex < availableDates.length - 1;
  const activeDateLabel = formatFullDate(activeDate);

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
          <div className="mx-auto w-full max-w-[110rem] px-2 py-3 sm:px-4 lg:px-6">
            <div className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(245,248,251,0.92))] px-4 py-4 shadow-[0_24px_50px_-34px_rgba(16,40,63,0.42)] sm:px-6">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(214,69,93,0.08),transparent_28%,rgba(18,48,71,0.04)_68%,transparent_100%)]" />
              <div className="pointer-events-none absolute inset-y-0 right-0 flex w-full items-center justify-end opacity-[0.14]">
                <Image
                  src="/logo myc.jpg"
                  alt=""
                  width={620}
                  height={220}
                  className="h-24 w-auto object-contain blur-[0.3px] sm:h-28 lg:h-40"
                />
              </div>

              <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="max-w-[42rem]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex rounded-full border border-slate-200 bg-white/88 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
                      Manufacturing cockpit
                    </span>
                    <span className="inline-flex rounded-full bg-[linear-gradient(135deg,#123047,#244f74)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-white shadow-sm">
                      MYC
                    </span>
                  </div>
                  <h1 className="mt-3 text-[1.9rem] font-black leading-[1] tracking-[-0.05em] text-slate-950 sm:text-[2.4rem]">
                    MYC Production <span className="text-[#b33b53]">Dashboard</span>
                  </h1>
                  <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500 sm:text-[13px]">
                    Performance par departement et par ligne
                  </p>
                </div>

                {productionData.length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-[minmax(0,22rem)_12rem] xl:min-w-[35rem]">
                    <div className="rounded-[1.5rem] border border-white/80 bg-white/88 p-3 shadow-[0_16px_30px_-22px_rgba(15,23,42,0.26)] backdrop-blur">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Date</p>
                          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Lecture active</p>
                        </div>
                        <CalendarDays className="h-4 w-4 text-[var(--dashboard-primary)]" />
                      </div>
                      <p className="mt-2 truncate text-sm font-black capitalize text-slate-800">{activeDateLabel}</p>
                      <div className="mt-3 grid grid-cols-[2.35rem_minmax(0,1fr)_2.35rem] items-center gap-2 rounded-[1rem] border border-slate-200 bg-white/90 p-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (!canGoToPreviousDate) return;
                            React.startTransition(() => setSelectedDate(availableDates[activeDateIndex - 1]));
                          }}
                          disabled={!canGoToPreviousDate}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition enabled:hover:border-slate-300 enabled:hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Date precedente"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>

                        <label className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm">
                          <CalendarDays className="h-3.5 w-3.5 text-slate-500" />
                          <input
                            type="date"
                            value={activeDate}
                            min={availableDates[0]}
                            max={availableDates[availableDates.length - 1]}
                            onChange={(event) => {
                              const nextValue = event.target.value;
                              React.startTransition(() => setSelectedDate(nextValue));
                            }}
                            className="w-full bg-transparent text-xs font-bold text-slate-800 outline-none"
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => {
                            if (!canGoToNextDate) return;
                            React.startTransition(() => setSelectedDate(availableDates[activeDateIndex + 1]));
                          }}
                          disabled={!canGoToNextDate}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition enabled:hover:border-slate-300 enabled:hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Date suivante"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={() => void secureAction('Reset de la base', resetServerSnapshot)}
                      disabled={isSyncing || isResettingServer}
                      className="group flex min-h-[8.5rem] flex-col justify-between overflow-hidden rounded-[1.5rem] border border-rose-200 bg-[linear-gradient(145deg,rgba(255,241,243,0.96),rgba(255,247,248,0.92))] px-4 py-3 text-left text-rose-700 shadow-[0_18px_36px_-26px_rgba(190,24,93,0.28)] transition duration-300 hover:-translate-y-0.5 hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-400">Secure</p>
                          <p className="mt-2 text-lg font-black">Reset</p>
                        </div>
                        <RotateCcw className={`h-4 w-4 ${isResettingServer ? 'animate-spin' : ''}`} />
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-400">
                        Action protegee
                      </span>
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto flex-grow w-full max-w-[110rem] px-2 py-4 sm:px-4 lg:px-6">
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
            <div className="space-y-6 animate-in fade-in duration-500">
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
                <ExecutiveDailyDashboard
                  data={productionData}
                  subComponentsData={subComponentsData}
                  availableDates={availableDates}
                  selectedDate={activeDate}
                />
              </div>
            </div>
          )}
        </main>

        <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />
      </div>
    </div>
  );
}
