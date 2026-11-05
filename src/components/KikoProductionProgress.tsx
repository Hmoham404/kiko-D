'use client';

import { useMemo } from 'react';
import { CalendarDays, Check, Factory, Flag, TrendingUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { ProductionData } from '@/lib/dashboardTypes';
import { getKikoProductionProgress, KIKO_PRODUCTION_PLAN } from '@/lib/kikoProductionProgress';

interface KikoProductionProgressProps {
  data: ProductionData[];
  selectedDate: string;
}

const number = (value: number) => new Intl.NumberFormat('fr-FR').format(Math.round(value));
const percent = (value: number) => `${(value * 100).toFixed(1).replace('.', ',')} %`;
const dateLabel = (value: string) => value ? format(parseISO(value), 'dd/MM/yyyy') : '—';
const clamp = (value: number) => Math.min(1, Math.max(0, value));

export function KikoProductionProgress({ data, selectedDate }: KikoProductionProgressProps) {
  const progress = useMemo(() => getKikoProductionProgress(data, selectedDate), [data, selectedDate]);
  const outerRadius = 110;
  const outerLength = 2 * Math.PI * outerRadius;
  const recentDays = progress.history.slice(-7);

  return (
    <section aria-labelledby="kiko-progress-title" className="overflow-hidden rounded-[2rem] border border-white/80 bg-white/95 shadow-[0_24px_60px_-38px_rgba(16,40,63,0.45)]">
      <div className="grid lg:grid-cols-[minmax(19rem,0.85fr)_minmax(0,1.65fr)]">
        <div className="relative overflow-hidden bg-[#123047] px-5 py-7 text-white sm:px-7">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full border-[35px] border-white/[0.025]" />
          <div className="relative flex items-center justify-between gap-3">
            <span className="text-[11px] font-black uppercase tracking-[0.24em] text-white/65">Suivi de commande</span>
            <span className="rounded-full border border-white/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]">KIKO · Assemblage</span>
          </div>
          <h2 id="kiko-progress-title" className="relative mt-4 text-2xl font-black tracking-tight">Chaque jour compte.</h2>

          <div
            role="progressbar"
            aria-label="Production cumulée KIKO Assemblage sur l’objectif total"
            aria-valuemin={0}
            aria-valuemax={KIKO_PRODUCTION_PLAN.total}
            aria-valuenow={Math.min(KIKO_PRODUCTION_PLAN.total, Math.max(0, progress.cumulative))}
            aria-valuetext={`${number(progress.cumulative)} pièces sur ${number(KIKO_PRODUCTION_PLAN.total)}, ${percent(progress.totalProgress)}`}
            className="relative mx-auto mt-5 h-64 w-64 max-w-full"
          >
            <svg viewBox="0 0 256 256" className="h-full w-full -rotate-90" aria-hidden="true">
              <circle cx="128" cy="128" r={outerRadius} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="12" />
              <circle cx="128" cy="128" r={outerRadius} fill="none" stroke="#ff9866" strokeWidth="12" strokeLinecap="round"
                strokeDasharray={outerLength} strokeDashoffset={outerLength * (1 - clamp(progress.totalProgress))}
                className="transition-[stroke-dashoffset] duration-1000 ease-out motion-reduce:transition-none" />
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[2.8rem] font-black tracking-[-0.05em] tabular-nums">{percent(progress.totalProgress)}</span>
              <span className="mt-1 text-xl font-bold tabular-nums">{number(progress.cumulative)}</span>
              <span className="mt-1 text-[11px] text-white/60">pièces / {number(KIKO_PRODUCTION_PLAN.total)}</span>
            </div>
          </div>
        </div>

        <div className="min-w-0 p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Cumul depuis le {dateLabel(KIKO_PRODUCTION_PLAN.startDate)}</p>
              <p className="mt-2 text-lg font-black text-slate-900">Situation au {dateLabel(selectedDate)}</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
              <CalendarDays className="h-4 w-4" />Échéance {dateLabel(KIKO_PRODUCTION_PLAN.deadline)}
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-orange-200 bg-orange-50/70 p-4">
              <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.1em] text-orange-800"><Factory className="h-4 w-4" />Qté produite / jour</p>
              <p className="mt-3 text-3xl font-black tracking-tight text-slate-950 tabular-nums">+{number(progress.dailyQuantity)} <span className="text-sm font-semibold text-slate-500">pièces</span></p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.1em] text-slate-500"><Flag className="h-4 w-4" />Reste à produire · total</p>
              <p className="mt-3 text-3xl font-black tracking-tight text-slate-950 tabular-nums">{number(progress.remainingTotal)} <span className="text-sm font-semibold text-slate-500">pièces</span></p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-teal-100 bg-teal-50/50 p-4">
            <p className="text-sm font-black text-slate-900">Palier de {number(KIKO_PRODUCTION_PLAN.milestone)} pièces</p>
            <p className="mt-3 flex items-center gap-2 text-xs text-teal-900">
              {progress.milestoneReachedOn ? <Check className="h-4 w-4 shrink-0" /> : <TrendingUp className="h-4 w-4 shrink-0" />}
              {progress.milestoneReachedOn
                ? `Palier atteint le ${dateLabel(progress.milestoneReachedOn)}${progress.milestoneReachedOn > KIKO_PRODUCTION_PLAN.deadline ? ' · après l’échéance' : ''}.`
                : `Reste ${number(progress.remainingMilestone)} pièces.`}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>{progress.isPastDeadline ? 'Échéance passée' : `${progress.daysUntilDeadline} jours avant l’échéance`}</span>
            {progress.totalReachedOn && <span className="font-bold text-emerald-700">Objectif total atteint le {dateLabel(progress.totalReachedOn)}{progress.totalReachedOn > KIKO_PRODUCTION_PLAN.deadline ? ' · hors délai' : ''}</span>}
          </div>
          {progress.isPastDeadline && (
            <p className="mt-2 text-xs text-slate-500">Production au {dateLabel(KIKO_PRODUCTION_PLAN.deadline)} : <strong>{number(progress.producedByDeadline)} pièces</strong>.</p>
          )}

          {progress.hasClientData ? (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Production par jour</p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
                {recentDays.map((day) => (
                  <div key={day.date} className={`rounded-xl border p-2.5 ${day.date === selectedDate ? 'border-orange-200 bg-orange-50' : 'border-slate-100 bg-slate-50'}`}>
                    <p className="text-[10px] font-semibold text-slate-500">{format(parseISO(day.date), 'dd/MM')}</p>
                    <p className="mt-1 text-xs font-black text-slate-800 tabular-nums">+{number(day.quantity)}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-5 border-t border-slate-100 pt-4 text-sm leading-6 text-slate-500">
              {selectedDate < KIKO_PRODUCTION_PLAN.startDate ? (
                <>Début du suivi : {dateLabel(KIKO_PRODUCTION_PLAN.startDate)}.</>
              ) : (
                <>Aucune donnée KIKO sur cette période.</>
              )}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
