'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { AlertTriangle, FileSpreadsheet, Settings2, Trash2 } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { ImportModal } from '@/components/ImportModal';
import { WeeklyTargetsModal } from '@/components/WeeklyTargetsModal';
import { ExecutiveDailyDashboard } from '@/components/ExecutiveDailyDashboard';

export default function DashboardPage() {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isTargetsModalOpen, setIsTargetsModalOpen] = useState(false);
  const [showWarnings, setShowWarnings] = useState(true);
  const { productionData, subComponentsData, warnings, clearData } = useStore();

  const [mounted, setMounted] = React.useState(() => useStore.persist.hasHydrated());
  React.useEffect(() => {
    return useStore.persist.onFinishHydration(() => {
      setMounted(true);
    });
  }, []);

  if (!mounted) {
    return (
      <div className="relative min-h-screen bg-cover bg-center bg-fixed" style={{ backgroundImage: 'url("/BACK VIEW (1).png")' }}>
        <div className="absolute inset-0 z-0 bg-[var(--dashboard-page-overlay)] backdrop-blur-[1px]" />
        <div className="relative z-10 flex min-h-screen items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-b-[var(--dashboard-primary)] border-t-[var(--dashboard-primary)]" />
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
        <header className="sticky top-0 z-50 border-b border-white/50 bg-white/72 shadow-[0_20px_40px_-32px_rgba(16,40,63,0.55)] backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-[110rem] flex-wrap items-center justify-between gap-4 px-2 py-4 sm:px-4 lg:px-6">
            <div className="flex items-center gap-4">
              <div className="dashboard-logo-frame flex items-center gap-3 rounded-[1.4rem] px-4 py-3">
                <div className="relative z-10 flex flex-col">
                  <Image
                    src="/logo myc.jpg"
                    alt="MYC Beauty"
                    width={170}
                    height={48}
                    className="mt-1 h-11 w-auto rounded-md object-contain drop-shadow-[0_8px_18px_rgba(19,48,77,0.16)]"
                  />
                </div>
              </div>

              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Manufacturing cockpit</p>
                <h1 className="bg-[linear-gradient(135deg,#0d2237,#c53b53)] bg-clip-text text-2xl font-black leading-tight tracking-tight text-transparent">
                  MYC Production Dashboard
                </h1>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Performance par departement et par ligne
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {productionData.length > 0 && (
                <button
                  onClick={() => setIsTargetsModalOpen(true)}
                  className="dashboard-shell-panel flex items-center rounded-xl px-4 py-2 text-sm font-black text-slate-700 transition hover:-translate-y-0.5 hover:border-[var(--dashboard-accent-red)] hover:text-[var(--dashboard-accent-red-strong)]"
                >
                  <Settings2 className="mr-2 h-4 w-4" />
                  Regler les targets
                </button>
              )}
              {productionData.length > 0 && (
                <button
                  onClick={clearData}
                  className="dashboard-shell-panel flex items-center rounded-xl px-4 py-2 text-sm font-black text-slate-700 transition hover:-translate-y-0.5 hover:border-[var(--dashboard-accent-red)] hover:text-[var(--dashboard-accent-red-strong)]"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Effacer
                </button>
              )}
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center rounded-xl bg-[linear-gradient(135deg,#d6455d,#b9344d)] px-4 py-2 text-sm font-black text-white shadow-[0_18px_36px_-18px_rgba(185,52,77,0.9)] transition hover:-translate-y-0.5 hover:brightness-105"
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Importer Daily Prod
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto flex-grow w-full max-w-[110rem] px-2 py-6 sm:px-4 lg:px-6">
          {productionData.length === 0 ? (
            <div className="dashboard-shell-panel flex flex-col items-center justify-center rounded-[2rem] py-20">
              <div className="mb-6 rounded-full bg-[linear-gradient(135deg,color-mix(in_srgb,var(--dashboard-primary)_14%,white),white)] p-6 shadow-inner">
                <FileSpreadsheet className="h-16 w-16 text-[var(--dashboard-primary)]" />
              </div>
              <h2 className="mb-2 text-3xl font-black tracking-tight text-slate-900">Aucune donnee de production</h2>
              <p className="mb-8 max-w-md text-center text-slate-500">
                Importez les fichiers Excel de chaque departement pour construire le dashboard principal.
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
        <WeeklyTargetsModal isOpen={isTargetsModalOpen} onClose={() => setIsTargetsModalOpen(false)} />
      </div>
    </div>
  );
}
