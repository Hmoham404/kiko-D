'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Save, Users, X } from 'lucide-react';
import {
  buildAssemblyClientTargetKey, getAssemblyClientTarget, getAssemblyTargetClients,
  getAssemblyTargetWeeks, getAssemblyWeeklyTotal, validateAssemblyClientAllocation,
  ASSEMBLY_WORKING_DAYS_PER_WEEK,
} from '@/lib/assemblyClientTargets';
import { getWeekMetadata } from '@/lib/weeklyMetrics';
import { readJsonResponse } from '@/lib/http';
import { useStore } from '@/store/useStore';

const number = (value: number) => new Intl.NumberFormat('fr-FR').format(value);

export function AssemblyClientTargetsModal({ initialWeekKey, onClose }: { initialWeekKey?: string; onClose: () => void }) {
  const { productionData, weeklyTargets, setWeeklyTargets } = useStore();
  const weeks = getAssemblyTargetWeeks(productionData, weeklyTargets);
  const [selectedWeek, setSelectedWeek] = useState(initialWeekKey ?? weeks.at(-1) ?? '');
  const weekKey = weeks.includes(selectedWeek) ? selectedWeek : weeks.at(-1) ?? '';
  const clients = getAssemblyTargetClients(productionData, weeklyTargets, weekKey);
  const referenceTotal = getAssemblyWeeklyTotal(productionData, weeklyTargets, weekKey);
  const [totalOverrides, setTotalOverrides] = useState<Record<string, number>>({});
  const total = totalOverrides[weekKey] ?? referenceTotal;
  const [inputMode, setInputMode] = useState<'weekly' | 'daily'>('weekly');
  const factor = inputMode === 'daily' ? ASSEMBLY_WORKING_DAYS_PER_WEEK : 1;
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.focus();
    return () => previous?.focus();
  }, []);

  const getValue = (client: string) => draft[buildAssemblyClientTargetKey(client, weekKey)] ??
    String(getAssemblyClientTarget(weeklyTargets, client, weekKey) ?? '');
  const allocated = clients.reduce((sum, client) => sum + (Number(getValue(client)) || 0), 0);
  const remaining = total - allocated;
  const clientsValid = clients.length > 0 && Number.isSafeInteger(allocated) && clients.every((client) =>
    getValue(client).trim() !== '' && Number.isSafeInteger(Number(getValue(client))) && Number(getValue(client)) >= 0);
  const valid = clientsValid && remaining === 0;

  const save = async () => {
    setError('');
    setSaving(true);
    try {
      const allocations = clients.map((client) => ({ client, target: Number(getValue(client)) }));
      validateAssemblyClientAllocation(productionData, weeklyTargets, weekKey, allocations, totalOverrides[weekKey]);
      const response = await fetch('/api/assembly-client-targets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ weekKey, allocations, weeklyTotal: totalOverrides[weekKey] }),
      });
      const payload = await readJsonResponse<{ weeklyTargets?: Record<string, number>; error?: string }>(response);
      if (!response.ok || !payload?.weeklyTargets) throw new Error(payload?.error ?? 'Sauvegarde impossible. Réessayez.');
      setWeeklyTargets(payload.weeklyTargets);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sauvegarde impossible.');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm"
      onClick={(event) => { event.stopPropagation(); if (event.target === event.currentTarget && !saving) onClose(); }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Escape' && !saving) onClose();
        if (event.key === 'Tab') {
          const controls = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), input:not(:disabled)');
          if (!controls?.length) return;
          const first = controls[0]; const last = controls[controls.length - 1];
          if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      }}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="assembly-client-targets-title" tabIndex={-1}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/60 bg-white shadow-2xl outline-none">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-orange-50 p-3 text-orange-600"><Users className="h-5 w-5" /></div>
            <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Assemblage · objectifs hebdomadaires</p>
              <h2 id="assembly-client-targets-title" className="mt-1 text-xl font-bold tracking-tight text-slate-950">Répartir l’objectif par client</h2></div>
          </div>
          <button type="button" aria-label="Fermer la répartition" disabled={saving} onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 disabled:opacity-40"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-5 p-5 sm:p-6">
          <label className="block text-xs font-semibold text-slate-600">Semaine à configurer
            <select value={weekKey} disabled={saving} onChange={(event) => { setSelectedWeek(event.target.value); setError(''); }}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100">
              {weeks.map((week) => <option key={week} value={week}>{getWeekMetadata(week.split('__')[0]).weekLabel}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-[#123047] p-4 text-white">
            <div><p className="text-[10px] text-white/60">Total Assemblage</p><p className="mt-1 text-lg font-bold tabular-nums">{number(total)}</p></div>
            <div className="border-l border-white/15 pl-3"><p className="text-[10px] text-white/60">Réparti</p><p className="mt-1 text-lg font-bold tabular-nums">{number(allocated)}</p></div>
            <div className="border-l border-white/15 pl-3" aria-live="polite"><p className="text-[10px] text-white/60">{remaining < 0 ? 'Dépassement' : 'À répartir'}</p><p className={`mt-1 text-lg font-bold tabular-nums ${remaining < 0 ? 'text-red-300' : remaining === 0 ? 'text-emerald-300' : 'text-orange-200'}`}>{number(Math.abs(remaining))}</p></div>
          </div>
          <label className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-slate-600">Saisir les objectifs
            <select aria-label="Unité de saisie des objectifs" value={inputMode} disabled={saving} onChange={(event) => setInputMode(event.target.value as 'weekly' | 'daily')}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-orange-400">
              <option value="weekly">Par semaine</option>
              <option value="daily">Par jour · {ASSEMBLY_WORKING_DAYS_PER_WEEK} jours / semaine</option>
            </select>
          </label>
          <p className="text-xs leading-5 text-slate-500">{inputMode === 'daily' ? `Les objectifs journaliers sont multipliés par ${ASSEMBLY_WORKING_DAYS_PER_WEEK} jours (lundi à samedi). ` : ''}Renseignez chaque client, y compris 0. Les totaux ci-dessus sont hebdomadaires. Vous pouvez ajuster le total Assemblage à votre répartition pour cette semaine.</p>
          <div className="space-y-2">
            {clients.map((client) => (
              <label key={client} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <span className="text-sm font-bold text-slate-800">{client || 'Non renseigné'}</span>
                <span className="flex flex-col items-end gap-1"><span className="flex items-center gap-2"><input type="number" min={0} step={inputMode === 'daily' ? 'any' : 1} required disabled={saving} value={getValue(client) === '' ? '' : Number(getValue(client)) / factor}
                  aria-label={`Objectif ${inputMode === 'daily' ? 'journalier' : 'hebdomadaire'} ${client || 'Non renseigné'}`} placeholder="Objectif" onChange={(event) => {
                    const value = event.target.value;
                    setDraft((current) => ({ ...current, [buildAssemblyClientTargetKey(client, weekKey)]: value === '' ? '' : String(Number(value) * factor) })); setError('');
                  }} className="w-36 rounded-lg border border-slate-200 bg-white px-3 py-2 text-right text-sm font-bold tabular-nums text-slate-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
                  <span className="text-xs text-slate-400">pièces / {inputMode === 'daily' ? 'jour' : 'semaine'}</span></span>
                  {inputMode === 'daily' && getValue(client) !== '' && <span className="text-[10px] text-slate-500">{number(Number(getValue(client)))} pièces / semaine</span>}
                </span>
              </label>
            ))}
            {clients.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">Importez les données Assemblage de cette semaine avec la colonne Client pour renseigner la répartition.</p>}
          </div>
          {valid && <p className="flex items-center gap-2 text-xs font-semibold text-emerald-700"><Check className="h-4 w-4" />Le total est entièrement réparti.</p>}
          {clientsValid && remaining !== 0 && <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
            <p className="text-xs leading-5 text-orange-900">Votre répartition prévoit {number(allocated)} pièces sur la semaine, contre {number(total)} dans le total actuel.</p>
            <button type="button" disabled={saving} onClick={() => { setTotalOverrides((current) => ({ ...current, [weekKey]: allocated })); setError(''); }}
              className="mt-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-orange-800 ring-1 ring-orange-200 hover:bg-orange-100">Ajuster le total Assemblage à {number(allocated)} pièces / semaine</button>
          </div>}
          {totalOverrides[weekKey] !== undefined && <p className="text-xs text-slate-500">Le total de cette semaine sera enregistré à {number(total)} pièces (référence actuelle : {number(referenceTotal)}).
            <button type="button" disabled={saving} className="ml-2 font-semibold underline" onClick={() => setTotalOverrides((current) => { const next = { ...current }; delete next[weekKey]; return next; })}>Annuler l’ajustement</button>
          </p>}
          {error && <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:px-6">
          <button type="button" disabled={saving} onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 disabled:opacity-40">Plus tard</button>
          <button type="button" disabled={saving || !valid} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-xl bg-[#123047] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#1c435f] disabled:cursor-not-allowed disabled:opacity-40"><Save className="h-4 w-4" />{saving ? 'Enregistrement…' : 'Enregistrer cette semaine'}</button>
        </div>
      </div>
    </div>
  );
}
